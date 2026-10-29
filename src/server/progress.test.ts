import { expect, test } from "bun:test";
import { MASTERY_STREAK } from "../shared";
import { openProgress } from "./progress";

test("tracks attempts, streaks and mastery", () => {
  const store = openProgress(":memory:");
  const key = "algebra-1/two-step-equations";

  let p = store.record(key, true, 1);
  expect(p).toEqual({ attempts: 1, correct: 1, streak: 1, masteredAt: null });

  p = store.record(key, false, 2);
  expect(p.streak).toBe(0);

  for (let i = 0; i < MASTERY_STREAK; i++) p = store.record(key, true, 100 + i);
  expect(p.streak).toBe(MASTERY_STREAK);
  expect(p.masteredAt).toBe(100 + MASTERY_STREAK - 1);

  // Mastery is kept after a later miss, and the timestamp isn't overwritten.
  p = store.record(key, false, 500);
  p = store.record(key, true, 600);
  expect(p.masteredAt).toBe(100 + MASTERY_STREAK - 1);
  expect(store.all()[key]!.attempts).toBe(2 + MASTERY_STREAK + 2);

  store.reset(key);
  expect(store.all()).toEqual({});
  store.close();
});
