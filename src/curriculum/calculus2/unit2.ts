import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** "2x", "x", "-x" for a coefficient times x (LaTeX and typed text alike). */
const kx = (k: number) => (k === 1 ? "x" : k === -1 ? "-x" : `${k}x`);
/** A coefficient in front of a body: 1 and -1 are hidden. */
const cf = (c: number, body: string) => (c === 1 ? body : c === -1 ? `-${body}` : `${c}${body}`);
/** x - a written as "x - 3" or "x + 3". */
const xm = (a: number) => (a === 0 ? "x" : `x ${signed(-a)}`);
/** The constant of integration sentence used in prompts. */
const PLUS_C = md`You may leave out the $+ C$.`;

/** A small exact fraction. */
interface Q {
  n: number;
  d: number;
}
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qText = (a: Q) => frac(a.n, a.d);
const qTex = (a: Q) => fracTex(a.n, a.d);
const qNum = (a: Q) => a.n / a.d;

// ── Lesson 1: integration by parts ─────────────────────────────────────────

const partsExponential: Generator = (r) => {
  const kind = r.int(0, 2);
  const k = r.pick([1, 2, 3, -1, -2]);
  const ek = k === 1 ? "e^{x}" : `e^{${kx(k)}}`;
  const ekText = `e^(${kx(k)})`;
  const typed = md`Type $${ek}$ as ${ekText}. ${PLUS_C}`;
  if (kind === 0) {
    const a = r.int(1, 5);
    // ∫ a x e^{kx} dx = (a x / k) e^{kx} - (a / k^2) e^{kx}
    return {
      prompt: md`Find $\int ${cf(a, "x")} ${ek} \, dx$. ${typed}`,
      answer: `(${a}x)/(${k}) ${ekText} - (${a})/(${k * k}) ${ekText}`,
      upToConstant: true,
      hint: md`Take $u = ${cf(a, "x")}$ (it gets simpler when differentiated) and $dv = ${ek} \, dx$.`,
      solution: [
        { math: md`u = ${cf(a, "x")}, \quad dv = ${ek} \, dx`, note: md`So $du = ${a} \, dx$ and $v = ${fracTex(1, k)} ${ek}$.` },
        { math: md`uv - \int v \, du = ${fracTex(a, k)} x ${ek} - \int ${fracTex(a, k)} ${ek} \, dx`, note: "The parts formula. The new integral has no x in front: that is the progress." },
        { math: md`${fracTex(a, k)} x ${ek} - ${fracTex(a, k * k)} ${ek} + C`, note: md`$\int ${ek} \, dx = ${fracTex(1, k)} ${ek}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 4);
    const b = r.nonzero(-5, 5);
    const lin = poly([[a, "x"], [b, ""]]);
    return {
      prompt: md`Find $\int (${lin}) ${ek} \, dx$. ${typed}`,
      answer: `(${lin})/(${k}) ${ekText} - (${a})/(${k * k}) ${ekText}`,
      upToConstant: true,
      hint: md`Let $u = ${lin}$, the polynomial, and $dv = ${ek} \, dx$.`,
      solution: [
        { math: md`u = ${lin}, \quad dv = ${ek} \, dx`, note: md`$du = ${a} \, dx$, $v = ${fracTex(1, k)} ${ek}$.` },
        { math: md`${fracTex(1, k)}(${lin}) ${ek} - \int ${fracTex(a, k)} ${ek} \, dx`, note: md`$uv - \int v \, du$.` },
        { math: md`${fracTex(1, k)}(${lin}) ${ek} - ${fracTex(a, k * k)} ${ek} + C`, note: "Integrate the exponential once more." },
      ],
    };
  }
  // ∫ x^2 e^{kx} dx = e^{kx}(x^2/k - 2x/k^2 + 2/k^3): parts twice.
  return {
    prompt: md`Find $\int x^2 ${ek} \, dx$. ${typed}`,
    answer: `${ekText} (x^2/(${k}) - 2x/(${k * k}) + 2/(${k * k * k}))`,
    upToConstant: true,
    hint: md`Use parts twice. Each round takes one power off $x^2$.`,
    solution: [
      { math: md`u = x^2, \quad dv = ${ek} \, dx \quad\Rightarrow\quad \int x^2 ${ek} \, dx = ${fracTex(1, k)} x^2 ${ek} - ${fracTex(2, k)} \int x ${ek} \, dx`, note: md`$du = 2x \, dx$ and $v = ${fracTex(1, k)} ${ek}$. The power dropped from 2 to 1.` },
      { math: md`\int x ${ek} \, dx = ${fracTex(1, k)} x ${ek} - ${fracTex(1, k * k)} ${ek}`, note: md`Parts again with $u = x$, $dv = ${ek} \, dx$.` },
      { math: md`${fracTex(1, k)} x^2 ${ek} - ${fracTex(2, k)}\left(${fracTex(1, k)} x ${ek} - ${fracTex(1, k * k)} ${ek}\right)`, note: "Put the second result into the first." },
      { math: md`${ek}\left(${fracTex(1, k)} x^2 - ${fracTex(2, k * k)} x + ${fracTex(2, k * k * k)}\right) + C`, note: "Factor out the exponential." },
    ],
  };
};

const partsTrigAndLog: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const a = r.int(1, 4);
    const k = r.int(1, 3);
    const arg = kx(k);
    const isCos = kind === 0;
    // ∫ a x cos(kx) dx = (a x/k) sin(kx) + (a/k^2) cos(kx);  ∫ a x sin(kx) dx = -(a x/k) cos(kx) + (a/k^2) sin(kx)
    const answer = isCos ? `(${a}x)/${k} sin(${arg}) + ${a}/${k * k} cos(${arg})` : `-(${a}x)/${k} cos(${arg}) + ${a}/${k * k} sin(${arg})`;
    const fn = isCos ? "\\cos" : "\\sin";
    return {
      prompt: md`Find $\int ${cf(a, "x")} ${fn}(${arg}) \, dx$. ${PLUS_C}`,
      answer,
      upToConstant: true,
      hint: md`$u = ${cf(a, "x")}$ and $dv = ${fn}(${arg}) \, dx$. Differentiating $x$ kills it; integrating a trig function just rotates it.`,
      solution: isCos
        ? [
            { math: md`u = ${cf(a, "x")}, \quad dv = \cos(${arg}) \, dx`, note: md`$du = ${a} \, dx$, $v = ${fracTex(1, k)} \sin(${arg})$.` },
            { math: md`${fracTex(a, k)} x \sin(${arg}) - \int ${fracTex(a, k)} \sin(${arg}) \, dx`, note: md`$uv - \int v \, du$.` },
            { math: md`${fracTex(a, k)} x \sin(${arg}) + ${fracTex(a, k * k)} \cos(${arg}) + C`, note: md`$\int \sin(${arg}) \, dx = -${fracTex(1, k)} \cos(${arg})$, and the two minus signs cancel.` },
          ]
        : [
            { math: md`u = ${cf(a, "x")}, \quad dv = \sin(${arg}) \, dx`, note: md`$du = ${a} \, dx$, $v = -${fracTex(1, k)} \cos(${arg})$.` },
            { math: md`-${fracTex(a, k)} x \cos(${arg}) + \int ${fracTex(a, k)} \cos(${arg}) \, dx`, note: md`$uv - \int v \, du$; minus a negative is plus.` },
            { math: md`-${fracTex(a, k)} x \cos(${arg}) + ${fracTex(a, k * k)} \sin(${arg}) + C`, note: "" },
          ],
    };
  }
  if (kind === 2) {
    const n = r.int(1, 4);
    const m = n + 1;
    const xn = n === 1 ? "x" : `x^{${n}}`;
    // ∫ x^n ln x dx = x^{n+1}/(n+1) ln x - x^{n+1}/(n+1)^2
    return {
      prompt: md`Find $\int ${xn} \ln x \, dx$. Type $\ln x$ as ln(x). ${PLUS_C}`,
      answer: `x^${m}/${m} ln(x) - x^${m}/${m * m}`,
      upToConstant: true,
      hint: md`Nobody wants to integrate $\ln x$ by sight, so let $u = \ln x$. Then $dv = ${xn} \, dx$ is easy to integrate.`,
      solution: [
        { math: md`u = \ln x, \quad dv = ${xn} \, dx`, note: md`$du = \frac{1}{x} \, dx$, $v = \frac{x^{${m}}}{${m}}$.` },
        { math: md`\frac{x^{${m}}}{${m}} \ln x - \int \frac{x^{${m}}}{${m}} \cdot \frac{1}{x} \, dx`, note: "The logarithm is gone from the new integral." },
        { math: md`\frac{x^{${m}}}{${m}} \ln x - \frac{1}{${m}} \int x^{${n}} \, dx = \frac{x^{${m}}}{${m}} \ln x - \frac{x^{${m}}}{${m * m}} + C`, note: "" },
      ],
    };
  }
  const a = r.int(1, 5);
  // ∫ a arctan x dx = a x arctan x - (a/2) ln(1 + x^2)
  return {
    prompt: md`Find $\int ${a === 1 ? "" : a} \arctan x \, dx$. Type $\arctan x$ as atan(x). ${PLUS_C}`,
    answer: `${a}x atan(x) - ${a}/2 ln(1 + x^2)`,
    upToConstant: true,
    hint: md`Take $dv = dx$ and $u = ${a === 1 ? "" : a}\arctan x$. Its derivative is algebraic, which is a big improvement.`,
    solution: [
      { math: md`u = ${a === 1 ? "" : a}\arctan x, \quad dv = dx`, note: md`$du = \frac{${a}}{1 + x^2} \, dx$, $v = x$.` },
      { math: md`${a === 1 ? "" : a}x \arctan x - \int \frac{${a}x}{1 + x^2} \, dx`, note: md`$uv - \int v \, du$.` },
      { math: md`${a === 1 ? "" : a}x \arctan x - ${fracTex(a, 2)} \ln(1 + x^2) + C`, note: md`Substitute $w = 1 + x^2$, $dw = 2x \, dx$ in the last integral.` },
    ],
  };
};

const partsDefinite: Generator = (r) => {
  const m = r.int(1, 4);
  const M = m === 1 ? "" : String(m);
  const kind = r.int(0, 5);
  const variants: { prompt: string; answer: string; hint: string; solution: Step[] }[] = [
    {
      prompt: md`Evaluate $\int_{0}^{\pi} ${M}x \sin x \, dx$. Give an exact answer (type $\pi$ as pi).`,
      answer: `${m}pi`,
      hint: md`$u = ${M}x$, $dv = \sin x \, dx$. Evaluate $uv$ at both limits before dealing with the remaining integral.`,
      solution: [
        { math: md`u = ${M}x, \quad dv = \sin x \, dx \quad\Rightarrow\quad du = ${m} \, dx, \quad v = -\cos x`, note: "" },
        { math: md`\Big[-${M}x \cos x\Big]_{0}^{\pi} + \int_{0}^{\pi} ${m} \cos x \, dx`, note: md`$\big[uv\big]_a^b - \int_a^b v \, du$.` },
        { math: md`(-${m}\pi \cos \pi - 0) + ${m}\Big[\sin x\Big]_{0}^{\pi} = ${m}\pi + 0 = ${m}\pi`, note: md`$\cos \pi = -1$ and $\sin \pi = \sin 0 = 0$.` },
      ],
    },
    {
      prompt: md`Evaluate $\int_{0}^{1} ${M}x e^{x} \, dx$. Give an exact answer.`,
      answer: String(m),
      hint: md`$u = ${M}x$, $dv = e^x \, dx$.`,
      solution: [
        { math: md`\Big[${M}x e^{x}\Big]_{0}^{1} - \int_{0}^{1} ${m} e^{x} \, dx`, note: md`$u = ${M}x$, $du = ${m} \, dx$, $v = e^x$.` },
        { math: md`${m}e - ${m}\Big[e^{x}\Big]_{0}^{1} = ${m}e - ${m}(e - 1)`, note: "" },
        { math: String(m), note: md`The $e$ terms cancel exactly.` },
      ],
    },
    {
      prompt: md`Evaluate $\int_{1}^{e} ${M}\ln x \, dx$. Give an exact answer.`,
      answer: String(m),
      hint: md`There is only one factor, so take $dv = dx$ and $u = ${M}\ln x$.`,
      solution: [
        { math: md`u = ${M}\ln x, \quad dv = dx \quad\Rightarrow\quad du = \frac{${m}}{x} \, dx, \quad v = x`, note: "" },
        { math: md`\Big[${M}x \ln x\Big]_{1}^{e} - \int_{1}^{e} ${m} \, dx`, note: md`$x \cdot \frac{${m}}{x} = ${m}$.` },
        { math: md`(${m}e \cdot 1 - 0) - ${m}(e - 1) = ${m}`, note: md`$\ln e = 1$ and $\ln 1 = 0$.` },
      ],
    },
    {
      prompt: md`Evaluate $\int_{0}^{\pi/2} ${M}x \cos x \, dx$. Give an exact answer (type $\pi$ as pi).`,
      answer: `${m}(pi/2 - 1)`,
      hint: md`$u = ${M}x$, $dv = \cos x \, dx$.`,
      solution: [
        { math: md`\Big[${M}x \sin x\Big]_{0}^{\pi/2} - \int_{0}^{\pi/2} ${m} \sin x \, dx`, note: md`$du = ${m} \, dx$, $v = \sin x$.` },
        { math: md`${m}\cdot\frac{\pi}{2} \cdot 1 - ${m}\Big[-\cos x\Big]_{0}^{\pi/2} = \frac{${m}\pi}{2} - ${m}(0 + 1)`, note: "" },
        { math: md`${m}\left(\frac{\pi}{2} - 1\right)`, note: "" },
      ],
    },
    {
      prompt: md`Evaluate $\int_{1}^{2} ${M}\ln x \, dx$. Give an exact answer (type $\ln 2$ as ln(2)).`,
      answer: `${m}(2 ln(2) - 1)`,
      hint: md`$u = ${M}\ln x$, $dv = dx$.`,
      solution: [
        { math: md`\Big[${M}x \ln x\Big]_{1}^{2} - \int_{1}^{2} ${m} \, dx`, note: md`$v \, du = x \cdot \frac{${m}}{x} \, dx = ${m} \, dx$.` },
        { math: md`${m}\cdot 2 \ln 2 - 0 - ${m}(2 - 1) = ${m}(2\ln 2 - 1)`, note: md`About $${(m * (2 * Math.log(2) - 1)).toFixed(3)}$.` },
      ],
    },
    {
      prompt: md`Evaluate $\int_{0}^{1} ${M}\arctan x \, dx$. Give an exact answer (type $\pi$ as pi and $\ln 2$ as ln(2)).`,
      answer: `${m}(pi/4 - ln(2)/2)`,
      hint: md`$u = ${M}\arctan x$, $dv = dx$. The leftover integral is a substitution.`,
      solution: [
        { math: md`\Big[${M}x \arctan x\Big]_{0}^{1} - \int_{0}^{1} \frac{${m}x}{1 + x^2} \, dx`, note: md`$du = \frac{${m}}{1 + x^2} \, dx$, $v = x$.` },
        { math: md`${m}\cdot\frac{\pi}{4} - ${fracTex(m, 2)}\Big[\ln(1 + x^2)\Big]_{0}^{1}`, note: md`$\arctan 1 = \frac{\pi}{4}$; the integral is $\frac{${m}}{2}\ln(1 + x^2)$ by the substitution $w = 1 + x^2$.` },
        { math: md`${m}\left(\frac{\pi}{4} - \frac{\ln 2}{2}\right)`, note: "" },
      ],
    },
  ];
  return variants[kind]!;
};

// ── Lesson 2: trigonometric integrals ──────────────────────────────────────

/** sin(kx) in LaTeX, "\sin x" when k = 1. */
const trigTex = (fn: string, k: number, pow?: number) => `\\${fn}${pow ? `^{${pow}}` : ""}${k === 1 ? " x" : `(${kx(k)})`}`;
const trigText = (fn: string, k: number) => `${fn}(${kx(k)})`;
const POWER_NOTE = md`Type a power like $\cos^3 x$ as (cos(x))^3, with the function in its own parentheses.`;

const oddPowers: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const k = r.int(1, 3);
    const isSin = kind === 0;
    const keep = isSin ? "sin" : "cos";
    const other = isSin ? "cos" : "sin";
    const c = trigText(other, k);
    // ∫ sin^3(kx) dx = -cos(kx)/k + cos^3(kx)/(3k);  ∫ cos^3(kx) dx = sin(kx)/k - sin^3(kx)/(3k)
    const answer = isSin ? `-${c}/${k} + (${c})^3/${3 * k}` : `${c}/${k} - (${c})^3/${3 * k}`;
    const K = k === 1 ? "" : `\\frac{1}{${k}}`;
    return {
      prompt: md`Find $\int ${trigTex(keep, k, 3)} \, dx$. ${POWER_NOTE} ${PLUS_C}`,
      answer,
      upToConstant: true,
      hint: md`Odd power: peel off one $${trigTex(keep, k)}$ to be the $du$, and turn the even power left behind into the other function with $\sin^2 + \cos^2 = 1$.`,
      solution: [
        { math: md`${trigTex(keep, k, 3)} = ${trigTex(keep, k, 2)} \cdot ${trigTex(keep, k)} = (1 - ${trigTex(other, k, 2)}) ${trigTex(keep, k)}`, note: "Save one factor; convert the rest." },
        { math: md`u = ${trigTex(other, k)}, \quad du = ${isSin ? "-" : ""}${k === 1 ? "" : k} ${trigTex(keep, k)} \, dx`, note: md`So $${trigTex(keep, k)} \, dx = ${isSin ? "-" : ""}${K} du$.` },
        { math: md`${isSin ? "-" : ""}${K} \int (1 - u^2) \, du = ${isSin ? "-" : ""}${K}\left(u - \frac{u^3}{3}\right)`, note: "A polynomial in u." },
        { math: md`${isSin ? "-" : ""}${K}${trigTex(other, k)} ${isSin ? "+" : "-"} \frac{${trigTex(other, k, 3)}}{${3 * k}} + C`, note: md`Put $u = ${trigTex(other, k)}$ back.` },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(2, 5);
    const useSin = r.next() < 0.5;
    const [a, b] = useSin ? ["\\sin", "\\cos"] : ["\\cos", "\\sin"];
    const aText = useSin ? "sin" : "cos";
    // ∫ sin^n x cos x dx = sin^{n+1} x/(n+1);  ∫ cos^n x sin x dx = -cos^{n+1} x/(n+1)
    return {
      prompt: md`Find $\int ${a}^{${n}} x \, ${b} x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
      answer: `${useSin ? "" : "-"}(${aText}(x))^${n + 1}/${n + 1}`,
      upToConstant: true,
      hint: md`The single $${b} x$ is exactly the derivative of $${a} x$ (up to sign). Substitute $u = ${a} x$.`,
      solution: [
        { math: md`u = ${a} x, \quad du = ${useSin ? "" : "-"}${b} x \, dx`, note: "" },
        { math: md`${useSin ? "" : "-"}\int u^{${n}} \, du = ${useSin ? "" : "-"}\frac{u^{${n + 1}}}{${n + 1}}`, note: "Power rule." },
        { math: md`${useSin ? "" : "-"}\frac{${a}^{${n + 1}} x}{${n + 1}} + C`, note: "" },
      ],
    };
  }
  // ∫ sin^2 x cos^3 x dx = sin^3/3 - sin^5/5;  ∫ sin^3 x cos^2 x dx = -cos^3/3 + cos^5/5
  const sinOdd = r.next() < 0.5;
  return sinOdd
    ? {
        prompt: md`Find $\int \sin^3 x \cos^2 x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
        answer: "-(cos(x))^3/3 + (cos(x))^5/5",
        upToConstant: true,
        hint: md`The sine has the odd power, so save one $\sin x$ for $du$ and let $u = \cos x$.`,
        solution: [
          { math: md`\sin^3 x \cos^2 x = (1 - \cos^2 x)\cos^2 x \cdot \sin x`, note: md`$\sin^2 x = 1 - \cos^2 x$.` },
          { math: md`u = \cos x, \quad du = -\sin x \, dx`, note: "" },
          { math: md`-\int (1 - u^2) u^2 \, du = -\int (u^2 - u^4) \, du = -\frac{u^3}{3} + \frac{u^5}{5}`, note: "" },
          { math: md`-\frac{\cos^3 x}{3} + \frac{\cos^5 x}{5} + C`, note: "" },
        ],
      }
    : {
        prompt: md`Find $\int \sin^2 x \cos^3 x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
        answer: "(sin(x))^3/3 - (sin(x))^5/5",
        upToConstant: true,
        hint: md`The cosine has the odd power, so save one $\cos x$ for $du$ and let $u = \sin x$.`,
        solution: [
          { math: md`\sin^2 x \cos^3 x = \sin^2 x (1 - \sin^2 x) \cdot \cos x`, note: md`$\cos^2 x = 1 - \sin^2 x$.` },
          { math: md`u = \sin x, \quad du = \cos x \, dx`, note: "" },
          { math: md`\int (u^2 - u^4) \, du = \frac{u^3}{3} - \frac{u^5}{5}`, note: "" },
          { math: md`\frac{\sin^3 x}{3} - \frac{\sin^5 x}{5} + C`, note: "" },
        ],
      };
};

const evenPowers: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind <= 1) {
    const k = r.int(1, 3);
    const a = r.int(1, 4);
    const isSin = kind === 0;
    const fn = isSin ? "sin" : "cos";
    // ∫ a sin^2(kx) dx = a x/2 - a sin(2kx)/(4k);  ∫ a cos^2(kx) dx = a x/2 + a sin(2kx)/(4k)
    const sign = isSin ? "-" : "+";
    return {
      prompt: md`Find $\int ${a === 1 ? "" : a}${trigTex(fn, k, 2)} \, dx$. ${PLUS_C}`,
      answer: `${a}x/2 ${sign} ${a} sin(${kx(2 * k)})/${4 * k}`,
      upToConstant: true,
      hint: md`Even power: use the half-angle identity $${trigTex(fn, k, 2)} = \frac{1 ${sign} ${trigTex("cos", 2 * k)}}{2}$.`,
      solution: [
        { math: md`${a === 1 ? "" : a}${trigTex(fn, k, 2)} = ${fracTex(a, 2)}\left(1 ${sign} ${trigTex("cos", 2 * k)}\right)`, note: md`From $\cos 2\theta = 1 - 2\sin^2\theta = 2\cos^2\theta - 1$.` },
        { math: md`${fracTex(a, 2)} \int 1 \, dx ${sign} ${fracTex(a, 2)} \int ${trigTex("cos", 2 * k)} \, dx`, note: "" },
        { math: md`${fracTex(a, 2)} x ${sign} ${fracTex(a, 4 * k)} ${trigTex("sin", 2 * k)} + C`, note: md`$\int \cos(${kx(2 * k)}) \, dx = \frac{1}{${2 * k}} \sin(${kx(2 * k)})$.` },
      ],
    };
  }
  if (kind === 2) {
    // ∫_0^π sin^2(kx) dx = π/2;  ∫_0^{2π} cos^2(kx) dx = π
    const k = r.int(1, 4);
    const isSin = r.next() < 0.5;
    const fn = isSin ? "sin" : "cos";
    const upper = isSin ? "\\pi" : "2\\pi";
    const answer = isSin ? "pi/2" : "pi";
    return {
      prompt: md`Evaluate $\int_{0}^{${upper}} ${trigTex(fn, k, 2)} \, dx$. Give an exact answer (type $\pi$ as pi).`,
      answer,
      hint: md`Half-angle first. The $\sin(${kx(2 * k)})$ term vanishes at both limits.`,
      solution: [
        { math: md`\int_{0}^{${upper}} \frac{1 ${isSin ? "-" : "+"} \cos(${kx(2 * k)})}{2} \, dx`, note: "Half-angle identity." },
        { math: md`\left[\frac{x}{2} ${isSin ? "-" : "+"} \frac{\sin(${kx(2 * k)})}{${4 * k}}\right]_{0}^{${upper}}`, note: "" },
        { math: md`\frac{${upper}}{2} - 0 = ${isSin ? "\\frac{\\pi}{2}" : "\\pi"}`, note: md`$\sin(${kx(2 * k)})$ is 0 at $x = 0$ and at $x = ${upper}$. Over whole periods, $${trigTex(fn, k, 2)}$ averages exactly $\frac12$.` },
      ],
    };
  }
  // ∫ sin^2 x cos^2 x dx = x/8 - sin(4x)/32
  return {
    prompt: md`Find $\int \sin^2 x \cos^2 x \, dx$. ${PLUS_C}`,
    answer: "x/8 - sin(4x)/32",
    upToConstant: true,
    hint: md`$\sin x \cos x = \frac12 \sin 2x$, so the integrand is $\frac14 \sin^2 2x$. Then half-angle once more.`,
    solution: [
      { math: md`\sin^2 x \cos^2 x = (\sin x \cos x)^2 = \left(\frac{\sin 2x}{2}\right)^2 = \frac{\sin^2 2x}{4}`, note: "Double-angle formula for sine." },
      { math: md`\frac{\sin^2 2x}{4} = \frac{1 - \cos 4x}{8}`, note: md`Half-angle identity with $\theta = 2x$.` },
      { math: md`\int \frac{1 - \cos 4x}{8} \, dx = \frac{x}{8} - \frac{\sin 4x}{32} + C`, note: "" },
    ],
  };
};

const tanAndSec: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const n = r.int(1, 4);
    // ∫ tan^n x sec^2 x dx = tan^{n+1} x/(n+1)
    return {
      prompt: md`Find $\int \tan^{${n}} x \, \sec^2 x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
      answer: `(tan(x))^${n + 1}/${n + 1}`,
      upToConstant: true,
      hint: md`$\sec^2 x$ is the derivative of $\tan x$. Let $u = \tan x$.`,
      solution: [
        { math: md`u = \tan x, \quad du = \sec^2 x \, dx`, note: "" },
        { math: md`\int u^{${n}} \, du = \frac{u^{${n + 1}}}{${n + 1}} = \frac{\tan^{${n + 1}} x}{${n + 1}} + C`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const n = r.int(2, 4);
    // ∫ sec^n x tan x dx = sec^n x / n   (write sec^{n-1} x · sec x tan x)
    return {
      prompt: md`Find $\int \sec^{${n}} x \tan x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
      answer: `(sec(x))^${n}/${n}`,
      upToConstant: true,
      hint: md`Split off one $\sec x \tan x$, the derivative of $\sec x$, and let $u = \sec x$.`,
      solution: [
        { math: md`\sec^{${n}} x \tan x = \sec^{${n - 1}} x \cdot (\sec x \tan x)`, note: "" },
        { math: md`u = \sec x, \quad du = \sec x \tan x \, dx`, note: "" },
        { math: md`\int u^{${n - 1}} \, du = \frac{u^{${n}}}{${n}} = \frac{\sec^{${n}} x}{${n}} + C`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 3);
    // ∫ tan^2(kx) dx = tan(kx)/k - x
    return {
      prompt: md`Find $\int ${trigTex("tan", k, 2)} \, dx$. ${PLUS_C}`,
      answer: `tan(${kx(k)})/${k} - x`,
      upToConstant: true,
      hint: md`$\tan^2 = \sec^2 - 1$, and $\sec^2$ is a derivative you know.`,
      solution: [
        { math: md`${trigTex("tan", k, 2)} = ${trigTex("sec", k, 2)} - 1`, note: md`Divide $\sin^2 + \cos^2 = 1$ by $\cos^2$.` },
        { math: md`\int ${trigTex("sec", k, 2)} \, dx - \int 1 \, dx = \frac{1}{${k}} ${trigTex("tan", k)} - x + C`, note: md`$\frac{d}{dx} \tan(${kx(k)}) = ${k === 1 ? "" : k} \sec^2(${kx(k)})$.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.int(1, 3);
    const a = r.int(1, 3);
    // ∫ a tan(kx) dx = -(a/k) ln|cos(kx)|
    return {
      prompt: md`Find $\int ${a === 1 ? "" : a}${trigTex("tan", k)} \, dx$. Type $\ln|\cos x|$ as ln(abs(cos(x))). ${PLUS_C}`,
      answer: `-${a}/${k} ln(abs(cos(${kx(k)})))`,
      upToConstant: true,
      hint: md`Write $\tan = \frac{\sin}{\cos}$ and substitute $u = \cos(${kx(k)})$.`,
      solution: [
        { math: md`${a === 1 ? "" : a}\int \frac{\sin(${kx(k)})}{\cos(${kx(k)})} \, dx`, note: "" },
        { math: md`u = \cos(${kx(k)}), \quad du = -${k === 1 ? "" : k}\sin(${kx(k)}) \, dx`, note: "" },
        { math: md`-${fracTex(a, k)} \int \frac{du}{u} = -${fracTex(a, k)} \ln|u| + C = -${fracTex(a, k)} \ln|\cos(${kx(k)})| + C`, note: md`Equivalently $${fracTex(a, k)} \ln|\sec(${kx(k)})|$.` },
      ],
    };
  }
  // ∫ sec^4 x dx = tan x + tan^3 x / 3
  return {
    prompt: md`Find $\int \sec^4 x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
    answer: "tan(x) + (tan(x))^3/3",
    upToConstant: true,
    hint: md`Save one $\sec^2 x$ for $du$ and write the other as $1 + \tan^2 x$.`,
    solution: [
      { math: md`\sec^4 x = (1 + \tan^2 x) \sec^2 x`, note: md`$\sec^2 = 1 + \tan^2$.` },
      { math: md`u = \tan x, \quad du = \sec^2 x \, dx`, note: "" },
      { math: md`\int (1 + u^2) \, du = u + \frac{u^3}{3} = \tan x + \frac{\tan^3 x}{3} + C`, note: "" },
    ],
  };
};

// ── Lesson 3: trigonometric substitution ───────────────────────────────────

const ROOT_NOTE = md`Type $\arcsin$ as asin, $\arctan$ as atan and $\sqrt{\ }$ as sqrt( ).`;

const sineSubstitution: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.int(1, 5);
  const a2 = a * a;
  const root = `\\sqrt{${a2} - x^2}`;
  const rootText = `sqrt(${a2} - x^2)`;
  const theta = md`$x = ${a}\sin\theta$, $dx = ${a}\cos\theta \, d\theta$, and $${root} = ${a}\cos\theta$`;
  if (kind === 0) {
    const k = r.int(1, 5);
    // ∫ k / sqrt(a^2 - x^2) dx = k arcsin(x/a)
    return {
      prompt: md`Find $\int \frac{${k}}{${root}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${k} asin(x/${a})`,
      upToConstant: true,
      hint: md`$${a2} - x^2$ asks for $x = ${a}\sin\theta$: then $${a2} - x^2 = ${a2}\cos^2\theta$ and the root disappears.`,
      solution: [
        { math: md`x = ${a}\sin\theta, \quad dx = ${a}\cos\theta \, d\theta, \quad ${root} = \sqrt{${a2}(1 - \sin^2\theta)} = ${a}\cos\theta`, note: md`For $-\frac{\pi}{2} \le \theta \le \frac{\pi}{2}$, $\cos\theta \ge 0$, so the root is $${a}\cos\theta$ and not $-${a}\cos\theta$.` },
        { math: md`\int \frac{${k} \cdot ${a}\cos\theta}{${a}\cos\theta} \, d\theta = \int ${k} \, d\theta = ${k}\theta + C`, note: "The whole root cancels." },
        { math: md`${k}\arcsin\frac{x}{${a}} + C`, note: md`$\sin\theta = \frac{x}{${a}}$, so $\theta = \arcsin\frac{x}{${a}}$.` },
      ],
    };
  }
  if (kind === 1) {
    // ∫ sqrt(a^2 - x^2) dx = (a^2/2) arcsin(x/a) + (x/2) sqrt(a^2 - x^2)
    return {
      prompt: md`Find $\int ${root} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${a2}/2 asin(x/${a}) + x/2 ${rootText}`,
      upToConstant: true,
      hint: md`Substitute ${theta}. You will meet $\cos^2\theta$: half-angle.`,
      solution: [
        { math: md`\int ${a}\cos\theta \cdot ${a}\cos\theta \, d\theta = ${a2}\int \cos^2\theta \, d\theta`, note: md`${theta}.` },
        { math: md`${a2}\int \frac{1 + \cos 2\theta}{2} \, d\theta = ${fracTex(a2, 2)}\left(\theta + \frac{\sin 2\theta}{2}\right) = ${fracTex(a2, 2)}\left(\theta + \sin\theta\cos\theta\right)`, note: md`$\sin 2\theta = 2\sin\theta\cos\theta$.` },
        { math: md`\sin\theta = \frac{x}{${a}}, \quad \cos\theta = \frac{${root}}{${a}}`, note: md`Reference triangle: hypotenuse ${a}, opposite $x$, adjacent $${root}$.` },
        { math: md`${fracTex(a2, 2)}\arcsin\frac{x}{${a}} + \frac{x}{2}${root} + C`, note: md`$${fracTex(a2, 2)} \cdot \frac{x}{${a}} \cdot \frac{${root}}{${a}} = \frac{x${root}}{2}$.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 4);
    // ∫ k / (a^2 - x^2)^{3/2} dx = k x / (a^2 sqrt(a^2 - x^2))
    return {
      prompt: md`Find $\int \frac{${k}}{(${a2} - x^2)^{3/2}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${k}x/(${a2} ${rootText})`,
      upToConstant: true,
      hint: md`$(${a2} - x^2)^{3/2} = (${root})^3 = (${a}\cos\theta)^3$ after the substitution.`,
      solution: [
        { math: md`\int \frac{${k} \cdot ${a}\cos\theta}{${a2 * a}\cos^3\theta} \, d\theta = ${fracTex(k, a2)}\int \sec^2\theta \, d\theta = ${fracTex(k, a2)}\tan\theta + C`, note: md`${theta}.` },
        { math: md`\tan\theta = \frac{x}{${root}}`, note: "Opposite over adjacent in the reference triangle." },
        { math: md`\frac{${k}x}{${a2}${root}} + C`, note: "" },
      ],
    };
  }
  // ∫ x^2 / sqrt(a^2 - x^2) dx = (a^2/2) arcsin(x/a) - (x/2) sqrt(a^2 - x^2)
  return {
    prompt: md`Find $\int \frac{x^2}{${root}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
    answer: `${a2}/2 asin(x/${a}) - x/2 ${rootText}`,
    upToConstant: true,
    hint: md`After ${theta}, the integrand becomes $${a2}\sin^2\theta$.`,
    solution: [
      { math: md`\int \frac{${a2}\sin^2\theta \cdot ${a}\cos\theta}{${a}\cos\theta} \, d\theta = ${a2}\int \sin^2\theta \, d\theta`, note: "" },
      { math: md`${a2}\int \frac{1 - \cos 2\theta}{2} \, d\theta = ${fracTex(a2, 2)}(\theta - \sin\theta\cos\theta)`, note: md`$\frac{\sin 2\theta}{2} = \sin\theta\cos\theta$.` },
      { math: md`${fracTex(a2, 2)}\arcsin\frac{x}{${a}} - \frac{x}{2}${root} + C`, note: md`$\sin\theta = \frac{x}{${a}}$, $\cos\theta = \frac{${root}}{${a}}$.` },
    ],
  };
};

const tangentSubstitution: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.int(1, 5);
  const a2 = a * a;
  const root = `\\sqrt{x^2 + ${a2}}`;
  const rootText = `sqrt(x^2 + ${a2})`;
  const theta = md`$x = ${a}\tan\theta$, $dx = ${a}\sec^2\theta \, d\theta$, and $x^2 + ${a2} = ${a2}\sec^2\theta$`;
  if (kind === 0) {
    const k = r.int(1, 6);
    // ∫ k / (x^2 + a^2) dx = (k/a) arctan(x/a)
    return {
      prompt: md`Find $\int \frac{${k}}{x^2 + ${a2}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${k}/${a} atan(x/${a})`,
      upToConstant: true,
      hint: md`$x^2 + ${a2}$ asks for $x = ${a}\tan\theta$, because $1 + \tan^2\theta = \sec^2\theta$.`,
      solution: [
        { math: md`\int \frac{${k} \cdot ${a}\sec^2\theta}{${a2}\sec^2\theta} \, d\theta = \int ${fracTex(k, a)} \, d\theta = ${fracTex(k, a)}\theta + C`, note: md`${theta}.` },
        { math: md`${fracTex(k, a)}\arctan\frac{x}{${a}} + C`, note: md`$\tan\theta = \frac{x}{${a}}$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 4);
    // ∫ k / sqrt(x^2 + a^2) dx = k ln(x + sqrt(x^2 + a^2))
    return {
      prompt: md`Find $\int \frac{${k}}{${root}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${k} ln(x + ${rootText})`,
      upToConstant: true,
      hint: md`The substitution leaves $\int \sec\theta \, d\theta = \ln|\sec\theta + \tan\theta|$ from the last lesson.`,
      solution: [
        { math: md`\int \frac{${k} \cdot ${a}\sec^2\theta}{${a}\sec\theta} \, d\theta = ${k}\int \sec\theta \, d\theta = ${k}\ln|\sec\theta + \tan\theta| + C`, note: md`${theta}, so $${root} = ${a}\sec\theta$.` },
        { math: md`\sec\theta = \frac{${root}}{${a}}, \quad \tan\theta = \frac{x}{${a}}`, note: "Reference triangle: adjacent " + a + ", opposite x, hypotenuse the root." },
        { math: md`${k}\ln\left|\frac{x + ${root}}{${a}}\right| + C = ${k}\ln\left(x + ${root}\right) + C`, note: md`$-${k}\ln ${a}$ is a constant and joins $C$. The quantity $x + ${root}$ is always positive, so no absolute value is needed.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 4);
    // ∫ k / (x^2 + a^2)^{3/2} dx = k x / (a^2 sqrt(x^2 + a^2))
    return {
      prompt: md`Find $\int \frac{${k}}{(x^2 + ${a2})^{3/2}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${k}x/(${a2} ${rootText})`,
      upToConstant: true,
      hint: md`$(x^2 + ${a2})^{3/2} = (${a}\sec\theta)^3$. Then $\frac{\sec^2\theta}{\sec^3\theta} = \cos\theta$.`,
      solution: [
        { math: md`\int \frac{${k} \cdot ${a}\sec^2\theta}{${a2 * a}\sec^3\theta} \, d\theta = ${fracTex(k, a2)}\int \cos\theta \, d\theta = ${fracTex(k, a2)}\sin\theta + C`, note: md`${theta}.` },
        { math: md`\sin\theta = \frac{x}{${root}}`, note: "Opposite over hypotenuse." },
        { math: md`\frac{${k}x}{${a2}${root}} + C`, note: "" },
      ],
    };
  }
  // ∫_0^a dx/(x^2 + a^2) = π/(4a)
  return {
    prompt: md`Evaluate $\int_{0}^{${a}} \frac{1}{x^2 + ${a2}} \, dx$. Give an exact answer (type $\pi$ as pi).`,
    answer: `pi/${4 * a}`,
    hint: md`Change the limits along with the variable: when $x = ${a}\tan\theta$, $x = 0$ means $\theta = 0$ and $x = ${a}$ means $\theta = \frac{\pi}{4}$.`,
    solution: [
      { math: md`\int_{0}^{\pi/4} \frac{${a}\sec^2\theta}{${a2}\sec^2\theta} \, d\theta = \frac{1}{${a}}\int_{0}^{\pi/4} d\theta`, note: md`${theta}. New limits: $\tan\theta = 0$ at $\theta = 0$ and $\tan\theta = 1$ at $\theta = \frac{\pi}{4}$.` },
      { math: md`\frac{1}{${a}} \cdot \frac{\pi}{4} = \frac{\pi}{${4 * a}}`, note: "No need to convert back: the limits are already in θ." },
    ],
  };
};

const secantSubstitution: Generator = (r) => {
  const kind = r.int(0, 3);
  const a = r.int(1, 2);
  const a2 = a * a;
  const root = `\\sqrt{x^2 - ${a2}}`;
  const rootText = `sqrt(x^2 - ${a2})`;
  const theta = md`$x = ${a}\sec\theta$, $dx = ${a}\sec\theta\tan\theta \, d\theta$, and $x^2 - ${a2} = ${a2}\tan^2\theta$`;
  const ABS_NOTE = md`Type $\ln|u|$ as ln(abs(u)).`;
  if (kind === 0) {
    const k = r.int(1, 4);
    // ∫ k / sqrt(x^2 - a^2) dx = k ln|x + sqrt(x^2 - a^2)|
    return {
      prompt: md`Find $\int \frac{${k}}{${root}} \, dx$. ${ROOT_NOTE} ${ABS_NOTE} ${PLUS_C}`,
      answer: `${k} ln(abs(x + ${rootText}))`,
      upToConstant: true,
      hint: md`$x^2 - ${a2}$ asks for $x = ${a}\sec\theta$, since $\sec^2\theta - 1 = \tan^2\theta$.`,
      solution: [
        { math: md`\int \frac{${k} \cdot ${a}\sec\theta\tan\theta}{${a}\tan\theta} \, d\theta = ${k}\int \sec\theta \, d\theta = ${k}\ln|\sec\theta + \tan\theta| + C`, note: md`${theta}, so $${root} = ${a}\tan\theta$.` },
        { math: md`\sec\theta = \frac{x}{${a}}, \quad \tan\theta = \frac{${root}}{${a}}`, note: "Reference triangle: hypotenuse x, adjacent " + a + ", opposite the root." },
        { math: md`${k}\ln\left|\frac{x + ${root}}{${a}}\right| + C = ${k}\ln\left|x + ${root}\right| + C`, note: md`$-${k}\ln ${a}$ joins the constant.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 4);
    // ∫ k / (x^2 sqrt(x^2 - a^2)) dx = k sqrt(x^2 - a^2) / (a^2 x)
    return {
      prompt: md`Find $\int \frac{${k}}{x^2 ${root}} \, dx$. ${ROOT_NOTE} ${PLUS_C}`,
      answer: `${k} ${rootText}/(${a2} x)`,
      upToConstant: true,
      hint: md`After the substitution, the integrand reduces to a multiple of $\cos\theta$.`,
      solution: [
        { math: md`\int \frac{${k} \cdot ${a}\sec\theta\tan\theta}{${a2}\sec^2\theta \cdot ${a}\tan\theta} \, d\theta = ${fracTex(k, a2)}\int \frac{d\theta}{\sec\theta} = ${fracTex(k, a2)}\int \cos\theta \, d\theta`, note: md`${theta}.` },
        { math: md`${fracTex(k, a2)}\sin\theta + C, \qquad \sin\theta = \frac{${root}}{x}`, note: "Opposite over hypotenuse in the reference triangle." },
        { math: md`\frac{${k}${root}}{${a2}x} + C`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    // ∫ sqrt(x^2 - a^2)/x dx = sqrt(x^2 - a^2) - a arcsec(x/a) = sqrt(x^2 - a^2) - a arccos(a/|x|)
    return {
      prompt: md`Find $\int \frac{${root}}{x} \, dx$ for $x > ${a}$. Write $\operatorname{arcsec}${a === 1 ? " x" : `\\frac{x}{${a}}`}$ as acos(${a}/x), and sqrt( ) for the root. ${PLUS_C}`,
      answer: `${rootText} - ${a} acos(${a}/abs(x))`,
      upToConstant: true,
      hint: md`The substitution gives $\int ${a}\tan^2\theta \, d\theta$, and $\tan^2 = \sec^2 - 1$.`,
      solution: [
        { math: md`\int \frac{${a}\tan\theta}{${a}\sec\theta} \cdot ${a}\sec\theta\tan\theta \, d\theta = ${a}\int \tan^2\theta \, d\theta`, note: md`${theta}.` },
        { math: md`${a}\int (\sec^2\theta - 1) \, d\theta = ${a}\tan\theta - ${a}\theta + C`, note: "" },
        { math: md`\tan\theta = \frac{${root}}{${a}}, \quad \theta = \operatorname{arcsec}\frac{x}{${a}} = \arccos\frac{${a}}{x}`, note: md`$\sec\theta = \frac{x}{${a}}$ means $\cos\theta = \frac{${a}}{x}$.` },
        { math: md`${root} - ${a}\arccos\frac{${a}}{x} + C`, note: "" },
      ],
    };
  }
  // ∫ x^2 / sqrt(x^2 - a^2) dx = (x/2) sqrt(x^2 - a^2) + (a^2/2) ln|x + sqrt(x^2 - a^2)|
  return {
    prompt: md`Find $\int \frac{x^2}{${root}} \, dx$. ${ROOT_NOTE} ${ABS_NOTE} ${PLUS_C}`,
    answer: `x/2 ${rootText} + ${a2}/2 ln(abs(x + ${rootText}))`,
    upToConstant: true,
    hint: md`The substitution leaves $${a2}\int \sec^3\theta \, d\theta$. Integrate by parts with $u = \sec\theta$, $dv = \sec^2\theta \, d\theta$, and solve for the integral.`,
    solution: [
      { math: md`\int \frac{${a2}\sec^2\theta \cdot ${a}\sec\theta\tan\theta}{${a}\tan\theta} \, d\theta = ${a2}\int \sec^3\theta \, d\theta`, note: md`${theta}.` },
      { math: md`\int \sec^3\theta \, d\theta = \sec\theta\tan\theta - \int \sec\theta\tan^2\theta \, d\theta = \sec\theta\tan\theta - \int \sec^3\theta \, d\theta + \int \sec\theta \, d\theta`, note: md`Parts with $u = \sec\theta$, $dv = \sec^2\theta \, d\theta$, then $\tan^2 = \sec^2 - 1$.` },
      { math: md`\int \sec^3\theta \, d\theta = \frac{1}{2}\left(\sec\theta\tan\theta + \ln|\sec\theta + \tan\theta|\right)`, note: "The integral appears on both sides; add it over and halve." },
      { math: md`\frac{x}{2}${root} + ${fracTex(a2, 2)}\ln\left|x + ${root}\right| + C`, note: md`$\sec\theta = \frac{x}{${a}}$, $\tan\theta = \frac{${root}}{${a}}$; the $\ln ${a}$ joins $C$.` },
    ],
  };
};

// ── Lesson 4: partial fractions ────────────────────────────────────────────

const LN_NOTE = md`Type $\ln|x - 2|$ as ln(abs(x - 2)).`;
/** A ln|x - a| as typed text. */
const lnAbs = (c: number, a: number) => (c === 0 ? "" : `${c} ln(abs(${xm(a)}))`);
/** A ln|x - a| in LaTeX. */
const lnAbsTex = (c: number, a: number) => `${c === 1 ? "" : c === -1 ? "-" : c}\\ln|${xm(a)}|`;

const distinctLinearFactors: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.int(-4, 4);
  let b = r.int(-4, 4);
  while (b === a) b = r.int(-4, 4);
  const A = r.nonzero(-4, 4);
  const B = r.nonzero(-4, 4);
  // (A(x - b) + B(x - a)) / ((x - a)(x - b))
  const p = A + B;
  const qq = -(A * b + B * a);
  const num = poly([[p, "x"], [qq, ""]]);
  const factored = `(${xm(a)})(${xm(b)})`;
  const expanded = poly([[1, "x^2"], [-(a + b), "x"], [a * b, ""]]);
  const N = (x: number) => p * x + qq;
  const setup: Step[] = [
    { math: md`\frac{${num}}{${factored}} = \frac{A}{${xm(a)}} + \frac{B}{${xm(b)}}`, note: "Two distinct linear factors: one constant over each." },
    { math: md`${num} = A(${xm(b)}) + B(${xm(a)})`, note: "Multiply through by the denominator." },
    { math: md`x = ${a}: \quad ${N(a)} = A(${a - b}) \Rightarrow A = ${A}`, note: md`Choosing $x = ${a}$ kills the $B$ term.` },
    { math: md`x = ${b}: \quad ${N(b)} = B(${b - a}) \Rightarrow B = ${B}`, note: md`Choosing $x = ${b}$ kills the $A$ term.` },
  ];
  if (kind === 0) {
    const x0 = r.pick([5, 6, 7].filter((v) => v !== a && v !== b));
    const x1 = r.pick([-5, -6, -7].filter((v) => v !== a && v !== b));
    return {
      prompt: md`Find constants $A$ and $B$ with $\dfrac{${num}}{${factored}} = \dfrac{A}{${xm(a)}} + \dfrac{B}{${xm(b)}}$. Answer as (A, B).`,
      answer: `(${A}, ${B})`,
      form: "tuple",
      // The identity A(x - b) + B(x - a) = numerator, checked at two values of x away from the roots.
      verify: [`A (${x0} ${signed(-b)}) + B (${x0} ${signed(-a)}) = ${N(x0)}`, `A (${paren(x1)} ${signed(-b)}) + B (${paren(x1)} ${signed(-a)}) = ${N(x1)}`],
      hint: md`Clear the denominators, then choose the two values of $x$ that make each factor zero.`,
      solution: setup,
    };
  }
  const shown = kind === 1 ? factored : expanded;
  return {
    prompt: md`Find $\int \frac{${num}}{${shown}} \, dx$. ${LN_NOTE} ${PLUS_C}`,
    answer: `${lnAbs(A, a)} + ${lnAbs(B, b)}`,
    upToConstant: true,
    hint: kind === 1 ? md`Split into $\frac{A}{${xm(a)}} + \frac{B}{${xm(b)}}$ first. Each piece integrates to a logarithm.` : md`Factor the denominator: $${expanded} = ${factored}$. Then split into partial fractions.`,
    solution: [
      ...(kind === 2 ? [{ math: md`${expanded} = ${factored}`, note: "Factor first; partial fractions need the factors." }] : []),
      ...setup,
      { math: md`\int \frac{${A}}{${xm(a)}} \, dx + \int \frac{${B}}{${xm(b)}} \, dx = ${lnAbsTex(A, a)} ${B < 0 ? "-" : "+"} ${lnAbsTex(Math.abs(B), b)} + C`, note: md`$\int \frac{dx}{x - c} = \ln|x - c|$.` },
    ],
  };
};

const repeatedFactors: Generator = (r) => {
  const kind = r.int(0, 1);
  const a = r.nonzero(-4, 4);
  if (kind === 0) {
    // (A(x - a) + B)/(x - a)^2:  A ln|x - a| - B/(x - a)
    const A = r.nonzero(-4, 4);
    const B = r.nonzero(-5, 5);
    const num = poly([[A, "x"], [B - A * a, ""]]);
    return {
      prompt: md`Find $\int \frac{${num}}{(${xm(a)})^2} \, dx$. ${LN_NOTE} ${PLUS_C}`,
      answer: `${lnAbs(A, a)} - (${B})/(${xm(a)})`,
      upToConstant: true,
      hint: md`A repeated factor gets two terms: $\frac{A}{${xm(a)}} + \frac{B}{(${xm(a)})^2}$.`,
      solution: [
        { math: md`\frac{${num}}{(${xm(a)})^2} = \frac{A}{${xm(a)}} + \frac{B}{(${xm(a)})^2}`, note: "One term for each power of the repeated factor." },
        { math: md`${num} = A(${xm(a)}) + B`, note: "Multiply through." },
        { math: md`x = ${a}: \quad B = ${B}; \qquad \text{compare } x\text{ terms: } A = ${A}`, note: md`$x = ${a}$ kills the $A$ term. The coefficient of $x$ on the right is just $A$.` },
        { math: md`\int \frac{${A}}{${xm(a)}} \, dx + \int ${B}(${xm(a)})^{-2} \, dx = ${lnAbsTex(A, a)} - \frac{${B}}{${xm(a)}} + C`, note: md`$\int (x - c)^{-2} \, dx = -(x - c)^{-1}$ by the power rule.` },
      ],
    };
  }
  // (A(x - a)^2 + Bx(x - a) + Cx)/(x(x - a)^2):  A ln|x| + B ln|x - a| - C/(x - a)
  const A = r.nonzero(-3, 3);
  const B = r.nonzero(-3, 3);
  const C = r.nonzero(-4, 4);
  const num = poly([[A + B, "x^2"], [-2 * a * A - a * B + C, "x"], [A * a * a, ""]]);
  const den = `x(${xm(a)})^2`;
  return {
    prompt: md`Find $\int \frac{${num}}{${den}} \, dx$. ${LN_NOTE} ${PLUS_C}`,
    answer: `${lnAbs(A, 0)} + ${lnAbs(B, a)} - (${C})/(${xm(a)})`,
    upToConstant: true,
    hint: md`Three terms: $\frac{A}{x} + \frac{B}{${xm(a)}} + \frac{C}{(${xm(a)})^2}$. Find $A$ and $C$ by cover-up; then any other $x$ value gives $B$.`,
    solution: [
      { math: md`\frac{${num}}{${den}} = \frac{A}{x} + \frac{B}{${xm(a)}} + \frac{C}{(${xm(a)})^2}`, note: "" },
      { math: md`${num} = A(${xm(a)})^2 + Bx(${xm(a)}) + Cx`, note: "Multiply through." },
      { math: md`x = 0: \quad ${A * a * a} = A \cdot ${a * a} \Rightarrow A = ${A}`, note: "" },
      { math: md`x = ${a}: \quad ${(A + B) * a * a + (-2 * a * A - a * B + C) * a + A * a * a} = C \cdot ${a} \Rightarrow C = ${C}`, note: "" },
      { math: md`x^2 \text{ terms: } ${A + B} = A + B \Rightarrow B = ${B}`, note: "Comparing the leading coefficients is quickest for the last constant." },
      { math: md`${lnAbsTex(A, 0)} ${B < 0 ? "-" : "+"} ${lnAbsTex(Math.abs(B), a)} - \frac{${C}}{${xm(a)}} + C_0`, note: md`$\int \frac{C}{(x - c)^2} \, dx = -\frac{C}{x - c}$.` },
    ],
  };
};

const quadraticAndImproper: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    const a = r.int(1, 3);
    const a2 = a * a;
    const p = r.pick([2, 4, -2, 6]);
    const qq = r.nonzero(-4, 4);
    // ∫ (px + q)/(x^2 + a^2) dx = (p/2) ln(x^2 + a^2) + (q/a) arctan(x/a)
    const num = poly([[p, "x"], [qq, ""]]);
    return {
      prompt: md`Find $\int \frac{${num}}{x^2 + ${a2}} \, dx$. Type $\arctan$ as atan. ${PLUS_C}`,
      answer: `${p / 2} ln(x^2 + ${a2}) + (${qq})/${a} atan(x/${a})`,
      upToConstant: true,
      hint: md`$x^2 + ${a2}$ does not factor. Split the numerator: the $x$ part is a substitution, the constant part is an arctangent.`,
      solution: [
        { math: md`\int \frac{${cf(p, "x")}}{x^2 + ${a2}} \, dx + \int \frac{${qq}}{x^2 + ${a2}} \, dx`, note: "Two integrals with different tools." },
        { math: md`\int \frac{${cf(p, "x")}}{x^2 + ${a2}} \, dx = ${fracTex(p, 2)}\ln(x^2 + ${a2})`, note: md`$u = x^2 + ${a2}$, $du = 2x \, dx$. No absolute value: $x^2 + ${a2} > 0$.` },
        { math: md`\int \frac{${qq}}{x^2 + ${a2}} \, dx = ${fracTex(qq, a)}\arctan\frac{x}{${a}}`, note: md`$\int \frac{dx}{x^2 + a^2} = \frac{1}{a}\arctan\frac{x}{a}$ (tangent substitution).` },
        { math: md`${fracTex(p, 2)}\ln(x^2 + ${a2}) + ${fracTex(qq, a)}\arctan\frac{x}{${a}} + C`, note: "" },
      ],
    };
  }
  // Improper fraction: (x + m)(x - a) + R over (x - a)
  const a = r.nonzero(-4, 4);
  const m = r.int(-4, 4);
  const R = r.nonzero(-5, 5);
  const num = poly([[1, "x^2"], [m - a, "x"], [-m * a + R, ""]]);
  const quot = poly([[1, "x"], [m, ""]]);
  return {
    prompt: md`Find $\int \frac{${num}}{${xm(a)}} \, dx$. ${LN_NOTE} ${PLUS_C}`,
    answer: `x^2/2 ${m === 0 ? "" : `${signed(m)}x`} ${R < 0 ? "-" : "+"} ${lnAbs(Math.abs(R), a)}`,
    upToConstant: true,
    hint: md`The numerator has the higher degree, so divide first. Partial fractions only apply to proper fractions.`,
    solution: [
      { math: md`\frac{${num}}{${xm(a)}} = ${quot} + \frac{${R}}{${xm(a)}}`, note: md`Polynomial division: quotient $${quot}$, remainder $${R}$. Check: $(${quot})(${xm(a)}) + ${paren(R)} = ${num}$.` },
      { math: md`\int (${quot}) \, dx + \int \frac{${R}}{${xm(a)}} \, dx`, note: "" },
      { math: md`\frac{x^2}{2} ${m === 0 ? "" : `${signed(m)}x`} ${R < 0 ? "-" : "+"} ${lnAbsTex(Math.abs(R), a)} + C`, note: "" },
    ],
  };
};

// ── Lesson 5: numerical integration ────────────────────────────────────────

interface NumFn {
  tex: string;
  /** Exact value at a rational point. */
  at: (x: Q) => Q;
  /** The value at x written as a typed expression, for verify equations. */
  text: (x: Q) => string;
  /** Exact integral from a to b. */
  integral: (a: number, b: number) => Q;
}
const NUM_FNS: NumFn[] = [
  { tex: "x^2", at: (x) => mul(x, x), text: (x) => `(${qText(x)})^2`, integral: (a, b) => q(b ** 3 - a ** 3, 3) },
  { tex: "x^3", at: (x) => mul(mul(x, x), x), text: (x) => `(${qText(x)})^3`, integral: (a, b) => q(b ** 4 - a ** 4, 4) },
  { tex: "(x^2 + 1)", at: (x) => add(mul(x, x), q(1)), text: (x) => `((${qText(x)})^2 + 1)`, integral: (a, b) => add(q(b ** 3 - a ** 3, 3), q(b - a)) },
  { tex: "\\frac{1}{x}", at: (x) => q(x.d, x.n), text: (x) => `1/(${qText(x)})`, integral: () => q(0) },
];
const fnName = (f: NumFn) => (f.tex === "\\frac{1}{x}" ? "1/x" : f.tex);

/** The sample points a, a + h, ..., b. */
const gridPoints = (a: number, h: Q, n: number) => Array.from({ length: n + 1 }, (_, i) => add(q(a), mul(q(i), h)));

const trapezoidAndMidpoint: Generator = (r) => {
  const f = r.pick(NUM_FNS);
  const isLog = fnName(f) === "1/x";
  const a = isLog ? r.int(1, 2) : r.int(0, 2);
  const width = r.pick([1, 2, 4]);
  const b = a + width;
  const n = r.pick([2, 4]);
  const h = q(width, n);
  const kind = r.int(0, 1);
  const xs = gridPoints(a, h, n);
  const name = fnName(f);
  const exact = f.integral(a, b);
  const exactNum = isLog ? Math.log(b / a) : qNum(exact);
  const exactTex = isLog ? `\\ln ${b} - \\ln ${a} \\approx ${exactNum.toFixed(4)}` : qTex(exact);
  if (kind === 0) {
    // T = h/2 (f0 + 2f1 + ... + 2f_{n-1} + fn)
    let sum = q(0);
    xs.forEach((x, i) => (sum = add(sum, mul(q(i === 0 || i === n ? 1 : 2), f.at(x)))));
    const T = mul(mul(h, q(1, 2)), sum);
    const terms = xs.map((x, i) => `${i === 0 || i === n ? "" : "2 "}${f.text(x)}`).join(" + ");
    return {
      prompt: md`Use the trapezoid rule with $n = ${n}$ to approximate $\int_{${a}}^{${b}} ${f.tex} \, dx$. Give the exact value of $T_{${n}}$ as a fraction or decimal.`,
      answer: qText(T),
      verify: [`T = (${qText(h)})/2 (${terms})`],
      hint: md`$h = \frac{${b} - ${a}}{${n}} = ${qTex(h)}$. Then $T_{${n}} = \frac{h}{2}\big(f(x_0) + 2f(x_1) + \cdots + 2f(x_{${n - 1}}) + f(x_{${n}})\big)$.`,
      solution: [
        { math: md`h = ${qTex(h)}, \qquad x_i = ${xs.map(qTex).join(",\\ ")}`, note: md`$n = ${n}$ strips of width $h$.` },
        { math: md`f(x_i) = ${xs.map((x) => qTex(f.at(x))).join(",\\ ")}`, note: md`Values of $f(x) = ${f.tex}$ at the grid points.` },
        { math: md`T_{${n}} = \frac{${qTex(h)}}{2}\left(${xs.map((x, i) => `${i === 0 || i === n ? "" : "2 \\cdot "}${qTex(f.at(x))}`).join(" + ")}\right)`, note: "Ends counted once, interior points twice." },
        { math: md`T_{${n}} = ${qTex(T)}${T.d === 1 ? "" : ` = ${qNum(T)}`}`, note: md`The exact integral is $${exactTex}$. The trapezoid estimate is ${qNum(T) > exactNum + 1e-9 ? "too large: the curve is concave up, so chords lie above it" : qNum(T) < exactNum - 1e-9 ? "too small" : "exact here"}.` },
      ],
    };
  }
  // M = h (f(m1) + ... + f(mn)), midpoints
  const mids = Array.from({ length: n }, (_, i) => add(q(a), mul(q(2 * i + 1, 2), h)));
  let sum = q(0);
  for (const m of mids) sum = add(sum, f.at(m));
  const M = mul(h, sum);
  return {
    prompt: md`Use the midpoint rule with $n = ${n}$ to approximate $\int_{${a}}^{${b}} ${f.tex} \, dx$. Give the exact value of $M_{${n}}$ as a fraction or decimal.`,
    answer: qText(M),
    verify: [`M = (${qText(h)}) (${mids.map((m) => f.text(m)).join(" + ")})`],
    hint: md`$h = ${qTex(h)}$. Evaluate $f$ at the middle of each strip, add, and multiply by $h$.`,
    solution: [
      { math: md`h = ${qTex(h)}, \qquad \text{midpoints } ${mids.map(qTex).join(",\\ ")}`, note: "" },
      { math: md`f(\text{midpoints}) = ${mids.map((m) => qTex(f.at(m))).join(",\\ ")}`, note: md`$f(x) = ${name === "1/x" ? "1/x" : f.tex}$.` },
      { math: md`M_{${n}} = ${qTex(h)}\left(${mids.map((m) => qTex(f.at(m))).join(" + ")}\right) = ${qTex(M)}${M.d === 1 ? "" : ` = ${qNum(M)}`}`, note: md`The exact integral is $${exactTex}$. The midpoint error is about half the trapezoid error and on the other side.` },
    ],
  };
};

const simpsonExact: Generator = (r) => {
  const f = r.pick(NUM_FNS);
  const isLog = fnName(f) === "1/x";
  const a = isLog ? r.int(1, 2) : r.int(0, 1);
  const width = r.pick([2, 4]);
  const b = a + width;
  const n = r.pick([2, 4]);
  const h = q(width, n);
  const xs = gridPoints(a, h, n);
  const weight = (i: number) => (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  let sum = q(0);
  xs.forEach((x, i) => (sum = add(sum, mul(q(weight(i)), f.at(x)))));
  const S = mul(mul(h, q(1, 3)), sum);
  const exact = f.integral(a, b);
  const exactTex = isLog ? `\\ln ${b} - \\ln ${a} \\approx ${Math.log(b / a).toFixed(5)}` : qTex(exact);
  return {
    prompt: md`Use Simpson's rule with $n = ${n}$ to approximate $\int_{${a}}^{${b}} ${f.tex} \, dx$. Give the exact value of $S_{${n}}$ as a fraction or decimal.`,
    answer: qText(S),
    verify: [`S = (${qText(h)})/3 (${xs.map((x, i) => `${weight(i) === 1 ? "" : `${weight(i)} `}${f.text(x)}`).join(" + ")})`],
    hint: md`$h = ${qTex(h)}$ and $S_{${n}} = \frac{h}{3}\big(f(x_0) + 4f(x_1) + 2f(x_2) + \cdots + 4f(x_{${n - 1}}) + f(x_{${n}})\big)$: weights 1, 4, 2, 4, ..., 1.`,
    solution: [
      { math: md`h = ${qTex(h)}, \qquad x_i = ${xs.map(qTex).join(",\\ ")}`, note: md`$n$ must be even for Simpson's rule; $n = ${n}$ is.` },
      { math: md`f(x_i) = ${xs.map((x) => qTex(f.at(x))).join(",\\ ")}`, note: "" },
      { math: md`S_{${n}} = \frac{${qTex(h)}}{3}\left(${xs.map((x, i) => `${weight(i) === 1 ? "" : `${weight(i)} \\cdot `}${qTex(f.at(x))}`).join(" + ")}\right)`, note: "Weights 1, 4, 2, 4, ..., 4, 1." },
      { math: md`S_{${n}} = ${qTex(S)}${S.d === 1 ? "" : ` \\approx ${qNum(S).toFixed(5)}`}`, note: isLog ? md`The exact integral is $${exactTex}$: Simpson's rule is already very close.` : md`The exact integral is $${exactTex}$. Simpson's rule is exact for every polynomial of degree 3 or less, so for $${f.tex}$ the "approximation" is the true value.` },
    ],
  };
};

const simpsonRounded: Generator = (r) => {
  const fns = [
    { tex: "\\sqrt{1 + x^3}", f: (x: number) => Math.sqrt(1 + x ** 3), a: 0, b: 2 },
    { tex: "e^{-x^2}", f: (x: number) => Math.exp(-x * x), a: 0, b: 1 },
    { tex: "\\sin(x^2)", f: (x: number) => Math.sin(x * x), a: 0, b: 1 },
    { tex: "\\frac{1}{1 + x^2}", f: (x: number) => 1 / (1 + x * x), a: 0, b: 2 },
    { tex: "\\ln(1 + x)", f: (x: number) => Math.log(1 + x), a: 0, b: 2 },
    { tex: "\\cos x", f: (x: number) => Math.cos(x), a: 0, b: 1 },
  ];
  const g = r.pick(fns);
  const n = 4;
  const method = r.pick(["trapezoid", "Simpson's", "midpoint"] as const);
  const h = (g.b - g.a) / n;
  const xs = Array.from({ length: n + 1 }, (_, i) => g.a + i * h);
  const ys = xs.map(g.f);
  let value: number;
  let formula: string;
  let terms: string;
  if (method === "trapezoid") {
    value = (h / 2) * ys.reduce((s, y, i) => s + (i === 0 || i === n ? y : 2 * y), 0);
    formula = `T_4 = \\frac{h}{2}\\big(f(x_0) + 2f(x_1) + 2f(x_2) + 2f(x_3) + f(x_4)\\big)`;
    terms = ys.map((y, i) => `${i === 0 || i === n ? "" : "2 \\cdot "}${y.toFixed(5)}`).join(" + ");
  } else if (method === "Simpson's") {
    value = (h / 3) * ys.reduce((s, y, i) => s + (i === 0 || i === n ? y : i % 2 ? 4 * y : 2 * y), 0);
    formula = `S_4 = \\frac{h}{3}\\big(f(x_0) + 4f(x_1) + 2f(x_2) + 4f(x_3) + f(x_4)\\big)`;
    terms = ys.map((y, i) => `${i === 0 || i === n ? "" : i % 2 ? "4 \\cdot " : "2 \\cdot "}${y.toFixed(5)}`).join(" + ");
  } else {
    const mids = Array.from({ length: n }, (_, i) => g.a + (i + 0.5) * h);
    const ms = mids.map(g.f);
    value = h * ms.reduce((s, y) => s + y, 0);
    formula = `M_4 = h\\big(f(${mids.map((m) => m.toFixed(2)).join(") + f(")})\\big)`;
    terms = ms.map((y) => y.toFixed(5)).join(" + ");
  }
  const sym = method === "trapezoid" ? "T_4" : method === "Simpson's" ? "S_4" : "M_4";
  const rule = method === "Simpson's" ? "Simpson's rule" : `the ${method} rule`;
  return {
    prompt: md`Let $f(x) = ${g.tex}$. Use ${rule} with $n = ${n}$ to approximate the integral of $f$ from $${g.a}$ to $${g.b}$. Round your answer to 3 decimal places (keep at least 5 while working).`,
    answer: value.toFixed(3),
    tolerance: 0.0005,
    hint: md`$h = \frac{${g.b} - ${g.a}}{${n}} = ${h}$. Work out the function values to five decimals first, then combine them: $${formula}$.`,
    solution: [
      { math: md`h = ${h}, \qquad ${method === "midpoint" ? `\\text{midpoints } ${Array.from({ length: n }, (_, i) => (g.a + (i + 0.5) * h).toFixed(2)).join(",\\ ")}` : `x_i = ${xs.map((x) => x.toFixed(2)).join(",\\ ")}`}`, note: "" },
      { math: md`${formula}`, note: md`With $f(x) = ${g.tex}$.` },
      { math: md`${sym} = ${method === "midpoint" ? h : `\\frac{${h}}{${method === "trapezoid" ? 2 : 3}}`}\left(${terms}\right)`, note: "Function values to five decimals." },
      { math: md`${sym} \approx ${value.toFixed(3)}`, note: md`This integral has no elementary antiderivative${g.tex === "\\cos x" ? "? This one does: the exact value is $\\sin 1 \\approx 0.84147$, which is a useful check on the method" : ", so a numerical value is the only kind we can give"}.` },
    ],
  };
};

// ── Lesson 6: improper integrals ───────────────────────────────────────────

const DIVERGE_NOTE = "If it converges, give its exact value; if not, type diverges.";

const infiniteInterval: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const p = r.int(2, 4);
    const a = r.int(1, 3);
    const k = r.int(1, 6);
    // ∫_a^∞ k/x^p dx = k / ((p - 1) a^{p-1})
    const den = (p - 1) * a ** (p - 1);
    return {
      prompt: md`Evaluate $\int_{${a}}^{\infty} \frac{${k}}{x^{${p}}} \, dx$. ${DIVERGE_NOTE}`,
      answer: frac(k, den),
      // lim_{b→∞} F(b) - F(a) with F(x) = -k/((p-1) x^(p-1)); the limit at infinity is 0.
      verify: [`I = 0 - (-${k}/(${p - 1} * ${a}^${p - 1}))`],
      hint: md`Replace $\infty$ by $b$, integrate with the power rule, then let $b \to \infty$.`,
      solution: [
        { math: md`\lim_{b \to \infty} \int_{${a}}^{b} ${k}x^{-${p}} \, dx = \lim_{b \to \infty} \left[-\frac{${k}}{${p - 1}x^{${p - 1}}}\right]_{${a}}^{b}`, note: "An improper integral is defined as a limit of ordinary ones." },
        { math: md`\lim_{b \to \infty} \left(-\frac{${k}}{${p - 1}b^{${p - 1}}} + \frac{${k}}{${p - 1} \cdot ${a ** (p - 1)}}\right)`, note: "" },
        { math: md`0 + ${fracTex(k, den)} = ${fracTex(k, den)}`, note: md`$\frac{1}{b^{${p - 1}}} \to 0$. The integral converges.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.int(1, 5);
    const k = r.int(1, 6);
    // ∫_0^∞ k e^{-cx} dx = k/c
    return {
      prompt: md`Evaluate $\int_{0}^{\infty} ${k === 1 ? "" : k}e^{-${kx(c)}} \, dx$. ${DIVERGE_NOTE}`,
      answer: frac(k, c),
      verify: [`I = 0 - (-${k}/${c} * e^(0))`],
      hint: md`$\int e^{-${kx(c)}} \, dx = -\frac{1}{${c}}e^{-${kx(c)}}$, and $e^{-${kx(c)}} \to 0$ as $x \to \infty$.`,
      solution: [
        { math: md`\lim_{b \to \infty} \left[-\frac{${k}}{${c}}e^{-${kx(c)}}\right]_{0}^{b} = \lim_{b \to \infty} \left(-\frac{${k}}{${c}}e^{-${c}b} + \frac{${k}}{${c}}\right)`, note: "" },
        { math: md`${fracTex(k, c)}`, note: md`$e^{-${c}b} \to 0$. The exponential tail dies fast enough to have finite area.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 4);
    const k = r.int(1, 5);
    const isRoot = r.next() < 0.5;
    // ∫_a^∞ k/x dx and ∫_a^∞ k/sqrt(x) dx both diverge
    return {
      prompt: md`Evaluate $\int_{${a}}^{\infty} \frac{${k}}{${isRoot ? "\\sqrt{x}" : "x"}} \, dx$. ${DIVERGE_NOTE}`,
      accept: ["diverges", "divergent", "does not converge", "infinity", "inf"],
      hint: md`Integrate to $b$ and look at what happens as $b \to \infty$. Does the antiderivative settle down?`,
      solution: isRoot
        ? [
            { math: md`\lim_{b \to \infty} \left[${2 * k}\sqrt{x}\right]_{${a}}^{b} = \lim_{b \to \infty} \left(${2 * k}\sqrt{b} - ${2 * k}\sqrt{${a}}\right)`, note: "" },
            { math: md`= \infty`, note: md`$\sqrt{b}$ grows without bound. The integral diverges: $p = \frac12 \le 1$.` },
          ]
        : [
            { math: md`\lim_{b \to \infty} \left[${k}\ln x\right]_{${a}}^{b} = \lim_{b \to \infty} ${k}(\ln b - \ln ${a})`, note: "" },
            { math: md`= \infty`, note: md`$\ln b$ grows without bound, slowly but forever. The integral diverges: this is the borderline case $p = 1$.` },
          ],
    };
  }
  const c = r.int(1, 4);
  const k = r.int(1, 5);
  // ∫_{-∞}^{0} k e^{cx} dx = k/c
  return {
    prompt: md`Evaluate $\int_{-\infty}^{0} ${k === 1 ? "" : k}e^{${kx(c)}} \, dx$. ${DIVERGE_NOTE}`,
    answer: frac(k, c),
    verify: [`I = ${k}/${c} * e^(0) - 0`],
    hint: md`Replace $-\infty$ by $a$ and let $a \to -\infty$. As $x \to -\infty$, $e^{${kx(c)}} \to 0$.`,
    solution: [
      { math: md`\lim_{a \to -\infty} \left[\frac{${k}}{${c}}e^{${kx(c)}}\right]_{a}^{0} = \lim_{a \to -\infty} \left(\frac{${k}}{${c}} - \frac{${k}}{${c}}e^{${c}a}\right)`, note: "" },
      { math: md`${fracTex(k, c)}`, note: md`$e^{${c}a} \to 0$ as $a \to -\infty$.` },
    ],
  };
};

const infiniteIntegrand: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const k = r.int(1, 5);
    const a = r.pick([1, 4, 9, 16]);
    const s = Math.sqrt(a);
    // ∫_0^a k/sqrt(x) dx = 2k sqrt(a)
    return {
      prompt: md`Evaluate $\int_{0}^{${a}} \frac{${k}}{\sqrt{x}} \, dx$. ${DIVERGE_NOTE}`,
      answer: String(2 * k * s),
      // F(a) - lim_{t→0+} F(t) with F(x) = 2k sqrt(x); the limit at 0 is 2k·0.
      verify: [`I = ${2 * k} sqrt(${a}) - ${2 * k} * 0`],
      hint: md`The integrand blows up at $x = 0$. Integrate from $t$ to $${a}$, then let $t \to 0^+$.`,
      solution: [
        { math: md`\lim_{t \to 0^+} \int_{t}^{${a}} ${k}x^{-1/2} \, dx = \lim_{t \to 0^+} \left[${2 * k}\sqrt{x}\right]_{t}^{${a}}`, note: "The trouble is at the lower end, so that end becomes the limit." },
        { math: md`\lim_{t \to 0^+} \left(${2 * k}\sqrt{${a}} - ${2 * k}\sqrt{t}\right) = ${2 * k * s}`, note: md`$\sqrt{t} \to 0$. The spike at 0 is thin enough to have finite area.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 5);
    const a = r.int(1, 4);
    const isSquare = r.next() < 0.5;
    // ∫_0^a k/x^2 dx and ∫_0^a k/x dx diverge
    return {
      prompt: md`Evaluate $\int_{0}^{${a}} \frac{${k}}{${isSquare ? "x^2" : "x"}} \, dx$. ${DIVERGE_NOTE}`,
      accept: ["diverges", "divergent", "does not converge", "infinity", "inf"],
      hint: md`Do not apply the fundamental theorem across a point where the function is undefined. Integrate from $t$ and let $t \to 0^+$.`,
      solution: isSquare
        ? [
            { math: md`\lim_{t \to 0^+} \left[-\frac{${k}}{x}\right]_{t}^{${a}} = \lim_{t \to 0^+} \left(-\frac{${k}}{${a}} + \frac{${k}}{t}\right)`, note: "" },
            { math: md`= \infty`, note: md`$\frac{${k}}{t} \to \infty$. Diverges. (Plugging in 0 blindly would give the absurd negative answer $-\frac{${k}}{${a}} + \frac{${k}}{0}$, or worse, a finite one if you drop the undefined term.)` },
          ]
        : [
            { math: md`\lim_{t \to 0^+} \left[${k}\ln x\right]_{t}^{${a}} = \lim_{t \to 0^+} ${k}(\ln ${a} - \ln t)`, note: "" },
            { math: md`= \infty`, note: md`$\ln t \to -\infty$ as $t \to 0^+$. Diverges.` },
          ],
    };
  }
  if (kind === 2) {
    const k = r.int(1, 4);
    const a = r.pick([1, 8, 27]);
    const a23 = Math.cbrt(a) ** 2;
    // ∫_0^a k x^{-1/3} dx = (3k/2) a^{2/3}
    return {
      prompt: md`Evaluate $\int_{0}^{${a}} \frac{${k}}{\sqrt[3]{x}} \, dx$. ${DIVERGE_NOTE}`,
      answer: frac(3 * k * a23, 2),
      verify: [`I = 3*${k}/2 * ${a}^(2/3) - 3*${k}/2 * 0`],
      hint: md`$\frac{1}{\sqrt[3]{x}} = x^{-1/3}$. Power rule, then the limit $t \to 0^+$.`,
      solution: [
        { math: md`\lim_{t \to 0^+} \left[\frac{3 \cdot ${k}}{2}x^{2/3}\right]_{t}^{${a}}`, note: md`$\int x^{-1/3} \, dx = \frac{x^{2/3}}{2/3} = \frac{3}{2}x^{2/3}$.` },
        { math: md`\frac{${3 * k}}{2} \cdot ${a}^{2/3} - 0 = \frac{${3 * k}}{2} \cdot ${a23} = ${fracTex(3 * k * a23, 2)}`, note: md`$${a}^{2/3} = (\sqrt[3]{${a}})^2 = ${a23}$, and $t^{2/3} \to 0$.` },
      ],
    };
  }
  if (kind === 3) {
    const k = r.int(1, 4);
    // ∫_0^1 k ln x dx = -k
    return {
      prompt: md`Evaluate $\int_{0}^{1} ${k === 1 ? "" : k}\ln x \, dx$. ${DIVERGE_NOTE}`,
      answer: String(-k),
      // F(1) - lim_{t→0+} F(t) with F(x) = k(x ln x - x); t ln t → 0, so the limit is 0.
      verify: [`I = ${k} (1 * ln(1) - 1) - 0`],
      hint: md`$\ln x \to -\infty$ at 0, so this is improper. Integrate by parts, then you will need $\lim_{t \to 0^+} t\ln t = 0$.`,
      solution: [
        { math: md`\int \ln x \, dx = x\ln x - x`, note: md`Parts with $u = \ln x$, $dv = dx$ (Lesson 1).` },
        { math: md`\lim_{t \to 0^+} ${k}\Big[x\ln x - x\Big]_{t}^{1} = \lim_{t \to 0^+} ${k}\left(-1 - t\ln t + t\right)`, note: md`$1\ln 1 - 1 = -1$.` },
        { math: md`${k}(-1 - 0 + 0) = ${-k}`, note: md`$t\ln t \to 0$: write it as $\frac{\ln t}{1/t}$ and use l'Hôpital, giving $\frac{1/t}{-1/t^2} = -t \to 0$. The area is finite even though the curve dives to $-\infty$.` },
      ],
    };
  }
  const a = r.pick([1, 4, 9]);
  const s = Math.sqrt(a);
  // ∫_0^a dx/sqrt(a - x) = 2 sqrt(a), trouble at the upper end
  return {
    prompt: md`Evaluate $\int_{0}^{${a}} \frac{1}{\sqrt{${a} - x}} \, dx$. ${DIVERGE_NOTE}`,
    answer: String(2 * s),
    verify: [`I = -2 sqrt(${a} - ${a}) + 2 sqrt(${a} - 0)`],
    hint: md`This time the integrand is infinite at the **upper** end, $x = ${a}$. Integrate to $t$ and let $t \to ${a}^-$.`,
    solution: [
      { math: md`\lim_{t \to ${a}^-} \int_{0}^{t} (${a} - x)^{-1/2} \, dx = \lim_{t \to ${a}^-} \Big[-2\sqrt{${a} - x}\Big]_{0}^{t}`, note: md`Substitution $u = ${a} - x$ brings in the minus sign.` },
      { math: md`\lim_{t \to ${a}^-} \left(-2\sqrt{${a} - t} + 2\sqrt{${a}}\right) = ${2 * s}`, note: "" },
    ],
  };
};

const comparisonAndTools: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const items: { tex: string; verdict: "converges" | "diverges"; why: string }[] = [
      { tex: "\\int_{1}^{\\infty} \\frac{\\sin^2 x}{x^2} \\, dx", verdict: "converges", why: md`$0 \le \frac{\sin^2 x}{x^2} \le \frac{1}{x^2}$ and $\int_1^\infty \frac{dx}{x^2}$ converges ($p = 2$).` },
      { tex: "\\int_{1}^{\\infty} \\frac{1}{\\sqrt{x^3 + 1}} \\, dx", verdict: "converges", why: md`$\frac{1}{\sqrt{x^3 + 1}} \le \frac{1}{\sqrt{x^3}} = \frac{1}{x^{3/2}}$ and $p = \frac32 > 1$.` },
      { tex: "\\int_{1}^{\\infty} \\frac{1}{\\sqrt{x^2 + 1}} \\, dx", verdict: "diverges", why: md`For $x \ge 1$, $x^2 + 1 \le 2x^2$, so $\frac{1}{\sqrt{x^2 + 1}} \ge \frac{1}{\sqrt{2}\,x}$, and $\int_1^\infty \frac{dx}{x}$ diverges.` },
      { tex: "\\int_{1}^{\\infty} e^{-x^2} \\, dx", verdict: "converges", why: md`For $x \ge 1$, $x^2 \ge x$, so $e^{-x^2} \le e^{-x}$, and $\int_1^\infty e^{-x} \, dx = e^{-1}$ converges.` },
      { tex: "\\int_{1}^{\\infty} \\frac{2 + \\cos x}{x} \\, dx", verdict: "diverges", why: md`$\frac{2 + \cos x}{x} \ge \frac{1}{x}$ since $\cos x \ge -1$, and $\int_1^\infty \frac{dx}{x}$ diverges.` },
      { tex: "\\int_{2}^{\\infty} \\frac{1}{x \\ln x} \\, dx", verdict: "diverges", why: md`$u = \ln x$ turns it into $\int_{\ln 2}^{\infty} \frac{du}{u}$, which diverges. It beats $\frac{1}{x}$ by only a logarithm, and that is not enough.` },
      { tex: "\\int_{0}^{1} \\frac{1}{\\sqrt{x}(1 + x)} \\, dx", verdict: "converges", why: md`Near 0, $\frac{1}{\sqrt{x}(1 + x)} \le \frac{1}{\sqrt{x}}$ and $\int_0^1 \frac{dx}{\sqrt{x}} = 2$ converges.` },
      { tex: "\\int_{0}^{1} \\frac{1}{x^2 + x^3} \\, dx", verdict: "diverges", why: md`On $(0, 1]$, $x^2 + x^3 \le 2x^2$, so the integrand is at least $\frac{1}{2x^2}$, and $\int_0^1 \frac{dx}{x^2}$ diverges.` },
      { tex: "\\int_{1}^{\\infty} \\frac{\\arctan x}{x^2} \\, dx", verdict: "converges", why: md`$\arctan x < \frac{\pi}{2}$, so the integrand is below $\frac{\pi/2}{x^2}$, a convergent $p$-integral.` },
      { tex: "\\int_{1}^{\\infty} \\frac{x}{x^2 + 1} \\, dx", verdict: "diverges", why: md`For $x \ge 1$, $\frac{x}{x^2 + 1} \ge \frac{x}{2x^2} = \frac{1}{2x}$. Directly: the antiderivative $\frac12\ln(x^2 + 1) \to \infty$.` },
    ];
    const it = r.pick(items);
    return {
      prompt: md`Does $${it.tex}$ converge or diverge? Decide by comparison with a $p$-integral or an exponential.`,
      choices: ["converges", "diverges"],
      accept: [it.verdict],
      hint: md`Find a simpler function that is always above (to show convergence) or always below (to show divergence) the integrand on the interval.`,
      solution: [{ math: md`\text{${it.verdict}}`, note: it.why }],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 4);
    const c = r.int(1, 3);
    // ∫_0^∞ k x e^{-cx} dx = k/c^2
    return {
      prompt: md`Evaluate $\int_{0}^{\infty} ${k === 1 ? "" : k}x e^{-${kx(c)}} \, dx$. ${DIVERGE_NOTE}`,
      answer: frac(k, c * c),
      // F(x) = -k(x/c + 1/c^2) e^{-cx}; the limit at infinity is 0, by l'Hôpital.
      verify: [`I = 0 - (-${k} (0/${c} + 1/${c * c}) e^(0))`],
      hint: md`Integration by parts with $u = x$, then the limit $\lim_{b \to \infty} b e^{-${c}b}$, which needs l'Hôpital.`,
      solution: [
        { math: md`\int x e^{-${kx(c)}} \, dx = -\frac{x}{${c}}e^{-${kx(c)}} - \frac{1}{${c * c}}e^{-${kx(c)}}`, note: md`Parts: $u = x$, $dv = e^{-${kx(c)}} \, dx$.` },
        { math: md`\lim_{b \to \infty} ${k}\left[-\frac{x}{${c}}e^{-${kx(c)}} - \frac{1}{${c * c}}e^{-${kx(c)}}\right]_{0}^{b} = ${k}\left(0 - 0 + \frac{1}{${c * c}}\right)`, note: md`$\lim_{b \to \infty} \frac{b}{e^{${c}b}} = \lim \frac{1}{${c}e^{${c}b}} = 0$ by l'Hôpital: exponentials beat powers.` },
        { math: md`${fracTex(k, c * c)}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 4);
    const k = r.int(1, 4);
    const both = r.next() < 0.5;
    // ∫_0^∞ k/(x^2 + a^2) = kπ/(2a);  ∫_{-∞}^{∞} = kπ/a
    return {
      prompt: md`Evaluate $\int_{${both ? "-\\infty" : "0"}}^{\infty} \frac{${k}}{x^2 + ${a * a}} \, dx$. ${DIVERGE_NOTE} Type $\pi$ as pi.`,
      answer: both ? `${k}pi/${a}` : `${k}pi/${2 * a}`,
      verify: both ? [`I = ${k}/${a} * (pi/2 - (-pi/2))`] : [`I = ${k}/${a} * (pi/2 - atan(0))`],
      hint: md`$\int \frac{dx}{x^2 + ${a * a}} = \frac{1}{${a}}\arctan\frac{x}{${a}}$, and $\arctan t \to \frac{\pi}{2}$ as $t \to \infty$${both ? `, $-\\frac{\\pi}{2}$ as $t \\to -\\infty$. Split the integral at 0 and treat each half as its own limit` : ""}.`,
      solution: both
        ? [
            { math: md`\int_{-\infty}^{\infty} = \int_{-\infty}^{0} + \int_{0}^{\infty}`, note: "Two infinite ends means two separate limits. Both must converge." },
            { math: md`\int_{0}^{\infty} \frac{${k}}{x^2 + ${a * a}} \, dx = \lim_{b \to \infty} \frac{${k}}{${a}}\arctan\frac{b}{${a}} - 0 = \frac{${k}}{${a}} \cdot \frac{\pi}{2}`, note: "" },
            { math: md`\int_{-\infty}^{0} \frac{${k}}{x^2 + ${a * a}} \, dx = 0 - \lim_{c \to -\infty} \frac{${k}}{${a}}\arctan\frac{c}{${a}} = \frac{${k}}{${a}} \cdot \frac{\pi}{2}`, note: "By symmetry, the same." },
            { math: md`\frac{${k}\pi}{${a}}`, note: "" },
          ]
        : [
            { math: md`\lim_{b \to \infty} \left[\frac{${k}}{${a}}\arctan\frac{x}{${a}}\right]_{0}^{b} = \frac{${k}}{${a}}\left(\frac{\pi}{2} - 0\right)`, note: md`$\arctan 0 = 0$ and $\arctan\frac{b}{${a}} \to \frac{\pi}{2}$.` },
            { math: md`\frac{${k}\pi}{${2 * a}}`, note: "" },
          ],
    };
  }
  const k = r.int(1, 4);
  // ∫_1^∞ k ln x / x^2 dx = k
  return {
    prompt: md`Evaluate $\int_{1}^{\infty} \frac{${k === 1 ? "" : k}\ln x}{x^2} \, dx$. ${DIVERGE_NOTE}`,
    answer: String(k),
    // F(x) = -k(ln x + 1)/x; the limit at infinity is 0 since ln b / b → 0.
    verify: [`I = 0 - (-${k} (ln(1) + 1)/1)`],
    hint: md`Parts with $u = \ln x$, $dv = x^{-2} \, dx$. Then $\lim_{b \to \infty} \frac{\ln b}{b} = 0$.`,
    solution: [
      { math: md`\int \frac{\ln x}{x^2} \, dx = -\frac{\ln x}{x} + \int \frac{1}{x^2} \, dx = -\frac{\ln x}{x} - \frac{1}{x}`, note: md`$u = \ln x$, $dv = x^{-2} \, dx$, $v = -\frac{1}{x}$.` },
      { math: md`\lim_{b \to \infty} ${k}\left[-\frac{\ln x + 1}{x}\right]_{1}^{b} = ${k}\left(0 + \frac{0 + 1}{1}\right) = ${k}`, note: md`$\frac{\ln b + 1}{b} \to 0$ by l'Hôpital. The logarithm grows, but far slower than $x$.` },
    ],
  };
};

// ── The unit ───────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Techniques of Integration",
  lessons: [
    {
      id: slug("Integration by parts"),
      title: "Integration by parts",
      summary: "The product rule, read backwards, trades one integral for another. Choose the pieces so the new integral is easier.",
      blocks: [
        {
          kind: "text",
          body: md`Substitution undoes the chain rule. It handles $\int 2x e^{x^2} \, dx$ because the $2x$ is the derivative of the inside. But it does nothing for $\int x e^x \, dx$: there is no inside function whose derivative is sitting there. The integrand is a plain product of two unrelated functions.

Products come from the product rule. So the tool for integrating a product should come from reading the product rule backwards. That tool is called **integration by parts**.`,
        },
        {
          kind: "why",
          title: "Why the product rule gives an integration rule",
          body: md`Let $u$ and $v$ be functions of $x$. The product rule says

$$\frac{d}{dx}(uv) = u \frac{dv}{dx} + v \frac{du}{dx}.$$

Integrate both sides with respect to $x$. On the left, integrating a derivative gives the function back (that is the fundamental theorem):

$$uv = \int u \, \frac{dv}{dx} \, dx + \int v \, \frac{du}{dx} \, dx.$$

In differential shorthand, $\frac{dv}{dx} \, dx = dv$ and $\frac{du}{dx} \, dx = du$. Move one integral across:

$$\int u \, dv = uv - \int v \, du.$$

Nothing was assumed beyond the product rule. The formula does not compute an integral. It **trades** one integral, $\int u \, dv$, for another, $\int v \, du$, plus a product you can write down at once. The whole skill is choosing $u$ and $dv$ so that the trade is a good one.`,
        },
        {
          kind: "key",
          title: "Integration by parts",
          body: md`Split the integrand into a factor $u$ and a factor $dv$ (which includes the $dx$). Then

$$\int u \, dv = uv - \int v \, du,$$

where $du = u' \, dx$ and $v = \int dv$. For a definite integral the product is evaluated at the limits:

$$\int_a^b u \, dv = \Big[uv\Big]_a^b - \int_a^b v \, du.$$

You need to be able to integrate $dv$, and you want $v \, du$ to be simpler than $u \, dv$.`,
        },
        {
          kind: "proof",
          title: "The parts formula",
          given: md`$u$ and $v$ are differentiable on an interval, with continuous derivatives`,
          prove: md`$\int u \, v' \, dx = uv - \int v \, u' \, dx$`,
          steps: [
            { statement: md`$(uv)' = u'v + uv'$`, reason: "Product rule (Calculus 1)" },
            { statement: md`$uv' = (uv)' - u'v$`, reason: md`Subtract $u'v$ from both sides` },
            { statement: md`$\int uv' \, dx = \int (uv)' \, dx - \int u'v \, dx$`, reason: "Integrate both sides; the integral of a difference is the difference of the integrals" },
            { statement: md`$\int (uv)' \, dx = uv + C$`, reason: md`$uv$ is an antiderivative of its own derivative` },
            { statement: md`$\int uv' \, dx = uv - \int u'v \, dx$`, reason: md`Substitute; the $C$ is absorbed into the remaining indefinite integral` },
          ],
        },
        {
          kind: "example",
          title: "A polynomial times an exponential",
          problem: md`Find $\int x e^x \, dx$.`,
          steps: [
            { math: md`u = x, \qquad dv = e^x \, dx`, note: md`Two factors. We want $u$ to get simpler when differentiated: $x$ becomes $1$. And $dv$ must be something we can integrate: $e^x$ is.` },
            { math: md`du = dx, \qquad v = e^x`, note: md`Differentiate $u$, integrate $dv$. No constant is needed on $v$ here; any choice of $v$ works, and $0$ is simplest.` },
            { math: md`\int x e^x \, dx = x e^x - \int e^x \, dx`, note: md`$uv - \int v \, du$. The new integral has lost its $x$. That is the progress.` },
            { math: md`= x e^x - e^x + C`, note: "" },
            { math: md`\frac{d}{dx}\left(x e^x - e^x\right) = e^x + x e^x - e^x = x e^x \;\checkmark`, note: "Always worth the ten seconds: differentiate the answer." },
          ],
        },
        {
          kind: "why",
          title: "How to choose u",
          body: md`Try the other split on the same integral: $u = e^x$, $dv = x \, dx$. Then $du = e^x \, dx$ and $v = \frac{x^2}{2}$, so

$$\int x e^x \, dx = \frac{x^2}{2} e^x - \int \frac{x^2}{2} e^x \, dx.$$

True, but useless: the new integral is harder than the one we started with. The power of $x$ went up.

So the rule of thumb: pick $u$ to be the factor that **gets simpler when differentiated**, and $dv$ to be a factor you **can integrate**. A polynomial loses a degree each time. A logarithm or inverse trig function turns into an algebraic expression, which is a big improvement. Exponentials and $\sin$, $\cos$ never get simpler or harder when differentiated, so they are happy to be $dv$.

The mnemonic **LIATE** lists what to pick as $u$, in order of preference: **L**ogarithms, **I**nverse trig, **A**lgebraic (polynomials), **T**rig, **E**xponentials. It is a summary of the reasoning above, not a law. When it fails, think about which choice makes $\int v \, du$ easier.`,
        },
        {
          kind: "example",
          title: "One factor only",
          problem: md`Find $\int \ln x \, dx$.`,
          steps: [
            { math: md`u = \ln x, \qquad dv = dx`, note: md`There seems to be only one factor. Treat the $dx$ as the other one: $dv = 1 \, dx$. LIATE puts the logarithm first anyway.` },
            { math: md`du = \frac{1}{x} \, dx, \qquad v = x`, note: "" },
            { math: md`\int \ln x \, dx = x \ln x - \int x \cdot \frac{1}{x} \, dx = x \ln x - \int 1 \, dx`, note: md`The $x$ from $v$ cancels the $\frac{1}{x}$ from $du$. The logarithm is gone.` },
            { math: md`= x \ln x - x + C`, note: md`The same trick gives $\int \arctan x \, dx$ and $\int \arcsin x \, dx$: take $dv = dx$.` },
          ],
        },
        {
          kind: "example",
          title: "The integral that comes back",
          problem: md`Find $\int e^x \sin x \, dx$.`,
          steps: [
            { math: md`u = \sin x, \quad dv = e^x \, dx \quad\Rightarrow\quad \int e^x \sin x \, dx = e^x \sin x - \int e^x \cos x \, dx`, note: md`$du = \cos x \, dx$, $v = e^x$. Neither factor gets simpler, so this looks like no progress. Keep going.` },
            { math: md`u = \cos x, \quad dv = e^x \, dx \quad\Rightarrow\quad \int e^x \cos x \, dx = e^x \cos x + \int e^x \sin x \, dx`, note: md`Parts again on the new integral, with the trig function as $u$ again. (Switching roles now would just undo the first step.)` },
            { math: md`I = e^x \sin x - e^x \cos x - I`, note: md`Call the original integral $I$. Substituting the second line into the first, $I$ appears on both sides.` },
            { math: md`2I = e^x(\sin x - \cos x) \quad\Rightarrow\quad I = \frac{e^x(\sin x - \cos x)}{2} + C`, note: md`Solve for $I$ like any equation. The constant appears at the end: the two indefinite integrals on each side differ by a constant, which is all the $+ C$ ever meant.` },
          ],
        },
        {
          kind: "text",
          body: md`When the polynomial factor has degree 2 or more, parts is repeated, once per degree. Each round the polynomial drops a degree and the other factor just rotates (trig) or stays put (exponential). For $\int x^2 e^x \, dx$: two rounds give $e^x(x^2 - 2x + 2) + C$. Watch the signs: the second round's result is subtracted, so its own minus sign flips.`,
        },
        {
          kind: "plot",
          x: [-0.3, 3.5],
          y: [-1, 2.5],
          curves: [{ expr: "x sin(x)", label: "y = x \\sin x", color: 1 }],
          shade: [{ expr: "x sin(x)", from: 0, to: Math.PI }],
          points: [{ x: Math.PI, y: 0, label: "\\pi" }],
          caption: md`The area under $y = x \sin x$ from $0$ to $\pi$ is exactly $\pi$. By parts with $u = x$, $dv = \sin x \, dx$: $\big[-x \cos x\big]_0^\pi + \int_0^\pi \cos x \, dx = \pi + 0$. The hump is taller than a sine arch (whose area is 2) and leans right, where $x$ is bigger.`,
        },
        {
          kind: "check",
          prompt: md`Find $\int x \cos x \, dx$. ${PLUS_C}`,
          answer: "x sin(x) + cos(x)",
          upToConstant: true,
          explain: md`$u = x$, $dv = \cos x \, dx$, so $du = dx$ and $v = \sin x$. Then $x \sin x - \int \sin x \, dx = x \sin x + \cos x + C$.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_{0}^{1} x e^{x} \, dx$. Give an exact answer.`,
          answer: "1",
          explain: md`$\big[x e^x\big]_0^1 - \int_0^1 e^x \, dx = e - (e - 1) = 1$. The $e$'s cancel.`,
        },
      ],
      practice: [partsExponential, partsTrigAndLog, partsDefinite],
    },
    {
      id: slug("Trigonometric integrals"),
      title: "Trigonometric integrals",
      summary: "Powers and products of sine, cosine, tangent and secant, handled with two identities: Pythagoras for odd powers, half-angle for even ones.",
      blocks: [
        {
          kind: "text",
          body: md`$\int \sin x \, dx$ and $\int \cos x \, dx$ are immediate. $\int \sin^3 x \, dx$ and $\int \cos^2 x \, dx$ are not, yet they come up constantly: in the trigonometric substitutions of the next lesson, in Fourier series, in any physics with waves. This lesson gives a method for every integrand that is a product of powers of $\sin x$ and $\cos x$, and the common ones built from $\tan x$ and $\sec x$.

Everything rests on two identities you already know, used with a purpose: the Pythagorean identity converts between $\sin^2$ and $\cos^2$, and the half-angle identities turn a square into a first power of a double angle.`,
        },
        {
          kind: "key",
          title: "The identities we need",
          body: md`$$\sin^2 x + \cos^2 x = 1, \qquad 1 + \tan^2 x = \sec^2 x,$$
$$\sin^2 x = \frac{1 - \cos 2x}{2}, \qquad \cos^2 x = \frac{1 + \cos 2x}{2}, \qquad \sin x \cos x = \frac{\sin 2x}{2}.$$

And the derivatives that make substitutions work: $(\sin x)' = \cos x$, $(\cos x)' = -\sin x$, $(\tan x)' = \sec^2 x$, $(\sec x)' = \sec x \tan x$.`,
        },
        {
          kind: "why",
          title: "Where the half-angle identities come from",
          body: md`The double-angle formula for cosine is $\cos 2x = \cos^2 x - \sin^2 x$ (Trigonometry: the angle-sum formula with both angles equal to $x$). Replace $\cos^2 x$ by $1 - \sin^2 x$:

$$\cos 2x = 1 - 2\sin^2 x \quad\Rightarrow\quad \sin^2 x = \frac{1 - \cos 2x}{2}.$$

Or replace $\sin^2 x$ by $1 - \cos^2 x$ instead:

$$\cos 2x = 2\cos^2 x - 1 \quad\Rightarrow\quad \cos^2 x = \frac{1 + \cos 2x}{2}.$$

Why we want them: a square of sine is hard to integrate, but $\cos 2x$ is easy, $\int \cos 2x \, dx = \frac{1}{2}\sin 2x$. The identity lowers the power at the cost of doubling the angle, and doubling the angle costs nothing.`,
        },
        {
          kind: "why",
          title: "Why an odd power wants a substitution",
          body: md`Look at $\int \sin^3 x \, dx$. If we set $u = \cos x$, then $du = -\sin x \, dx$: one factor of $\sin x$ gets used up as part of $du$. That leaves $\sin^2 x$, which is even, and the Pythagorean identity rewrites it as $1 - \cos^2 x = 1 - u^2$. The whole integrand is now a polynomial in $u$:

$$\int \sin^3 x \, dx = \int (1 - \cos^2 x) \sin x \, dx = -\int (1 - u^2) \, du.$$

That is the pattern. With an **odd** power of sine, one sine is the $du$ and the rest, an even power, converts to cosines. With an **odd** power of cosine, the roles swap. If **both** powers are even, no single factor can be the $du$, and the half-angle identities take over.`,
        },
        {
          kind: "example",
          title: "An odd power",
          problem: md`Find $\int \sin^3 x \, dx$.`,
          steps: [
            { math: md`\sin^3 x = \sin^2 x \cdot \sin x = (1 - \cos^2 x)\sin x`, note: "Save one sine; convert the even remainder." },
            { math: md`u = \cos x, \qquad du = -\sin x \, dx`, note: md`So $\sin x \, dx = -du$.` },
            { math: md`\int (1 - u^2)(-du) = -u + \frac{u^3}{3} + C`, note: "A polynomial." },
            { math: md`= -\cos x + \frac{\cos^3 x}{3} + C`, note: md`Check: the derivative is $\sin x - \cos^2 x \sin x = \sin x(1 - \cos^2 x) = \sin^3 x$.` },
          ],
        },
        {
          kind: "example",
          title: "Both powers even",
          problem: md`Find $\int \cos^4 x \, dx$.`,
          steps: [
            { math: md`\cos^4 x = \left(\frac{1 + \cos 2x}{2}\right)^2 = \frac{1 + 2\cos 2x + \cos^2 2x}{4}`, note: "Half-angle on the square of the square." },
            { math: md`\cos^2 2x = \frac{1 + \cos 4x}{2}`, note: md`Half-angle again, with $2x$ in place of $x$. The angle doubles once more.` },
            { math: md`\cos^4 x = \frac{1}{4} + \frac{\cos 2x}{2} + \frac{1}{8} + \frac{\cos 4x}{8} = \frac{3}{8} + \frac{\cos 2x}{2} + \frac{\cos 4x}{8}`, note: "Every term is now a first power." },
            { math: md`\int \cos^4 x \, dx = \frac{3x}{8} + \frac{\sin 2x}{4} + \frac{\sin 4x}{32} + C`, note: md`$\int \cos kx \, dx = \frac{\sin kx}{k}$.` },
          ],
        },
        {
          kind: "plot",
          x: [-0.3, 6.6],
          y: [-0.3, 1.3],
          curves: [
            { expr: "(sin(x))^2", label: "\\sin^2 x", color: 1 },
            { expr: "(cos(x))^2", label: "\\cos^2 x", color: 2, dashed: true },
          ],
          hlines: [{ y: 0.5, label: "y = \\tfrac12" }],
          shade: [{ expr: "(sin(x))^2", from: 0, to: 2 * Math.PI, color: 1 }],
          vlines: [{ x: 2 * Math.PI, label: "2\\pi" }],
          caption: md`$\sin^2 x = \frac{1 - \cos 2x}{2}$ is a cosine wave of half the amplitude, lifted to sit around $y = \frac12$. The wave part averages to zero over a whole period, so $\int_0^{2\pi} \sin^2 x \, dx = \frac12 \cdot 2\pi = \pi$. Same for $\cos^2 x$: the two curves add to 1 everywhere, so they share the area equally.`,
        },
        {
          kind: "key",
          title: "Strategy for sine and cosine powers",
          body: md`For $\int \sin^m x \cos^n x \, dx$:

- $n$ odd: save one $\cos x$ for $du$, convert the rest with $\cos^2 x = 1 - \sin^2 x$, and let $u = \sin x$.
- $m$ odd: save one $\sin x$, convert the rest with $\sin^2 x = 1 - \cos^2 x$, and let $u = \cos x$.
- both even: use the half-angle identities (and $\sin x \cos x = \frac12 \sin 2x$) to lower the powers, then repeat if needed.

For $\int \tan^m x \sec^n x \, dx$:

- $n$ even: save $\sec^2 x$ for $du$, convert the rest with $\sec^2 x = 1 + \tan^2 x$, and let $u = \tan x$.
- $m$ odd: save $\sec x \tan x$ for $du$, convert the rest with $\tan^2 x = \sec^2 x - 1$, and let $u = \sec x$.`,
        },
        {
          kind: "example",
          title: "Tangent and secant",
          problem: md`Find $\int \tan^3 x \sec x \, dx$.`,
          steps: [
            { math: md`\tan^3 x \sec x = \tan^2 x \cdot (\sec x \tan x) = (\sec^2 x - 1)(\sec x \tan x)`, note: md`The power of tangent is odd, so save $\sec x \tan x$, the derivative of $\sec x$. Convert the leftover $\tan^2 x$.` },
            { math: md`u = \sec x, \qquad du = \sec x \tan x \, dx`, note: "" },
            { math: md`\int (u^2 - 1) \, du = \frac{u^3}{3} - u + C = \frac{\sec^3 x}{3} - \sec x + C`, note: "" },
          ],
        },
        {
          kind: "why",
          title: "Two integrals to know: tan x and sec x",
          body: md`$\int \tan x \, dx$ is a substitution in disguise. Write $\tan x = \frac{\sin x}{\cos x}$ and let $u = \cos x$, $du = -\sin x \, dx$:

$$\int \tan x \, dx = -\int \frac{du}{u} = -\ln|\cos x| + C = \ln|\sec x| + C.$$

$\int \sec x \, dx$ has no such disguise, but there is a trick worth remembering. Multiply top and bottom by $\sec x + \tan x$:

$$\int \sec x \, dx = \int \frac{\sec x (\sec x + \tan x)}{\sec x + \tan x} \, dx = \int \frac{\sec^2 x + \sec x \tan x}{\sec x + \tan x} \, dx.$$

Now the numerator is exactly the derivative of the denominator, since $(\sec x)' = \sec x \tan x$ and $(\tan x)' = \sec^2 x$. So the integral is $\ln|\text{denominator}|$:

$$\int \sec x \, dx = \ln|\sec x + \tan x| + C.$$

The next lesson needs this one, so check it by differentiating: $\frac{\sec x \tan x + \sec^2 x}{\sec x + \tan x} = \sec x$.`,
        },
        {
          kind: "key",
          title: "Tangent and secant integrals",
          body: md`$$\int \tan x \, dx = \ln|\sec x| + C = -\ln|\cos x| + C, \qquad \int \sec x \, dx = \ln|\sec x + \tan x| + C,$$
$$\int \sec^2 x \, dx = \tan x + C, \qquad \int \sec x \tan x \, dx = \sec x + C.$$`,
        },
        {
          kind: "check",
          prompt: md`Find $\int \sin^2 x \cos x \, dx$. ${POWER_NOTE} ${PLUS_C}`,
          answer: "(sin(x))^3/3",
          upToConstant: true,
          explain: md`A single $\cos x$ is the derivative of $\sin x$. With $u = \sin x$, the integral is $\int u^2 \, du = \frac{u^3}{3} = \frac{\sin^3 x}{3} + C$.`,
        },
        {
          kind: "check",
          prompt: md`Find $\int \cos^2(2x) \, dx$. ${PLUS_C}`,
          answer: "x/2 + sin(4x)/8",
          upToConstant: true,
          explain: md`$\cos^2 2x = \frac{1 + \cos 4x}{2}$, so the integral is $\frac{x}{2} + \frac{\sin 4x}{8} + C$. The angle doubled from $2x$ to $4x$, and $\int \cos 4x \, dx = \frac{\sin 4x}{4}$.`,
        },
      ],
      practice: [oddPowers, evenPowers, tanAndSec],
    },
    {
      id: slug("Trigonometric substitution"),
      title: "Trigonometric substitution",
      summary: "Square roots of a² − x², a² + x² and x² − a² disappear when x is replaced by a sine, tangent or secant, because of the Pythagorean identities.",
      blocks: [
        {
          kind: "text",
          body: md`The area of a circle, the length of an ellipse, the field of a charged wire: all lead to integrals with $\sqrt{a^2 - x^2}$, $\sqrt{a^2 + x^2}$ or $\sqrt{x^2 - a^2}$ in them. Ordinary substitution does not remove these roots. There is no inside function whose derivative is present.

The idea here is a substitution in the other direction. Instead of naming part of the integrand $u$, we replace $x$ itself by a trig function of a new variable $\theta$, chosen so that the thing under the root becomes a perfect square.`,
        },
        {
          kind: "why",
          title: "Why x = a sin θ removes the root",
          body: md`Take $\sqrt{a^2 - x^2}$ with $a > 0$ and put $x = a\sin\theta$:

$$a^2 - x^2 = a^2 - a^2\sin^2\theta = a^2(1 - \sin^2\theta) = a^2\cos^2\theta.$$

So $\sqrt{a^2 - x^2} = \sqrt{a^2 \cos^2\theta} = a|\cos\theta|$. To drop the absolute value we need $\cos\theta \ge 0$, so restrict $\theta$ to $-\frac{\pi}{2} \le \theta \le \frac{\pi}{2}$. On that interval $\sin\theta$ runs through every value from $-1$ to $1$ exactly once, so every $x$ in $[-a, a]$ (the only $x$ for which the root exists) corresponds to exactly one $\theta$: the substitution is reversible, $\theta = \arcsin\frac{x}{a}$.

The other two forms work the same way with the other Pythagorean identity, $1 + \tan^2\theta = \sec^2\theta$:

- $x = a\tan\theta$ turns $a^2 + x^2$ into $a^2\sec^2\theta$, and $\sec\theta > 0$ for $-\frac{\pi}{2} < \theta < \frac{\pi}{2}$.
- $x = a\sec\theta$ turns $x^2 - a^2$ into $a^2\tan^2\theta$, and $\tan\theta \ge 0$ for $0 \le \theta < \frac{\pi}{2}$ (the case $x \ge a$).

In each case $dx$ must be replaced too: $dx = a\cos\theta \, d\theta$, $a\sec^2\theta \, d\theta$ or $a\sec\theta\tan\theta \, d\theta$.`,
        },
        {
          kind: "key",
          title: "The three substitutions",
          body: md`| Root | Substitute | Then | $dx$ |
|---|---|---|---|

- $\sqrt{a^2 - x^2}$: let $x = a\sin\theta$. Then $\sqrt{a^2 - x^2} = a\cos\theta$ and $dx = a\cos\theta \, d\theta$.
- $\sqrt{a^2 + x^2}$: let $x = a\tan\theta$. Then $\sqrt{a^2 + x^2} = a\sec\theta$ and $dx = a\sec^2\theta \, d\theta$.
- $\sqrt{x^2 - a^2}$: let $x = a\sec\theta$. Then $\sqrt{x^2 - a^2} = a\tan\theta$ and $dx = a\sec\theta\tan\theta \, d\theta$.

The pattern: whichever root you have, the substitution is the trig function whose Pythagorean partner is the one that survives under the root. After integrating in $\theta$, convert back to $x$ with a reference triangle.`,
        },
        {
          kind: "diagram",
          view: [-0.4, 2.6, -0.4, 2.3],
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "A", x: "2cos(t)", y: 0, label: "", dir: "s" },
            { name: "B", x: "2cos(t)", y: "2sin(t)", label: "", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "B", label: "a = 2", color: 1 },
            { from: "A", to: "B", label: "x", color: 2 },
            { from: "O", to: "A", label: "\\sqrt{a^2 - x^2}", color: 3 },
          ],
          angles: [
            { at: "O", from: "A", to: "B", label: "\\theta" },
            { at: "A", from: "B", to: "O", right: true },
          ],
          params: [{ name: "t", tex: "\\theta", min: 0.15, max: 1.4, step: 0.05, value: 0.7 }],
          readouts: [
            { label: "x = a\\sin\\theta", value: "2 sin(t)" },
            { label: "\\sqrt{a^2 - x^2} = a\\cos\\theta", value: "2 cos(t)" },
          ],
          caption: md`The reference triangle for $x = a\sin\theta$ with $a = 2$. Since $\sin\theta = \frac{x}{a}$, draw a right triangle with hypotenuse $a$ and opposite side $x$; Pythagoras makes the adjacent side $\sqrt{a^2 - x^2}$. Every trig function of $\theta$ can now be read off in terms of $x$: $\cos\theta = \frac{\sqrt{a^2 - x^2}}{a}$, $\tan\theta = \frac{x}{\sqrt{a^2 - x^2}}$. Slide $\theta$ and watch $x$ sweep $(0, a)$.`,
        },
        {
          kind: "example",
          title: "A quarter circle",
          problem: md`Evaluate $\int_{0}^{3} \sqrt{9 - x^2} \, dx$.`,
          steps: [
            { math: md`x = 3\sin\theta, \qquad dx = 3\cos\theta \, d\theta, \qquad \sqrt{9 - x^2} = 3\cos\theta`, note: md`$a = 3$.` },
            { math: md`x = 0 \Rightarrow \theta = 0, \qquad x = 3 \Rightarrow \sin\theta = 1 \Rightarrow \theta = \frac{\pi}{2}`, note: "A definite integral: change the limits too, and there is no converting back." },
            { math: md`\int_{0}^{\pi/2} 3\cos\theta \cdot 3\cos\theta \, d\theta = 9\int_{0}^{\pi/2} \cos^2\theta \, d\theta`, note: "An even power: last lesson's half-angle identity." },
            { math: md`9\left[\frac{\theta}{2} + \frac{\sin 2\theta}{4}\right]_{0}^{\pi/2} = 9\left(\frac{\pi}{4} + 0 - 0\right) = \frac{9\pi}{4}`, note: md`$y = \sqrt{9 - x^2}$ for $0 \le x \le 3$ is a quarter of the circle $x^2 + y^2 = 9$, whose area is $\frac{\pi \cdot 3^2}{4}$. The calculus agrees with the geometry.` },
          ],
        },
        {
          kind: "plot",
          x: [-0.5, 3.7],
          y: [-0.5, 3.5],
          curves: [{ expr: "sqrt(9 - x^2)", label: "y = \\sqrt{9 - x^2}", color: 1 }],
          shade: [{ expr: "sqrt(9 - x^2)", from: 0, to: 3 }],
          points: [{ x: "3sin(t)", y: "3cos(t)", label: "(3\\sin\\theta, 3\\cos\\theta)", color: 2 }],
          vlines: [{ x: "3sin(t)", label: "x" }],
          params: [{ name: "t", tex: "\\theta", min: 0, max: 1.5708, step: 0.02, value: 0.6 }],
          caption: md`The quarter circle. A point on the curve at $x = 3\sin\theta$ has height $\sqrt{9 - x^2} = 3\cos\theta$. As $\theta$ goes from $0$ to $\frac{\pi}{2}$, $x$ goes from $0$ to $3$: that is where the new limits came from.`,
        },
        {
          kind: "example",
          title: "A tangent substitution",
          problem: md`Find $\int \frac{dx}{\sqrt{x^2 + 9}}$.`,
          steps: [
            { math: md`x = 3\tan\theta, \qquad dx = 3\sec^2\theta \, d\theta, \qquad \sqrt{x^2 + 9} = 3\sec\theta`, note: md`$x^2 + 9 = 9\tan^2\theta + 9 = 9\sec^2\theta$.` },
            { math: md`\int \frac{3\sec^2\theta}{3\sec\theta} \, d\theta = \int \sec\theta \, d\theta = \ln|\sec\theta + \tan\theta| + C`, note: "The secant integral from the last lesson. This is why we derived it." },
            { math: md`\sec\theta = \frac{\sqrt{x^2 + 9}}{3}, \qquad \tan\theta = \frac{x}{3}`, note: md`Reference triangle for $\tan\theta = \frac{x}{3}$: opposite $x$, adjacent $3$, hypotenuse $\sqrt{x^2 + 9}$.` },
            { math: md`\ln\left|\frac{\sqrt{x^2 + 9} + x}{3}\right| + C = \ln\left(x + \sqrt{x^2 + 9}\right) + C`, note: md`$\ln\frac{A}{3} = \ln A - \ln 3$, and $-\ln 3$ joins the constant. The quantity $x + \sqrt{x^2 + 9}$ is always positive (the root beats $|x|$), so the absolute value can go.` },
          ],
        },
        {
          kind: "example",
          title: "A secant substitution",
          problem: md`Find $\int \frac{dx}{x^2\sqrt{x^2 - 1}}$ for $x > 1$.`,
          steps: [
            { math: md`x = \sec\theta, \qquad dx = \sec\theta\tan\theta \, d\theta, \qquad \sqrt{x^2 - 1} = \tan\theta`, note: md`$a = 1$. With $0 \le \theta < \frac{\pi}{2}$, $\tan\theta \ge 0$ and $\sec\theta \ge 1$, matching $x > 1$.` },
            { math: md`\int \frac{\sec\theta\tan\theta}{\sec^2\theta \tan\theta} \, d\theta = \int \frac{d\theta}{\sec\theta} = \int \cos\theta \, d\theta = \sin\theta + C`, note: "Almost everything cancels." },
            { math: md`\sin\theta = \frac{\sqrt{x^2 - 1}}{x}`, note: md`Reference triangle for $\sec\theta = \frac{x}{1}$: hypotenuse $x$, adjacent $1$, opposite $\sqrt{x^2 - 1}$.` },
            { math: md`\frac{\sqrt{x^2 - 1}}{x} + C`, note: "" },
          ],
        },
        {
          kind: "why",
          title: "Why the reference triangle is allowed",
          body: md`After integrating, the answer is in terms of $\theta$: perhaps $\tan\theta$ or $\sin\theta\cos\theta$. We know one fact about $\theta$, for instance $\sin\theta = \frac{x}{a}$. Any right triangle with an acute angle $\theta$, opposite side $x$ and hypotenuse $a$ has that sine, and the Pythagorean theorem fixes its third side as $\sqrt{a^2 - x^2}$. So each of the six trig functions of $\theta$ is a ratio of $x$, $a$ and $\sqrt{a^2 - x^2}$.

The triangle only pictures $0 < \theta < \frac{\pi}{2}$, which is $0 < x < a$. For negative $x$ the formulas still hold, because we chose the range of $\theta$ so that $\cos\theta \ge 0$: the signs of $\sin\theta$ and $\tan\theta$ follow the sign of $x$, exactly as the triangle formulas say. That is the reason the restriction $-\frac{\pi}{2} \le \theta \le \frac{\pi}{2}$ was made in the first place.

Finally, the constant: when a substitution leaves $\ln|\sec\theta + \tan\theta|$ and converting back gives $\ln\left|\frac{x + \sqrt{x^2 + a^2}}{a}\right|$, the $-\ln a$ is a constant and disappears into $C$. Answers that differ by a constant are the same antiderivative.`,
        },
        {
          kind: "text",
          body: md`Quadratics that are not already in one of the three forms get there by **completing the square**. For $\int \frac{dx}{\sqrt{x^2 + 2x + 5}}$, write $x^2 + 2x + 5 = (x + 1)^2 + 4$ and let $u = x + 1$: the integral becomes $\int \frac{du}{\sqrt{u^2 + 4}} = \ln\left(u + \sqrt{u^2 + 4}\right) + C$, by the tangent example with $a = 2$. Then put $x + 1$ back.

Which substitution? Read the sign pattern under the root. A constant minus a square: sine. A constant plus a square: tangent. A square minus a constant: secant.`,
        },
        {
          kind: "check",
          prompt: md`Find $\int \frac{1}{\sqrt{25 - x^2}} \, dx$. Type $\arcsin$ as asin. ${PLUS_C}`,
          answer: "asin(x/5)",
          upToConstant: true,
          explain: md`$x = 5\sin\theta$, $dx = 5\cos\theta \, d\theta$, $\sqrt{25 - x^2} = 5\cos\theta$. The integral collapses to $\int d\theta = \theta = \arcsin\frac{x}{5} + C$.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_{0}^{2} \frac{1}{x^2 + 4} \, dx$. Give an exact answer (type $\pi$ as pi).`,
          answer: "pi/8",
          explain: md`$x = 2\tan\theta$: the integrand times $dx$ becomes $\frac{2\sec^2\theta}{4\sec^2\theta} \, d\theta = \frac12 \, d\theta$. The limits $x = 0, 2$ become $\theta = 0, \frac{\pi}{4}$. So the integral is $\frac12 \cdot \frac{\pi}{4} = \frac{\pi}{8}$.`,
        },
      ],
      practice: [sineSubstitution, tangentSubstitution, secantSubstitution],
    },
    {
      id: slug("Partial fractions"),
      title: "Partial fractions",
      summary: "A rational function splits into simple pieces, one per factor of the denominator, and each piece integrates to a logarithm, a power or an arctangent.",
      blocks: [
        {
          kind: "text",
          body: md`Adding fractions is routine:

$$\frac{2}{x - 1} - \frac{1}{x + 3} = \frac{2(x + 3) - (x - 1)}{(x - 1)(x + 3)} = \frac{x + 7}{(x - 1)(x + 3)}.$$

Now read it backwards. The right side is hard to integrate as it stands. The left side is two logarithms. **Partial fractions** is the method for running this backwards: take a rational function and split it into pieces whose denominators are the individual factors. Algebra 3 covered the algebra; here the point is what it does for integrals.`,
        },
        {
          kind: "key",
          title: "The shape of the decomposition",
          body: md`Let $\frac{P(x)}{Q(x)}$ be **proper**: the degree of $P$ is less than the degree of $Q$. Factor $Q$ completely over the reals. Then $\frac{P}{Q}$ is a sum of terms, one group per factor:

- a distinct linear factor $(x - a)$ contributes $\dfrac{A}{x - a}$;
- a repeated linear factor $(x - a)^k$ contributes $\dfrac{A_1}{x - a} + \dfrac{A_2}{(x - a)^2} + \cdots + \dfrac{A_k}{(x - a)^k}$;
- an irreducible quadratic $x^2 + bx + c$ contributes $\dfrac{Bx + C}{x^2 + bx + c}$.

If the fraction is not proper, divide first: $\frac{P}{Q} = \text{polynomial} + \frac{R}{Q}$ with $\deg R < \deg Q$.`,
        },
        {
          kind: "why",
          title: "Why one constant per factor is enough",
          body: md`Take two distinct linear factors: $\frac{P(x)}{(x - a)(x - b)}$ with $\deg P \le 1$, so $P(x) = px + q$ has two coefficients. We claim $\frac{A}{x - a} + \frac{B}{x - b}$ can match it. Combine over the common denominator:

$$\frac{A}{x - a} + \frac{B}{x - b} = \frac{A(x - b) + B(x - a)}{(x - a)(x - b)} = \frac{(A + B)x - (Ab + Ba)}{(x - a)(x - b)}.$$

The numerator is a general linear polynomial with two free parameters, $A$ and $B$. Matching it to $px + q$ gives two linear equations in two unknowns, $A + B = p$ and $Ab + Ba = -q$, and these have exactly one solution when $a \ne b$ (the determinant is $a - b$). So the two constants are exactly enough: not too few to match, not so many that the answer is ambiguous. The same counting works in general. A proper fraction over a degree-$n$ denominator has $n$ numerator coefficients to match, and the decomposition has exactly $n$ unknowns.

Finding the constants is faster than solving the system. Multiply through by the denominator: $P(x) = A(x - b) + B(x - a)$. This holds for every $x$. Put $x = a$ and the $B$ term dies: $P(a) = A(a - b)$, so $A = \frac{P(a)}{a - b}$. Put $x = b$ for $B$. This is the **cover-up** method: to get the constant over $(x - a)$, cover up that factor in the original fraction and evaluate what remains at $x = a$.`,
        },
        {
          kind: "proof",
          title: "The cover-up method",
          given: md`$\dfrac{P(x)}{(x - a) Q(x)} = \dfrac{A}{x - a} + \dfrac{R(x)}{Q(x)}$ for all $x$ except the roots, where $Q(a) \ne 0$`,
          prove: md`$A = \dfrac{P(a)}{Q(a)}$`,
          steps: [
            { statement: md`$P(x) = A \, Q(x) + (x - a) R(x)$ for all $x$ except the roots`, reason: md`Multiply both sides by $(x - a) Q(x)$` },
            { statement: md`$P(x) = A \, Q(x) + (x - a) R(x)$ for **all** $x$`, reason: "Both sides are polynomials; two polynomials that agree at infinitely many points are identical (Algebra 3)" },
            { statement: md`$P(a) = A \, Q(a) + 0$`, reason: md`Set $x = a$; the factor $(x - a)$ is zero` },
            { statement: md`$A = \dfrac{P(a)}{Q(a)}$`, reason: md`Divide by $Q(a) \ne 0$` },
          ],
        },
        {
          kind: "example",
          title: "Distinct linear factors",
          problem: md`Find $\int \frac{x + 7}{x^2 + 2x - 3} \, dx$.`,
          steps: [
            { math: md`x^2 + 2x - 3 = (x - 1)(x + 3)`, note: "Factor the denominator. Partial fractions always starts here." },
            { math: md`\frac{x + 7}{(x - 1)(x + 3)} = \frac{A}{x - 1} + \frac{B}{x + 3}`, note: "One constant over each factor." },
            { math: md`A = \frac{1 + 7}{1 + 3} = 2, \qquad B = \frac{-3 + 7}{-3 - 1} = -1`, note: md`Cover-up: for $A$, cover $(x - 1)$ and set $x = 1$ in $\frac{x + 7}{x + 3}$. For $B$, cover $(x + 3)$ and set $x = -3$ in $\frac{x + 7}{x - 1}$.` },
            { math: md`\int \frac{2}{x - 1} \, dx - \int \frac{1}{x + 3} \, dx = 2\ln|x - 1| - \ln|x + 3| + C`, note: md`Each piece is $\int \frac{du}{u}$. The absolute values matter: $x - 1$ can be negative.` },
          ],
        },
        {
          kind: "plot",
          x: [-6, 5],
          y: [-6, 6],
          curves: [
            { expr: "(x + 7)/((x - 1)(x + 3))", label: "\\frac{x + 7}{(x - 1)(x + 3)}", color: 1 },
            { expr: "2/(x - 1)", label: "\\frac{2}{x - 1}", color: 2, dashed: true },
            { expr: "-1/(x + 3)", label: "\\frac{-1}{x + 3}", color: 3, dashed: true },
          ],
          vlines: [{ x: 1 }, { x: -3 }],
          caption: md`The rational function (solid) is the sum of its two partial fractions (dashed). Near $x = 1$ it behaves like $\frac{2}{x - 1}$; near $x = -3$ like $\frac{-1}{x + 3}$. Each simple piece owns one vertical asymptote, and that is why each integrates to one logarithm.`,
        },
        {
          kind: "why",
          title: "Why repeated factors need every power",
          body: md`Try to write $\frac{x + 3}{(x - 1)^2}$ as $\frac{A}{x - 1}$ alone. Clearing denominators gives $x + 3 = A(x - 1)$, which cannot hold for all $x$: the left side has value $4$ at $x = 1$, the right side $0$. One constant is not enough because the numerator has two coefficients.

So allow $\frac{A}{x - 1} + \frac{B}{(x - 1)^2}$. Over the common denominator this is $\frac{A(x - 1) + B}{(x - 1)^2}$, and $A(x - 1) + B$ is a general linear polynomial: two unknowns for two coefficients. In general $(x - a)^k$ in the denominator calls for all the powers $1$ through $k$, giving $k$ unknowns to match the $k$ coefficients a numerator of degree below $k$ can have.

Integrating these pieces: $\frac{A}{x - a}$ gives a logarithm, and for $k \ge 2$ the power rule applies, $\int (x - a)^{-k} \, dx = \frac{(x - a)^{1 - k}}{1 - k}$. No logarithms from the higher powers.`,
        },
        {
          kind: "example",
          title: "A repeated factor",
          problem: md`Find $\int \frac{x + 3}{(x - 1)^2} \, dx$.`,
          steps: [
            { math: md`\frac{x + 3}{(x - 1)^2} = \frac{A}{x - 1} + \frac{B}{(x - 1)^2}`, note: "Both powers of the repeated factor." },
            { math: md`x + 3 = A(x - 1) + B`, note: "Multiply through." },
            { math: md`x = 1: \quad 4 = B; \qquad x \text{ coefficient}: \quad 1 = A`, note: md`Cover-up gives the constant over the highest power. For $A$, compare the coefficients of $x$ (or plug in any second value of $x$).` },
            { math: md`\int \frac{1}{x - 1} \, dx + \int 4(x - 1)^{-2} \, dx = \ln|x - 1| - \frac{4}{x - 1} + C`, note: md`$\int (x - 1)^{-2} \, dx = -(x - 1)^{-1}$.` },
          ],
        },
        {
          kind: "why",
          title: "Why an irreducible quadratic gets Bx + C, and how to integrate it",
          body: md`A quadratic that does not factor over the reals, like $x^2 + 4$, has no real root to plug in, so it stays as one factor. Its numerator may be any polynomial of degree less than 2: a general $Bx + C$. Two coefficients, two unknowns.

To integrate $\frac{Bx + C}{x^2 + a^2}$, split the numerator into the part that is a derivative of the denominator and the part that is a constant:

$$\int \frac{Bx}{x^2 + a^2} \, dx = \frac{B}{2}\ln(x^2 + a^2), \qquad \int \frac{C}{x^2 + a^2} \, dx = \frac{C}{a}\arctan\frac{x}{a}.$$

The first is the substitution $u = x^2 + a^2$, $du = 2x \, dx$; no absolute value because $x^2 + a^2 > 0$. The second is the tangent substitution of the last lesson. When the quadratic is $x^2 + bx + c$ instead, complete the square to reach $(x + h)^2 + a^2$ and shift with $u = x + h$.`,
        },
        {
          kind: "example",
          title: "A quadratic factor",
          problem: md`Find $\int \frac{2x + 5}{x^2 + 4} \, dx$.`,
          steps: [
            { math: md`\int \frac{2x}{x^2 + 4} \, dx + \int \frac{5}{x^2 + 4} \, dx`, note: "Split the numerator: the x part and the constant part go different ways." },
            { math: md`\int \frac{2x}{x^2 + 4} \, dx = \ln(x^2 + 4)`, note: md`$u = x^2 + 4$, $du = 2x \, dx$: the numerator is exactly $du$.` },
            { math: md`\int \frac{5}{x^2 + 4} \, dx = \frac{5}{2}\arctan\frac{x}{2}`, note: md`$\int \frac{dx}{x^2 + a^2} = \frac{1}{a}\arctan\frac{x}{a}$ with $a = 2$.` },
            { math: md`\ln(x^2 + 4) + \frac{5}{2}\arctan\frac{x}{2} + C`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`One more case. If the numerator's degree is at least the denominator's, the fraction is **improper** and the decomposition does not apply yet. Divide first. For $\int \frac{x^2}{x - 1} \, dx$: $x^2 = (x + 1)(x - 1) + 1$, so $\frac{x^2}{x - 1} = x + 1 + \frac{1}{x - 1}$ and the integral is $\frac{x^2}{2} + x + \ln|x - 1| + C$.

The method covers **every** rational function, because every real polynomial factors into linear and irreducible quadratic factors (Algebra 3). Every rational function therefore integrates to polynomials, logarithms and arctangents. Nothing else is ever needed.`,
        },
        {
          kind: "check",
          prompt: md`Find constants $A$ and $B$ with $\dfrac{1}{x(x + 1)} = \dfrac{A}{x} + \dfrac{B}{x + 1}$. Answer as (A, B).`,
          answer: "(1, -1)",
          form: "tuple",
          explain: md`Cover-up: for $A$, cover $x$ and set $x = 0$ in $\frac{1}{x + 1}$, giving $1$. For $B$, cover $(x + 1)$ and set $x = -1$ in $\frac{1}{x}$, giving $-1$. Check: $\frac{1}{x} - \frac{1}{x + 1} = \frac{(x + 1) - x}{x(x + 1)}$.`,
        },
        {
          kind: "check",
          prompt: md`Find $\int \frac{1}{x^2 - 1} \, dx$. ${LN_NOTE} ${PLUS_C}`,
          answer: "1/2 ln(abs(x - 1)) - 1/2 ln(abs(x + 1))",
          upToConstant: true,
          explain: md`$x^2 - 1 = (x - 1)(x + 1)$. Cover-up: $A = \frac{1}{1 + 1} = \frac12$ and $B = \frac{1}{-1 - 1} = -\frac12$. So the integral is $\frac12\ln|x - 1| - \frac12\ln|x + 1| + C$.`,
        },
      ],
      practice: [distinctLinearFactors, repeatedFactors, quadraticAndImproper],
    },
    {
      id: slug("Numerical integration"),
      title: "Numerical integration",
      summary: "When no antiderivative is available, approximate the area with trapezoids or parabolas, and know how big the error can be.",
      blocks: [
        {
          kind: "text",
          body: md`$\int_0^1 e^{-x^2} \, dx$ has no antiderivative made of the functions we know. That is a theorem, not a failure of effort. The same goes for $\int \sin(x^2) \, dx$, $\int \frac{\sin x}{x} \, dx$ and many others that appear in statistics and physics. Yet the definite integrals exist, and we need their values.

The definite integral was defined as a limit of Riemann sums. Any Riemann sum with a reasonable number of strips is an approximation, and that is the starting point. The question is how to get a **good** approximation from a **few** strips, and how to say honestly how good it is.`,
        },
        {
          kind: "key",
          title: "Three rules",
          body: md`Cut $[a, b]$ into $n$ equal strips of width $h = \frac{b - a}{n}$, with endpoints $x_0 = a, x_1, \dots, x_n = b$ and $y_i = f(x_i)$.

**Midpoint rule**: $M_n = h\big(f(m_1) + f(m_2) + \cdots + f(m_n)\big)$, where $m_i$ is the midpoint of the $i$-th strip.

**Trapezoid rule**: $T_n = \dfrac{h}{2}\big(y_0 + 2y_1 + 2y_2 + \cdots + 2y_{n-1} + y_n\big)$.

**Simpson's rule** ($n$ even): $S_n = \dfrac{h}{3}\big(y_0 + 4y_1 + 2y_2 + 4y_3 + \cdots + 2y_{n-2} + 4y_{n-1} + y_n\big)$.`,
        },
        {
          kind: "why",
          title: "Where the trapezoid rule comes from",
          body: md`A left Riemann sum uses the height at the left end of each strip; a right sum uses the right end. If the curve rises, one is too small and the other too big. Average them:

$$\frac{L_n + R_n}{2} = \frac{1}{2}\left(h\sum_{i=0}^{n-1} y_i + h\sum_{i=1}^{n} y_i\right) = \frac{h}{2}\big(y_0 + 2y_1 + \cdots + 2y_{n-1} + y_n\big).$$

The interior heights appear in both sums, so they are counted twice; the two ends appear once each. That is $T_n$.

The same formula has a picture. Replace the curve over each strip by the straight chord joining $(x_{i-1}, y_{i-1})$ to $(x_i, y_i)$. The region under the chord is a trapezoid of width $h$ and parallel sides $y_{i-1}$ and $y_i$, with area $\frac{h}{2}(y_{i-1} + y_i)$. Add up the $n$ trapezoids and the interior sides are shared, giving the same weights $1, 2, 2, \dots, 2, 1$.`,
        },
        {
          kind: "plot",
          x: [-0.2, 2.3],
          y: [-0.1, 1.2],
          curves: [{ expr: "e^(-x^2)", label: "y = e^{-x^2}", color: 1 }],
          riemann: { expr: "e^(-x^2)", from: 0, to: 2, n: "n", method: "trapezoid", color: 2 },
          params: [{ name: "n", min: 1, max: 16, step: 1, value: 4 }],
          caption: md`Trapezoids under $y = e^{-x^2}$ on $[0, 2]$ with $n = {n}$ strips. The curve bends both ways here: concave down near $0$, where chords lie below the curve, and concave up past $x \approx 0.71$, where chords lie above it. Increase $n$ and the gaps shrink fast. The true value is about $0.88208$.`,
        },
        {
          kind: "why",
          title: "Where Simpson's rule comes from",
          body: md`Chords are straight, and curves are not. A better fit is a parabola through **three** consecutive points. Take a pair of strips, $[x_0, x_2]$ with midpoint $x_1$, and shift coordinates so that $x_1 = 0$: the points are $(-h, y_0)$, $(0, y_1)$, $(h, y_2)$. There is exactly one parabola $p(x) = Ax^2 + Bx + C$ through them, and its integral over $[-h, h]$ is

$$\int_{-h}^{h} (Ax^2 + Bx + C) \, dx = \frac{2Ah^3}{3} + 2Ch.$$

The $Bx$ term integrates to zero: it is odd about the midpoint. Now express $A$ and $C$ through the heights. $y_1 = p(0) = C$, and $y_0 + y_2 = (Ah^2 - Bh + C) + (Ah^2 + Bh + C) = 2Ah^2 + 2C$. So $2Ah^2 = y_0 + y_2 - 2y_1$, and

$$\int_{-h}^{h} p(x) \, dx = \frac{h}{3}\left(2Ah^2\right) + 2Ch = \frac{h}{3}\big(y_0 + y_2 - 2y_1\big) + 2hy_1 = \frac{h}{3}\big(y_0 + 4y_1 + y_2\big).$$

Do this for each pair of strips, $[x_0, x_2]$, $[x_2, x_4]$, and so on (which is why $n$ must be even), and add. The ends get weight 1, each odd-numbered point is a midpoint with weight 4, and each even-numbered interior point is the shared end of two pairs, weight $1 + 1 = 2$.`,
        },
        {
          kind: "proof",
          title: "The area under a parabola through three points",
          given: md`$p(x) = Ax^2 + Bx + C$ with $p(-h) = y_0$, $p(0) = y_1$, $p(h) = y_2$`,
          prove: md`$\int_{-h}^{h} p(x) \, dx = \dfrac{h}{3}(y_0 + 4y_1 + y_2)$`,
          steps: [
            { statement: md`$\int_{-h}^{h} p(x) \, dx = \left[\frac{Ax^3}{3} + \frac{Bx^2}{2} + Cx\right]_{-h}^{h} = \frac{2Ah^3}{3} + 2Ch$`, reason: md`Power rule; the $B$ terms cancel because $h^2 = (-h)^2$` },
            { statement: md`$C = y_1$`, reason: md`$p(0) = C$` },
            { statement: md`$y_0 + y_2 = 2Ah^2 + 2C$`, reason: md`Add $p(-h) = Ah^2 - Bh + C$ and $p(h) = Ah^2 + Bh + C$` },
            { statement: md`$2Ah^2 = y_0 + y_2 - 2y_1$`, reason: md`Substitute $C = y_1$ and rearrange` },
            { statement: md`$\int_{-h}^{h} p(x) \, dx = \frac{h}{3}(y_0 + y_2 - 2y_1) + 2hy_1 = \frac{h}{3}(y_0 + 4y_1 + y_2)$`, reason: md`$\frac{2Ah^3}{3} = \frac{h}{3} \cdot 2Ah^2$; collect the $y_1$ terms: $-\frac{2h}{3} + 2h = \frac{4h}{3}$` },
          ],
        },
        {
          kind: "plot",
          x: [-0.2, 2.3],
          y: [-0.1, 1.2],
          curves: [
            { expr: "e^(-x^2)", label: "y = e^{-x^2}", color: 1 },
            { expr: "(x - 1)(x - 2)/2 - 0.367879 x (x - 2) + 0.0091578 x (x - 1)", label: "\\text{parabola}", color: 2, dashed: true },
          ],
          points: [
            { x: 0, y: 1, color: 2 },
            { x: 1, y: 0.367879, color: 2 },
            { x: 2, y: 0.018316, color: 2 },
          ],
          caption: md`Simpson's rule with $n = 2$ on $[0, 2]$: one parabola through the three points of $y = e^{-x^2}$ at $x = 0, 1, 2$. Its area is $\frac{1}{3}(1 + 4 \cdot 0.36788 + 0.01832) = 0.8299$ against the true $0.8821$. Rough with one parabola; with $n = 4$ (two parabolas) Simpson gives $0.8818$, and with $n = 8$, $0.88207$.`,
        },
        {
          kind: "example",
          title: "Trapezoid and Simpson side by side",
          problem: md`Approximate $\int_{1}^{3} \frac{1}{x} \, dx$ with $n = 4$ using the trapezoid rule and Simpson's rule, and compare with the exact value $\ln 3 \approx 1.09861$.`,
          steps: [
            { math: md`h = \frac{3 - 1}{4} = 0.5, \qquad x_i = 1, \; 1.5, \; 2, \; 2.5, \; 3`, note: "" },
            { math: md`y_i = 1, \; \tfrac23, \; \tfrac12, \; \tfrac25, \; \tfrac13`, note: md`$f(x) = \frac{1}{x}$ at the grid points.` },
            { math: md`T_4 = \frac{0.5}{2}\left(1 + 2 \cdot \tfrac23 + 2 \cdot \tfrac12 + 2 \cdot \tfrac25 + \tfrac13\right) = \frac{1}{4} \cdot \frac{67}{15} = \frac{67}{60} \approx 1.11667`, note: md`Weights $1, 2, 2, 2, 1$. Too large by about $0.018$: $\frac{1}{x}$ is concave up, so every chord lies above the curve.` },
            { math: md`S_4 = \frac{0.5}{3}\left(1 + 4 \cdot \tfrac23 + 2 \cdot \tfrac12 + 4 \cdot \tfrac25 + \tfrac13\right) = \frac{1}{6} \cdot \frac{33}{5} = \frac{11}{10} = 1.1`, note: md`Weights $1, 4, 2, 4, 1$. Off by $0.0014$, about 13 times better than the trapezoids, from the same five function values.` },
          ],
        },
        {
          kind: "key",
          title: "Error bounds",
          body: md`Suppose $|f''(x)| \le K$ on $[a, b]$. Then the errors satisfy

$$|E_T| \le \frac{K(b - a)^3}{12n^2}, \qquad |E_M| \le \frac{K(b - a)^3}{24n^2}.$$

If $|f^{(4)}(x)| \le K_4$ on $[a, b]$, Simpson's error satisfies

$$|E_S| \le \frac{K_4(b - a)^5}{180n^4}.$$

Doubling $n$ cuts the trapezoid and midpoint errors by about 4 and Simpson's by about 16.`,
        },
        {
          kind: "why",
          title: "Why the errors depend on f'' and f''''",
          body: md`A chord agrees with the curve at both ends of a strip. If the curve were a straight line, $f'' = 0$, the chord would be the curve and the trapezoid would be exact. The gap between curve and chord is caused entirely by bending, and bending is measured by $f''$. For a strip of width $h$ the gap is at most about $\frac{K h^2}{8}$ (the same estimate that bounds the linear-approximation error in Calculus 1), so the area error on one strip is at most about $\frac{K h^3}{12}$ after integrating the gap exactly. There are $n$ strips with $h = \frac{b - a}{n}$:

$$n \cdot \frac{K h^3}{12} = \frac{K (b - a)^3}{12 n^2}.$$

The midpoint rule's tangent-line picture gives half that, and on the opposite side: the midpoint rectangle has the same area as the trapezoid under the tangent line at the midpoint, and the curve lies on one side of its tangent while it lies on the other side of its chord. That is why $M_n$ and $T_n$ bracket the true value when $f''$ keeps one sign.

Simpson's parabola agrees with the curve at three points, so a quadratic is integrated exactly. Remarkably a **cubic** is too: the cubic term $x^3$ is odd about the midpoint, so its integral over $[-h, h]$ is zero, and Simpson's weights give it $\frac{h}{3}\big((-h)^3 + 0 + h^3\big) = 0$ as well. The first thing Simpson's rule gets wrong is a fourth power, so the error is governed by $f^{(4)}$, and the extra two powers of $h$ per strip give the $n^4$ in the denominator.`,
        },
        {
          kind: "example",
          title: "Using the bound",
          problem: md`How far could $T_4$ be from $\int_1^3 \frac{dx}{x}$? And how large must $n$ be for the trapezoid rule to be within $0.0001$?`,
          steps: [
            { math: md`f(x) = x^{-1}, \quad f''(x) = 2x^{-3}, \quad |f''(x)| \le 2 \text{ on } [1, 3]`, note: md`$f''$ is largest at the left end, $x = 1$. So $K = 2$.` },
            { math: md`|E_T| \le \frac{2 \cdot 2^3}{12 \cdot 4^2} = \frac{16}{192} = \frac{1}{12} \approx 0.083`, note: md`A guarantee, not a prediction. The actual error was $0.018$, comfortably inside. The bound uses the worst $f''$ on the whole interval.` },
            { math: md`\frac{2 \cdot 8}{12 n^2} \le 0.0001 \quad\Rightarrow\quad n^2 \ge \frac{16}{0.0012} \approx 13333 \quad\Rightarrow\quad n \ge 116`, note: md`Solve the bound for $n$. For Simpson's rule, $f^{(4)} = 24x^{-5} \le 24$, and $\frac{24 \cdot 32}{180 n^4} \le 0.0001$ needs only $n \ge 15$ (and even).` },
          ],
        },
        {
          kind: "check",
          prompt: md`Use the midpoint rule with $n = 2$ to approximate $\int_{0}^{2} x^2 \, dx$. Give the exact value of $M_2$ as a fraction or decimal.`,
          answer: "5/2",
          explain: md`$h = 1$, midpoints $0.5$ and $1.5$. $M_2 = 1 \cdot (0.25 + 2.25) = 2.5$. The exact value is $\frac83 \approx 2.667$; the midpoint rule is a little low because $x^2$ is concave up.`,
        },
        {
          kind: "check",
          prompt: md`Use Simpson's rule with $n = 2$ to approximate $\int_{0}^{2} x^3 \, dx$. Give the exact value of $S_2$.`,
          answer: "4",
          explain: md`$h = 1$ and $S_2 = \frac{1}{3}(0 + 4 \cdot 1 + 8) = 4$. The exact value is $\left[\frac{x^4}{4}\right]_0^2 = 4$. Simpson's rule is exact for cubics.`,
        },
      ],
      practice: [trapezoidAndMidpoint, simpsonExact, simpsonRounded],
    },
    {
      id: slug("Improper integrals"),
      title: "Improper integrals",
      summary: "Integrals over infinite intervals, or of functions that blow up, are defined as limits. Some converge to finite areas; the p-integrals say which.",
      blocks: [
        {
          kind: "text",
          body: md`The definite integral $\int_a^b f(x) \, dx$ was built from Riemann sums on a **bounded** interval with a **bounded** function. Both conditions are needed for the rectangles to make sense. Yet questions like "what is the total area under $y = \frac{1}{x^2}$ to the right of $x = 1$?" or "what is the area under $y = \frac{1}{\sqrt{x}}$ between $0$ and $1$, where it shoots up?" are natural, and in probability and physics they are unavoidable.

The way to make sense of them is the same move calculus always makes: do the ordinary thing on a safe piece, and take a limit as the piece grows to fill the whole.`,
        },
        {
          kind: "key",
          title: "Infinite intervals",
          body: md`$$\int_a^{\infty} f(x) \, dx = \lim_{b \to \infty} \int_a^b f(x) \, dx, \qquad \int_{-\infty}^{b} f(x) \, dx = \lim_{a \to -\infty} \int_a^b f(x) \, dx.$$

If the limit is a finite number, the integral **converges** to it. Otherwise it **diverges**. For $\int_{-\infty}^{\infty}$, split at any point $c$ and require both halves to converge separately:

$$\int_{-\infty}^{\infty} f(x) \, dx = \int_{-\infty}^{c} f(x) \, dx + \int_{c}^{\infty} f(x) \, dx.$$`,
        },
        {
          kind: "why",
          title: "Why 1/x² has finite tail area and 1/x does not",
          body: md`Both curves go to zero as $x \to \infty$. The difference is how fast. Compute the ordinary integrals up to $b$:

$$\int_1^b \frac{dx}{x^2} = \left[-\frac{1}{x}\right]_1^b = 1 - \frac{1}{b}, \qquad \int_1^b \frac{dx}{x} = \Big[\ln x\Big]_1^b = \ln b.$$

As $b \to \infty$, the first tends to $1$: however far you go, the area never exceeds 1, and it gets as close as you like. The tail of $\frac{1}{x^2}$ has total area exactly 1. The second, $\ln b$, grows without bound, slowly but forever. The tail of $\frac{1}{x}$ has infinite area.

So "goes to zero" is not enough for convergence. The function has to go to zero **fast enough**, and $\frac{1}{x}$ is precisely the borderline.`,
        },
        {
          kind: "plot",
          x: [0, 10.5],
          y: [-0.1, 1.3],
          curves: [
            { expr: "1/x", label: "y = \\frac{1}{x}", color: 1 },
            { expr: "1/x^2", label: "y = \\frac{1}{x^2}", color: 2 },
          ],
          shade: [
            { expr: "1/x^2", from: 1, to: "b", color: 2 },
            { expr: "1/x", under: "1/x^2", from: 1, to: "b", color: 1 },
          ],
          vlines: [{ x: "b", label: "b" }],
          params: [{ name: "b", min: 1, max: 10, step: 0.5, value: 4 }],
          caption: md`Areas from $1$ to $b = {b}$. Under $\frac{1}{x^2}$ (orange): $1 - \frac{1}{b} = {=1 - 1/b}$, closing in on $1$. Under $\frac{1}{x}$ (both colours together): $\ln b = {=ln(b)}$, still growing. Slide $b$ to the right and watch one settle while the other keeps climbing.`,
        },
        {
          kind: "key",
          title: "The p-integrals",
          body: md`$$\int_1^{\infty} \frac{dx}{x^p} \quad \text{converges to } \frac{1}{p - 1} \text{ if } p > 1, \text{ and diverges if } p \le 1.$$
$$\int_0^{1} \frac{dx}{x^p} \quad \text{converges to } \frac{1}{1 - p} \text{ if } p < 1, \text{ and diverges if } p \ge 1.$$

At infinity, the function must shrink faster than $\frac{1}{x}$. Near zero, it must blow up slower than $\frac{1}{x}$. In both places $p = 1$ is the dividing line, and it fails on both sides.`,
        },
        {
          kind: "proof",
          title: "The p-test at infinity",
          given: md`$p$ is a real number`,
          prove: md`$\int_1^{\infty} x^{-p} \, dx$ converges exactly when $p > 1$, to $\frac{1}{p - 1}$`,
          steps: [
            { statement: md`Case $p = 1$: $\int_1^b \frac{dx}{x} = \ln b \to \infty$`, reason: md`$\ln$ is unbounded (Algebra 2)` },
            { statement: md`Case $p \ne 1$: $\int_1^b x^{-p} \, dx = \dfrac{b^{1 - p} - 1}{1 - p}$`, reason: md`Power rule, $\int x^{-p} \, dx = \frac{x^{1 - p}}{1 - p}$, evaluated from $1$ to $b$` },
            { statement: md`If $p > 1$: $b^{1 - p} = \dfrac{1}{b^{p - 1}} \to 0$, so the integral $\to \dfrac{-1}{1 - p} = \dfrac{1}{p - 1}$`, reason: md`$p - 1 > 0$, so $b^{p - 1} \to \infty$` },
            { statement: md`If $p < 1$: $b^{1 - p} \to \infty$, so the integral diverges`, reason: md`$1 - p > 0$: a positive power of $b$ grows without bound` },
            { statement: md`The integral converges exactly when $p > 1$`, reason: "The three cases cover every real p" },
          ],
        },
        {
          kind: "example",
          title: "An exponential tail",
          problem: md`Evaluate $\int_{0}^{\infty} e^{-2x} \, dx$.`,
          steps: [
            { math: md`\int_{0}^{b} e^{-2x} \, dx = \left[-\frac{1}{2}e^{-2x}\right]_0^b = -\frac{1}{2}e^{-2b} + \frac{1}{2}`, note: "An ordinary integral up to b first." },
            { math: md`\lim_{b \to \infty}\left(\frac12 - \frac12 e^{-2b}\right) = \frac12`, note: md`$e^{-2b} \to 0$. Exponentials shrink faster than any power, so they always have finite tails.` },
          ],
        },
        {
          kind: "key",
          title: "Infinite integrands",
          body: md`If $f$ is continuous on $[a, b)$ but unbounded as $x \to b^-$,

$$\int_a^b f(x) \, dx = \lim_{t \to b^-} \int_a^t f(x) \, dx,$$

and similarly from the right when the trouble is at $a$. If the bad point $c$ is **inside** $[a, b]$, split there and require both $\int_a^c$ and $\int_c^b$ to converge.

Never apply the fundamental theorem straight across a point where $f$ is undefined. The theorem assumes continuity on the whole interval.`,
        },
        {
          kind: "example",
          title: "A thin spike",
          problem: md`Evaluate $\int_{0}^{1} \frac{dx}{\sqrt{x}}$.`,
          steps: [
            { math: md`\int_{t}^{1} x^{-1/2} \, dx = \Big[2\sqrt{x}\Big]_t^1 = 2 - 2\sqrt{t}`, note: md`The integrand is infinite at $0$, so start at $t > 0$.` },
            { math: md`\lim_{t \to 0^+}\left(2 - 2\sqrt{t}\right) = 2`, note: md`Converges. The spike is infinitely tall but so thin that the area under it is finite: this is $p = \frac12 < 1$.` },
          ],
        },
        {
          kind: "example",
          title: "The trap",
          problem: md`What is wrong with $\int_{-1}^{1} \frac{dx}{x^2} = \left[-\frac{1}{x}\right]_{-1}^{1} = -1 - 1 = -2$?`,
          steps: [
            { math: md`\frac{1}{x^2} > 0 \text{ everywhere, yet the "answer" is negative}`, note: "An integral of a positive function cannot be negative. Something is illegal." },
            { math: md`\frac{1}{x^2} \text{ is undefined at } x = 0, \text{ inside } [-1, 1]`, note: "The fundamental theorem needs a continuous integrand on the whole interval. It was applied across a hole." },
            { math: md`\int_{0}^{1} \frac{dx}{x^2} = \lim_{t \to 0^+}\left[-\frac{1}{x}\right]_t^1 = \lim_{t \to 0^+}\left(-1 + \frac{1}{t}\right) = \infty`, note: md`Split at $0$ and treat each half properly. This half already diverges ($p = 2 \ge 1$ near zero).` },
            { math: md`\int_{-1}^{1} \frac{dx}{x^2} \text{ diverges}`, note: "One divergent half is enough. There is no finite area here, let alone a negative one." },
          ],
        },
        {
          kind: "why",
          title: "Comparison: deciding without computing",
          body: md`Often we only need to know **whether** an improper integral converges, and the integrand has no usable antiderivative. Suppose $0 \le f(x) \le g(x)$ for $x \ge a$. Then for every $b$,

$$0 \le \int_a^b f(x) \, dx \le \int_a^b g(x) \, dx,$$

because the area under the lower curve fits inside the area under the higher one. If $\int_a^\infty g$ converges to $G$, the left side is a quantity that increases with $b$ (we keep adding non-negative area) and never exceeds $G$. An increasing quantity with a ceiling must settle to a limit; that is the completeness of the real numbers, and the same fact that will drive the theory of series in the next unit. So $\int_a^\infty f$ converges too, to something at most $G$.

The other direction: if $\int_a^\infty f$ diverges, the bigger $\int_a^\infty g$ cannot converge, or $f$'s integral would be trapped under it.

The same reasoning works near a point where the functions blow up.`,
        },
        {
          kind: "key",
          title: "The comparison test",
          body: md`Suppose $0 \le f(x) \le g(x)$ on the interval of integration.

- If $\int g$ converges, so does $\int f$ (a smaller area under a finite one).
- If $\int f$ diverges, so does $\int g$ (a larger area over an infinite one).

The usual comparison partners are the $p$-integrals and $e^{-kx}$. The test says nothing when the small one converges or the large one diverges.`,
        },
        {
          kind: "example",
          title: "Comparison in action",
          problem: md`Does $\int_{1}^{\infty} e^{-x^2} \, dx$ converge?`,
          steps: [
            { math: md`x \ge 1 \;\Rightarrow\; x^2 \ge x \;\Rightarrow\; e^{-x^2} \le e^{-x}`, note: md`Bigger exponent on the bottom, smaller number. We need a known function above $e^{-x^2}$.` },
            { math: md`\int_{1}^{\infty} e^{-x} \, dx = \lim_{b \to \infty}\left(e^{-1} - e^{-b}\right) = \frac{1}{e}`, note: "The comparison partner converges." },
            { math: md`0 < \int_{1}^{\infty} e^{-x^2} \, dx \le \frac{1}{e}`, note: md`So the integral converges, to something below $0.368$. (Its exact value, $\frac{\sqrt{\pi}}{2} - \int_0^1 e^{-x^2} \, dx \approx 0.1394$, needs a trick from Calculus 3.)` },
          ],
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_{1}^{\infty} \frac{3}{x^4} \, dx$. ${DIVERGE_NOTE}`,
          answer: "1",
          explain: md`$\lim_{b \to \infty}\left[-\frac{1}{x^3}\right]_1^b = \lim_{b \to \infty}\left(-\frac{1}{b^3} + 1\right) = 1$. A $p$-integral with $p = 4 > 1$: the value is $3 \cdot \frac{1}{p - 1} = 1$.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_{0}^{4} \frac{1}{\sqrt{x}} \, dx$. ${DIVERGE_NOTE}`,
          answer: "4",
          explain: md`The integrand is infinite at $0$. $\lim_{t \to 0^+}\big[2\sqrt{x}\big]_t^4 = 2 \cdot 2 - 0 = 4$. Converges: $p = \frac12 < 1$ near zero.`,
        },
      ],
      practice: [infiniteInterval, infiniteIntegrand, comparisonAndTools],
    },
  ],
};
