import { frac, fracTex, gcd } from "../../math/random";
import { md, slug, type DiagramSpec, type Generator, type SeriesColor, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** k pi / n reduced, as typed-answer text: "5pi/6", "2pi", "pi", "-pi/4". */
function piText(k: number, n: number): string {
  if (n < 0) [k, n] = [-k, -n];
  const g = gcd(k, n) || 1;
  k /= g;
  n /= g;
  if (k === 0) return "0";
  const num = k === 1 ? "pi" : k === -1 ? "-pi" : `${k}pi`;
  return n === 1 ? num : `${num}/${n}`;
}

/** k pi / n reduced, as LaTeX: \frac{5\pi}{6}, 2\pi, \pi, -\frac{\pi}{4}. */
function piTex(k: number, n: number): string {
  if (n < 0) [k, n] = [-k, -n];
  const g = gcd(k, n) || 1;
  k /= g;
  n /= g;
  if (k === 0) return "0";
  const sign = k < 0 ? "-" : "";
  const a = Math.abs(k);
  const num = a === 1 ? "\\pi" : `${a}\\pi`;
  return n === 1 ? `${sign}${num}` : `${sign}\\frac{${num}}{${n}}`;
}

/** A decimal rounded to `places`, as answer text. */
const fixed = (x: number, places: number) => x.toFixed(places);

/**
 * An arc around the origin O from angle 0 to the angle `a` (radians, an expression in
 * slider names), at radius `rad`. Drawn in two halves so it can run past a half turn.
 */
function sweep(prefix: string, rad: number | string, a: string, color: SeriesColor): Pick<DiagramSpec, "points" | "arcs"> {
  const pt = (name: string, ang: string) => ({ name, x: `(${rad})*cos(${ang})`, y: `(${rad})*sin(${ang})`, hidden: true, label: "" });
  return {
    points: [pt(`${prefix}0`, "0"), pt(`${prefix}1`, `(${a})/2`), pt(`${prefix}2`, a)],
    arcs: [
      { center: "O", from: `${prefix}0`, to: `${prefix}1`, color },
      { center: "O", from: `${prefix}1`, to: `${prefix}2`, color },
    ],
  };
}

// ── Diagrams ────────────────────────────────────────────────────────────────

const standardPositionDiagram: DiagramSpec = (() => {
  const s = sweep("S", 1.3, "t*pi/180", 2);
  return {
    view: [-5, 5, -5, 5],
    grid: true,
    params: [{ name: "t", tex: md`\theta`, min: -350, max: 350, step: 5, value: 120 }],
    points: [
      { name: "O", x: 0, y: 0, label: "", hidden: true },
      { name: "I", x: 4.5, y: 0, label: "", hidden: true },
      { name: "P", x: "4*cos(t*pi/180)", y: "4*sin(t*pi/180)", label: "" },
      ...s.points!,
    ],
    segments: [
      { from: "O", to: "I", kind: "ray" },
      { from: "O", to: "P", arrow: true, color: 2 },
    ],
    arcs: s.arcs,
    labels: [
      { x: 3.1, y: -0.45, text: md`\text{initial side}` },
      { x: "4.7*cos(t*pi/180)", y: "4.7*sin(t*pi/180)", text: md`P` },
      { x: "2.1*cos(t*pi/360)", y: "2.1*sin(t*pi/360)", text: md`{t}^\circ` },
    ],
    readouts: [
      { label: md`\theta \text{ as a fraction of a turn}`, value: "t/360" },
      { label: md`\theta \text{ in radians}`, value: "t*pi/180" },
    ],
    caption: md`An angle in standard position. Slide $\theta$ past $180^\circ$ and below $0^\circ$: the orange arrow shows the terminal side, and the arc shows how far, and which way, it turned to get there.`,
  };
})();

const unwrapDiagram: DiagramSpec = (() => {
  const s = sweep("S", 3, "t", 2);
  const ticks = [1, 2, 3, 4, 5, 6].map((k) => ({ x: 3.45 * Math.cos(k), y: 3.45 * Math.sin(k), text: String(k) }));
  return {
    view: [-5, 5, -5.2, 4.8],
    params: [{ name: "t", tex: md`\theta`, min: 0.05, max: 6.25, step: 0.05, value: 1 }],
    points: [
      { name: "O", x: 0, y: 0, dir: "sw" },
      { name: "A", x: 3, y: 0, dir: "se" },
      { name: "P", x: "3*cos(t)", y: "3*sin(t)", label: "" },
      { name: "R1", x: -1.5, y: -4.4, label: "", hidden: true },
      { name: "R2", x: 1.5, y: -4.4, label: "", hidden: true },
      ...s.points!,
    ],
    circles: [{ center: "O", radius: 3, dashed: true }],
    segments: [
      { from: "O", to: "A", label: "r = 3" },
      { from: "O", to: "P", color: 2 },
      { from: "R1", to: "R2", color: 2, ticks: 1, label: md`\text{one radius}` },
    ],
    arcs: s.arcs,
    labels: [...ticks, { x: "3.9*cos(t)", y: "3.9*sin(t)", text: md`P` }],
    readouts: [
      { label: md`\text{arc } s`, value: "3t" },
      { label: md`s / r`, value: "t" },
    ],
    caption: md`Slide $\theta$. At $\theta = 1$ the orange arc from $A$ to $P$ is exactly one radius long: that is one radian. The small numbers mark 1, 2, 3, ... radii around the circle. A little more than six of them fit in a full turn.`,
  };
})();

const sectorDiagram: DiagramSpec = (() => {
  const N = 16;
  const wedge = Array.from({ length: N + 1 }, (_, k) => ({ name: `W${k}`, x: `r*cos(t*${k}/${N})`, y: `r*sin(t*${k}/${N})`, hidden: true, label: "" }));
  const s = sweep("S", "r", "t", 2);
  return {
    view: [-5, 5, -5, 5],
    params: [
      { name: "r", tex: "r", min: 1, max: 4, step: 0.5, value: 3 },
      { name: "t", tex: md`\theta`, min: 0.1, max: 6.2, step: 0.1, value: 1.2 },
    ],
    points: [{ name: "O", x: 0, y: 0, dir: "sw" }, { name: "A", x: "r", y: 0, label: "" }, { name: "P", x: "r*cos(t)", y: "r*sin(t)", label: "" }, ...wedge, ...s.points!],
    circles: [{ center: "O", radius: "r", dashed: true }],
    polygons: [{ points: ["O", ...wedge.map((w) => w.name)], fill: 2 }],
    segments: [
      { from: "O", to: "A", label: "r" },
      { from: "O", to: "P" },
    ],
    arcs: s.arcs,
    angles: [{ at: "O", from: "A", to: "P", label: md`\theta` }],
    readouts: [
      { label: md`\theta / 2\pi \text{ (fraction of the circle)}`, value: "t/(2pi)" },
      { label: md`s = r\theta`, value: "r*t" },
      { label: md`A = \tfrac12 r^2 \theta`, value: "r^2*t/2" },
    ],
    caption: md`A sector with radius $r$ and central angle $\theta$. Its arc and its area are both the same fraction of the whole circle: $\theta / 2\pi$.`,
  };
})();

const wheelDiagram: DiagramSpec = (() => {
  const inner = sweep("I", 2, "t", 1);
  const outer = sweep("E", 4, "t", 2);
  return {
    view: [-5.2, 5.2, -5, 5],
    params: [{ name: "t", tex: md`\theta`, min: 0.1, max: 6.2, step: 0.1, value: 1.5 }],
    points: [
      { name: "O", x: 0, y: 0, dir: "sw" },
      { name: "A", x: 4, y: 0, label: "", hidden: true },
      { name: "P", x: "2*cos(t)", y: "2*sin(t)", label: "" },
      { name: "Q", x: "4*cos(t)", y: "4*sin(t)", label: "" },
      ...inner.points!,
      ...outer.points!,
    ],
    circles: [
      { center: "O", radius: 2, dashed: true },
      { center: "O", radius: 4, dashed: true },
    ],
    segments: [
      { from: "O", to: "A", dashed: true },
      { from: "O", to: "Q" },
    ],
    arcs: [...inner.arcs!, ...outer.arcs!],
    labels: [
      { x: "2.4*cos(t)", y: "2.4*sin(t)", text: md`P` },
      { x: "4.5*cos(t)", y: "4.5*sin(t)", text: md`Q` },
    ],
    readouts: [
      { label: md`\text{distance } P \text{ travels } (r = 2)`, value: "2t" },
      { label: md`\text{distance } Q \text{ travels } (r = 4)`, value: "4t" },
    ],
    caption: md`One spoke, two points. Turn the wheel through $\theta$: $P$ and $Q$ turn through the same angle in the same time, but $Q$, twice as far out, travels twice as far along its arc.`,
  };
})();

// ── Practice generators: Degrees and radians ────────────────────────────────

/** Friendly degree measures in (0, 360) with exact radian forms. */
const NICE_DEGREES = [30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 36, 72, 108, 144, 20, 40, 80, 100, 160, 200];
/** Friendly radian measures k pi / n in (0, 2 pi), as [k, n]. */
const NICE_RADIANS: [number, number][] = [
  [1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [5, 6], [1, 1], [7, 6], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [11, 6],
  [1, 5], [2, 5], [3, 5], [4, 5], [1, 12], [5, 12], [7, 12], [11, 12], [1, 9], [2, 9], [4, 9], [5, 9],
];

const convertExact: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const d = r.pick(NICE_DEGREES);
    const g = gcd(d, 180);
    return {
      prompt: md`Convert $${d}^\circ$ to radians. Give the exact answer in terms of $\pi$, typed like 5pi/6.`,
      answer: piText(d, 180),
      simplified: true,
      verify: [`t/(2pi) = ${d}/360`],
      hint: md`$180^\circ = \pi$ radians, so multiply by $\frac{\pi}{180}$ and reduce the fraction.`,
      solution: [
        { math: md`${d}^\circ = ${d} \cdot \frac{\pi}{180}`, note: md`Each degree is $\frac{\pi}{180}$ radians.` },
        { math: md`= \frac{${d}\pi}{180}`, note: md`${d} and 180 share a factor of ${g}.` },
        { math: md`= ${piTex(d, 180)}`, note: md`Check: $${d}$ is $\frac{${d}}{180} = ${fracTex(d, 180)}$ of a half turn, and so is $${piTex(d, 180)}$ of $\pi$.` },
      ],
    };
  }
  if (kind === 1) {
    const [k, n] = r.pick(NICE_RADIANS);
    const d = (180 * k) / n;
    return {
      prompt: md`Convert $${piTex(k, n)}$ radians to degrees. Answer with the number of degrees.`,
      answer: String(d),
      verify: [`d/360 = (${piText(k, n)})/(2pi)`],
      hint: md`$\pi$ radians is $180^\circ$, so replace $\pi$ with $180$.`,
      solution: [
        { math: md`${piTex(k, n)} = ${fracTex(k, n)} \cdot \pi`, note: md`The angle is $${fracTex(k, n)}$ of a half turn.` },
        { math: md`= ${fracTex(k, n)} \cdot 180^\circ`, note: md`A half turn is $180^\circ$.` },
        { math: md`= ${d}^\circ`, note: n === 1 ? "" : md`$180 \div ${n} = ${180 / n}$, then times $${k}$.` },
      ],
    };
  }
  // A negative angle or one past a full turn: the same conversion, no new idea.
  const base = r.pick([30, 45, 60, 90, 120, 135, 150, 210, 240, 270, 300]);
  const d = r.next() < 0.5 ? -base : base + 360;
  return {
    prompt: md`Convert $${d}^\circ$ to radians. Give the exact answer in terms of $\pi$, typed like -5pi/6 or 7pi/3.`,
    answer: piText(d, 180),
    simplified: true,
    verify: [`t/(2pi) = ${d}/360`],
    hint: md`The conversion factor is the same for every angle: multiply by $\frac{\pi}{180}$. Negative stays negative; more than $360^\circ$ gives more than $2\pi$.`,
    solution: [
      { math: md`${d} \cdot \frac{\pi}{180} = \frac{${d}\pi}{180}`, note: md`Multiply by $\frac{\pi}{180}$.` },
      { math: md`= ${piTex(d, 180)}`, note: md`Reduce by ${gcd(d, 180)}. ${d < 0 ? "A clockwise angle has a negative radian measure too." : `Past a full turn, so past $2\\pi$.`}` },
    ],
  };
};

const coterminal: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const base = r.pick(NICE_DEGREES);
    const k = r.pick([-2, -1, 1, 2]);
    const given = base + 360 * k;
    return {
      prompt: md`Find the angle between $0^\circ$ and $360^\circ$ that is coterminal with $${given}^\circ$. Answer with the number of degrees.`,
      answer: String(base),
      verify: [`cos(t*pi/180) = cos(${given}*pi/180)`, `sin(t*pi/180) = sin(${given}*pi/180)`],
      hint: md`Coterminal angles differ by whole turns of $360^\circ$. ${k > 0 ? "Subtract" : "Add"} $360^\circ$ until the angle lands in $[0^\circ, 360^\circ)$.`,
      solution: [
        { math: md`${given}^\circ ${k > 0 ? "-" : "+"} ${Math.abs(k)} \cdot 360^\circ`, note: md`${Math.abs(k) === 1 ? "One full turn" : "Two full turns"} ${k > 0 ? "too many" : "short"}: ${k > 0 ? "take them off" : "add them on"}.` },
        { math: md`= ${base}^\circ`, note: md`Same terminal side, now measured within one turn.` },
      ],
    };
  }
  if (kind === 1) {
    const [k, n] = r.pick(NICE_RADIANS);
    const m = r.pick([-2, -1, 1, 2]);
    // k/n + 2m = (k + 2 m n)/n
    const gk = k + 2 * m * n;
    return {
      prompt: md`Find the angle in $[0, 2\pi)$ that is coterminal with $${piTex(gk, n)}$. Give the exact answer in terms of $\pi$, typed like 5pi/6.`,
      answer: piText(k, n),
      simplified: true,
      verify: [`cos(t) = cos(${piText(gk, n)})`, `sin(t) = sin(${piText(gk, n)})`],
      hint: md`A full turn is $2\pi = ${piTex(2 * n, n)}$ with this denominator. ${m > 0 ? "Subtract" : "Add"} it until the angle is between $0$ and $2\pi$.`,
      solution: [
        { math: md`2\pi = \frac{${2 * n}\pi}{${n}}`, note: md`Write a full turn over the same denominator.` },
        { math: md`${piTex(gk, n)} ${m > 0 ? "-" : "+"} ${Math.abs(m) === 1 ? "" : `${Math.abs(m)} \\cdot `}\frac{${2 * n}\pi}{${n}} = \frac{${k}\pi}{${n}}`, note: md`${Math.abs(m) === 1 ? "One" : "Two"} full turn${Math.abs(m) === 1 ? "" : "s"} ${m > 0 ? "removed" : "added"}.` },
        { math: md`= ${piTex(k, n)}`, note: gcd(k, n) === 1 ? md`Already in lowest terms, and between $0$ and $2\pi$.` : md`Reduce the fraction.` },
      ],
    };
  }
  const given = r.pick(NICE_DEGREES);
  return {
    prompt: md`Find the angle between $-360^\circ$ and $0^\circ$ that is coterminal with $${given}^\circ$. Answer with the number of degrees.`,
    answer: String(given - 360),
    verify: [`cos(t*pi/180) = cos(${given}*pi/180)`, `sin(t*pi/180) = sin(${given}*pi/180)`],
    hint: md`Going clockwise to the same terminal side covers the rest of the turn: subtract $360^\circ$.`,
    solution: [
      { math: md`${given}^\circ - 360^\circ = ${given - 360}^\circ`, note: md`Counterclockwise $${given}^\circ$ and clockwise $${360 - given}^\circ$ end on the same ray.` },
    ],
  };
};

const convertDecimal: Generator = (r) => {
  if (r.next() < 0.5) {
    const t = r.pick([0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6]);
    const d = (t * 180) / Math.PI;
    return {
      prompt: md`Convert $${t}$ radians to degrees. Round to one decimal place.`,
      answer: fixed(d, 1),
      tolerance: 0.05,
      hint: md`One radian is $\frac{180}{\pi} \approx 57.3^\circ$. Multiply by $\frac{180}{\pi}$.`,
      solution: [
        { math: md`${t} \cdot \frac{180}{\pi} = \frac{${t * 180}}{\pi}`, note: md`Radians to degrees: multiply by $\frac{180}{\pi}$.` },
        { math: md`\approx ${fixed(d, 1)}^\circ`, note: md`$\pi \approx 3.14159$. Sanity check: ${t} radians is about ${t} times $57.3^\circ$.` },
      ],
    };
  }
  const d = r.pick([25, 35, 50, 65, 70, 75, 80, 95, 110, 125, 140, 160, 200, 250, 310]);
  const t = (d * Math.PI) / 180;
  return {
    prompt: md`Convert $${d}^\circ$ to radians as a decimal. Round to three decimal places.`,
    answer: fixed(t, 3),
    tolerance: 0.0005,
    hint: md`Multiply by $\frac{\pi}{180} \approx 0.01745$.`,
    solution: [
      { math: md`${d} \cdot \frac{\pi}{180} = \frac{${d}\pi}{180}`, note: md`Degrees to radians: multiply by $\frac{\pi}{180}$.` },
      { math: md`\approx ${fixed(t, 3)}`, note: md`Sanity check: $${d}^\circ$ is $${fixed(d / 180, 2)}$ of a half turn, and $${fixed(d / 180, 2)} \cdot 3.14 \approx ${fixed((d / 180) * 3.14, 2)}$.` },
    ],
  };
};

// ── Practice generators: Arc length and sector area ─────────────────────────

/** Radii that make r * k / n a whole number for the chosen denominator. */
const radiusFor = (r: { int: (a: number, b: number) => number }, n: number) => n * r.int(1, Math.max(1, Math.floor(12 / n)));

const arcLength: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [k, n] = r.pick<[number, number]>([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 6], [5, 6], [3, 2], [5, 4], [7, 6], [4, 3], [5, 3]]);
    const rad = radiusFor(r, n);
    return {
      prompt: md`A circle has radius $${rad}$. Find the length of the arc cut off by a central angle of $${piTex(k, n)}$ radians. Give the exact answer in terms of $\pi$, typed like 3pi or 5pi/2.`,
      answer: piText(rad * k, n),
      simplified: true,
      verify: [`s/${rad} = ${piText(k, n)}`],
      hint: md`$s = r\theta$ when $\theta$ is in radians. That is just the definition $\theta = s/r$ turned around.`,
      solution: [
        { math: md`s = r\theta = ${rad} \cdot ${piTex(k, n)}`, note: md`The angle is already in radians, so substitute directly.` },
        { math: md`= ${piTex(rad * k, n)}`, note: md`$${rad} \div ${n} = ${rad / n}$, then times $${k}\pi$.` },
      ],
    };
  }
  if (kind === 1) {
    const rad = r.int(2, 12);
    const t = r.pick([0.5, 1, 1.5, 2, 2.5, 3]);
    const s = rad * t;
    return {
      prompt: md`A circle has radius $${rad}$ cm. Find the length of the arc cut off by a central angle of $${t}$ radians, in cm.`,
      answer: frac(rad * t * 2, 2),
      verify: [`s/${rad} = ${t}`],
      hint: md`An angle of $1$ radian cuts off an arc of one radius. An angle of $${t}$ radians cuts off $${t}$ radii.`,
      solution: [
        { math: md`s = r\theta = ${rad} \cdot ${t}`, note: md`Radians are ratios, so this is plain multiplication.` },
        { math: md`= ${s} \text{ cm}`, note: md`The arc is $${t}$ times the radius.` },
      ],
    };
  }
  const d = r.pick([30, 45, 60, 90, 120, 135, 150, 180, 240, 270, 300, 36, 72]);
  const rad = r.int(2, 12);
  const g = gcd(d, 360);
  return {
    prompt: md`A circle has radius $${rad}$. Find the length of the arc cut off by a central angle of $${d}^\circ$. Give the exact answer in terms of $\pi$, typed like 3pi or 5pi/2.`,
    answer: piText(2 * rad * d, 360),
    simplified: true,
    verify: [`s/(2pi*${rad}) = ${d}/360`],
    hint: md`Either convert to radians first, or take the fraction $\frac{${d}}{360}$ of the whole circumference $2\pi r$.`,
    solution: [
      { math: md`\frac{${d}}{360} = ${fracTex(d, 360)}`, note: md`The angle is this fraction of a full turn.` },
      { math: md`s = ${fracTex(d, 360)} \cdot 2\pi \cdot ${rad}`, note: md`The same fraction of the circumference. (Or: $${d}^\circ = ${piTex(d, 180)}$ and $s = r\theta$.)` },
      { math: md`= ${piTex(2 * rad * d, 360)}`, note: g === 360 ? "" : md`Multiply out and reduce.` },
    ],
  };
};

const sectorArea: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [k, n] = r.pick<[number, number]>([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 6], [5, 6], [3, 2], [5, 4], [7, 6], [4, 3], [5, 3]]);
    const rad = r.int(2, 12);
    return {
      prompt: md`Find the area of a sector with radius $${rad}$ and central angle $${piTex(k, n)}$ radians. Give the exact answer in terms of $\pi$, typed like 6pi or 27pi/4.`,
      answer: piText(rad * rad * k, 2 * n),
      simplified: true,
      verify: [`A/(pi*${rad}^2) = (${piText(k, n)})/(2pi)`],
      hint: md`$A = \tfrac12 r^2 \theta$ with $\theta$ in radians.`,
      solution: [
        { math: md`A = \tfrac12 r^2 \theta = \tfrac12 \cdot ${rad}^2 \cdot ${piTex(k, n)}`, note: md`Substitute. The angle is already in radians.` },
        { math: md`= \tfrac12 \cdot ${rad * rad} \cdot ${piTex(k, n)} = ${piTex(rad * rad * k, 2 * n)}`, note: md`Check against the circle: the sector is $${fracTex(k, 2 * n)}$ of $${rad * rad}\pi$.` },
      ],
    };
  }
  if (kind === 1) {
    const d = r.pick([30, 45, 60, 90, 120, 135, 150, 180, 240, 270, 300, 36, 72]);
    const rad = r.int(2, 12);
    return {
      prompt: md`Find the area of a sector with radius $${rad}$ and central angle $${d}^\circ$. Give the exact answer in terms of $\pi$, typed like 6pi or 27pi/4.`,
      answer: piText(d * rad * rad, 360),
      simplified: true,
      verify: [`A/(pi*${rad}^2) = ${d}/360`],
      hint: md`A sector is a fraction of the whole circle. Which fraction of $360^\circ$ is $${d}^\circ$?`,
      solution: [
        { math: md`\frac{${d}}{360} = ${fracTex(d, 360)}`, note: md`The fraction of the circle.` },
        { math: md`A = ${fracTex(d, 360)} \cdot \pi \cdot ${rad}^2`, note: md`The same fraction of the full area $\pi r^2$.` },
        { math: md`= ${piTex(d * rad * rad, 360)}`, note: md`Multiply out and reduce.` },
      ],
    };
  }
  const rad = r.pick([2, 4, 6, 8, 10]);
  const t2 = r.int(1, 6); // theta = t2 / 2
  const A = ((rad * rad) / 2) * (t2 / 2);
  return {
    prompt: md`A sector of a circle with radius $${rad}$ has area $${A}$. Find its central angle in radians.`,
    answer: frac(t2, 2),
    simplified: true,
    verify: [`${A}/(pi*${rad}^2) = t/(2pi)`],
    hint: md`Solve $\tfrac12 r^2 \theta = A$ for $\theta$: divide the area by $\tfrac12 r^2$.`,
    solution: [
      { math: md`\tfrac12 \cdot ${rad}^2 \cdot \theta = ${A}`, note: md`The sector area formula with what we know filled in.` },
      { math: md`${(rad * rad) / 2}\theta = ${A}`, note: md`$\tfrac12 \cdot ${rad * rad} = ${(rad * rad) / 2}$.` },
      { math: md`\theta = \frac{${A}}{${(rad * rad) / 2}} = ${fracTex(t2, 2)}`, note: md`A pure number: radians.` },
    ],
  };
};

const arcsApplied: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [k, n] = r.pick<[number, number]>([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 6], [5, 6], [3, 2], [5, 4], [7, 6], [4, 3], [5, 3]]);
    const rad = r.int(2, 12);
    const sTex = piTex(rad * k, n);
    return {
      prompt: md`An arc of length $${sTex}$ subtends a central angle of $${piTex(k, n)}$ radians. Find the radius of the circle.`,
      answer: String(rad),
      verify: [`(${piText(rad * k, n)})/r = ${piText(k, n)}`],
      hint: md`$\theta = s/r$, so $r = s/\theta$. The $\pi$'s cancel.`,
      solution: [
        { math: md`r = \frac{s}{\theta} = \frac{${sTex}}{${piTex(k, n)}}`, note: md`Turn the definition around.` },
        { math: md`= ${fracTex(rad * k, n)} \cdot ${fracTex(n, k)} = ${rad}`, note: md`Dividing by a fraction is multiplying by its reciprocal; $\pi$ cancels.` },
      ],
    };
  }
  if (kind === 1) {
    const kind2 = r.int(0, 1);
    if (kind2 === 0) {
      const len = r.pick([6, 8, 9, 10, 12, 15]);
      const mins = r.pick([10, 15, 20, 25, 40, 45, 50]);
      return {
        prompt: md`The minute hand of a clock is $${len}$ cm long. How far does its tip travel in $${mins}$ minutes? Give the exact answer in cm, in terms of $\pi$, typed like 10pi or 15pi/2.`,
        answer: piText(2 * len * mins, 60),
        simplified: true,
        verify: [`s/(2pi*${len}) = ${mins}/60`],
        hint: md`In 60 minutes the tip goes once around a circle of radius $${len}$. In $${mins}$ minutes it covers $\frac{${mins}}{60}$ of that circumference.`,
        solution: [
          { math: md`\theta = \frac{${mins}}{60} \cdot 2\pi = ${piTex(2 * mins, 60)}`, note: md`The angle turned, in radians.` },
          { math: md`s = r\theta = ${len} \cdot ${piTex(2 * mins, 60)} = ${piTex(2 * len * mins, 60)} \text{ cm}`, note: md`Arc length from the radian definition.` },
        ],
      };
    }
    const diam = r.pick([20, 24, 30, 32, 36, 40]);
    const slices = r.pick([6, 8, 10, 12]);
    const rad = diam / 2;
    return {
      prompt: md`A round pizza $${diam}$ cm across is cut into $${slices}$ equal slices from the center. Find the area of one slice. Give the exact answer in cm$^2$, in terms of $\pi$, typed like 50pi or 75pi/2.`,
      answer: piText(rad * rad, slices),
      simplified: true,
      verify: [`A/(pi*${rad}^2) = 1/${slices}`],
      hint: md`The radius is half of $${diam}$. Each slice is $\frac{1}{${slices}}$ of the whole circle, so it is $\frac{1}{${slices}}$ of $\pi r^2$.`,
      solution: [
        { math: md`r = ${rad}, \qquad \theta = \frac{2\pi}{${slices}} = ${piTex(2, slices)}`, note: md`Each slice's central angle is a $${slices}$th of a full turn.` },
        { math: md`A = \tfrac12 r^2\theta = \tfrac12 \cdot ${rad * rad} \cdot ${piTex(2, slices)} = ${piTex(rad * rad, slices)} \text{ cm}^2`, note: md`Equivalently, $\frac{1}{${slices}}$ of $${rad * rad}\pi$.` },
      ],
    };
  }
  const len = r.pick([60, 70, 75, 80, 90, 100, 120]);
  const d = r.pick([12, 15, 18, 20, 24, 25, 28, 30, 35, 40]);
  const s = (len * d * Math.PI) / 180;
  return {
    prompt: md`A pendulum $${len}$ cm long swings through an angle of $${d}^\circ$. How far does the tip of the pendulum travel in one swing? Answer in cm, rounded to one decimal place.`,
    answer: fixed(s, 1),
    tolerance: 0.05,
    hint: md`The tip moves along an arc of radius $${len}$ cm. Convert $${d}^\circ$ to radians, then use $s = r\theta$.`,
    solution: [
      { math: md`\theta = ${d} \cdot \frac{\pi}{180} = ${piTex(d, 180)} \approx ${fixed((d * Math.PI) / 180, 4)}`, note: md`Degrees to radians first, because $s = r\theta$ needs a ratio.` },
      { math: md`s = ${len} \cdot ${piTex(d, 180)} = ${piTex(len * d, 180)} \approx ${fixed(s, 1)} \text{ cm}`, note: md`Arc length is radius times the angle in radians.` },
    ],
  };
};

// ── Practice generators: Angular speed ──────────────────────────────────────

const RPMS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 450, 600, 900, 1200];

const angularRates: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const rpm = r.pick(RPMS);
    return {
      prompt: md`A wheel turns at $${rpm}$ revolutions per minute. Find its angular speed in radians per second. Give the exact answer in terms of $\pi$, typed like 3pi/2.`,
      answer: piText(rpm, 30),
      simplified: true,
      verify: [`w*60/(2pi) = ${rpm}`],
      hint: md`One revolution is $2\pi$ radians, and one minute is 60 seconds.`,
      solution: [
        { math: md`${rpm} \frac{\text{rev}}{\text{min}} = ${rpm} \cdot \frac{2\pi \text{ rad}}{60 \text{ s}}`, note: md`Replace each revolution with $2\pi$ radians and each minute with $60$ seconds.` },
        { math: md`= \frac{${2 * rpm}\pi}{60} = ${piTex(rpm, 30)} \text{ rad/s}`, note: md`Reduce the fraction.` },
      ],
    };
  }
  if (kind === 1) {
    const [k, n] = r.pick<[number, number]>([[1, 2], [1, 3], [2, 3], [1, 1], [3, 2], [2, 1], [5, 2], [3, 1], [4, 1], [5, 1], [6, 1], [1, 5], [1, 6], [1, 10], [1, 15], [8, 3], [10, 3]]);
    const rpm = (30 * k) / n;
    return {
      prompt: md`A disc spins at $${piTex(k, n)}$ radians per second. Find its speed in revolutions per minute.`,
      answer: String(rpm),
      verify: [`r*2pi/60 = ${piText(k, n)}`],
      hint: md`Divide by $2\pi$ to count revolutions per second, then multiply by 60 for a minute.`,
      solution: [
        { math: md`\frac{${piTex(k, n)}}{2\pi} = ${fracTex(k, 2 * n)} \text{ rev/s}`, note: md`Radians per second divided by radians per revolution.` },
        { math: md`${fracTex(k, 2 * n)} \cdot 60 = ${rpm} \text{ rev/min}`, note: md`Sixty seconds in a minute.` },
      ],
    };
  }
  const [k, n] = r.pick<[number, number]>([[1, 2], [3, 2], [2, 3], [5, 6], [3, 4], [1, 1], [2, 1], [5, 4]]);
  const secs = r.pick([4, 6, 8, 10, 12, 20, 30]);
  return {
    prompt: md`A wheel turns at a steady $${piTex(k, n)}$ radians per second. Through what angle does it turn in $${secs}$ seconds? Give the exact answer in radians, in terms of $\pi$, typed like 12pi or 15pi/2.`,
    answer: piText(k * secs, n),
    simplified: true,
    verify: [`t/${secs} = ${piText(k, n)}`],
    hint: md`Angular speed is angle divided by time, so angle is angular speed times time.`,
    solution: [
      { math: md`\theta = \omega \cdot \text{time} = ${piTex(k, n)} \cdot ${secs}`, note: md`From $\omega = \theta / \text{time}$.` },
      { math: md`= ${piTex(k * secs, n)}`, note: md`That is $${fracTex(k * secs, 2 * n)}$ full revolutions.` },
    ],
  };
};

const linearSpeed: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const rad = r.int(2, 12);
    const w = r.pick([2, 3, 4, 5, 6, 8, 10, 1.5, 2.5]);
    return {
      prompt: md`A point on a wheel is $${rad}$ cm from the center. The wheel turns at $${w}$ radians per second. Find the point's speed in cm per second.`,
      answer: frac(rad * w * 2, 2),
      verify: [`v/${rad} = ${w}`],
      hint: md`$v = r\omega$: each radian of turning moves the point one radius along its circle.`,
      solution: [
        { math: md`v = r\omega = ${rad} \cdot ${w}`, note: md`Radians per second times the radius.` },
        { math: md`= ${rad * w} \text{ cm/s}`, note: md`Each second the point moves $${w}$ radii, each $${rad}$ cm long.` },
      ],
    };
  }
  if (kind === 1) {
    const rad = r.int(2, 12);
    const rpm = r.pick([15, 30, 45, 60, 90, 120, 150, 180, 240, 300]);
    return {
      prompt: md`A wheel of radius $${rad}$ cm turns at $${rpm}$ revolutions per minute. Find the speed of a point on its rim in cm per second. Give the exact answer in terms of $\pi$, typed like 20pi or 15pi/2.`,
      answer: piText(rad * rpm, 30),
      simplified: true,
      verify: [`v/(2pi*${rad}) = ${rpm}/60`],
      hint: md`First convert to radians per second ($\omega = ${rpm} \cdot 2\pi / 60$), then $v = r\omega$.`,
      solution: [
        { math: md`\omega = ${rpm} \cdot \frac{2\pi}{60} = ${piTex(rpm, 30)} \text{ rad/s}`, note: md`Revolutions to radians, minutes to seconds.` },
        { math: md`v = r\omega = ${rad} \cdot ${piTex(rpm, 30)} = ${piTex(rad * rpm, 30)} \text{ cm/s}`, note: md`Check: the rim travels one circumference $${2 * rad}\pi$ per revolution, and there are $${fracTex(rpm, 60)}$ revolutions each second.` },
      ],
    };
  }
  if (kind === 2) {
    const rad = r.pick([2, 3, 4, 5, 6, 8, 10, 12]);
    const w = r.pick([2, 3, 4, 5, 6, 1.5, 2.5, 0.5]);
    const v = rad * w;
    return {
      prompt: md`A point $${rad}$ m from the axis of a turning platform moves at $${v}$ m/s. Find the platform's angular speed in radians per second.`,
      answer: frac(w * 2, 2),
      verify: [`w*${rad} = ${v}`],
      hint: md`$v = r\omega$, so $\omega = v / r$.`,
      solution: [
        { math: md`\omega = \frac{v}{r} = \frac{${v}}{${rad}}`, note: md`Divide the linear speed by the radius.` },
        { math: md`= ${w} \text{ rad/s}`, note: md`Metres per second over metres leaves a pure number per second: radians per second.` },
      ],
    };
  }
  const w = r.pick([2, 3, 4, 5, 6, 8]);
  const rad = r.pick([2, 3, 4, 5, 6, 8, 10, 12]);
  const v = rad * w;
  return {
    prompt: md`A point on a spinning disc moves at $${v}$ cm/s while the disc turns at $${w}$ radians per second. How far is the point from the center, in cm?`,
    answer: String(rad),
    verify: [`${v}/r = ${w}`],
    hint: md`$v = r\omega$, so $r = v / \omega$.`,
    solution: [
      { math: md`r = \frac{v}{\omega} = \frac{${v}}{${w}}`, note: md`Divide the linear speed by the angular speed.` },
      { math: md`= ${rad} \text{ cm}`, note: md`The point travels $${w}$ radii each second, and $${w}$ radii is $${v}$ cm.` },
    ],
  };
};

const speedApplied: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const pairs: [number, number][] = [[4, 6], [6, 4], [3, 9], [9, 3], [5, 10], [10, 5], [8, 12], [12, 8], [6, 9], [9, 6], [4, 10], [10, 4]];
    const [r1, r2] = r.pick(pairs);
    const w1 = r.pick([30, 60, 90, 120, 180, 240, 300].filter((w) => ((w * r1) / r2) % 1 === 0));
    const w2 = (w1 * r1) / r2;
    return {
      prompt: md`Two pulleys are joined by a belt. The first has radius $${r1}$ cm and turns at $${w1}$ rpm; the second has radius $${r2}$ cm. How fast does the second pulley turn, in rpm?`,
      answer: String(w2),
      verify: [`${r1}*${w1} = ${r2}*w`],
      hint: md`The belt moves at one speed, so both rims have the same linear speed: $r_1 \omega_1 = r_2 \omega_2$. The units cancel, so rpm works directly.`,
      solution: [
        { math: md`r_1 \omega_1 = r_2 \omega_2`, note: md`Equal rim speeds, from $v = r\omega$ on each pulley.` },
        { math: md`${r1} \cdot ${w1} = ${r2} \cdot \omega_2`, note: md`Both sides use rpm, so the conversion factor to rad/s would cancel anyway.` },
        { math: md`\omega_2 = \frac{${r1 * w1}}{${r2}} = ${w2} \text{ rpm}`, note: md`The ${r2 > r1 ? "larger" : "smaller"} pulley turns ${r2 > r1 ? "slower" : "faster"}.` },
      ],
    };
  }
  if (kind === 1) {
    const rad = r.pick([0.25, 0.3, 0.32, 0.35, 0.4]);
    const v = r.pick([10, 12, 15, 18, 20, 24, 25, 30]);
    const w = v / rad;
    return {
      prompt: md`A car's tyres have radius $${rad}$ m. The car is moving at $${v}$ m/s. Find the angular speed of a tyre in radians per second, rounded to one decimal place.`,
      answer: fixed(w, 1),
      tolerance: 0.05,
      hint: md`The tyre's rim moves at the car's speed (it rolls without slipping), so $v = r\omega$ and $\omega = v/r$.`,
      solution: [
        { math: md`\omega = \frac{v}{r} = \frac{${v}}{${rad}}`, note: md`Linear speed over radius.` },
        { math: md`\approx ${fixed(w, 1)} \text{ rad/s}`, note: md`About $${fixed(w / (2 * Math.PI), 1)}$ revolutions per second.` },
      ],
    };
  }
  if (kind === 2) {
    const [k, n] = r.pick<[number, number]>([[1, 2], [2, 3], [4, 3], [1, 1], [3, 2], [2, 1], [5, 2], [4, 1], [5, 3], [1, 4], [3, 4], [8, 5]]);
    return {
      prompt: md`A turntable rotates at $${piTex(k, n)}$ radians per second. How many seconds does one full revolution take? Give an exact answer, as a fraction if needed.`,
      answer: frac(2 * n, k),
      simplified: true,
      verify: [`T*(${piText(k, n)}) = 2pi`],
      hint: md`One revolution is $2\pi$ radians. At $\omega$ radians per second it takes $2\pi / \omega$ seconds.`,
      solution: [
        { math: md`T = \frac{2\pi}{\omega} = \frac{2\pi}{${piTex(k, n)}}`, note: md`Angle to cover divided by angle per second.` },
        { math: md`= 2 \cdot ${fracTex(n, k)} = ${fracTex(2 * n, k)} \text{ s}`, note: md`The $\pi$'s cancel: the period never depends on $\pi$ once $\omega$ is written with $\pi$ in it.` },
      ],
    };
  }
  const rad = r.pick([30, 32, 33, 35, 36, 40]);
  const rpm = r.pick([90, 120, 150, 180, 200, 240]);
  const v = ((rad / 100) * rpm * 2 * Math.PI) / 60;
  return {
    prompt: md`A bicycle wheel has radius $${rad}$ cm and turns at $${rpm}$ rpm. How fast is the bicycle moving, in metres per second? Round to two decimal places.`,
    answer: fixed(v, 2),
    tolerance: 0.005,
    hint: md`The bicycle moves as fast as the rim of the wheel: $v = r\omega$. Convert the radius to metres and the rpm to radians per second.`,
    solution: [
      { math: md`\omega = ${rpm} \cdot \frac{2\pi}{60} = ${piTex(rpm, 30)} \text{ rad/s}`, note: md`Revolutions per minute to radians per second.` },
      { math: md`v = r\omega = ${rad / 100} \cdot ${piTex(rpm, 30)} \approx ${fixed(v, 2)} \text{ m/s}`, note: md`$${rad}$ cm is $${rad / 100}$ m.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "Angles",
  lessons: [
    {
      id: slug("Degrees and radians"),
      title: "Degrees and radians",
      summary: "Angles as rotations, and a unit of angle built from the circle itself.",
      blocks: [
        {
          kind: "text",
          body: md`In Geometry an angle was a shape: two rays with a common endpoint. Trigonometry needs more. It treats an angle as a **rotation**: start with one ray, turn it, and the angle is how far it turned. A rotation can go either way round, and it can go round more than once. Shapes can't do that; rotations can.

To compare angles we put them all in the same place. Put the vertex at the origin and the starting ray along the positive $x$-axis. That is **standard position**.`,
        },
        {
          kind: "key",
          title: "Standard position",
          body: md`An angle is in **standard position** when its vertex is at the origin and its **initial side** lies along the positive $x$-axis. The ray it turns to is the **terminal side**.

- Counterclockwise rotation is **positive**; clockwise is **negative**.
- Two angles are **coterminal** when they share the same terminal side. In degrees, coterminal angles differ by a multiple of $360^\circ$.`,
        },
        { kind: "diagram", ...standardPositionDiagram },
        {
          kind: "why",
          title: "Why coterminal angles differ by whole turns",
          body: md`Turn the terminal side through a full $360^\circ$ and it lands exactly where it started. So adding or subtracting $360^\circ$, any number of times, never changes where the terminal side points. Conversely, if two angles end on the same ray, the difference between them is some number of complete turns, so it is a multiple of $360^\circ$.

$400^\circ$, $40^\circ$ and $-320^\circ$ are all coterminal. Every angle has exactly one coterminal angle in $[0^\circ, 360^\circ)$: keep adding or subtracting full turns until you land there.`,
        },
        {
          kind: "text",
          body: md`Degrees work, but the number $360$ is a historical accident. The Babylonians liked it because it has so many divisors. Nothing about a circle says "360". If we want a unit of angle that comes from the circle itself, we should measure the angle by the **arc** it cuts out.

There is a snag. A $60^\circ$ angle cuts a short arc on a small circle and a long arc on a big one. The arc length alone can't be the measure. But the arc length *compared to the radius* can, because that ratio is the same on every circle.`,
        },
        {
          kind: "key",
          title: "Radian measure",
          body: md`Draw any circle centered at the vertex of the angle. If the angle cuts off an arc of length $s$ on a circle of radius $r$, its **radian measure** is

$$\theta = \frac{s}{r}.$$

One **radian** is the angle whose arc is exactly one radius long. A radian is a ratio of two lengths, so it is a pure number with no unit.`,
        },
        {
          kind: "why",
          title: "Why the ratio doesn't depend on the circle",
          body: md`All circles are similar (Geometry, Unit 7). Scale a circle of radius $r$ by a factor $k$: the radius becomes $kr$, and every arc on it is scaled by the same $k$, so the arc cut off by our angle becomes $ks$. The ratio is

$$\frac{ks}{kr} = \frac{s}{r}.$$

The $k$ cancels. Whatever circle you choose, the ratio $s/r$ comes out the same, so it really does measure the angle and nothing else.`,
        },
        { kind: "diagram", ...unwrapDiagram },
        {
          kind: "why",
          title: "Why a full turn is 2π radians",
          body: md`A full turn cuts off the whole circle, whose length is the circumference $C = 2\pi r$ (Geometry). By the definition,

$$\theta_{\text{full turn}} = \frac{s}{r} = \frac{2\pi r}{r} = 2\pi.$$

So $360^\circ = 2\pi$ radians, and a half turn is $180^\circ = \pi$ radians. That is the whole bridge between the two systems. Since $2\pi \approx 6.28$, a little more than six radii fit around any circle, which is what the diagram above shows.`,
        },
        {
          kind: "key",
          title: "Converting",
          body: md`From $180^\circ = \pi$ radians, divide both sides by $180$ or by $\pi$:

$$1^\circ = \frac{\pi}{180} \text{ radians}, \qquad 1 \text{ radian} = \frac{180^\circ}{\pi} \approx 57.3^\circ.$$

- Degrees to radians: multiply by $\dfrac{\pi}{180}$.
- Radians to degrees: multiply by $\dfrac{180}{\pi}$.

A radian measure with no unit written is just a number: "an angle of 2" means 2 radians.`,
        },
        {
          kind: "example",
          title: "Both directions",
          problem: md`Convert $150^\circ$ to radians, and $\frac{3\pi}{4}$ radians to degrees.`,
          steps: [
            { math: md`150^\circ = 150 \cdot \frac{\pi}{180} = \frac{150\pi}{180}`, note: md`Each degree is $\frac{\pi}{180}$.` },
            { math: md`= \frac{5\pi}{6}`, note: md`Reduce by 30. Sense check: $150^\circ$ is $\frac{5}{6}$ of a half turn, and $\frac{5\pi}{6}$ is $\frac{5}{6}$ of $\pi$.` },
            { math: md`\frac{3\pi}{4} = \frac{3}{4} \cdot \pi = \frac{3}{4} \cdot 180^\circ = 135^\circ`, note: md`Replace $\pi$ by $180^\circ$.` },
          ],
        },
        {
          kind: "text",
          body: md`The fastest way to think in radians is in **fractions of a half turn**. $\pi$ is a half turn, so $\frac{\pi}{2}$ is a quarter turn ($90^\circ$), $\frac{\pi}{3}$ is a third of a half turn ($60^\circ$), $\frac{\pi}{6}$ is a sixth ($30^\circ$), and $\frac{\pi}{4}$ is $45^\circ$. Multiples follow: $\frac{5\pi}{6}$ is five of the $30^\circ$ pieces, so $150^\circ$. These few angles will come up constantly, so it pays to know them both ways.`,
        },
        {
          kind: "example",
          title: "A coterminal angle in radians",
          problem: md`Find the angle in $[0, 2\pi)$ coterminal with $\frac{17\pi}{4}$.`,
          steps: [
            { math: md`2\pi = \frac{8\pi}{4}`, note: md`Write a full turn over the same denominator.` },
            { math: md`\frac{17\pi}{4} - \frac{8\pi}{4} = \frac{9\pi}{4}`, note: md`Still more than $2\pi$, so take off another turn.` },
            { math: md`\frac{9\pi}{4} - \frac{8\pi}{4} = \frac{\pi}{4}`, note: md`Now between $0$ and $2\pi$. The terminal side of $\frac{17\pi}{4}$ is the $45^\circ$ ray.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Convert $240^\circ$ to radians. Give the exact answer in terms of $\pi$, typed like 5pi/6.`,
          answer: "4pi/3",
          simplified: true,
          explain: md`$240 \cdot \frac{\pi}{180} = \frac{240\pi}{180} = \frac{4\pi}{3}$. Or: $240^\circ$ is four $60^\circ$ pieces, and each is $\frac{\pi}{3}$.`,
        },
        {
          kind: "check",
          prompt: md`Find the angle between $0^\circ$ and $360^\circ$ that is coterminal with $-150^\circ$. Answer with the number of degrees.`,
          answer: "210",
          explain: md`$-150^\circ$ is clockwise. Add one full turn: $-150^\circ + 360^\circ = 210^\circ$. Both end on the same ray in the third quadrant.`,
        },
      ],
      practice: [convertExact, coterminal, convertDecimal],
    },
    {
      id: slug("Arc length and sector area"),
      title: "Arc length and sector area",
      summary: "The arc and the area a central angle cuts out, derived as fractions of the circle.",
      blocks: [
        {
          kind: "text",
          body: md`The radian definition $\theta = s/r$ already contains the arc length formula. Multiply both sides by $r$ and you have it. Everything in this lesson is that one idea, plus the fact that a central angle cuts out the same fraction of the area as it does of the circumference.`,
        },
        {
          kind: "key",
          title: "Arc length",
          body: md`On a circle of radius $r$, a central angle of $\theta$ **radians** cuts off an arc of length

$$s = r\theta.$$

If the angle is given in degrees, convert it first, or use the fraction of the circle: $s = \dfrac{D}{360} \cdot 2\pi r$.`,
        },
        {
          kind: "why",
          title: "Why s = rθ, two ways",
          body: md`**From the definition.** $\theta = s/r$ is what radian measure means. Multiply both sides by $r$: $s = r\theta$.

**As a fraction of the circle.** An angle of $\theta$ radians is $\dfrac{\theta}{2\pi}$ of a full turn, because a full turn is $2\pi$. The arc is that same fraction of the whole circumference:

$$s = \frac{\theta}{2\pi} \cdot 2\pi r = r\theta.$$

Both routes agree, which is reassuring. The second one is the one that works in degrees too: replace $\frac{\theta}{2\pi}$ by $\frac{D}{360}$.`,
        },
        { kind: "diagram", ...sectorDiagram },
        {
          kind: "key",
          title: "Sector area",
          body: md`A **sector** is the pie-slice region between two radii and the arc they cut off. A sector with radius $r$ and central angle $\theta$ radians has area

$$A = \tfrac12 r^2 \theta.$$

In degrees: $A = \dfrac{D}{360} \cdot \pi r^2$.`,
        },
        {
          kind: "proof",
          title: "The sector area formula",
          given: md`A sector of a circle with radius $r$ and central angle $\theta$ radians`,
          prove: md`Its area is $A = \tfrac12 r^2 \theta$`,
          steps: [
            { statement: md`The whole circle has area $\pi r^2$.`, reason: "Area of a circle (Geometry, Unit 7)" },
            { statement: md`Sectors of the same circle with equal central angles have equal areas.`, reason: "A rotation about the center carries one onto the other, and rotations preserve area" },
            { statement: md`$n$ sectors each with central angle $\frac{2\pi}{n}$ fill the circle without overlap, so each has area $\frac{1}{n} \pi r^2$.`, reason: md`Step 2 and the whole circle being $n$ equal pieces` },
            { statement: md`A sector with central angle $\frac{m}{n} \cdot 2\pi$ has area $\frac{m}{n} \pi r^2$.`, reason: md`It is $m$ of the sectors in step 3 side by side` },
            { statement: md`A sector with central angle $\theta$ has area $\frac{\theta}{2\pi} \pi r^2$.`, reason: md`Step 4 gives this whenever $\frac{\theta}{2\pi}$ is a fraction; any angle is squeezed between fractions as close as we like, and area grows with the angle, so it holds for every $\theta$` },
            { statement: md`$A = \frac{\theta}{2\pi} \cdot \pi r^2 = \tfrac12 r^2 \theta$`, reason: "Cancel the $\\pi$ and simplify" },
          ],
        },
        {
          kind: "why",
          title: "Why it looks like a triangle formula",
          body: md`Since $s = r\theta$, the sector formula can be written $A = \tfrac12 r \cdot (r\theta) = \tfrac12 r s$. Compare a triangle: $\tfrac12 \cdot \text{base} \cdot \text{height}$. A sector is almost a triangle with base $s$ (the arc) and height $r$.

Why almost? Slice the sector into many thin wedges. Each wedge is very nearly a skinny triangle with its tip at the center, height $r$, and a tiny base along the arc. The areas of all those triangles add up to $\tfrac12 r \cdot (\text{total base}) = \tfrac12 r s$. The thinner the wedges, the better the match, and in the limit it is exact. That is the same picture that gives the circle's area as $\tfrac12 r \cdot 2\pi r = \pi r^2$.`,
        },
        {
          kind: "example",
          title: "Arc and area together",
          problem: md`A circle has radius $6$ cm. Find the arc length and the sector area for a central angle of $\frac{\pi}{3}$.`,
          steps: [
            { math: md`s = r\theta = 6 \cdot \frac{\pi}{3} = 2\pi \text{ cm}`, note: md`The angle is in radians, so substitute directly.` },
            { math: md`A = \tfrac12 r^2\theta = \tfrac12 \cdot 36 \cdot \frac{\pi}{3} = 6\pi \text{ cm}^2`, note: md`Check with the triangle form: $\tfrac12 r s = \tfrac12 \cdot 6 \cdot 2\pi = 6\pi$.` },
            { math: md`\frac{\pi/3}{2\pi} = \frac{1}{6}`, note: md`Sense check: the angle is a sixth of a turn, and $6\pi$ is a sixth of the full area $36\pi$.` },
          ],
        },
        {
          kind: "example",
          title: "An angle in degrees",
          problem: md`Find the length of the arc cut off by a $72^\circ$ central angle on a circle of radius $10$.`,
          steps: [
            { math: md`72^\circ = 72 \cdot \frac{\pi}{180} = \frac{2\pi}{5}`, note: md`Convert first. $s = r\theta$ needs the ratio, not the degree count.` },
            { math: md`s = 10 \cdot \frac{2\pi}{5} = 4\pi`, note: md`Or in one go: $\frac{72}{360} = \frac15$ of the circumference $20\pi$ is $4\pi$.` },
          ],
        },
        {
          kind: "why",
          title: "Why the formulas insist on radians",
          body: md`$s = r\theta$ came from $\theta = s/r$: the radian measure *is* the number of radii in the arc. A degree measure $D$ is not that ratio; it is $\frac{180}{\pi}$ times bigger ($57.3$ degrees per radius). Putting $D$ straight into $s = r\theta$ would give an arc about 57 times too long.

The same goes for $A = \tfrac12 r^2 \theta$ and, in the next lesson, for $v = r\omega$. Whenever an angle multiplies a length, it has to be in radians. That is the practical reason radians are the default in everything from here on.`,
        },
        {
          kind: "example",
          title: "Solving for the angle",
          problem: md`An arc of length $15$ on a circle of radius $6$ subtends what central angle?`,
          steps: [
            { math: md`\theta = \frac{s}{r} = \frac{15}{6} = \frac{5}{2}`, note: md`Straight from the definition. The answer is $2.5$ radians, a pure number.` },
            { math: md`\frac{5}{2} \cdot \frac{180}{\pi} \approx 143.2^\circ`, note: md`Only if degrees are wanted. Notice that this is messy; the radian answer was clean.` },
          ],
        },
        {
          kind: "text",
          body: md`**Units.** The arc $s$ has the same unit as $r$. The area has that unit squared. The angle $\theta$ has no unit at all, which is exactly why it can multiply a length and give a length. When a problem gives the angle in degrees, the $^\circ$ is a warning label: convert before you multiply.`,
        },
        {
          kind: "check",
          prompt: md`A circle has radius $4$. Find the arc length cut off by a central angle of $\frac{3\pi}{4}$. Give the exact answer in terms of $\pi$, typed like 3pi.`,
          answer: "3pi",
          simplified: true,
          explain: md`$s = r\theta = 4 \cdot \frac{3\pi}{4} = 3\pi$.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of a sector with radius $3$ and central angle $\frac{2\pi}{3}$. Give the exact answer in terms of $\pi$, typed like 3pi.`,
          answer: "3pi",
          simplified: true,
          explain: md`$A = \tfrac12 r^2\theta = \tfrac12 \cdot 9 \cdot \frac{2\pi}{3} = 3\pi$. The angle is a third of a turn, and $3\pi$ is a third of $9\pi$.`,
        },
      ],
      practice: [arcLength, sectorArea, arcsApplied],
    },
    {
      id: slug("Angular speed"),
      title: "Angular speed",
      summary: "How fast something turns, how fast a point on it moves, and why v = rω.",
      blocks: [
        {
          kind: "text",
          body: md`Watch a spinning wheel. Every point on it, near the hub or out at the rim, turns through the same angle in the same time. But a point on the rim covers far more distance than a point near the hub. There are two different speeds here, and they are related by the radius.`,
        },
        {
          kind: "key",
          title: "Angular speed and linear speed",
          body: md`If an object turns through an angle $\theta$ in time $t$, its **angular speed** is

$$\omega = \frac{\theta}{t},$$

in radians per second (or revolutions per minute, degrees per second, and so on). A point on the object that travels a distance $s$ along its circular path in that time has **linear speed** $v = \dfrac{s}{t}$.`,
        },
        { kind: "diagram", ...wheelDiagram },
        {
          kind: "key",
          title: "The link",
          body: md`For a point at distance $r$ from the center, with $\omega$ in radians per unit time,

$$v = r\omega.$$

Farther from the center means faster, in exact proportion to the radius.`,
        },
        {
          kind: "proof",
          title: "v = rω",
          given: md`A point at distance $r$ from the center of a wheel that turns through $\theta$ radians in time $t$`,
          prove: md`Its linear speed is $v = r\omega$, where $\omega = \theta / t$`,
          steps: [
            { statement: md`The point travels along an arc of length $s = r\theta$.`, reason: "Arc length, previous lesson (this is where radians are required)" },
            { statement: md`$v = \dfrac{s}{t} = \dfrac{r\theta}{t}$`, reason: "Definition of linear speed, then step 1" },
            { statement: md`$v = r \cdot \dfrac{\theta}{t}$`, reason: "Regroup the product" },
            { statement: md`$v = r\omega$`, reason: md`$\omega = \theta / t$ by definition` },
          ],
        },
        {
          kind: "why",
          title: "Why the outer point is faster",
          body: md`In the diagram, $P$ and $Q$ sit on the same spoke, so they always turn through the same angle: same $\omega$. But $Q$'s arc is twice as long as $P$'s, because arc length is radius times angle and $Q$ has twice the radius. Same time, twice the distance, twice the speed.

This is why the outside of a merry-go-round feels faster than the middle, and why the tip of a long blade moves much faster than its base even though the whole blade turns together.`,
        },
        {
          kind: "key",
          title: "Revolutions, radians, and seconds",
          body: md`Rotation rates are often quoted in **revolutions per minute (rpm)**. One revolution is $2\pi$ radians and one minute is $60$ seconds, so

$$\omega \text{ in rad/s} = \text{rpm} \cdot \frac{2\pi}{60} = \text{rpm} \cdot \frac{\pi}{30}.$$

Convert to radians per second before using $v = r\omega$. The time taken for one revolution is the **period** $T = \dfrac{2\pi}{\omega}$, and the number of revolutions per second is $\dfrac{\omega}{2\pi}$.`,
        },
        {
          kind: "why",
          title: "Why the period is 2π/ω",
          body: md`One revolution is $2\pi$ radians. At $\omega$ radians per second, the time to cover an angle $\theta$ is $\theta / \omega$ (angle divided by angle per second). For a full turn that is $T = 2\pi / \omega$.

Turn it around: $\omega = 2\pi / T$. A faster spin means a shorter period. This formula comes back in Unit 4, where a graph that repeats every $2\pi / B$ units has "angular speed" $B$.`,
        },
        {
          kind: "plot",
          x: [0, 8],
          y: [0, 14],
          curves: [{ expr: "w x", label: md`\theta = \omega \cdot \text{time}` }],
          hlines: [{ y: 2 * Math.PI, label: md`2\pi \text{ (one turn)}` }, { y: 4 * Math.PI, label: md`4\pi \text{ (two turns)}` }],
          vlines: [{ x: "2pi/w", label: "T" }],
          points: [{ x: "2pi/w", y: 2 * Math.PI, label: md`(T, 2\pi)`, color: 2 }],
          params: [{ name: "w", tex: md`\omega`, min: 0.5, max: 4, step: 0.25, value: 1.5 }],
          caption: md`Angle turned against time (seconds on the horizontal axis). The slope is $\omega$. The line crosses $2\pi$ at the period $T = 2\pi/\omega = {=2pi/w}$ s. Make $\omega$ larger and the period shrinks.`,
        },
        {
          kind: "example",
          title: "From rpm to rim speed",
          problem: md`A wheel of radius $30$ cm spins at $120$ rpm. Find its angular speed in rad/s and the speed of a point on the rim.`,
          steps: [
            { math: md`\omega = 120 \cdot \frac{2\pi}{60} = 4\pi \text{ rad/s}`, note: md`$120$ revolutions is $120 \cdot 2\pi$ radians; a minute is $60$ s.` },
            { math: md`v = r\omega = 30 \cdot 4\pi = 120\pi \text{ cm/s}`, note: md`About $377$ cm/s, or $3.77$ m/s.` },
            { math: md`\text{check: } 2 \text{ rev/s} \times 60\pi \text{ cm} = 120\pi \text{ cm/s}`, note: md`Two revolutions a second, each one circumference $2\pi \cdot 30 = 60\pi$ cm.` },
          ],
        },
        {
          kind: "example",
          title: "From speed to rotation rate",
          problem: md`A car's tyre has radius $0.35$ m and the car travels at $20$ m/s. How fast is the tyre turning, in rad/s and in rpm?`,
          steps: [
            { math: md`\omega = \frac{v}{r} = \frac{20}{0.35} \approx 57.1 \text{ rad/s}`, note: md`The rim moves at the car's speed (the tyre rolls without slipping), so $v = r\omega$ applies.` },
            { math: md`57.1 \cdot \frac{60}{2\pi} \approx 546 \text{ rpm}`, note: md`Radians per second to revolutions per minute: divide by $2\pi$, multiply by $60$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Belts and gears.** When two wheels are joined by a belt (or two gears mesh), their rims move at the same linear speed, because the belt can't stretch. So $r_1\omega_1 = r_2\omega_2$. The bigger wheel turns slower, in inverse proportion to its radius. Because the same conversion factor would appear on both sides, this one equation works with $\omega$ in rpm as well.`,
        },
        {
          kind: "example",
          title: "A belt drive",
          problem: md`A pulley of radius $4$ cm turning at $90$ rpm drives, by a belt, a pulley of radius $6$ cm. How fast does the second pulley turn?`,
          steps: [
            { math: md`r_1\omega_1 = r_2\omega_2`, note: md`Equal rim speeds.` },
            { math: md`4 \cdot 90 = 6 \cdot \omega_2`, note: md`Both in rpm.` },
            { math: md`\omega_2 = 60 \text{ rpm}`, note: md`The larger pulley turns at $\frac{4}{6} = \frac{2}{3}$ of the rate.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A record spins at $45$ rpm. Find its angular speed in radians per second. Give the exact answer in terms of $\pi$, typed like 3pi/2.`,
          answer: "3pi/2",
          simplified: true,
          explain: md`$45 \cdot \frac{2\pi}{60} = \frac{90\pi}{60} = \frac{3\pi}{2}$ rad/s.`,
        },
        {
          kind: "check",
          prompt: md`A point $8$ cm from the center of a disc turning at $3$ rad/s has what speed, in cm/s?`,
          answer: "24",
          explain: md`$v = r\omega = 8 \cdot 3 = 24$ cm/s. Each second the point moves $3$ radii, each $8$ cm.`,
        },
      ],
      practice: [angularRates, linearSpeed, speedApplied],
    },
  ],
};
