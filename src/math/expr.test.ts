import { describe, expect, test } from "bun:test";
import { evaluate, leafCount, parse, ParseError, toLatex } from "./expr";

const ev = (s: string, scope: Record<string, number> = {}) => evaluate(parse(s), scope);

describe("parse and evaluate", () => {
  test("follows the order of operations", () => {
    expect(ev("2 + 3 * 4")).toBe(14);
    expect(ev("12 / 3 * 2")).toBe(8);
    expect(ev("20 - 2*(3+1)^2/8")).toBe(16);
    expect(ev("2^3^2")).toBe(512);
  });

  test("negation waits for exponents", () => {
    expect(ev("-3^2")).toBe(-9);
    expect(ev("(-3)^2")).toBe(9);
    expect(ev("-x^2", { x: -3 })).toBe(-9);
    expect(ev("2^-1")).toBe(0.5);
  });

  test("implicit multiplication", () => {
    expect(ev("3x", { x: 2 })).toBe(6);
    expect(ev("2(x+1)", { x: 2 })).toBe(6);
    expect(ev("xy", { x: 2, y: 5 })).toBe(10);
    expect(ev("(x+1)(x-1)", { x: 3 })).toBe(8);
    expect(ev("2x^2", { x: 3 })).toBe(18);
    expect(ev("Prt", { P: 2, r: 3, t: 4 })).toBe(24);
  });

  test("functions, constants and unicode", () => {
    expect(ev("sqrt(16)")).toBe(4);
    expect(ev("√9")).toBe(3);
    expect(ev("|−4|")).toBe(4);
    expect(ev("2π")).toBeCloseTo(2 * Math.PI);
    expect(ev("2pir", { r: 1 })).toBeCloseTo(2 * Math.PI);
    expect(ev("6 ÷ 3 × 2")).toBe(4);
    expect(ev("x²", { x: 5 })).toBe(25);
  });

  test("reports readable errors", () => {
    expect(() => parse("(2+3")).toThrow(ParseError);
    expect(() => parse("2+")).toThrow(ParseError);
    expect(() => parse("2 # 3")).toThrow(ParseError);
    expect(() => parse("")).toThrow(ParseError);
  });
});

describe("toLatex", () => {
  test("renders like handwriting", () => {
    expect(toLatex(parse("3x + 2"))).toBe("3x + 2");
    expect(toLatex(parse("(x+1)/2"))).toBe("\\frac{x + 1}{2}");
    expect(toLatex(parse("-(x-4)"))).toBe("-\\left(x - 4\\right)");
    expect(toLatex(parse("x^2"))).toBe("x^{2}");
    expect(toLatex(parse("2*3"))).toBe("2 \\cdot 3");
    expect(toLatex(parse("a - (b - c)"))).toBe("a - \\left(b - c\\right)");
  });
});

test("leafCount measures how much is written", () => {
  expect(leafCount(parse("3x + 2x"))).toBe(4);
  expect(leafCount(parse("5x"))).toBe(2);
});
