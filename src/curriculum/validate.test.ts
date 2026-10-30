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

const prob = (prompt: string, answer: string, extra: Partial<Problem> = {}): Problem => ({ prompt, answer, hint: "", solution: [], ...extra });

test("derivative, integral and limit prompts are checked numerically", () => {
  expect(verifyProblem(prob("Differentiate $x^3 - 2x$.", "3x^2 - 2"))).toBe(true);
  expect(() => verifyProblem(prob("Differentiate $x^3 - 2x$.", "3x^2"))).toThrow();
  expect(verifyProblem(prob("Find $f'(x)$ when $f(x) = \\sin(2x)$.", "2cos(2x)"))).toBe(true);
  expect(verifyProblem(prob("Find $\\frac{\\partial f}{\\partial y}$ when $f(x, y) = x^2 y + \\sin y$.", "x^2 + cos(y)"))).toBe(true);
  expect(verifyProblem(prob("Evaluate $\\int_{0}^{2} x^2 \\, dx$.", "8/3"))).toBe(true);
  expect(verifyProblem(prob("Evaluate $\\int_0^\\pi \\sin x \\, dx$.", "2"))).toBe(true);
  expect(() => verifyProblem(prob("Evaluate $\\int_0^1 x^2 \\, dx$.", "1/2"))).toThrow();
  expect(verifyProblem(prob("Find $\\int 2x \\cos(x^2) \\, dx$.", "sin(x^2) + C", { upToConstant: true }))).toBe(true);
  expect(verifyProblem(prob("Find $\\lim_{x \\to 2} \\frac{x^2 - 4}{x - 2}$.", "4"))).toBe(true);
  expect(verifyProblem(prob("Find $\\lim_{x \\to \\infty} \\frac{3x^2 + 1}{x^2 - 5}$.", "3"))).toBe(true);
  expect(() => verifyProblem(prob("Find $\\lim_{x \\to 0} \\frac{\\sin x}{x}$.", "0"))).toThrow();
});

test("verify equations with free variables hold as identities", () => {
  expect(verifyProblem(prob("Find the inverse.", "(x - 3)/2", { verify: ["2y + 3 = x"] }))).toBe(true);
  expect(verifyProblem(prob("Divide.", "(x + 5, 11)", { form: "tuple", verify: ["x^2 + 3x + 1 = (x - 2)*q + r"] }))).toBe(true);
  expect(() => verifyProblem(prob("Divide.", "(x + 5, 10)", { form: "tuple", verify: ["x^2 + 3x + 1 = (x - 2)*q + r"] }))).toThrow();
});
