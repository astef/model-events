import test from "ava";
import {
  defineField,
  defineModel,
  defineObject,
  Infer,
  ModelEvents,
} from "../lib";
import { createModelEventsAssertion } from "./common";

test("change event", (t) => {
  // arrange
  const modelType = defineModel(
    {
      s: defineObject(
        {
          f: defineObject({}, {}),
        },
        {
          x: defineField(3),
          y: defineField(0),
        }
      ),
    },
    {}
  );

  type ModelType = Infer<typeof modelType>;

  const model: ModelType = modelType.create();
  const assertModelEvents = createModelEventsAssertion(model, [
    { eventName: ModelEvents.Value, field: { name: "x", index: 0 }, value: 5 },
    {
      eventName: ModelEvents.Value,
      field: { name: "y", index: 1 },
      value: NaN,
    },
    { eventName: ModelEvents.Value, field: { name: "x", index: 0 }, value: 8 },
    { eventName: ModelEvents.Commit, rev: 1 },
  ]);

  // act
  model.s.x = 5;
  model.s.y = NaN;
  model.s.x = 8;

  model.commit();

  // assert
  assertModelEvents();
});
