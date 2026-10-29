import { useState, type ReactElement } from "react";
import { poly } from "../../math/random";
import { Tex } from "../RichText";

interface Side {
  x: number;
  ones: number;
}
interface State {
  left: Side;
  right: Side;
}

const PUZZLES: { start: State; x: number }[] = [
  { start: { left: { x: 3, ones: 2 }, right: { x: 0, ones: 11 } }, x: 3 },
  { start: { left: { x: 5, ones: 1 }, right: { x: 2, ones: 7 } }, x: 2 },
];

const BOX = 28;
const BLOCK = 14;
const PAN_W = 150;
const PIVOT = { x: 260, y: 70 };
const ARM = 165;

const sideTex = (s: Side) => poly([[s.x, "x"], [s.ones, ""]]);

function Pan({ cx, cy, side }: { cx: number; cy: number; side: Side }) {
  const items: ReactElement[] = [];
  const left = cx - PAN_W / 2 + 8;
  let y = cy;
  // Boxes in rows of 4, then unit blocks in rows of 8, stacked upwards.
  for (let i = 0; i < side.x; i++) {
    if (i % 4 === 0) y -= BOX + 3;
    const x = left + (i % 4) * (BOX + 4);
    items.push(
      <g key={`x${i}`}>
        <rect x={x} y={y} width={BOX} height={BOX} rx={4} fill="var(--area-1)" fillOpacity={0.85} />
        <text x={x + BOX / 2} y={y + BOX / 2 + 5} textAnchor="middle" fontSize={15} fontStyle="italic" fontFamily="serif" fill="var(--paper)">
          x
        </text>
      </g>,
    );
  }
  for (let i = 0; i < side.ones; i++) {
    if (i % 8 === 0) y -= BLOCK + 3;
    items.push(<rect key={`o${i}`} x={left + (i % 8) * (BLOCK + 3)} y={y} width={BLOCK} height={BLOCK} rx={2} fill="var(--area-2)" />);
  }
  return (
    <g>
      <line x1={cx} y1={cy - 80} x2={cx - PAN_W / 2} y2={cy} stroke="var(--muted)" strokeWidth={1} />
      <line x1={cx} y1={cy - 80} x2={cx + PAN_W / 2} y2={cy} stroke="var(--muted)" strokeWidth={1} />
      {items}
      <rect x={cx - PAN_W / 2} y={cy} width={PAN_W} height={6} rx={3} fill="var(--ink)" />
    </g>
  );
}

/** An equation as a balance: change both sides equally and it stays level. */
export function BalanceScale() {
  const [puzzle, setPuzzle] = useState(0);
  const { start, x: X } = PUZZLES[puzzle]!;
  const [history, setHistory] = useState<State[]>([start]);
  const state = history[history.length - 1]!;
  const { left, right } = state;

  const push = (s: State) => setHistory([...history, s]);
  const choose = (i: number) => {
    setPuzzle(i);
    setHistory([PUZZLES[i]!.start]);
  };

  const diff = right.x * X + right.ones - (left.x * X + left.ones);
  const balanced = diff === 0;
  const angle = Math.max(-14, Math.min(14, diff * 3));
  const rad = (angle * Math.PI) / 180;
  const ends = [-1, 1].map((d) => ({ x: PIVOT.x + d * ARM * Math.cos(rad), y: PIVOT.y + d * ARM * Math.sin(rad) }));
  const solved = balanced && left.x === 1 && left.ones === 0 && right.x === 0;

  const n = left.x;
  const canSplit = n > 1 && [right.x, left.ones, right.ones].every((v) => v % n === 0) && balanced;
  const commonX = Math.min(left.x, right.x);

  const action = "rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-40 disabled:hover:border-line";

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Tex math={`${sideTex(left)} ${balanced ? "=" : "\\ne"} ${sideTex(right)}`} />
        <div className="flex gap-1 text-sm">
          {PUZZLES.map((p, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              className={`rounded-md px-2 py-1 ${i === puzzle ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
            >
              Puzzle {i + 1}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 520 250" className="w-full" role="img" aria-label={`Balance scale: ${balanced ? "level" : "tipped"}`}>
        <polygon points={`${PIVOT.x},${PIVOT.y} ${PIVOT.x - 40},240 ${PIVOT.x + 40},240`} fill="var(--line)" />
        <line
          x1={ends[0]!.x}
          y1={ends[0]!.y}
          x2={ends[1]!.x}
          y2={ends[1]!.y}
          stroke="var(--ink)"
          strokeWidth={6}
          strokeLinecap="round"
          style={{ transition: "all 400ms ease" }}
        />
        <circle cx={PIVOT.x} cy={PIVOT.y} r={6} fill="var(--accent)" />
        <Pan cx={ends[0]!.x} cy={ends[0]!.y + 80} side={left} />
        <Pan cx={ends[1]!.x} cy={ends[1]!.y + 80} side={right} />
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className={action} disabled={!balanced || left.ones === 0 || right.ones === 0} onClick={() => push({ left: { ...left, ones: left.ones - 1 }, right: { ...right, ones: right.ones - 1 } })}>
          Remove a block from both sides
        </button>
        <button className={action} disabled={!balanced || commonX === 0} onClick={() => push({ left: { ...left, x: left.x - 1 }, right: { ...right, x: right.x - 1 } })}>
          Remove an x from both sides
        </button>
        <button
          className={action}
          disabled={!canSplit}
          onClick={() => push({ left: { x: 1, ones: left.ones / n }, right: { x: right.x / n, ones: right.ones / n } })}
        >
          {canSplit ? `Split both sides into ${n} equal groups` : "Split both sides into equal groups"}
        </button>
        <button className={action} disabled={!balanced || left.ones === 0} onClick={() => push({ left: { ...left, ones: left.ones - 1 }, right })}>
          Remove a block from the left only
        </button>
        <button className={action} disabled={history.length === 1} onClick={() => setHistory(history.slice(0, -1))}>
          Undo
        </button>
      </div>
      <figcaption className="mt-3 text-[15px]">
        {!balanced && <span className="text-bad">The scale tipped. Changing only one side made the equation false. Undo, and change both sides.</span>}
        {solved && (
          <span className="text-good">
            Solved: <Tex math={`x = ${right.ones}`} />. Each box weighs {right.ones}, and every step kept the scale level.
          </span>
        )}
        {balanced && !solved && <span className="text-muted">Get a single x alone on the left. Every move must keep the scale level.</span>}
      </figcaption>
    </figure>
  );
}
