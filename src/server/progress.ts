import { Database } from "bun:sqlite";
import { MASTERY_STREAK, type LessonProgress, type ProgressMap } from "../shared";

interface Row {
  lesson: string;
  attempts: number;
  correct: number;
  streak: number;
  mastered_at: number | null;
}

function fromRow(row: Row): LessonProgress {
  return { attempts: row.attempts, correct: row.correct, streak: row.streak, masteredAt: row.mastered_at };
}

export function openProgress(path: string) {
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(`CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson      TEXT PRIMARY KEY,
    attempts    INTEGER NOT NULL DEFAULT 0,
    correct     INTEGER NOT NULL DEFAULT 0,
    streak      INTEGER NOT NULL DEFAULT 0,
    mastered_at INTEGER
  )`);

  const selectAll = db.query<Row, []>("SELECT * FROM lesson_progress");
  const selectOne = db.query<Row, { lesson: string }>("SELECT * FROM lesson_progress WHERE lesson = $lesson");
  const upsert = db.query(`
    INSERT INTO lesson_progress (lesson, attempts, correct, streak, mastered_at)
    VALUES ($lesson, 1, $hit, $hit, NULL)
    ON CONFLICT (lesson) DO UPDATE SET
      attempts = attempts + 1,
      correct  = correct + $hit,
      streak   = CASE WHEN $hit = 1 THEN streak + 1 ELSE 0 END
  `);
  const markMastered = db.query(
    "UPDATE lesson_progress SET mastered_at = $now WHERE lesson = $lesson AND mastered_at IS NULL AND streak >= $need",
  );
  const remove = db.query("DELETE FROM lesson_progress WHERE lesson = $lesson");

  return {
    all(): ProgressMap {
      return Object.fromEntries(selectAll.all().map((row) => [row.lesson, fromRow(row)]));
    },

    record(lesson: string, correct: boolean, now = Date.now()): LessonProgress {
      return db.transaction(() => {
        upsert.run({ lesson, hit: correct ? 1 : 0 });
        markMastered.run({ lesson, now, need: MASTERY_STREAK });
        return fromRow(selectOne.get({ lesson })!);
      })();
    },

    reset(lesson: string) {
      remove.run({ lesson });
    },

    close() {
      db.close();
    },
  };
}

export type ProgressStore = ReturnType<typeof openProgress>;
