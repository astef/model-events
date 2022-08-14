import assert from "assert";
import { FieldDescriptor, Model, ModelEvents } from "../lib";

type ValueEventArgs = {
  eventName: string;
  field: FieldDescriptor;
  value: unknown;
};

type CommitEventArgs = {
  eventName: string;
  rev: number;
};

export type EventArgs =
  | (ValueEventArgs & {
      eventName: ModelEvents.Value;
    })
  | (CommitEventArgs & {
      eventName: ModelEvents.Commit;
    })
  | (ValueEventArgs & {
      eventName: ModelEvents.SnapshotValue;
    })
  | (CommitEventArgs & {
      eventName: ModelEvents.SnapshotCommit;
    });

function eventToString(event: EventArgs) {
  return JSON.stringify(event);
}

function assertEventsEqual(actual: EventArgs, expected: EventArgs) {
  assert.deepStrictEqual(actual, expected, "Unexpected event.");
}

function assertEvent(
  actual: EventArgs,
  eventIndex: number,
  expectedEvents: EventArgs[]
) {
  if (eventIndex == expectedEvents.length) {
    assert.fail(`No more events expected. Received: ${eventToString(actual)}.`);
  }
  const expected = expectedEvents[eventIndex];
  assertEventsEqual(actual, expected);
}

export function createModelEventsAssertion(
  model: Model,
  expectedEvents: EventArgs[]
) {
  let eventIndex = 0;

  const onEvent = (actual: EventArgs) => {
    assertEvent(actual, eventIndex, expectedEvents);
    eventIndex++;
  };

  model.on(ModelEvents.Value, (field, value) =>
    onEvent({ eventName: ModelEvents.Value, field, value })
  );
  model.on(ModelEvents.Commit, (rev) =>
    onEvent({ eventName: ModelEvents.Commit, rev })
  );
  model.on(ModelEvents.SnapshotValue, (field, value) =>
    onEvent({ eventName: ModelEvents.SnapshotValue, field, value })
  );
  model.on(ModelEvents.SnapshotCommit, (rev) =>
    onEvent({ eventName: ModelEvents.SnapshotCommit, rev })
  );

  return () => {
    assert.strictEqual(
      eventIndex,
      expectedEvents.length,
      "Events were missed."
    );
  };
}
