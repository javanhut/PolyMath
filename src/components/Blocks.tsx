import { useState } from "react";
import type { Block, Step } from "../curriculum/types";
import { checkAnswer, type Verdict } from "../math/check";
import { MathInput } from "./MathInput";
import { Inline, RichText, Tex } from "./RichText";
import { AreaModel } from "./widgets/AreaModel";
import { BalanceScale } from "./widgets/BalanceScale";
import { Contour } from "./widgets/Contour";
import { Diagram } from "./widgets/Diagram";
import { Surface } from "./widgets/Surface";
import { NumberLine, Plot } from "./widgets/Plot";

function Callout({ tone, label, title, body }: { tone: "why" | "key"; label: string; title: string; body: string }) {
  const styles = tone === "why" ? "border-why bg-why-soft" : "border-key bg-key-soft";
  const labelColor = tone === "why" ? "text-why" : "text-key";
  return (
    <aside className={`rounded-r-xl border-l-4 px-5 py-4 ${styles}`}>
      <div className={`text-xs font-bold uppercase tracking-wider ${labelColor}`}>{label}</div>
      <h3 className="mt-0.5 mb-2 font-serif text-lg font-semibold">
        <Inline text={title} />
      </h3>
      <RichText text={body} />
    </aside>
  );
}

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="grid grid-cols-[minmax(0,auto)_1fr] items-baseline gap-x-4 gap-y-0.5 max-sm:grid-cols-1">
          <span className="overflow-x-auto">
            <Tex math={s.math} />
          </span>
          {s.note && (
            <span className="text-muted text-[15px]">
              <Inline text={s.note} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Example({ title, problem, steps }: { title: string; problem: string; steps: Step[] }) {
  const [shown, setShown] = useState(0);
  const done = shown >= steps.length;
  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="text-xs font-bold uppercase tracking-wider text-accent">Worked example</div>
      <h3 className="mt-0.5 font-serif text-lg font-semibold">
        <Inline text={title} />
      </h3>
      <div className="my-2">
        <Inline text={problem} />
      </div>
      {shown > 0 && (
        <div className="my-3 border-t border-line pt-3">
          <StepList steps={steps.slice(0, shown)} />
        </div>
      )}
      {!done && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => setShown(shown + 1)} className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:brightness-95">
            {shown === 0 ? "Show the first step" : "Next step"}
          </button>
          <button onClick={() => setShown(steps.length)} className="px-2 py-1.5 text-sm text-muted hover:text-ink">
            Show all
          </button>
        </div>
      )}
    </section>
  );
}

function Proof({ title, given, prove, steps }: Extract<Block, { kind: "proof" }>) {
  const [shown, setShown] = useState(0);
  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="text-xs font-bold uppercase tracking-wider text-accent">Proof</div>
      <h3 className="mt-0.5 font-serif text-lg font-semibold">
        <Inline text={title} />
      </h3>
      <dl className="my-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
        <dt className="font-semibold">Given</dt>
        <dd>
          <Inline text={given} />
        </dd>
        <dt className="font-semibold">Prove</dt>
        <dd>
          <Inline text={prove} />
        </dd>
      </dl>
      {shown > 0 && (
        <table className="my-3 w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="w-8 py-1.5 font-semibold"></th>
              <th className="py-1.5 pr-4 font-semibold">Statement</th>
              <th className="py-1.5 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody>
            {steps.slice(0, shown).map((s, i) => (
              <tr key={i} className="border-b border-line/60 align-top">
                <td className="py-2 text-muted tabular-nums">{i + 1}.</td>
                <td className="py-2 pr-4">
                  <Inline text={s.statement} />
                </td>
                <td className="py-2 text-muted">
                  <Inline text={s.reason} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {shown < steps.length && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => setShown(shown + 1)} className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:brightness-95">
            {shown === 0 ? "Show the first line" : "Next line"}
          </button>
          <button onClick={() => setShown(steps.length)} className="px-2 py-1.5 text-sm text-muted hover:text-ink">
            Show all
          </button>
        </div>
      )}
    </section>
  );
}

/** Multiple-choice options. After answering, the right one turns green and a wrong pick red. */
export function Choices({
  choices,
  picked,
  correct,
  onPick,
  disabled,
}: {
  choices: string[];
  picked: string | null;
  correct?: string;
  onPick: (choice: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((c) => {
        const state = correct === undefined ? (picked === c ? "picked" : "") : c === correct ? "right" : picked === c ? "wrong" : "";
        const cls = {
          "": "border-line hover:border-accent",
          picked: "border-accent bg-accent-soft",
          right: "border-good bg-good-soft text-good",
          wrong: "border-bad bg-bad-soft text-bad",
        }[state];
        return (
          <button key={c} onClick={() => onPick(c)} disabled={disabled} className={`rounded-lg border px-3 py-1.5 text-[15px] ${cls}`}>
            <Inline text={c} />
          </button>
        );
      })}
    </div>
  );
}

export function Feedback({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null;
  if (verdict.status === "correct") return <p className="font-medium text-good">Correct.</p>;
  if (verdict.status === "incorrect") return <p className="font-medium text-bad">{verdict.message ?? "Not quite."}</p>;
  return <p className="text-why">{verdict.message}</p>;
}

function Check({ block }: { block: Extract<Block, { kind: "check" }> }) {
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [revealed, setRevealed] = useState(false);
  const solved = verdict?.status === "correct";
  const submit = (value = input) => setVerdict(checkAnswer(value, block));
  return (
    <section className="rounded-xl border border-dashed border-accent/50 px-5 py-4">
      <div className="text-xs font-bold uppercase tracking-wider text-accent">Try it</div>
      <div className="mt-1 mb-3">
        <Inline text={block.prompt} />
      </div>
      {block.choices ? (
        <Choices
          choices={block.choices}
          picked={input || null}
          correct={solved || revealed ? block.accept?.[0] : undefined}
          disabled={solved}
          onPick={(c) => {
            setInput(c);
            submit(c);
          }}
        />
      ) : (
        <div className="flex items-start gap-2">
          <MathInput value={input} onChange={setInput} onSubmit={() => submit()} disabled={solved} />
          <button onClick={() => submit()} disabled={solved} className="rounded-lg bg-accent px-4 py-2 font-medium text-paper disabled:opacity-50">
            Check
          </button>
        </div>
      )}
      <Feedback verdict={verdict} />
      {(solved || revealed) && (
        <div className="mt-2 text-[15px]">
          <Inline text={block.explain} />
        </div>
      )}
      {verdict && !solved && !revealed && (
        <button onClick={() => setRevealed(true)} className="mt-1 text-sm text-muted underline underline-offset-2 hover:text-ink">
          Show the answer
        </button>
      )}
    </section>
  );
}

export function LessonBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "text":
      return <RichText text={block.body} className="text-[17px]" />;
    case "key":
      return <Callout tone="key" label="Key idea" title={block.title} body={block.body} />;
    case "why":
      return <Callout tone="why" label="Why?" title={block.title} body={block.body} />;
    case "example":
      return <Example {...block} />;
    case "check":
      return <Check block={block} />;
    case "widget":
      return block.widget === "area-model" ? <AreaModel /> : <BalanceScale />;
    case "plot":
      return <Plot {...block} />;
    case "numberline":
      return <NumberLine {...block} />;
    case "diagram":
      return <Diagram {...block} />;
    case "contour":
      return <Contour {...block} />;
    case "surface":
      return <Surface {...block} />;
    case "proof":
      return <Proof {...block} />;
  }
}
