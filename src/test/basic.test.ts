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
  MatchCommitEvent,
  MatchValueEvent,
} from "./common";

test("change event", (t) => {
  // arrange
  const modelSchema = defineModel(
    {
      player1: defineObject({
        score: defineField(0),
      }),
      player2: defineObject({
        score: defineField(0),
      }),
    },
    {
      name: defineField("Round 1"),
    }
  );

  type ModelType = Infer<typeof modelSchema>;

  const model: ModelType = modelSchema.create();
  const assertModelEvents = createModelEventsAssertion(model, [
    MatchValueEvent(ModelEvents.Value, "player1.score", 0),
    MatchValueEvent(ModelEvents.Value, "player2.score", 0),
    MatchCommitEvent(ModelEvents.Commit, 1),
    MatchValueEvent(ModelEvents.Value, "player1.score", 1),
    MatchValueEvent(ModelEvents.Value, "player2.score", 1),
    MatchCommitEvent(ModelEvents.Commit, 2),
    MatchValueEvent(ModelEvents.Value, "player1.score", 1),
    MatchValueEvent(ModelEvents.Value, "player2.score", 2),
    MatchCommitEvent(ModelEvents.Commit, 3),
    MatchValueEvent(ModelEvents.Value, "player1.score", 2),
    MatchValueEvent(ModelEvents.Value, "player2.score", 4),
    MatchCommitEvent(ModelEvents.Commit, 4),
    MatchValueEvent(ModelEvents.Value, "player1.score", 5),
    MatchValueEvent(ModelEvents.Value, "player2.score", 4),
    MatchCommitEvent(ModelEvents.Commit, 5),
    MatchValueEvent(ModelEvents.Value, "player1.score", 8),
    MatchValueEvent(ModelEvents.Value, "player2.score", 7),
    MatchCommitEvent(ModelEvents.Commit, 6),
    MatchValueEvent(ModelEvents.Value, "player1.score", 13),
    MatchValueEvent(ModelEvents.Value, "player2.score", 10),
    MatchCommitEvent(ModelEvents.Commit, 7),
    MatchValueEvent(ModelEvents.Value, "player1.score", 14),
    MatchValueEvent(ModelEvents.Value, "player2.score", 14),
    MatchCommitEvent(ModelEvents.Commit, 8),
    MatchValueEvent(ModelEvents.Value, "player1.score", 20),
    MatchValueEvent(ModelEvents.Value, "player2.score", 14),
    MatchCommitEvent(ModelEvents.Commit, 9),
    MatchValueEvent(ModelEvents.Value, "player1.score", 23),
    MatchValueEvent(ModelEvents.Value, "player2.score", 17),
    MatchCommitEvent(ModelEvents.Commit, 10),
  ]);

  // act
  for (let i = 1; i <= 10; i++) {
    model.player1.score += 33 % i;
    model.player2.score += model.player1.score % 5;
    model.commit();
  }

  // assert
  assertModelEvents();
});
