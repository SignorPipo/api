import {expect, should, use} from '@esm-bundle/chai';
import {chaiAlmost} from './chai/almost.js';

import {
    Component,
    Type,
    Property,
    ComponentProperty,
    Object3D,
    Skin,
    Material,
    Texture,
    Mesh,
} from '..';
import {property} from '../dist/decorators.js';

import {init, reset, WL} from './setup.js';

use(chaiAlmost());

before(init);
beforeEach(reset);

/**
 * Adding a new property test requires to modify multiple things:
 *     1. Add the property type to {@link TestProperties}
 *     2. Add the definition in {@link TestComponentProperties.PropertiesDefinition}
 *     3. Add the definition as a decorator in {@link TestComponentPropertiesDecorator}
 *     3. Add a test for default value in {@link TestComponentProperties.assertDefaults}
 *     4. Add a test for missing default value in {@link TestComponentProperties.assertNoDefaults}
 */

/**
 * TypeScript can't figure out that the `Properties` entries will get added on the instance.
 *
 * This interface represents the instantiated properties.
 */
interface TestProperties {
    propBool: boolean;
    propInt: number;
    propFloat: number;
    propString: string;
    propEnum: number;
    propEnumDefaultMissing: number;
    propEnumDefaultNumber: number;
    propEnumDefaultNumberOutOfRange: number;
    propEnumNoValues: number;
    propEnumEmptyValues: number;
    propObject: Object3D | null;
    propMesh: Mesh | null;
    propTexture: Texture | null;
    propMaterial: Material | null;
    propAnimation: Animation | null;
    propSkin: Skin | null;
    propColor: number[];
}

/**
 * Basic component type to check for properties.
 *
 * Tests will inherit this component to get proper typings.
 */
class TestComponentProperties extends Component {
    /**
     * Property name to definition map.
     *
     * This is different than the original {@link Component.Properties} object.
     * This allows to automatically test properties created with {@link Property} function.
     */
    static PropertiesDefinition = {
        propBool: {name: 'Bool', default: true},
        propInt: {name: 'Int', default: 12},
        propFloat: {name: 'Float', default: 3.75},
        propString: {name: 'String', default: 'hello'},
        propEnum: {name: 'Enum', default: 'snake', values: ['serpent', 'snake']},
        propEnumDefaultMissing: {
            name: 'Enum',
            default: 'monke',
            values: ['serpent', 'snake'],
        },
        propEnumDefaultNumber: {name: 'Enum', default: 1, values: ['serpent', 'snake']},
        propEnumDefaultNumberOutOfRange: {
            name: 'Enum',
            default: 2,
            values: ['serpent', 'snake'],
        },
        propEnumNoValues: {name: 'Enum', default: 'snake'},
        propEnumEmptyValues: {name: 'Enum', values: [], default: 'snake'},
        propObject: {name: 'Object', default: null},
        propMesh: {name: 'Mesh', default: null},
        propTexture: {name: 'Texture', default: null},
        propMaterial: {name: 'Material', default: null},
        propAnimation: {name: 'Animation', default: null},
        propSkin: {name: 'Skin', default: null},
        propColor: {name: 'Color', default: [1, 0, 0.5, 0.75]},
    };

    /**
     * Create properties using the literal syntax `{ ... }`.
     *
     * @param setupDefaults If `true`, add defaults
     * @returns The properties to list in {@link Component.Properties}
     */
    static createLiteralProperties(
        setupDefaults: boolean
    ): Record<string, ComponentProperty> {
        const result = {} as Record<string, ComponentProperty>;
        for (const [name, definition] of Object.entries(
            TestComponentProperties.PropertiesDefinition
        )) {
            result[name] = {
                type: Type[definition.name as keyof typeof Type],
                values: 'values' in definition ? definition['values'] : undefined,
                default: undefined,
            };
            if (setupDefaults) result[name].default = definition.default;
        }
        return result;
    }

    /**
     * Create properties using the funcotr syntax `Property.Type()`.
     *
     * @param setupDefaults If `true`, add defaults
     * @returns The properties to list in {@link Component.Properties}
     */
    static createFunctorProperties(
        setupDefaults: boolean
    ): Record<string, ComponentProperty> {
        const result = {} as Record<string, ComponentProperty>;
        for (const [name, definition] of Object.entries(
            TestComponentProperties.PropertiesDefinition
        )) {
            const values = 'values' in definition ? definition['values'] : undefined;
            const type = definition.name.toLowerCase();
            const functor: (...args: any[]) => ComponentProperty =
                Property[type as keyof typeof Property];
            expect(functor).to.be.instanceOf(Function, `Property '${type}' doesn't exist`);

            const defaults = [];
            if (setupDefaults) {
                defaults.push(
                    ...(Array.isArray(definition.default)
                        ? definition.default
                        : [definition.default])
                );
            }
            const args = type === 'enum' ? [values, ...defaults] : [...defaults];
            result[name] = functor(...args);
        }
        return result;
    }

    /**
     * Assert that each property has the proper value set to
     * the default value defined in the property list.
     *
     * @param instance The instance to read from
     */
    static assertDefaults(instance: TestComponentProperties) {
        const message = `failed on component '${instance.constructor.name}'`;
        expect(instance.propBool).to.equal(true, message);
        expect(instance.propInt).to.equal(12, message);
        expect(instance.propFloat).to.equal(3.75, message);
        expect(instance.propString).to.equal('hello', message);
        expect(instance.propEnum).to.equal(1, message);
        expect(instance.propEnumDefaultMissing).to.equal(0, message);
        expect(instance.propEnumDefaultNumber).to.equal(1, message);
        expect(instance.propEnumDefaultNumberOutOfRange).to.equal(0, message);
        expect(instance.propEnumNoValues).to.equal(undefined, message);
        expect(instance.propEnumEmptyValues).to.equal(undefined, message);
        expect(instance.propObject).to.equal(null, message);
        expect(instance.propMesh).to.equal(null, message);
        expect(instance.propTexture).to.equal(null, message);
        expect(instance.propMaterial).to.equal(null, message);
        expect(instance.propAnimation).to.equal(null, message);
        expect(instance.propSkin).to.equal(null, message);
        expect(instance.propColor).to.deep.equal([1, 0, 0.5, 0.75], message);
    }

    /**
     * Assert that each property has the proper global default value **per type**.
     *
     * @param instance The instance to read from
     */
    static assertNoDefaults(instance: TestComponentProperties) {
        expect(instance.propBool).to.equal(false);
        expect(instance.propInt).to.equal(0);
        expect(instance.propFloat).to.equal(0.0);
        expect(instance.propString).to.equal('');
        expect(instance.propEnum).to.equal(0);
        expect(instance.propEnumNoValues).to.equal(undefined);
        expect(instance.propEnumEmptyValues).to.equal(undefined);
        expect(instance.propObject).to.equal(null);
        expect(instance.propMesh).to.equal(null);
        expect(instance.propTexture).to.equal(null);
        expect(instance.propMaterial).to.equal(null);
        expect(instance.propAnimation).to.equal(null);
        expect(instance.propSkin).to.equal(null);
        expect(instance.propColor).to.deep.equal([0, 0, 0, 1]);
    }
}

/*
 * This is required because adding the property type directly in the class
 * would shadow the default value. The TypeScript compiler would compile
 * the class into something like:
 *
 * ```js
 * class TestComponentProperties {
 *     propObject;
 * }
 * ```
 *
 * Thus `propBool` would override the default `false` value with `undefined`.
 */
interface TestComponentProperties extends TestProperties {}

/**
 * Copy of {@link TestComponentProperties} for decorators.
 */
class TestComponentPropertiesDecorator extends Component {
    static TypeName = 'decorator-with-defaults';

    @property.bool(true)
    propBool!: boolean;
    @property.int(12)
    propInt!: number;
    @property.float(3.75)
    propFloat!: number;
    @property.string('hello')
    propString!: string;
    @property.enum(['serpent', 'snake'], 'snake')
    propEnum!: number;
    @property.enum(['serpent', 'snake'], 'monkey')
    propEnumDefaultMissing!: number;
    @property.enum(['serpent', 'snake'], 1)
    propEnumDefaultNumber!: number;
    @property.enum(['serpent', 'snake'], 2)
    propEnumDefaultNumberOutOfRange!: number;
    @property.enum(undefined as any, 'snake')
    propEnumNoValues!: number;
    @property.enum([], 'snake')
    propEnumEmptyValues!: number;
    @property.object()
    propObject!: Object3D;
    @property.mesh()
    propMesh!: Mesh;
    @property.texture()
    propTexture!: Texture | null;
    @property.material()
    propMaterial!: Material | null;
    @property.animation()
    propAnimation!: Animation | null;
    @property.skin()
    propSkin!: Skin | null;
    @property.color(1, 0, 0.5, 0.75)
    propColor!: number[];
}

describe('Properties', function () {
    describe('Component Instantiation', function () {
        it('defaults when constructor define properties (#1341)', function () {
            class TestComponent extends Component {
                static TypeName = 'test-component';
                static Properties = {
                    propStr: {type: Type.String, default: 'Hello'},
                };
                propStr!: string;
            }
            WL.registerComponent(TestComponent);
            const comp = WL.scene.addObject().addComponent(TestComponent);
            expect((comp as any).propStr).to.equal('Hello');
        });

        it('literal properties with defaults', function () {
            class LiteralWithDefaults extends TestComponentProperties {
                static TypeName = 'literal-with-defaults';
                static Properties = TestComponentProperties.createLiteralProperties(true);
            }
            WL.registerComponent(LiteralWithDefaults);

            const comp = WL.scene.addObject().addComponent(LiteralWithDefaults)!;
            TestComponentProperties.assertDefaults(comp);
        });

        it('literal properties no defaults', function () {
            class LiteralNoDefaults extends TestComponentProperties {
                static TypeName = 'literal-no-defaults';
                static Properties = TestComponentProperties.createLiteralProperties(false);
            }
            WL.registerComponent(LiteralNoDefaults);

            const comp = WL.scene.addObject().addComponent(LiteralNoDefaults)!;
            TestComponentProperties.assertNoDefaults(comp);
        });

        it('functor properties with defaults', function () {
            class FunctorWithDefaults extends TestComponentProperties {
                static TypeName = 'functor-with-defaults';
                static Properties = TestComponentProperties.createFunctorProperties(true);
            }
            WL.registerComponent(FunctorWithDefaults);

            const comp = WL.scene.addObject().addComponent(FunctorWithDefaults)!;
            TestComponentProperties.assertDefaults(comp);
        });

        it('functor properties no defaults', function () {
            class FunctorNoDefaults extends TestComponentProperties {
                static TypeName = 'functor-no-defaults';
                static Properties = TestComponentProperties.createFunctorProperties(false);
            }
            WL.registerComponent(FunctorNoDefaults);

            const comp = WL.scene.addObject().addComponent(FunctorNoDefaults)!;
            TestComponentProperties.assertNoDefaults(comp);
        });

        it('decorator properties with defaults', function () {
            WL.registerComponent(TestComponentPropertiesDecorator);
            const comp = WL.scene
                .addObject()
                .addComponent(TestComponentPropertiesDecorator)!;
            TestComponentProperties.assertDefaults(comp);
        });
    });
});
