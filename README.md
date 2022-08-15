# model-events

<span><a href="https://npmjs.org/package/model-events" title="View this project on NPM"><img src="https://img.shields.io/npm/v/model-events.svg" alt="NPM version" /></a></span>

TypeScript-first zero-dependency package to generate events from your model field changes.

## Installation

`npm install model-events`

## Example

```typescript
import {
  defineModel,
  defineObject,
  defineField,
  ModelEvents,
  Infer,
} from "model-events";

// define your schema just as you define types
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

// and infer your actual type later
type TwoPlayerGameModel = Infer<typeof modelSchema>;

// create an instance with default field values
const model: TwoPlayerGameModel = modelSchema.create();

// subscribe to field updates
model.on(ModelEvents.Value, (field, value) => {
  // field index is unique within the entire model
  console.log(`[${field.index}]=${value}`);
});

// commit indicates the end of update cycle
model.on(ModelEvents.Commit, (rev) => {
  console.log(`commit#${rev}`);
});

// and finally do your computations!
function play(model: TwoPlayerGameModel) {
  for (let i = 1; i <= 10; i++) {
    model.player1.score += 33 % i;
    model.player2.score += model.player1.score % 5;
    model.commit();
  }
}

play(model);
```
