import { deepStrictEqual } from "assert";
import test from "ava";
import {
  defineField,
  defineModel,
  defineObject,
  FieldConfigure,
  Infer,
  Model,
  ModelValueEventHandler,
} from "../lib";
import { createModelEventsAssertion, valueEventAssertion } from "./common";

test("basic example", () => {
  // arrange
  // create model
  const unknownStr = "Unknown";
  const modelSchema = defineModel(
    {
      player1: defineObject({
        name: defineField(unknownStr),
        score: defineField<number>(0),
      }),
      player2: defineObject({
        name: defineField(unknownStr),
        score: defineField(0),
      }),
    },
    {
      name: defineField(unknownStr),
      winnerName: defineField<null | string>(null),
    }
  );

  type ModelType = Infer<typeof modelSchema>;

  const model: ModelType = modelSchema.create();

  // mock events
  const assertModelEvents = createModelEventsAssertion(model, [
    valueEventAssertion("name", "Round 1"),
    valueEventAssertion("player1.name", "Alice"),
    valueEventAssertion("player2.name", "Bob"),
    valueEventAssertion("player1.score", 0),
    valueEventAssertion("player2.score", 0),
    valueEventAssertion("winnerName", null),
    valueEventAssertion("player1.score", 1),
    valueEventAssertion("player2.score", 1),
    valueEventAssertion("winnerName", null),
    valueEventAssertion("player1.score", 1),
    valueEventAssertion("player2.score", 2),
    valueEventAssertion("winnerName", "Bob"),
    valueEventAssertion("player1.score", 2),
    valueEventAssertion("player2.score", 4),
    valueEventAssertion("winnerName", "Bob"),
    valueEventAssertion("player1.score", 5),
    valueEventAssertion("player2.score", 4),
    valueEventAssertion("winnerName", "Alice"),
    valueEventAssertion("player1.score", 8),
    valueEventAssertion("player2.score", 7),
    valueEventAssertion("winnerName", "Alice"),
    valueEventAssertion("player1.score", 13),
    valueEventAssertion("player2.score", 10),
    valueEventAssertion("winnerName", "Alice"),
    valueEventAssertion("player1.score", 14),
    valueEventAssertion("player2.score", 14),
    valueEventAssertion("winnerName", null),
    valueEventAssertion("player1.score", 20),
    valueEventAssertion("player2.score", 14),
    valueEventAssertion("winnerName", "Alice"),
    valueEventAssertion("player1.score", 23),
    valueEventAssertion("player2.score", 17),
    valueEventAssertion("winnerName", "Alice"),
    valueEventAssertion("player1.name", "Alice"),
    valueEventAssertion("player1.score", 23),
    valueEventAssertion("player2.name", "Bob"),
    valueEventAssertion("player2.score", 17),
    valueEventAssertion("name", "Round 1"),
    valueEventAssertion("winnerName", "Alice"),
  ]);

  // act
  // preload some values
  model.set(4, "Round 1");
  model.set(0, "Alice");
  model.set(2, "Bob");

  // do updates
  for (let i = 1; i <= 10; i++) {
    model.player1.score += 33 % i;
    model.player2.score += model.player1.score % 5;

    if (model.player1.score == model.player2.score) {
      model.winnerName = null;
    } else if (model.player1.score > model.player2.score) {
      model.winnerName = model.player1.name;
    } else {
      model.winnerName = model.player2.name;
    }
  }

  // generate snapshot of all fields
  model.snapshot();

  // assert
  assertModelEvents();
});

test("field configuration", () => {
  // arrange
  const testArray: [number, string][] = [];

  const TestArrayWriterConfigName = Symbol("TestArrayWriter");

  const onModelValue: ModelValueEventHandler<unknown> = (field, value) => {
    const writer = field.configs[TestArrayWriterConfigName];
    if (typeof writer == "function") {
      writer(field.index, value);
    }
  };

  const TestArrayDump: FieldConfigure<number | string | undefined | null> = (
    f
  ) => {
    f.descriptor.configs[TestArrayWriterConfigName] = (
      index: number,
      value: Date | string | undefined | null
    ) => {
      testArray.push([index, String(value)]);
    };
  };

  const modelSchema = defineModel(
    {
      user: defineObject({
        name: defineField<string>("Alice").with(TestArrayDump),
        email: defineField<string | undefined>(undefined).with(TestArrayDump),
        hiddenName: defineField<string | undefined>(undefined),
      }),
    },
    {
      createdAt: defineField<number | undefined>(undefined).with(TestArrayDump),
    }
  );

  // act
  const model = modelSchema.create();
  model.on("value", onModelValue);

  model.user.email = "alice@example.com";
  model.user.hiddenName = "Hidden";
  model.createdAt = Date.UTC(1999, 12, 31);

  model.off("value", onModelValue);
  model.user.name = "Wrong";

  // assert
  deepStrictEqual(testArray, [
    [1, "alice@example.com"],
    [3, "949276800000"],
  ]);
});
