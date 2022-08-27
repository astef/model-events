import EventEmitter from "events";

enum ModelEvents {
  Value = "value",
}

export type ModelValueEventHandler<T> = (
  field: FieldDescriptor,
  value: T
) => void;

type RelationshipDescriptor = {
  readonly parent?: RelationshipDescriptor;
  readonly name: string;
};

export function getFieldPath(field: FieldDescriptor) {
  const names = [field.name];
  let current = field.parent;
  while (current) {
    names.push(current.name);
    current = current.parent;
  }
  names.reverse();
  return names.join(".");
}

export type FieldDescriptor = RelationshipDescriptor & {
  readonly index: number;
  readonly configs: Record<string | symbol, unknown>;
};

export type FieldConfigure<T> = (
  field: FieldSchema<T> & { descriptor: FieldDescriptor }
) => void;

export type FieldSchema<T> = {
  readonly _initialValue: T;

  readonly _configurators: ((fieldSchema: FieldSchema<unknown>) => void)[];

  with(configure: FieldConfigure<T>): FieldSchema<T>;

  descriptor?: FieldDescriptor;
};

export type ObjectSchema<
  TS extends SubordinatesShape,
  TF extends FieldsShape
> = {
  _initialize: (
    fieldDispatcher: Dispatcher,
    parent?: RelationshipDescriptor
  ) => void;

  _createInstance: () => {
    readonly [k in keyof TS]: ReturnType<TS[k]["_createInstance"]>;
  } & {
    [k in keyof TF]: TF[k]["_initialValue"];
  };
};

type ModelEvent<N extends string, A extends (...args: any[]) => void> = {
  on(eventName: N, listener: A): void;
  once(eventName: N, listener: A): void;
  off(eventName: N, listener: A): void;
};

export type Model = ModelEvent<"value", ModelValueEventHandler<unknown>> & {
  /**
   * Generate ModelEvents.Value event for all fields.
   */
  snapshot(): void;

  /**
   * Sets the value to the field and raises ModelEvents.Value event normally.
   *
   * Dangerous operation. It may break your type system, since there're no run-time typechecks.
   * @param fieldIndex index of the field to be updated.
   * @param value the value to be set.
   */
  set(fieldIndex: number, value: unknown): void;
};

export type ModelSchema<
  TS extends SubordinatesShape,
  TF extends FieldsShape
> = {
  create(): ReturnType<ObjectSchema<TS, TF>["_createInstance"]> & Model;
};

export type FieldsShape = Record<string, FieldSchema<unknown>>;

export type SubordinatesShape = Record<string, ObjectSchema<any, any>>;

type Dispatcher = {
  _initFieldDescriptor(
    fieldSchema: FieldSchema<unknown>,
    name: string,
    parent?: RelationshipDescriptor
  ): void;
  _initFieldAccessor(getter: () => unknown, setter: (v: unknown) => void): void;
  _emitValue(field: FieldDescriptor, value: unknown): void;
};

export function defineField<T>(initialValue: T): FieldSchema<T> {
  const fieldSchema: Omit<FieldSchema<T>, "with"> = {
    _initialValue: initialValue,
    _configurators: [],
  };
  Object.defineProperty(fieldSchema, "with", {
    value: (configure: FieldConfigure<T>) => {
      fieldSchema._configurators.push((fieldSchema) => {
        configure(
          fieldSchema as FieldSchema<T> & { descriptor: FieldDescriptor }
        );
      });
      return fieldSchema;
    },
    writable: false,
  });
  return fieldSchema as FieldSchema<T>;
}

function visitFieldsShape(
  shape: FieldsShape,
  visit: (key: string, fieldsSchema: FieldSchema<unknown>) => void
) {
  for (const key of Object.keys(shape)) {
    const fieldsSchema = shape[key];
    visit(key, fieldsSchema);
  }
}

function visitShapes(
  firstShape: SubordinatesShape | FieldsShape,
  secondShape?: FieldsShape,
  visitObject?: (key: string, objectSchema: ObjectSchema<any, any>) => void,
  visitField?: (key: string, fieldsSchema: FieldSchema<unknown>) => void
) {
  for (const key of Object.keys(firstShape)) {
    const schema = firstShape[key];
    if ("_initialValue" in schema) {
      visitField?.(key, schema);
    } else {
      visitObject?.(key, schema);
    }
  }
  if (secondShape && visitField) {
    visitFieldsShape(secondShape, visitField);
  }
}

function defineObjectImpl<TS extends SubordinatesShape, TF extends FieldsShape>(
  firstShape: TS | TF,
  secondShape?: TF
): ObjectSchema<TS, TF> {
  let dispatcher: Dispatcher | null = null;
  const objectSchema: ObjectSchema<TS, TF> = {
    _initialize: (d, parent) => {
      if (dispatcher) {
        throw new Error(
          "Already initialized. Create a separate object for a different model."
        );
      }
      dispatcher = d;

      visitShapes(
        firstShape,
        secondShape,
        (key, objectSchema) => {
          objectSchema._initialize(dispatcher!, { name: key, parent });
        },
        (key, fieldSchema) => {
          dispatcher!._initFieldDescriptor(fieldSchema, key, parent);
        }
      );
    },
    _createInstance: () => {
      if (!dispatcher) {
        throw new Error("Not initialized. Not usable without a model.");
      }
      const res: Record<string, unknown> = {};

      visitShapes(
        firstShape,
        secondShape,
        (key, objectSchema) => {
          Object.defineProperty(res, key, {
            value: objectSchema._createInstance(),
            writable: false,
          });
        },
        (key, fieldSchema) => {
          let fieldValue = fieldSchema._initialValue;

          const fieldGetter = () => {
            return fieldValue;
          };

          const fieldSetter = (v: unknown) => {
            fieldValue = v;
            dispatcher!._emitValue(fieldSchema.descriptor!, v);
          };

          // intersect field updates
          Object.defineProperty(res, key, {
            get: fieldGetter,
            set: fieldSetter,
            enumerable: true,
          });

          // expose field access
          dispatcher!._initFieldAccessor(fieldGetter, fieldSetter);
        }
      );

      return res as ReturnType<ObjectSchema<TS, TF>["_createInstance"]>;
    },
  };

  return objectSchema;
}

export function defineObject<TS extends SubordinatesShape>(
  subordinatesShape: TS
): ObjectSchema<TS, {}>;
export function defineObject<TF extends FieldsShape>(
  fieldsShape: TF
): ObjectSchema<{}, TF>;
export function defineObject<
  TS extends SubordinatesShape,
  TF extends FieldsShape
>(subordinatesShape: TS, fieldsShape: TF): ObjectSchema<TS, TF>;
export function defineObject<
  TS extends SubordinatesShape,
  TF extends FieldsShape
>(firstShape: TS | TF, secondShape?: TF): ObjectSchema<TS, TF> {
  return defineObjectImpl<TS, TF>(firstShape, secondShape);
}

export function defineModel<TS extends SubordinatesShape>(
  subordinatesShape: TS
): ModelSchema<TS, {}>;
export function defineModel<TF extends FieldsShape>(
  fieldsShape: TF
): ModelSchema<{}, TF>;
export function defineModel<
  TS extends SubordinatesShape,
  TF extends FieldsShape
>(subordinatesShape: TS, fieldsShape: TF): ModelSchema<TS, TF>;
export function defineModel<
  TS extends SubordinatesShape,
  TF extends FieldsShape
>(firstShape: TS | TF, secondShape?: TF): ModelSchema<TS, TF> {
  const checkConflictingKeys = (key: string) => {
    if (["on", "once", "off", "snapshot", "set"].indexOf(key) >= 0) {
      throw new Error(
        `Top-level shape property name conflicts with Model API: '${key}'`
      );
    }
  };

  visitShapes(
    firstShape,
    secondShape,
    checkConflictingKeys,
    checkConflictingKeys
  );

  const rootObjectSchema: ObjectSchema<any, any> = defineObjectImpl(
    firstShape,
    secondShape
  );

  const fieldSetters: ((v: unknown) => void)[] = [];
  const fieldGetters: (() => unknown)[] = [];
  const fieldDescriptors: FieldDescriptor[] = [];

  const eventEmitter = new EventEmitter();

  const fieldDispatcher: Dispatcher = {
    _emitValue: (field: FieldDescriptor, value: unknown) => {
      eventEmitter.emit(ModelEvents.Value, field, value);
    },
    _initFieldAccessor: (getter, setter) => {
      fieldSetters.push(setter);
      fieldGetters.push(getter);
    },
    _initFieldDescriptor: (
      field: FieldSchema<unknown>,
      name: string,
      parent?: RelationshipDescriptor
    ) => {
      const newFieldDescriptor: FieldDescriptor = {
        name: name,
        parent: parent,
        index: fieldDescriptors.length,
        configs: {},
      };
      fieldDescriptors.push(newFieldDescriptor);

      field.descriptor = newFieldDescriptor;

      for (const configure of field._configurators) {
        configure(field);
      }
    },
  };

  const modelSchema = {
    create: () => {
      const obj = rootObjectSchema._createInstance();

      Object.defineProperty(obj, "on", {
        value: eventEmitter.on.bind(eventEmitter),
        writable: false,
      });

      Object.defineProperty(obj, "once", {
        value: eventEmitter.once.bind(eventEmitter),
        writable: false,
      });

      Object.defineProperty(obj, "off", {
        value: eventEmitter.off.bind(eventEmitter),
        writable: false,
      });

      Object.defineProperty(obj, "snapshot", {
        value: (() => {
          for (let i = 0; i < fieldGetters.length; i++) {
            eventEmitter.emit(
              ModelEvents.Value,
              fieldDescriptors[i],
              fieldGetters[i]()
            );
          }
        }).bind(obj),
        writable: false,
      });

      Object.defineProperty(obj, "set", {
        value: ((fieldIndex: number, value: unknown) => {
          fieldSetters[fieldIndex](value);
        }).bind(obj),
        writable: false,
      });

      return obj;
    },
  } as unknown as ModelSchema<TS, TF>;

  rootObjectSchema._initialize(fieldDispatcher);

  return modelSchema;
}

export type Infer<T extends ModelSchema<any, any>> = ReturnType<T["create"]>;
