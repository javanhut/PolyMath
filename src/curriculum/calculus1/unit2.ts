import { frac, fracTex, paren, poly, signed } from "../../math/random";
import { md, slug, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

const quad = (a: number, b: number, c: number) => poly([[a, "x^2"], [b, "x"], [c, ""]]);
const evalQuad = (a: number, b: number, c: number, x: number) => a * x * x + b * x + c;
/** A number for a plain-text verify equation: negatives in parentheses. */
const num = (n: number) => (n < 0 ? `(${n})` : String(n));
/** k/x as LaTeX, with the sign out front. */
const overX = (k: number, den = "x") => (k < 0 ? `-\\frac{${-k === 1 ? 1 : -k}}{${den}}` : `\\frac{${k}}{${den}}`);
/** "x - 2", "x + 1" or "x" for the shift x - c. */
const shiftOf = (c: number) => (c === 0 ? "x" : `x ${signed(-c)}`);
/** The visible y-range that fits a sampled function, with a little room. */
function yWindow(f: (x: number) => number, lo: number, hi: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= 40; i++) {
    const v = f(lo + ((hi - lo) * i) / 40);
    if (Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (max - min < 4) {
    const mid = (max + min) / 2;
    min = mid - 2;
    max = mid + 2;
  }
  return [Math.floor(min) - 1, Math.ceil(max) + 1];
}

// ── Lesson 1: Instantaneous rate of change ──────────────────────────────────

const averageRate: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.nonzero(-3, 3);
    const b = r.int(-6, 6);
    const c = r.int(-5, 5);
    const p = r.int(-3, 3);
    const q = p + r.int(1, 4);
    const fp = evalQuad(a, b, c, p);
    const fq = evalQuad(a, b, c, q);
    const m = a * (p + q) + b;
    return {
      prompt: md`Find the average rate of change of $f(x) = ${quad(a, b, c)}$ on the interval $[${p}, ${q}]$.`,
      answer: String(m),
      verify: [`m*(${num(q)} - ${num(p)}) = (${a}*${num(q)}^2 + ${num(b)}*${num(q)} + ${num(c)}) - (${a}*${num(p)}^2 + ${num(b)}*${num(p)} + ${num(c)})`],
      hint: md`The average rate of change is the slope of the secant line through $(${p}, f(${p}))$ and $(${q}, f(${q}))$: $\frac{f(${q}) - f(${p})}{${q} - ${paren(p)}}$.`,
      solution: [
        { math: md`f(${q}) = ${fq}, \qquad f(${p}) = ${fp}`, note: "Evaluate at both ends of the interval." },
        { math: md`\frac{f(${q}) - f(${p})}{${q} - ${paren(p)}} = \frac{${fq} ${signed(-fp)}}{${q - p}}`, note: "Change in output over change in input." },
        { math: md`= \frac{${fq - fp}}{${q - p}} = ${m}`, note: "A slope: output units per input unit." },
      ],
    };
  }
  if (kind === 1) {
    const b = r.int(-5, 5);
    const p = r.int(-2, 2);
    const q = p + r.int(1, 3);
    const f = (x: number) => x ** 3 + b * x;
    const m = q * q + p * q + p * p + b;
    return {
      prompt: md`Find the average rate of change of $f(x) = ${poly([[1, "x^3"], [b, "x"]])}$ on the interval $[${p}, ${q}]$.`,
      answer: String(m),
      verify: [`m*(${num(q)} - ${num(p)}) = (${num(q)}^3 + ${num(b)}*${num(q)}) - (${num(p)}^3 + ${num(b)}*${num(p)})`],
      hint: md`Compute $f(${q})$ and $f(${p})$, then divide their difference by the width of the interval, $${q} - ${paren(p)} = ${q - p}$.`,
      solution: [
        { math: md`f(${q}) = ${q}^3 ${signed(b * q)} = ${f(q)}, \qquad f(${p}) = ${paren(p)}^3 ${signed(b * p)} = ${f(p)}`, note: "Evaluate at both ends." },
        { math: md`\frac{${f(q)} ${signed(-f(p))}}{${q} - ${paren(p)}} = \frac{${f(q) - f(p)}}{${q - p}} = ${m}`, note: "Rise over run of the secant line." },
      ],
    };
  }
  const v0 = r.pick([48, 64, 80, 96]);
  const p = r.int(0, 2);
  const q = p + r.int(1, 2);
  const h = (t: number) => v0 * t - 16 * t * t;
  const m = v0 - 16 * (p + q);
  return {
    prompt: md`A ball is thrown straight up. Its height after $t$ seconds is $h(t) = ${v0}t - 16t^2$ feet. Find its average velocity over the time interval $[${p}, ${q}]$, in feet per second (type the number).`,
    answer: String(m),
    verify: [`m*(${q} - ${p}) = (${v0}*${q} - 16*${q}^2) - (${v0}*${p} - 16*${p}^2)`],
    hint: md`Average velocity is change in height over change in time: $\frac{h(${q}) - h(${p})}{${q} - ${p}}$.`,
    solution: [
      { math: md`h(${q}) = ${v0 * q} - ${16 * q * q} = ${h(q)}, \qquad h(${p}) = ${v0 * p} - ${16 * p * p} = ${h(p)}`, note: "Heights at the two moments." },
      { math: md`\frac{${h(q)} - ${h(p)}}{${q} - ${p}} = \frac{${h(q) - h(p)}}{${q - p}} = ${m}`, note: m < 0 ? "Negative: on average the ball is coming down during this stretch." : "Feet per second: the units of a rate are output units per input unit." },
    ],
  };
};

const differenceQuotientLimit: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const p = r.nonzero(-5, 6);
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{(${p} + h)^2 - ${p * p}}{h}$. Give the exact value.`,
      answer: String(2 * p),
      hint: md`Expand $(${p} + h)^2$. The $${p * p}$ cancels, and every term left has a factor of $h$.`,
      solution: [
        { math: md`\frac{${p * p} ${signed(2 * p)}h + h^2 - ${p * p}}{h}`, note: "Expand the square." },
        { math: md`= \frac{h(${2 * p} + h)}{h} = ${2 * p} + h`, note: md`Factor out $h$ and cancel. This is allowed because $h \ne 0$ inside a limit.` },
        { math: md`\lim_{h \to 0} (${2 * p} + h) = ${2 * p}`, note: md`Now letting $h \to 0$ is harmless. This is the slope of $y = x^2$ at $x = ${p}$.` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.nonzero(-6, 6);
    const p = r.nonzero(-4, 4);
    const fp = p * p + b * p;
    const m = 2 * p + b;
    const bPart = `${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(${p} + h)`;
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{(${p} + h)^2 ${bPart} ${fp === 0 ? "" : signed(-fp)}}{h}$. Give the exact value.`,
      answer: String(m),
      hint: md`This is the difference quotient of $f(x) = ${quad(1, b, 0)}$ at $x = ${p}$, where $f(${p}) = ${fp}$. Expand everything and the constants cancel.`,
      solution: [
        { math: md`\frac{${p * p} ${signed(2 * p)}h + h^2 ${signed(b * p)} ${signed(b)}h ${fp === 0 ? "" : signed(-fp)}}{h}`, note: "Expand the square and distribute." },
        { math: md`= \frac{${poly([[m, "h"], [1, "h^2"]])}}{h} = ${poly([[m, ""], [1, "h"]])}`, note: md`The constants add to 0. Factor out $h$ and cancel.` },
        { math: md`\lim_{h \to 0} (${poly([[m, ""], [1, "h"]])}) = ${m}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const p = r.nonzero(-3, 3);
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{(${p} + h)^3 ${signed(-p * p * p)}}{h}$. Give the exact value.`,
      answer: String(3 * p * p),
      hint: md`$(a + h)^3 = a^3 + 3a^2 h + 3a h^2 + h^3$. The $a^3$ cancels.`,
      solution: [
        { math: md`\frac{${p ** 3} ${signed(3 * p * p)}h ${signed(3 * p)}h^2 + h^3 ${signed(-(p ** 3))}}{h}`, note: "Expand the cube." },
        { math: md`= \frac{h(${3 * p * p} ${signed(3 * p)}h + h^2)}{h} = ${3 * p * p} ${signed(3 * p)}h + h^2`, note: md`Every surviving term has a factor $h$.` },
        { math: md`\lim_{h \to 0} (${3 * p * p} ${signed(3 * p)}h + h^2) = ${3 * p * p}`, note: md`The slope of $y = x^3$ at $x = ${p}$.` },
      ],
    };
  }
  if (kind === 3) {
    const p = r.nonzero(-4, 4);
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{\frac{1}{${p} + h} - \frac{1}{${p}}}{h}$. Give the exact value, as a fraction if needed.`,
      answer: frac(-1, p * p),
      hint: md`Combine the two fractions over the common denominator $${p}(${p} + h)$ first.`,
      solution: [
        { math: md`\frac{1}{${p} + h} - \frac{1}{${p}} = \frac{${p} - (${p} + h)}{${p}(${p} + h)} = \frac{-h}{${p}(${p} + h)}`, note: "Common denominator." },
        { math: md`\frac{-h}{${p}(${p} + h)} \cdot \frac{1}{h} = \frac{-1}{${p}(${p} + h)}`, note: md`Dividing by $h$ cancels the $h$ on top.` },
        { math: md`\lim_{h \to 0} \frac{-1}{${p}(${p} + h)} = \frac{-1}{${p} \cdot ${p}} = ${fracTex(-1, p * p)}`, note: md`The slope of $y = \frac1x$ at $x = ${p}$. Negative, because $\frac1x$ is falling there.` },
      ],
    };
  }
  const s = r.int(1, 5);
  const p = s * s;
  return {
    prompt: md`Find $\lim_{h \to 0} \frac{\sqrt{${p} + h} - ${s}}{h}$. Give the exact value, as a fraction if needed.`,
    answer: frac(1, 2 * s),
    hint: md`Multiply top and bottom by the conjugate $\sqrt{${p} + h} + ${s}$.`,
    solution: [
      { math: md`\frac{\sqrt{${p} + h} - ${s}}{h} \cdot \frac{\sqrt{${p} + h} + ${s}}{\sqrt{${p} + h} + ${s}} = \frac{(${p} + h) - ${p}}{h(\sqrt{${p} + h} + ${s})}`, note: md`$(u - v)(u + v) = u^2 - v^2$ clears the root on top.` },
      { math: md`= \frac{h}{h(\sqrt{${p} + h} + ${s})} = \frac{1}{\sqrt{${p} + h} + ${s}}`, note: md`Cancel $h$.` },
      { math: md`\lim_{h \to 0} \frac{1}{\sqrt{${p} + h} + ${s}} = \frac{1}{${s} + ${s}} = ${fracTex(1, 2 * s)}`, note: md`The slope of $y = \sqrt{x}$ at $x = ${p}$.` },
    ],
  };
};

const instantaneousRateWord: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.int(1, 4);
    const b = r.int(0, 10);
    const p = r.int(1, 5);
    const v = 2 * a * p + b;
    const sp = a * p * p + b * p;
    return {
      prompt: md`A cart rolls along a track. After $t$ seconds its position is $s(t) = ${poly([[a, "t^2"], [b, "t"]])}$ meters. Find its instantaneous velocity at $t = ${p}$, in meters per second (type the number).`,
      answer: String(v),
      hint: md`Velocity at an instant is the limit of average velocities: $\lim_{h \to 0} \frac{s(${p} + h) - s(${p})}{h}$. Expand, cancel $h$, then let $h \to 0$.`,
      solution: [
        { math: md`s(${p}) = ${sp}`, note: "The position at the instant in question." },
        { math: md`\frac{s(${p} + h) - s(${p})}{h} = \frac{${a}(${p} + h)^2 ${b ? signed(b) + `(${p} + h)` : ""} - ${sp}}{h}`, note: "The average velocity over a short interval of length h." },
        { math: md`= \frac{${poly([[v, "h"], [a, "h^2"]])}}{h} = ${poly([[v, ""], [a, "h"]])}`, note: md`Expand: the constants cancel, since $s(${p} + h) - s(${p})$ must be 0 when $h = 0$. Then cancel the $h$.` },
        { math: md`\lim_{h \to 0} (${poly([[v, ""], [a, "h"]])}) = ${v}`, note: "Meters per second." },
      ],
    };
  }
  if (kind === 1) {
    const v0 = r.pick([48, 64, 80, 96]);
    const p = r.int(1, 4);
    const v = v0 - 32 * p;
    const hp = v0 * p - 16 * p * p;
    return {
      prompt: md`A ball is thrown straight up. Its height after $t$ seconds is $h(t) = ${v0}t - 16t^2$ feet. Find its instantaneous velocity at $t = ${p}$, in feet per second (type the number).`,
      answer: String(v),
      hint: md`Form $\frac{h(${p} + k) - h(${p})}{k}$ for a small time step $k$, simplify until $k$ cancels, then let $k \to 0$.`,
      solution: [
        { math: md`h(${p}) = ${v0 * p} - ${16 * p * p} = ${hp}`, note: "Height at the instant." },
        { math: md`\frac{h(${p} + k) - h(${p})}{k} = \frac{${v0}(${p} + k) - 16(${p} + k)^2 - ${hp}}{k}`, note: md`Average velocity over $[${p}, ${p} + k]$. (The step is called $k$ here because $h$ is the height.)` },
        { math: md`= \frac{${poly([[v, "k"], [-16, "k^2"]])}}{k} = ${poly([[v, ""], [-16, "k"]])}`, note: "Expand, cancel the constants, divide out k." },
        { math: md`\lim_{k \to 0} (${poly([[v, ""], [-16, "k"]])}) = ${v}`, note: v < 0 ? "Negative: the ball is already falling at this instant." : v === 0 ? "Zero: the ball is at the top of its flight, momentarily still." : "Positive: the ball is still rising." },
      ],
    };
  }
  const P0 = r.pick([200, 500, 1000]);
  const k = r.int(2, 6);
  const p = r.int(1, 5);
  const rate = 2 * k * p;
  return {
    prompt: md`A town's population $t$ years from now is modelled by $P(t) = ${P0} + ${k}t^2$. Find the instantaneous rate of growth at $t = ${p}$, in people per year (type the number).`,
    answer: String(rate),
    hint: md`Work out $\frac{P(${p} + h) - P(${p})}{h}$; the $${P0}$ cancels at once.`,
    solution: [
      { math: md`\frac{P(${p} + h) - P(${p})}{h} = \frac{${k}(${p} + h)^2 - ${k * p * p}}{h}`, note: md`The constant ${P0} appears in both and cancels.` },
      { math: md`= \frac{${rate}h + ${k}h^2}{h} = ${rate} + ${k}h`, note: md`$${k}(${p} + h)^2 = ${k * p * p} + ${rate}h + ${k}h^2$.` },
      { math: md`\lim_{h \to 0} (${rate} + ${k}h) = ${rate}`, note: "People per year, at that instant." },
    ],
  };
};

// ── Lesson 2: The derivative as a limit ─────────────────────────────────────

const LEAD = "Use the definition of the derivative to find";

const derivativeAtPoint: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.nonzero(-3, 3);
    const b = r.int(-5, 5);
    const c = r.int(-5, 5);
    const p = r.int(-3, 3);
    const fp = evalQuad(a, b, c, p);
    const m = 2 * a * p + b;
    const bPart = b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(${p} + h)`;
    const cPart = c === 0 ? "" : ` ${signed(c)}`;
    return {
      prompt: md`${LEAD} $f'(x)$ when $f(x) = ${quad(a, b, c)}$ and $x = ${p}$. (That is, find $f'(${p})$.)`,
      answer: String(m),
      hint: md`$f'(${p}) = \lim_{h \to 0} \frac{f(${p} + h) - f(${p})}{h}$, and $f(${p}) = ${fp}$. Expand, cancel, take the limit.`,
      solution: [
        { math: md`\frac{f(${p} + h) - f(${p})}{h} = \frac{${a === 1 ? "" : a === -1 ? "-" : a}(${p} + h)^2${bPart}${cPart} - ${paren(fp)}}{h}`, note: md`Set up the difference quotient with $f(${p}) = ${fp}$.` },
        { math: md`= \frac{${poly([[m, "h"], [a, "h^2"]])}}{h}`, note: md`Expand. The constant terms cancel, as they must: $f(${p} + h) - f(${p})$ is 0 when $h = 0$.` },
        { math: md`= ${poly([[m, ""], [a, "h"]])}`, note: md`Cancel the $h$ ($h \ne 0$).` },
        { math: md`f'(${p}) = \lim_{h \to 0} (${poly([[m, ""], [a, "h"]])}) = ${m}`, note: "The slope of the tangent line there." },
      ],
    };
  }
  if (kind === 1) {
    const k = r.nonzero(-6, 6);
    const p = r.nonzero(-4, 4);
    return {
      prompt: md`${LEAD} $f'(x)$ when $f(x) = ${overX(k)}$ and $x = ${p}$. Give the exact value, as a fraction if needed.`,
      answer: frac(-k, p * p),
      hint: md`Write $f(${p} + h) - f(${p})$ as a single fraction over $${p}(${p} + h)$; the numerator will be a multiple of $h$.`,
      solution: [
        { math: md`\frac{f(${p} + h) - f(${p})}{h} = \frac{1}{h}\left(\frac{${k}}{${p} + h} - \frac{${k}}{${p}}\right)`, note: "The difference quotient." },
        { math: md`= \frac{1}{h} \cdot \frac{${k} \cdot ${paren(p)} - ${paren(k)}(${p} + h)}{${p}(${p} + h)} = \frac{1}{h} \cdot \frac{${-k}h}{${p}(${p} + h)}`, note: "Common denominator; the constant parts cancel on top." },
        { math: md`= \frac{${-k}}{${p}(${p} + h)}`, note: md`Cancel $h$.` },
        { math: md`f'(${p}) = \lim_{h \to 0} \frac{${-k}}{${p}(${p} + h)} = \frac{${-k}}{${p * p}} = ${fracTex(-k, p * p)}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const s = r.int(1, 5);
    const p = s * s;
    return {
      prompt: md`${LEAD} $f'(x)$ when $f(x) = \sqrt{x}$ and $x = ${p}$. Give the exact value, as a fraction if needed.`,
      answer: frac(1, 2 * s),
      hint: md`Multiply the difference quotient top and bottom by $\sqrt{${p} + h} + ${s}$.`,
      solution: [
        { math: md`\frac{\sqrt{${p} + h} - ${s}}{h} \cdot \frac{\sqrt{${p} + h} + ${s}}{\sqrt{${p} + h} + ${s}} = \frac{(${p} + h) - ${p}}{h(\sqrt{${p} + h} + ${s})}`, note: "Rationalize the numerator." },
        { math: md`= \frac{1}{\sqrt{${p} + h} + ${s}}`, note: md`The numerator is just $h$; cancel it.` },
        { math: md`f'(${p}) = \frac{1}{\sqrt{${p}} + ${s}} = ${fracTex(1, 2 * s)}`, note: md`Letting $h \to 0$ inside the root is fine: $\sqrt{x}$ is continuous.` },
      ],
    };
  }
  const c = r.int(-5, 5);
  const p = r.nonzero(-3, 3);
  return {
    prompt: md`${LEAD} $f'(x)$ when $f(x) = ${poly([[1, "x^3"], [c, ""]])}$ and $x = ${p}$.`,
    answer: String(3 * p * p),
    hint: md`Expand $(${p} + h)^3 = ${p ** 3} ${signed(3 * p * p)}h ${signed(3 * p)}h^2 + h^3$. The constant ${c ? `and the ${c} ` : ""}cancel.`,
    solution: [
      { math: md`\frac{f(${p} + h) - f(${p})}{h} = \frac{(${p} + h)^3 ${c ? signed(c) : ""} - ${paren(p ** 3 + c)}}{h}`, note: md`$f(${p}) = ${p ** 3 + c}$.` },
      { math: md`= \frac{${3 * p * p}h ${signed(3 * p)}h^2 + h^3}{h} = ${3 * p * p} ${signed(3 * p)}h + h^2`, note: "Expand the cube, cancel the constants, divide by h." },
      { math: md`f'(${p}) = \lim_{h \to 0}(${3 * p * p} ${signed(3 * p)}h + h^2) = ${3 * p * p}`, note: "" },
    ],
  };
};

const derivativeFunctionFromDefinition: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.nonzero(-3, 3);
    const b = r.int(-5, 5);
    const c = r.int(-5, 5);
    const ans = poly([[2 * a, "x"], [b, ""]]);
    const bPart = b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}(x + h)`;
    return {
      prompt: md`${LEAD} $f'(x)$ when $f(x) = ${quad(a, b, c)}$. Type an expression in $x$.`,
      answer: ans,
      hint: md`Write $f(x + h)$ by replacing every $x$ with $(x + h)$, subtract $f(x)$, and expand. Everything without an $h$ cancels.`,
      solution: [
        { math: md`f(x + h) - f(x) = ${a === 1 ? "" : a === -1 ? "-" : a}(x + h)^2${bPart} ${c ? signed(c) : ""} - (${quad(a, b, c)})`, note: "Same formula, input x + h." },
        { math: md`= ${poly([[2 * a, "xh"], [a, "h^2"], [b, "h"]])}`, note: md`Expand $(x + h)^2 = x^2 + 2xh + h^2$. The $x^2$, $x$ and constant terms all cancel.` },
        { math: md`\frac{f(x + h) - f(x)}{h} = ${poly([[2 * a, "x"], [a, "h"], [b, ""]])}`, note: md`Every term had a factor $h$; divide it out.` },
        { math: md`f'(x) = \lim_{h \to 0} (${poly([[2 * a, "x"], [a, "h"], [b, ""]])}) = ${ans}`, note: md`Only the term with $h$ disappears.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.nonzero(-6, 6);
    return {
      prompt: md`${LEAD} $f'(x)$ when $f(x) = ${overX(k)}$. Type an expression in $x$.`,
      answer: `(${-k})/x^2`,
      hint: md`Combine $\frac{${k}}{x + h} - \frac{${k}}{x}$ over the common denominator $x(x + h)$.`,
      solution: [
        { math: md`\frac{${k}}{x + h} - \frac{${k}}{x} = \frac{${k}x - ${k}(x + h)}{x(x + h)} = \frac{${-k}h}{x(x + h)}`, note: "Common denominator." },
        { math: md`\frac{f(x + h) - f(x)}{h} = \frac{${-k}}{x(x + h)}`, note: md`Divide by $h$: it cancels the $h$ on top.` },
        { math: md`f'(x) = \lim_{h \to 0} \frac{${-k}}{x(x + h)} = \frac{${-k}}{x^2}`, note: md`Defined for every $x \ne 0$, like $f$ itself.` },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`${LEAD} $f'(x)$ when $f(x) = \sqrt{x}$. Type an expression in $x$.`,
      answer: "1/(2sqrt(x))",
      hint: md`Multiply top and bottom of $\frac{\sqrt{x + h} - \sqrt{x}}{h}$ by $\sqrt{x + h} + \sqrt{x}$.`,
      solution: [
        { math: md`\frac{\sqrt{x + h} - \sqrt{x}}{h} \cdot \frac{\sqrt{x + h} + \sqrt{x}}{\sqrt{x + h} + \sqrt{x}} = \frac{(x + h) - x}{h(\sqrt{x + h} + \sqrt{x})}`, note: "Rationalize the numerator." },
        { math: md`= \frac{1}{\sqrt{x + h} + \sqrt{x}}`, note: md`The top is $h$; cancel.` },
        { math: md`f'(x) = \frac{1}{\sqrt{x} + \sqrt{x}} = \frac{1}{2\sqrt{x}}`, note: md`Valid for $x > 0$. At $x = 0$ the quotient blows up: more on that in Lesson 4.` },
      ],
    };
  }
  const c = r.int(-5, 5);
  return {
    prompt: md`${LEAD} $f'(x)$ when $f(x) = ${poly([[1, "x^3"], [c, ""]])}$. Type an expression in $x$.`,
    answer: "3x^2",
    hint: md`$(x + h)^3 = x^3 + 3x^2 h + 3x h^2 + h^3$.`,
    solution: [
      { math: md`f(x + h) - f(x) = (x + h)^3 ${c ? signed(c) : ""} - x^3 ${c ? signed(-c) : ""} = 3x^2 h + 3x h^2 + h^3`, note: md`The $x^3$ terms cancel${c ? ", and so do the constants" : ""}.` },
      { math: md`\frac{f(x + h) - f(x)}{h} = 3x^2 + 3xh + h^2`, note: md`Divide each term by $h$.` },
      { math: md`f'(x) = \lim_{h \to 0} (3x^2 + 3xh + h^2) = 3x^2`, note: "" },
    ],
  };
};

const tangentLine: Generator = (r) => {
  const kind = r.int(0, 2);
  const ask = "Type the right side only, in the form $mx + b$.";
  if (kind === 0) {
    for (;;) {
      const a = r.nonzero(-2, 2);
      const b = r.int(-5, 5);
      const c = r.int(-4, 4);
      const p = r.int(-3, 3);
      const m = 2 * a * p + b;
      if (m === 0) continue;
      const fp = evalQuad(a, b, c, p);
      const k = fp - m * p;
      return {
        prompt: md`Find the equation of the tangent line to $y = ${quad(a, b, c)}$ at $x = ${p}$. ${ask}`,
        answer: poly([[m, "x"], [k, ""]]),
        verify: [`${a}*x^2 + ${num(b)}*x + ${num(c)} - L = ${a}*(x - ${num(p)})^2`],
        hint: md`You need a point and a slope. The point is $(${p}, f(${p}))$; the slope is $f'(${p})$, found from the definition. Then use point-slope form.`,
        solution: [
          { math: md`f(${p}) = ${fp}`, note: "The point of tangency is " + md`$(${p}, ${fp})$.` },
          { math: md`\frac{f(${p} + h) - f(${p})}{h} = \frac{${poly([[m, "h"], [a, "h^2"]])}}{h} = ${poly([[m, ""], [a, "h"]])}`, note: "Expand the difference quotient and cancel h (the constant terms cancel)." },
          { math: md`f'(${p}) = \lim_{h \to 0} (${poly([[m, ""], [a, "h"]])}) = ${m}`, note: "The slope of the tangent line." },
          { math: md`y - ${paren(fp)} = ${m}(x - ${paren(p)})`, note: "Point-slope form." },
          { math: md`y = ${poly([[m, "x"], [k, ""]])}`, note: md`Check: at $x = ${p}$ this gives $${fp}$, the right height.` },
        ],
      };
    }
  }
  if (kind === 1) {
    const p = r.nonzero(-4, 4);
    const fp = frac(1, p);
    const b2 = frac(2, p);
    return {
      prompt: md`Find the equation of the tangent line to $y = \frac{1}{x}$ at $x = ${p}$. ${ask} (Fractions like 1/4 are fine.)`,
      answer: `(${frac(-1, p * p)})x ${b2.startsWith("-") ? `- ${b2.slice(1)}` : `+ ${b2}`}`,
      verify: [`1/x - L = (x - ${num(p)})^2/(${p * p}*x)`],
      hint: md`The point is $(${p}, ${fracTex(1, p)})$. The slope is $f'(${p})$: combine $\frac{1}{${p} + h} - \frac{1}{${p}}$ over a common denominator, divide by $h$, let $h \to 0$.`,
      solution: [
        { math: md`f(${p}) = ${fracTex(1, p)}`, note: "The point of tangency." },
        { math: md`\frac{1}{h}\left(\frac{1}{${p} + h} - \frac{1}{${p}}\right) = \frac{1}{h} \cdot \frac{-h}{${p}(${p} + h)} = \frac{-1}{${p}(${p} + h)}`, note: "Common denominator, then cancel h." },
        { math: md`f'(${p}) = \lim_{h \to 0} \frac{-1}{${p}(${p} + h)} = ${fracTex(-1, p * p)}`, note: "The slope." },
        { math: md`y - ${fracTex(1, p)} = ${fracTex(-1, p * p)}(x - ${paren(p)})`, note: "Point-slope form." },
        { math: md`y = ${fracTex(-1, p * p)}x ${p > 0 ? "+" : "-"} ${fracTex(2, Math.abs(p))}`, note: md`Distribute: $${fracTex(-1, p * p)} \cdot (${-p}) = ${fracTex(1, p)}$, plus the $${fpTexPlain(fp)}$ already there, gives $${fracTex(2, p)}$.` },
      ],
    };
  }
  const k = r.int(-4, 4);
  const p = r.nonzero(-2, 2);
  const m = 3 * p * p;
  const fp = p ** 3 + k;
  const b = fp - m * p;
  return {
    prompt: md`Find the equation of the tangent line to $y = ${poly([[1, "x^3"], [k, ""]])}$ at $x = ${p}$. ${ask}`,
    answer: poly([[m, "x"], [b, ""]]),
    verify: [`x^3 + ${num(k)} - L = (x - ${num(p)})^2*(x + ${num(2 * p)})`],
    hint: md`The point is $(${p}, ${fp})$. For the slope, expand $(${p} + h)^3$ in the difference quotient.`,
    solution: [
      { math: md`f(${p}) = ${paren(p)}^3 ${k ? signed(k) : ""} = ${fp}`, note: "The point of tangency." },
      { math: md`\frac{f(${p} + h) - f(${p})}{h} = \frac{${m}h ${signed(3 * p)}h^2 + h^3}{h} = ${m} ${signed(3 * p)}h + h^2`, note: "Expand the cube; constants cancel; divide by h." },
      { math: md`f'(${p}) = ${m}`, note: md`Let $h \to 0$.` },
      { math: md`y - ${paren(fp)} = ${m}(x - ${paren(p)})`, note: "Point-slope form." },
      { math: md`y = ${poly([[m, "x"], [b, ""]])}`, note: md`Interesting: this line crosses the cubic again at $x = ${-2 * p}$. A tangent line can cross the curve elsewhere; what makes it tangent is the slope at $x = ${p}$.` },
    ],
  };
};

/** "1/4" as LaTeX for the note above (the fraction text is already reduced). */
function fpTexPlain(text: string): string {
  const [n, d] = text.split("/");
  return d ? fracTex(Number(n), Number(d)) : text;
}

// ── Lesson 3: The derivative as a function ──────────────────────────────────

const polynomialDerivative: Generator = (r) => {
  const cubic = r.next() < 0.6;
  const a = cubic ? r.nonzero(-3, 3) : 0;
  const b = cubic ? r.int(-4, 4) : r.nonzero(-4, 4);
  const c = r.int(-6, 6);
  const d = r.int(-5, 5);
  const f = poly([[a, "x^3"], [b, "x^2"], [c, "x"], [d, ""]]);
  const ans = poly([[3 * a, "x^2"], [2 * b, "x"], [c, ""]]);
  const pieces: string[] = [];
  if (a) pieces.push(`${a === 1 ? "" : a === -1 ? "-" : a} \\cdot \\frac{(x + h)^3 - x^3}{h}`);
  if (b) pieces.push(`${b === 1 ? "" : b === -1 ? "-" : b} \\cdot \\frac{(x + h)^2 - x^2}{h}`);
  if (c) pieces.push(`${c === 1 ? "" : c === -1 ? "-" : c} \\cdot \\frac{(x + h) - x}{h}`);
  if (d) pieces.push(`\\frac{${d} - ${paren(d)}}{h}`);
  const sum = pieces.join(" + ").replace(/\+ -/g, "- ");
  return {
    prompt: md`Find $f'(x)$ when $f(x) = ${f}$.`,
    answer: ans,
    hint: md`Split $f(x + h) - f(x)$ term by term. Each power has its own difference quotient, and the lesson worked out the limits: $x^3 \to 3x^2$, $x^2 \to 2x$, $x \to 1$, constant $\to 0$.`,
    solution: [
      { math: md`\frac{f(x + h) - f(x)}{h} = ${sum}`, note: "Regroup the difference term by term. Each term's coefficient factors out of its own difference." },
      { math: md`\lim_{h \to 0} \frac{(x + h)^3 - x^3}{h} = 3x^2, \quad \lim_{h \to 0} \frac{(x + h)^2 - x^2}{h} = 2x, \quad \lim_{h \to 0} \frac{(x + h) - x}{h} = 1`, note: md`The limits from the lesson. A constant's difference is $0$ for every $h$.` },
      { math: md`f'(x) = ${ans}`, note: "Multiply each limit by its coefficient and add: the sum and constant-multiple limit laws from Unit 1." },
    ],
  };
};

const leibnizDerivative: Generator = (r) => {
  const kind = r.int(0, 4);
  const ask = "Type an expression in $x$.";
  if (kind === 0) {
    const k = r.nonzero(-5, 5);
    const c = r.nonzero(-4, 4);
    const sh = `x ${signed(c)}`;
    return {
      prompt: md`Find $\frac{dy}{dx}$ when $y = ${overX(k, sh)}$. ${ask}`,
      answer: `(${-k})/(${sh})^2`,
      hint: md`Same as $\frac{${k}}{x}$ but shifted. Combine $\frac{${k}}{${sh} + h} - \frac{${k}}{${sh}}$ over a common denominator.`,
      solution: [
        { math: md`\frac{${k}}{(${sh}) + h} - \frac{${k}}{${sh}} = \frac{${k}(${sh}) - ${k}(${sh} + h)}{(${sh})(${sh} + h)} = \frac{${-k}h}{(${sh})(${sh} + h)}`, note: "Common denominator; everything but the h-term cancels on top." },
        { math: md`\frac{\Delta y}{\Delta x} = \frac{${-k}}{(${sh})(${sh} + h)}`, note: md`Divide by $h$.` },
        { math: md`\frac{dy}{dx} = \lim_{h \to 0} \frac{${-k}}{(${sh})(${sh} + h)} = \frac{${-k}}{(${sh})^2}`, note: md`Undefined at $x = ${-c}$, where $y$ itself is undefined.` },
      ],
    };
  }
  if (kind === 1) {
    const c = r.nonzero(-4, 4);
    const sh = `x ${signed(c)}`;
    return {
      prompt: md`Find $\frac{dy}{dx}$ when $y = \sqrt{${sh}}$. ${ask}`,
      answer: `1/(2sqrt(${sh}))`,
      hint: md`Rationalize: multiply $\frac{\sqrt{${sh} + h} - \sqrt{${sh}}}{h}$ top and bottom by $\sqrt{${sh} + h} + \sqrt{${sh}}$.`,
      solution: [
        { math: md`\frac{\sqrt{${sh} + h} - \sqrt{${sh}}}{h} \cdot \frac{\sqrt{${sh} + h} + \sqrt{${sh}}}{\sqrt{${sh} + h} + \sqrt{${sh}}} = \frac{h}{h\left(\sqrt{${sh} + h} + \sqrt{${sh}}\right)}`, note: md`$(u - v)(u + v) = u^2 - v^2$; the top becomes $(${sh} + h) - (${sh}) = h$.` },
        { math: md`= \frac{1}{\sqrt{${sh} + h} + \sqrt{${sh}}}`, note: "Cancel h." },
        { math: md`\frac{dy}{dx} = \frac{1}{2\sqrt{${sh}}}`, note: md`Let $h \to 0$. Defined for $x > ${-c}$.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.nonzero(-4, 4);
    return {
      prompt: md`Find $\frac{dy}{dx}$ when $y = ${overX(k, "x^2")}$. ${ask}`,
      answer: `(${-2 * k})/x^3`,
      hint: md`Combine $\frac{${k}}{(x + h)^2} - \frac{${k}}{x^2}$ over $x^2(x + h)^2$. The numerator becomes $${k}\left(x^2 - (x + h)^2\right)$.`,
      solution: [
        { math: md`\frac{${k}}{(x + h)^2} - \frac{${k}}{x^2} = \frac{${k}\left(x^2 - (x + h)^2\right)}{x^2 (x + h)^2} = \frac{${k}(-2xh - h^2)}{x^2 (x + h)^2}`, note: "Common denominator and expand the top." },
        { math: md`\frac{\Delta y}{\Delta x} = \frac{${-k}(2x + h)}{x^2(x + h)^2}`, note: md`Divide by $h$: the top had a factor $h$.` },
        { math: md`\frac{dy}{dx} = \frac{${-k}(2x)}{x^2 \cdot x^2} = \frac{${-2 * k}}{x^3}`, note: md`Let $h \to 0$, then cancel one $x$.` },
      ],
    };
  }
  if (kind === 3) {
    const m = r.nonzero(-5, 5);
    const b = r.int(-6, 6);
    return {
      prompt: md`Find $\frac{dy}{dx}$ when $y = ${poly([[m, "x"], [b, ""]])}$.`,
      answer: String(m),
      hint: "A line is its own tangent line everywhere. What is its slope?",
      solution: [
        { math: md`\frac{\Delta y}{\Delta x} = \frac{${m === 1 ? "" : m === -1 ? "-" : m}(x + h) ${b ? signed(b) : ""} - (${poly([[m, "x"], [b, ""]])})}{h} = \frac{${m}h}{h} = ${m}`, note: "Every secant of a line has the line's own slope." },
        { math: md`\frac{dy}{dx} = \lim_{h \to 0} ${m} = ${m}`, note: "The limit of a constant is that constant." },
      ],
    };
  }
  const k = r.pick([2, 3, 4, 6, -2, -4]);
  return {
    prompt: md`Find $\frac{dy}{dx}$ when $y = ${k}\sqrt{x}$. ${ask}`,
    answer: `${k}/(2sqrt(x))`,
    hint: md`The ${k} factors out of the difference quotient: $\frac{${k}\sqrt{x + h} - ${k}\sqrt{x}}{h} = ${k} \cdot \frac{\sqrt{x + h} - \sqrt{x}}{h}$.`,
    solution: [
      { math: md`\frac{\Delta y}{\Delta x} = ${k} \cdot \frac{\sqrt{x + h} - \sqrt{x}}{h} = ${k} \cdot \frac{1}{\sqrt{x + h} + \sqrt{x}}`, note: "Factor out the constant, then rationalize as in the lesson." },
      { math: md`\frac{dy}{dx} = ${k} \cdot \frac{1}{2\sqrt{x}} = \frac{${k}}{2\sqrt{x}}`, note: md`A constant multiple scales every secant slope, so it scales the limit (constant-multiple law).` },
    ],
  };
};

const horizontalTangent: Generator = (r) => {
  const kind = r.int(0, 6);
  const plotOf = (expr: string, f: (x: number) => number, lo: number, hi: number): Figure => ({
    kind: "plot",
    x: [lo, hi],
    y: yWindow(f, lo, hi),
    curves: [{ expr, label: `y = f(x)` }],
  });
  if (kind <= 1) {
    const a = r.nonzero(-2, 2);
    const b = r.nonzero(-6, 6);
    const c = r.int(-4, 4);
    const x0 = frac(-b, 2 * a);
    const v = -b / (2 * a);
    return {
      prompt: md`Find every $x$ where the graph of $f(x) = ${quad(a, b, c)}$ has a horizontal tangent line. Separate several values with commas; type none if there are none.`,
      answer: x0,
      form: "set",
      verify: [`${2 * a}*x + ${num(b)} = 0`],
      figure: plotOf(quad(a, b, c), (x) => evalQuad(a, b, c, x), Math.floor(v) - 3, Math.ceil(v) + 3),
      hint: md`A horizontal tangent has slope 0. Find $f'(x)$ (from the definition, or term by term) and solve $f'(x) = 0$.`,
      solution: [
        { math: md`f'(x) = ${poly([[2 * a, "x"], [b, ""]])}`, note: md`The quadratic's derivative, term by term: $x^2 \to 2x$, $x \to 1$, constant $\to 0$.` },
        { math: md`${poly([[2 * a, "x"], [b, ""]])} = 0 \;\Rightarrow\; x = ${fracTex(-b, 2 * a)}`, note: "Set the slope to zero and solve." },
        { math: md`x = ${fracTex(-b, 2 * a)}`, note: "The vertex of the parabola, where it turns around. One horizontal tangent." },
      ],
    };
  }
  if (kind <= 3) {
    const p = r.int(1, 3);
    const c = r.int(-3, 3);
    const f = poly([[1, "x^3"], [-3 * p * p, "x"], [c, ""]]);
    return {
      prompt: md`Find every $x$ where the graph of $f(x) = ${f}$ has a horizontal tangent line. Separate several values with commas; type none if there are none.`,
      answer: `-${p}, ${p}`,
      form: "set",
      verify: [`3*x^2 - ${3 * p * p} = 0`],
      figure: plotOf(f, (x) => x ** 3 - 3 * p * p * x + c, -p - 2, p + 2),
      hint: md`Find $f'(x)$ term by term ($x^3 \to 3x^2$, $x \to 1$) and solve $f'(x) = 0$. Expect two answers.`,
      solution: [
        { math: md`f'(x) = 3x^2 - ${3 * p * p}`, note: "Term by term, using the limits from the lesson." },
        { math: md`3x^2 - ${3 * p * p} = 0 \;\Rightarrow\; x^2 = ${p * p}`, note: "Set the slope to zero." },
        { math: md`x = -${p} \text{ or } x = ${p}`, note: "The two turning points on the graph: a hilltop and a valley." },
      ],
    };
  }
  if (kind <= 5) {
    const m = r.nonzero(-2, 2);
    const c = r.int(-3, 3);
    const f = poly([[1, "x^3"], [-3 * m, "x^2"], [c, ""]]);
    const lo = Math.min(0, 2 * m) - 2;
    const hi = Math.max(0, 2 * m) + 2;
    return {
      prompt: md`Find every $x$ where the graph of $f(x) = ${f}$ has a horizontal tangent line. Separate several values with commas; type none if there are none.`,
      answer: `0, ${2 * m}`,
      form: "set",
      verify: [`3*x^2 + ${num(-6 * m)}*x = 0`],
      figure: plotOf(f, (x) => x ** 3 - 3 * m * x * x + c, lo, hi),
      hint: md`$f'(x) = 3x^2 ${signed(-6 * m)}x$. Factor it before solving.`,
      solution: [
        { math: md`f'(x) = 3x^2 ${signed(-6 * m)}x`, note: md`Term by term: $x^3 \to 3x^2$, $x^2 \to 2x$, constant $\to 0$.` },
        { math: md`3x(x ${signed(-2 * m)}) = 0`, note: "Factor out the common 3x." },
        { math: md`x = 0 \text{ or } x = ${2 * m}`, note: "Two horizontal tangents. Check them against the graph." },
      ],
    };
  }
  const p = r.int(1, 3);
  const c = r.int(-3, 3);
  const f = poly([[1, "x^3"], [3 * p * p, "x"], [c, ""]]);
  return {
    prompt: md`Find every $x$ where the graph of $f(x) = ${f}$ has a horizontal tangent line. Separate several values with commas; type none if there are none.`,
    accept: ["none"],
    figure: plotOf(f, (x) => x ** 3 + 3 * p * p * x + c, -2, 2),
    hint: md`$f'(x) = 3x^2 + ${3 * p * p}$. Can that ever be 0?`,
    solution: [
      { math: md`f'(x) = 3x^2 + ${3 * p * p}`, note: "Term by term." },
      { math: md`3x^2 + ${3 * p * p} \ge ${3 * p * p} > 0`, note: md`A square is never negative, so $f'(x)$ is always at least ${3 * p * p}.` },
      { math: md`\text{No horizontal tangent.}`, note: "The graph climbs everywhere; its slope never reaches 0." },
    ],
  };
};

// ── Lesson 4: Differentiability ─────────────────────────────────────────────

const DIFF_CHOICES = ["Yes: differentiable there", "No: a corner or cusp", "No: a vertical tangent", "No: not continuous there"];

const differentiableAt: Generator = (r) => {
  const c = r.int(-2, 2);
  const k = r.int(-2, 2);
  const kind = r.int(0, 7);
  const sh = shiftOf(c);
  const grp = c === 0 ? "x" : `(${sh})`;
  const plus = k === 0 ? "" : ` ${signed(k)}`;
  const quotient = md`$\frac{f(${c} + h) - f(${c})}{h}$`;
  const plain = (tex: string, expr: string, f: (x: number) => number): Figure => ({
    kind: "plot",
    x: [c - 3, c + 3],
    y: yWindow(f, c - 3, c + 3),
    curves: [{ expr, label: `y = ${tex}` }],
    points: [{ x: c, y: f(c), color: 2 }],
  });
  const problem = (tex: string, figure: Figure, choice: number, hint: string, solution: Step[]) => ({
    prompt: md`Is $f$ differentiable at $x = ${c}$? Its graph is shown.

$$f(x) = ${tex}$$`,
    choices: DIFF_CHOICES,
    accept: [DIFF_CHOICES[choice]!],
    figure,
    hint,
    solution,
  });
  if (kind === 0) {
    const tex = `|${sh}|${plus}`;
    return problem(tex, plain(tex, `abs(${sh})${plus}`, (x) => Math.abs(x - c) + k), 1, md`Compute the difference quotient from each side separately. For $h > 0$, $|h| = h$; for $h < 0$, $|h| = -h$.`, [
      { math: md`\frac{f(${c} + h) - f(${c})}{h} = \frac{|h| ${plus} - ${paren(k)}}{h} = \frac{|h|}{h}`, note: md`At $x = ${c} + h$ the inside of the absolute value is just $h$.` },
      { math: md`h > 0: \frac{h}{h} = 1 \qquad h < 0: \frac{-h}{h} = -1`, note: "The two one-sided limits are 1 and -1." },
      { math: md`\text{No two-sided limit: not differentiable at } x = ${c}.`, note: "A corner. The graph is continuous there, but has two different slopes meeting." },
    ]);
  }
  if (kind === 1) {
    const tex = `${grp}^{2/3}${plus}`;
    return problem(tex, plain(tex, `${grp}^(2/3)${plus}`, (x) => Math.cbrt((x - c) ** 2) + k), 1, md`The difference quotient is $\frac{h^{2/3}}{h} = h^{-1/3}$. What happens to it as $h \to 0^+$ and as $h \to 0^-$?`, [
      { math: md`\frac{f(${c} + h) - f(${c})}{h} = \frac{h^{2/3}}{h} = \frac{1}{\sqrt[3]{h}}`, note: md`$h^{2/3} = (\sqrt[3]{h})^2$ is defined for negative $h$ too.` },
      { math: md`h \to 0^+: \frac{1}{\sqrt[3]{h}} \to +\infty \qquad h \to 0^-: \frac{1}{\sqrt[3]{h}} \to -\infty`, note: "The secant slopes blow up in opposite directions." },
      { math: md`\text{Not differentiable at } x = ${c}.`, note: "A cusp: a sharp point where the graph comes in steeply from both sides." },
    ]);
  }
  if (kind === 2) {
    const tex = `\\sqrt[3]{${sh}}${plus}`;
    return problem(tex, plain(tex, `cbrt(${sh})${plus}`, (x) => Math.cbrt(x - c) + k), 2, md`The difference quotient is $\frac{\sqrt[3]{h}}{h} = \frac{1}{h^{2/3}}$. Is its limit a number?`, [
      { math: md`\frac{f(${c} + h) - f(${c})}{h} = \frac{\sqrt[3]{h}}{h} = \frac{1}{h^{2/3}}`, note: md`$h^{2/3} = (\sqrt[3]{h})^2 > 0$ for every $h \ne 0$.` },
      { math: md`\lim_{h \to 0} \frac{1}{h^{2/3}} = +\infty`, note: "From both sides the secant slopes grow without bound." },
      { math: md`\text{Not differentiable at } x = ${c}.`, note: "The tangent line is vertical. Infinite steepness isn't a number, so there is no derivative, though the graph is smooth and continuous." },
    ]);
  }
  if (kind === 3) {
    const tex = `${grp}|${sh}|${plus}`;
    return problem(tex, plain(tex, `${grp}*abs(${sh})${plus}`, (x) => (x - c) * Math.abs(x - c) + k), 0, md`Don't trust the absolute value sign alone. Compute $\frac{f(${c} + h) - f(${c})}{h} = \frac{h|h|}{h}$ and see whether it has a limit.`, [
      { math: md`\frac{f(${c} + h) - f(${c})}{h} = \frac{h|h| ${plus} - ${paren(k)}}{h} = \frac{h|h|}{h} = |h|`, note: md`Cancel one $h$.` },
      { math: md`\lim_{h \to 0} |h| = 0`, note: "The same from both sides." },
      { math: md`f'(${c}) = 0: \text{ differentiable.}`, note: "The absolute value is multiplied by a factor that vanishes at the same point, which smooths the corner away. The graph has a horizontal tangent there." },
    ]);
  }
  if (kind === 7) {
    const tex = `${grp}^2${plus}`;
    return problem(tex, plain(tex, `${grp}^2${plus}`, (x) => (x - c) ** 2 + k), 0, md`A polynomial. Does its difference quotient at $x = ${c}$ have a limit?`, [
      { math: md`\frac{f(${c} + h) - f(${c})}{h} = \frac{h^2 ${plus} - ${paren(k)}}{h} = \frac{h^2}{h} = h`, note: md`At $x = ${c} + h$, $(${sh})^2 = h^2$.` },
      { math: md`f'(${c}) = \lim_{h \to 0} h = 0`, note: "The limit exists: differentiable, with a horizontal tangent at the vertex." },
    ]);
  }
  // Piecewise: x^2 on the left, a line on the right.
  const win: [number, number] = [c - 2, c + 2];
  const slope = kind === 5 ? (() => { for (;;) { const m = r.int(-3, 3); if (m !== 2 * c) return m; } })() : 2 * c;
  const jump = kind === 6 ? r.nonzero(-2, 2) : 0;
  const intercept = c * c - slope * c + jump;
  const line = poly([[slope, "x"], [intercept, ""]]);
  const lineF = (x: number) => slope * x + intercept;
  const tex = `\\begin{cases} x^2 & x \\le ${c} \\\\ ${line} & x > ${c} \\end{cases}`;
  const figure: Figure = {
    kind: "plot",
    x: win,
    y: yWindow((x) => (x <= c ? x * x : lineF(x)), win[0], win[1]),
    curves: [
      { expr: "x^2", domain: [win[0], c] },
      { expr: line, domain: [c, win[1]] },
    ],
    points: jump ? [{ x: c, y: c * c, color: 2 }, { x: c, y: c * c + jump, open: true, color: 2 }] : [{ x: c, y: c * c, color: 2 }],
  };
  if (kind === 6) {
    return problem(tex, figure, 3, md`Before thinking about slopes, check continuity. What are $f(${c})$ and $\lim_{x \to ${c}^+} f(x)$?`, [
      { math: md`f(${c}) = ${c * c}, \qquad \lim_{x \to ${c}^+} f(x) = ${lineF(c)}`, note: "The parabola's value and the line's value at the join." },
      { math: md`${c * c} \ne ${lineF(c)}: \text{ a jump.}`, note: md`$f$ is not continuous at $x = ${c}$.` },
      { math: md`\text{Not differentiable at } x = ${c}.`, note: "Differentiable implies continuous (proved in the lesson), so a discontinuity rules the derivative out at once. The slopes matching (both pieces have slope " + md`$${2 * c}$` + ") doesn't rescue it." },
    ]);
  }
  const steps: Step[] = [
    { math: md`f(${c}) = ${c * c}, \qquad \lim_{x \to ${c}^+} (${line}) = ${lineF(c)}`, note: "Both pieces meet at the same height, so f is continuous there. Now the slopes." },
    { math: md`h < 0: \frac{(${c} + h)^2 - ${c * c}}{h} = \frac{${poly([[2 * c, "h"], [1, "h^2"]])}}{h} = ${poly([[2 * c, ""], [1, "h"]])} \to ${2 * c}`, note: "From the left, the difference quotient uses the parabola." },
    { math: md`h > 0: \frac{${slope === 1 ? "" : slope === -1 ? "-" : slope}(${c} + h) ${intercept ? signed(intercept) : ""} - ${c * c}}{h} = \frac{${slope}h}{h} = ${slope} \to ${slope}`, note: "From the right, it uses the line." },
  ];
  if (kind === 5) {
    steps.push({ math: md`${2 * c} \ne ${slope}: \text{ not differentiable at } x = ${c}.`, note: "The one-sided limits differ: a corner where the parabola meets a line of the wrong slope." });
    return problem(tex, figure, 1, md`Check continuity first (the pieces agree at $x = ${c}$), then compare the slope of $x^2$ at $x = ${c}$ with the slope of the line.`, steps);
  }
  steps.push({ math: md`f'(${c}) = ${2 * c}: \text{ differentiable.}`, note: "Continuous, and the two one-sided slopes agree. The line is the tangent line to the parabola at the join." });
  return problem(tex, figure, 0, md`Check continuity at $x = ${c}$, then compare the slope of $x^2$ there (its derivative is $2x$) with the slope of the line.`, steps);
};

const smoothJoin: Generator = (r) => {
  const p = r.nonzero(-2, 2);
  const q = r.int(-3, 3);
  const s = r.int(-3, 3);
  const c = r.int(-2, 3);
  const fc = evalQuad(p, q, s, c);
  const a = 2 * p * c + q;
  const b = fc - a * c;
  const tex = `\\begin{cases} ${quad(p, q, s)} & x \\le ${c} \\\\ ax + b & x > ${c} \\end{cases}`;
  return {
    prompt: md`Find $a$ and $b$ so that $f$ is differentiable at $x = ${c}$. Give them as $(a, b)$.

$$f(x) = ${tex}$$`,
    answer: `(${a}, ${b})`,
    form: "tuple",
    verify: [`a*${num(c)} + b = ${p}*${num(c)}^2 + ${num(q)}*${num(c)} + ${num(s)}`, `(${num(q)} - a)^2 - 4*${num(p)}*(${num(s)} - b) = 0`],
    hint: md`Two conditions. Continuity: the line must pass through $(${c}, f(${c}))$. Smoothness: the line's slope must equal the slope of the quadratic at $x = ${c}$, which is $${poly([[2 * p, "x"], [q, ""]])}$ there.`,
    solution: [
      { math: md`f(${c}) = ${fc}`, note: "The quadratic's value at the join." },
      { math: md`a \cdot ${paren(c)} + b = ${fc}`, note: "Continuity: the line must meet the parabola there, or there is no hope of a derivative." },
      { math: md`\frac{d}{dx}(${quad(p, q, s)}) = ${poly([[2 * p, "x"], [q, ""]])}, \quad \text{at } x = ${c}: \; ${a}`, note: "The slope of the parabola at the join, from the left." },
      { math: md`a = ${a}`, note: "The line's slope must match it, so the one-sided difference quotients agree." },
      { math: md`b = ${fc} - ${a} \cdot ${paren(c)} = ${b}`, note: md`Back into the continuity equation. So $(a, b) = (${a}, ${b})$: the line is the tangent line at $x = ${c}$.` },
    ],
  };
};

const absDerivativeAt: Generator = (r) => {
  const m = r.nonzero(-3, 3);
  const p = r.int(-4, 4);
  const k = r.next() < 0.25 ? -m * p : r.int(-6, 6);
  const inside = m * p + k;
  const f = `|${poly([[m, "x"], [k, ""]])}|`;
  const corner = frac(-k, m);
  const common = {
    prompt: md`Find $f'(x)$ when $f(x) = ${f}$ and $x = ${p}$. If the derivative does not exist there, type: does not exist.`,
    hint: md`$|u|$ equals $u$ where $u > 0$ and $-u$ where $u < 0$. Find the sign of $${poly([[m, "x"], [k, ""]])}$ at $x = ${p}$; the corner is at $x = ${fpTexPlain(corner)}$.`,
  };
  if (inside === 0) {
    return {
      ...common,
      accept: ["does not exist"],
      solution: [
        { math: md`${m}(${p}) ${signed(k)} = 0`, note: md`$x = ${p}$ is exactly the corner of the absolute value.` },
        { math: md`\frac{f(${p} + h) - f(${p})}{h} = \frac{|${m}h|}{h} = \frac{${Math.abs(m)}|h|}{h}`, note: md`$f(${p} + h) = |${m}(${p} + h) ${signed(k)}| = |${m}h|$.` },
        { math: md`h > 0: ${Math.abs(m)} \qquad h < 0: -${Math.abs(m)}`, note: "The one-sided limits disagree, so the limit does not exist: no derivative at the corner." },
      ],
    };
  }
  const sign = inside > 0 ? 1 : -1;
  return {
    ...common,
    answer: String(sign * m),
    solution: [
      { math: md`${m}(${p}) ${signed(k)} = ${inside} ${inside > 0 ? ">" : "<"} 0`, note: md`The inside is ${inside > 0 ? "positive" : "negative"} at $x = ${p}$, and stays that sign nearby (the corner is at $x = ${fpTexPlain(corner)}$).` },
      { math: inside > 0 ? md`f(x) = ${poly([[m, "x"], [k, ""]])} \text{ near } x = ${p}` : md`f(x) = -(${poly([[m, "x"], [k, ""]])}) = ${poly([[-m, "x"], [-k, ""]])} \text{ near } x = ${p}`, note: inside > 0 ? "Where the inside is positive, the absolute value does nothing." : "Where the inside is negative, the absolute value flips the sign." },
      { math: md`f'(${p}) = ${sign * m}`, note: "Near the point f is a line, and a line's derivative is its slope. The corner elsewhere doesn't matter: the derivative is local." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "The Derivative",
  lessons: [
    {
      id: slug("Instantaneous rate of change"),
      title: "Instantaneous rate of change",
      summary: "From average rates over shrinking intervals to the rate at a single instant: the slope of the tangent line.",
      blocks: [
        {
          kind: "text",
          body: md`A car's speedometer says 60 miles per hour. What does that mean? Speed is distance divided by time, but at a single instant no time passes and no distance is covered. The honest fraction is $\frac{0}{0}$, which means nothing. Yet the needle points at a definite number.

Algebra 3 gave you half the answer: the **average** rate of change over an interval. This lesson shrinks the interval until it has no width left, and the number that survives is the speedometer's number.`,
        },
        {
          kind: "key",
          title: "Average rate of change",
          body: md`The average rate of change of $f$ from $x = a$ to $x = b$ is

$$\frac{f(b) - f(a)}{b - a},$$

the slope of the **secant line** through $(a, f(a))$ and $(b, f(b))$. Writing the second input as $a + h$, where $h = b - a$ is the width of the interval, the same quantity is

$$\frac{f(a + h) - f(a)}{h}.$$

This form is called the **difference quotient**.`,
        },
        {
          kind: "example",
          title: "A falling ball, averaged over shorter and shorter intervals",
          problem: md`A ball dropped from rest falls $s(t) = 16t^2$ feet in $t$ seconds. Find its average velocity over $[1, 2]$, $[1, 1.5]$, $[1, 1.1]$ and $[1, 1.01]$.`,
          steps: [
            { math: md`\frac{s(2) - s(1)}{2 - 1} = \frac{64 - 16}{1} = 48`, note: "Over one whole second the ball averages 48 feet per second." },
            { math: md`\frac{s(1.5) - s(1)}{0.5} = \frac{36 - 16}{0.5} = 40`, note: "A shorter interval, and a smaller average: the ball was slower near t = 1 than near t = 2." },
            { math: md`\frac{s(1.1) - s(1)}{0.1} = \frac{19.36 - 16}{0.1} = 33.6`, note: "" },
            { math: md`\frac{s(1.01) - s(1)}{0.01} = \frac{16.3216 - 16}{0.01} = 32.16`, note: md`The averages are settling toward 32. That is the speed the ball "has" at $t = 1$.` },
          ],
        },
        {
          kind: "why",
          title: "Why we can't just set h = 0",
          body: md`Putting $h = 0$ into $\frac{s(1 + h) - s(1)}{h}$ gives $\frac{0}{0}$, and nothing can be learned from it. But every average over a short interval is a perfectly good number, and the table shows those numbers approaching something. "What do the averages approach as the interval shrinks?" is a limit question, exactly the kind Unit 1 taught you to answer:

$$\lim_{h \to 0} \frac{s(1 + h) - s(1)}{h}.$$

The limit never asks what happens *at* $h = 0$, only what happens as $h$ gets close. That is why the $\frac{0}{0}$ doesn't stop us.`,
        },
        {
          kind: "plot",
          x: [-1, 5],
          y: [-2, 18],
          curves: [
            { expr: "x^2", label: "y = x^2" },
            { expr: "a^2 + ((a + h)^2 - a^2)/h*(x - a)", label: "\\text{secant, slope } {=((a + h)^2 - a^2)/h}", color: 2 },
            { expr: "2a x - a^2", label: "\\text{tangent, slope } {=2a}", color: 3, dashed: true },
          ],
          points: [
            { x: "a", y: "a^2", label: "P", color: 2 },
            { x: "a + h", y: "(a + h)^2", label: "Q", color: 2 },
          ],
          params: [
            { name: "a", min: 0, max: 3, step: 0.5, value: 1 },
            { name: "h", min: 0.1, max: 3, step: 0.1, value: 2 },
          ],
          caption: md`Slide $h$ toward 0. The point $Q$ slides along the curve toward $P$, and the secant $PQ$ swings toward the dashed line. The dashed line is the **tangent line** at $P$: the line the secants approach. Watch the two slopes in the legend close in on each other.`,
        },
        {
          kind: "key",
          title: "Instantaneous rate of change",
          body: md`The instantaneous rate of change of $f$ at $x = a$ is the limit of the average rates over intervals shrinking to $a$:

$$\lim_{h \to 0} \frac{f(a + h) - f(a)}{h}.$$

Geometrically it is the slope of the **tangent line** to the graph at $(a, f(a))$: the line through that point whose slope is this limit. For a position function it is velocity; for a population it is a growth rate; in general it is how fast $f$ is changing at that one input.`,
        },
        {
          kind: "why",
          title: "Why the algebra always cancels the h",
          body: md`For the ball, $\frac{s(1 + h) - s(1)}{h} = \frac{16(1 + h)^2 - 16}{h} = \frac{16 + 32h + 16h^2 - 16}{h} = \frac{32h + 16h^2}{h} = 32 + 16h$.

The constant terms cancelled, and they had to. $f(a + h) - f(a)$ is exactly 0 when $h = 0$, so for a polynomial, $h$ is a factor of it (the factor theorem from Algebra 2: a polynomial in $h$ with root 0 has a factor $h$). Dividing by $h$ is then an ordinary cancellation, legal because $h \ne 0$ inside the limit. What's left, $32 + 16h$, is a friendly expression whose limit is $32$.

The $\frac{0}{0}$ was a disguise. Underneath it was $32 + 16h$ all along, and the limit just takes the mask off.`,
        },
        {
          kind: "example",
          title: "Rate of change at a point",
          problem: md`Find the instantaneous rate of change of $f(x) = x^2 - 3x$ at $x = 2$.`,
          steps: [
            { math: md`f(2) = 4 - 6 = -2`, note: "The value at the point." },
            { math: md`\frac{f(2 + h) - f(2)}{h} = \frac{(2 + h)^2 - 3(2 + h) - (-2)}{h}`, note: "The difference quotient." },
            { math: md`= \frac{4 + 4h + h^2 - 6 - 3h + 2}{h} = \frac{h + h^2}{h}`, note: "Expand; the constants 4, -6 and +2 cancel to 0." },
            { math: md`= 1 + h`, note: md`Cancel $h$.` },
            { math: md`\lim_{h \to 0} (1 + h) = 1`, note: md`At $x = 2$, $f$ is rising at 1 output unit per input unit. The tangent line there has slope 1.` },
          ],
        },
        {
          kind: "plot",
          x: [0.9, 1.1],
          y: [0.8, 1.2],
          curves: [
            { expr: "x^2", label: "y = x^2" },
            { expr: "2x - 1", label: "y = 2x - 1", color: 3, dashed: true },
          ],
          points: [{ x: 1, y: 1, label: "(1, 1)", color: 2 }],
          caption: md`Zoomed in close to $(1, 1)$, the parabola $y = x^2$ and its tangent line $y = 2x - 1$ are almost indistinguishable. Up close, a smooth curve looks straight, and the tangent is the straight line it looks like. That is why the tangent's slope deserves to be called "the" rate of change at that point.`,
        },
        {
          kind: "text",
          body: md`**Units and signs.** A rate's units are output units per input unit: feet per second, people per year, dollars per item. A positive rate means $f$ is increasing at that instant; a negative rate means it is decreasing; a rate of 0 means the tangent is horizontal, as at the top of a thrown ball's flight.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{h \to 0} \frac{(3 + h)^2 - 9}{h}$, the slope of $y = x^2$ at $x = 3$.`,
          answer: "6",
          explain: md`$(3 + h)^2 - 9 = 9 + 6h + h^2 - 9 = 6h + h^2 = h(6 + h)$. Divide by $h$ to get $6 + h$, which approaches $6$.`,
        },
        {
          kind: "check",
          prompt: md`A ball's height after $t$ seconds is $h(t) = 80t - 16t^2$ feet. Find its instantaneous velocity at $t = 1$, in feet per second.`,
          answer: "48",
          explain: md`$h(1) = 64$. With a time step $k$: $\frac{80(1 + k) - 16(1 + k)^2 - 64}{k} = \frac{80 + 80k - 16 - 32k - 16k^2 - 64}{k} = \frac{48k - 16k^2}{k} = 48 - 16k \to 48$.`,
        },
      ],
      practice: [averageRate, differenceQuotientLimit, instantaneousRateWord],
    },
    {
      id: slug("The derivative as a limit"),
      title: "The derivative as a limit",
      summary: "The definition of f'(a), its two equivalent forms, the three algebra moves that make the limit computable, and the tangent line.",
      blocks: [
        {
          kind: "text",
          body: md`The limit from Lesson 1 is so useful that it gets a name and a symbol of its own. Everything in this course, from curve sketching to the Fundamental Theorem of Calculus, is built on it.`,
        },
        {
          kind: "key",
          title: "The derivative at a point",
          body: md`The **derivative** of $f$ at $a$ is

$$f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h},$$

provided this limit exists. Read $f'(a)$ as "$f$ prime of $a$". It is the slope of the tangent line at $(a, f(a))$ and the instantaneous rate of change of $f$ at $a$. Finding it is called **differentiating** $f$ at $a$.`,
        },
        {
          kind: "text",
          body: md`There is a second way to write the same limit. Instead of naming the step $h$, name the second point $x$. The secant through $(a, f(a))$ and $(x, f(x))$ has slope $\frac{f(x) - f(a)}{x - a}$, and the tangent is what it becomes as $x$ slides toward $a$:

$$f'(a) = \lim_{x \to a} \frac{f(x) - f(a)}{x - a}.$$

Both forms are used everywhere, so it is worth seeing exactly why they agree.`,
        },
        {
          kind: "proof",
          title: "The two forms of the derivative are the same limit",
          given: md`$f$ is defined near $a$.`,
          prove: md`$\lim_{h \to 0} \frac{f(a + h) - f(a)}{h}$ exists if and only if $\lim_{x \to a} \frac{f(x) - f(a)}{x - a}$ exists, and then they are equal.`,
          steps: [
            { statement: md`Let $x = a + h$, so that $h = x - a$.`, reason: "Naming the second point of the secant two ways." },
            { statement: md`$\frac{f(a + h) - f(a)}{h} = \frac{f(x) - f(a)}{x - a}$ for every $h \ne 0$.`, reason: "Substitution: the two fractions are the same number at corresponding points." },
            { statement: md`$0 < |h| < \delta$ exactly when $0 < |x - a| < \delta$.`, reason: md`Because $|x - a| = |h|$.` },
            { statement: md`If $\lim_{h \to 0} \frac{f(a + h) - f(a)}{h} = L$, then for every $\varepsilon > 0$ some $\delta$ keeps the quotient within $\varepsilon$ of $L$ whenever $0 < |h| < \delta$.`, reason: "The epsilon-delta definition of a limit (Unit 1)." },
            { statement: md`The same $\delta$ keeps $\frac{f(x) - f(a)}{x - a}$ within $\varepsilon$ of $L$ whenever $0 < |x - a| < \delta$.`, reason: "Steps 2 and 3: same quotient, same condition." },
            { statement: md`So $\lim_{x \to a} \frac{f(x) - f(a)}{x - a} = L$. The argument reverses, so each limit exists exactly when the other does.`, reason: "Definition of the limit, applied in both directions." },
          ],
        },
        {
          kind: "example",
          title: "Differentiating a reciprocal from the definition",
          problem: md`Find $f'(2)$ for $f(x) = \frac{1}{x}$.`,
          steps: [
            { math: md`f'(2) = \lim_{h \to 0} \frac{\frac{1}{2 + h} - \frac{1}{2}}{h}`, note: md`The definition with $a = 2$.` },
            { math: md`\frac{1}{2 + h} - \frac{1}{2} = \frac{2 - (2 + h)}{2(2 + h)} = \frac{-h}{2(2 + h)}`, note: "Combine over a common denominator. Again the constants cancel and a factor h appears." },
            { math: md`\frac{1}{h} \cdot \frac{-h}{2(2 + h)} = \frac{-1}{2(2 + h)}`, note: md`Dividing by $h$ cancels it.` },
            { math: md`f'(2) = \lim_{h \to 0} \frac{-1}{2(2 + h)} = -\frac{1}{4}`, note: md`Negative: $\frac1x$ is decreasing at $x = 2$. The tangent there drops 1 unit for every 4 across.` },
          ],
        },
        {
          kind: "why",
          title: "Why there is always algebra before the limit, and what kind",
          body: md`The difference quotient is always $\frac{0}{0}$ at $h = 0$, so you can never just substitute. The job is to rewrite it in a form where you can. Three moves cover almost everything:

- **Expand** when $f$ is a polynomial: $(a + h)^2$, $(a + h)^3$, and so on. The constant terms cancel and $h$ factors out.
- **Combine fractions** when $f$ has a denominator: a common denominator puts the subtraction on top, where it produces the factor $h$.
- **Rationalize** when $f$ has a square root: multiply by the conjugate, and $(\sqrt{u} - \sqrt{v})(\sqrt{u} + \sqrt{v}) = u - v$ turns the roots into a difference that has a factor $h$.

In every case the goal is the same: expose the hidden factor of $h$, cancel it, and then take the limit of what remains, which is now a continuous expression you can evaluate at $h = 0$.`,
        },
        {
          kind: "example",
          title: "Differentiating a square root from the definition",
          problem: md`Find $f'(9)$ for $f(x) = \sqrt{x}$.`,
          steps: [
            { math: md`f'(9) = \lim_{h \to 0} \frac{\sqrt{9 + h} - 3}{h}`, note: md`$f(9) = 3$.` },
            { math: md`\frac{\sqrt{9 + h} - 3}{h} \cdot \frac{\sqrt{9 + h} + 3}{\sqrt{9 + h} + 3} = \frac{(9 + h) - 9}{h(\sqrt{9 + h} + 3)}`, note: "Multiply by the conjugate. The top becomes a difference of squares." },
            { math: md`= \frac{h}{h(\sqrt{9 + h} + 3)} = \frac{1}{\sqrt{9 + h} + 3}`, note: md`There's the factor $h$. Cancel it.` },
            { math: md`f'(9) = \frac{1}{\sqrt{9} + 3} = \frac{1}{6}`, note: md`Letting $h \to 0$ inside the root is allowed because $\sqrt{x}$ is continuous at 9 (Unit 1).` },
          ],
        },
        {
          kind: "plot",
          x: [0, 5],
          y: [-0.5, 4],
          curves: [
            { expr: "1/x", label: "y = 1/x", domain: [0.2, 5] },
            { expr: "2/a - x/a^2", label: "\\text{tangent at } x = {a}, \\text{ slope } {=-1/a^2}", color: 3 },
          ],
          points: [{ x: "a", y: "1/a", label: "(a, 1/a)", color: 2 }],
          params: [{ name: "a", min: 0.5, max: 4, step: 0.25, value: 2 }],
          caption: md`The tangent line to $y = \frac1x$ at $x = a$ has slope $-\frac{1}{a^2}$ (the example found $-\frac14$ at $a = 2$). Slide $a$: near 0 the curve is steep and the slope is a large negative number; far out it flattens toward 0.`,
        },
        {
          kind: "key",
          title: "Equation of the tangent line",
          body: md`The tangent line to $y = f(x)$ at $x = a$ passes through $(a, f(a))$ with slope $f'(a)$. In point-slope form:

$$y = f(a) + f'(a)(x - a).$$`,
        },
        {
          kind: "why",
          title: "Why point-slope form, and why the tangent may cross the curve",
          body: md`A line is determined by one point and its slope, and those are exactly the two things we know: the point of tangency and the derivative there. Point-slope form writes that information down with no further work.

Notice what the definition does **not** say. It doesn't say the tangent touches the curve only once, or stays on one side of it. The tangent to $y = x^3$ at the origin is the $x$-axis, which cuts straight through the curve. A tangent line is defined by its slope matching the limit of the secant slopes, nothing else. "Touches at one point" was a fine picture for circles in Geometry; the derivative is the definition that works for every curve.`,
        },
        {
          kind: "example",
          title: "A tangent line",
          problem: md`Find the tangent line to $y = x^2 - 3x$ at $x = 2$.`,
          steps: [
            { math: md`f(2) = -2, \qquad f'(2) = 1`, note: "The point and the slope, both from Lesson 1's example." },
            { math: md`y = -2 + 1(x - 2)`, note: "Point-slope form." },
            { math: md`y = x - 4`, note: md`Check: at $x = 2$ the line gives $-2$, the right height. It has slope 1, the right steepness.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = x^2 + x$. Use the definition to find $f'(3)$.`,
          answer: "7",
          explain: md`$f(3) = 12$. $\frac{(3 + h)^2 + (3 + h) - 12}{h} = \frac{9 + 6h + h^2 + 3 + h - 12}{h} = \frac{7h + h^2}{h} = 7 + h \to 7$.`,
        },
        {
          kind: "check",
          prompt: md`Find the tangent line to $y = \frac1x$ at $x = 2$. Type the right side only, as $mx + b$ (fractions like 1/4 are fine).`,
          answer: "(-1/4)x + 1",
          explain: md`The point is $(2, \frac12)$ and the slope is $f'(2) = -\frac14$ from the example. $y = \frac12 - \frac14(x - 2) = -\frac14 x + 1$.`,
        },
        {
          kind: "text",
          body: md`The definition says "provided this limit exists". For $|x|$ at $x = 0$ it doesn't: the secant slopes from the right are all $1$ and from the left all $-1$. Lesson 4 looks at when the derivative fails to exist. First, in Lesson 3, we stop computing one point at a time.`,
        },
      ],
      practice: [derivativeAtPoint, derivativeFunctionFromDefinition, tangentLine],
    },
    {
      id: slug("The derivative as a function"),
      title: "The derivative as a function",
      summary: "Let the point move: f' becomes a new function with its own graph, and picks up several notations along the way.",
      blocks: [
        {
          kind: "text",
          body: md`Lesson 2 computed $f'(2)$, $f'(9)$, one point at a time. Each computation redid the same algebra with a different number. Do the algebra once with a letter instead, and you get the slope at every point in a single formula.`,
        },
        {
          kind: "key",
          title: "The derivative function",
          body: md`Given $f$, the function

$$f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$$

is the **derivative** of $f$. Its domain is the set of $x$ where the limit exists. Its value at each $x$ is the slope of the tangent to $f$ there. The same word, "derivative", now means a function rather than a number; which one is meant is always clear from context.`,
        },
        {
          kind: "example",
          title: "The derivative of x squared",
          problem: md`Find $f'(x)$ for $f(x) = x^2$.`,
          steps: [
            { math: md`\frac{f(x + h) - f(x)}{h} = \frac{(x + h)^2 - x^2}{h}`, note: md`Now $x$ stays a variable and only $h$ shrinks.` },
            { math: md`= \frac{x^2 + 2xh + h^2 - x^2}{h} = \frac{2xh + h^2}{h} = 2x + h`, note: md`Expand, cancel the $x^2$, factor out $h$.` },
            { math: md`f'(x) = \lim_{h \to 0} (2x + h) = 2x`, note: md`One formula for every slope. $f'(3) = 6$ and $f'(1) = 2$ agree with Lesson 1, and now $f'(-5) = -10$ comes free.` },
          ],
        },
        {
          kind: "example",
          title: "The derivative of x cubed",
          problem: md`Find $f'(x)$ for $f(x) = x^3$.`,
          steps: [
            { math: md`(x + h)^3 = x^3 + 3x^2 h + 3x h^2 + h^3`, note: "The binomial expansion from Algebra 2." },
            { math: md`\frac{(x + h)^3 - x^3}{h} = \frac{3x^2 h + 3x h^2 + h^3}{h} = 3x^2 + 3xh + h^2`, note: md`Every term after $x^3$ carries a factor $h$.` },
            { math: md`f'(x) = \lim_{h \to 0} (3x^2 + 3xh + h^2) = 3x^2`, note: md`The slope of $x^3$ is never negative: the graph only ever rises or pauses (at $x = 0$).` },
          ],
        },
        {
          kind: "why",
          title: "Why the leftover terms vanish, and why sums split",
          body: md`After dividing by $h$, the quotient for $x^3$ was $3x^2 + 3xh + h^2$. The terms $3xh$ and $h^2$ still contain $h$, so by the product law for limits (Unit 1) each goes to $3x \cdot 0 = 0$ and $0 \cdot 0 = 0$. Only the term without $h$ survives. This is the general pattern: of the binomial expansion of $(x + h)^n$, only the first two terms matter to the derivative. Unit 3 turns that into the power rule.

The same limit laws let you handle a sum one term at a time. For $f(x) = x^2 - 3x$,

$$\frac{f(x + h) - f(x)}{h} = \frac{(x + h)^2 - x^2}{h} - 3 \cdot \frac{(x + h) - x}{h},$$

and the sum and constant-multiple laws give $f'(x) = 2x - 3 \cdot 1 = 2x - 3$. (At $x = 2$ that is $1$, matching Lesson 1.) Unit 3 will state this as a rule; here it is just the limit laws at work.`,
        },
        {
          kind: "proof",
          title: "The derivative of a line is its slope",
          given: md`$f(x) = mx + b$.`,
          prove: md`$f'(x) = m$ for every $x$.`,
          steps: [
            { statement: md`$f(x + h) - f(x) = m(x + h) + b - (mx + b) = mh$`, reason: "Distribute and cancel." },
            { statement: md`$\frac{f(x + h) - f(x)}{h} = \frac{mh}{h} = m$ for every $h \ne 0$.`, reason: "Every secant of a line is the line itself." },
            { statement: md`$f'(x) = \lim_{h \to 0} m = m$`, reason: "The limit of a constant is that constant." },
          ],
        },
        {
          kind: "text",
          body: md`Two consequences. A constant function ($m = 0$) has derivative 0: a flat graph has no slope anywhere. And $f(x) = x$ has derivative 1. Both agree with the picture, and both get used constantly.

Since $f'$ is a function, it has a graph. Reading the two graphs together is one of the central skills of calculus.`,
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-2.5, 3.5],
          curves: [
            { expr: "x^3/3 - x", label: "f(x) = x^3/3 - x" },
            { expr: "x^2 - 1", label: "f'(x) = x^2 - 1", color: 2 },
            { expr: "(a^2 - 1)(x - a) + a^3/3 - a", label: "\\text{tangent, slope } {=a^2 - 1}", color: 3, dashed: true },
          ],
          points: [
            { x: "a", y: "a^3/3 - a", label: "(a, f(a))", color: 1 },
            { x: "a", y: "a^2 - 1", label: "(a, f'(a))", color: 2 },
          ],
          vlines: [{ x: "a" }],
          params: [{ name: "a", min: -2.5, max: 2.5, step: 0.1, value: 1.5 }],
          caption: md`Slide $a$. The **height** of the orange curve $f'$ at $a$ equals the **slope** of the dashed tangent to the blue curve $f$ at $a$. Where $f$ rises, $f'$ is above the axis; where $f$ falls, $f'$ is below; at the hilltop ($a = -1$) and the valley ($a = 1$) the tangent is flat and $f'$ crosses zero.`,
        },
        {
          kind: "key",
          title: "Reading f' from the graph of f",
          body: md`- Where the graph of $f$ is rising, $f'$ is positive. Where it is falling, $f'$ is negative.
- Where the tangent is horizontal (a hilltop, a valley, or a flat pause), $f'$ is zero.
- The steeper the graph, the larger $|f'|$.

These follow from $f'$ being a slope. The reverse direction, that $f' > 0$ on an interval forces $f$ to increase there, is true as well, but proving it needs the Mean Value Theorem (Unit 5).`,
        },
        {
          kind: "key",
          title: "Notation for the derivative",
          body: md`All of these mean the derivative of $y = f(x)$:

$$f'(x) \qquad y' \qquad \frac{dy}{dx} \qquad \frac{df}{dx} \qquad \frac{d}{dx}\,f(x)$$

The value at a particular point is $f'(a)$ or $\left.\frac{dy}{dx}\right|_{x = a}$. The fraction-shaped symbols are **Leibniz notation**; $\frac{d}{dx}$ on its own is an instruction: "differentiate what follows with respect to $x$".`,
        },
        {
          kind: "why",
          title: "Where dy/dx comes from",
          body: md`The secant slope is a ratio of changes: $\frac{\Delta y}{\Delta x} = \frac{f(x + h) - f(x)}{h}$, where $\Delta x = h$ and $\Delta y$ is the matching change in $y$. Leibniz wrote the limit of this ratio as $\frac{dy}{dx}$, with $d$ standing for "$\Delta$ shrunk all the way".

$\frac{dy}{dx}$ is a single symbol, not a fraction: $dy$ and $dx$ have not been given meanings of their own (yet; Unit 5 does that). But the notation earns its keep. It reminds you of the units ($y$-units per $x$-unit), it says which variable you differentiated with respect to, which matters once there are several, and it will turn out to behave like a fraction in the chain rule (Unit 3), for reasons that will be proved rather than assumed.`,
        },
        {
          kind: "example",
          title: "dy/dx for a square root",
          problem: md`Find $\frac{dy}{dx}$ when $y = \sqrt{x}$.`,
          steps: [
            { math: md`\frac{\Delta y}{\Delta x} = \frac{\sqrt{x + h} - \sqrt{x}}{h} = \frac{(x + h) - x}{h\left(\sqrt{x + h} + \sqrt{x}\right)}`, note: "Rationalize, as in Lesson 2, but with x kept general." },
            { math: md`= \frac{1}{\sqrt{x + h} + \sqrt{x}}`, note: md`Cancel $h$.` },
            { math: md`\frac{dy}{dx} = \frac{1}{2\sqrt{x}}`, note: md`At $x = 9$ this is $\frac16$, matching Lesson 2. The formula is defined only for $x > 0$: the derivative's domain can be smaller than $f$'s. At $x = 0$ the slopes blow up (Lesson 4).` },
          ],
        },
        {
          kind: "example",
          title: "dy/dx for a reciprocal",
          problem: md`Find $\frac{dy}{dx}$ when $y = \frac{1}{x}$.`,
          steps: [
            { math: md`\frac{1}{x + h} - \frac{1}{x} = \frac{x - (x + h)}{x(x + h)} = \frac{-h}{x(x + h)}`, note: "Common denominator." },
            { math: md`\frac{\Delta y}{\Delta x} = \frac{-1}{x(x + h)}`, note: md`Divide by $h$.` },
            { math: md`\frac{dy}{dx} = -\frac{1}{x^2}`, note: md`Always negative: $\frac1x$ falls on both sides of the $y$-axis, never rising. At $x = 2$ it is $-\frac14$, as in Lesson 2.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find $\frac{d}{dx}\left(x^3 - 5x\right)$. Type an expression in $x$.`,
          answer: "3x^2 - 5",
          explain: md`Term by term: $x^3 \to 3x^2$ and $5x \to 5 \cdot 1$. So $\frac{d}{dx}(x^3 - 5x) = 3x^2 - 5$.`,
        },
        {
          kind: "check",
          prompt: md`At which $x$ does the graph of $f(x) = x^2 - 6x$ have a horizontal tangent?`,
          answer: "3",
          explain: md`$f'(x) = 2x - 6$, and $2x - 6 = 0$ at $x = 3$: the vertex of the parabola.`,
        },
      ],
      practice: [polynomialDerivative, leibnizDerivative, horizontalTangent],
    },
    {
      id: slug("Differentiability"),
      title: "Differentiability",
      summary: "When the derivative exists and when it doesn't: corners, cusps, vertical tangents, breaks, and the proof that differentiable functions are continuous.",
      blocks: [
        {
          kind: "text",
          body: md`Every definition so far ended with "provided the limit exists". Usually it does. This lesson is about the places where it doesn't, what the graph looks like there, and one theorem that connects the derivative back to continuity.`,
        },
        {
          kind: "key",
          title: "Differentiable",
          body: md`$f$ is **differentiable at $a$** if $f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h}$ exists (as a real number). It is **differentiable on an interval** if it is differentiable at every point of the interval.

A function can fail to be differentiable at a point in four ways: the graph has a **corner**, a **cusp**, a **vertical tangent**, or a **discontinuity** there.`,
        },
        {
          kind: "example",
          title: "The absolute value at zero",
          problem: md`Is $f(x) = |x|$ differentiable at $x = 0$?`,
          steps: [
            { math: md`\frac{f(0 + h) - f(0)}{h} = \frac{|h|}{h}`, note: md`$f(0) = 0$.` },
            { math: md`h > 0: \quad \frac{|h|}{h} = \frac{h}{h} = 1`, note: "Every secant from the right has slope 1." },
            { math: md`h < 0: \quad \frac{|h|}{h} = \frac{-h}{h} = -1`, note: "Every secant from the left has slope -1." },
            { math: md`\lim_{h \to 0^+} = 1 \ne -1 = \lim_{h \to 0^-}`, note: "The one-sided limits disagree, so the two-sided limit doesn't exist (Unit 1). Not differentiable at 0." },
          ],
        },
        {
          kind: "plot",
          x: [-2.5, 2.5],
          y: [-0.5, 2.5],
          curves: [
            { expr: "abs(x)", label: "y = |x|" },
            { expr: "abs(h)/h*x", label: "\\text{secant through 0 and } h, \\text{ slope } {=abs(h)/h}", color: 2, dashed: true },
          ],
          points: [
            { x: 0, y: 0, color: 2 },
            { x: "h", y: "abs(h)", label: "(h, |h|)", color: 2 },
          ],
          params: [{ name: "h", min: -1.9, max: 1.9, step: 0.2, value: 1.1 }],
          caption: md`Slide $h$ from one side of 0 to the other. The secant's slope jumps from $1$ to $-1$ and never settles on one value. There is no single line the graph "looks like" at the corner, no matter how far you zoom in.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-1.5, 2],
          curves: [
            { expr: "cbrt(x)", label: "y = \\sqrt[3]{x}" },
            { expr: "x^(2/3)", label: "y = x^{2/3}", color: 2 },
          ],
          vlines: [{ x: 0 }],
          caption: md`Two more failures at $x = 0$. The cube root has a **vertical tangent**: its secant slopes $\frac{\sqrt[3]{h}}{h} = h^{-2/3}$ grow toward $+\infty$ from both sides, so the graph is smooth but straight up at the origin. The curve $x^{2/3}$ has a **cusp**: its slopes $\frac{h^{2/3}}{h} = h^{-1/3}$ go to $+\infty$ from the right and $-\infty$ from the left, a sharp point.`,
        },
        {
          kind: "why",
          title: "Why a vertical tangent means no derivative",
          body: md`For $f(x) = \sqrt[3]{x}$ at 0, the difference quotient is $\frac{\sqrt[3]{h} - 0}{h} = \frac{1}{h^{2/3}}$. As $h \to 0$ this grows without bound. The secants really do approach a line, the vertical line $x = 0$, which is why we still say the graph has a vertical tangent there. But a vertical line has no slope: "infinite" is a description of how the quotient behaves, not a real number. The derivative must be a number, so $f'(0)$ does not exist.

Compare $f(x) = \sqrt{x}$ from Lesson 3: $f'(x) = \frac{1}{2\sqrt{x}}$ is undefined at 0 for the same reason, and the graph leaves the origin vertically.`,
        },
        {
          kind: "key",
          title: "Theorem: differentiable implies continuous",
          body: md`If $f$ is differentiable at $a$, then $f$ is continuous at $a$.

Equivalently (the contrapositive): if $f$ is **not** continuous at $a$, it is **not** differentiable there. A jump or a hole kills the derivative immediately, with no need to compute anything.`,
        },
        {
          kind: "proof",
          title: "Differentiable implies continuous",
          given: md`$f'(a)$ exists.`,
          prove: md`$\lim_{x \to a} f(x) = f(a)$.`,
          steps: [
            { statement: md`For $x \ne a$: $f(x) - f(a) = \frac{f(x) - f(a)}{x - a} \cdot (x - a)$.`, reason: md`Multiplying and dividing by the nonzero number $x - a$.` },
            { statement: md`$\lim_{x \to a} \frac{f(x) - f(a)}{x - a} = f'(a)$.`, reason: "The second form of the derivative (Lesson 2), which exists by hypothesis." },
            { statement: md`$\lim_{x \to a} (x - a) = 0$.`, reason: "A polynomial is continuous." },
            { statement: md`$\lim_{x \to a} \bigl(f(x) - f(a)\bigr) = f'(a) \cdot 0 = 0$.`, reason: "The product law for limits; both factors have limits." },
            { statement: md`$\lim_{x \to a} f(x) = \lim_{x \to a} \bigl(f(x) - f(a)\bigr) + f(a) = 0 + f(a) = f(a)$.`, reason: "The sum law; f(a) is a constant." },
            { statement: md`$f$ is continuous at $a$.`, reason: "Definition of continuity (Unit 1)." },
          ],
        },
        {
          kind: "why",
          title: "Why the converse is false, and what the theorem is really saying",
          body: md`$|x|$ is continuous at 0 (no break) but not differentiable there (a corner). So continuity does not give differentiability. The theorem only goes one way.

Think of it as two levels of smoothness. Continuity says the graph has no breaks. Differentiability says it has no breaks **and** looks straight when you zoom in: no corners, no cusps, no vertical pieces. The second condition is stronger, which is exactly what the theorem claims: differentiable functions form a smaller, better-behaved club inside the continuous ones.

The proof shows why. The derivative's existence means $\frac{f(x) - f(a)}{x - a}$ stays bounded near $a$, and a bounded quotient times something shrinking to 0 must itself shrink to 0. A jump would make $f(x) - f(a)$ refuse to shrink, so the quotient would have to blow up.`,
        },
        {
          kind: "plot",
          x: [-2, 3],
          y: [-1, 5],
          curves: [
            { expr: "x^2", label: "x^2 \\text{ for } x \\le 1", domain: [-2, 1] },
            { expr: "2x + 1", label: "2x + 1 \\text{ for } x > 1", color: 2, domain: [1, 3] },
          ],
          points: [
            { x: 1, y: 1, color: 1 },
            { x: 1, y: 3, open: true, color: 2 },
          ],
          caption: md`A trap. For $x \le 1$ this is $x^2$, whose slope at 1 is $2$; for $x > 1$ it is $2x + 1$, slope $2$. The slopes match, yet the function is not differentiable at 1: it jumps from $1$ to $3$, so it isn't even continuous. Always check continuity before comparing slopes.`,
        },
        {
          kind: "example",
          title: "Making a piecewise function differentiable",
          problem: md`Let $f(x) = x^2$ for $x \le 1$ and $f(x) = ax + b$ for $x > 1$. Find $a$ and $b$ so that $f$ is differentiable at $x = 1$.`,
          steps: [
            { math: md`a(1) + b = 1^2 = 1`, note: "Continuity first: the line must pass through (1, 1). Without it, no derivative is possible." },
            { math: md`h < 0: \quad \frac{(1 + h)^2 - 1}{h} = 2 + h \to 2`, note: "From the left the difference quotient uses the parabola." },
            { math: md`h > 0: \quad \frac{a(1 + h) + b - 1}{h} = \frac{ah + (a + b - 1)}{h} = a`, note: md`From the right it uses the line, and with $a + b = 1$ the constant vanishes.` },
            { math: md`a = 2, \qquad b = 1 - 2 = -1`, note: md`The one-sided limits must agree: $a = 2$. Then continuity gives $b$. The line $y = 2x - 1$ is the tangent to $x^2$ at $(1, 1)$, which is no accident: a smooth join means the line *is* the tangent.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Is $f(x) = |x - 2|$ differentiable at $x = 2$?`,
          choices: ["Yes", "No, it has a corner there", "No, it has a vertical tangent there", "No, it isn't continuous there"],
          accept: ["No, it has a corner there"],
          explain: md`It is $|x|$ shifted right by 2. The difference quotient at 2 is $\frac{|h|}{h}$, which is $1$ from the right and $-1$ from the left: a corner.`,
        },
        {
          kind: "check",
          prompt: md`Is $g(x) = x|x|$ differentiable at $x = 0$?`,
          choices: ["Yes", "No, it has a corner there", "No, it has a vertical tangent there", "No, it isn't continuous there"],
          accept: ["Yes"],
          explain: md`$\frac{g(h) - g(0)}{h} = \frac{h|h|}{h} = |h| \to 0$ from both sides. So $g'(0) = 0$. The absolute value's corner is flattened by the extra factor of $x$, which is 0 at the same spot.`,
        },
        {
          kind: "text",
          body: md`**Summary.** Differentiable at $a$ means the graph is continuous at $a$ and looks like a single non-vertical line up close. Corners and cusps (two different approach directions), vertical tangents (infinite slope) and discontinuities each break that. Everything else in this unit computed derivatives by grinding through the limit. Unit 3 proves rules that make the grinding unnecessary.`,
        },
      ],
      practice: [differentiableAt, smoothJoin, absDerivativeAt],
    },
  ],
};
