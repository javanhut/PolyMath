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
