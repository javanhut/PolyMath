import { frac, fracTex, gcd, poly, signed } from "../../math/random";
import { md, slug, type Block, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** (n/d)·pi as typed answer text: "3pi/2", "pi", "-pi/6", "0". */
function piText(n: number, d: number, power = 1): string {
  if (n === 0) return "0";
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  const p = power === 1 ? "pi" : `pi^${power}`;
  const mag = Math.abs(n) === 1 ? p : `${Math.abs(n)}${p}`;
  return `${n < 0 ? "-" : ""}${mag}${d === 1 ? "" : `/${d}`}`;
}

/** (n/d)·pi as LaTeX. */
function piTex(n: number, d: number, power = 1): string {
  if (n === 0) return "0";
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  const p = power === 1 ? "\\pi" : `\\pi^${power}`;
  const mag = Math.abs(n) === 1 ? p : `${Math.abs(n)}${p}`;
  const sign = n < 0 ? "-" : "";
  return d === 1 ? `${sign}${mag}` : `${sign}\\frac{${mag}}{${d}}`;
}

/** (n/d)·sqrt(R) as answer text and LaTeX; R = 1 is a plain fraction. */
function surd(n: number, d: number, R: number): { text: string; tex: string } {
  if (R === 1 || n === 0) return { text: frac(n, d), tex: fracTex(n, d) };
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  const sign = n < 0 ? "-" : "";
  const c = Math.abs(n) === 1 ? "" : String(Math.abs(n));
  return {
    text: `${sign}${c}sqrt(${R})${d === 1 ? "" : `/${d}`}`,
    tex: d === 1 ? `${sign}${c}\\sqrt{${R}}` : `${sign}\\frac{${c}\\sqrt{${R}}}{${d}}`,
  };
}

/** (N pi + M)/D reduced, as text and LaTeX: "(5pi - 8)/4", "pi + 8". */
function linPi(N: number, M: number, D: number): { text: string; tex: string } {
  const g = [N, M, D].reduce((a, b) => gcd(a, b), 0) || 1;
  N /= g;
  M /= g;
  D /= g;
  const inner = `${Math.abs(N) === 1 ? "" : N}pi ${signed(M)}`;
  const innerTex = `${Math.abs(N) === 1 ? "" : N}\\pi ${signed(M)}`;
  return D === 1 ? { text: inner, tex: innerTex } : { text: `(${inner})/${D}`, tex: `\\frac{${innerTex}}{${D}}` };
}

/** (N pi + M sqrt(R))/D reduced. */
function surdPi(N: number, M: number, R: number, D: number): { text: string; tex: string } {
  const g = [N, M, D].reduce((a, b) => gcd(a, b), 0) || 1;
  N /= g;
  M /= g;
  D /= g;
  const inner = `${N}pi + ${M}sqrt(${R})`;
  const innerTex = `${N}\\pi + ${M}\\sqrt{${R}}`;
  return D === 1 ? { text: inner, tex: innerTex } : { text: `(${inner})/${D}`, tex: `\\frac{${innerTex}}{${D}}` };
}

/** A coefficient in front of a LaTeX body: 1 and -1 are hidden. */
const coefTex = (c: number, body: string) => (c === 1 ? body : c === -1 ? `-${body}` : `${c}${body}`);

/** The angle n·pi/d. */
interface Ang {
  n: number;
  d: number;
}
const angTex = (a: Ang) => piTex(a.n, a.d);
/** Parenthesised typed form for verify equations: "(pi/6)". */
const angText = (a: Ang) => `(${piText(a.n, a.d)})`;

// ── Lesson 1 generators ─────────────────────────────────────────────────────

/** cot(n pi/d) = (p/q) sqrt(R). */
const COT = [
  { n: 1, d: 6, p: 1, q: 1, R: 3 },
  { n: 1, d: 4, p: 1, q: 1, R: 1 },
  { n: 1, d: 3, p: 1, q: 3, R: 3 },
  { n: 2, d: 3, p: -1, q: 3, R: 3 },
  { n: 3, d: 4, p: -1, q: 1, R: 1 },
  { n: 5, d: 6, p: -1, q: 1, R: 3 },
];

/** 1/sin^3(n pi/d) = k sqrt(R), with sin^3 itself as LaTeX. */
const SIN3 = [
  { n: 1, d: 6, k: 8, R: 1, sin3: "\\tfrac18" },
  { n: 5, d: 6, k: 8, R: 1, sin3: "\\tfrac18" },
  { n: 1, d: 2, k: 1, R: 1, sin3: "1" },
  { n: 3, d: 2, k: -1, R: 1, sin3: "-1" },
  { n: 7, d: 6, k: -8, R: 1, sin3: "-\\tfrac18" },
  { n: 11, d: 6, k: -8, R: 1, sin3: "-\\tfrac18" },
  { n: 1, d: 4, k: 2, R: 2, sin3: "\\tfrac{\\sqrt2}{4}" },
  { n: 3, d: 4, k: 2, R: 2, sin3: "\\tfrac{\\sqrt2}{4}" },
  { n: 5, d: 4, k: -2, R: 2, sin3: "-\\tfrac{\\sqrt2}{4}" },
  { n: 7, d: 4, k: -2, R: 2, sin3: "-\\tfrac{\\sqrt2}{4}" },
];

const parametricSlope: Generator = (r) => {
  const kind = r.int(0, 4);
  const format = "Give an exact value (a fraction or a surd if needed).";
  if (kind === 0 || kind === 3) {
    const a = r.int(1, 3);
    const c = r.int(-3, 3);
    const d = r.pick([1, 2, 3, 4, 6, 12]);
    const t0 = r.nonzero(-3, 3);
    const xT = poly([[a, "t^2"], [c, ""]]);
    const yT = poly([[1, "t^3"], [-d, "t"]]);
    const xp = poly([[2 * a, "t"]]);
    const yp = poly([[3, "t^2"], [-d, ""]]);
    const dx = 2 * a * t0;
    const dy = 3 * t0 * t0 - d;
    if (kind === 0) {
      return {
        prompt: md`A curve is given by $x = ${xT}, \quad y = ${yT}$. Find $\frac{dy}{dx}$ at $t = ${t0}$. ${format}`,
        answer: frac(dy, dx),
        simplified: true,
        verify: [`q = (3(${t0})^2 - ${d})/(2*${a}*(${t0}))`],
        hint: md`Differentiate each coordinate with respect to $t$, then divide: $\frac{dy}{dx} = \frac{dy/dt}{dx/dt}$. Substitute $t = ${t0}$ last.`,
        solution: [
          { math: md`\frac{dx}{dt} = ${xp}, \qquad \frac{dy}{dt} = ${yp}`, note: "Differentiate each coordinate with respect to $t$." },
          { math: md`\frac{dy}{dx} = \frac{${yp}}{${xp}}`, note: "Divide. This is the slope at the point with parameter $t$." },
          { math: md`t = ${t0}: \quad \frac{dy}{dx} = \frac{${dy}}{${dx}} = ${fracTex(dy, dx)}`, note: md`$3(${t0})^2 - ${d} = ${dy}$ and $${2 * a}(${t0}) = ${dx}$.` },
        ],
      };
    }
    const num = 3 * t0 * t0 + d;
    const den = 4 * a * a * t0 ** 3;
    return {
      prompt: md`A curve is given by $x = ${xT}, \quad y = ${yT}$. Find $\frac{d^2y}{dx^2}$ at $t = ${t0}$. ${format}`,
      answer: frac(num, den),
      simplified: true,
      verify: [`q = ((6(${t0}))(2*${a}*(${t0})) - (3(${t0})^2 - ${d})(2*${a}))/((2*${a}*(${t0}))^3)`],
      hint: md`First find $\frac{dy}{dx}$ as a function of $t$. Then differentiate **that** with respect to $t$ and divide by $\frac{dx}{dt}$ once more.`,
      solution: [
        { math: md`\frac{dy}{dx} = \frac{${yp}}{${xp}}`, note: md`$\frac{dy/dt}{dx/dt}$, a function of $t$.` },
        {
          math: md`\frac{d}{dt}\left(\frac{dy}{dx}\right) = \frac{(6t)(${xp}) - (${yp})(${2 * a})}{(${xp})^2} = \frac{${poly([[3, "t^2"], [d, ""]])}}{${poly([[2 * a, "t^2"]])}}`,
          note: md`Quotient rule. The numerator is $${12 * a}t^2 - ${6 * a}t^2 + ${2 * a * d} = ${2 * a}(${poly([[3, "t^2"], [d, ""]])})$, and the $${2 * a}$ cancels against the denominator $${4 * a * a}t^2$.`,
        },
        { math: md`\frac{d^2y}{dx^2} = \frac{${poly([[3, "t^2"], [d, ""]])}}{${poly([[2 * a, "t^2"]])}} \cdot \frac{1}{${xp}} = \frac{${poly([[3, "t^2"], [d, ""]])}}{${poly([[4 * a * a, "t^3"]])}}`, note: md`Divide by $\frac{dx}{dt}$ again.` },
        { math: md`t = ${t0}: \quad \frac{d^2y}{dx^2} = \frac{${num}}{${den}} = ${fracTex(num, den)}`, note: md`$3(${t0})^2 + ${d} = ${num}$ and $${4 * a * a}(${t0})^3 = ${den}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 4);
    const b = r.pick([1, 2, 3, 4, 5].filter((v) => v !== a));
    const T = r.pick(COT);
    const cot = surd(T.p, T.q, T.R);
    const ans = surd(-b * T.p, a * T.q, T.R);
    return {
      prompt: md`A curve is given by $x = ${coefTex(a, "\\cos t")}, \quad y = ${coefTex(b, "\\sin t")}$. Find $\frac{dy}{dx}$ at $t = ${angTex(T)}$. ${format}`,
      answer: ans.text,
      simplified: true,
      verify: [`q = (${b} cos${angText(T)})/(-${a} sin${angText(T)})`],
      hint: md`$\frac{dx}{dt} = -${coefTex(a, "\\sin t")}$ and $\frac{dy}{dt} = ${coefTex(b, "\\cos t")}$. Their ratio is a multiple of $\cot t$.`,
      solution: [
        { math: md`\frac{dx}{dt} = -${coefTex(a, "\\sin t")}, \qquad \frac{dy}{dt} = ${coefTex(b, "\\cos t")}`, note: "Differentiate each coordinate." },
        { math: md`\frac{dy}{dx} = \frac{${coefTex(b, "\\cos t")}}{-${coefTex(a, "\\sin t")}} = -${fracTex(b, a)}\cot t`, note: md`The slope of the ellipse at parameter $t$.` },
        { math: md`t = ${angTex(T)}: \quad \cot ${angTex(T)} = ${cot.tex}, \qquad \frac{dy}{dx} = -${fracTex(b, a)} \cdot ${T.p < 0 ? `\\left(${cot.tex}\\right)` : cot.tex} = ${ans.tex}`, note: md`$\cot t = \frac{\cos t}{\sin t}$ at a special angle.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.pick([2, 3]);
    const c = r.int(0, 5);
    const t0 = r.int(1, 3);
    const yT = poly([[1, `t^${n}`], [-c, "t"]]);
    const yp = poly([[n, n === 2 ? "t" : "t^2"], [-c, ""]]);
    const ans = n * t0 ** n - c * t0;
    return {
      prompt: md`A curve is given by $x = \ln t, \quad y = ${yT}$ for $t > 0$. Find $\frac{dy}{dx}$ at $t = ${t0}$. ${format}`,
      answer: String(ans),
      verify: [`q = (${n}(${t0})^${n - 1} - ${c})/(1/${t0})`],
      hint: md`$\frac{dx}{dt} = \frac{1}{t}$. Dividing by $\frac{1}{t}$ is multiplying by $t$.`,
      solution: [
        { math: md`\frac{dx}{dt} = \frac{1}{t}, \qquad \frac{dy}{dt} = ${yp}`, note: "Differentiate each coordinate." },
        { math: md`\frac{dy}{dx} = \frac{${yp}}{1/t} = t(${yp}) = ${poly([[n, `t^${n}`], [-c, "t"]])}`, note: md`Dividing by $\frac1t$ multiplies by $t$.` },
        { math: md`t = ${t0}: \quad \frac{dy}{dx} = ${n} \cdot ${t0 ** n} ${c ? `- ${c * t0}` : ""} = ${ans}`, note: "" },
      ],
    };
  }
  const a = r.int(1, 3);
  const b = r.pick([1, 2, 3, 4].filter((v) => v !== a));
  const T = r.pick(SIN3);
  const ans = surd(-b * T.k, a * a, T.R);
  return {
    prompt: md`A curve is given by $x = ${coefTex(a, "\\cos t")}, \quad y = ${coefTex(b, "\\sin t")}$. Find $\frac{d^2y}{dx^2}$ at $t = ${angTex(T)}$. ${format}`,
    answer: ans.text,
    simplified: true,
    verify: [`q = ((-${b} sin${angText(T)})(-${a} sin${angText(T)}) - (${b} cos${angText(T)})(-${a} cos${angText(T)}))/((-${a} sin${angText(T)})^3)`],
    hint: md`$\frac{dy}{dx} = -\frac{${b}}{${a}}\cot t$. Differentiate that with respect to $t$ (remember $(\cot t)' = -\csc^2 t$), then divide by $\frac{dx}{dt} = -${coefTex(a, "\\sin t")}$.`,
    solution: [
      { math: md`\frac{dy}{dx} = \frac{${coefTex(b, "\\cos t")}}{-${coefTex(a, "\\sin t")}} = -${fracTex(b, a)}\cot t`, note: "The first derivative, as a function of $t$." },
      { math: md`\frac{d}{dt}\left(\frac{dy}{dx}\right) = ${fracTex(b, a)}\csc^2 t`, note: md`$(\cot t)' = -\csc^2 t$, and the two minus signs cancel.` },
      { math: md`\frac{d^2y}{dx^2} = \frac{${fracTex(b, a)}\csc^2 t}{-${coefTex(a, "\\sin t")}} = -\frac{${b}}{${a * a}\sin^3 t}`, note: md`Divide by $\frac{dx}{dt}$. $\csc^2 t \cdot \frac{1}{\sin t} = \frac{1}{\sin^3 t}$.` },
      { math: md`t = ${angTex(T)}: \quad \sin^3 t = ${T.sin3}, \qquad \frac{d^2y}{dx^2} = ${ans.tex}`, note: md`A negative value means the curve is concave down there; positive, concave up.` },
    ],
  };
};

const parametricTangents: Generator = (r) => {
  const kind = r.int(0, 2);
  const format = "Separate several values with commas; if there is only one, write just that value.";
  if (kind === 0 || kind === 1) {
    const q = r.pick([1, 2]);
    let m = r.nonzero(-3, 3);
    while (Math.abs(m) === q) m = r.nonzero(-3, 3);
    const quad = poly([[1, "t^2"], [2 * m, "t"]]);
    const cubic = poly([[1, "t^3"], [-3 * q * q, "t"]]);
    const quadP = poly([[2, "t"], [2 * m, ""]]);
    const cubicP = poly([[3, "t^2"], [-3 * q * q, ""]]);
    const horizontal = r.next() < 0.55;
    // kind 0: x quadratic, y cubic. kind 1: x cubic, y quadratic.
    const [xT, yT, xp, yp] = kind === 0 ? [quad, cubic, quadP, cubicP] : [cubic, quad, cubicP, quadP];
    const curve = md`$x = ${xT}, \quad y = ${yT}$`;
    const cubicRoots = `${-q}, ${q}`;
    const quadRoot = String(-m);
    const cubicSolve: Step[] = [
      { math: md`${cubicP} = 0 \;\Rightarrow\; t^2 = ${q * q} \;\Rightarrow\; t = \pm ${q}`, note: "Set the derivative to zero and solve." },
      { math: md`t = \pm ${q}: \quad ${quadP} = ${2 * m + 2 * q} \text{ and } ${2 * m - 2 * q}`, note: md`The other derivative, $${quadP}$, is not zero at either value, so these are genuine ${kind === 0 ? "horizontal" : "vertical"} tangents.` },
    ];
    const quadSolve: Step[] = [
      { math: md`${quadP} = 0 \;\Rightarrow\; t = ${-m}`, note: "Set the derivative to zero and solve." },
      { math: md`t = ${-m}: \quad ${cubicP} = ${3 * m * m - 3 * q * q} \ne 0`, note: md`The other derivative is not zero there, so the tangent really is ${kind === 0 ? "vertical" : "horizontal"}.` },
    ];
    const wantCubic = (kind === 0) === horizontal;
    return {
      prompt: md`The curve ${curve} has a ${horizontal ? "horizontal" : "vertical"} tangent at one or more values of $t$. Find them all. ${format}`,
      answer: wantCubic ? cubicRoots : quadRoot,
      form: "set",
      verify: [wantCubic ? `3t^2 - ${3 * q * q} = 0` : `2t ${signed(2 * m)} = 0`],
      hint: horizontal
        ? md`A horizontal tangent has slope $0$: $\frac{dy}{dt} = 0$ while $\frac{dx}{dt} \ne 0$.`
        : md`A vertical tangent has undefined slope: $\frac{dx}{dt} = 0$ while $\frac{dy}{dt} \ne 0$.`,
      solution: [
        { math: md`\frac{dx}{dt} = ${xp}, \qquad \frac{dy}{dt} = ${yp}`, note: md`${horizontal ? "Horizontal" : "Vertical"} tangents come from $\frac{${horizontal ? "dy" : "dx"}}{dt} = 0$.` },
        ...(wantCubic ? cubicSolve : quadSolve),
      ],
    };
  }
  const trig = r.int(0, 1);
  const horizontal = r.next() < 0.5;
  if (trig === 0) {
    return {
      prompt: md`The curve $x = \cos t, \quad y = \sin 2t$ for $0 \le t < 2\pi$ has a ${horizontal ? "horizontal" : "vertical"} tangent at one or more values of $t$. Find them all. ${format} Write $\pi$ as pi.`,
      answer: horizontal ? "pi/4, 3pi/4, 5pi/4, 7pi/4" : "0, pi",
      form: "set",
      verify: [horizontal ? "2cos(2t) = 0" : "-sin(t) = 0"],
      hint: horizontal ? md`$\frac{dy}{dt} = 2\cos 2t$. Where is it zero in $[0, 2\pi)$, and is $\frac{dx}{dt} = -\sin t$ nonzero there?` : md`$\frac{dx}{dt} = -\sin t$. Where is it zero in $[0, 2\pi)$, and is $\frac{dy}{dt} = 2\cos 2t$ nonzero there?`,
      solution: horizontal
        ? [
            { math: md`\frac{dx}{dt} = -\sin t, \qquad \frac{dy}{dt} = 2\cos 2t`, note: "" },
            { math: md`2\cos 2t = 0 \;\Rightarrow\; 2t = \frac{\pi}{2}, \frac{3\pi}{2}, \frac{5\pi}{2}, \frac{7\pi}{2} \;\Rightarrow\; t = \frac{\pi}{4}, \frac{3\pi}{4}, \frac{5\pi}{4}, \frac{7\pi}{4}`, note: md`$2t$ runs through $[0, 4\pi)$, so cosine vanishes four times.` },
            { math: md`\sin t = \pm\frac{\sqrt2}{2} \ne 0`, note: md`At each of these, $\frac{dx}{dt} \ne 0$, so all four are horizontal tangents. This figure-eight has a top and a bottom on each lobe.` },
          ]
        : [
            { math: md`\frac{dx}{dt} = -\sin t, \qquad \frac{dy}{dt} = 2\cos 2t`, note: "" },
            { math: md`-\sin t = 0 \;\Rightarrow\; t = 0, \pi`, note: md`In $[0, 2\pi)$.` },
            { math: md`t = 0, \pi: \quad 2\cos 2t = 2 \ne 0`, note: md`So the tangents are vertical there: at the far right $(1, 0)$ and the far left $(-1, 0)$ of the figure-eight.` },
          ],
    };
  }
  const a = r.int(1, 4);
  const b = r.pick([1, 2, 3, 4, 5].filter((v) => v !== a));
  return {
    prompt: md`The ellipse $x = ${coefTex(a, "\\cos t")}, \quad y = ${coefTex(b, "\\sin t")}$ for $0 \le t < 2\pi$ has a ${horizontal ? "horizontal" : "vertical"} tangent at one or more values of $t$. Find them all. ${format} Write $\pi$ as pi.`,
    answer: horizontal ? "pi/2, 3pi/2" : "0, pi",
    form: "set",
    verify: [horizontal ? `${b}cos(t) = 0` : `-${a}sin(t) = 0`],
    hint: horizontal ? md`$\frac{dy}{dt} = ${coefTex(b, "\\cos t")}$ vanishes at the top and bottom of the ellipse.` : md`$\frac{dx}{dt} = -${coefTex(a, "\\sin t")}$ vanishes at the left and right ends of the ellipse.`,
    solution: [
      { math: md`\frac{dx}{dt} = -${coefTex(a, "\\sin t")}, \qquad \frac{dy}{dt} = ${coefTex(b, "\\cos t")}`, note: "" },
      horizontal
        ? { math: md`${coefTex(b, "\\cos t")} = 0 \;\Rightarrow\; t = \frac{\pi}{2}, \frac{3\pi}{2}`, note: md`There $\sin t = \pm 1$, so $\frac{dx}{dt} \ne 0$: horizontal tangents at $(0, ${b})$ and $(0, -${b})$.` }
        : { math: md`-${coefTex(a, "\\sin t")} = 0 \;\Rightarrow\; t = 0, \pi`, note: md`There $\cos t = \pm 1$, so $\frac{dy}{dt} \ne 0$: vertical tangents at $(${a}, 0)$ and $(-${a}, 0)$.` },
    ],
  };
};

const parametricArcLength: Generator = (r) => {
  const kind = r.int(0, 5);
  const format = "Give an exact value (use pi, sqrt and e as needed).";
  if (kind === 0) {
    const [p, q, h] = r.pick([
      [3, 4, 5],
      [6, 8, 10],
      [5, 12, 13],
      [8, 15, 17],
    ]);
    const a = p * r.sign();
    const b = q * r.sign();
    const c = r.int(-3, 3);
    const d = r.int(-3, 3);
    const t0 = r.int(0, 1);
    const t1 = t0 + r.int(1, 4);
    return {
      prompt: md`Find the length of the curve $x = ${poly([[a, "t"], [c, ""]])}, \quad y = ${poly([[b, "t"], [d, ""]])}$ for $${t0} \le t \le ${t1}$. ${format}`,
      answer: String(h * (t1 - t0)),
      hint: md`$\frac{dx}{dt}$ and $\frac{dy}{dt}$ are constants here, so the speed $\sqrt{(dx/dt)^2 + (dy/dt)^2}$ is a constant too.`,
      solution: [
        { math: md`\frac{dx}{dt} = ${a}, \qquad \frac{dy}{dt} = ${b}`, note: "" },
        { math: md`\sqrt{(${a})^2 + (${b})^2} = \sqrt{${a * a + b * b}} = ${h}`, note: "The speed: constant, because the point moves along a straight line at a steady rate." },
        { math: md`L = \int_{${t0}}^{${t1}} ${h}\, dt = ${h}(${t1} - ${t0}) = ${h * (t1 - t0)}`, note: md`Distance is speed times time. The distance formula between the endpoints gives the same answer.` },
      ],
    };
  }
  if (kind === 1) {
    const R = r.int(1, 4);
    const B = r.pick<Ang>([
      { n: 1, d: 2 },
      { n: 1, d: 1 },
      { n: 3, d: 2 },
      { n: 2, d: 1 },
      { n: 1, d: 3 },
      { n: 2, d: 3 },
      { n: 1, d: 4 },
      { n: 3, d: 4 },
    ]);
    return {
      prompt: md`Find the length of the curve $x = ${coefTex(R, "\\cos t")}, \quad y = ${coefTex(R, "\\sin t")}$ for $0 \le t \le ${angTex(B)}$. ${format}`,
      answer: piText(R * B.n, B.d),
      simplified: true,
      hint: md`The speed simplifies with $\sin^2 t + \cos^2 t = 1$. The answer should agree with the geometry of a circular arc.`,
      solution: [
        { math: md`\frac{dx}{dt} = -${coefTex(R, "\\sin t")}, \qquad \frac{dy}{dt} = ${coefTex(R, "\\cos t")}`, note: "" },
        { math: md`\sqrt{${R * R}\sin^2 t + ${R * R}\cos^2 t} = ${R}`, note: md`Constant speed $${R}$: the point goes round a circle of radius $${R}$ at one radian per unit time.` },
        { math: md`L = \int_0^{${angTex(B)}} ${R}\, dt = ${piTex(R * B.n, B.d)}`, note: md`Arc length $= r\theta$, as in Geometry.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 3);
    const B = r.pick([
      { tex: "1", sq: 1, text: `${4 * k}sqrt(2) - ${2 * k}`, ansTex: `${4 * k}\\sqrt2 - ${2 * k}`, pow: "2\\sqrt2" },
      { tex: "\\sqrt3", sq: 3, text: String(14 * k), ansTex: String(14 * k), pow: "8" },
      { tex: "2", sq: 4, text: `${10 * k}sqrt(5) - ${2 * k}`, ansTex: `${10 * k}\\sqrt5 - ${2 * k}`, pow: "5\\sqrt5" },
      { tex: "2\\sqrt2", sq: 8, text: String(52 * k), ansTex: String(52 * k), pow: "27" },
    ]);
    return {
      prompt: md`Find the length of the curve $x = ${3 * k}t^2, \quad y = ${2 * k}t^3$ for $0 \le t \le ${B.tex}$. ${format}`,
      answer: B.text,
      hint: md`Under the root, factor out $${36 * k * k}t^2$. Then substitute $u = 1 + t^2$.`,
      solution: [
        { math: md`\frac{dx}{dt} = ${6 * k}t, \qquad \frac{dy}{dt} = ${6 * k}t^2`, note: "" },
        { math: md`\sqrt{${36 * k * k}t^2 + ${36 * k * k}t^4} = ${6 * k}t\sqrt{1 + t^2}`, note: md`$t \ge 0$ on the interval, so $\sqrt{t^2} = t$.` },
        { math: md`L = \int_0^{${B.tex}} ${6 * k}t\sqrt{1 + t^2}\, dt = ${3 * k}\int_1^{${1 + B.sq}} \sqrt{u}\, du`, note: md`$u = 1 + t^2$, $du = 2t\,dt$; the limits become $1$ and $1 + ${B.sq} = ${1 + B.sq}$.` },
        { math: md`= ${3 * k} \cdot \tfrac23 \Big[u^{3/2}\Big]_1^{${1 + B.sq}} = ${2 * k}\left(${B.pow} - 1\right) = ${B.ansTex}`, note: md`$${1 + B.sq}^{3/2} = ${B.pow}$.` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.int(1, 3);
    const full = r.next() < 0.6;
    return {
      prompt: md`Find the length of the cycloid $x = ${coefTex(a, "t")} - ${coefTex(a, "\\sin t")}, \quad y = ${a} - ${coefTex(a, "\\cos t")}$ for $0 \le t \le ${full ? "2\\pi" : "\\pi"}$. ${format}`,
      answer: String(full ? 8 * a : 4 * a),
      hint: md`After expanding, $\sin^2 t + \cos^2 t = 1$ leaves $${2 * a * a} - ${2 * a * a}\cos t$. Use the half-angle identity $1 - \cos t = 2\sin^2\frac{t}{2}$.`,
      solution: [
        { math: md`\frac{dx}{dt} = ${a} - ${coefTex(a, "\\cos t")}, \qquad \frac{dy}{dt} = ${coefTex(a, "\\sin t")}`, note: "" },
        { math: md`\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2 = ${a * a}(1 - 2\cos t + \cos^2 t) + ${a * a}\sin^2 t = ${2 * a * a}(1 - \cos t)`, note: md`$\cos^2 t + \sin^2 t = 1$.` },
        { math: md`${2 * a * a}(1 - \cos t) = ${4 * a * a}\sin^2\frac{t}{2}`, note: md`Half-angle identity.` },
        { math: md`L = \int_0^{${full ? "2\\pi" : "\\pi"}} ${2 * a}\sin\frac{t}{2}\, dt = \Big[-${4 * a}\cos\frac{t}{2}\Big]_0^{${full ? "2\\pi" : "\\pi"}} = ${full ? 8 * a : 4 * a}`, note: md`$\sin\frac{t}{2} \ge 0$ on the interval, so the square root is $${2 * a}\sin\frac t2$ with no absolute value. ${full ? `A full arch is $8$ times the radius $${a}$.` : `Half an arch is $4$ times the radius $${a}$.`}` },
      ],
    };
  }
  if (kind === 4) {
    const B = r.pick([
      { tex: "1", text: "sqrt(2)(e - 1)", ansTex: "\\sqrt2\\,(e - 1)", eb: "e" },
      { tex: "2", text: "sqrt(2)(e^2 - 1)", ansTex: "\\sqrt2\\,(e^2 - 1)", eb: "e^2" },
      { tex: "\\ln 2", text: "sqrt(2)", ansTex: "\\sqrt2", eb: "2" },
      { tex: "\\ln 3", text: "2sqrt(2)", ansTex: "2\\sqrt2", eb: "3" },
      { tex: "\\pi", text: "sqrt(2)(e^pi - 1)", ansTex: "\\sqrt2\\,(e^{\\pi} - 1)", eb: "e^{\\pi}" },
    ]);
    return {
      prompt: md`Find the length of the spiral $x = e^{t}\cos t, \quad y = e^{t}\sin t$ for $0 \le t \le ${B.tex}$. ${format}`,
      answer: B.text,
      hint: md`Product rule for each coordinate, then square and add. The cross terms cancel and $\sin^2 t + \cos^2 t = 1$ does the rest.`,
      solution: [
        { math: md`\frac{dx}{dt} = e^{t}(\cos t - \sin t), \qquad \frac{dy}{dt} = e^{t}(\sin t + \cos t)`, note: "Product rule." },
        { math: md`\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2 = e^{2t}\left[(\cos t - \sin t)^2 + (\sin t + \cos t)^2\right] = 2e^{2t}`, note: md`The $-2\sin t\cos t$ and $+2\sin t\cos t$ cancel; the squares add to $2$.` },
        { math: md`L = \int_0^{${B.tex}} \sqrt2\, e^{t}\, dt = \sqrt2\left(${B.eb} - 1\right) = ${B.ansTex}`, note: md`The speed $\sqrt2\,e^{t}$ grows with the spiral, which is why its length is finite going inward ($t \to -\infty$) but not outward.` },
      ],
    };
  }
  const a = r.int(1, 4);
  const full = r.next() < 0.4;
  return {
    prompt: md`Find the length of the astroid $x = ${coefTex(a, "\\cos^3 t")}, \quad y = ${coefTex(a, "\\sin^3 t")}$ for $0 \le t \le ${full ? "2\\pi" : "\\frac{\\pi}{2}"}$. ${format}`,
    answer: full ? String(6 * a) : frac(3 * a, 2),
    simplified: true,
    hint: md`Chain rule on each coordinate, then factor $${9 * a * a}\sin^2 t\cos^2 t$ out of the sum of squares. ${full ? "Mind the absolute value: the speed is never negative." : ""}`,
    solution: [
      { math: md`\frac{dx}{dt} = -${3 * a}\cos^2 t\sin t, \qquad \frac{dy}{dt} = ${3 * a}\sin^2 t\cos t`, note: "Chain rule." },
      { math: md`\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2 = ${9 * a * a}\sin^2 t\cos^2 t\,(\cos^2 t + \sin^2 t) = ${9 * a * a}\sin^2 t\cos^2 t`, note: "" },
      { math: md`\sqrt{${9 * a * a}\sin^2 t\cos^2 t} = ${3 * a}\left|\sin t\cos t\right| = ${fracTex(3 * a, 2)}\left|\sin 2t\right|`, note: md`$2\sin t\cos t = \sin 2t$.` },
      full
        ? { math: md`L = 4\int_0^{\pi/2} ${fracTex(3 * a, 2)}\sin 2t\, dt = 4 \cdot ${fracTex(3 * a, 2)}\Big[-\tfrac12\cos 2t\Big]_0^{\pi/2} = 4 \cdot ${fracTex(3 * a, 2)} = ${6 * a}`, note: md`The astroid has four identical arms, one per quadrant, and $\sin 2t \ge 0$ on the first. Integrating $\sin 2t$ without the absolute value over $[0, 2\pi]$ would give $0$.` }
        : { math: md`L = \int_0^{\pi/2} ${fracTex(3 * a, 2)}\sin 2t\, dt = ${fracTex(3 * a, 2)}\Big[-\tfrac12\cos 2t\Big]_0^{\pi/2} = ${fracTex(3 * a, 2)}`, note: md`On $[0, \frac{\pi}{2}]$, $\sin 2t \ge 0$, so the absolute value can go.` },
    ],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

/** Exact slopes of the cardioid r = a(1 + cos θ): dy/dθ = a(cos θ + cos 2θ), dx/dθ = -a sin θ (1 + 2cos θ). */
const CARDIOID_SLOPES = [
  { n: 1, d: 6, cos: "\\tfrac{\\sqrt3}{2}", sin: "\\tfrac12", cos2: "\\tfrac12", slope: -1 },
  { n: 1, d: 3, cos: "\\tfrac12", sin: "\\tfrac{\\sqrt3}{2}", cos2: "-\\tfrac12", slope: 0 },
  { n: 1, d: 2, cos: "0", sin: "1", cos2: "-1", slope: 1 },
  { n: 5, d: 6, cos: "-\\tfrac{\\sqrt3}{2}", sin: "\\tfrac12", cos2: "\\tfrac12", slope: -1 },
  { n: 7, d: 6, cos: "-\\tfrac{\\sqrt3}{2}", sin: "-\\tfrac12", cos2: "\\tfrac12", slope: 1 },
  { n: 3, d: 2, cos: "0", sin: "-1", cos2: "-1", slope: -1 },
  { n: 5, d: 3, cos: "\\tfrac12", sin: "-\\tfrac{\\sqrt3}{2}", cos2: "-\\tfrac12", slope: 0 },
  { n: 11, d: 6, cos: "\\tfrac{\\sqrt3}{2}", sin: "-\\tfrac12", cos2: "\\tfrac12", slope: 1 },
];

/** tan 2θ and -cot 2θ at θ = n pi/d, as (p/q) sqrt(R). */
const DOUBLE = [
  { n: 1, d: 8, tan: [1, 1, 1], ncot: [-1, 1, 1] },
  { n: 1, d: 6, tan: [1, 1, 3], ncot: [-1, 3, 3] },
  { n: 1, d: 3, tan: [-1, 1, 3], ncot: [1, 3, 3] },
  { n: 3, d: 8, tan: [-1, 1, 1], ncot: [1, 1, 1] },
  { n: 2, d: 3, tan: [1, 1, 3], ncot: [-1, 3, 3] },
  { n: 5, d: 6, tan: [-1, 1, 3], ncot: [1, 3, 3] },
];

/** The verify equation for the slope of r = R(θ) at θ = T, with RP = dr/dθ. Both are typed expressions with T already substituted. */
const polarVerify = (R: string, RP: string, T: string) => `q = ((${RP}) sin${T} + (${R}) cos${T})/((${RP}) cos${T} - (${R}) sin${T})`;

const polarSlope: Generator = (r) => {
  const kind = r.int(0, 3);
  const format = "Give an exact value.";
  if (kind === 0) {
    const a = r.int(1, 3);
    const T = r.pick(CARDIOID_SLOPES);
    const A: Ang = T;
    return {
      prompt: md`Find the slope of the tangent line to the cardioid $r = ${a} + ${coefTex(a, "\\cos\\theta")}$ at $\theta = ${angTex(A)}$. ${format}`,
      answer: String(T.slope),
      verify: [polarVerify(`${a} + ${a} cos${angText(A)}`, `-${a} sin${angText(A)}`, angText(A))],
      hint: md`Write $x = r\cos\theta$, $y = r\sin\theta$ with $r = ${a} + ${coefTex(a, "\\cos\\theta")}$, differentiate both with the product rule, and divide.`,
      solution: [
        { math: md`\frac{dr}{d\theta} = -${coefTex(a, "\\sin\\theta")}`, note: "" },
        { math: md`\frac{dy}{d\theta} = \frac{dr}{d\theta}\sin\theta + r\cos\theta = -${a}\sin^2\theta + (${a} + ${coefTex(a, "\\cos\\theta")})\cos\theta = ${a}(\cos\theta + \cos 2\theta)`, note: md`$\cos^2\theta - \sin^2\theta = \cos 2\theta$.` },
        { math: md`\frac{dx}{d\theta} = \frac{dr}{d\theta}\cos\theta - r\sin\theta = -${a}\sin\theta\cos\theta - (${a} + ${coefTex(a, "\\cos\\theta")})\sin\theta = -${a}\sin\theta\,(1 + 2\cos\theta)`, note: "" },
        { math: md`\theta = ${angTex(A)}: \quad \frac{dy}{dx} = \frac{\cos\theta + \cos 2\theta}{-\sin\theta\,(1 + 2\cos\theta)} = \frac{${T.cos} + \left(${T.cos2}\right)}{-\left(${T.sin}\right)\left(1 + 2 \cdot ${T.cos}\right)} = ${T.slope}`, note: md`The factor $${a}$ cancels: the slope doesn't depend on the size of the cardioid. ${T.slope === 0 ? "A horizontal tangent." : ""}` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 4);
    const T = r.pick(DOUBLE);
    const sine = r.next() < 0.5;
    const [p, q, R] = sine ? T.tan : T.ncot;
    const ans = surd(p!, q!, R!);
    const A: Ang = T;
    return {
      prompt: md`Find the slope of the tangent line to the circle $r = ${coefTex(a, sine ? "\\sin\\theta" : "\\cos\\theta")}$ at $\theta = ${angTex(A)}$. ${format}`,
      answer: ans.text,
      simplified: true,
      verify: [sine ? polarVerify(`${a} sin${angText(A)}`, `${a} cos${angText(A)}`, angText(A)) : polarVerify(`${a} cos${angText(A)}`, `-${a} sin${angText(A)}`, angText(A))],
      hint: md`After the product rule, double-angle identities collapse both $\frac{dx}{d\theta}$ and $\frac{dy}{d\theta}$ to a single trig function of $2\theta$.`,
      solution: sine
        ? [
            { math: md`\frac{dr}{d\theta} = ${coefTex(a, "\\cos\\theta")}`, note: "" },
            { math: md`\frac{dy}{d\theta} = ${a}\cos\theta\sin\theta + ${a}\sin\theta\cos\theta = ${coefTex(a, "\\sin 2\\theta")}`, note: md`$\frac{dr}{d\theta}\sin\theta + r\cos\theta$, then $2\sin\theta\cos\theta = \sin 2\theta$.` },
            { math: md`\frac{dx}{d\theta} = ${a}\cos^2\theta - ${a}\sin^2\theta = ${coefTex(a, "\\cos 2\\theta")}`, note: md`$\frac{dr}{d\theta}\cos\theta - r\sin\theta$.` },
            { math: md`\frac{dy}{dx} = \tan 2\theta = \tan ${piTex(2 * T.n, T.d)} = ${ans.tex}`, note: md`The slope is $\tan 2\theta$ for every $\theta$: the tangent direction turns twice as fast as $\theta$, as it should on a circle through the pole.` },
          ]
        : [
            { math: md`\frac{dr}{d\theta} = -${coefTex(a, "\\sin\\theta")}`, note: "" },
            { math: md`\frac{dy}{d\theta} = -${a}\sin^2\theta + ${a}\cos^2\theta = ${coefTex(a, "\\cos 2\\theta")}`, note: md`$\frac{dr}{d\theta}\sin\theta + r\cos\theta$.` },
            { math: md`\frac{dx}{d\theta} = -${a}\sin\theta\cos\theta - ${a}\cos\theta\sin\theta = -${coefTex(a, "\\sin 2\\theta")}`, note: md`$\frac{dr}{d\theta}\cos\theta - r\sin\theta$.` },
            { math: md`\frac{dy}{dx} = -\cot 2\theta = -\cot ${piTex(2 * T.n, T.d)} = ${ans.tex}`, note: "" },
          ],
    };
  }
  if (kind === 2) {
    const a = r.int(2, 4);
    const b = r.pick([1, 2, 3].filter((v) => v !== a));
    const cosine = r.next() < 0.5;
    const second = r.next() < 0.5;
    // cos version: θ = π/2 gives b/a, θ = 3π/2 gives -b/a. sin version: θ = 0 gives a/b, θ = π gives -a/b.
    const A: Ang = cosine ? (second ? { n: 3, d: 2 } : { n: 1, d: 2 }) : second ? { n: 1, d: 1 } : { n: 0, d: 1 };
    const [num, den] = cosine ? [second ? -b : b, a] : [second ? -a : a, b];
    const T = A.n === 0 ? "(0)" : angText(A);
    const rp = cosine ? (second ? String(b) : String(-b)) : second ? String(-b) : String(b);
    const [s, c] = cosine ? (second ? ["-1", "0"] : ["1", "0"]) : second ? ["0", "-1"] : ["0", "1"];
    const dy = cosine ? (second ? `(${b})(-1) + ${a}(0)` : `(-${b})(1) + ${a}(0)`) : second ? `(-${b})(0) + ${a}(-1)` : `(${b})(0) + ${a}(1)`;
    const dx = cosine ? (second ? `(${b})(0) - ${a}(-1)` : `(-${b})(0) - ${a}(1)`) : second ? `(-${b})(-1) - ${a}(0)` : `(${b})(1) - ${a}(0)`;
    return {
      prompt: md`Find the slope of the tangent line to the limaçon $r = ${a} + ${coefTex(b, cosine ? "\\cos\\theta" : "\\sin\\theta")}$ at $\theta = ${A.n === 0 ? "0" : angTex(A)}$. ${format}`,
      answer: frac(num, den),
      simplified: true,
      verify: [polarVerify(`${a} + ${b} ${cosine ? "cos" : "sin"}${T}`, cosine ? `-${b} sin${T}` : `${b} cos${T}`, T)],
      hint: md`At this angle $\sin\theta$ and $\cos\theta$ are $0$ and $\pm 1$, so the product-rule expressions collapse to single terms. Find $r$ and $\frac{dr}{d\theta}$ there first.`,
      solution: [
        { math: md`\frac{dr}{d\theta} = ${cosine ? `-${coefTex(b, "\\sin\\theta")}` : coefTex(b, "\\cos\\theta")}`, note: "" },
        { math: md`\theta = ${A.n === 0 ? "0" : angTex(A)}: \quad r = ${a}, \quad \frac{dr}{d\theta} = ${rp}, \quad \sin\theta = ${s}, \quad \cos\theta = ${c}`, note: "Everything needed at this one angle." },
        { math: md`\frac{dy}{d\theta} = \frac{dr}{d\theta}\sin\theta + r\cos\theta = ${dy} = ${num}`, note: "" },
        { math: md`\frac{dx}{d\theta} = \frac{dr}{d\theta}\cos\theta - r\sin\theta = ${dx} = ${den}`, note: "" },
        { math: md`\frac{dy}{dx} = ${fracTex(num, den)}`, note: md`Notice $\frac{dr}{d\theta} \ne 0$ here, yet the tangent is not vertical or horizontal: the slope mixes how fast $r$ changes with how fast the direction turns.` },
      ],
    };
  }
  const T = r.pick([
    { n: 1, d: 2, text: "-2/pi", tex: "-\\frac{2}{\\pi}", sin: "1", cos: "0", dy: "1 + \\tfrac{\\pi}{2} \\cdot 0 = 1", dx: "0 - \\tfrac{\\pi}{2} \\cdot 1 = -\\tfrac{\\pi}{2}" },
    { n: 1, d: 1, text: "pi", tex: "\\pi", sin: "0", cos: "-1", dy: "0 + \\pi(-1) = -\\pi", dx: "-1 - \\pi \\cdot 0 = -1" },
    { n: 3, d: 2, text: "-2/(3pi)", tex: "-\\frac{2}{3\\pi}", sin: "-1", cos: "0", dy: "-1 + \\tfrac{3\\pi}{2} \\cdot 0 = -1", dx: "0 - \\tfrac{3\\pi}{2}(-1) = \\tfrac{3\\pi}{2}" },
    { n: 2, d: 1, text: "2pi", tex: "2\\pi", sin: "0", cos: "1", dy: "0 + 2\\pi \\cdot 1 = 2\\pi", dx: "1 - 2\\pi \\cdot 0 = 1" },
  ]);
  const k = r.int(1, 3);
  return {
    prompt: md`Find the slope of the tangent line to the spiral $r = ${coefTex(k, "\\theta")}$ at $\theta = ${angTex(T)}$. ${format} Write $\pi$ as pi.`,
    answer: T.text,
    verify: [polarVerify(`${k} ${angText(T)}`, String(k), angText(T))],
    hint: md`$\frac{dr}{d\theta} = ${k}$ is constant, but $r$ itself is $${coefTex(k, "\\theta")}$, so $\theta$ appears in the slope.`,
    solution: [
      { math: md`\frac{dr}{d\theta} = ${k}`, note: "" },
      { math: md`\frac{dy}{d\theta} = ${k}\sin\theta + ${k}\theta\cos\theta, \qquad \frac{dx}{d\theta} = ${k}\cos\theta - ${k}\theta\sin\theta`, note: "Product rule on $r\\sin\\theta$ and $r\\cos\\theta$." },
      { math: md`\frac{dy}{dx} = \frac{\sin\theta + \theta\cos\theta}{\cos\theta - \theta\sin\theta}`, note: md`The common factor $${k}$ cancels.` },
      { math: md`\theta = ${angTex(T)}: \quad \frac{dy}{dx} = \frac{${T.dy}}{${T.dx}} = ${T.tex}`, note: md`$\sin\theta = ${T.sin}$ and $\cos\theta = ${T.cos}$ there.` },
    ],
  };
};

const polarArea: Generator = (r) => {
  const kind = r.pick([0, 1, 2, 3, 4, 5, 6, 7, 7, 7]);
  const format = "Give an exact value; write $\\pi$ as pi.";
  if (kind === 0) {
    const a = r.int(1, 4);
    const B = r.pick<Ang>([
      { n: 1, d: 6 },
      { n: 1, d: 4 },
      { n: 1, d: 3 },
      { n: 1, d: 2 },
      { n: 2, d: 3 },
      { n: 3, d: 4 },
      { n: 1, d: 1 },
    ]);
    return {
      prompt: md`Find the area of the region bounded by the rays $\theta = 0$ and $\theta = ${angTex(B)}$ and the circle $r = ${a}$. ${format}`,
      answer: piText(a * a * B.n, 2 * B.d),
      simplified: true,
      hint: md`$A = \frac12\int_\alpha^\beta r^2\,d\theta$ with $r$ constant. The answer is the sector formula $\frac12 r^2\theta$.`,
      solution: [
        { math: md`A = \frac12\int_0^{${angTex(B)}} ${a * a}\, d\theta`, note: md`$r = ${a}$ for every $\theta$.` },
        { math: md`= \frac{${a * a}}{2} \cdot ${angTex(B)} = ${piTex(a * a * B.n, 2 * B.d)}`, note: md`A sector of radius $${a}$ and angle $${angTex(B)}$, exactly as $\frac12 r^2\theta$ says.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 3);
    const sine = r.next() < 0.5;
    const fn = sine ? "\\sin" : "\\cos";
    return {
      prompt: md`Find the area enclosed by the circle $r = ${2 * a}${fn}\theta$. ${format}`,
      answer: piText(a * a, 1),
      simplified: true,
      hint: md`This circle is traced exactly once as $\theta$ runs from $0$ to $\pi$. Going to $2\pi$ traces it twice. Use $${fn}^2\theta = \frac{1 ${sine ? "-" : "+"} \cos 2\theta}{2}$.`,
      solution: [
        { math: md`A = \frac12\int_0^{\pi} ${4 * a * a}${fn}^2\theta\, d\theta`, note: md`One trip round the circle takes $\theta$ from $0$ to $\pi$${sine ? "" : " (for $\\theta > \\frac{\\pi}{2}$, $r$ is negative and draws the lower half)"}.` },
        { math: md`= ${a * a}\int_0^{\pi} \left(1 ${sine ? "-" : "+"} \cos 2\theta\right) d\theta = ${a * a}\Big[\theta ${sine ? "-" : "+"} \tfrac12\sin 2\theta\Big]_0^{\pi} = ${piTex(a * a, 1)}`, note: md`A circle of radius $${a}$ (centre $${sine ? `(0, ${a})` : `(${a}, 0)`}$), so $\pi \cdot ${a}^2$ is right.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 3);
    const sign = r.sign();
    const fn = r.next() < 0.5 ? "\\cos" : "\\sin";
    const rTex = `${a} ${sign < 0 ? "-" : "+"} ${coefTex(a, `${fn}\\theta`)}`;
    const pm = sign < 0 ? "-" : "+";
    return {
      prompt: md`Find the area enclosed by the cardioid $r = ${rTex}$. ${format}`,
      answer: piText(3 * a * a, 2),
      simplified: true,
      hint: md`Square $r$, then use $${fn}^2\theta = \frac{1 \pm \cos 2\theta}{2}$. Over a full turn, the $${fn}\theta$ and $\cos 2\theta$ terms integrate to zero.`,
      solution: [
        { math: md`A = \frac12\int_0^{2\pi} (${rTex})^2\, d\theta = \frac{${a * a}}{2}\int_0^{2\pi}\left(1 ${pm} 2${fn}\theta + ${fn}^2\theta\right) d\theta`, note: "The cardioid is traced once over a full turn." },
        { math: md`= \frac{${a * a}}{2}\left(2\pi ${pm} 0 + \pi\right) = ${piTex(3 * a * a, 2)}`, note: md`$\int_0^{2\pi} ${fn}\theta\,d\theta = 0$, and $\int_0^{2\pi} ${fn}^2\theta\,d\theta = \pi$ (the average of $${fn}^2$ over a full turn is $\frac12$).` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.int(2, 4);
    const b = r.int(1, a - 1);
    const fn = r.next() < 0.5 ? "\\cos" : "\\sin";
    return {
      prompt: md`Find the area enclosed by the limaçon $r = ${a} + ${coefTex(b, `${fn}\\theta`)}$. ${format}`,
      answer: piText(2 * a * a + b * b, 2),
      simplified: true,
      hint: md`Since $${a} > ${b}$, $r > 0$ for every $\theta$ and the curve is a single loop traced once over $[0, 2\pi]$. Expand $r^2$ and integrate term by term.`,
      solution: [
        { math: md`A = \frac12\int_0^{2\pi}\left(${a * a} + ${2 * a * b}${fn}\theta + ${b * b}${fn}^2\theta\right) d\theta`, note: md`$(${a} + ${coefTex(b, `${fn}\\theta`)})^2$ expanded.` },
        { math: md`= \frac12\left(${2 * a * a}\pi + 0 + ${b * b}\pi\right) = ${piTex(2 * a * a + b * b, 2)}`, note: md`Over a full turn, $\int ${fn}\theta = 0$ and $\int ${fn}^2\theta = \pi$. In general a limaçon $r = a + b${fn}\theta$ with $a \ge b$ has area $\pi a^2 + \frac{\pi b^2}{2}$.` },
      ],
    };
  }
  if (kind === 4) {
    const a = r.int(1, 3);
    const n = r.pick([2, 3, 4, 5]);
    const sine = r.next() < 0.5;
    const fn = sine ? "\\sin" : "\\cos";
    const lo = sine ? "0" : `-\\frac{\\pi}{${2 * n}}`;
    const hi = sine ? `\\frac{\\pi}{${n}}` : `\\frac{\\pi}{${2 * n}}`;
    return {
      prompt: md`Find the area enclosed by one petal of the rose $r = ${coefTex(a, `${fn}(${n}\\theta)`)}$. ${format}`,
      answer: piText(a * a, 4 * n),
      simplified: true,
      hint: md`A petal begins and ends at the pole. Find two consecutive zeros of $r$ with $r \ne 0$ between them; those are the limits.`,
      solution: [
        { math: sine ? md`\sin(${n}\theta) = 0 \;\Rightarrow\; \theta = 0, \frac{\pi}{${n}}` : md`\cos(${n}\theta) = 0 \;\Rightarrow\; ${n}\theta = \pm\frac{\pi}{2} \;\Rightarrow\; \theta = \pm\frac{\pi}{${2 * n}}`, note: md`Consecutive zeros of $r$: one petal is traced between them.` },
        { math: md`A = \frac12\int_{${lo}}^{${hi}} ${a * a}${fn}^2(${n}\theta)\, d\theta = \frac{${a * a}}{4}\int_{${lo}}^{${hi}} \left(1 ${sine ? "-" : "+"} \cos(${2 * n}\theta)\right) d\theta`, note: md`Half-angle identity.` },
        { math: md`= \frac{${a * a}}{4}\Big[\theta ${sine ? "-" : "+"} \tfrac{1}{${2 * n}}\sin(${2 * n}\theta)\Big]_{${lo}}^{${hi}} = \frac{${a * a}}{4} \cdot \frac{\pi}{${n}} = ${piTex(a * a, 4 * n)}`, note: md`The sine term vanishes at both limits. Every petal of $r = a${fn}(n\theta)$ has area $\frac{\pi a^2}{4n}$.` },
      ],
    };
  }
  if (kind === 5) {
    const a = r.int(1, 3);
    const n = r.pick([2, 3, 4, 5]);
    const fn = r.next() < 0.5 ? "\\sin" : "\\cos";
    const petals = n % 2 ? n : 2 * n;
    return {
      prompt: md`Find the total area enclosed by the rose $r = ${coefTex(a, `${fn}(${n}\\theta)`)}$ (all of its petals). ${format}`,
      answer: piText(a * a * petals, 4 * n),
      simplified: true,
      hint: md`Count the petals first: $n$ petals when $n$ is odd, $2n$ when $n$ is even. Each petal has area $\frac{\pi a^2}{4n}$. Integrating $\frac12 r^2$ from $0$ to $2\pi$ is only right when $n$ is even.`,
      solution: [
        { math: md`\text{one petal: } \frac12\int_{\text{petal}} ${a * a}${fn}^2(${n}\theta)\, d\theta = \frac{${a * a}}{4} \cdot \frac{\pi}{${n}} = ${piTex(a * a, 4 * n)}`, note: md`A petal spans an angle of $\frac{\pi}{${n}}$ between consecutive zeros of $r$, and the average of $${fn}^2$ over it is $\frac12$.` },
        { math: md`${petals} \text{ petals} \times ${piTex(a * a, 4 * n)} = ${piTex(a * a * petals, 4 * n)}`, note: n % 2 ? md`$${n}$ is odd, so the curve is traced twice over $[0, 2\pi]$ and has $${n}$ petals. $\frac12\int_0^{2\pi} r^2\,d\theta$ would give double the true area.` : md`$${n}$ is even, so there are $${2 * n}$ petals, each traced once over $[0, 2\pi]$. Here $\frac12\int_0^{2\pi} r^2\,d\theta$ gives the same answer.` },
      ],
    };
  }
  if (kind === 6) {
    const k = r.int(1, 2);
    const m = r.int(1, 2);
    return {
      prompt: md`Find the area swept out by the spiral $r = ${coefTex(k, "\\theta")}$ for $0 \le \theta \le ${piTex(m, 1)}$ (the region between the spiral and the ray $\theta = 0$). ${format}`,
      answer: piText(k * k * m ** 3, 6, 3),
      simplified: true,
      hint: md`$r^2 = ${k * k}\theta^2$ is a plain power. The answer involves $\pi^3$.`,
      solution: [
        { math: md`A = \frac12\int_0^{${piTex(m, 1)}} ${k * k}\theta^2\, d\theta = \frac{${k * k}}{2}\Big[\frac{\theta^3}{3}\Big]_0^{${piTex(m, 1)}}`, note: md`As $\theta$ grows, the segment from the pole to the spiral sweeps the region once.` },
        { math: md`= \frac{${k * k}}{6}(${piTex(m, 1)})^3 = ${piTex(k * k * m ** 3, 6, 3)}`, note: "" },
      ],
    };
  }
  // Regions between two curves.
  const a = r.int(1, 2);
  const sub = r.int(0, 3);
  const sine = r.next() < 0.5;
  const fn = sine ? "\\sin" : "\\cos";
  if (sub === 0) {
    // Inside r = 2a cos θ (or sin), outside r = a: a²(2π + 3√3)/6.
    const ans = surdPi(2 * a * a, 3 * a * a, 3, 6);
    const [lo, hi] = sine ? ["\\pi/6", "5\\pi/6"] : ["-\\pi/3", "\\pi/3"];
    return {
      prompt: md`Find the area of the region inside $r = ${2 * a}${fn}\theta$ and outside $r = ${a}$. ${format}`,
      answer: ans.text,
      hint: md`Find where the curves meet by solving $${2 * a}${fn}\theta = ${a}$. Between those angles the circle $r = ${2 * a}${fn}\theta$ is the outer curve; integrate $\frac12(R^2 - r^2)$ there.`,
      solution: [
        { math: sine ? md`${2 * a}\sin\theta = ${a} \;\Rightarrow\; \sin\theta = \tfrac12 \;\Rightarrow\; \theta = \tfrac{\pi}{6}, \tfrac{5\pi}{6}` : md`${2 * a}\cos\theta = ${a} \;\Rightarrow\; \cos\theta = \tfrac12 \;\Rightarrow\; \theta = \pm\tfrac{\pi}{3}`, note: md`Where the curves meet. Between these angles $${2 * a}${fn}\theta > ${a}$.` },
        { math: md`A = \frac12\int_{${lo}}^{${hi}} \left(${4 * a * a}${fn}^2\theta - ${a * a}\right) d\theta = \frac{${a * a}}{2}\int_{${lo}}^{${hi}} \left(1 ${sine ? "-" : "+"} 2\cos 2\theta\right) d\theta`, note: md`$4${fn}^2\theta - 1 = 2(1 ${sine ? "-" : "+"} \cos 2\theta) - 1$.` },
        { math: md`= \frac{${a * a}}{2}\Big[\theta ${sine ? "-" : "+"} \sin 2\theta\Big]_{${lo}}^{${hi}} = \frac{${a * a}}{2}\left(\frac{2\pi}{3} + \sqrt3\right) = ${ans.tex}`, note: sine ? md`$\theta$ contributes $\frac{2\pi}{3}$; $-\sin 2\theta$ contributes $-\left(\sin\frac{5\pi}{3} - \sin\frac{\pi}{3}\right) = \sqrt3$.` : md`$\theta$ contributes $\frac{2\pi}{3}$; $\sin 2\theta$ contributes $\sin\frac{2\pi}{3} - \sin\left(-\frac{2\pi}{3}\right) = \sqrt3$.` },
      ],
    };
  }
  if (sub === 1) {
    // Inside the cardioid r = a + a cos θ (or sin), outside r = a: a²(8 + π)/4.
    const ans = linPi(a * a, 8 * a * a, 4);
    const [lo, hi] = sine ? ["0", "\\pi"] : ["-\\pi/2", "\\pi/2"];
    return {
      prompt: md`Find the area of the region inside the cardioid $r = ${a} + ${coefTex(a, `${fn}\\theta`)}$ and outside the circle $r = ${a}$. ${format}`,
      answer: ans.text,
      hint: md`The curves meet where $${fn}\theta = 0$. The cardioid is outside the circle exactly where $${fn}\theta > 0$.`,
      solution: [
        { math: sine ? md`${a} + ${coefTex(a, "\\sin\\theta")} = ${a} \;\Rightarrow\; \sin\theta = 0 \;\Rightarrow\; \theta = 0, \pi` : md`${a} + ${coefTex(a, "\\cos\\theta")} = ${a} \;\Rightarrow\; \cos\theta = 0 \;\Rightarrow\; \theta = \pm\tfrac{\pi}{2}`, note: md`Between these angles $${fn}\theta > 0$, so the cardioid is the outer curve.` },
        { math: md`A = \frac12\int_{${lo}}^{${hi}} \left((${a} + ${coefTex(a, `${fn}\\theta`)})^2 - ${a * a}\right) d\theta = \frac{${a * a}}{2}\int_{${lo}}^{${hi}} \left(2${fn}\theta + ${fn}^2\theta\right) d\theta`, note: md`The $${a * a}$ terms cancel.` },
        { math: md`= \frac{${a * a}}{2}\left(4 + \frac{\pi}{2}\right) = ${ans.tex}`, note: md`$\int_{${lo}}^{${hi}} 2${fn}\theta\,d\theta = 4$ and $\int_{${lo}}^{${hi}} ${fn}^2\theta\,d\theta = \frac{\pi}{2}$ (half a period, average value $\frac12$).` },
      ],
    };
  }
  if (sub === 2) {
    // Inside both r = a and the cardioid r = a + a cos θ (or sin): a²(5π - 8)/4.
    const ans = linPi(5 * a * a, -8 * a * a, 4);
    const [lo, hi, lo2, hi2] = sine ? ["0", "\\pi", "\\pi", "2\\pi"] : ["-\\pi/2", "\\pi/2", "\\pi/2", "3\\pi/2"];
    return {
      prompt: md`Find the area of the region that lies inside both the circle $r = ${a}$ and the cardioid $r = ${a} + ${coefTex(a, `${fn}\\theta`)}$. ${format}`,
      answer: ans.text,
      hint: md`The common region is bounded by whichever curve is **inner** at each angle: the circle where $${fn}\theta \ge 0$, the cardioid where $${fn}\theta \le 0$. Split the integral.`,
      solution: [
        { math: md`A = \frac12\int_{${lo}}^{${hi}} ${a * a}\, d\theta + \frac12\int_{${lo2}}^{${hi2}} (${a} + ${coefTex(a, `${fn}\\theta`)})^2\, d\theta`, note: md`Where $${fn}\theta \ge 0$ the cardioid is outside the circle, so the circle bounds the common region; where $${fn}\theta \le 0$ it's the other way round.` },
        { math: md`\frac12\int_{${lo}}^{${hi}} ${a * a}\, d\theta = \frac{${a * a}\pi}{2}`, note: "Half a disk." },
        { math: md`\frac{${a * a}}{2}\int_{${lo2}}^{${hi2}} \left(1 + 2${fn}\theta + ${fn}^2\theta\right) d\theta = \frac{${a * a}}{2}\left(\pi - 4 + \frac{\pi}{2}\right) = \frac{${3 * a * a}\pi}{4} - ${2 * a * a}`, note: md`Over this half-turn, $\int 1 = \pi$, $\int 2${fn}\theta = -4$ (it's negative here) and $\int ${fn}^2\theta = \frac{\pi}{2}$.` },
        { math: md`A = \frac{${a * a}\pi}{2} + \frac{${3 * a * a}\pi}{4} - ${2 * a * a} = ${ans.tex}`, note: md`Check: the cardioid's area $\frac{3\pi \cdot ${a * a}}{2}$ minus the part outside the circle, $\frac{${a * a}(8 + \pi)}{4}$, gives the same.` },
      ],
    };
  }
  // Inside r = 3a sin θ (or cos), outside r = a + a sin θ: πa².
  const [lo, hi] = sine ? ["\\pi/6", "5\\pi/6"] : ["-\\pi/3", "\\pi/3"];
  return {
    prompt: md`Find the area of the region inside the circle $r = ${3 * a}${fn}\theta$ and outside the cardioid $r = ${a} + ${coefTex(a, `${fn}\\theta`)}$. ${format}`,
    answer: piText(a * a, 1),
    simplified: true,
    hint: md`Solve $${3 * a}${fn}\theta = ${a} + ${coefTex(a, `${fn}\\theta`)}$ for the limits. Then expand both squares; the $${fn}^2$ terms combine before you use the half-angle identity.`,
    solution: [
      { math: sine ? md`${3 * a}\sin\theta = ${a} + ${coefTex(a, "\\sin\\theta")} \;\Rightarrow\; \sin\theta = \tfrac12 \;\Rightarrow\; \theta = \tfrac{\pi}{6}, \tfrac{5\pi}{6}` : md`${3 * a}\cos\theta = ${a} + ${coefTex(a, "\\cos\\theta")} \;\Rightarrow\; \cos\theta = \tfrac12 \;\Rightarrow\; \theta = \pm\tfrac{\pi}{3}`, note: "Where the curves meet. Between these angles the circle is outside." },
      { math: md`A = \frac12\int_{${lo}}^{${hi}} \left(${9 * a * a}${fn}^2\theta - (${a} + ${coefTex(a, `${fn}\\theta`)})^2\right) d\theta = \frac{${a * a}}{2}\int_{${lo}}^{${hi}} \left(8${fn}^2\theta - 2${fn}\theta - 1\right) d\theta`, note: "" },
      { math: md`= \frac{${a * a}}{2}\int_{${lo}}^{${hi}} \left(3 ${sine ? "-" : "+"} 4\cos 2\theta - 2${fn}\theta\right) d\theta`, note: md`$8${fn}^2\theta = 4 ${sine ? "-" : "+"} 4\cos 2\theta$.` },
      { math: md`= \frac{${a * a}}{2}\Big[3\theta ${sine ? "-" : "+"} 2\sin 2\theta ${sine ? "+" : "-"} 2${sine ? "\\cos" : "\\sin"}\theta\Big]_{${lo}}^{${hi}} = \frac{${a * a}}{2}\left(2\pi + 2\sqrt3 - 2\sqrt3\right) = ${piTex(a * a, 1)}`, note: md`$3\theta$ gives $3 \cdot \frac{2\pi}{3} = 2\pi$; the two trig terms give $2\sqrt3$ and $-2\sqrt3$ and cancel.` },
    ],
  };
};

const polarLength: Generator = (r) => {
  const kind = r.int(0, 4);
  const format = "Give an exact value (use pi, sqrt and e as needed).";
  if (kind === 0) {
    const a = r.int(1, 4);
    const through = r.next() < 0.5;
    if (through) {
      const B = r.pick<Ang>([
        { n: 1, d: 4 },
        { n: 1, d: 2 },
        { n: 3, d: 4 },
        { n: 1, d: 1 },
      ]);
      return {
        prompt: md`Find the length of the polar curve $r = ${2 * a}\cos\theta$ for $0 \le \theta \le ${angTex(B)}$. ${format}`,
        answer: piText(2 * a * B.n, B.d),
        simplified: true,
        hint: md`$r^2 + \left(\frac{dr}{d\theta}\right)^2 = ${4 * a * a}\cos^2\theta + ${4 * a * a}\sin^2\theta$.`,
        solution: [
          { math: md`\frac{dr}{d\theta} = -${2 * a}\sin\theta`, note: "" },
          { math: md`\sqrt{r^2 + \left(\frac{dr}{d\theta}\right)^2} = \sqrt{${4 * a * a}\cos^2\theta + ${4 * a * a}\sin^2\theta} = ${2 * a}`, note: md`Constant speed: this is a circle of radius $${a}$, and $\theta$ is half the central angle, so the point moves at $${2 * a}$ per radian of $\theta$.` },
          { math: md`L = \int_0^{${angTex(B)}} ${2 * a}\, d\theta = ${piTex(2 * a * B.n, B.d)}`, note: B.n === B.d ? md`$\theta$ from $0$ to $\pi$ traces the whole circle once: circumference $2\pi \cdot ${a}$.` : "" },
        ],
      };
    }
    const B = r.pick<Ang>([
      { n: 1, d: 2 },
      { n: 1, d: 1 },
      { n: 3, d: 2 },
      { n: 2, d: 1 },
      { n: 1, d: 3 },
      { n: 2, d: 3 },
    ]);
    return {
      prompt: md`Find the length of the polar curve $r = ${a}$ for $0 \le \theta \le ${angTex(B)}$. ${format}`,
      answer: piText(a * B.n, B.d),
      simplified: true,
      hint: md`$\frac{dr}{d\theta} = 0$, so the integrand is just $r$.`,
      solution: [
        { math: md`\sqrt{r^2 + \left(\frac{dr}{d\theta}\right)^2} = \sqrt{${a * a} + 0} = ${a}`, note: "" },
        { math: md`L = \int_0^{${angTex(B)}} ${a}\, d\theta = ${piTex(a * B.n, B.d)}`, note: md`Arc length $= r\theta$ on a circle of radius $${a}$.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.int(1, 3);
    const B = r.pick([
      { tex: "1", text: `${c === 1 ? "" : c}sqrt(2)(e - 1)`, ansTex: `${c === 1 ? "" : c}\\sqrt2\\,(e - 1)`, eb: "e" },
      { tex: "2", text: `${c === 1 ? "" : c}sqrt(2)(e^2 - 1)`, ansTex: `${c === 1 ? "" : c}\\sqrt2\\,(e^2 - 1)`, eb: "e^2" },
      { tex: "\\ln 2", text: `${c === 1 ? "" : c}sqrt(2)`, ansTex: `${c === 1 ? "" : c}\\sqrt2`, eb: "2" },
      { tex: "\\ln 3", text: `${2 * c}sqrt(2)`, ansTex: `${2 * c}\\sqrt2`, eb: "3" },
    ]);
    return {
      prompt: md`Find the length of the spiral $r = ${coefTex(c, "e^{\\theta}")}$ for $0 \le \theta \le ${B.tex}$. ${format}`,
      answer: B.text,
      hint: md`$r$ and $\frac{dr}{d\theta}$ are the same function here, so $r^2 + (dr/d\theta)^2 = 2r^2$.`,
      solution: [
        { math: md`\frac{dr}{d\theta} = ${coefTex(c, "e^{\\theta}")}`, note: "" },
        { math: md`\sqrt{r^2 + \left(\frac{dr}{d\theta}\right)^2} = \sqrt{${2 * c * c}e^{2\theta}} = ${coefTex(c, "\\sqrt2\\,e^{\\theta}")}`, note: "" },
        { math: md`L = ${coefTex(c, "\\sqrt2")}\int_0^{${B.tex}} e^{\theta}\, d\theta = ${coefTex(c, "\\sqrt2")}\left(${B.eb} - 1\right) = ${B.ansTex}`, note: md`The length is always $\sqrt2$ times the change in $r$: the spiral crosses every ray at $45^\circ$.` },
      ],
    };
  }
  if (kind === 2) {
    const B = r.pick([
      { tex: "\\sqrt5", sq: 5, ans: "19/3", ansTex: "\\frac{19}{3}", pow: "27" },
      { tex: "2\\sqrt3", sq: 12, ans: "56/3", ansTex: "\\frac{56}{3}", pow: "64" },
      { tex: "\\sqrt{21}", sq: 21, ans: "39", ansTex: "39", pow: "125" },
    ]);
    return {
      prompt: md`Find the length of the polar curve $r = \theta^2$ for $0 \le \theta \le ${B.tex}$. ${format}`,
      answer: B.ans,
      simplified: true,
      hint: md`$r^2 + (dr/d\theta)^2 = \theta^4 + 4\theta^2 = \theta^2(\theta^2 + 4)$. Substitute $u = \theta^2 + 4$.`,
      solution: [
        { math: md`\frac{dr}{d\theta} = 2\theta, \qquad r^2 + \left(\frac{dr}{d\theta}\right)^2 = \theta^4 + 4\theta^2 = \theta^2(\theta^2 + 4)`, note: "" },
        { math: md`L = \int_0^{${B.tex}} \theta\sqrt{\theta^2 + 4}\, d\theta = \frac12\int_4^{${B.sq + 4}} \sqrt{u}\, du`, note: md`$\sqrt{\theta^2} = \theta$ since $\theta \ge 0$. Then $u = \theta^2 + 4$, $du = 2\theta\,d\theta$; the limits become $4$ and $${B.sq} + 4 = ${B.sq + 4}$.` },
        { math: md`= \frac12 \cdot \frac23\Big[u^{3/2}\Big]_4^{${B.sq + 4}} = \frac13\left(${B.pow} - 8\right) = ${B.ansTex}`, note: md`$${B.sq + 4}^{3/2} = ${B.pow}$ and $4^{3/2} = 8$.` },
      ],
    };
  }
  if (kind === 3) {
    const a = r.int(1, 3);
    const variant = r.int(0, 2); // 0: 1 + cos full, 1: 1 + cos half, 2: 1 - cos full
    const minus = variant === 2;
    const half = variant === 1;
    const rTex = `${a} ${minus ? "-" : "+"} ${coefTex(a, "\\cos\\theta")}`;
    const hi = half ? "\\pi" : "2\\pi";
    const halfFn = minus ? "\\sin" : "\\cos";
    return {
      prompt: md`Find the length of the cardioid $r = ${rTex}$ for $0 \le \theta \le ${hi}$. ${format}`,
      answer: String(half ? 4 * a : 8 * a),
      hint: md`$r^2 + (dr/d\theta)^2$ simplifies to $${2 * a * a}(1 ${minus ? "-" : "+"} \cos\theta)$. Use a half-angle identity, and watch the sign of the square root over the whole interval.`,
      solution: [
        { math: md`\frac{dr}{d\theta} = ${minus ? "" : "-"}${coefTex(a, "\\sin\\theta")}`, note: "" },
        { math: md`r^2 + \left(\frac{dr}{d\theta}\right)^2 = ${a * a}(1 ${minus ? "-" : "+"} \cos\theta)^2 + ${a * a}\sin^2\theta = ${2 * a * a}(1 ${minus ? "-" : "+"} \cos\theta) = ${4 * a * a}${halfFn}^2\frac{\theta}{2}`, note: md`$\cos^2\theta + \sin^2\theta = 1$, then $1 ${minus ? "-" : "+"} \cos\theta = 2${halfFn}^2\frac{\theta}{2}$.` },
        minus
          ? { math: md`L = \int_0^{2\pi} ${2 * a}\sin\frac{\theta}{2}\, d\theta = \Big[-${4 * a}\cos\frac{\theta}{2}\Big]_0^{2\pi} = ${8 * a}`, note: md`$\sin\frac{\theta}{2} \ge 0$ on $[0, 2\pi]$, so no absolute value is needed.` }
          : half
            ? { math: md`L = \int_0^{\pi} ${2 * a}\cos\frac{\theta}{2}\, d\theta = \Big[${4 * a}\sin\frac{\theta}{2}\Big]_0^{\pi} = ${4 * a}`, note: md`$\cos\frac{\theta}{2} \ge 0$ on $[0, \pi]$, so the square root is $${2 * a}\cos\frac{\theta}{2}$ there.` }
            : { math: md`L = \int_0^{2\pi} ${2 * a}\left|\cos\frac{\theta}{2}\right| d\theta = 2\int_0^{\pi} ${2 * a}\cos\frac{\theta}{2}\, d\theta = 2\Big[${4 * a}\sin\frac{\theta}{2}\Big]_0^{\pi} = ${8 * a}`, note: md`$\cos\frac{\theta}{2} < 0$ for $\pi < \theta < 2\pi$. Dropping the absolute value would give $0$. By symmetry, double the top half instead.` },
      ],
    };
  }
  const a = r.int(1, 3);
  const B = r.pick([
    { n: 1, d: 4, ans: String(a), ansTex: String(a), tan: "1" },
    { n: 1, d: 3, ans: surd(a, 1, 3).text, ansTex: surd(a, 1, 3).tex, tan: "\\sqrt3" },
    { n: 1, d: 6, ans: surd(a, 3, 3).text, ansTex: surd(a, 3, 3).tex, tan: "\\tfrac{\\sqrt3}{3}" },
  ]);
  return {
    prompt: md`Find the length of the polar curve $r = ${coefTex(a, "\\sec\\theta")}$ for $0 \le \theta \le ${angTex(B)}$. ${format}`,
    answer: B.ans,
    simplified: true,
    hint: md`$\frac{d}{d\theta}\sec\theta = \sec\theta\tan\theta$, and $1 + \tan^2\theta = \sec^2\theta$.`,
    solution: [
      { math: md`\frac{dr}{d\theta} = ${coefTex(a, "\\sec\\theta\\tan\\theta")}`, note: "" },
      { math: md`r^2 + \left(\frac{dr}{d\theta}\right)^2 = ${a * a}\sec^2\theta\,(1 + \tan^2\theta) = ${a * a}\sec^4\theta`, note: md`$1 + \tan^2\theta = \sec^2\theta$.` },
      { math: md`L = \int_0^{${angTex(B)}} ${coefTex(a, "\\sec^2\\theta")}\, d\theta = \Big[${coefTex(a, "\\tan\\theta")}\Big]_0^{${angTex(B)}} = ${a === 1 ? "" : `${a} \\cdot `}${B.tan} = ${B.ansTex}`, note: md`$r\cos\theta = ${a}$ means $x = ${a}$: this "curve" is a vertical line, and we measured the segment from $y = 0$ to $y = ${a}\tan${angTex(B)}$. The distance formula agrees.` },
    ],
  };
};

// ── Figures ─────────────────────────────────────────────────────────────────

function wedgeDiagram(): Block {
  const n = 24;
  const f = (t: number) => 1 + Math.cos(t);
  const at = (t: number, rr: number) => ({ x: +(rr * Math.cos(t)).toFixed(3), y: +(rr * Math.sin(t)).toFixed(3) });
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i * Math.PI) / 2 / n;
    return { name: `P${i}`, ...at(t, f(t)), hidden: true, label: "" };
  });
  const t8 = (8 * Math.PI) / 2 / n;
  const t12 = (12 * Math.PI) / 2 / n;
  return {
    kind: "diagram",
    view: [-0.3, 2.3, -0.3, 1.6],
    points: [
      { name: "O", x: 0, y: 0, label: "O", dir: "sw" },
      ...pts,
      { name: "S", ...at(t12, f(t8)), hidden: true, label: "" },
      { name: "U", ...at(t8, f(t12)), hidden: true, label: "" },
    ],
    polygons: [{ points: ["O", ...pts.map((p) => p.name)], fill: 1 }],
    segments: [0, 4, 8, 12, 16, 20, 24].map((i) => ({ from: "O", to: `P${i}`, color: 1 })),
    // r = 1 + cos θ decreases across the wedge, so the arc through P8 (radius f(t8)) is the larger sector M_i (red)
    // and the arc through P12 (radius f(t12)) is the smaller sector m_i (green).
    arcs: [
      { center: "O", from: "P8", to: "S", color: 4 },
      { center: "O", from: "U", to: "P12", color: 3 },
    ],
    angles: [{ at: "O", from: "P8", to: "P12", label: "\\Delta\\theta", color: 2 }],
    labels: [
      { x: 1.95, y: 1.05, text: "r = 1 + \\cos\\theta" },
      { x: 1.56, y: 0.66, text: "m_i" },
      { x: 1.2, y: 1.48, text: "M_i" },
    ],
    caption: md`The part of the cardioid region $r = 1 + \cos\theta$ with $0 \le \theta \le \frac{\pi}{2}$, cut into wedges by rays from the pole. One wedge is caught between two circular sectors of the same angle $\Delta\theta$: the green arc has radius $m_i$, the smallest $r$ on the wedge, and the red arc has radius $M_i$, the largest. As $\Delta\theta$ shrinks the two sectors close in on each other, and the wedge's area is $\frac12 r(\theta)^2\,\Delta\theta$ up to an error that vanishes in the limit.`,
  };
}

function chordDiagram(): Block {
  const deg = (d: number) => (d * Math.PI) / 180;
  const on = (d: number) => ({ x: +(6 + 6 * Math.cos(deg(d))).toFixed(3), y: +(6 * Math.sin(deg(d))).toFixed(3) });
  return {
    kind: "diagram",
    view: [-1.2, 6.4, -2.6, 6.6],
    points: [
      { name: "C", x: 6, y: 0, hidden: true, label: "" },
      { name: "A", ...on(200), hidden: true, label: "" },
      { name: "B", ...on(100), hidden: true, label: "" },
      { name: "P", x: 0, y: 0, label: "(x(t_i),\\, y(t_i))", dir: "w" },
      { name: "Q", ...on(120), label: "(x(t_{i+1}),\\, y(t_{i+1}))", dir: "n" },
      { name: "R", x: on(120).x, y: 0, hidden: true, label: "" },
    ],
    arcs: [{ center: "C", from: "A", to: "B", color: 1 }],
    segments: [
      { from: "P", to: "R", dashed: true, label: "\\Delta x_i" },
      { from: "R", to: "Q", dashed: true, label: "\\Delta y_i" },
      { from: "P", to: "Q", color: 2, label: "\\sqrt{(\\Delta x_i)^2 + (\\Delta y_i)^2}" },
    ],
    angles: [{ at: "R", from: "Q", to: "P", right: true }],
    caption: md`Two nearby positions of the moving point, joined by a chord. The chord is the hypotenuse of a right triangle with legs $\Delta x_i$ and $\Delta y_i$. Over a short time the curve and the chord are nearly the same, and the sum of the chords is a Riemann sum.`,
  };
}

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit5: Unit = {
  title: "Parametric and Polar Calculus",
  lessons: [
    {
      id: slug("Calculus with parametric curves"),
      title: "Calculus with parametric curves",
      summary: "Slopes, concavity and arc length for curves given by x(t) and y(t), each derived from the chain rule or the Pythagorean theorem.",
      blocks: [
        {
          kind: "text",
          body: md`A parametric curve gives the position of a moving point at each time $t$: $x = f(t)$, $y = g(t)$ (Algebra 3 Unit 5). The circle $x = \cos t$, $y = \sin t$ is one; so is the path of a point on a rolling wheel; so is any graph $y = F(x)$, with $x = t$ and $y = F(t)$. Many parametric curves are not the graph of any function. They loop, cross themselves and have vertical tangents. Calculus 1 only handled $y = F(x)$. This lesson extends three of its ideas, slope, concavity and length, to curves given by $x(t)$ and $y(t)$. Every formula comes from something you already know.`,
        },
        {
          kind: "plot",
          x: [-1, 5.2],
          y: [-3.1, 3.1],
          parametric: [{ x: "t^2", y: "t^3 - 3t", t: [-2.2, 2.2], label: "x = t^2,\\ y = t^3 - 3t", color: 1 }],
          curves: [{ expr: "(T^3 - 3T) + ((3T^2 - 3)/(2T))(x - T^2)", color: 2, dashed: true, label: "\\text{tangent at } t = {T}" }],
          points: [{ x: "T^2", y: "T^3 - 3T", label: "({=T^2}, {=T^3 - 3T})", color: 2 }],
          params: [{ name: "T", tex: "t", min: -1.95, max: 1.95, step: 0.1, value: 1.25 }],
          caption: md`The curve $x = t^2$, $y = t^3 - 3t$ for $-2.2 \le t \le 2.2$, with the tangent line at one point. Slide $t$. The curve crosses itself at $(3, 0)$, so it is not the graph of a function, yet at every point other than $t = 0$ it has an unmistakable tangent line. Near $t = 0$ the tangent turns vertical.`,
        },
        {
          kind: "key",
          title: "Slope of a parametric curve",
          body: md`$$\frac{dy}{dx} = \frac{dy/dt}{dx/dt} \qquad \text{wherever } \frac{dx}{dt} \ne 0.$$

Differentiate each coordinate with respect to $t$, then divide. The result is a function of $t$. To get a number, substitute the parameter value of the point you care about, not its $x$-coordinate.`,
        },
        {
          kind: "why",
          title: "Why the slope is the ratio of the two rates",
          body: md`Over a short time $\Delta t$ the point moves about $\Delta x \approx \frac{dx}{dt}\,\Delta t$ sideways and $\Delta y \approx \frac{dy}{dt}\,\Delta t$ up or down. That is what a derivative means: rate times time, for a short enough time. The slope of the chord joining the two positions is

$$\frac{\Delta y}{\Delta x} \approx \frac{(dy/dt)\,\Delta t}{(dx/dt)\,\Delta t} = \frac{dy/dt}{dx/dt}.$$

The $\Delta t$ cancels, and as $\Delta t \to 0$ the chord becomes the tangent. In the language of motion: the velocity vector $\langle x'(t), y'(t) \rangle$ points along the tangent, and the slope of a vector is its rise over its run.

That is the picture. The proof below makes it exact with the chain rule and shows where the condition $dx/dt \ne 0$ comes from.`,
        },
        {
          kind: "proof",
          title: "The slope formula",
          given: md`$x = f(t)$ and $y = g(t)$, where $f'$ is continuous near $t_0$, $g$ is differentiable at $t_0$, and $f'(t_0) \ne 0$`,
          prove: md`Near $t_0$ the curve is the graph of a differentiable function $y = Y(x)$, and $Y'(x_0) = \dfrac{g'(t_0)}{f'(t_0)}$ where $x_0 = f(t_0)$`,
          steps: [
            { statement: md`$f'(t)$ has the same sign as $f'(t_0)$ on some open interval $I$ around $t_0$`, reason: "A continuous function that isn't zero at a point isn't zero nearby" },
            { statement: md`$f$ is strictly monotonic on $I$, so it is one-to-one there and has an inverse $t = f^{-1}(x)$`, reason: "Mean Value Theorem (Calculus 1): a derivative of one sign forces a function to increase or to decrease" },
            { statement: md`$f^{-1}$ is differentiable at $x_0$, with $(f^{-1})'(x_0) = \dfrac{1}{f'(t_0)}$`, reason: md`Derivative of an inverse function (Calculus 1), which needs $f'(t_0) \ne 0$` },
            { statement: md`For $t$ in $I$, the curve is the graph of $Y(x) = g(f^{-1}(x))$`, reason: md`Each $x$ in $f(I)$ comes from exactly one $t$, and that $t$ has $y = g(t)$` },
            { statement: md`$Y'(x_0) = g'(t_0) \cdot \dfrac{1}{f'(t_0)}$`, reason: md`Chain rule on step 4: $Y'(x) = g'(f^{-1}(x)) \cdot (f^{-1})'(x)$, with step 3` },
            { statement: md`$\dfrac{dy}{dx} = \dfrac{g'(t_0)}{f'(t_0)} = \dfrac{dy/dt}{dx/dt}$`, reason: "Rewrite step 5" },
          ],
        },
        {
          kind: "example",
          title: "Slope and tangent line",
          problem: md`Find the slope of $x = t^2$, $y = t^3 - 3t$ at $t = 2$, and the tangent line there.`,
          steps: [
            { math: md`\frac{dx}{dt} = 2t, \qquad \frac{dy}{dt} = 3t^2 - 3`, note: "Differentiate each coordinate with respect to $t$." },
            { math: md`\frac{dy}{dx} = \frac{3t^2 - 3}{2t}`, note: "Divide. This is the slope at the point with parameter $t$." },
            { math: md`t = 2: \quad \frac{dy}{dx} = \frac{12 - 3}{4} = \frac{9}{4}`, note: "Substitute." },
            { math: md`(x, y) = (2^2, 8 - 6) = (4, 2)`, note: md`The point itself. Don't confuse the parameter and the coordinates: $t = 2$ is not $x = 2$.` },
            { math: md`y - 2 = \tfrac{9}{4}(x - 4)`, note: "Point-slope form." },
          ],
        },
        {
          kind: "text",
          body: md`**Horizontal and vertical tangents.** The slope $\frac{dy/dt}{dx/dt}$ is zero when the numerator is zero and the denominator isn't: a horizontal tangent where $\frac{dy}{dt} = 0$ and $\frac{dx}{dt} \ne 0$. It is undefined when the denominator is zero and the numerator isn't: a vertical tangent where $\frac{dx}{dt} = 0$ and $\frac{dy}{dt} \ne 0$.

If both derivatives are zero at the same $t$, the point is standing still for an instant and the formula says nothing. Look at $\lim \frac{dy/dt}{dx/dt}$ as $t$ approaches that value instead. The curve may have a perfectly good tangent there, or a sharp cusp like $x = t^2$, $y = t^3$ at $t = 0$.

A curve can also pass through the same point at two different parameter values, with two different tangents. The slope is a function of $t$, not of the point.`,
        },
        {
          kind: "example",
          title: "Where the tangent is horizontal or vertical",
          problem: md`Find all points on $x = t^2$, $y = t^3 - 3t$ with a horizontal or vertical tangent, and the two tangents at the crossing point.`,
          steps: [
            { math: md`3t^2 - 3 = 0 \;\Rightarrow\; t = \pm 1`, note: md`Horizontal candidates: $\frac{dy}{dt} = 0$.` },
            { math: md`t = \pm 1: \quad \frac{dx}{dt} = \pm 2 \ne 0`, note: "So both are genuine horizontal tangents." },
            { math: md`(1, -2) \text{ at } t = 1, \qquad (1, 2) \text{ at } t = -1`, note: md`The points: $y = 1 - 3$ and $y = -1 + 3$.` },
            { math: md`2t = 0 \;\Rightarrow\; t = 0, \qquad \frac{dy}{dt} = -3 \ne 0`, note: md`Vertical tangent at $(0, 0)$.` },
            { math: md`t = \pm\sqrt3: \quad (x, y) = (3, 0), \qquad \frac{dy}{dx} = \frac{9 - 3}{\pm 2\sqrt3} = \pm\sqrt3`, note: md`The curve passes through $(3, 0)$ twice, with slopes $\sqrt3$ and $-\sqrt3$. Two tangents at one point.` },
          ],
        },
        {
          kind: "check",
          prompt: md`For the curve $x = t^2 + 1$, $y = t^3$, find $\frac{dy}{dx}$ at $t = 2$.`,
          answer: "3",
          explain: md`$\frac{dy}{dt} = 3t^2 = 12$ and $\frac{dx}{dt} = 2t = 4$, so the slope is $\frac{12}{4} = 3$.`,
        },
        {
          kind: "key",
          title: "The second derivative",
          body: md`$$\frac{d^2y}{dx^2} = \frac{d}{dx}\left(\frac{dy}{dx}\right) = \frac{\dfrac{d}{dt}\left(\dfrac{dy}{dx}\right)}{\dfrac{dx}{dt}}.$$

Find $\frac{dy}{dx}$ as a function of $t$, differentiate **that** with respect to $t$, then divide by $\frac{dx}{dt}$ again. It is **not** $\dfrac{d^2y/dt^2}{d^2x/dt^2}$. The sign tells concavity exactly as in Calculus 1: positive means concave up.`,
        },
        {
          kind: "why",
          title: "Why it isn't the ratio of second derivatives",
          body: md`$\frac{d^2y}{dx^2}$ means the derivative **with respect to $x$** of the function $\frac{dy}{dx}$. After the first step, $\frac{dy}{dx}$ is some function of $t$; call it $m(t)$. To differentiate any function of $t$ with respect to $x$, the slope rule applies again with $m$ in place of $y$:

$$\frac{dm}{dx} = \frac{dm/dt}{dx/dt}.$$

That is the formula in the box. The tempting shortcut $\frac{y''(t)}{x''(t)}$ fails the simplest test. For $x = t^2$, $y = t^3 - 3t$ it gives $\frac{6t}{2} = 3t$, while the true second derivative, worked out next, is $\frac{3(t^2 + 1)}{4t^3}$. At $t = 1$ those are $3$ and $\frac32$. The shortcut is wrong because $x''(t)$ measures how the *parametrization* speeds up, which has nothing to do with the shape of the curve.`,
        },
        {
          kind: "example",
          title: "Concavity of the looped cubic",
          problem: md`Find $\frac{d^2y}{dx^2}$ for $x = t^2$, $y = t^3 - 3t$, and say where the curve is concave up.`,
          steps: [
            { math: md`\frac{dy}{dx} = \frac{3t^2 - 3}{2t} = \frac32 t - \frac32 t^{-1}`, note: "The slope as a function of $t$. Splitting the fraction makes it easy to differentiate." },
            { math: md`\frac{d}{dt}\left(\frac{dy}{dx}\right) = \frac32 + \frac32 t^{-2} = \frac{3t^2 + 3}{2t^2}`, note: "Differentiate with respect to $t$." },
            { math: md`\frac{d^2y}{dx^2} = \frac{(3t^2 + 3)/(2t^2)}{2t} = \frac{3(t^2 + 1)}{4t^3}`, note: md`Divide by $\frac{dx}{dt} = 2t$.` },
            { math: md`t > 0: \text{ concave up}, \qquad t < 0: \text{ concave down}`, note: md`The numerator is always positive, so the sign is the sign of $t^3$. The upper and lower branches of the loop bend opposite ways, as the picture shows.` },
          ],
        },
        {
          kind: "key",
          title: "Arc length of a parametric curve",
          body: md`$$L = \int_a^b \sqrt{\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2}\; dt,$$

for a curve traced exactly once as $t$ runs from $a$ to $b$. The integrand is the **speed** of the moving point, so this says: distance travelled is the integral of speed.`,
        },
        {
          kind: "why",
          title: "Why: the Pythagorean theorem on a tiny piece",
          body: md`Cut $[a, b]$ into $n$ short time intervals of length $\Delta t$. During the $i$-th one the point moves from $(x(t_i), y(t_i))$ to $(x(t_{i+1}), y(t_{i+1}))$. The straight-line distance between those positions is, by the Pythagorean theorem,

$$\sqrt{(\Delta x_i)^2 + (\Delta y_i)^2}.$$

By the Mean Value Theorem, $\Delta x_i = x'(t_i^*)\,\Delta t$ and $\Delta y_i = y'(t_i^{**})\,\Delta t$ for some times in the interval, so the chord has length $\sqrt{x'(t_i^*)^2 + y'(t_i^{**})^2}\;\Delta t$. Adding the chords gives the length of a polygon inscribed in the curve, and that sum is a Riemann sum for $\int_a^b \sqrt{x'(t)^2 + y'(t)^2}\,dt$ (when $x'$ and $y'$ are continuous, using two slightly different sample times changes nothing in the limit). The length of a curve is *defined* as the limit of these polygon lengths, so the integral is the arc length.

This is the same argument as for $y = F(x)$ in Unit 1. Setting $x = t$ gives $x' = 1$, and the formula collapses to $\int \sqrt{1 + F'(x)^2}\,dx$.

One caution. The integral counts distance travelled. If the curve is traced twice, as $x = \cos t$, $y = \sin t$ is for $0 \le t \le 4\pi$, the integral gives twice the length of the curve.`,
        },
        chordDiagram(),
        {
          kind: "example",
          title: "One arch of the cycloid",
          problem: md`Find the length of the cycloid $x = t - \sin t$, $y = 1 - \cos t$ for $0 \le t \le 2\pi$.`,
          steps: [
            { math: md`\frac{dx}{dt} = 1 - \cos t, \qquad \frac{dy}{dt} = \sin t`, note: "" },
            { math: md`\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2 = 1 - 2\cos t + \cos^2 t + \sin^2 t = 2 - 2\cos t`, note: md`Expand, then $\cos^2 t + \sin^2 t = 1$.` },
            { math: md`2 - 2\cos t = 4\sin^2\frac{t}{2}`, note: md`Half-angle identity: $\sin^2\frac{t}{2} = \frac{1 - \cos t}{2}$.` },
            { math: md`L = \int_0^{2\pi} 2\sin\frac{t}{2}\, dt`, note: md`$\sqrt{4\sin^2(t/2)} = 2\left|\sin\frac t2\right|$, and $\sin\frac t2 \ge 0$ for $0 \le t \le 2\pi$, so the absolute value can go. Always check this.` },
            { math: md`L = \Big[-4\cos\frac{t}{2}\Big]_0^{2\pi} = -4(-1) - (-4)(1) = 8`, note: md`One arch of a cycloid is exactly 8 times the wheel's radius. No $\pi$ anywhere, which astonished the mathematicians who first found it in the 1650s.` },
          ],
        },
        {
          kind: "plot",
          x: [-0.6, 7.2],
          y: [-0.4, 2.8],
          parametric: [
            { x: "t - sin(t)", y: "1 - cos(t)", t: [0, 2 * Math.PI], label: "x = t - \\sin t,\\ y = 1 - \\cos t", color: 1 },
            { x: "T + cos(t)", y: "1 + sin(t)", t: [0, 2 * Math.PI], color: 2, dashed: true },
            { x: "T - t sin(T)", y: "1 - t cos(T)", t: [0, 1], color: 2 },
          ],
          points: [{ x: "T - sin(T)", y: "1 - cos(T)", label: "t = {T}", color: 2 }],
          params: [{ name: "T", tex: "t", min: 0, max: 6.3, step: 0.1, value: 2 }],
          caption: md`A wheel of radius 1 rolls along the $x$-axis, and $t$ is the angle it has turned. The marked point on the rim traces the cycloid. Slide $t$ and watch the speed $2\sin\frac t2$: the point moves fastest at the top ($t = \pi$) and stops dead at the cusps, where both $\frac{dx}{dt}$ and $\frac{dy}{dt}$ are zero.`,
        },
        {
          kind: "check",
          prompt: md`Find the length of the curve $x = 3t^2$, $y = 2t^3$ for $0 \le t \le 1$. Give an exact value.`,
          answer: "4sqrt(2) - 2",
          explain: md`$\frac{dx}{dt} = 6t$ and $\frac{dy}{dt} = 6t^2$, so the speed is $\sqrt{36t^2 + 36t^4} = 6t\sqrt{1 + t^2}$. With $u = 1 + t^2$, $du = 2t\,dt$: $L = \int_1^2 3\sqrt{u}\,du = \big[2u^{3/2}\big]_1^2 = 4\sqrt2 - 2$.`,
        },
      ],
      practice: [parametricSlope, parametricTangents, parametricArcLength],
    },
    {
      id: slug("Areas and lengths in polar coordinates"),
      title: "Areas and lengths in polar coordinates",
      summary: "Polar curves as parametric curves: tangent slopes, the area formula built from sectors, and arc length.",
      blocks: [
        {
          kind: "text",
          body: md`Polar coordinates locate a point by its distance $r$ from the origin, called the **pole**, and the angle $\theta$ from the positive $x$-axis, with $x = r\cos\theta$ and $y = r\sin\theta$ (Trigonometry Unit 8). A polar curve $r = f(\theta)$ is a parametric curve in disguise, with $\theta$ as the parameter:

$$x = f(\theta)\cos\theta, \qquad y = f(\theta)\sin\theta.$$

So everything from the previous lesson applies to it. Only area needs a new idea, because the natural pieces of a polar region are thin wedges, not thin rectangles. Throughout, angles are in radians. If an answer ever needs $\theta$, type it as t.`,
        },
        {
          kind: "plot",
          x: [-1.3, 2.7],
          y: [-1.7, 1.7],
          parametric: [
            { x: "(1 + cos(t)) cos(t)", y: "(1 + cos(t)) sin(t)", t: [0, 2 * Math.PI], label: "r = 1 + \\cos\\theta", color: 1 },
            { x: "t (1 + cos(a)) cos(a)", y: "t (1 + cos(a)) sin(a)", t: [0, 1], color: 2 },
          ],
          points: [{ x: "(1 + cos(a)) cos(a)", y: "(1 + cos(a)) sin(a)", label: "r = {=1 + cos(a)}", color: 2 }],
          params: [{ name: "a", tex: "\\theta", min: 0, max: 6.28, step: 0.02, value: 0.8 }],
          caption: md`The cardioid $r = 1 + \cos\theta$. Slide $\theta$: the orange segment is the radius $r(\theta)$, the distance from the pole to the curve in direction $\theta$. As $\theta$ turns, this segment sweeps out the region inside the curve, and the area formula adds up the thin wedges it sweeps.`,
        },
        {
          kind: "key",
          title: "Slope of a polar curve",
          body: md`$$\frac{dy}{dx} = \frac{dy/d\theta}{dx/d\theta} = \frac{\dfrac{dr}{d\theta}\sin\theta + r\cos\theta}{\dfrac{dr}{d\theta}\cos\theta - r\sin\theta}.$$

Don't memorize the big fraction. Write $x = r\cos\theta$ and $y = r\sin\theta$, differentiate each with the product rule, and divide.`,
        },
        {
          kind: "why",
          title: "Why: the product rule on r cos θ and r sin θ",
          body: md`$r$ depends on $\theta$, so $x = r\cos\theta$ is a product of two functions of $\theta$:

$$\frac{dx}{d\theta} = \frac{dr}{d\theta}\cos\theta - r\sin\theta, \qquad \frac{dy}{d\theta} = \frac{dr}{d\theta}\sin\theta + r\cos\theta.$$

Divide them, as for any parametric curve. Two consequences are worth knowing. Where the curve passes through the pole ($r = 0$) with $\frac{dr}{d\theta} \ne 0$, the fraction collapses to $\frac{\sin\theta}{\cos\theta} = \tan\theta$: the curve enters the pole along the line at angle $\theta$. And $\frac{dr}{d\theta} = 0$ does **not** mean a horizontal tangent. It means the point is momentarily moving perpendicular to its radius, as on a circle centred at the pole.`,
        },
        {
          kind: "example",
          title: "Tangent to the cardioid",
          problem: md`Find the slope of $r = 1 + \cos\theta$ at $\theta = \frac{\pi}{6}$.`,
          steps: [
            { math: md`\frac{dr}{d\theta} = -\sin\theta`, note: "" },
            { math: md`\frac{dy}{d\theta} = -\sin^2\theta + (1 + \cos\theta)\cos\theta, \qquad \frac{dx}{d\theta} = -\sin\theta\cos\theta - (1 + \cos\theta)\sin\theta`, note: md`Product rule on $y = r\sin\theta$ and $x = r\cos\theta$.` },
            { math: md`\theta = \tfrac{\pi}{6}: \quad \frac{dy}{d\theta} = -\tfrac14 + \left(1 + \tfrac{\sqrt3}{2}\right)\tfrac{\sqrt3}{2} = \tfrac12 + \tfrac{\sqrt3}{2}`, note: md`$\sin\frac{\pi}{6} = \frac12$, $\cos\frac{\pi}{6} = \frac{\sqrt3}{2}$, and $\frac{\sqrt3}{2} \cdot \frac{\sqrt3}{2} = \frac34$.` },
            { math: md`\frac{dx}{d\theta} = -\tfrac{\sqrt3}{4} - \left(1 + \tfrac{\sqrt3}{2}\right)\tfrac12 = -\tfrac12 - \tfrac{\sqrt3}{2}`, note: "" },
            { math: md`\frac{dy}{dx} = \frac{\tfrac12 + \tfrac{\sqrt3}{2}}{-\tfrac12 - \tfrac{\sqrt3}{2}} = -1`, note: md`At $\theta = \frac{\pi}{3}$ the same computation gives $\frac{dy}{d\theta} = 0$: a horizontal tangent at the top of the heart.` },
          ],
        },
        {
          kind: "why",
          title: "Why a sector has area ½ r² θ",
          body: md`A sector is the slice of a disk between two radii. The whole disk, angle $2\pi$, has area $\pi r^2$. Turning the disk about its centre carries any sector onto any other sector with the same angle without changing its area, so area is proportional to angle. A sector of angle $\theta$ (in radians) is the fraction $\frac{\theta}{2\pi}$ of the disk:

$$A = \frac{\theta}{2\pi} \cdot \pi r^2 = \frac12 r^2\theta.$$

Radians are essential. In degrees the same formula would carry a factor of $\frac{\pi}{180}$, and so would every integral below.`,
        },
        wedgeDiagram(),
        {
          kind: "proof",
          title: "Area of a polar region",
          given: md`$r = f(\theta)$ is continuous with $f(\theta) \ge 0$ on $[\alpha, \beta]$, where $0 < \beta - \alpha \le 2\pi$, and $R$ is the region swept by the segment from the pole to the curve as $\theta$ runs from $\alpha$ to $\beta$`,
          prove: md`$\text{Area}(R) = \dfrac12 \displaystyle\int_\alpha^\beta f(\theta)^2\, d\theta$`,
          steps: [
            { statement: md`Cut $[\alpha, \beta]$ into $n$ equal parts of width $\Delta\theta$. Rays at the cut angles divide $R$ into wedges $R_1, \dots, R_n$ that don't overlap.`, reason: "Each point of $R$ has one angle, which lies in one part" },
            { statement: md`On the $i$-th part, $f$ has a smallest value $m_i$ and a largest value $M_i$.`, reason: "Extreme Value Theorem: $f$ is continuous on a closed interval" },
            { statement: md`The sector of radius $m_i$ and angle $\Delta\theta$ lies inside $R_i$, and $R_i$ lies inside the sector of radius $M_i$.`, reason: md`A point of $R_i$ at angle $\theta$ is at most $f(\theta)$ from the pole, and $m_i \le f(\theta) \le M_i$` },
            { statement: md`$\tfrac12 m_i^2\,\Delta\theta \le \text{Area}(R_i) \le \tfrac12 M_i^2\,\Delta\theta$`, reason: "Sector area formula; a region inside another has no more area" },
            { statement: md`$\displaystyle\sum_{i=1}^{n} \tfrac12 m_i^2\,\Delta\theta \le \text{Area}(R) \le \sum_{i=1}^{n} \tfrac12 M_i^2\,\Delta\theta$`, reason: "Add over the wedges, which fill $R$ without overlap (step 1)" },
            { statement: md`Both sums tend to $\frac12\int_\alpha^\beta f(\theta)^2\,d\theta$ as $n \to \infty$.`, reason: md`They are lower and upper Riemann sums of the continuous function $\frac12 f(\theta)^2$ (Calculus 1: the definite integral)` },
            { statement: md`$\text{Area}(R) = \frac12\int_\alpha^\beta f(\theta)^2\,d\theta$`, reason: "Squeeze theorem on step 5" },
          ],
        },
        {
          kind: "key",
          title: "Area in polar coordinates",
          body: md`$$A = \frac12\int_\alpha^\beta r^2\, d\theta, \qquad A_{\text{between}} = \frac12\int_\alpha^\beta \left(R^2 - r^2\right) d\theta,$$

the second for the region inside the outer curve $r = R(\theta)$ and outside the inner curve $r = r(\theta)$, over the angles where the outer curve really is outside. Three habits keep you honest: sketch the region; find the limits where the curve reaches the pole ($r = 0$) or where two curves meet; and never integrate over more than one trip around the curve.`,
        },
        {
          kind: "example",
          title: "Area of the cardioid",
          problem: md`Find the area enclosed by $r = 1 + \cos\theta$.`,
          steps: [
            { math: md`A = \frac12\int_0^{2\pi} (1 + \cos\theta)^2\, d\theta`, note: md`One full turn, $0$ to $2\pi$, traces the cardioid exactly once.` },
            { math: md`= \frac12\int_0^{2\pi} \left(1 + 2\cos\theta + \cos^2\theta\right) d\theta`, note: "Expand." },
            { math: md`= \frac12\int_0^{2\pi} \left(\tfrac32 + 2\cos\theta + \tfrac12\cos 2\theta\right) d\theta`, note: md`$\cos^2\theta = \frac{1 + \cos 2\theta}{2}$ (Unit 2, trig integrals).` },
            { math: md`= \frac12\Big[\tfrac32\theta + 2\sin\theta + \tfrac14\sin 2\theta\Big]_0^{2\pi} = \frac12 \cdot 3\pi = \frac{3\pi}{2}`, note: "The sine terms vanish at both ends." },
          ],
        },
        {
          kind: "example",
          title: "One petal of a rose",
          problem: md`Find the area of one petal of $r = \cos 3\theta$.`,
          steps: [
            { math: md`\cos 3\theta = 0 \;\Rightarrow\; 3\theta = \pm\frac{\pi}{2} \;\Rightarrow\; \theta = \pm\frac{\pi}{6}`, note: md`A petal starts and ends at the pole. The petal along the positive $x$-axis lies between the nearest zeros of $r$ on either side of $\theta = 0$.` },
            { math: md`A = \frac12\int_{-\pi/6}^{\pi/6} \cos^2 3\theta\, d\theta = \frac14\int_{-\pi/6}^{\pi/6} (1 + \cos 6\theta)\, d\theta`, note: "Half-angle identity." },
            { math: md`= \frac14\Big[\theta + \tfrac16\sin 6\theta\Big]_{-\pi/6}^{\pi/6} = \frac14 \cdot \frac{\pi}{3} = \frac{\pi}{12}`, note: md`All three petals together: $\frac{\pi}{4}$. Integrating from $0$ to $2\pi$ would give $\frac{\pi}{2}$, double the truth, because a rose with an odd number of petals is traced twice in a full turn.` },
          ],
        },
        {
          kind: "plot",
          x: [-3.3, 3.3],
          y: [-0.6, 3.4],
          parametric: [
            { x: "3 sin(t) cos(t)", y: "3 sin(t) sin(t)", t: [0, Math.PI], label: "r = 3\\sin\\theta", color: 1 },
            { x: "(1 + sin(t)) cos(t)", y: "(1 + sin(t)) sin(t)", t: [0, 2 * Math.PI], label: "r = 1 + \\sin\\theta", color: 2 },
          ],
          points: [
            { x: 1.299, y: 0.75, label: "\\theta = \\tfrac{\\pi}{6}", color: 3 },
            { x: -1.299, y: 0.75, label: "\\theta = \\tfrac{5\\pi}{6}", color: 3 },
          ],
          caption: md`The circle $r = 3\sin\theta$ (blue) and the cardioid $r = 1 + \sin\theta$ (orange) meet where $3\sin\theta = 1 + \sin\theta$, at $\theta = \frac{\pi}{6}$ and $\frac{5\pi}{6}$. Between those angles the circle is the outer curve. The region inside the circle and outside the cardioid is the crescent at the top.`,
        },
        {
          kind: "example",
          title: "Inside one curve, outside another",
          problem: md`Find the area inside $r = 3\sin\theta$ and outside $r = 1 + \sin\theta$.`,
          steps: [
            { math: md`3\sin\theta = 1 + \sin\theta \;\Rightarrow\; \sin\theta = \tfrac12 \;\Rightarrow\; \theta = \tfrac{\pi}{6}, \tfrac{5\pi}{6}`, note: md`Where the curves meet. Between these angles $3\sin\theta$ is the larger.` },
            { math: md`A = \frac12\int_{\pi/6}^{5\pi/6} \left(9\sin^2\theta - (1 + \sin\theta)^2\right) d\theta = \frac12\int_{\pi/6}^{5\pi/6} \left(8\sin^2\theta - 2\sin\theta - 1\right) d\theta`, note: "Outer squared minus inner squared." },
            { math: md`= \frac12\int_{\pi/6}^{5\pi/6} \left(3 - 4\cos 2\theta - 2\sin\theta\right) d\theta`, note: md`$8\sin^2\theta = 4 - 4\cos 2\theta$.` },
            { math: md`= \frac12\Big[3\theta - 2\sin 2\theta + 2\cos\theta\Big]_{\pi/6}^{5\pi/6}`, note: "" },
            { math: md`= \frac12\left[2\pi + 2\sqrt3 - 2\sqrt3\right] = \pi`, note: md`$3\theta$ contributes $3 \cdot \frac{2\pi}{3}$; $-2\sin 2\theta$ gives $-2\left(-\frac{\sqrt3}{2} - \frac{\sqrt3}{2}\right) = 2\sqrt3$; $2\cos\theta$ gives $2\left(-\frac{\sqrt3}{2} - \frac{\sqrt3}{2}\right) = -2\sqrt3$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the area enclosed by the circle $r = 4\sin\theta$. Write $\pi$ as pi.`,
          answer: "4pi",
          simplified: true,
          explain: md`The circle is traced once for $0 \le \theta \le \pi$. $A = \frac12\int_0^\pi 16\sin^2\theta\,d\theta = 4\int_0^\pi (1 - \cos 2\theta)\,d\theta = 4\pi$. It's a circle of radius 2, so $\pi \cdot 2^2$ is right. Integrating to $2\pi$ would count it twice.`,
        },
        {
          kind: "key",
          title: "Arc length in polar coordinates",
          body: md`$$L = \int_\alpha^\beta \sqrt{r^2 + \left(\frac{dr}{d\theta}\right)^2}\; d\theta,$$

for a curve traced once as $\theta$ runs from $\alpha$ to $\beta$.`,
        },
        {
          kind: "why",
          title: "Why: parametric arc length, with the cross terms cancelling",
          body: md`Use the parametric formula with $\theta$ as the parameter, $x = r\cos\theta$, $y = r\sin\theta$, and write $r'$ for $\frac{dr}{d\theta}$:

$$\left(\frac{dx}{d\theta}\right)^2 + \left(\frac{dy}{d\theta}\right)^2 = (r'\cos\theta - r\sin\theta)^2 + (r'\sin\theta + r\cos\theta)^2.$$

Expanding, the squared terms give $r'^2(\cos^2\theta + \sin^2\theta) + r^2(\sin^2\theta + \cos^2\theta) = r'^2 + r^2$, and the cross terms are $-2rr'\sin\theta\cos\theta + 2rr'\sin\theta\cos\theta = 0$. So the speed is $\sqrt{r^2 + r'^2}$, and the length is its integral.

There is a picture too. In a small turn $d\theta$, the point moves $r\,d\theta$ sideways, along the arc of a circle of radius $r$, and $dr$ outward. Those two motions are perpendicular, so the Pythagorean theorem gives $ds^2 = r^2\,d\theta^2 + dr^2$.`,
        },
        {
          kind: "example",
          title: "Length of the cardioid",
          problem: md`Find the length of $r = 1 + \cos\theta$.`,
          steps: [
            { math: md`r^2 + \left(\frac{dr}{d\theta}\right)^2 = (1 + \cos\theta)^2 + \sin^2\theta = 2 + 2\cos\theta`, note: md`Expand and use $\cos^2\theta + \sin^2\theta = 1$.` },
            { math: md`2 + 2\cos\theta = 4\cos^2\frac{\theta}{2}`, note: md`Half-angle identity: $\cos^2\frac{\theta}{2} = \frac{1 + \cos\theta}{2}$.` },
            { math: md`L = \int_0^{2\pi} 2\left|\cos\tfrac{\theta}{2}\right| d\theta = 2\int_0^{\pi} 2\cos\tfrac{\theta}{2}\, d\theta`, note: md`$\cos\frac{\theta}{2}$ is negative for $\pi < \theta < 2\pi$. Keep the absolute value, or use the curve's symmetry about the $x$-axis and double the top half. Forgetting this gives $0$.` },
            { math: md`L = 2\Big[4\sin\tfrac{\theta}{2}\Big]_0^{\pi} = 8`, note: md`Like the cycloid arch, the cardioid has a length with no $\pi$ in it.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the length of the spiral $r = e^{\theta}$ for $0 \le \theta \le \ln 2$. Give an exact value.`,
          answer: "sqrt(2)",
          explain: md`$\frac{dr}{d\theta} = e^\theta$, so $\sqrt{r^2 + (dr/d\theta)^2} = \sqrt{2e^{2\theta}} = \sqrt2\,e^\theta$ and $L = \sqrt2\,\big[e^\theta\big]_0^{\ln 2} = \sqrt2\,(2 - 1) = \sqrt2$.`,
        },
      ],
      practice: [polarSlope, polarArea, polarLength],
    },
  ],
};
