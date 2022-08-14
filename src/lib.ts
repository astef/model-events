import EventEmitter from "events";

export enum ModelEvents {
  Value = "value",
  Commit = "commit",
  SnapshotValue = "snapshotValue",
  SnapshotCommit = "snapshotCommit",
}

enum InternalModelEvents {
  SnapshotRequest = "snapshotRequest",
}

type RelationshipDescriptor = {
  parent?: RelationshipDescriptor;
  name: string;
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
  index: number;
};

export type FieldSchema<T> = {
  _initialValue: T;

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

export type Model = ModelEvent<
  ModelEvents.Value,
  (field: FieldDescriptor, value: unknown) => void
> &
  ModelEvent<ModelEvents.Commit, (rev: number) => void> &
  ModelEvent<
    ModelEvents.SnapshotValue,
    (field: FieldDescriptor, value: unknown) => void
  > &
  ModelEvent<ModelEvents.SnapshotCommit, (rev: number) => void> & {
    commit(): void;
    /**
     * send all current field values + commit()
     */
    snapshot(): void;
  };

export type ModelSchema<
  TS extends SubordinatesShape,
  TF extends FieldsShape
> = {
  create(): ReturnType<ObjectSchema<TS, TF>["_createInstance"]> & Model;
};

export type FieldsShape = Record<string, FieldSchema<unknown>>;

export type SubordinatesShape = Record<string, ObjectSchema<any, any>>;

type Dispatcher = ModelEvent<
  InternalModelEvents.SnapshotRequest,
  () => void
> & {
  _createFieldDescriptor(
    name: string,
    parent?: RelationshipDescriptor
  ): FieldDescriptor;
  _emitValue(field: FieldDescriptor, value: unknown): void;
  _emitSnapshotValue(field: FieldDescriptor, value: unknown): void;
};

export function defineField<T>(initialValue: T): FieldSchema<T> {
  return { _initialValue: initialValue };
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
          fieldSchema.descriptor = dispatcher!._createFieldDescriptor(
            key,
            parent
          );
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
          // intersect field updates
          let fieldValue = fieldSchema._initialValue;
          Object.defineProperty(res, key, {
            get: () => {
              return fieldValue;
            },
            set: (v) => {
              fieldValue = v;
              dispatcher!._emitValue(fieldSchema.descriptor!, v);
            },
            enumerable: true,
          });

          // react to snapshot requests
          dispatcher!.on(InternalModelEvents.SnapshotRequest, () => {
            dispatcher!._emitSnapshotValue(fieldSchema.descriptor!, fieldValue);
          });
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
    if (["on", "once", "off", "snapshot", "commit"].indexOf(key) >= 0) {
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

  let lastFieldIndex = -1;

  const eventEmitter = new EventEmitter();

  const internalEventEmitter = new EventEmitter();

  const fieldDispatcher: Dispatcher = {
    _emitValue: (field: FieldDescriptor, value: unknown) => {
      eventEmitter.emit(ModelEvents.Value, field, value);
    },
    _emitSnapshotValue: (field: FieldDescriptor, value: unknown) => {
      eventEmitter.emit(ModelEvents.SnapshotValue, field, value);
    },
    on: internalEventEmitter.on.bind(internalEventEmitter),
    once: internalEventEmitter.once.bind(internalEventEmitter),
    off: internalEventEmitter.off.bind(internalEventEmitter),

    _createFieldDescriptor: (name: string, parent?: RelationshipDescriptor) => {
      return {
        name: name,
        parent: parent,
        index: ++lastFieldIndex,
      };
    },
  };

  const modelSchema = {
    create: () => {
      const obj = rootObjectSchema._createInstance();

      let revision = 1;

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
          internalEventEmitter.emit(
            InternalModelEvents.SnapshotRequest,
            revision
          );
          eventEmitter.emit(ModelEvents.SnapshotCommit, revision);
        }).bind(obj),
        writable: false,
      });

      Object.defineProperty(obj, "commit", {
        value: (() => {
          eventEmitter.emit(ModelEvents.Commit, revision++);
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
