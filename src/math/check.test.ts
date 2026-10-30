import { describe, expect, test } from "bun:test";
import { checkAnswer } from "./check";

const status = (input: string, spec: Parameters<typeof checkAnswer>[1]) => checkAnswer(input, spec).status;

describe("checkAnswer", () => {
  test("accepts any equivalent form", () => {
    expect(status("2x+2", { answer: "2(x+1)" })).toBe("correct");
    expect(status("x + x + 2", { answer: "2(x+1)" })).toBe("correct");
    expect(status("0.75", { answer: "3/4" })).toBe("correct");
    expect(status("(12 - 3x)/2", { answer: "6 - 1.5x" })).toBe("correct");
    expect(status("C/(2π)", { answer: "C/(2pi)" })).toBe("correct");
  });

  test("rejects wrong answers", () => {
    expect(status("2x+1", { answer: "2(x+1)" })).toBe("incorrect");
    expect(status("2y+2", { answer: "2x+2" })).toBe("incorrect");
    expect(status("-4", { answer: "4" })).toBe("incorrect");
  });

  test("treats a rounded decimal as not exact", () => {
    const v = checkAnswer("0.333", { answer: "1/3" });
    expect(v.status).toBe("incorrect");
    expect(v.status === "incorrect" && v.message).toContain("exact");
  });

  test("reads x = value as the value", () => {
    expect(status("x = 4", { answer: "4" })).toBe("correct");
    expect(status("4 = x", { answer: "4" })).toBe("correct");
    expect(status("x + 1 = 5", { answer: "4" })).toBe("invalid");
  });

  test("simplified answers", () => {
    expect(status("3x + 2x + 7", { answer: "5x + 7", simplified: true })).toBe("unsimplified");
    expect(status("7 + 5x", { answer: "5x + 7", simplified: true })).toBe("correct");
    expect(status("6/8", { answer: "3/4", simplified: true })).toBe("unsimplified");
    expect(status("-7/3", { answer: "-7/3", simplified: true })).toBe("correct");
  });

  test("expanded answers", () => {
    expect(status("-(3x - 5)", { answer: "-3x + 5", expanded: true })).toBe("unsimplified");
    expect(status("5 - 3x", { answer: "-3x + 5", expanded: true })).toBe("correct");
    expect(status("4(3x+2)", { answer: "12x + 8", expanded: true })).toBe("unsimplified");
  });

  test("text answers", () => {
    expect(status("No solution", { accept: ["no solution"] })).toBe("correct");
    expect(status("all real numbers", { accept: ["no solution"] })).toBe("incorrect");
    expect(status("3", { accept: ["no solution"] })).toBe("incorrect");
    expect(status("no solution", { answer: "3" })).toBe("incorrect");
  });

  test("unreadable input is not marked wrong", () => {
    expect(status("", { answer: "3" })).toBe("invalid");
    expect(status("(2", { answer: "2" })).toBe("invalid");
  });
});

describe("answer forms", () => {
  test("factored", () => {
    const spec = { answer: "(x - 2)(x + 3)", factored: true };
    expect(status("(x+3)(x-2)", spec)).toBe("correct");
    expect(status("x^2 + x - 6", spec)).toBe("unsimplified");
    expect(status("(x-2)(x-3)", spec)).toBe("incorrect");
    expect(status("2(x + 3)", { answer: "2x + 6", factored: true })).toBe("correct");
    expect(status("(x+1)^2", { answer: "x^2 + 2x + 1", factored: true })).toBe("correct");
  });

  test("simplest radical form", () => {
    expect(status("6sqrt(2)", { answer: "6sqrt(2)", simplified: true })).toBe("correct");
    expect(status("sqrt(72)", { answer: "6sqrt(2)", simplified: true })).toBe("unsimplified");
    expect(status("1/sqrt(2)", { answer: "sqrt(2)/2", simplified: true })).toBe("unsimplified");
  });

  test("positive exponents", () => {
    expect(status("x^-3", { answer: "1/x^3", positiveExponents: true })).toBe("unsimplified");
    expect(status("1/x^3", { answer: "1/x^3", positiveExponents: true })).toBe("correct");
  });

  test("tuples", () => {
    const spec = { answer: "(2, -3)", form: "tuple" as const };
    expect(status("(2, -3)", spec)).toBe("correct");
    expect(status("2,-3", spec)).toBe("correct");
    expect(status("x = 2, y = -3", spec)).toBe("correct");
    expect(status("(-3, 2)", spec)).toBe("incorrect");
    expect(checkAnswer("(-3, 2)", spec)).toMatchObject({ message: expect.stringContaining("order") });
    expect(status("(2)", spec)).toBe("invalid");
    expect(status("(2x, 3y^2)", { answer: "(x + x, 3y^2)", form: "tuple" })).toBe("correct");
  });

  test("solution sets", () => {
    const spec = { answer: "2, -3", form: "set" as const };
    expect(status("-3, 2", spec)).toBe("correct");
    expect(status("x = 2 or x = -3", spec)).toBe("correct");
    expect(status("{2, -3}", spec)).toBe("correct");
    expect(checkAnswer("2", spec)).toMatchObject({ status: "incorrect", message: expect.stringContaining("2 solutions") });
    expect(status("2, 3", spec)).toBe("incorrect");
    expect(status("(-1 ± sqrt(5))/2", { answer: "(-1 + sqrt(5))/2, (-1 - sqrt(5))/2", form: "set" })).toBe("correct");
    expect(status("3, 3", { answer: "3", form: "set" })).toBe("correct");
  });

  test("inequalities", () => {
    const spec = { answer: "x >= 4", form: "inequality" as const };
    expect(status("x >= 4", spec)).toBe("correct");
    expect(status("4 <= x", spec)).toBe("correct");
    expect(status("x ≥ 4", spec)).toBe("correct");
    expect(status("[4, inf)", spec)).toBe("correct");
    expect(checkAnswer("x > 4", spec)).toMatchObject({ message: expect.stringContaining("included") });
    expect(checkAnswer("x <= 4", spec)).toMatchObject({ message: expect.stringContaining("wrong way") });
    expect(status("x >= 5", spec)).toBe("incorrect");
    expect(status("4", spec)).toBe("invalid");

    const compound = { answer: "-2 < x <= 5", form: "inequality" as const };
    expect(status("(-2, 5]", compound)).toBe("correct");
    expect(status("5 >= x > -2", compound)).toBe("correct");

    const union = { answer: "x < -1 or x > 3", form: "inequality" as const };
    expect(status("x > 3 or x < -1", union)).toBe("correct");
    expect(status("(-inf, -1) U (3, inf)", union)).toBe("correct");
  });
});

describe("stricter forms", () => {
  test("factored completely", () => {
    const spec = { answer: "2(x - 2)(x + 2)", factored: true };
    expect(status("2(x-2)(x+2)", spec)).toBe("correct");
    expect(status("2(x^2 - 4)", spec)).toBe("unsimplified");
    expect(status("(2x - 4)(x + 2)", spec)).toBe("unsimplified");
    expect(status("x^2(10x^2 - 6)", { answer: "2x^2(5x^2 - 3)", factored: true })).toBe("unsimplified");
    expect(status("(x^2 + 1)(x + 1)", { answer: "(x^2 + 1)(x + 1)", factored: true })).toBe("correct");
    expect(status("x(x + 3)", { answer: "x(x + 3)", factored: true })).toBe("correct");
  });

  test("numeric standard forms", () => {
    const spec = { answer: "(-3 + sqrt(5))/2, (-3 - sqrt(5))/2", form: "set" as const, simplified: true };
    expect(status("-3/2 + sqrt(5)/2, -3/2 - sqrt(5)/2", spec)).toBe("correct");
    expect(status("(-6 + 2sqrt(5))/4, (-6 - 2sqrt(5))/4", spec)).toBe("unsimplified");
    expect(status("(1/2)sqrt(6)", { answer: "sqrt(6)/2", simplified: true })).toBe("correct");
    expect(status("-8/6", { answer: "-4/3", simplified: true })).toBe("unsimplified");
    expect(status("3 + 4", { answer: "7", simplified: true })).toBe("unsimplified");
  });

  test("and in inequalities", () => {
    expect(status("x >= -3 and x < 4", { answer: "-3 <= x < 4", form: "inequality" })).toBe("correct");
    expect(status("(-inf,-2)U[3,inf)", { answer: "x < -2 or x >= 3", form: "inequality" })).toBe("correct");
  });
});

describe("geometry answers", () => {
  test("degrees and pi", () => {
    expect(status("133 degrees", { answer: "133" })).toBe("correct");
    expect(status("133°", { answer: "133" })).toBe("correct");
    expect(status("36pi", { answer: "36pi", simplified: true })).toBe("correct");
    expect(status("24 + 8π", { answer: "24 + 8pi", simplified: true })).toBe("correct");
    expect(status("12pi + 12pi", { answer: "24pi", simplified: true })).toBe("unsimplified");
  });

  test("inverse trig", () => {
    expect(status("acos(0)", { answer: "pi/2" })).toBe("correct");
    expect(status("atan(1)", { answer: "pi/4" })).toBe("correct");
  });
});

describe("algebra 2 answers", () => {
  test("complex numbers", () => {
    const spec = { answer: "1 + 5i", complex: true, simplified: true };
    expect(status("1 + 5i", spec)).toBe("correct");
    expect(status("5i + 1", spec)).toBe("correct");
    expect(status("1 - 5i", spec)).toBe("incorrect");
    expect(status("(2 + 3i)(1 + i) + 2", { answer: "1 + 5i", complex: true })).toBe("correct");
    expect(status("6 + 4i^2 + 5i - 1", spec)).toBe("unsimplified");
    expect(status("(13 + 65i)/13", { answer: "1 + 5i", complex: true, simplified: true })).toBe("unsimplified");
    expect(status("1/i", { answer: "-i", complex: true, simplified: true })).toBe("unsimplified");
    expect(status("2i, -2i", { answer: "2i, -2i", form: "set", complex: true })).toBe("correct");
    expect(status("-2i, 2i", { answer: "sqrt(-4), -sqrt(-4)", form: "set", complex: true })).toBe("correct");
    expect(status("3 + 2i", { answer: "3 + 2x" })).toBe("incorrect");
  });

  test("log bases and factorials", () => {
    expect(status("log_2(8)", { answer: "3" })).toBe("correct");
    expect(status("log_3 7", { answer: "ln(7)/ln(3)" })).toBe("correct");
    expect(status("5!", { answer: "120" })).toBe("correct");
    expect(status("10!/(3!7!)", { answer: "120" })).toBe("correct");
  });

  test("simplified rejects work left undone", () => {
    expect(status("9!/6!", { answer: "504", simplified: true })).toBe("unsimplified");
    expect(status("1 - 1/6", { answer: "5/6", simplified: true })).toBe("unsimplified");
    expect(status("1/2 + sqrt(5)/2", { answer: "(1 + sqrt(5))/2", simplified: true })).toBe("correct");
    const imag = { answer: "4sqrt(3)i", complex: true, simplified: true };
    expect(status("sqrt(-48)", imag)).toBe("unsimplified");
    expect(status("4i sqrt(3)", imag)).toBe("correct");
  });

  test("odd roots of negatives are real", () => {
    expect(status("(-8)^(1/3)", { answer: "-2" })).toBe("correct");
    expect(status("(-32)^(2/5)", { answer: "4" })).toBe("correct");
  });

  test("antiderivatives up to a constant", () => {
    const spec = { answer: "x^3/3", upToConstant: true };
    expect(status("x^3/3 + C", spec)).toBe("correct");
    expect(status("(1/3)x^3 + 7", spec)).toBe("correct");
    expect(status("x^3/3", spec)).toBe("correct");
    expect(status("x^2", spec)).toBe("incorrect");
  });

  test("tolerance accepts rounded answers", () => {
    expect(status("2.7268", { answer: "2.727", tolerance: 0.0005 })).toBe("correct");
    expect(status("2.73", { answer: "2.727", tolerance: 0.0005 })).toBe("incorrect");
  });

  test("matrices and vectors", () => {
    const m = { answer: "[[1, 2], [3, 4]]", form: "matrix" as const };
    expect(status("[[1,2],[3,4]]", m)).toBe("correct");
    expect(status("[1, 2; 3, 4]", m)).toBe("correct");
    expect(status("[[1,2],[3,5]]", m)).toBe("incorrect");
    expect(status("[[1,2,3]]", m)).toBe("invalid");
    expect(status("<3, 4>", { answer: "(3, 4)", form: "tuple" })).toBe("correct");
  });

  test("more functions and theta", () => {
    expect(status("sec(x)^2", { answer: "1/cos(x)^2" })).toBe("correct");
    expect(status("sinh(1)", { answer: "(e - 1/e)/2" })).toBe("correct");
    expect(status("cbrt(-8)", { answer: "-2" })).toBe("correct");
    expect(status("sin(theta)", { answer: "sin(t)" })).toBe("correct");
  });

  test("positive compares only where the variables are positive", () => {
    expect(status("2log(x)", { answer: "log(x^2)" })).toBe("incorrect");
    expect(status("2log(x)", { answer: "log(x^2)", positive: true })).toBe("correct");
    expect(status("sqrt(x) * x^(1/6)", { answer: "x^(2/3)", positive: true })).toBe("correct");
  });
});
