import { useMemo, useState } from "react";
import type { SurfaceSpec } from "../../curriculum/types";
import { evaluate, parse } from "../../math/expr";
import { RichText, Tex } from "../RichText";
import { Slider } from "./Plot";

const W = 560;
const H = 400;
const N = 22;

/** A wireframe of z = f(x, y), turned with two built-in sliders. */
export function Surface({ x: [x0, x1], y: [y0, y1], z, expr, params = [], caption }: SurfaceSpec) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(params.map((p) => [p.name, p.value])));
  const [turn, setTurn] = useState(35);
  const [tilt, setTilt] = useState(28);
  const f = useMemo(() => parse(expr), [expr]);

  const grid = useMemo(() => {
    const g: number[][] = [];
    for (let j = 0; j <= N; j++) {
      const row: number[] = [];
      for (let i = 0; i <= N; i++) row.push(evaluate(f, { ...values, x: x0 + ((x1 - x0) * i) / N, y: y0 + ((y1 - y0) * j) / N }));
      g.push(row);
    }
    return g;
  }, [f, values, x0, x1, y0, y1]);

  const [z0, z1] = useMemo(() => {
    if (z) return z;
    const finite = grid.flat().filter(Number.isFinite);
    if (!finite.length) return [-1, 1];
    const lo = Math.min(...finite);
    const hi = Math.max(...finite);
    return hi - lo < 1e-9 ? [lo - 1, hi + 1] : [lo, hi];
  }, [grid, z]);

  // Orthographic view: turn about the z-axis, then tilt the eye upward.
  const a = (turn * Math.PI) / 180;
  const b = (tilt * Math.PI) / 180;
  const project = (x: number, y: number, zz: number) => {
    const u = ((x - x0) / (x1 - x0)) * 2 - 1;
    const v = ((y - y0) / (y1 - y0)) * 2 - 1;
    const w = ((zz - z0) / (z1 - z0)) * 2 - 1;
    const X = u * Math.cos(a) - v * Math.sin(a);
    const Y = u * Math.sin(a) + v * Math.cos(a);
    return { x: W / 2 + X * 150, y: H / 2 - (w * Math.cos(b) * 110 - Y * Math.sin(b) * 150) + 10, depth: Y * Math.cos(b) + w * Math.sin(b) };
  };

  const clampZ = (zz: number) => Math.min(z1 + (z1 - z0) * 0.25, Math.max(z0 - (z1 - z0) * 0.25, zz));
  const line = (pts: { x: number; y: number; ok: boolean }[]) => {
    let d = "";
    let pen = false;
    for (const p of pts) {
      if (!p.ok) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const gx = (i: number) => x0 + ((x1 - x0) * i) / N;
  const gy = (j: number) => y0 + ((y1 - y0) * j) / N;
  const at = (i: number, j: number) => {
    const zz = grid[j]![i]!;
    const ok = Number.isFinite(zz);
    return { ...project(gx(i), gy(j), ok ? clampZ(zz) : z0), ok };
  };
  const rows = Array.from({ length: N + 1 }, (_, j) => line(Array.from({ length: N + 1 }, (_, i) => at(i, j))));
  const cols = Array.from({ length: N + 1 }, (_, i) => line(Array.from({ length: N + 1 }, (_, j) => at(i, j))));

  // Axes from the corner nearest the viewer's lower left.
  const o = project(x0, y0, z0);
  const ex = project(x1, y0, z0);
  const ey = project(x0, y1, z0);
  const ez = project(x0, y0, z1);
  const fmt = (n: number) => String(Math.round(n * 100) / 100);

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption ?? "Surface plot"}>
        <g stroke="var(--muted)" strokeWidth={1.2}>
          <line x1={o.x} y1={o.y} x2={ex.x} y2={ex.y} />
          <line x1={o.x} y1={o.y} x2={ey.x} y2={ey.y} />
          <line x1={o.x} y1={o.y} x2={ez.x} y2={ez.y} />
        </g>
        <g fill="var(--muted)" fontSize={12} fontStyle="italic" fontFamily="serif">
          <text x={ex.x + 6} y={ex.y + 4}>x = {fmt(x1)}</text>
          <text x={ey.x + 6} y={ey.y + 4}>y = {fmt(y1)}</text>
          <text x={ez.x + 6} y={ez.y + 4}>z = {fmt(z1)}</text>
          <text x={o.x - 6} y={o.y + 14} textAnchor="end">
            ({fmt(x0)}, {fmt(y0)}, {fmt(z0)})
          </text>
        </g>
        <g fill="none" strokeWidth={1.2} strokeLinejoin="round">
          {rows.map((d, j) => (
            <path key={`r${j}`} d={d} stroke="var(--accent)" strokeOpacity={0.75} />
          ))}
          {cols.map((d, i) => (
            <path key={`c${i}`} d={d} stroke="var(--area-2)" strokeOpacity={0.75} />
          ))}
        </g>
      </svg>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Slider label="turn" value={turn} min={0} max={360} step={1} onChange={setTurn} />
        <Slider label="tilt" value={tilt} min={-10} max={90} step={1} onChange={setTilt} />
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
      {caption && <RichText text={caption} className="mt-3 text-[15px] text-muted" />}
    </figure>
  );
}
