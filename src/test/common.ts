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

export type EventMatcher = EventArgs | ((actual: EventArgs) => void);

const UnexpectedEventStr = "Unexpected event.";

function failEventName(actual: string, expected: string): never {
  assert.fail(
    `${UnexpectedEventStr}. Expected: ${expected}. Actual: ${actual}.`
  );
}

export function valueEventAssertion(
  eventName: ModelEvents.Value | ModelEvents.SnapshotValue,
  fieldPath: string,
  value: unknown
): EventMatcher {
  return (actual: EventArgs) => {
    if (actual.eventName !== eventName) {
      failEventName(actual.eventName, eventName);
    }
    assert.deepStrictEqual(
      {
        eventName: actual.eventName,
        value: actual.value,
        fieldPath: getFieldPath(actual.field),
      },
      { eventName, value, fieldPath },
      UnexpectedEventStr
    );
  };
}

export function commitEventAssertion(
  eventName: ModelEvents.Commit | ModelEvents.SnapshotCommit,
  rev: number
) {
  return (actual: EventArgs) => {
    if (actual.eventName !== eventName) {
      failEventName(actual.eventName, eventName);
    }

    assert.strictEqual(actual.rev, rev, UnexpectedEventStr);
  };
}

function eventToString(event: EventArgs) {
  return JSON.stringify(event);
}

function assertEventsEqual(actual: EventArgs, eventOrAssert: EventMatcher) {
  if (typeof eventOrAssert == "function") {
    eventOrAssert(actual);
  } else {
    assert.deepStrictEqual(actual, eventOrAssert, UnexpectedEventStr);
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
