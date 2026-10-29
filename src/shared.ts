// Shared between the server and the browser.

/** Correct answers in a row that count as mastering a lesson. */
export const MASTERY_STREAK = 4;

export interface LessonProgress {
  attempts: number;
  correct: number;
  streak: number;
  /** Unix milliseconds, once mastered. Mastery is kept even if the streak later breaks. */
  masteredAt: number | null;
}

/** Keyed by "course/lesson". */
export type ProgressMap = Record<string, LessonProgress>;
