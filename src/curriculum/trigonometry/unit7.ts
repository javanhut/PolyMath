import { gcd } from "../../math/random";
import { md, slug, type Figure, type Generator, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;
const deg = (n: number) => `${n}^\\circ`;
/** One decimal place, as answer text. */
const r1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
/** Four decimal places, for the working. */
const r4 = (x: number) => x.toFixed(4);
const sinD = (d: number) => Math.sin(d * DEG);
const cosD = (d: number) => Math.cos(d * DEG);

/** Special angles whose sine is k sqrt(m) / 2. */
const SIN: Record<number, [number, number]> = { 30: [1, 1], 45: [1, 2], 60: [1, 3], 90: [2, 1], 120: [1, 3], 135: [1, 2], 150: [1, 1] };
const SPECIAL = [30, 45, 60, 90, 120, 135, 150];
/** The same angles in radians, in typed-answer syntax, for verify equations. */
const RAD: Record<number, string> = { 30: "pi/6", 45: "pi/4", 60: "pi/3", 90: "pi/2", 120: "2pi/3", 135: "3pi/4", 150: "5pi/6" };
const SIN_TEX: Record<number, string> = {
  30: "\\frac{1}{2}",
  45: "\\frac{\\sqrt{2}}{2}",
  60: "\\frac{\\sqrt{3}}{2}",
  90: "1",
  120: "\\frac{\\sqrt{3}}{2}",
  135: "\\frac{\\sqrt{2}}{2}",
  150: "\\frac{1}{2}",
};
const COS_TEX: Record<number, string> = { 60: "\\frac{1}{2}", 90: "0", 120: "-\\frac{1}{2}" };

/** n sqrt(m) / d in simplest form, as answer text and LaTeX. */
function radical(n: number, m: number, d: number): { text: string; tex: string; value: number } {
  const value = (n * Math.sqrt(m)) / d;
  for (let k = Math.floor(Math.sqrt(m)); k >= 2; k--) {
    if (m % (k * k) === 0) {
      n *= k;
      m /= k * k;
      break;
    }
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (m === 1) return { text: d === 1 ? `${n}` : `${n}/${d}`, tex: d === 1 ? `${n}` : `\\frac{${n}}{${d}}`, value };
  const coef = n === 1 ? "" : `${n}`;
  const body = `${coef}sqrt(${m})`;
  const bodyTex = `${coef}\\sqrt{${m}}`;
  return { text: d === 1 ? body : `${body}/${d}`, tex: d === 1 ? bodyTex : `\\frac{${bodyTex}}{${d}}`, value };
}

type Side = "a" | "b" | "c";
type Corner = "A" | "B" | "C";

/**
 * Triangle ABC drawn from its three side lengths, to scale: A at the origin, B on the
 * x-axis. Side labels are for a, b, c in that order; angle labels for A, B, C.
 * The asked part is drawn in orange.
 */
function triFig(a: number, b: number, c: number, sides: [string, string, string], angles: [string?, string?, string?], asked?: Side | Corner, caption?: string): Figure {
  const x = (b * b + c * c - a * a) / (2 * c);
  const y = Math.sqrt(Math.max(0, b * b - x * x));
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const xmin = Math.min(0, x);
  const xmax = Math.max(c, x);
  const pad = Math.max(1, 0.25 * Math.max(xmax - xmin, y));
  const col = (part: Side | Corner) => (asked === part ? { color: 2 as const } : {});
  const angle = (at: Corner, from: Corner, to: Corner, label?: string) => (label ? [{ at, from, to, label, ...col(at) }] : []);
  return {
    kind: "diagram",
    view: [r3(xmin - pad), r3(xmax + pad), r3(-pad), r3(y + pad)],
    points: [
      { name: "A", x: 0, y: 0, dir: x < 0.3 * c ? "s" : "sw" },
      { name: "B", x: r3(c), y: 0, dir: x > 0.7 * c ? "s" : "se" },
      { name: "C", x: r3(x), y: r3(y), dir: "n" },
    ],
    segments: [
      { from: "B", to: "C", ...(sides[0] ? { label: sides[0] } : {}), ...col("a") },
      { from: "C", to: "A", ...(sides[1] ? { label: sides[1] } : {}), ...col("b") },
      { from: "A", to: "B", ...(sides[2] ? { label: sides[2] } : {}), ...col("c") },
    ],
    angles: [...angle("A", "B", "C", angles[0]), ...angle("B", "C", "A", angles[1]), ...angle("C", "A", "B", angles[2])],
    ...(caption ? { caption } : {}),
  };
}

/** Pick two different special angles that fit in a triangle. */
function specialPair(r: { pick<T>(items: readonly T[]): T }): [number, number] {
  const pairs: [number, number][] = [];
  for (const A of SPECIAL) for (const B of SPECIAL) if (A !== B && A + B < 180) pairs.push([A, B]);
  return r.pick(pairs);
}

// ── Lesson 1: The law of sines ──────────────────────────────────────────────

const sinesExact: Generator = (r) => {
  const kind = r.int(0, 1);
  const a = r.int(2, 12);
  if (kind === 0) {
    const [A, B] = specialPair(r);
    const [kA, mA] = SIN[A]!;
    const [kB, mB] = SIN[B]!;
    const ans = radical(a * kB, mA * mB, kA * mA);
    const C = 180 - A - B;
    const c = (a * sinD(C)) / sinD(A);
    return {
      prompt: md`In $\triangle ABC$, $A = ${deg(A)}$, $B = ${deg(B)}$ and $a = ${a}$. Find $b$. Give an exact answer, like 5sqrt(2) or 5sqrt(6)/2.`,
      figure: triFig(a, ans.value, c, [`${a}`, "b", ""], [deg(A), deg(B)], "b"),
      answer: ans.text,
      simplified: true,
      verify: [`b / sin(${RAD[B]}) = ${a} / sin(${RAD[A]})`],
      hint: md`Law of sines: $\dfrac{b}{\sin B} = \dfrac{a}{\sin A}$, so $b = \dfrac{a \sin B}{\sin A}$. Use the exact values $\sin 30^\circ = \frac12$, $\sin 45^\circ = \frac{\sqrt2}{2}$, $\sin 60^\circ = \frac{\sqrt3}{2}$, and remember $\sin(180^\circ - x) = \sin x$ for the obtuse ones.`,
      solution: [
        { math: md`\frac{b}{\sin ${deg(B)}} = \frac{${a}}{\sin ${deg(A)}}`, note: md`Law of sines: side $b$ is opposite $B$, side $a$ is opposite $A$.` },
        { math: md`b = \frac{${a} \sin ${deg(B)}}{\sin ${deg(A)}}`, note: md`Multiply both sides by $\sin ${deg(B)}$.` },
        { math: md`b = \frac{${a} \cdot ${SIN_TEX[B]}}{${SIN_TEX[A]}}`, note: "Exact values from the unit circle." },
        { math: md`b = ${ans.tex}`, note: "Simplify. Rationalize the denominator if a root is left in it." },
      ],
    };
  }
  const triples: [number, number, number][] = [];
  for (const A of SPECIAL) for (const B of SPECIAL) {
    const C = 180 - A - B;
    if (C > 0 && C in SIN && C !== A) triples.push([A, B, C]);
  }
  const [A, B, C] = r.pick(triples);
  const [kA, mA] = SIN[A]!;
  const [kC, mC] = SIN[C]!;
  const ans = radical(a * kC, mA * mC, kA * mA);
  const b = (a * sinD(B)) / sinD(A);
  return {
    prompt: md`In $\triangle ABC$, $A = ${deg(A)}$, $B = ${deg(B)}$ and $a = ${a}$. Find $c$. Give an exact answer, like 4sqrt(3) or 8sqrt(3)/3.`,
    figure: triFig(a, b, ans.value, [`${a}`, "", "c"], [deg(A), deg(B)], "c"),
    answer: ans.text,
    simplified: true,
    verify: [`c / sin(${RAD[C]}) = ${a} / sin(${RAD[A]})`],
    hint: md`You need the angle opposite $c$ first: $C = 180^\circ - A - B$. Then $\dfrac{c}{\sin C} = \dfrac{a}{\sin A}$.`,
    solution: [
      { math: md`C = 180^\circ - ${deg(A)} - ${deg(B)} = ${deg(C)}`, note: "The angles of a triangle add to 180°." },
      { math: md`\frac{c}{\sin ${deg(C)}} = \frac{${a}}{\sin ${deg(A)}}`, note: md`Law of sines, using the pair we know, $a$ and $A$.` },
      { math: md`c = \frac{${a} \cdot ${SIN_TEX[C]}}{${SIN_TEX[A]}}`, note: "Exact values." },
      { math: md`c = ${ans.tex}`, note: "Simplify." },
    ],
  };
};

const sinesRounded: Generator = (r) => {
  const kind = r.int(0, 2);
  const fives = (lo: number, hi: number) => 5 * r.int(lo / 5, hi / 5);
  if (kind === 0) {
    let A = 0;
    let B = 0;
    do {
      A = fives(20, 120);
      B = fives(20, 110);
    } while (A === B || A + B > 150);
    const a = r.int(5, 20);
    const C = 180 - A - B;
    const b = (a * sinD(B)) / sinD(A);
    const c = (a * sinD(C)) / sinD(A);
    return {
      prompt: md`In $\triangle ABC$, $A = ${deg(A)}$, $B = ${deg(B)}$ and $a = ${a}$. Find $b$. Round to one decimal place.`,
      figure: triFig(a, b, c, [`${a}`, "b", ""], [deg(A), deg(B)], "b"),
      answer: r1(b),
      tolerance: 0.05,
      hint: md`$a$ and $A$ are a side and its opposite angle: that pair sets the common ratio. Then $b = \dfrac{a \sin B}{\sin A}$.`,
      solution: [
        { math: md`\frac{b}{\sin ${deg(B)}} = \frac{${a}}{\sin ${deg(A)}}`, note: "Law of sines." },
        { math: md`b = \frac{${a} \sin ${deg(B)}}{\sin ${deg(A)}}`, note: md`Multiply both sides by $\sin ${deg(B)}$.` },
        { math: md`b \approx \frac{${a}(${r4(sinD(B))})}{${r4(sinD(A))}}`, note: "Calculator, in degree mode." },
        { math: md`b \approx ${r1(b)}`, note: "Round at the end, not in the middle." },
      ],
    };
  }
  if (kind === 1) {
    let A = 0;
    let B = 0;
    do {
      A = fives(20, 120);
      B = fives(20, 110);
    } while (A === B || A + B > 150);
    const c = r.int(5, 20);
    const C = 180 - A - B;
    const a = (c * sinD(A)) / sinD(C);
    const b = (c * sinD(B)) / sinD(C);
    return {
      prompt: md`In $\triangle ABC$, $A = ${deg(A)}$, $B = ${deg(B)}$ and $c = ${c}$. Find $a$. Round to one decimal place.`,
      figure: triFig(a, b, c, ["a", "", `${c}`], [deg(A), deg(B)], "a"),
      answer: r1(a),
      tolerance: 0.05,
      hint: md`The known side is $c$, so you need its opposite angle: $C = 180^\circ - A - B$. Then $\dfrac{a}{\sin A} = \dfrac{c}{\sin C}$.`,
      solution: [
        { math: md`C = 180^\circ - ${deg(A)} - ${deg(B)} = ${deg(C)}`, note: "Third angle." },
        { math: md`\frac{a}{\sin ${deg(A)}} = \frac{${c}}{\sin ${deg(C)}}`, note: md`Law of sines with the pair $c$, $C$.` },
        { math: md`a = \frac{${c} \sin ${deg(A)}}{\sin ${deg(C)}} \approx \frac{${c}(${r4(sinD(A))})}{${r4(sinD(C))}}`, note: "Calculator." },
        { math: md`a \approx ${r1(a)}`, note: "" },
      ],
    };
  }
  const A = fives(25, 120);
  const b = r.int(4, 12);
  const a = r.int(b + 1, 20);
  const sinB = (b * sinD(A)) / a;
  const B = Math.asin(sinB) / DEG;
  const C = 180 - A - B;
  const c = (a * sinD(C)) / sinD(A);
  return {
    prompt: md`In $\triangle ABC$, $A = ${deg(A)}$, $a = ${a}$ and $b = ${b}$. Find $B$, in degrees. Round to one decimal place.`,
    figure: triFig(a, b, c, [`${a}`, `${b}`, ""], [deg(A), "B"], "B"),
    answer: r1(B),
    tolerance: 0.05,
    hint: md`$\dfrac{\sin B}{b} = \dfrac{\sin A}{a}$ gives $\sin B$; then $B = \arcsin(\sin B)$. Since $a > b$, $B$ is smaller than $A$, so the acute answer from arcsin is the only one.`,
    solution: [
      { math: md`\frac{\sin B}{${b}} = \frac{\sin ${deg(A)}}{${a}}`, note: "Law of sines, flipped so the unknown is on top." },
      { math: md`\sin B = \frac{${b} \sin ${deg(A)}}{${a}} \approx ${r4(sinB)}`, note: "" },
      { math: md`B \approx \arcsin(${r4(sinB)}) \approx ${r1(B)}^\circ`, note: md`Because $b < a$, $B < A$ and $B$ must be acute: $180^\circ - ${r1(B)}^\circ$ would make the angles exceed $180^\circ$ or put the bigger angle opposite the smaller side.` },
    ],
  };
};

const ambiguousCount: Generator = (r) => {
  const CHOICES = ["Two triangles", "Exactly one triangle", "No triangle"];
  const obtuse = r.next() < 0.3;
  const A = obtuse ? 5 * r.int(19, 29) : 5 * r.int(5, 15);
  const b = r.int(5, 12);
  let a = 0;
  let h = 0;
  do {
    a = r.int(2, 15);
    h = b * sinD(A);
  } while (a === b || Math.abs(a - h) < 0.35);
  const count = obtuse ? (a > b ? 1 : 0) : a < h ? 0 : a < b ? 2 : 1;
  const right = CHOICES[count === 2 ? 0 : count === 1 ? 1 : 2]!;
  const C = [b * cosD(A), b * sinD(A)];
  const pad = 0.25 * Math.max(b, Math.abs(C[0]!) + b);
  const figure: Figure = {
    kind: "diagram",
    view: [Math.min(0, C[0]!) - pad, Math.max(b, C[0]! + b) + pad, -pad, C[1]! + pad],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "C", x: Math.round(C[0]! * 1000) / 1000, y: Math.round(C[1]! * 1000) / 1000, dir: "n" },
      { name: "X", x: Math.max(b, C[0]! + b), y: 0, hidden: true, label: "" },
    ],
    segments: [
      { from: "A", to: "C", label: `${b}` },
      { from: "A", to: "X", kind: "ray", dashed: true },
    ],
    angles: [{ at: "A", from: "X", to: "C", label: deg(A) }],
    caption: md`The known parts: angle $A$, side $b = AC$, and the ray along which $B$ must lie. Side $a = ${a}$ swings from $C$.`,
  };
  const compare = obtuse
    ? a > b
      ? md`$A$ is obtuse, so $a$ must be the longest side. $a = ${a} > ${b} = b$, so one triangle exists.`
      : md`$A$ is obtuse, so $a$ would have to be the longest side. But $a = ${a} \le ${b} = b$, so no triangle exists.`
    : count === 0
      ? md`$a = ${a} < h \approx ${r4(h)}$: the side is too short to reach the ray. No triangle.`
      : count === 2
        ? md`$h \approx ${r4(h)} < a = ${a} < b = ${b}$: the swinging side reaches the ray at two points on the correct side of $A$. Two triangles.`
        : md`$a = ${a} \ge b = ${b}$: the side reaches the ray, but the second crossing falls on the wrong side of $A$. Exactly one triangle.`;
  return {
    prompt: md`How many triangles $ABC$ have $A = ${deg(A)}$, $a = ${a}$ and $b = ${b}$?`,
    figure,
    choices: CHOICES,
    accept: [right],
    hint: obtuse
      ? md`When $A$ is obtuse it is the largest angle, so $a$ must be the largest side. Compare $a$ with $b$.`
      : md`Find the height $h = b \sin A$ of $C$ above the ray. Then compare $a$ with $h$ and with $b$.`,
    solution: [
      ...(obtuse
        ? []
        : [{ math: md`h = b \sin A = ${b} \sin ${deg(A)} \approx ${r4(h)}`, note: "The shortest distance from $C$ to the ray through $A$." }]),
      { math: obtuse ? md`a = ${a}, \quad b = ${b}` : md`a = ${a}, \quad h \approx ${r4(h)}, \quad b = ${b}`, note: compare },
      { math: md`\text{${right}}`, note: "" },
    ],
  };
};

// ── Lesson 2: The law of cosines ────────────────────────────────────────────

const cosinesExact: Generator = (r) => {
  const C = r.pick([60, 60, 90, 120, 120]);
  const a = r.int(2, 12);
  let b = 0;
  do b = r.int(2, 12);
  while (b === a);
  const c2 = a * a + b * b - (C === 60 ? a * b : C === 120 ? -a * b : 0);
  const ans = radical(1, c2, 1);
  const cross = C === 60 ? md`- ${a * b}` : C === 120 ? md`+ ${a * b}` : md`- 0`;
  return {
    prompt: md`In $\triangle ABC$, $a = ${a}$, $b = ${b}$ and $C = ${deg(C)}$. Find $c$. Give an exact answer, like sqrt(39) or 2sqrt(7).`,
    figure: triFig(a, b, ans.value, [`${a}`, `${b}`, "c"], [, , deg(C)], "c"),
    answer: ans.text,
    simplified: true,
    verify: [`c^2 = ${a}^2 + ${b}^2 - 2(${a})(${b}) cos(${RAD[C]})`],
    hint: md`Two sides and the included angle: law of cosines, $c^2 = a^2 + b^2 - 2ab \cos C$. Here $\cos ${deg(C)} = ${COS_TEX[C]}$.`,
    solution: [
      { math: md`c^2 = ${a}^2 + ${b}^2 - 2(${a})(${b}) \cos ${deg(C)}`, note: "Law of cosines, with the known angle between the known sides." },
      { math: md`c^2 = ${a * a} + ${b * b} - ${2 * a * b} \cdot ${COS_TEX[C]}`, note: md`$\cos ${deg(C)} = ${COS_TEX[C]}$.` },
      { math: md`c^2 = ${a * a + b * b} ${cross} = ${c2}`, note: "" },
      { math: md`c = ${ans.tex}`, note: "Take the positive root, since c is a length. Simplify the radical." },
    ],
  };
};

const cosinesRounded: Generator = (r) => {
  if (r.next() < 0.5) {
    let C = 0;
    do C = 5 * r.int(5, 31);
    while (C === 60 || C === 90 || C === 120);
    const a = r.int(4, 15);
    const b = r.int(4, 15);
    const c = Math.sqrt(a * a + b * b - 2 * a * b * cosD(C));
    return {
      prompt: md`In $\triangle ABC$, $a = ${a}$, $b = ${b}$ and $C = ${deg(C)}$. Find $c$. Round to one decimal place.`,
      figure: triFig(a, b, c, [`${a}`, `${b}`, "c"], [, , deg(C)], "c"),
      answer: r1(c),
      tolerance: 0.05,
      hint: md`SAS: $c^2 = a^2 + b^2 - 2ab\cos C$. Watch the sign: when $C$ is obtuse, $\cos C$ is negative and the last term adds.`,
      solution: [
        { math: md`c^2 = ${a}^2 + ${b}^2 - 2(${a})(${b})\cos ${deg(C)}`, note: "Law of cosines." },
        { math: md`c^2 \approx ${a * a + b * b} - ${2 * a * b}(${r4(cosD(C))}) \approx ${r4(c * c)}`, note: C > 90 ? "The cosine is negative, so subtracting it adds." : "" },
        { math: md`c \approx \sqrt{${r4(c * c)}} \approx ${r1(c)}`, note: "" },
      ],
    };
  }
  let a = 0;
  let b = 0;
  let c = 0;
  do {
    [a, b, c] = [r.int(4, 15), r.int(4, 15), r.int(4, 15)];
  } while (a + b <= c + 1 || a + c <= b + 1 || b + c <= a + 1);
  const cosC = (a * a + b * b - c * c) / (2 * a * b);
  const C = Math.acos(cosC) / DEG;
  return {
    prompt: md`A triangle has sides $a = ${a}$, $b = ${b}$ and $c = ${c}$. Find the angle $C$, in degrees. Round to one decimal place.`,
    figure: triFig(a, b, c, [`${a}`, `${b}`, `${c}`], [, , "C"], "C"),
    answer: r1(C),
    tolerance: 0.05,
    hint: md`Solve the law of cosines for the cosine: $\cos C = \dfrac{a^2 + b^2 - c^2}{2ab}$. Then $C = \arccos(\ldots)$. A negative cosine means an obtuse angle, and arccos handles that by itself.`,
    solution: [
      { math: md`\cos C = \frac{a^2 + b^2 - c^2}{2ab} = \frac{${a * a} + ${b * b} - ${c * c}}{${2 * a * b}}`, note: md`The angle $C$ sits opposite $c$, so $c^2$ is the one subtracted.` },
      { math: md`\cos C = \frac{${a * a + b * b - c * c}}{${2 * a * b}} \approx ${r4(cosC)}`, note: "" },
      { math: md`C \approx \arccos(${r4(cosC)}) \approx ${r1(C)}^\circ`, note: cosC < 0 ? "Negative cosine: the angle is obtuse." : "" },
    ],
  };
};

/** Integer triangles (a, b, c) whose angle C is exactly 60°, 90° or 120°. */
const SPECIAL_SSS: [number, number, number, number][] = [
  [3, 8, 7, 60],
  [5, 8, 7, 60],
  [7, 15, 13, 60],
  [8, 15, 13, 60],
  [5, 21, 19, 60],
  [16, 21, 19, 60],
  [3, 5, 7, 120],
  [7, 8, 13, 120],
  [5, 16, 19, 120],
  [3, 4, 5, 90],
  [5, 12, 13, 90],
  [8, 15, 17, 90],
  [7, 24, 25, 90],
];

const cosinesAngleExact: Generator = (r) => {
  const [p, q, c0, C] = r.pick(SPECIAL_SSS);
  const k = c0 > 12 ? 1 : r.int(1, 2);
  const [a, b, c] = r.next() < 0.5 ? [p * k, q * k, c0 * k] : [q * k, p * k, c0 * k];
  const num = a * a + b * b - c * c;
  const den = 2 * a * b;
  const g = gcd(num, den) || 1;
  const fracTex = num === 0 ? "0" : `${num < 0 ? "-" : ""}\\frac{${Math.abs(num) / g}}{${den / g}}`;
  return {
    prompt: md`A triangle has sides $a = ${a}$, $b = ${b}$ and $c = ${c}$. Find the angle $C$, in degrees. The answer is exact.`,
    figure: triFig(a, b, c, [`${a}`, `${b}`, `${c}`], [, , "C"], "C"),
    answer: String(C),
    verify: [`cos(C pi/180) = (${a}^2 + ${b}^2 - ${c}^2)/(2(${a})(${b}))`],
    hint: md`$\cos C = \dfrac{a^2 + b^2 - c^2}{2ab}$. The fraction will come out as one of $\frac12$, $0$ or $-\frac12$; you know those angles from the unit circle.`,
    solution: [
      { math: md`\cos C = \frac{${a}^2 + ${b}^2 - ${c}^2}{2(${a})(${b})} = \frac{${a * a} + ${b * b} - ${c * c}}{${den}}`, note: "Law of cosines solved for the cosine." },
      { math: md`\cos C = \frac{${num}}{${den}} = ${fracTex}`, note: "Reduce." },
      { math: md`C = ${deg(C)}`, note: md`The only angle between $0^\circ$ and $180^\circ$ with that cosine.` },
    ],
  };
};

// ── Lesson 3: Area of a triangle ────────────────────────────────────────────

const areaExact: Generator = (r) => {
  const C = r.pick(SPECIAL);
  const a = r.int(3, 14);
  const b = r.int(3, 14);
  const [k, m] = SIN[C]!;
  const ans = radical(a * b * k, m, 4);
  return {
    prompt: md`Find the area of $\triangle ABC$ with $a = ${a}$, $b = ${b}$ and $C = ${deg(C)}$. Give an exact answer, like 6sqrt(3) or 15sqrt(2)/2.`,
    figure: triFig(a, b, Math.sqrt(a * a + b * b - 2 * a * b * cosD(C)), [`${a}`, `${b}`, ""], [, , deg(C)]),
    answer: ans.text,
    simplified: true,
    verify: [`K = (1/2)(${a})(${b}) sin(${RAD[C]})`],
    hint: md`Two sides and the angle between them: $K = \frac12 ab \sin C$. Use the exact sine of $${deg(C)}$.`,
    solution: [
      { math: md`K = \tfrac{1}{2} ab \sin C = \tfrac{1}{2}(${a})(${b}) \sin ${deg(C)}`, note: md`$C$ is the angle between sides $a$ and $b$.` },
      { math: md`K = \tfrac{1}{2}(${a * b}) \cdot ${SIN_TEX[C]}`, note: "Exact value from the unit circle." },
      { math: md`K = ${ans.tex}`, note: "Simplify." },
    ],
  };
};

/** Integer triangles with integer area (Heronian triangles): a, b, c, area. */
const HERONIAN: [number, number, number, number][] = [
  [3, 4, 5, 6],
  [5, 5, 6, 12],
  [5, 5, 8, 12],
  [6, 8, 10, 24],
  [5, 12, 13, 30],
  [9, 10, 17, 36],
  [4, 13, 15, 24],
  [13, 14, 15, 84],
  [10, 13, 13, 60],
  [7, 15, 20, 42],
  [8, 15, 17, 60],
  [9, 12, 15, 54],
  [11, 13, 20, 66],
  [7, 24, 25, 84],
  [10, 17, 21, 84],
  [12, 17, 25, 90],
  [13, 20, 21, 126],
  [6, 25, 29, 60],
  [17, 25, 28, 210],
  [15, 28, 41, 126],
];

const heron: Generator = (r) => {
  const [p, q, t, K0] = r.pick(HERONIAN);
  const k = p + q + t > 40 ? 1 : r.int(1, 2);
  const sides = [p * k, q * k, t * k];
  // Shuffle the order the sides are given in.
  for (let i = sides.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [sides[i], sides[j]] = [sides[j]!, sides[i]!];
  }
  const [a, b, c] = sides as [number, number, number];
  const K = K0 * k * k;
  const s = (a + b + c) / 2;
  return {
    prompt: md`A triangle has sides $${a}$, $${b}$ and $${c}$. Find its area.`,
    figure: triFig(a, b, c, [`${a}`, `${b}`, `${c}`], [, ,]),
    answer: String(K),
    verify: [`16 K^2 = (${a} + ${b} + ${c})(-${a} + ${b} + ${c})(${a} - ${b} + ${c})(${a} + ${b} - ${c})`],
    hint: md`Three sides and no angle: Heron's formula. First the semiperimeter $s = \frac{a + b + c}{2}$, then $K = \sqrt{s(s-a)(s-b)(s-c)}$.`,
    solution: [
      { math: md`s = \frac{${a} + ${b} + ${c}}{2} = ${s}`, note: "Half the perimeter." },
      { math: md`K = \sqrt{${s}(${s} - ${a})(${s} - ${b})(${s} - ${c})}`, note: "Heron's formula." },
      { math: md`K = \sqrt{${s} \cdot ${s - a} \cdot ${s - b} \cdot ${s - c}} = \sqrt{${K * K}}`, note: "" },
      { math: md`K = ${K}`, note: "A perfect square this time. Usually it isn't, and the answer is rounded." },
    ],
  };
};

const areaRounded: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    let C = 0;
    do C = 5 * r.int(4, 32);
    while (SPECIAL.includes(C));
    const a = r.int(4, 15);
    const b = r.int(4, 15);
    const K = 0.5 * a * b * sinD(C);
    return {
      prompt: md`Find the area of $\triangle ABC$ with $a = ${a}$, $b = ${b}$ and $C = ${deg(C)}$. Round to one decimal place.`,
      figure: triFig(a, b, Math.sqrt(a * a + b * b - 2 * a * b * cosD(C)), [`${a}`, `${b}`, ""], [, , deg(C)]),
      answer: r1(K),
      tolerance: 0.05,
      hint: md`$K = \frac12 ab \sin C$, with $C$ the angle between the two given sides.`,
      solution: [
        { math: md`K = \tfrac{1}{2}(${a})(${b}) \sin ${deg(C)}`, note: "Two sides and the included angle." },
        { math: md`K \approx \tfrac{1}{2}(${a * b})(${r4(sinD(C))})`, note: C > 90 ? "An obtuse angle still has a positive sine, so the area is positive as it should be." : "" },
        { math: md`K \approx ${r1(K)}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    let A = 0;
    let B = 0;
    do {
      A = 5 * r.int(5, 22);
      B = 5 * r.int(5, 22);
    } while (A + B > 150);
    const c = r.int(5, 16);
    const C = 180 - A - B;
    const a = (c * sinD(A)) / sinD(C);
    const b = (c * sinD(B)) / sinD(C);
    const K = 0.5 * a * c * sinD(B);
    return {
      prompt: md`In $\triangle ABC$, $A = ${deg(A)}$, $B = ${deg(B)}$ and $c = ${c}$. Find the area. Round to one decimal place.`,
      figure: triFig(a, b, c, ["", "", `${c}`], [deg(A), deg(B)]),
      answer: r1(K),
      tolerance: 0.05,
      hint: md`The area formula needs two sides. Find $C$, use the law of sines to get a second side, then $K = \frac12 (\text{side})(\text{side}) \sin(\text{included angle})$.`,
      solution: [
        { math: md`C = 180^\circ - ${deg(A)} - ${deg(B)} = ${deg(C)}`, note: "Third angle." },
        { math: md`a = \frac{c \sin A}{\sin C} = \frac{${c} \sin ${deg(A)}}{\sin ${deg(C)}} \approx ${r4(a)}`, note: "Law of sines for a second side." },
        { math: md`K = \tfrac{1}{2} a c \sin B \approx \tfrac{1}{2}(${r4(a)})(${c}) \sin ${deg(B)}`, note: md`$B$ is the angle between sides $a$ and $c$.` },
        { math: md`K \approx ${r1(K)}`, note: "Carry the unrounded side through; round only at the end." },
      ],
    };
  }
  let a = 0;
  let b = 0;
  let c = 0;
  let K = 0;
  do {
    [a, b, c] = [r.int(4, 15), r.int(4, 15), r.int(4, 15)];
    const s = (a + b + c) / 2;
    K = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  } while (a + b <= c + 1 || a + c <= b + 1 || b + c <= a + 1 || Number.isInteger(K));
  const s = (a + b + c) / 2;
  const prod = s * (s - a) * (s - b) * (s - c);
  return {
    prompt: md`A triangle has sides $${a}$, $${b}$ and $${c}$. Find its area. Round to one decimal place.`,
    figure: triFig(a, b, c, [`${a}`, `${b}`, `${c}`], [, ,]),
    answer: r1(K),
    tolerance: 0.05,
    hint: md`Heron: $s = \frac{a + b + c}{2}$, then $K = \sqrt{s(s - a)(s - b)(s - c)}$.`,
    solution: [
      { math: md`s = \frac{${a} + ${b} + ${c}}{2} = ${s}`, note: "Semiperimeter." },
      { math: md`K = \sqrt{${s}(${s - a})(${s - b})(${s - c})} = \sqrt{${prod}}`, note: "Heron's formula." },
      { math: md`K \approx ${r1(K)}`, note: "" },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit7: Unit = {
  title: "Oblique Triangles",
  lessons: [
    {
      id: slug("The law of sines"),
      title: "The law of sines",
      summary: "Any triangle, right or not: an altitude proves that each side over the sine of its opposite angle is the same number. Using it, and the one case where it can give two triangles.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 2 solved right triangles: given a few parts, find the rest. Most triangles aren't right. A triangle with no right angle is called **oblique**, and this unit is about solving those.

The trick is that every triangle contains right triangles. Drop an altitude from one vertex and the triangle splits into two right triangles that share that height. Everything we know about sine and cosine then applies to each half.

First the naming convention, which the whole unit relies on. In $\triangle ABC$ the angles are $A$, $B$, $C$ and the **side opposite each angle gets the matching lowercase letter**: $a$ is opposite $A$, $b$ opposite $B$, $c$ opposite $C$.`,
        },
        {
          kind: "diagram",
          view: [-1.5, 10.5, -1.5, 6.5],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 9, y: 0, dir: "se" },
            { name: "C", x: 3, y: 5, dir: "n" },
            { name: "D", x: 3, y: 0, dir: "s" },
          ],
          segments: [
            { from: "A", to: "B" },
            { from: "B", to: "C", label: "a" },
            { from: "C", to: "A", label: "b" },
            { from: "C", to: "D", dashed: true, label: "h", color: 2 },
          ],
          angles: [
            { at: "A", from: "B", to: "C", label: "A" },
            { at: "B", from: "C", to: "A", label: "B" },
            { at: "D", from: "B", to: "C", right: true },
          ],
          caption: md`The altitude $h$ from $C$ makes two right triangles, $\triangle ACD$ and $\triangle BCD$. Both have height $h$.`,
        },
        {
          kind: "why",
          title: "Why the same height gives a law",
          body: md`In right triangle $ACD$, the side $h$ is opposite angle $A$ and the hypotenuse is $b$, so $\sin A = \dfrac{h}{b}$, which means $h = b \sin A$.

In right triangle $BCD$, the same $h$ is opposite angle $B$ with hypotenuse $a$, so $h = a \sin B$.

It is the same segment, so the two expressions are equal:

$$b \sin A = a \sin B.$$

Divide both sides by $\sin A \sin B$ (neither is zero, since the angles of a triangle are strictly between $0^\circ$ and $180^\circ$):

$$\frac{a}{\sin A} = \frac{b}{\sin B}.$$

Nothing about this used side $c$ specifically. Drop the altitude from $A$ instead and the same steps give $\dfrac{b}{\sin B} = \dfrac{c}{\sin C}$. So all three ratios are equal.

**What if an angle is obtuse?** If $B$ is obtuse, the foot $D$ of the altitude from $C$ lands outside the triangle, past $B$. The right triangle $BCD$ then has the angle $180^\circ - B$ at $B$, so $h = a \sin(180^\circ - B)$. From Unit 3, $\sin(180^\circ - B) = \sin B$: the two angles have the same height on the unit circle. So $h = a \sin B$ still, and the proof goes through unchanged.`,
        },
        {
          kind: "proof",
          title: "Law of sines",
          given: md`$\triangle ABC$ with altitude $h$ from $C$ meeting line $AB$ at $D$`,
          prove: md`$\dfrac{a}{\sin A} = \dfrac{b}{\sin B}$`,
          steps: [
            { statement: md`$\triangle ACD$ and $\triangle BCD$ are right triangles with right angles at $D$`, reason: "Definition of altitude" },
            { statement: md`$\sin A = \dfrac{h}{b}$, so $h = b \sin A$`, reason: md`Sine is opposite over hypotenuse in $\triangle ACD$ (if $A$ is obtuse, the angle at $A$ in that triangle is $180^\circ - A$, and $\sin(180^\circ - A) = \sin A$)` },
            { statement: md`$\sin B = \dfrac{h}{a}$, so $h = a \sin B$`, reason: md`Same in $\triangle BCD$` },
            { statement: md`$b \sin A = a \sin B$`, reason: "Both equal $h$ (Transitive Property)" },
            { statement: md`$\dfrac{a}{\sin A} = \dfrac{b}{\sin B}$`, reason: md`Divide both sides by $\sin A \sin B$, which is not zero for angles between $0^\circ$ and $180^\circ$` },
          ],
        },
        {
          kind: "key",
          title: "Law of sines",
          body: md`In any triangle,

$$\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C}.$$

Each side divided by the sine of its opposite angle gives the same number. Flipped, $\dfrac{\sin A}{a} = \dfrac{\sin B}{b} = \dfrac{\sin C}{c}$, which is handier when the unknown is an angle.

To use it you need **one complete pair**, a side and its opposite angle, plus one more part. That covers:

- **AAS** and **ASA**: two angles and a side. Find the third angle first ($180^\circ$ minus the other two); then every side has a known opposite angle.
- **SSA**: two sides and an angle opposite one of them. This case needs care; see below.`,
        },
        {
          kind: "example",
          title: "Two angles and a side (AAS)",
          problem: md`In $\triangle ABC$, $A = 40^\circ$, $B = 65^\circ$ and $a = 12$. Find $b$ and $c$ to one decimal place.`,
          steps: [
            { math: md`C = 180^\circ - 40^\circ - 65^\circ = 75^\circ`, note: "Third angle first, so every side has an opposite angle." },
            { math: md`\frac{b}{\sin 65^\circ} = \frac{12}{\sin 40^\circ}`, note: md`The complete pair is $a = 12$ with $A = 40^\circ$; it fixes the common ratio.` },
            { math: md`b = \frac{12 \sin 65^\circ}{\sin 40^\circ} \approx \frac{12(0.9063)}{0.6428} \approx 16.9`, note: "Calculator in degree mode." },
            { math: md`c = \frac{12 \sin 75^\circ}{\sin 40^\circ} \approx \frac{12(0.9659)}{0.6428} \approx 18.0`, note: md`Same ratio, now for $c$. Check: the largest angle ($C$) is opposite the largest side.` },
          ],
        },
        {
          kind: "example",
          title: "Exact values",
          problem: md`In $\triangle ABC$, $A = 30^\circ$, $B = 45^\circ$ and $a = 6$. Find $b$ exactly.`,
          steps: [
            { math: md`b = \frac{a \sin B}{\sin A} = \frac{6 \sin 45^\circ}{\sin 30^\circ}`, note: "Law of sines solved for $b$." },
            { math: md`b = \frac{6 \cdot \frac{\sqrt{2}}{2}}{\frac{1}{2}} = \frac{3\sqrt{2}}{\frac12}`, note: "Exact values from the unit circle (Unit 3)." },
            { math: md`b = 6\sqrt{2}`, note: md`Dividing by $\frac12$ doubles. About $8.49$, and it makes sense that $b > a$ since $B > A$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $A = 60^\circ$, $B = 45^\circ$ and $a = 9$. Find $b$ exactly. Type roots like 3sqrt(6).`,
          answer: "3sqrt(6)",
          simplified: true,
          explain: md`$b = \dfrac{9 \sin 45^\circ}{\sin 60^\circ} = \dfrac{9 \cdot \frac{\sqrt2}{2}}{\frac{\sqrt3}{2}} = \dfrac{9\sqrt2}{\sqrt3} = \dfrac{9\sqrt6}{3} = 3\sqrt6$.`,
        },
        {
          kind: "text",
          body: md`**The ambiguous case.** With two angles and a side, the triangle is pinned down: there is exactly one. Two sides and an angle opposite one of them (SSA) is different. Picture what you know: angle $A$ at the vertex $A$, side $b$ running from $A$ to $C$, and side $a$ of known length hanging from $C$. Where it lands on the far ray is where $B$ goes. A fixed length swinging from a point is a circle, and a circle can miss a line, touch it once, or cross it twice. Drag the slider.`,
        },
        {
          kind: "diagram",
          view: [-3, 15, -3, 9],
          params: [{ name: "a", tex: "a", min: 4.6, max: 9.5, step: 0.1, value: 6 }],
          points: [
            { name: "A", x: 0, y: 0, dir: "sw" },
            { name: "C", x: "8cos(35 pi/180)", y: "8sin(35 pi/180)", dir: "n" },
            { name: "D", x: "8cos(35 pi/180)", y: 0, dir: "s" },
            { name: "X", x: 15, y: 0, hidden: true, label: "" },
            { name: "P", x: "8cos(35 pi/180) + sqrt(a^2 - (8sin(35 pi/180))^2)", y: 0, label: "B_1", dir: "se" },
            { name: "Q", x: "8cos(35 pi/180) - sqrt(a^2 - (8sin(35 pi/180))^2)", y: 0, label: "B_2", dir: "s" },
          ],
          segments: [
            { from: "A", to: "X", kind: "ray", dashed: true },
            { from: "A", to: "C", label: "b = 8" },
            { from: "C", to: "D", dashed: true, label: "h" },
            { from: "C", to: "P", label: "a", color: 2 },
            { from: "C", to: "Q", color: 2, dashed: true },
          ],
          circles: [{ center: "C", radius: "a", dashed: true, color: 2 }],
          angles: [{ at: "A", from: "X", to: "C", label: "35^\\circ" }],
          readouts: [
            { label: "h = b \\sin A", value: "8sin(35 pi/180)" },
            { label: "a", value: "a" },
          ],
          caption: md`$A = 35^\circ$ and $b = 8$ are fixed; the height of $C$ above the ray is $h = 8 \sin 35^\circ \approx 4.59$. Slide $a$. Between $h$ and $b$ the circle crosses the ray twice, at $B_1$ and $B_2$, and both triangles have angle $A$ at $A$. Once $a \ge 8$, $B_2$ slides to the wrong side of $A$: that triangle no longer has the given angle, so only $B_1$ counts.`,
        },
        {
          kind: "key",
          title: "How many triangles (SSA)",
          body: md`Given $A$, $a$ and $b$, let $h = b \sin A$ be the distance from $C$ to the line through $A$.

If $A$ is **acute**:
- $a < h$: **no** triangle (the side can't reach).
- $a = h$: **one** right triangle.
- $h < a < b$: **two** triangles.
- $a \ge b$: **one** triangle.

If $A$ is **right or obtuse**: $A$ is the largest angle, so $a$ must be the largest side. One triangle if $a > b$, none otherwise.`,
        },
        {
          kind: "why",
          title: "Why the algebra agrees with the picture",
          body: md`Solving the law of sines for the unknown angle gives $\sin B = \dfrac{b \sin A}{a}$. That is one equation about $\sin B$, and from Unit 6 an equation $\sin B = k$ with $0 < k < 1$ has **two** solutions between $0^\circ$ and $180^\circ$: the acute one, $B_1 = \arcsin k$, and its supplement, $B_2 = 180^\circ - B_1$. Both are candidates for an angle of a triangle.

- If $k > 1$ there is no solution at all: that is $b \sin A > a$, which is $a < h$. No triangle.
- If $k = 1$, $B = 90^\circ$ exactly: one right triangle.
- Otherwise, $B_2$ survives only if $A + B_2 < 180^\circ$, that is $B_1 > A$, which (bigger angle, bigger opposite side, from the law of sines itself) means $b > a$. So two triangles exactly when $h < a < b$, and one when $a \ge b$.

The circle and the equation are saying the same thing. If the arcsin value gives you $B_1$, always ask whether $180^\circ - B_1$ also fits.`,
        },
        {
          kind: "example",
          title: "Solving both triangles",
          problem: md`In $\triangle ABC$, $A = 30^\circ$, $a = 7$ and $b = 10$. Find all possible values of $B$, $C$ and $c$ to one decimal place.`,
          steps: [
            { math: md`h = 10 \sin 30^\circ = 5, \qquad 5 < 7 < 10`, note: md`$h < a < b$ with $A$ acute: expect two triangles.` },
            { math: md`\sin B = \frac{10 \sin 30^\circ}{7} = \frac{5}{7} \approx 0.7143`, note: "Law of sines solved for the unknown angle." },
            { math: md`B_1 \approx 45.6^\circ, \qquad B_2 = 180^\circ - 45.6^\circ \approx 134.4^\circ`, note: md`Both have sine $\frac57$, and $30^\circ + 134.4^\circ < 180^\circ$, so both fit.` },
            { math: md`C_1 \approx 104.4^\circ, \quad c_1 = \frac{7 \sin 104.4^\circ}{\sin 30^\circ} \approx 13.6`, note: "First triangle." },
            { math: md`C_2 \approx 15.6^\circ, \quad c_2 = \frac{7 \sin 15.6^\circ}{\sin 30^\circ} \approx 3.8`, note: "Second triangle: a much flatter one." },
          ],
        },
        {
          kind: "check",
          prompt: md`How many triangles have $A = 40^\circ$, $a = 5$ and $b = 9$?`,
          choices: ["No triangle", "Exactly one triangle", "Two triangles"],
          accept: ["No triangle"],
          explain: md`$h = 9 \sin 40^\circ \approx 5.79$, and $a = 5 < h$. The side is too short to reach the far ray. (Algebraically, $\sin B = \frac{9 \sin 40^\circ}{5} \approx 1.16 > 1$.)`,
        },
      ],
      practice: [sinesExact, sinesRounded, ambiguousCount],
    },
    {
      id: slug("The law of cosines"),
      title: "The law of cosines",
      summary: "Two sides and the included angle, or three sides: the law of sines has no complete pair to start from. Coordinates and the distance formula give the tool that does, and it contains the Pythagorean theorem.",
      blocks: [
        {
          kind: "text",
          body: md`The law of sines needs a side and its opposite angle. Two cases don't give you one:

- **SAS**: two sides and the angle *between* them. The known angle is opposite the unknown side.
- **SSS**: three sides and no angle at all.

For these we need a relation between all three sides and one angle. The cleanest way to find one is to put the triangle on coordinate axes and use the distance formula, which is itself just the Pythagorean theorem.`,
        },
        {
          kind: "diagram",
          view: [-1.5, 8, -1.5, 6],
          grid: true,
          points: [
            { name: "C", x: 0, y: 0, label: "C\\,(0,\\,0)", dir: "sw" },
            { name: "B", x: 6, y: 0, label: "B\\,(a,\\,0)", dir: "se" },
            { name: "A", x: 2.5, y: 4.33, label: "A\\,(b\\cos C,\\ b\\sin C)", dir: "n" },
          ],
          segments: [
            { from: "C", to: "B", label: "a" },
            { from: "C", to: "A", label: "b" },
            { from: "A", to: "B", label: "c", color: 2 },
          ],
          angles: [{ at: "C", from: "B", to: "A", label: "C" }],
          caption: md`Put $C$ at the origin with side $a$ along the positive $x$-axis. The point $A$ is at distance $b$ from the origin in the direction of angle $C$, so by the unit-circle definition its coordinates are $(b\cos C,\ b\sin C)$.`,
        },
        {
          kind: "why",
          title: "Why c² = a² + b² − 2ab cos C",
          body: md`With $C$ at the origin and $B = (a, 0)$, the vertex $A$ sits on the circle of radius $b$ at angle $C$ in standard position. Unit 3 defined $\cos$ and $\sin$ exactly so that this point is $(b \cos C,\ b \sin C)$, whatever the size of $C$: acute, right or obtuse.

The side $c$ is the distance from $A$ to $B$. Distance formula:

$$c^2 = (b\cos C - a)^2 + (b \sin C - 0)^2.$$

Expand the first square:

$$c^2 = b^2 \cos^2 C - 2ab\cos C + a^2 + b^2 \sin^2 C.$$

Group the two $b^2$ terms: $b^2\cos^2 C + b^2 \sin^2 C = b^2(\cos^2 C + \sin^2 C) = b^2$, by the Pythagorean identity from Unit 5. What is left is

$$c^2 = a^2 + b^2 - 2ab \cos C.$$

The letters were just names. Putting any vertex at the origin gives the matching formula for that vertex's angle.`,
        },
        {
          kind: "proof",
          title: "Law of cosines",
          given: md`$\triangle ABC$ with $C$ at the origin and $B$ on the positive $x$-axis`,
          prove: md`$c^2 = a^2 + b^2 - 2ab\cos C$`,
          steps: [
            { statement: md`$B = (a, 0)$`, reason: md`$CB = a$ lies along the positive $x$-axis` },
            { statement: md`$A = (b \cos C,\ b \sin C)$`, reason: md`$A$ is at distance $b$ from the origin at angle $C$ in standard position (unit-circle definition of cosine and sine)` },
            { statement: md`$c^2 = (b\cos C - a)^2 + (b\sin C)^2$`, reason: md`Distance formula for $AB = c$` },
            { statement: md`$c^2 = b^2\cos^2 C - 2ab\cos C + a^2 + b^2\sin^2 C$`, reason: "Expand the square" },
            { statement: md`$c^2 = a^2 + b^2(\cos^2 C + \sin^2 C) - 2ab\cos C$`, reason: "Collect the $b^2$ terms (Distributive Property)" },
            { statement: md`$c^2 = a^2 + b^2 - 2ab\cos C$`, reason: md`Pythagorean identity $\cos^2 C + \sin^2 C = 1$` },
          ],
        },
        {
          kind: "key",
          title: "Law of cosines",
          body: md`In any triangle,

$$c^2 = a^2 + b^2 - 2ab\cos C,$$

and likewise $a^2 = b^2 + c^2 - 2bc\cos A$ and $b^2 = a^2 + c^2 - 2ac\cos B$. The side on the left is always opposite the angle on the right.

Read it as **the Pythagorean theorem with a correction**: $a^2 + b^2$, adjusted by $2ab\cos C$. When $C = 90^\circ$, $\cos C = 0$ and the correction vanishes, leaving $c^2 = a^2 + b^2$. The Pythagorean theorem is the special case.`,
        },
        {
          kind: "why",
          title: "Why the correction has that sign",
          body: md`Hold $a$ and $b$ fixed and open the angle $C$. When $C$ is acute, $\cos C > 0$, so $c^2 < a^2 + b^2$: the third side is shorter than the right-angle version, as it should be when the two sides lean toward each other. When $C$ is obtuse, $\cos C < 0$, and subtracting a negative makes $c^2 > a^2 + b^2$: the sides lean apart and the third side is longer. At $C = 180^\circ$, $\cos C = -1$ and $c^2 = a^2 + 2ab + b^2 = (a + b)^2$: the triangle has flattened into a segment of length $a + b$. At $C = 0^\circ$ it gives $(a - b)^2$. Both extremes check out, which is a good sign the formula is right.`,
        },
        {
          kind: "diagram",
          view: [-2, 9, -2, 7],
          params: [{ name: "t", tex: "C", min: 20, max: 160, step: 5, value: 60 }],
          points: [
            { name: "C", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 6, y: 0, dir: "se" },
            { name: "A", x: "5cos(t pi/180)", y: "5sin(t pi/180)", dir: "n" },
          ],
          segments: [
            { from: "C", to: "B", label: "a = 6" },
            { from: "C", to: "A", label: "b = 5" },
            { from: "A", to: "B", label: "c", color: 2 },
          ],
          angles: [{ at: "C", from: "B", to: "A", label: "{t}^\\circ" }],
          readouts: [
            { label: "\\cos C", value: "cos(t pi/180)" },
            { label: "c = \\sqrt{61 - 60\\cos C}", value: "sqrt(61 - 60cos(t pi/180))" },
            { label: "\\sqrt{a^2 + b^2} = \\sqrt{61}", value: "sqrt(61)" },
          ],
          caption: md`$a = 6$ and $b = 5$ stay fixed while $C$ opens. Compare $c$ with $\sqrt{61} \approx 7.81$, the right-angle value: smaller for acute $C$, larger for obtuse.`,
        },
        {
          kind: "example",
          title: "Two sides and the included angle (SAS)",
          problem: md`In $\triangle ABC$, $a = 7$, $b = 10$ and $C = 48^\circ$. Find $c$ to one decimal place.`,
          steps: [
            { math: md`c^2 = 7^2 + 10^2 - 2(7)(10)\cos 48^\circ`, note: md`The known angle is between the known sides, so it goes on the right with $c^2$ on the left.` },
            { math: md`c^2 \approx 49 + 100 - 140(0.6691) \approx 55.32`, note: "Calculator." },
            { math: md`c \approx \sqrt{55.32} \approx 7.4`, note: md`Positive root. Check: $C = 48^\circ$ is acute, so $c$ should be less than $\sqrt{149} \approx 12.2$. It is.` },
          ],
        },
        {
          kind: "example",
          title: "An exact answer",
          problem: md`In $\triangle ABC$, $a = 5$, $b = 8$ and $C = 60^\circ$. Find $c$ exactly.`,
          steps: [
            { math: md`c^2 = 5^2 + 8^2 - 2(5)(8)\cos 60^\circ`, note: "Law of cosines." },
            { math: md`c^2 = 25 + 64 - 80 \cdot \tfrac12 = 49`, note: md`$\cos 60^\circ = \frac12$ exactly.` },
            { math: md`c = 7`, note: "A perfect square this time. Usually the answer is a radical like $\sqrt{39}$." },
          ],
        },
        {
          kind: "check",
          prompt: md`In $\triangle ABC$, $a = 3$, $b = 5$ and $C = 120^\circ$. Find $c$ exactly. Type roots like sqrt(19).`,
          answer: "7",
          simplified: true,
          explain: md`$c^2 = 9 + 25 - 2(3)(5)\cos 120^\circ = 34 - 30\left(-\tfrac12\right) = 34 + 15 = 49$, so $c = 7$. Obtuse angle, so the correction added.`,
        },
        {
          kind: "text",
          body: md`**Three sides (SSS).** Solve the law of cosines for the cosine instead:

$$\cos C = \frac{a^2 + b^2 - c^2}{2ab}.$$

Then $C = \arccos\left(\dfrac{a^2 + b^2 - c^2}{2ab}\right)$. There is no ambiguous case here. From Unit 6, $\arccos$ returns an angle in $[0^\circ, 180^\circ]$, and that range holds *every* possible angle of a triangle, with each cosine value belonging to exactly one of them. A negative cosine simply comes back as an obtuse angle. This is why, when you have a choice, finding an angle with the law of cosines is safer than with the law of sines.`,
        },
        {
          kind: "example",
          title: "Three sides, find an angle",
          problem: md`A triangle has sides $a = 6$, $b = 9$ and $c = 13$. Find $C$ to one decimal place.`,
          steps: [
            { math: md`\cos C = \frac{6^2 + 9^2 - 13^2}{2(6)(9)} = \frac{36 + 81 - 169}{108}`, note: md`$C$ is opposite the longest side, so expect the largest angle.` },
            { math: md`\cos C = \frac{-52}{108} \approx -0.4815`, note: "Negative: the angle is obtuse." },
            { math: md`C \approx \arccos(-0.4815) \approx 118.8^\circ`, note: md`Check: $13^2 = 169 > 36 + 81 = 117$, so $C$ should be obtuse. It is.` },
          ],
        },
        {
          kind: "key",
          title: "Which law, when",
          body: md`- **AAS or ASA** (two angles): find the third angle, then the law of sines.
- **SSA** (two sides, angle opposite one): law of sines; check for two triangles.
- **SAS** (two sides, included angle): law of cosines for the third side, then the law of sines or cosines for a second angle.
- **SSS** (three sides): law of cosines for an angle. Start with the largest angle (opposite the longest side); the other two are then certainly acute, and the law of sines can finish safely.

A quick sanity check for any answer: the largest side is opposite the largest angle, and the angles add to $180^\circ$.`,
        },
        {
          kind: "check",
          prompt: md`A triangle has sides $a = 3$, $b = 5$ and $c = 7$. Find $C$ in degrees (the answer is exact).`,
          answer: "120",
          explain: md`$\cos C = \dfrac{9 + 25 - 49}{2(3)(5)} = \dfrac{-15}{30} = -\dfrac12$, and the angle between $0^\circ$ and $180^\circ$ with cosine $-\frac12$ is $120^\circ$.`,
        },
      ],
      practice: [cosinesExact, cosinesRounded, cosinesAngleExact],
    },
    {
      id: slug("Area of a triangle"),
      title: "Area of a triangle",
      summary: "Half the base times the height, with the height supplied by sine: K = ½ab sin C. Then Heron's formula, which needs only the three sides, and where it comes from.",
      blocks: [
        {
          kind: "text",
          body: md`From Geometry, the area of a triangle is $\frac12 \cdot \text{base} \cdot \text{height}$. The catch is that the height is rarely given; you are usually told sides and angles. Trigonometry turns a side and an angle into a height, and the formula that results is worth memorizing.`,
        },
        {
          kind: "diagram",
          view: [-1.5, 8.5, -1.5, 6],
          points: [
            { name: "C", x: 0, y: 0, dir: "sw" },
            { name: "B", x: 7, y: 0, dir: "se" },
            { name: "A", x: 2.5, y: 4.5, dir: "n" },
            { name: "D", x: 2.5, y: 0, dir: "s" },
          ],
          segments: [
            { from: "C", to: "B", label: "a" },
            { from: "C", to: "A", label: "b" },
            { from: "A", to: "B" },
            { from: "A", to: "D", dashed: true, label: "h", color: 2 },
          ],
          angles: [
            { at: "C", from: "B", to: "A", label: "C" },
            { at: "D", from: "B", to: "A", right: true },
          ],
          caption: md`Take $a$ as the base. The height is the altitude from $A$, and it is the opposite side of a right triangle with hypotenuse $b$ and angle $C$.`,
        },
        {
          kind: "why",
          title: "Why K = ½ab sin C",
          body: md`Use side $a$ as the base and drop the altitude $h$ from $A$ to the line through $C$ and $B$. In the right triangle $ACD$, $h$ is opposite the angle $C$ and the hypotenuse is $b$, so

$$\sin C = \frac{h}{b}, \qquad h = b \sin C.$$

Substitute into the area formula:

$$K = \tfrac12 \cdot a \cdot h = \tfrac12 a b \sin C.$$

If $C$ is obtuse, the foot $D$ lands outside the triangle and the right triangle has angle $180^\circ - C$ at $C$. But $\sin(180^\circ - C) = \sin C$, so $h = b \sin C$ anyway. If $C = 90^\circ$, $\sin C = 1$ and the formula says $\frac12 ab$: the two legs, as it should.

Nothing special about $C$: any angle works with the two sides that form it.`,
        },
        {
          kind: "key",
          title: "Area from two sides and the included angle",
          body: md`$$K = \tfrac12 ab \sin C = \tfrac12 bc \sin A = \tfrac12 ac \sin B.$$

In words: half the product of two sides times the sine of the angle **between** them. The angle must be the included one; the sine of a different angle gives a different (wrong) height.`,
        },
        {
          kind: "example",
          title: "Exact area",
          problem: md`Find the area of a triangle with sides $8$ and $5$ meeting at an angle of $60^\circ$.`,
          steps: [
            { math: md`K = \tfrac12 (8)(5) \sin 60^\circ`, note: "Two sides and the included angle." },
            { math: md`K = 20 \cdot \frac{\sqrt3}{2}`, note: md`$\sin 60^\circ = \frac{\sqrt3}{2}$.` },
            { math: md`K = 10\sqrt3`, note: md`About $17.3$. Less than the $20$ a right angle would give, since the sides lean together.` },
          ],
        },
        {
          kind: "example",
          title: "Rounded area",
          problem: md`In $\triangle ABC$, $a = 12$, $c = 9$ and $B = 112^\circ$. Find the area to one decimal place.`,
          steps: [
            { math: md`K = \tfrac12 ac \sin B`, note: md`$B$ is the angle between $a$ and $c$, so that is the version to use.` },
            { math: md`K = \tfrac12 (12)(9) \sin 112^\circ \approx 54(0.9272)`, note: "An obtuse angle still has a positive sine." },
            { math: md`K \approx 50.1`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the area of $\triangle ABC$ with $a = 6$, $b = 4$ and $C = 150^\circ$. Give an exact answer.`,
          answer: "6",
          simplified: true,
          explain: md`$K = \frac12 (6)(4) \sin 150^\circ = 12 \cdot \frac12 = 6$. The sine of $150^\circ$ equals the sine of $30^\circ$.`,
        },
        {
          kind: "text",
          body: md`**Three sides, no angles.** You could find an angle with the law of cosines and then use $\frac12 ab \sin C$. There is a shortcut that skips the angle entirely. It has been known since Heron of Alexandria, about two thousand years ago.`,
        },
        {
          kind: "key",
          title: "Heron's formula",
          body: md`For a triangle with sides $a$, $b$, $c$, let $s = \dfrac{a + b + c}{2}$ be the **semiperimeter**. Then

$$K = \sqrt{s(s - a)(s - b)(s - c)}.$$`,
        },
        {
          kind: "why",
          title: "Where Heron's formula comes from",
          body: md`It is the two laws of this unit combined, with the angle eliminated. Start from $K = \frac12 ab\sin C$, so $16K^2 = 4a^2b^2\sin^2 C = 4a^2b^2(1 - \cos^2 C)$ by the Pythagorean identity. The law of cosines gives $2ab\cos C = a^2 + b^2 - c^2$, so $4a^2b^2\cos^2 C = (a^2 + b^2 - c^2)^2$, and

$$16K^2 = (2ab)^2 - (a^2 + b^2 - c^2)^2.$$

That is a difference of squares, $(2ab - a^2 - b^2 + c^2)(2ab + a^2 + b^2 - c^2)$. Each bracket is itself a difference of squares:

$$2ab - a^2 - b^2 + c^2 = c^2 - (a - b)^2 = (c - a + b)(c + a - b),$$
$$2ab + a^2 + b^2 - c^2 = (a + b)^2 - c^2 = (a + b - c)(a + b + c).$$

So $16K^2 = (a + b + c)(-a + b + c)(a - b + c)(a + b - c)$. Each factor is twice one of $s$, $s - a$, $s - b$, $s - c$: for instance $-a + b + c = 2s - 2a = 2(s - a)$. The four factors of 2 make the 16, and dividing it out leaves $K^2 = s(s-a)(s-b)(s-c)$.`,
        },
        {
          kind: "example",
          title: "Heron's formula",
          problem: md`Find the area of a triangle with sides $13$, $14$ and $15$.`,
          steps: [
            { math: md`s = \frac{13 + 14 + 15}{2} = 21`, note: "Semiperimeter." },
            { math: md`K = \sqrt{21(21 - 13)(21 - 14)(21 - 15)} = \sqrt{21 \cdot 8 \cdot 7 \cdot 6}`, note: "Heron." },
            { math: md`K = \sqrt{7056} = 84`, note: md`Check with the other method: $\cos C = \frac{169 + 196 - 225}{2 \cdot 13 \cdot 14} = \frac{140}{364} = \frac{5}{13}$, so $\sin C = \frac{12}{13}$ and $K = \frac12 (13)(14)\frac{12}{13} = 84$.` },
          ],
        },
        {
          kind: "text",
          body: md`**Two angles and a side.** The area formula needs two sides. With ASA or AAS, find the third angle, use the law of sines for a second side, and then $\frac12 (\text{side})(\text{side})\sin(\text{included angle})$. Keep the unrounded side in your calculator; rounding it early shifts the area.

**Summary of the unit.** Every oblique triangle is solved by one of two laws, both proved from right triangles: the law of sines, from a shared altitude, and the law of cosines, from the distance formula. Area is $\frac12 ab \sin C$ when an angle is known and Heron's formula when none is, and Heron's formula is the two laws combined.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of a triangle with sides $5$, $5$ and $6$.`,
          answer: "12",
          explain: md`$s = 8$, and $K = \sqrt{8 \cdot 3 \cdot 3 \cdot 2} = \sqrt{144} = 12$. (Or: the altitude to the side of length 6 is $\sqrt{25 - 9} = 4$, and $\frac12 \cdot 6 \cdot 4 = 12$.)`,
        },
      ],
      practice: [areaExact, heron, areaRounded],
    },
  ],
};
