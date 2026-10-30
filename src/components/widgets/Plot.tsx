import { useId, useMemo, useState, type ReactNode } from "react";
import type { NumberLineSpec, PlotSpec, SeriesColor } from "../../curriculum/types";
import { evaluate, parse, type Node } from "../../math/expr";
import { RichText, Tex } from "../RichText";

export const SERIES: Record<SeriesColor, string> = { 1: "var(--accent)", 2: "var(--area-2)", 3: "var(--good)", 4: "var(--bad)" };

const W = 560;
const M = 26;

/** A tick spacing of 1, 2 or 5 times a power of ten giving at most ~12 ticks. */
export function niceStep(span: number): number {
  const raw = span / 12;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw)!;
}

function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

function coord(v: number | string, scope: Record<string, number>): number {
  return typeof v === "number" ? v : evaluate(parse(v), scope);
}

export function Slider({ label, value, min, max, step, onChange }: { label: ReactNode; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="min-w-16 font-serif italic">
        {label} = {fmt(value)}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
    </label>
  );
}

export function Plot({ x: [x0, x1], y: [y0, y1], curves = [], points = [], vlines = [], hlines = [], shade = [], riemann, field, parametric = [], params = [], caption }: PlotSpec) {
  const clip = useId();
  const arrow = useId();
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(params.map((p) => [p.name, p.value])));
  const compiled = useMemo(() => curves.map((c) => parse(c.expr)), [curves]);

  const unit = (W - 2 * M) / (x1 - x0);
  const innerH = Math.min(Math.max((y1 - y0) * unit, 220), 520);
  const H = innerH + 2 * M;
  const sx = (x: number) => M + ((x - x0) / (x1 - x0)) * (W - 2 * M);
  const sy = (y: number) => M + ((y1 - y) / (y1 - y0)) * innerH;
  const xStep = niceStep(x1 - x0);
  const yStep = niceStep(y1 - y0);
  const axisY = y0 <= 0 && 0 <= y1 ? sy(0) : sy(y0);
  const axisX = x0 <= 0 && 0 <= x1 ? sx(0) : sx(x0);

  const path = (node: Node, domain?: [number, number]) => {
    const lo = Math.max(x0, domain?.[0] ?? x0);
    const hi = Math.min(x1, domain?.[1] ?? x1);
    const span = y1 - y0;
    let d = "";
    let prev: number | null = null;
    const N = 600;
    for (let i = 0; i <= N; i++) {
      const x = lo + ((hi - lo) * i) / N;
      const y = evaluate(node, { ...values, x });
      const ok = Number.isFinite(y) && y > y0 - 10 * span && y < y1 + 10 * span;
      // Lift the pen across gaps and vertical asymptotes.
      if (!ok || (prev !== null && Math.abs(y - prev) > 2 * span)) {
        prev = ok ? y : null;
        if (ok) d += `M${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
        continue;
      }
      d += `${prev === null ? "M" : "L"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
      prev = y;
    }
    return d;
  };

  const label = (text: string) =>
    text
      .replace(/\{=([^{}]+)\}/g, (_, e: string) => fmt(evaluate(parse(e), values)))
      .replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? fmt(values[name]!) : m));
  const legend = curves.filter((c) => c.label);
  const pt = (x: number, y: number) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
  const clampY = (y: number) => Math.min(y1 + (y1 - y0), Math.max(y0 - (y1 - y0), y));

  /** Polygon between two curves on [a, b]. */
  const region = (top: Node, bottom: Node, a: number, b: number) => {
    const N = 200;
    const up: string[] = [];
    const down: string[] = [];
    for (let i = 0; i <= N; i++) {
      const x = a + ((b - a) * i) / N;
      const t = evaluate(top, { ...values, x });
      const u = evaluate(bottom, { ...values, x });
      if (Number.isFinite(t) && Number.isFinite(u)) {
        up.push(pt(x, clampY(t)));
        down.unshift(pt(x, clampY(u)));
      }
    }
    return [...up, ...down].join(" ");
  };

  const rects = () => {
    if (!riemann) return null;
    const f = parse(riemann.expr);
    const [a, b] = [coord(riemann.from, values), coord(riemann.to, values)];
    const n = Math.max(1, Math.round(coord(riemann.n, values)));
    const dx = (b - a) / n;
    const color = SERIES[riemann.color ?? 1];
    const method = riemann.method ?? "left";
    return Array.from({ length: n }, (_, i) => {
      const l = a + i * dx;
      const r = l + dx;
      const at = method === "left" ? l : method === "right" ? r : method === "midpoint" ? (l + r) / 2 : l;
      if (method === "trapezoid") {
        const [hl, hr] = [evaluate(f, { ...values, x: l }), evaluate(f, { ...values, x: r })];
        if (!Number.isFinite(hl) || !Number.isFinite(hr)) return null;
        return <polygon key={i} points={`${pt(l, 0)} ${pt(l, clampY(hl))} ${pt(r, clampY(hr))} ${pt(r, 0)}`} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={1} />;
      }
      const h = evaluate(f, { ...values, x: at });
      if (!Number.isFinite(h)) return null;
      return <polygon key={i} points={`${pt(l, 0)} ${pt(l, clampY(h))} ${pt(r, clampY(h))} ${pt(r, 0)}`} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={1} />;
    });
  };

  const arrows = () => {
    if (!field) return null;
    const [fx, fy] = [parse(field.dx), parse(field.dy)];
    const n = field.density ?? 16;
    const stepX = (x1 - x0) / n;
    const stepY = (y1 - y0) / Math.max(4, Math.round((n * innerH) / (W - 2 * M)));
    const len = Math.min(stepX * unit, stepY * unit) * 0.7;
    const color = SERIES[field.color ?? 1];
    const out: ReactNode[] = [];
    for (let x = x0 + stepX / 2; x < x1; x += stepX) {
      for (let y = y0 + stepY / 2; y < y1; y += stepY) {
        const [u, v] = [evaluate(fx, { ...values, x, y }), evaluate(fy, { ...values, x, y })];
        const m = Math.hypot(u, v);
        if (!Number.isFinite(m) || m === 0) continue;
        const [cx, cy] = [sx(x), sy(y)];
        const [ex, ey] = [(u / m) * len, (-v / m) * len];
        out.push(<line key={`${x},${y}`} x1={cx - ex / 2} y1={cy - ey / 2} x2={cx + ex / 2} y2={cy + ey / 2} stroke={color} strokeWidth={1.3} markerEnd={`url(#${arrow})`} />);
      }
    }
    return out;
  };

  const paramPath = (c: { x: string; y: string; t: [number, number] }) => {
    const [fx, fy] = [parse(c.x), parse(c.y)];
    const span = Math.max(x1 - x0, y1 - y0);
    let d = "";
    let pen = false;
    const N = 800;
    for (let i = 0; i <= N; i++) {
      const t = c.t[0] + ((c.t[1] - c.t[0]) * i) / N;
      const [x, y] = [evaluate(fx, { ...values, t }), evaluate(fy, { ...values, t })];
      const ok = Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 10 * span + Math.abs(x0) + Math.abs(x1) && Math.abs(y) < 10 * span + Math.abs(y0) + Math.abs(y1);
      if (!ok) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${pt(x, y)}`;
      pen = true;
    }
    return d;
  };

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "Graph"}>
        <defs>
          <clipPath id={clip}>
            <rect x={M} y={M} width={W - 2 * M} height={innerH} />
          </clipPath>
          <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={SERIES[field?.color ?? 1]} />
          </marker>
        </defs>
        <g stroke="var(--line)" strokeWidth={1}>
          {ticks(x0, x1, xStep).map((v) => (
            <line key={`gx${v}`} x1={sx(v)} y1={M} x2={sx(v)} y2={M + innerH} />
          ))}
          {ticks(y0, y1, yStep).map((v) => (
            <line key={`gy${v}`} x1={M} y1={sy(v)} x2={W - M} y2={sy(v)} />
          ))}
        </g>
        <g stroke="var(--muted)" strokeWidth={1.5}>
          <line x1={M} y1={axisY} x2={W - M} y2={axisY} />
          <line x1={axisX} y1={M} x2={axisX} y2={M + innerH} />
        </g>
        <g fill="var(--muted)" fontSize={11}>
          {ticks(x0, x1, xStep)
            .filter((v) => v !== 0)
            .map((v) => (
              <text key={`tx${v}`} x={sx(v)} y={axisY + 14} textAnchor="middle">
                {fmt(v)}
              </text>
            ))}
          {ticks(y0, y1, yStep)
            .filter((v) => v !== 0)
            .map((v) => (
              <text key={`ty${v}`} x={axisX - 5} y={sy(v) + 4} textAnchor="end">
                {fmt(v)}
              </text>
            ))}
          <text x={W - M + 4} y={axisY + 4} fontStyle="italic" fontFamily="serif" fontSize={14}>
            x
          </text>
          <text x={axisX + 5} y={M - 8} fontStyle="italic" fontFamily="serif" fontSize={14}>
            y
          </text>
        </g>
        <g clipPath={`url(#${clip})`}>
          {shade.map((s, i) => (
            <polygon key={`s${i}`} points={region(parse(s.expr), parse(s.under ?? "0"), coord(s.from, values), coord(s.to, values))} fill={SERIES[s.color ?? 1]} fillOpacity={0.18} />
          ))}
          {rects()}
          {arrows()}
          {vlines.map((v, i) => (
            <line key={`v${i}`} x1={sx(coord(v.x, values))} y1={M} x2={sx(coord(v.x, values))} y2={M + innerH} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" />
          ))}
          {hlines.map((h, i) => (
            <line key={`h${i}`} x1={M} y1={sy(coord(h.y, values))} x2={W - M} y2={sy(coord(h.y, values))} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" />
          ))}
          {parametric.map((c, i) => (
            <path key={`q${i}`} d={paramPath(c)} fill="none" stroke={SERIES[c.color ?? (((i % 4) + 1) as SeriesColor)]} strokeWidth={2.5} strokeDasharray={c.dashed ? "7 5" : undefined} strokeLinejoin="round" />
          ))}
          {curves.map((c, i) => (
            <path
              key={i}
              d={path(compiled[i]!, c.domain)}
              fill="none"
              stroke={SERIES[c.color ?? (((i % 4) + 1) as SeriesColor)]}
              strokeWidth={2.5}
              strokeDasharray={c.dashed ? "7 5" : undefined}
              strokeLinejoin="round"
            />
          ))}
          {points.map((p, i) => {
            const px = coord(p.x, values);
            const py = coord(p.y, values);
            const color = SERIES[p.color ?? 1];
            return <circle key={`p${i}`} cx={sx(px)} cy={sy(py)} r={5} fill={p.open ? "var(--surface)" : color} stroke={color} strokeWidth={2} />;
          })}
        </g>
      </svg>
      {(legend.length > 0 || points.some((p) => p.label) || parametric.some((c) => c.label)) && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[15px]">
          {legend.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="inline-block h-1 w-5 rounded" style={{ background: SERIES[c.color ?? (((curves.indexOf(c) % 4) + 1) as SeriesColor)] }} />
              <Tex math={label(c.label!)} />
            </span>
          ))}
          {parametric
            .filter((c) => c.label)
            .map((c, i) => (
              <span key={`ql${i}`} className="flex items-center gap-2">
                <span className="inline-block h-1 w-5 rounded" style={{ background: SERIES[c.color ?? (((parametric.indexOf(c) % 4) + 1) as SeriesColor)] }} />
                <Tex math={label(c.label!)} />
              </span>
            ))}
          {points
            .filter((p) => p.label)
            .map((p, i) => (
              <span key={`pl${i}`} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[p.color ?? 1] }} />
                <Tex math={label(p.label!)} />
              </span>
            ))}
        </div>
      )}
      {params.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {params.map((p) => (
            <Slider
              key={p.name}
              label={p.tex ? <Tex math={p.tex} /> : (p.label ?? p.name)}
              value={values[p.name]!}
              min={p.min}
              max={p.max}
              step={p.step}
              onChange={(v) => setValues((s) => ({ ...s, [p.name]: v }))}
            />
          ))}
        </div>
      )}
      {caption && <RichText text={caption} className="mt-3 text-[15px] text-muted" />}
    </figure>
  );
}

export function NumberLine({ range: [lo, hi], intervals = [], points = [], caption }: NumberLineSpec) {
  const H = 64;
  const y = 30;
  const sx = (v: number) => M + ((v - lo) / (hi - lo)) * (W - 2 * M);
  const step = niceStep(hi - lo);
  const color = "var(--accent)";
  const end = (v: number, open: boolean | undefined, key: string) => (
    <circle key={key} cx={sx(v)} cy={y} r={6} fill={open ? "var(--surface)" : color} stroke={color} strokeWidth={2.5} />
  );
  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "Number line"}>
        <defs>
          <marker id="nl-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
          </marker>
          <marker id="nl-ray" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={color} />
          </marker>
        </defs>
        <line x1={8} y1={y} x2={W - 8} y2={y} stroke="var(--muted)" strokeWidth={1.5} markerStart="url(#nl-arrow)" markerEnd="url(#nl-arrow)" />
        {ticks(lo, hi, step).map((v) => (
          <g key={v}>
            <line x1={sx(v)} y1={y - 5} x2={sx(v)} y2={y + 5} stroke="var(--muted)" />
            <text x={sx(v)} y={y + 22} textAnchor="middle" fontSize={12} fill="var(--muted)">
              {fmt(v)}
            </text>
          </g>
        ))}
        {intervals.map((iv, i) => {
          const a = iv.from === null ? 10 : sx(iv.from);
          const b = iv.to === null ? W - 10 : sx(iv.to);
          return (
            <g key={i}>
              <line
                x1={a}
                y1={y}
                x2={b}
                y2={y}
                stroke={color}
                strokeWidth={5}
                markerStart={iv.from === null ? "url(#nl-ray)" : undefined}
                markerEnd={iv.to === null ? "url(#nl-ray)" : undefined}
              />
              {iv.from !== null && end(iv.from, iv.fromOpen, `a${i}`)}
              {iv.to !== null && end(iv.to, iv.toOpen, `b${i}`)}
            </g>
          );
        })}
        {points.map((p, i) => end(p.at, p.open, `p${i}`))}
      </svg>
      {points.some((p) => p.label) && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-5 text-[15px]">
          {points
            .filter((p) => p.label)
            .map((p, i) => (
              <Tex key={i} math={p.label!} />
            ))}
        </div>
      )}
      {caption && <RichText text={caption} className="mt-2 text-[15px] text-muted" />}
    </figure>
  );
}
