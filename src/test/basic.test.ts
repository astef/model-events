import test from "ava";
import { defineField, defineModel, defineObject, Infer } from "../lib";
import { createModelEventsAssertion, valueEventAssertion } from "./common";

test("change event", (t) => {
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
