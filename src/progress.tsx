import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { lessonKey } from "./curriculum/courses";
import type { LessonProgress, ProgressMap } from "./shared";

interface ProgressApi {
  progress: ProgressMap;
  get(courseId: string, lessonId: string): LessonProgress | undefined;
  record(courseId: string, lessonId: string, correct: boolean): Promise<void>;
  reset(courseId: string, lessonId: string): Promise<void>;
  error: string | null;
}

const Ctx = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((p: ProgressMap) => setProgress(p))
      .catch(() => setError("Couldn't load your saved progress."));
  }, []);

  const record = useCallback(async (courseId: string, lessonId: string, correct: boolean) => {
    try {
      const res = await fetch(`/api/progress/${courseId}/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const updated = (await res.json()) as LessonProgress;
      setProgress((p) => ({ ...p, [lessonKey(courseId, lessonId)]: updated }));
      setError(null);
    } catch {
      setError("Couldn't save that answer. Is the PolyMath server still running?");
    }
  }, []);

  const reset = useCallback(async (courseId: string, lessonId: string) => {
    await fetch(`/api/progress/${courseId}/${lessonId}`, { method: "DELETE" });
    setProgress((p) => {
      const next = { ...p };
      delete next[lessonKey(courseId, lessonId)];
      return next;
    });
  }, []);

  const get = useCallback((courseId: string, lessonId: string) => progress[lessonKey(courseId, lessonId)], [progress]);

  return <Ctx.Provider value={{ progress, get, record, reset, error }}>{children}</Ctx.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useProgress outside ProgressProvider");
  return api;
}
