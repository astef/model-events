import assert from "assert";
import { FieldDescriptor, getFieldPath, Model, ModelEvents } from "../lib";

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

export type EventMatcher = EventArgs | ((other: EventArgs) => boolean);

export function MatchValueEvent(
  eventName: ModelEvents.Value | ModelEvents.SnapshotValue,
  fieldPath: string,
  value: unknown
) {
  return (other: EventArgs) => {
    return (
      other.eventName === eventName &&
      other.value === value &&
      getFieldPath(other.field) === fieldPath
    );
  };
}

export function MatchCommitEvent(
  eventName: ModelEvents.Commit | ModelEvents.SnapshotCommit,
  rev: number
) {
  return (other: EventArgs) => {
    return other.eventName === eventName && other.rev === rev;
  };
}

function eventToString(event: EventArgs) {
  return JSON.stringify(event);
}

function assertEventsEqual(actual: EventArgs, expected: EventMatcher) {
  const message = "Unexpected event.";
  if (typeof expected == "function") {
    assert.ok(expected(actual), message);
  } else {
    assert.deepStrictEqual(actual, expected, message);
  }
}

function assertEvent(
  actual: EventArgs,
  eventIndex: number,
  expectedEvents: EventMatcher[]
) {
  if (eventIndex == expectedEvents.length) {
    assert.fail(`No more events expected. Received: ${eventToString(actual)}.`);
  }
  const expected = expectedEvents[eventIndex];
  assertEventsEqual(actual, expected);
}

export function createModelEventsAssertion(
  model: Model,
  expectedEvents: EventMatcher[]
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
