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

export type FieldDescriptor = {
  index: number;
  name: string;
};

export type FieldSchema<T> = {
  _initialValue: T;

  descriptor?: FieldDescriptor;
};

export type ObjectSchema<T extends Shape> = {
  _initialize: (fieldDispatcher: FieldDispatcher) => void;

  _createInstance: () => {
    [k in keyof T]: T[k] extends ObjectSchema<any>
      ? ReturnType<T[k]["_createInstance"]>
      : T[k] extends FieldSchema<any>
      ? T[k]["_initialValue"]
      : T[k];
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

export type ModelSchema<T extends Shape> = {
  create(): ReturnType<ObjectSchema<T>["_createInstance"]> & Model;
};

export type Shape = Record<string, FieldSchema<unknown> | ObjectSchema<any>>;

type FieldDispatcher = ModelEvent<
  InternalModelEvents.SnapshotRequest,
  () => void
> & {
  _createFieldDescriptor(name: string): FieldDescriptor;
  _emitValue(field: FieldDescriptor, value: unknown): void;
  _emitSnapshotValue(field: FieldDescriptor, value: unknown): void;
};

export function defineField<T>(initialValue: T): FieldSchema<T> {
  return { _initialValue: initialValue };
}

function visitShape(
  shape: Shape,
  visitKey?: (key: string) => void,
  visitField?: (key: string, fieldSchema: FieldSchema<unknown>) => void,
  visitObject?: (key: string, fieldSchema: ObjectSchema<any>) => void
) {
  for (const key of Object.keys(shape)) {
    visitKey?.(key);
    const fieldOrChild = shape[key];
    if ("_initialValue" in fieldOrChild) {
      visitField?.(key, fieldOrChild);
    } else {
      visitObject?.(key, fieldOrChild);
    }
  }
}

export function defineObject<T extends Shape>(shape: T): ObjectSchema<T> {
  let dispatcher: FieldDispatcher | null = null;
  const objectSchema: ObjectSchema<T> = {
    _initialize: (d) => {
      if (dispatcher) {
        throw new Error(
          "Already initialized. Create a separate object for a different model."
        );
      }
      dispatcher = d;

      visitShape(
        shape,
        undefined,
        (key, fieldSchema) => {
          fieldSchema.descriptor = dispatcher!._createFieldDescriptor(key);
        },
        (_key, objectSchema) => {
          objectSchema._initialize(dispatcher!);
        }
      );
    },
    _createInstance: () => {
      if (!dispatcher) {
        throw new Error("Not initialized. Not usable without a model.");
      }
      const res: Record<string, unknown> = {};
      visitShape(
        shape,
        undefined,
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
        },
        (key, objectSchema) => {
          res[key] = objectSchema._createInstance();
        }
      );

      return res as ReturnType<ObjectSchema<T>["_createInstance"]>;
    },
  };

  return objectSchema;
}

export function defineModel<T extends Shape>(shape: T): ModelSchema<T> {
  visitShape(shape, (key) => {
    if (["on", "once", "off", "snapshot", "commit"].indexOf(key) >= 0) {
      throw new Error(
        `Top-level shape property name conflicts with Model API: '${key}'`
      );
    }
  });
  const rootObjectSchema = defineObject<T>(shape);

  let lastFieldIndex = -1;

  const eventEmitter = new EventEmitter();

  const internalEventEmitter = new EventEmitter();

  const fieldDispatcher: FieldDispatcher = {
    _emitValue: (field: FieldDescriptor, value: unknown) => {
      eventEmitter.emit(ModelEvents.Value, field, value);
    },
    _emitSnapshotValue: (field: FieldDescriptor, value: unknown) => {
      eventEmitter.emit(ModelEvents.SnapshotValue, field, value);
    },
    on: internalEventEmitter.on.bind(internalEventEmitter),
    once: internalEventEmitter.once.bind(internalEventEmitter),
    off: internalEventEmitter.off.bind(internalEventEmitter),

    _createFieldDescriptor: (name: string) => {
      return {
        name: name,
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
  } as unknown as ModelSchema<T>;

  rootObjectSchema._initialize(fieldDispatcher);

  return modelSchema;
}

export type Infer<T extends ModelSchema<any>> = ReturnType<T["create"]>;
