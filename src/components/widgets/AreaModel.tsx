import { useState } from "react";
import { Tex } from "../RichText";

const UNIT = 26;
const PAD = 34;
const MAX_A = 6;
const MAX_W = 14;

function Slider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-12 font-serif italic">
        {label} = {value}
      </span>
      <input type="range" min={1} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
    </label>
  );
}

/** a(b + c) = ab + ac, shown as one rectangle cut in two. */
export function AreaModel() {
  const [a, setA] = useState(3);
  const [b, setB] = useState(5);
  const [c, setC] = useState(3);

  const width = MAX_W * UNIT + PAD + 8;
  const height = a * UNIT + PAD + 8;
  const bw = b * UNIT;
  const cw = c * UNIT;
  const h = a * UNIT;

  const grid = (x0: number, cols: number) =>
    Array.from({ length: cols * a }, (_, i) => (
      <rect
        key={`${x0}-${i}`}
        x={PAD + x0 + (i % cols) * UNIT}
        y={PAD + Math.floor(i / cols) * UNIT}
        width={UNIT}
        height={UNIT}
        fill="none"
        stroke="var(--line)"
        strokeWidth={1}
      />
    ));

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`A ${a} by ${b + c} rectangle split into ${a} by ${b} and ${a} by ${c}`}>
        <rect x={PAD} y={PAD} width={bw} height={h} fill="var(--area-1)" fillOpacity={0.22} />
        <rect x={PAD + bw} y={PAD} width={cw} height={h} fill="var(--area-2)" fillOpacity={0.22} />
        {grid(0, b)}
        {grid(bw, c)}
        <rect x={PAD} y={PAD} width={bw} height={h} fill="none" stroke="var(--area-1)" strokeWidth={2.5} />
        <rect x={PAD + bw} y={PAD} width={cw} height={h} fill="none" stroke="var(--area-2)" strokeWidth={2.5} />
        <g fill="var(--ink)" fontSize={15} textAnchor="middle" fontStyle="italic" fontFamily="serif">
          <text x={PAD + bw / 2} y={PAD - 10}>b = {b}</text>
          <text x={PAD + bw + cw / 2} y={PAD - 10}>c = {c}</text>
          <text x={PAD - 16} y={PAD + h / 2 + 5}>a</text>
        </g>
        <g fontSize={14} textAnchor="middle" fontWeight={600}>
          <text x={PAD + bw / 2} y={PAD + h / 2 + 5} fill="var(--area-1)">{a * b}</text>
          <text x={PAD + bw + cw / 2} y={PAD + h / 2 + 5} fill="var(--area-2)">{a * c}</text>
        </g>
      </svg>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Slider label="a" value={a} max={MAX_A} onChange={setA} />
        <Slider label="b" value={b} max={MAX_W - c} onChange={setB} />
        <Slider label="c" value={c} max={MAX_W - b} onChange={setC} />
      </div>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-center gap-x-1.5 text-lg">
        <Tex math={`${a}(${b} + ${c}) =`} />
        <span className="text-[var(--area-1)]">
          <Tex math={`${a} \\cdot ${b}`} />
        </span>
        <Tex math="+" />
        <span className="text-[var(--area-2)]">
          <Tex math={`${a} \\cdot ${c}`} />
        </span>
        <Tex math={`= ${a * b} + ${a * c} = ${a * (b + c)}`} />
      </figcaption>
    </figure>
  );
}
