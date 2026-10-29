import { useMemo, useRef, useState } from "react";
import type { Generator, Lesson } from "../curriculum/types";
import { checkAnswer, type Verdict } from "../math/check";
import { rng } from "../math/random";
import { useProgress } from "../progress";
import { MASTERY_STREAK } from "../shared";
import { Feedback, StepList } from "./Blocks";
import { MathInput } from "./MathInput";
import { Inline } from "./RichText";

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function MasteryMeter({ streak, mastered }: { streak: number; mastered: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex gap-1.5" aria-label={`${Math.min(streak, MASTERY_STREAK)} of ${MASTERY_STREAK} in a row`}>
        {Array.from({ length: MASTERY_STREAK }, (_, i) => (
          <span key={i} className={`h-2.5 w-6 rounded-full ${i < streak ? "bg-good" : "bg-line"}`} />
        ))}
      </div>
      <span className={mastered ? "font-medium text-good" : "text-muted"}>
        {mastered ? "Mastered" : `${MASTERY_STREAK} in a row to master`}
      </span>
    </div>
  );
}

/** Render only for lessons that have practice generators. */
export function Practice({ courseId, lesson }: { courseId: string; lesson: Lesson & { practice: Generator[] } }) {
  const generators = lesson.practice;
  const { get, record } = useProgress();
  const stats = get(courseId, lesson.id);
  const [seed, setSeed] = useState(newSeed);
  const problem = useMemo(() => {
    const r = rng(seed);
    return r.pick(generators)(r);
  }, [seed, generators]);

  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // "answered" once the attempt has been scored, right or wrong.
  const [answered, setAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const next = () => {
    setSeed(newSeed());
    setInput("");
    setVerdict(null);
    setAnswered(false);
    setShowHint(false);
    setShowSolution(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = () => {
    if (answered) return next();
    const v = checkAnswer(input, problem);
    setVerdict(v);
    // Unreadable or unsimplified answers get feedback but aren't scored, so the learner can fix them.
    if (v.status === "correct" || v.status === "incorrect") {
      setAnswered(true);
      if (v.status === "incorrect") setShowSolution(true);
      void record(courseId, lesson.id, v.status === "correct");
    }
  };

  const giveUp = () => {
    setShowSolution(true);
    if (!answered) {
      setAnswered(true);
      void record(courseId, lesson.id, false);
    }
  };

  const expected = problem.answer ?? problem.accept?.[0];

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold">Practice</h2>
        <MasteryMeter streak={stats?.streak ?? 0} mastered={!!stats?.masteredAt} />
      </div>
      <p className="mb-4 text-sm text-muted">
        Every problem is freshly generated. Any equivalent form of the answer is accepted.
        {stats && stats.attempts > 0 && ` So far: ${stats.correct} of ${stats.attempts} correct.`}
      </p>

      <div className="mb-4 text-[17px]">
        <Inline text={problem.prompt} />
      </div>

      <div className="flex items-start gap-2">
        <MathInput value={input} onChange={setInput} onSubmit={submit} disabled={answered} inputRef={inputRef} />
        <button
          onClick={submit}
          className={`rounded-lg px-4 py-2 font-medium text-paper ${answered ? "bg-good" : "bg-accent"}`}
        >
          {answered ? "Next" : "Check"}
        </button>
      </div>

      <div className="mt-1 space-y-2">
        <Feedback verdict={verdict} />
        {showHint && !showSolution && (
          <p className="text-[15px]">
            <span className="font-semibold">Hint: </span>
            <Inline text={problem.hint} />
          </p>
        )}
        {showSolution && (
          <div className="rounded-xl bg-paper px-4 py-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Solution</div>
            <StepList steps={problem.solution} />
            {verdict?.status !== "correct" && expected && (
              <p className="mt-2 text-sm text-muted">
                Answer: <span className="font-mono">{expected}</span>
              </p>
            )}
          </div>
        )}
        {!answered && (
          <div className="flex gap-4 text-sm">
            {!showHint && (
              <button onClick={() => setShowHint(true)} className="text-muted underline underline-offset-2 hover:text-ink">
                Hint
              </button>
            )}
            <button onClick={giveUp} className="text-muted underline underline-offset-2 hover:text-ink">
              Show solution (counts as a miss)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
