import { useId, useMemo, useState } from "react";
import type { DiagramSpec, SeriesColor } from "../../curriculum/types";
import { evaluate, parse } from "../../math/expr";
import { RichText, Tex } from "../RichText";
import { niceStep, SERIES, Slider } from "./Plot";

const MAX_W = 560;
const MAX_H = 600;
const M = 22;

type Vec = { x: number; y: number };

/** LaTeX inside the SVG at (x, y) in screen coordinates: centred, or starting/ending there. */
function TexLabel({ x, y, tex, color = "var(--ink)", anchor = "middle" }: { x: number; y: number; tex: string; color?: string; anchor?: "start" | "middle" | "end" }) {
  const W = 160;
  const left = anchor === "start" ? x : anchor === "end" ? x - W : x - W / 2;
  const justify = anchor === "start" ? "flex-start" : anchor === "end" ? "flex-end" : "center";
  return (
    <foreignObject x={left} y={y - 14} width={W} height={28} style={{ overflow: "visible", pointerEvents: "none" }}>
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: justify, color, fontSize: 14, whiteSpace: "nowrap" }}>
        <Tex math={tex} />
      </div>
    </foreignObject>
  );
}

const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.75, -0.75], nw: [-0.75, -0.75], se: [0.75, 0.75], sw: [-0.75, 0.75] } as const;

export function Diagram(spec: DiagramSpec) {
  const { view, grid, points = [], segments = [], polygons = [], arcs = [], circles = [], angles = [], labels = [], params = [], readouts = [], caption } = spec;
  const clip = useId();
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(params.map((p) => [p.name, p.value])));

  const compiled = useMemo(() => new Map<string, ReturnType<typeof parse>>(), []);
  const num = (v: number | string): number => {
    if (typeof v === "number") return v;
    let node = compiled.get(v);
    if (!node) compiled.set(v, (node = parse(v)));
    return evaluate(node, values);
  };

  const fmt = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "undefined");
  /** {name} -> slider value, {=expr} -> value of the expression. */
  const live = (tex: string) =>
    tex.replace(/\{=([^{}]+)\}/g, (_, e: string) => fmt(num(e))).replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? fmt(values[name]!) : m));

  const [x0, x1, y0, y1] = view;
  const unit = Math.min((MAX_W - 2 * M) / (x1 - x0), (MAX_H - 2 * M) / (y1 - y0));
  const W = (x1 - x0) * unit + 2 * M;
  const H = (y1 - y0) * unit + 2 * M;
  const sx = (x: number) => M + (x - x0) * unit;
  const sy = (y: number) => M + (y1 - y) * unit;

  const at: Record<string, Vec> = {};
  for (const p of points) at[p.name] = { x: num(p.x), y: num(p.y) };
  const scr = (name: string): Vec => ({ x: sx(at[name]!.x), y: sy(at[name]!.y) });
  const centroid = points.length
    ? { x: points.reduce((s, p) => s + scr(p.name).x, 0) / points.length, y: points.reduce((s, p) => s + scr(p.name).y, 0) / points.length }
    : { x: W / 2, y: H / 2 };
  const color = (c?: SeriesColor, fallback = "var(--ink)") => (c ? SERIES[c] : fallback);

  const gridLines = () => {
    const step = niceStep(Math.max(x1 - x0, y1 - y0));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let v = Math.ceil(x0 / step) * step; v <= x1 + 1e-9; v += step) xs.push(Math.round(v / step) * step);
    for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) ys.push(Math.round(v / step) * step);
    const ax = x0 <= 0 && 0 <= x1 ? sx(0) : sx(x0);
    const ay = y0 <= 0 && 0 <= y1 ? sy(0) : sy(y0);
    return (
      <g>
        <g stroke="var(--line)">
          {xs.map((v) => <line key={`x${v}`} x1={sx(v)} y1={M} x2={sx(v)} y2={H - M} />)}
          {ys.map((v) => <line key={`y${v}`} x1={M} y1={sy(v)} x2={W - M} y2={sy(v)} />)}
        </g>
        <g stroke="var(--muted)" strokeWidth={1.5}>
          <line x1={M} y1={ay} x2={W - M} y2={ay} />
          <line x1={ax} y1={M} x2={ax} y2={H - M} />
        </g>
        <g fill="var(--muted)" fontSize={11}>
          {xs.filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={sx(v)} y={ay + 14} textAnchor="middle">{v}</text>)}
          {ys.filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={ax - 5} y={sy(v) + 4} textAnchor="end">{v}</text>)}
        </g>
      </g>
    );
  };

  const segment = (s: DiagramSpec["segments"] extends (infer T)[] | undefined ? T : never, i: number) => {
    let a = scr(s.from);
    let b = scr(s.to);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const n = { x: -u.y, y: u.x };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const far = 3 * (W + H);
    if (s.kind === "ray" || s.kind === "line") b = { x: a.x + u.x * far, y: a.y + u.y * far };
    if (s.kind === "line") a = { x: a.x - u.x * far, y: a.y - u.y * far };
    const stroke = color(s.color);
    const marks = [];
    for (let k = 0; k < (s.ticks ?? 0); k++) {
      const off = (k - ((s.ticks ?? 1) - 1) / 2) * 5;
      const c = { x: mid.x + u.x * off, y: mid.y + u.y * off };
      marks.push(<line key={`t${k}`} x1={c.x - n.x * 6} y1={c.y - n.y * 6} x2={c.x + n.x * 6} y2={c.y + n.y * 6} stroke={stroke} strokeWidth={1.8} />);
    }
    for (let k = 0; k < (s.parallel ?? 0); k++) {
      const c = { x: mid.x + u.x * (k * 7 - 3), y: mid.y + u.y * (k * 7 - 3) };
      const tail = { x: c.x - u.x * 7, y: c.y - u.y * 7 };
      marks.push(
        <polyline
          key={`p${k}`}
          points={`${tail.x + n.x * 5},${tail.y + n.y * 5} ${c.x},${c.y} ${tail.x - n.x * 5},${tail.y - n.y * 5}`}
          fill="none"
          stroke={stroke}
          strokeWidth={1.8}
        />,
      );
    }
    // Put the label on the side of the segment away from the figure's centre.
    const side = (centroid.x - mid.x) * n.x + (centroid.y - mid.y) * n.y > 0 ? -1 : 1;
    return (
      <g key={`s${i}`}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={2} strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinecap="round" />
        {s.arrow && (
          <polygon
            points={`${b.x},${b.y} ${b.x - u.x * 11 + n.x * 5},${b.y - u.y * 11 + n.y * 5} ${b.x - u.x * 11 - n.x * 5},${b.y - u.y * 11 - n.y * 5}`}
            fill={stroke}
          />
        )}
        {marks}
        {s.label && <TexLabel x={mid.x + n.x * 14 * side} y={mid.y + n.y * 14 * side} tex={live(s.label)} />}
      </g>
    );
  };

  const angle = (a: DiagramSpec["angles"] extends (infer T)[] | undefined ? T : never, i: number) => {
    const v = scr(a.at);
    const f = scr(a.from);
    const t = scr(a.to);
    // Screen angles, measured with y down.
    const af = Math.atan2(f.y - v.y, f.x - v.x);
    const delta = turn(af, Math.atan2(t.y - v.y, t.x - v.x), a.reflex);
    const stroke = color(a.color, "var(--accent)");
    const mid = af + delta / 2;
    let shape;
    if (a.right) {
      const s = 12;
      const u1 = { x: Math.cos(af) * s, y: Math.sin(af) * s };
      const u2 = { x: Math.cos(af + delta) * s, y: Math.sin(af + delta) * s };
      shape = <polyline points={`${v.x + u1.x},${v.y + u1.y} ${v.x + u1.x + u2.x},${v.y + u1.y + u2.y} ${v.x + u2.x},${v.y + u2.y}`} fill="none" stroke={stroke} strokeWidth={1.6} />;
    } else {
      shape = Array.from({ length: a.arcs ?? 1 }, (_, k) => (
        <path key={k} d={arcPath(v, 20 + k * 4, af, delta)} fill="none" stroke={stroke} strokeWidth={1.6} />
      ));
    }
    const lr = 20 + ((a.arcs ?? 1) - 1) * 4 + 16;
    return (
      <g key={`a${i}`}>
        {shape}
        {a.label && <TexLabel x={v.x + lr * Math.cos(mid)} y={v.y + lr * Math.sin(mid)} tex={live(a.label)} color={stroke} />}
      </g>
    );
  };

  /** Screen-space arc around c of radius r from angle a, turning by delta (y down). */
  const arcPath = (c: Vec, r: number, a: number, delta: number) => {
    const p1 = { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
    const p2 = { x: c.x + r * Math.cos(a + delta), y: c.y + r * Math.sin(a + delta) };
    return `M${p1.x},${p1.y} A${r},${r} 0 ${Math.abs(delta) > Math.PI ? 1 : 0} ${delta > 0 ? 1 : 0} ${p2.x},${p2.y}`;
  };
  /** The turn from direction a to direction b: the smaller one, or the larger if `major`. */
  const turn = (a: number, b: number, major?: boolean) => {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    return major ? (d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI) : d;
  };

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full" style={{ maxWidth: W }} role="img" aria-label={caption ?? "Diagram"}>
        <defs>
          <clipPath id={clip}>
            <rect x={M / 2} y={M / 2} width={W - M} height={H - M} />
          </clipPath>
        </defs>
        {grid && gridLines()}
        <g clipPath={`url(#${clip})`}>
          {polygons.map((p, i) => (
            <polygon
              key={`poly${i}`}
              points={p.points.map((n) => `${scr(n).x},${scr(n).y}`).join(" ")}
              fill={p.fill ? SERIES[p.fill] : "none"}
              fillOpacity={0.14}
              stroke="var(--ink)"
              strokeWidth={2}
              strokeDasharray={p.dashed ? "6 5" : undefined}
              strokeLinejoin="round"
            />
          ))}
          {circles.map((c, i) => (
            <circle
              key={`c${i}`}
              cx={scr(c.center).x}
              cy={scr(c.center).y}
              r={num(c.radius) * unit}
              fill={c.fill ? SERIES[c.fill] : "none"}
              fillOpacity={0.12}
              stroke={color(c.color)}
              strokeWidth={2}
              strokeDasharray={c.dashed ? "6 5" : undefined}
            />
          ))}
          {arcs.map((a, i) => {
            const c = scr(a.center);
            const f = scr(a.from);
            const t = scr(a.to);
            const af = Math.atan2(f.y - c.y, f.x - c.x);
            const delta = turn(af, Math.atan2(t.y - c.y, t.x - c.x), a.major);
            return (
              <path
                key={`arc${i}`}
                d={arcPath(c, Math.hypot(f.x - c.x, f.y - c.y), af, delta)}
                fill="none"
                stroke={color(a.color, "var(--area-2)")}
                strokeWidth={3}
                strokeDasharray={a.dashed ? "6 5" : undefined}
              />
            );
          })}
          {segments.map(segment)}
          {angles.map(angle)}
        </g>
        {points.map((p) => {
          const s = scr(p.name);
          const [dx, dy] = DIRS[p.dir ?? "ne"];
          return (
            <g key={p.name}>
              {!p.hidden && <circle cx={s.x} cy={s.y} r={3.5} fill="var(--ink)" />}
              {p.label !== "" && (
                <TexLabel
                  x={s.x + dx * (dx ? 8 : 14)}
                  y={s.y + dy * 14}
                  tex={live(p.label ?? p.name)}
                  anchor={dx > 0 ? "start" : dx < 0 ? "end" : "middle"}
                />
              )}
            </g>
          );
        })}
        {labels.map((l, i) => (
          <TexLabel key={`l${i}`} x={sx(num(l.x))} y={sy(num(l.y))} tex={live(l.text)} />
        ))}
      </svg>
      {readouts.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[15px]">
          {readouts.map((r, i) => (
            <Tex key={i} math={`${r.label} = ${fmt(num(r.value))}${r.unit ?? ""}`} />
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
