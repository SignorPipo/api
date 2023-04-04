import {simd, threads} from 'wasm-feature-detect';
import {WonderlandEngine} from './engine.js';
import {WASM} from './wasm.js';

export * from './utils/event.js';
export * from './wonderland.js';
export * from './engine.js';
export * from './property.js';
export * from './wasm.js';

function loadScript(scriptURL: string): Promise<void> {
    return new Promise((res: () => void, rej) => {
        const s = document.createElement('script');
        const node = document.body.appendChild(s);
        s.onload = () => {
            document.body.removeChild(node);
            res();
        };
        s.onerror = (e) => {
            document.body.removeChild(node);
            rej(e);
        };
        s.src = scriptURL;
    });
}

/**
 * Finds whether simd & threading are supported or not.
 *
 * @returns An object containing boolean for simd and thread.
 */
async function detectFeatures(): Promise<{
    simdSupported: boolean;
    threadsSupported: boolean;
}> {
    let [simdSupported, threadsSupported] = await Promise.all([simd(), threads()]);
    if (simdSupported) {
        console.log('WASM SIMD is supported');
    } else {
        console.warn('WASM SIMD is not supported');
    }
    if (threadsSupported) {
        if (self.crossOriginIsolated) {
            console.log('WASM Threads is supported');
        } else {
            console.warn(
                'WASM Threads is supported, but the page is not crossOriginIsolated, therefore thread support is disabled.'
            );
        }
    } else {
        console.warn('WASM Threads is not supported');
    }

    threadsSupported = threadsSupported && self.crossOriginIsolated;
    return {
        simdSupported,
        threadsSupported,
    };
}

/**
 * Options to forward to {@link loadRuntime}
 */
export interface LoadRuntimeOptions {
    /**
     * If `true`, forces the runtime to load the SIMD-compatible version.
     * If `undefined`, performs browser feature detection to check whether SIMD is supported or not.
     */
    simd: boolean;
    /**
     * If `true`, forces the runtime to load the threads-compatible version.
     * If `undefined`, performs browser feature detection to check whether threads are supported or not.
     */
    threads: boolean;
    /**
     * If `true`, forces the runtime to load a physx-compatible version.
     *
     * **Note**: If your scene uses physx, you **must** enable this option.
     */
    physx: boolean;
    /**
     * If `true`, forces the runtime to load a loader-compatible version.
     *
     * This option allows to load gltf data at runtime.
     */
    loader: boolean;
    /**
     * Path to the loading screen. If `undefined`, defaults to 'WonderlandRuntime-LoadingScreen.bin'.
     * Beware that these are special .bin files signed by Wonderland. Customizing
     * requires an enterprise license, please reach out for more information.
     */
    loadingScreen: string;
}

/* Global boolean to check if AR/VR is supported. */
const xrSupported: {ar: boolean; vr: boolean} = {
    ar: null!,
    vr: null!,
};

/**
 * Check whether XR is supported and store the result in the global space.
 */
function checkXRSupport(): Promise<{ar: boolean; vr: boolean}> {
    if (typeof navigator === 'undefined' || !navigator.xr) {
        xrSupported.vr = false;
        xrSupported.ar = false;
        return Promise.resolve(xrSupported);
    }
    const vrPromise =
        xrSupported.vr !== null
            ? Promise.resolve()
            : navigator.xr
                  .isSessionSupported('immersive-vr')
                  .then((supported) => (xrSupported.vr = supported));
    const arPromise =
        xrSupported.ar !== null
            ? Promise.resolve()
            : navigator.xr
                  .isSessionSupported('immersive-ar')
                  .then((supported) => (xrSupported.ar = supported));

    return Promise.all([vrPromise, arPromise]).then(() => xrSupported);
}

/**
 * Load the runtime using the WASM and JS files.
 *
 * @param runtime The runtime base string, e.g,: `WonderlandRuntime-loader-physx`.
 * @param options Options to modify the loading behaviour.
 *
 * @returns A promise that resolves when the engine is ready to be used.
 */
export async function loadRuntime(
    runtime: string,
    options: Partial<LoadRuntimeOptions> = {}
): Promise<WonderlandEngine> {
    const xrPromise = checkXRSupport();

    const {simdSupported, threadsSupported} = await detectFeatures();
    const {
        simd = simdSupported,
        threads = threadsSupported,
        physx = false,
        loader = false,
        loadingScreen = 'WonderlandRuntime-LoadingScreen.bin',
    } = options;

    const variant = [];
    if (loader) variant.push('loader');
    if (physx) variant.push('physx');
    if (simd) variant.push('simd');
    if (threads) variant.push('threads');

    const variantStr = variant.join('-');

    let filename = runtime;
    if (variantStr) filename = `${filename}-${variantStr}`;

    const download = function (
        filename: string,
        errorMessage: string
    ): Promise<ArrayBuffer> {
        return fetch(filename)
            .then((r) => {
                if (!r.ok) return Promise.reject(errorMessage);
                return r.arrayBuffer();
            })
            .catch((_) => Promise.reject(errorMessage));
    };

    const [wasmData, loadingScreenData] = await Promise.all([
        download(`${filename}.wasm`, 'Failed to fetch runtime .wasm file'),
        download(loadingScreen, 'Failed to fetch loading screen file').catch((_) => null),
    ]);

    const wasm = new WASM(threads);
    (wasm.worker as string) = `${filename}.worker.js`;
    (wasm.wasm as ArrayBuffer) = wasmData;
    const engine = new WonderlandEngine(wasm, loadingScreenData);

    if (!window._WL) {
        window._WL = {runtimes: {}};
    }
    const runtimes = window._WL.runtimes;

    /* Global identifier of this runtime in `window`. */
    const runtimeGlobalId = variantStr ? variantStr : 'default';
    /* Only load the runtime if not previously loaded in the page */
    if (!runtimes[runtimeGlobalId]) {
        await loadScript(`${filename}.js`);
        runtimes[runtimeGlobalId] = window.instantiateWonderlandRuntime!;
        window.instantiateWonderlandRuntime = undefined;
    }
    await runtimes[runtimeGlobalId](wasm);

    engine._init();

    const xr = await xrPromise;
    (engine.arSupported as boolean) = xr.ar;
    (engine.vrSupported as boolean) = xr.vr;

    engine.start();

    return engine;
}
