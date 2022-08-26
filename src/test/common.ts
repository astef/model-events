import assert from "assert";
import { FieldDescriptor, getFieldPath, Model } from "../lib";

export type EventArgs = {
  field: FieldDescriptor;
  value: unknown;
};

export type EventMatcher = EventArgs | ((actual: EventArgs) => void);

const UnexpectedEventStr = "Unexpected event.";

export function valueEventAssertion(
  fieldPath: string,
  value: unknown
): EventMatcher {
  return (actual: EventArgs) => {
    assert.deepStrictEqual(
      {
        value: actual.value,
        fieldPath: getFieldPath(actual.field),
      },
      { value, fieldPath },
      UnexpectedEventStr
    );
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

  model.on("value", (field, value) => onEvent({ field, value }));

  return () => {
    assert.strictEqual(
      eventIndex,
      expectedEvents.length,
      "Events were missed."
    );
  };
}
