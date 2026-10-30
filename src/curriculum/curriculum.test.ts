import { describe, expect, test } from "bun:test";
import { evaluate, parseEquation } from "../math/expr";
import { rng } from "../math/random";
import { COURSES, courseLessons } from "./courses";
import { isWritten } from "./types";
import { latexToText, validateUnit } from "./validate";

// Share of generated answer keys that validate.ts must re-derive from the prompt.
// Geometry asks for many things it can't read back (areas of described figures,
// which criterion applies), so writers audit those separately.
const MIN_VERIFIED: Record<string, number> = { "algebra-1": 0.5 };
const DEFAULT_MIN_VERIFIED = 0.2;

describe("lesson content", () => {
  for (const course of COURSES) {
    for (const unit of course.units) {
      if (!unit.lessons.some(isWritten)) continue;
      test(`${course.title}: ${unit.title}`, () => {
        const report = validateUnit(unit, { seeds: 400, samplesPer: 0 });
        expect(report.errors).toEqual([]);
        expect(report.verified / report.total).toBeGreaterThan(MIN_VERIFIED[course.id] ?? DEFAULT_MIN_VERIFIED);
      }, 60_000);
    }
  }

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

  test("no-solution and all-reals problems really are", () => {
    for (const course of COURSES) {
      for (const lesson of courseLessons(course).filter(isWritten)) {
        for (const gen of lesson.practice ?? []) {
          for (let seed = 1; seed <= 200; seed++) {
            const problem = gen(rng(seed));
            if (problem.answer || !problem.accept || problem.form === "inequality") continue;
            const tex = problem.prompt.match(/^Solve \$([^$]+)\$/)?.[1];
            // Linear equations only: the constant-difference test below doesn't apply to |x| or powers.
            if (!tex?.includes("=") || /\\[lg]e|<|>|\||\^|\\sqrt/.test(tex)) continue;
            const [l, r] = parseEquation(latexToText(tex));
            // Rational equations are undefined at their excluded values, which say nothing either way,
            // so sample extra points and use only those where both sides are defined.
            const diffs = [-3, 0, 2, 7, -8, 11].map((x) => evaluate(l, { x }) - evaluate(r, { x })).filter(Number.isFinite);
            expect(diffs.length, `${lesson.id} seed ${seed}: too few defined sample points`).toBeGreaterThanOrEqual(4);
            const allZero = diffs.every((d) => Math.abs(d) < 1e-9);
            const constantNonzero = diffs.every((d) => Math.abs(d - diffs[0]!) < 1e-9 && Math.abs(d) > 1e-9);
            const where = `${lesson.id} seed ${seed}`;
            expect(allZero || constantNonzero, where).toBe(true);
            expect(problem.accept.some((a) => /no/.test(a)), where).toBe(constantNonzero);
          }
        }
      }
    }
  });
});
