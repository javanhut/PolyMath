import { useId, useMemo, useState } from "react";
import type { ContourSpec, SeriesColor } from "../../curriculum/types";
import { evaluate, parse } from "../../math/expr";
import { RichText, Tex } from "../RichText";
import { niceStep, SERIES, Slider } from "./Plot";

const W = 560;
const M = 26;
const N = 80;

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** Level curves of f(x, y) by marching squares on an N×N grid. */
export function Contour({ x: [x0, x1], y: [y0, y1], expr, levels, points = [], arrows = [], params = [], caption }: ContourSpec) {
  const clip = useId();
  const marker = useId();
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(params.map((p) => [p.name, p.value])));
  const f = useMemo(() => parse(expr), [expr]);
  const coord = (v: number | string) => (typeof v === "number" ? v : evaluate(parse(v), values));

  const unit = (W - 2 * M) / (x1 - x0);
  const innerH = Math.min(Math.max((y1 - y0) * unit, 220), 520);
  const H = innerH + 2 * M;
  const sx = (x: number) => M + ((x - x0) / (x1 - x0)) * (W - 2 * M);
  const sy = (y: number) => M + ((y1 - y) / (y1 - y0)) * innerH;

  // Sample once per render; sliders change the values.
  const grid = useMemo(() => {
    const g: number[][] = [];
    for (let j = 0; j <= N; j++) {
      const row: number[] = [];
      for (let i = 0; i <= N; i++) row.push(evaluate(f, { ...values, x: x0 + ((x1 - x0) * i) / N, y: y0 + ((y1 - y0) * j) / N }));
      g.push(row);
    }
    return g;
  }, [f, values, x0, x1, y0, y1]);

  const chosen = useMemo(() => {
    if (levels) return levels;
    const finite = grid.flat().filter(Number.isFinite);
    if (!finite.length) return [];
    const sorted = [...finite].sort((a, b) => a - b);
    // Spread levels over the middle 96% so a single spike doesn't flatten the rest.
    const lo = sorted[Math.floor(sorted.length * 0.02)]!;
    const hi = sorted[Math.floor(sorted.length * 0.98)]!;
    if (hi - lo < 1e-9) return [lo];
    const step = niceStep(hi - lo) / 2;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
  }, [grid, levels]);

  const paths = chosen.map((level) => {
    let d = "";
    const gx = (i: number) => x0 + ((x1 - x0) * i) / N;
    const gy = (j: number) => y0 + ((y1 - y0) * j) / N;
    // Where the level crosses the edge between two grid values.
    const cross = (a: number, b: number, pa: number, pb: number) => pa + ((level - a) / (b - a)) * (pb - pa);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = [grid[j]![i]!, grid[j]![i + 1]!, grid[j + 1]![i + 1]!, grid[j + 1]![i]!];
        if (v.some((z) => !Number.isFinite(z))) continue;
        const corners: [number, number][] = [
          [gx(i), gy(j)],
          [gx(i + 1), gy(j)],
          [gx(i + 1), gy(j + 1)],
          [gx(i), gy(j + 1)],
        ];
        const pts: [number, number][] = [];
        for (let k = 0; k < 4; k++) {
          const [a, b] = [v[k]!, v[(k + 1) % 4]!];
          if (a >= level !== b >= level) {
            const [pa, pb] = [corners[k]!, corners[(k + 1) % 4]!];
            pts.push([cross(a, b, pa[0], pb[0]), cross(a, b, pa[1], pb[1])]);
          }
        }
        // Two crossings give one segment; four (a saddle) give two, paired in order.
        for (let k = 0; k + 1 < pts.length; k += 2) {
          d += `M${sx(pts[k]![0]).toFixed(1)},${sy(pts[k]![1]).toFixed(1)}L${sx(pts[k + 1]![0]).toFixed(1)},${sy(pts[k + 1]![1]).toFixed(1)}`;
        }
      }
    }
    return d;
  });

  const label = (text: string) =>
    text
      .replace(/\{=([^{}]+)\}/g, (_, e: string) => fmt(evaluate(parse(e), values)))
      .replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? fmt(values[name]!) : m));
  const xStep = niceStep(x1 - x0);
  const yStep = niceStep(y1 - y0);
  const ticks = (lo: number, hi: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
  };
  const axisY = y0 <= 0 && 0 <= y1 ? sy(0) : sy(y0);
  const axisX = x0 <= 0 && 0 <= x1 ? sx(0) : sx(x0);

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "Contour plot"}>
        <defs>
          <clipPath id={clip}>
            <rect x={M} y={M} width={W - 2 * M} height={innerH} />
          </clipPath>
          <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
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
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="var(--accent)" strokeOpacity={0.35 + (0.65 * (i + 1)) / paths.length} strokeWidth={1.8} />
          ))}
          {arrows.map((a, i) => {
            const [ax, ay, dx, dy] = [coord(a.x), coord(a.y), coord(a.dx), coord(a.dy)];
            const color = SERIES[a.color ?? 2];
            return <line key={`a${i}`} x1={sx(ax)} y1={sy(ay)} x2={sx(ax + dx)} y2={sy(ay + dy)} stroke={color} strokeWidth={2.5} markerEnd={`url(#${marker})`} />;
          })}
          {points.map((p, i) => {
            const color = SERIES[p.color ?? 2];
            return <circle key={`p${i}`} cx={sx(coord(p.x))} cy={sy(coord(p.y))} r={5} fill={color} stroke={color} strokeWidth={2} />;
          })}
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted">
        {chosen.length > 0 && <span>Levels: {chosen.map(fmt).join(", ")}</span>}
        {[...points, ...arrows]
          .filter((p) => p.label)
          .map((p, i) => (
            <span key={`l${i}`} className="flex items-center gap-2 text-[15px] text-ink">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[(p.color ?? 2) as SeriesColor] }} />
              <Tex math={label(p.label!)} />
            </span>
          ))}
      </div>
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
