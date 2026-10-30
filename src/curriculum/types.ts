import type { AnswerSpec } from "../math/check";
import type { Rng } from "../math/random";

// Lesson text is a light markup rendered by components/RichText.tsx:
// $inline math$, $$display math$$, **bold**, *italic*, "- " bullet lines,
// and blank lines between paragraphs. Write it with the `md` tag, a raw
// template, so LaTeX backslashes don't need escaping.
export function md(strings: TemplateStringsArray, ...values: unknown[]): string {
  // Bun 1.4 escapes non-ASCII characters in String.raw ("✓" becomes "\u2713"); undo that.
  return String.raw(strings, ...values).replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

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
  | { kind: "widget"; widget: "area-model" | "balance" }
  /** A graph of y = f(x) curves and points, optionally with sliders. */
  | ({ kind: "plot" } & PlotSpec)
  /** A number line with shaded intervals, for inequalities. */
  | ({ kind: "numberline" } & NumberLineSpec)
  /** A geometry figure: named points, segments, polygons, circles, angle marks. */
  | ({ kind: "diagram" } & DiagramSpec)
  /** A two-column proof, revealed one line at a time. Statements and reasons are markup. */
  | { kind: "proof"; title: string; given: string; prove: string; steps: { statement: string; reason: string }[] };

export type Figure = ({ kind: "diagram" } & DiagramSpec) | ({ kind: "plot" } & PlotSpec);

/** Series colours: 1 accent blue, 2 orange, 3 green, 4 red. */
export type SeriesColor = 1 | 2 | 3 | 4;

export interface PlotSpec {
  /** Visible ranges. Units are drawn at equal scale when the shape allows it. */
  x: [number, number];
  y: [number, number];
  /** Curves y = f(x), typed like answers ("2x + 1", "x^2 - 4", "m x + b") in x and any slider names. */
  curves?: { expr: string; label?: string; color?: SeriesColor; dashed?: boolean; domain?: [number, number] }[];
  /** Coordinates may be numbers or expressions in slider names. Labels are LaTeX. */
  points?: { x: number | string; y: number | string; label?: string; open?: boolean; color?: SeriesColor }[];
  /** Dashed vertical lines, e.g. asymptotes or x = c. */
  vlines?: { x: number; label?: string }[];
  /**
   * Sliders. `label` is plain text; `tex` is a LaTeX label shown instead.
   * In labels, {name} becomes the slider's value and {=expr} the value of an expression in slider names.
   */
  params?: { name: string; label?: string; tex?: string; min: number; max: number; step: number; value: number }[];
  caption?: string;
}

export interface NumberLineSpec {
  range: [number, number];
  /** Shaded stretches; null means it runs off to infinity (drawn as an arrow). */
  intervals?: { from: number | null; to: number | null; fromOpen?: boolean; toOpen?: boolean }[];
  points?: { at: number; open?: boolean; label?: string }[];
  caption?: string;
}

export interface Problem extends AnswerSpec {
  prompt: string;
  /** A figure shown with the problem: a geometry diagram or a graph. */
  figure?: Figure;
  /**
   * Hidden equations the answer must satisfy, for prompts the validator can't read
   * ("Find x." with a figure). Write the relationship, not the answer: "x + 56 + 74 = 180",
   * "(x + 3)/15 = 8/12". The unknown is the one letter used; for tuple answers the
   * letters are bound in alphabetical order. Never shown to the learner.
   */
  verify?: string[];
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

/**
 * A geometry figure in its own coordinates (y up), drawn at equal scale.
 * Coordinates and radii may be numbers or expressions in slider names, e.g.
 * "4cos(t pi/180)". Points are referred to by name everywhere else.
 */
export interface DiagramSpec {
  /** Visible window: [xmin, xmax, ymin, ymax]. */
  view: [number, number, number, number];
  /** Draw a coordinate grid with axes (coordinate geometry). */
  grid?: boolean;
  points?: {
    name: string;
    x: number | string;
    y: number | string;
    /** LaTeX label; defaults to the name. Use "" for none. */
    label?: string;
    /** Where the label sits relative to the point. Default "ne". */
    dir?: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
    /** Draw no dot (for construction points). */
    hidden?: boolean;
  }[];
  segments?: {
    from: string;
    to: string;
    /** "ray" extends past `to`; "line" extends both ways. */
    kind?: "segment" | "ray" | "line";
    /** Arrowhead at `to`, for vectors. */
    arrow?: boolean;
    color?: SeriesColor;
    dashed?: boolean;
    /** LaTeX label at the midpoint, e.g. a length. */
    label?: string;
    /** Congruence tick marks at the midpoint. */
    ticks?: 1 | 2 | 3;
    /** Parallel-arrow marks at the midpoint. */
    parallel?: 1 | 2;
  }[];
  polygons?: { points: string[]; fill?: SeriesColor; dashed?: boolean }[];
  /** Arc of a circle around `center` from point `from` to point `to` (radius = distance to `from`); the minor arc unless `major`. */
  arcs?: { center: string; from: string; to: string; major?: boolean; color?: SeriesColor; dashed?: boolean }[];
  circles?: { center: string; radius: number | string; color?: SeriesColor; dashed?: boolean; fill?: SeriesColor }[];
  /** The angle at `at` turning from ray at->from to ray at->to (the smaller one). */
  angles?: { at: string; from: string; to: string; label?: string; right?: boolean; arcs?: 1 | 2 | 3; color?: SeriesColor; reflex?: boolean }[];
  /**
   * Free LaTeX labels; `x`/`y` may be expressions in slider names. All LaTeX labels in a
   * diagram (points, segments, angles, these) may use {name} and {=expr} for live values.
   */
  labels?: { x: number | string; y: number | string; text: string }[];
  params?: PlotSpec["params"];
  /** Live values under the figure: LaTeX label and an expression in slider names, e.g. { label: "a + b", value: "a + b" }. */
  readouts?: { label: string; value: string; unit?: string }[];
  caption?: string;
}
