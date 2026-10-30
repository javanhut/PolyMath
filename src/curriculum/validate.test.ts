import { expect, test } from "bun:test";
import type { Problem } from "./types";
import { latexToText, verifyProblem } from "./validate";

const base = { hint: "", solution: [{ math: "" }] };

test("hidden verify equations", () => {
  const ok: Problem = { ...base, prompt: "Find x.", answer: "130", verify: ["x = 56 + 74"] };
  expect(verifyProblem(ok)).toBe(true);
  expect(() => verifyProblem({ ...ok, answer: "120" })).toThrow("fails verify");
  const pair: Problem = { ...base, prompt: "Find the midpoint.", answer: "(2, 5)", form: "tuple", verify: ["x = (1 + 3)/2", "y = (4 + 6)/2"] };
  expect(() => verifyProblem(pair)).toThrow("unknowns");
  expect(verifyProblem({ ...pair, verify: ["x + y = 7", "y - x = 3"] })).toBe(true);
  expect(verifyProblem({ ...base, prompt: "Solve.", answer: "2i, -2i", form: "set", complex: true, verify: ["x^2 + 4 = 0"] })).toBe(true);
});

test("latexToText reads log bases", () => {
  expect(latexToText("\\log_{2} 32").replace(/\s+/g, "")).toBe("log_(2)32");
});
