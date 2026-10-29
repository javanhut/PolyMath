import { describe, expect, test } from "bun:test";
import { checkAnswer } from "../math/check";
import { evaluate, parse, parseEquation } from "../math/expr";
import { rng } from "../math/random";
import { COURSES, courseLessons } from "./courses";
import { isWritten, type Problem } from "./types";

const SEEDS = 400;

/** Turn the simple LaTeX the generators emit back into typed-answer syntax. */
function latexToText(tex: string): string {
  let s = tex.replace(/\\cdot/g, "*").replace(/\\div/g, "/").replace(/\\left|\\right/g, "").replace(/\\pi/g, "pi");
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  }
  return s.replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"));
}

function* allProblems() {
  for (const course of COURSES) {
    for (const lesson of courseLessons(course).filter(isWritten)) {
      for (const [g, gen] of (lesson.practice ?? []).entries()) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          yield { where: `${course.id}/${lesson.id} #${g} seed ${seed}`, problem: gen(rng(seed)) };
        }
      }
    }
  }
}

/**
 * Independently verify an answer key by reading the problem itself: plug the
 * value into "Solve $L = R$", evaluate "Evaluate $E$", or compare "Expand/Simplify $E$".
 * Returns false when the prompt isn't one of those shapes.
 */
function verify(p: Problem): boolean {
  const math = [...p.prompt.matchAll(/\$([^$]+)\$/g)].map((m) => latexToText(m[1]!));
  const verb = p.prompt.match(/^(Solve|Evaluate|Expand|Simplify|Use)/)?.[1];
  if (!verb || !p.answer) return false;
  const answer = evaluate(parse(p.answer), {});

  if (verb === "Solve" && math.length >= 1 && /for \$/.test(p.prompt) === false) {
    const [l, r] = parseEquation(math[0]!);
    const scope = { x: answer };
    expect(evaluate(l, scope)).toBeCloseTo(evaluate(r, scope), 9);
    return true;
  }
  if (verb === "Evaluate" || verb === "Use") {
    const scope: Record<string, number> = {};
    for (const m of math.slice(1)) {
      const [name, value] = m.split("=").map((s) => s.trim());
      scope[name!] = Number(value);
    }
    expect(evaluate(parse(math[0]!), scope)).toBeCloseTo(answer, 9);
    return true;
  }
  if (verb === "Expand" || verb === "Simplify") {
    expect(checkAnswer(math[0]!, { answer: p.answer }).status).toBe("correct");
    return true;
  }
  return false;
}

describe("practice generators", () => {
  test("every answer key parses and passes its own checker", () => {
    for (const { where, problem } of allProblems()) {
      const typed = problem.answer ?? problem.accept?.[0];
      expect(typed, where).toBeDefined();
      const v = checkAnswer(typed!, problem);
      if (v.status !== "correct") throw new Error(`${where}: answer "${typed}" judged ${v.status} for: ${problem.prompt}`);
      expect(problem.solution.length, where).toBeGreaterThan(0);
      expect((problem.prompt.match(/\$/g) ?? []).length % 2, `${where}: unbalanced $ in ${problem.prompt}`).toBe(0);
    }
  });

  test("answer keys are mathematically right", () => {
    let verified = 0;
    let total = 0;
    for (const { where, problem } of allProblems()) {
      total++;
      try {
        if (verify(problem)) verified++;
      } catch (err) {
        throw new Error(`${where}: ${problem.prompt} -> ${problem.answer}\n${err}`);
      }
    }
    // Translations and formula rearrangements can't be read back mechanically; everything else must be.
    expect(verified / total).toBeGreaterThan(0.75);
  });

  test("special-case equations really have no solution or every solution", () => {
    for (const { where, problem } of allProblems()) {
      if (problem.answer || !problem.accept) continue;
      const tex = problem.prompt.match(/\$([^$]+)\$/)![1]!;
      const [l, r] = parseEquation(latexToText(tex));
      const diffs = [-3, 0, 2, 7].map((x) => evaluate(l, { x }) - evaluate(r, { x }));
      const allZero = diffs.every((d) => Math.abs(d) < 1e-9);
      const constantNonzero = diffs.every((d) => Math.abs(d - diffs[0]!) < 1e-9 && Math.abs(d) > 1e-9);
      expect(allZero || constantNonzero, where).toBe(true);
      expect(problem.accept.some((a) => /no/.test(a)), where).toBe(constantNonzero);
    }
  });
});

describe("lesson content", () => {
  test("lesson ids are unique within each course", () => {
    for (const course of COURSES) {
      const ids = courseLessons(course).map((l) => l.id);
      expect(new Set(ids).size, course.id).toBe(ids.length);
    }
  });

  test("prerequisites point at earlier courses", () => {
    COURSES.forEach((course, i) => {
      for (const p of course.prereqs) expect(COURSES.findIndex((c) => c.id === p), `${course.id} -> ${p}`).toBeLessThan(i);
    });
  });

  test("inline checks accept their own answers", () => {
    for (const lesson of COURSES.flatMap(courseLessons)) {
      for (const block of lesson.blocks ?? []) {
        if (block.kind !== "check") continue;
        expect(checkAnswer(block.answer ?? block.accept![0]!, block).status, `${lesson.id}: ${block.prompt}`).toBe("correct");
      }
    }
  });

  test("lesson text has balanced math delimiters", () => {
    for (const lesson of COURSES.flatMap(courseLessons)) {
      for (const block of lesson.blocks ?? []) {
        const texts = Object.values(block).filter((v): v is string => typeof v === "string");
        for (const t of texts) expect((t.match(/\$/g) ?? []).length % 2, `${lesson.id}: ${t.slice(0, 60)}`).toBe(0);
      }
    }
  });
});
