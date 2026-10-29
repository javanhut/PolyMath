import type { AnswerSpec } from "../math/check";
import type { Rng } from "../math/random";

// Lesson text is a light markup rendered by components/RichText.tsx:
// $inline math$, $$display math$$, **bold**, *italic*, "- " bullet lines,
// and blank lines between paragraphs. Write it with String.raw (exported as
// `md`) so LaTeX backslashes don't need escaping.
export const md = String.raw;

export interface Step {
  /** LaTeX for this line of working. */
  math: string;
  /** What was done and why, in markup. */
  note?: string;
}

export type Block =
  | { kind: "text"; body: string }
  /** A definition or rule to remember. */
  | { kind: "key"; title: string; body: string }
  /** The reasoning behind a rule: the first-principles part. */
  | { kind: "why"; title: string; body: string }
  /** A worked example whose steps are revealed one at a time. */
  | { kind: "example"; title: string; problem: string; steps: Step[] }
  /** A single question to try before reading on. */
  | ({ kind: "check"; prompt: string; explain: string } & AnswerSpec)
  | { kind: "widget"; widget: "area-model" | "balance" };

export interface Problem extends AnswerSpec {
  prompt: string;
  /** Shown on request before answering. */
  hint: string;
  /** Shown after a wrong answer or on request. */
  solution: Step[];
}

export type Generator = (r: Rng) => Problem;

export interface Lesson {
  id: string;
  title: string;
  summary?: string;
  /** Absent while the lesson is only planned. */
  blocks?: Block[];
  practice?: Generator[];
}

export interface Unit {
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  tagline: string;
  /** Courses that should be finished first. */
  prereqs: string[];
  units: Unit[];
}

export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A unit whose lessons are planned but not written yet. */
export function plannedUnit(title: string, lessons: string[]): Unit {
  return { title, lessons: lessons.map((t) => ({ id: slug(t), title: t })) };
}

export function isWritten(lesson: Lesson): boolean {
  return !!lesson.blocks?.length;
}
