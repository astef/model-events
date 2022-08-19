import test from "ava";
import {
  defineField,
  defineModel,
  defineObject,
  Infer,
  ModelEvents,
} from "../lib";
import {
  createModelEventsAssertion,
  commitEventAssertion,
  valueEventAssertion,
} from "./common";

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
  let rev = 0;
  const assertModelEvents = createModelEventsAssertion(model, [
    valueEventAssertion(ModelEvents.Value, "name", "Round 1"),
    valueEventAssertion(ModelEvents.Value, "player1.name", "Alice"),
    valueEventAssertion(ModelEvents.Value, "player2.name", "Bob"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 0),
    valueEventAssertion(ModelEvents.Value, "player2.score", 0),
    valueEventAssertion(ModelEvents.Value, "winnerName", null),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 1),
    valueEventAssertion(ModelEvents.Value, "player2.score", 1),
    valueEventAssertion(ModelEvents.Value, "winnerName", null),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 1),
    valueEventAssertion(ModelEvents.Value, "player2.score", 2),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Bob"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 2),
    valueEventAssertion(ModelEvents.Value, "player2.score", 4),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Bob"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 5),
    valueEventAssertion(ModelEvents.Value, "player2.score", 4),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Alice"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 8),
    valueEventAssertion(ModelEvents.Value, "player2.score", 7),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Alice"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 13),
    valueEventAssertion(ModelEvents.Value, "player2.score", 10),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Alice"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 14),
    valueEventAssertion(ModelEvents.Value, "player2.score", 14),
    valueEventAssertion(ModelEvents.Value, "winnerName", null),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 20),
    valueEventAssertion(ModelEvents.Value, "player2.score", 14),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Alice"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.Value, "player1.score", 23),
    valueEventAssertion(ModelEvents.Value, "player2.score", 17),
    valueEventAssertion(ModelEvents.Value, "winnerName", "Alice"),
    commitEventAssertion(ModelEvents.Commit, ++rev),
    valueEventAssertion(ModelEvents.SnapshotValue, "player1.name", "Alice"),
    valueEventAssertion(ModelEvents.SnapshotValue, "player1.score", 23),
    valueEventAssertion(ModelEvents.SnapshotValue, "player2.name", "Bob"),
    valueEventAssertion(ModelEvents.SnapshotValue, "player2.score", 17),
    valueEventAssertion(ModelEvents.SnapshotValue, "name", "Round 1"),
    valueEventAssertion(ModelEvents.SnapshotValue, "winnerName", "Alice"),
    commitEventAssertion(ModelEvents.SnapshotCommit, ++rev),
  ]);

  // act
  // preload some values
  model.set(4, "Round 1");
  model.set(0, "Alice");
  model.set(2, "Bob");
  model.commit();

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

    model.commit();
  }

  // generate snapshot of all fields
  model.snapshot();

  // assert
  assertModelEvents();
});
