import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, slug, type Generator, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** "x - 3" or "x + 3": the factor that vanishes at x = a. */
const minus = (a: number) => (a < 0 ? `x + ${-a}` : `x - ${a}`);

/** A number as a LaTeX table entry, three decimals, no trailing junk. */
const dec = (v: number) => (Math.round(v * 1000) / 1000).toFixed(3);

/** Exact fractions [numerator, denominator] for Riemann sums. */
type Q = [number, number];
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
const qadd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qmul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
const qpow = (a: Q, k: number): Q => (k === 0 ? [1, 1] : qmul(a, qpow(a, k - 1)));
const qinv = (a: Q): Q => q(a[1], a[0]);
const qText = (a: Q) => frac(a[0], a[1]);
const qTex = (a: Q) => fracTex(a[0], a[1]);
const qNum = (a: Q) => a[0] / a[1];

// ── Lesson 1 generators ─────────────────────────────────────────────────────

const limitByCancel: Generator = (r) => {
  const kind = r.int(0, 2);
  const a = r.nonzero(-5, 5);
  if (kind === 0) {
    return {
      prompt: md`Find $\lim_{x \to ${a}} \frac{x^2 - ${a * a}}{${minus(a)}}$.`,
      answer: String(2 * a),
      hint: md`Substituting $x = ${a}$ gives $\frac{0}{0}$, so factor the top as a difference of squares and cancel.`,
      solution: [
        { math: md`\frac{x^2 - ${a * a}}{${minus(a)}} = \frac{(${minus(a)})(${minus(-a)})}{${minus(a)}}`, note: md`Difference of squares: $x^2 - ${a * a} = (${minus(a)})(${minus(-a)})$.` },
        { math: md`= ${minus(-a)} \quad (x \ne ${a})`, note: md`Cancelling $${minus(a)}$ is allowed because the limit only looks at $x \ne ${a}$, where that factor isn't 0.` },
        { math: md`\lim_{x \to ${a}} (${minus(-a)}) = ${a} ${signed(a)} = ${2 * a}`, note: "Near the target the function is a plain line, so the limit is the line's value there." },
      ],
    };
  }
  const b = r.pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6].filter((v) => v !== -a && v !== a));
  const num = poly([[1, "x^2"], [b - a, "x"], [-a * b, ""]]);
  if (kind === 1) {
    return {
      prompt: md`Find $\lim_{x \to ${a}} \frac{${num}}{${minus(a)}}$.`,
      answer: String(a + b),
      hint: md`The top is $\frac{0}{0}$ at $x = ${a}$, so $${minus(a)}$ must be a factor of it. Factor, cancel, then substitute.`,
      solution: [
        { math: md`${num} = (${minus(a)})(${minus(-b)})`, note: md`Two numbers that multiply to $${-a * b}$ and add to $${b - a}$: $${-a}$ and $${b}$.` },
        { math: md`\frac{(${minus(a)})(${minus(-b)})}{${minus(a)}} = ${minus(-b)} \quad (x \ne ${a})`, note: "Cancel the common factor; it isn't zero for the values the limit cares about." },
        { math: md`\lim_{x \to ${a}} (${minus(-b)}) = ${a} ${signed(b)} = ${a + b}`, note: "Substitute into what's left." },
      ],
    };
  }
  const c = r.pick([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].filter((v) => v !== -a && v !== b && v !== a));
  const den = poly([[1, "x^2"], [c - a, "x"], [-a * c, ""]]);
  return {
    prompt: md`Find $\lim_{x \to ${a}} \frac{${num}}{${den}}$. Fractions are fine, like -3/4.`,
    answer: frac(a + b, a + c),
    hint: md`Both top and bottom are 0 at $x = ${a}$, so both have the factor $${minus(a)}$. Factor both, cancel, then substitute.`,
    solution: [
      { math: md`\frac{(${minus(a)})(${minus(-b)})}{(${minus(a)})(${minus(-c)})}`, note: "Factor the top and the bottom. Each has the vanishing factor." },
      { math: md`= \frac{${minus(-b)}}{${minus(-c)}} \quad (x \ne ${a})`, note: "Cancel it." },
      { math: md`\lim_{x \to ${a}} \frac{${minus(-b)}}{${minus(-c)}} = \frac{${a + b}}{${a + c}} ${`\\frac{${a + b}}{${a + c}}` === fracTex(a + b, a + c) ? "" : md`= ${fracTex(a + b, a + c)}`}`, note: md`The bottom is $${a + c} \ne 0$ now, so substitution is safe.` },
    ],
  };
};

const limitFromTable: Generator = (r) => {
  const a = r.int(-3, 4);
  const k = r.pick([1, 2, 3, -1, -2]);
  const m = r.int(-6, 6);
  const L = k * a + m;
  const xs = [-0.1, -0.01, -0.001, 0.001, 0.01, 0.1];
  const kind = r.int(0, 2);
  if (kind < 2) {
    const fa = kind === 1 ? L + r.pick([-3, -2, 2, 3]) : null;
    const row = xs.map((d) => dec(L + k * d));
    const table = md`\begin{array}{c|cccccc} x & ${xs.map((d) => dec(a + d)).join(" & ")} \\ \hline f(x) & ${row.join(" & ")} \end{array}`;
    return {
      prompt: md`The table shows values of $f(x)$ for $x$ near $${a}$.${fa !== null ? md` Also, $f(${a}) = ${fa}$.` : ""}

$$${table}$$

What does $\lim_{x \to ${a}} f(x)$ appear to be?`,
      answer: String(L),
      // Near a the table is the line kx + m, whose value at a is the limit.
      verify: [`L = ${k}(${a}) + ${paren(m)}`],
      hint: md`Read the $f(x)$ row from both ends toward the middle. The values from the left and the values from the right should crowd toward the same number.${fa !== null ? md` The value $f(${a})$ itself does not matter.` : ""}`,
      solution: [
        { math: md`${row[0]},\ ${row[1]},\ ${row[2]} \to ${L}`, note: md`From the left ($x < ${a}$), the values climb toward $${L}$.` },
        { math: md`${row[5]},\ ${row[4]},\ ${row[3]} \to ${L}`, note: md`From the right ($x > ${a}$), the values close in on $${L}$ too.` },
        { math: md`\lim_{x \to ${a}} f(x) = ${L}`, note: fa !== null ? md`Both sides agree, so the limit is $${L}$. The fact that $f(${a}) = ${fa}$ is irrelevant: a limit is about the approach, not the arrival.` : "Both sides agree, so this is the limit." },
      ],
    };
  }
  // One-sided: the two halves of the table head for different numbers.
  const k2 = r.pick([1, 2, -1, -2]);
  const L2 = L + r.pick([-4, -3, -2, 2, 3, 4]);
  const m2 = L2 - k2 * a;
  const left = xs.slice(0, 3).map((d) => dec(L + k * d));
  const right = xs.slice(3).map((d) => dec(L2 + k2 * d));
  const table = md`\begin{array}{c|cccccc} x & ${xs.map((d) => dec(a + d)).join(" & ")} \\ \hline f(x) & ${[...left, ...right].join(" & ")} \end{array}`;
  const side = r.pick(["-", "+"] as const);
  const [kk, mm, ans] = side === "-" ? [k, m, L] : [k2, m2, L2];
  return {
    prompt: md`The table shows values of $f(x)$ for $x$ near $${a}$.

$$${table}$$

Find $\lim_{x \to ${a}^${side}} f(x)$.`,
    answer: String(ans),
    verify: [`L = ${kk}(${a}) + ${paren(mm)}`],
    hint: md`$x \to ${a}^${side}$ means $x$ approaches $${a}$ from ${side === "-" ? "the left, through values smaller than" : "the right, through values larger than"} $${a}$. Use only ${side === "-" ? "the first three" : "the last three"} columns.`,
    solution: [
      { math: side === "-" ? md`${left[0]},\ ${left[1]},\ ${left[2]} \to ${L}` : md`${right[2]},\ ${right[1]},\ ${right[0]} \to ${L2}`, note: md`Read the columns with $x ${side === "-" ? "<" : ">"} ${a}$, moving toward $${a}$.` },
      { math: md`\lim_{x \to ${a}^${side}} f(x) = ${ans}`, note: md`The other side heads for $${side === "-" ? L2 : L}$, so the two-sided limit doesn't exist, but the one-sided limit asked for is $${ans}$.` },
    ],
  };
};

const limitFromGraph: Generator = (r) => {
  const a = r.int(-2, 2);
  const m1 = r.pick([-2, -1, 1, 2]);
  const m2 = r.pick([-2, -1, 1, 2]);
  const L1 = r.int(-2, 4);
  const same = r.next() < 0.4;
  const L2 = same ? L1 : L1 + r.pick([-3, -2, 2, 3]);
  const d = r.next() < 0.5 ? L1 : L1 + r.pick([-2, 2]);
  const c1 = L1 - m1 * a;
  const c2 = L2 - m2 * a;
  const ys = [L1, L2, d, L1 - 3 * m1, L2 + 3 * m2];
  const figure = {
    kind: "plot" as const,
    x: [a - 3, a + 3] as [number, number],
    y: [Math.min(...ys) - 1, Math.max(...ys) + 1] as [number, number],
    curves: [
      { expr: poly([[m1, "x"], [c1, ""]]), label: "y = f(x)", domain: [a - 3, a] as [number, number] },
      { expr: poly([[m2, "x"], [c2, ""]]), domain: [a, a + 3] as [number, number] },
    ],
    points: [
      ...(L1 !== d ? [{ x: a, y: L1, open: true }] : []),
      ...(L2 !== d && L2 !== L1 ? [{ x: a, y: L2, open: true }] : []),
      { x: a, y: d },
    ],
  };
  const kind = r.int(0, 3);
  // The branch heading into x = a is the line kx + c; its value at a is the one-sided limit.
  const lineEq = (k: number, c: number) => `L = ${k}(${a}) + ${paren(c)}`;
  if (kind === 0 || kind === 1) {
    const side = kind === 0 ? "-" : "+";
    const ans = kind === 0 ? L1 : L2;
    return {
      prompt: md`The graph shows $y = f(x)$. Find $\lim_{x \to ${a}^${side}} f(x)$.`,
      figure,
      answer: String(ans),
      verify: [kind === 0 ? lineEq(m1, c1) : lineEq(m2, c2)],
      hint: md`Trace the curve with your finger from the ${side === "-" ? "left" : "right"} toward $x = ${a}$. The height you are heading for is the one-sided limit, whether or not there is a dot there.`,
      solution: [
        { math: md`\lim_{x \to ${a}^${side}} f(x) = ${ans}`, note: md`Coming from the ${side === "-" ? "left" : "right"}, the graph heads to height $${ans}$ at $x = ${a}$.${ans !== d ? md` The solid dot at height $${d}$ is $f(${a})$, which the limit ignores.` : ""}` },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`The graph shows $y = f(x)$. Find $\lim_{x \to ${a}} f(x)$, or type "does not exist".`,
      figure,
      ...(same ? { answer: String(L1), verify: [lineEq(m1, c1), lineEq(m2, c2)] } : { accept: ["does not exist", "DNE", "no limit"] }),
      hint: "Find the left-hand and right-hand limits first. The two-sided limit exists only when they agree.",
      solution: same
        ? [
            { math: md`\lim_{x \to ${a}^-} f(x) = ${L1}, \quad \lim_{x \to ${a}^+} f(x) = ${L2}`, note: "From both sides the graph heads for the same height." },
            { math: md`\lim_{x \to ${a}} f(x) = ${L1}`, note: d !== L1 ? md`The two one-sided limits agree, so the limit is $${L1}$. It doesn't matter that $f(${a}) = ${d}$.` : "The one-sided limits agree, so the limit exists and equals them." },
          ]
        : [
            { math: md`\lim_{x \to ${a}^-} f(x) = ${L1}, \quad \lim_{x \to ${a}^+} f(x) = ${L2}`, note: "The left branch and the right branch head for different heights." },
            { math: md`\text{does not exist}`, note: md`No single number is approached from both sides, so $\lim_{x \to ${a}} f(x)$ does not exist.` },
          ],
    };
  }
  return {
    prompt: md`The graph shows $y = f(x)$. Find $f(${a})$.`,
    figure,
    answer: String(d),
    hint: md`$f(${a})$ is the actual value at $x = ${a}$: the height of the solid dot, not where the curve is heading.`,
    solution: [{ math: md`f(${a}) = ${d}`, note: md`The solid dot sits at $(${a}, ${d})$. Open circles mark heights the graph approaches but never reaches.` }],
  };
};

// ── Lesson 2 generators ─────────────────────────────────────────────────────

const tangentSlopeLimit: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.nonzero(-5, 5);
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{(${a} + h)^2 - ${a * a}}{h}$.`,
      answer: String(2 * a),
      hint: md`Expand $(${a} + h)^2$, and the constant cancels. Every term left has a factor of $h$.`,
      solution: [
        { math: md`\frac{${a * a} ${signed(2 * a)}h + h^2 - ${a * a}}{h} = \frac{${poly([[2 * a, "h"], [1, "h^2"]])}}{h}`, note: md`$(${a} + h)^2 = ${a * a} ${signed(2 * a)}h + h^2$.` },
        { math: md`= ${poly([[2 * a, ""], [1, "h"]])} \quad (h \ne 0)`, note: md`Factor $h$ out of the top and cancel it.` },
        { math: md`\lim_{h \to 0} (${poly([[2 * a, ""], [1, "h"]])}) = ${2 * a}`, note: md`This is the slope of $y = x^2$ at $x = ${a}$: the tangent slope $2a$ with $a = ${a}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.nonzero(-4, 4);
    const c = r.pick([-5, -4, -3, -2, 2, 3, 4, 5]);
    const fa = a * a + c * a;
    const ans = 2 * a + c;
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{(${a} + h)^2 ${c < 0 ? "-" : "+"} ${Math.abs(c)}(${a} + h) - ${paren(fa)}}{h}$.`,
      answer: String(ans),
      hint: md`This is the difference quotient of $f(x) = x^2 ${signed(c)}x$ at $x = ${a}$: note that $f(${a}) = ${fa}$. Expand, cancel the constants, factor out $h$.`,
      solution: [
        { math: md`(${a} + h)^2 ${c < 0 ? "-" : "+"} ${Math.abs(c)}(${a} + h) = ${a * a} ${signed(2 * a)}h + h^2 ${signed(c * a)} ${signed(c)}h`, note: "Expand the top." },
        { math: md`\frac{${poly([[2 * a + c, "h"], [1, "h^2"]])}}{h} = ${poly([[ans, ""], [1, "h"]])} \quad (h \ne 0)`, note: md`The constants $${a * a} ${signed(c * a)} - ${paren(fa)}$ add to 0. Factor out $h$ and cancel.` },
        { math: md`\lim_{h \to 0} (${poly([[ans, ""], [1, "h"]])}) = ${ans}`, note: md`The slope of $y = x^2 ${signed(c)}x$ at $x = ${a}$.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.nonzero(-3, 3);
    return {
      prompt: md`Find $\lim_{h \to 0} \frac{(${a} + h)^3 - ${paren(a ** 3)}}{h}$.`,
      answer: String(3 * a * a),
      hint: md`$(a + h)^3 = a^3 + 3a^2 h + 3a h^2 + h^3$. The $a^3$ cancels; everything else has a factor of $h$.`,
      solution: [
        { math: md`(${a} + h)^3 = ${a ** 3} ${signed(3 * a * a)}h ${signed(3 * a)}h^2 + h^3`, note: "Cube the binomial." },
        { math: md`\frac{${poly([[3 * a * a, "h"], [3 * a, "h^2"], [1, "h^3"]])}}{h} = ${poly([[3 * a * a, ""], [3 * a, "h"], [1, "h^2"]])} \quad (h \ne 0)`, note: md`Subtract $${a ** 3}$, factor out $h$, cancel.` },
        { math: md`\lim_{h \to 0} (${poly([[3 * a * a, ""], [3 * a, "h"], [1, "h^2"]])}) = ${3 * a * a}`, note: md`Every term with $h$ vanishes. The slope of $y = x^3$ at $x = ${a}$ is $3a^2 = ${3 * a * a}$.` },
      ],
    };
  }
  const a = r.pick([1, 2, 3, 4, -1, -2, -3]);
  return {
    prompt: md`Find $\lim_{h \to 0} \frac{\frac{1}{${a} + h} - \frac{1}{${a}}}{h}$. Fractions are fine, like -1/9.`,
    answer: frac(-1, a * a),
    hint: md`Combine the two fractions on top over the common denominator $${a}(${a} + h)$. The numerator collapses to a multiple of $h$.`,
    solution: [
      { math: md`\frac{1}{${a} + h} - \frac{1}{${a}} = \frac{${a} - (${a} + h)}{${a}(${a} + h)} = \frac{-h}{${a}(${a} + h)}`, note: "Common denominator; the constants cancel on top." },
      { math: md`\frac{-h}{${a}(${a} + h) \cdot h} = \frac{-1}{${a}(${a} + h)} \quad (h \ne 0)`, note: md`Dividing by $h$ cancels the $h$ on top.` },
      { math: md`\lim_{h \to 0} \frac{-1}{${a}(${a} + h)} = \frac{-1}{${a} \cdot ${a}} = ${fracTex(-1, a * a)}`, note: md`The slope of $y = \frac{1}{x}$ at $x = ${a}$. It is negative: the curve falls there.` },
    ],
  };
};

const secantSlope: Generator = (r) => {
  const kind = r.int(0, 2);
  const p = r.int(-3, 3);
  const w = r.int(1, 4);
  const qq = p + w;
  if (kind === 0) {
    const b = r.int(-5, 5);
    const c = r.int(-6, 6);
    const f = (x: number) => x * x + b * x + c;
    const ftext = poly([[1, "x^2"], [b, "x"], [c, ""]]);
    const ans = qq + p + b;
    const at = (x: number) => `(${x})^2 ${b ? `${b < 0 ? "-" : "+"} ${Math.abs(b)}(${x})` : ""} ${c ? signed(c) : ""}`;
    return {
      prompt: md`Find the slope of the secant line to $y = ${ftext}$ through its points at $x = ${p}$ and $x = ${qq}$.`,
      answer: String(ans),
      verify: [`m (${qq} - ${paren(p)}) = ((${qq})^2 + ${b}(${qq}) + ${paren(c)}) - ((${p})^2 + ${b}(${p}) + ${paren(c)})`],
      hint: md`A secant slope is rise over run between two points on the curve: $\frac{f(${qq}) - f(${p})}{${qq} - ${paren(p)}}$.`,
      solution: [
        { math: md`f(${p}) = ${at(p)} = ${f(p)}, \quad f(${qq}) = ${at(qq)} = ${f(qq)}`, note: "Find both heights." },
        { math: md`m = \frac{${f(qq)} - ${paren(f(p))}}{${qq} - ${paren(p)}} = \frac{${f(qq) - f(p)}}{${w}}`, note: "Rise over run." },
        { math: md`m = ${ans}`, note: md`Check: for a parabola $x^2 + bx + c$, the secant slope between $p$ and $q$ is always $p + q + b = ${p} + ${qq} ${signed(b)} = ${ans}$.` },
      ],
    };
  }
  if (kind === 1) {
    const f = (x: number) => x ** 3;
    const ans = qq * qq + qq * p + p * p;
    return {
      prompt: md`Find the slope of the secant line to $y = x^3$ through its points at $x = ${p}$ and $x = ${qq}$.`,
      answer: String(ans),
      verify: [`m (${qq} - ${paren(p)}) = (${qq})^3 - (${p})^3`],
      hint: md`Slope $= \frac{f(${qq}) - f(${p})}{${qq} - ${paren(p)}}$ with $f(x) = x^3$.`,
      solution: [
        { math: md`f(${p}) = ${f(p)}, \quad f(${qq}) = ${f(qq)}`, note: "Cube both inputs." },
        { math: md`m = \frac{${f(qq)} - ${paren(f(p))}}{${qq} - ${paren(p)}} = \frac{${f(qq) - f(p)}}{${w}} = ${ans}`, note: md`Rise over run. (Also $q^2 + qp + p^2$, since $q^3 - p^3 = (q - p)(q^2 + qp + p^2)$.)` },
      ],
    };
  }
  const v0 = r.pick([48, 64, 80, 96]);
  const t1 = r.int(0, 2);
  const t2 = t1 + r.int(1, 2);
  const h = (t: number) => v0 * t - 16 * t * t;
  const ans = v0 - 16 * (t1 + t2);
  return {
    prompt: md`A ball thrown upward is $h(t) = ${v0}t - 16t^2$ feet high after $t$ seconds. Find its average velocity from $t = ${t1}$ to $t = ${t2}$, in feet per second (a negative answer means it is falling).`,
    answer: String(ans),
    verify: [`v (${t2} - ${t1}) = (${v0}(${t2}) - 16(${t2})^2) - (${v0}(${t1}) - 16(${t1})^2)`],
    hint: md`Average velocity is change in height over change in time: the slope of the secant line through $(${t1}, h(${t1}))$ and $(${t2}, h(${t2}))$.`,
    solution: [
      { math: md`h(${t1}) = ${h(t1)}, \quad h(${t2}) = ${h(t2)}`, note: "Heights at the two times." },
      { math: md`\frac{h(${t2}) - h(${t1})}{${t2} - ${t1}} = \frac{${h(t2) - h(t1)}}{${t2 - t1}} = ${ans}`, note: md`Feet divided by seconds. ${ans < 0 ? "Negative: over this stretch the ball is on its way down." : ans === 0 ? "Zero: it ends exactly as high as it began, even though it moved." : "Positive: over this stretch it gains height."}` },
    ],
  };
};

const tangentLineEquation: Generator = (r) => {
  const k = r.pick([1, 1, 1, -1]);
  const b = r.int(-4, 4);
  const c = r.int(-5, 5);
  let a = r.int(-3, 3);
  if (2 * k * a + b === 0) a += 1;
  const f = (x: number) => k * x * x + b * x + c;
  const ftext = poly([[k, "x^2"], [b, "x"], [c, ""]]);
  const m = 2 * k * a + b;
  const n = f(a) - m * a;
  const ans = poly([[m, "x"], [n, ""]]);
  const fah = poly([[k, "(a + h)^2"], [b, "(a + h)"], [c, ""]]).replace(/a/g, String(a));
  return {
    prompt: md`Find the tangent line to $y = ${ftext}$ at the point where $x = ${a}$. Type the right side of $y = \ldots$ as an expression in $x$ (for example 2x - 1).`,
    answer: ans,
    // A tangent to a parabola touches with double contact: f(x) - line = k (x - a)^2.
    verify: [`${ftext} - y = ${k}(x - ${paren(a)})^2`],
    hint: md`Slope first: $\lim_{h \to 0} \frac{f(${a} + h) - f(${a})}{h}$. Then point-slope form through $(${a}, f(${a}))$.`,
    solution: [
      { math: md`f(${a}) = ${f(a)}`, note: "The point of tangency is $(" + a + ", " + f(a) + ")$." },
      { math: md`\frac{${fah} - ${paren(f(a))}}{h} = \frac{${poly([[m, "h"], [k, "h^2"]])}}{h} = ${poly([[m, ""], [k, "h"]])}`, note: md`Expand $f(${a} + h)$; the constants cancel, and $h$ divides out.` },
      { math: md`m = \lim_{h \to 0} (${poly([[m, ""], [k, "h"]])}) = ${m}`, note: md`Shortcut from the lesson: the slope of $y = ${ftext}$ at $x = a$ is $${poly([[2 * k, "a"], [b, ""]])}$.` },
      { math: md`y - ${paren(f(a))} = ${m}(x - ${paren(a)})`, note: "Point-slope form." },
      { math: md`y = ${ans}`, note: md`Check: $${ftext} - (${ans}) = ${k === 1 ? "" : "-"}${a === 0 ? "x^2" : `(${minus(a)})^2`}$, which is 0 only at $x = ${a}$. The line meets the parabola exactly once, at the point of tangency.` },
    ],
  };
};

// ── Lesson 3 generators ─────────────────────────────────────────────────────

interface AreaFn {
  tex: string;
  expr: string;
  /** f at a rational input, exactly. */
  at: (x: Q) => Q;
  /** f(x) for the verify equation, with x a fraction in text. */
  atText: (x: string) => string;
  intervals: [number, number][];
  ymax: number;
}

const areaFns: AreaFn[] = [
  { tex: "x^2", expr: "x^2", at: (x) => qpow(x, 2), atText: (x) => `(${x})^2`, intervals: [[0, 2], [0, 4], [1, 3], [0, 1]], ymax: 16 },
  { tex: "x^3", expr: "x^3", at: (x) => qpow(x, 3), atText: (x) => `(${x})^3`, intervals: [[0, 2], [0, 1]], ymax: 8 },
  { tex: "2^x", expr: "2^x", at: (x) => (x[1] === 1 ? q(2 ** x[0]) : qpow(q(4), x[0] / 2)), atText: (x) => `2^(${x})`, intervals: [[0, 4]], ymax: 16 },
  { tex: "\\frac{1}{x}", expr: "1/x", at: (x) => qinv(x), atText: (x) => `1/(${x})`, intervals: [[1, 3], [1, 5]], ymax: 1.2 },
];

const riemannSum: Generator = (r) => {
  const method = r.pick(["left", "right"] as const);
  const kind = r.int(0, 3);
  let fn: AreaFn;
  if (kind === 0) {
    const mm = r.int(1, 3);
    const cc = r.int(0, 3);
    fn = {
      tex: poly([[mm, "x"], [cc, ""]]),
      expr: poly([[mm, "x"], [cc, ""]]),
      at: (x) => qadd(qmul(q(mm), x), q(cc)),
      atText: (x) => `${mm}(${x}) + ${cc}`,
      intervals: [[0, 2], [0, 4], [1, 3]],
      ymax: 3 * 4 + 3,
    };
  } else if (kind === 1) {
    const cc = r.int(1, 3);
    fn = { tex: `x^2 + ${cc}`, expr: `x^2 + ${cc}`, at: (x) => qadd(qpow(x, 2), q(cc)), atText: (x) => `(${x})^2 + ${cc}`, intervals: [[0, 2], [0, 1], [0, 4]], ymax: 19 };
  } else {
    fn = r.pick(areaFns);
  }
  const [a, b] = r.pick(fn.intervals);
  const dx = q(b - a, 4);
  const idx = method === "left" ? [0, 1, 2, 3] : [1, 2, 3, 4];
  const xs = idx.map((i) => qadd(q(a), qmul(q(i), dx)));
  const hs = xs.map(fn.at);
  const total = hs.reduce((s, h) => qadd(s, h), q(0));
  const area = qmul(dx, total);
  const yTop = Math.max(...hs.map(qNum), fn.at(q(b))[0] / fn.at(q(b))[1]);
  return {
    prompt: md`Use a ${method} Riemann sum with $n = 4$ rectangles to estimate the area under $y = ${fn.tex}$ on $[${a}, ${b}]$. Give the exact value as a fraction (like 15/4) or a whole number.`,
    figure: {
      kind: "plot",
      x: [a - 0.5, b + 0.5],
      y: [-0.5, Math.min(fn.ymax, yTop) * 1.15 + 0.5],
      curves: [{ expr: fn.expr, label: `y = ${fn.tex}` }],
      riemann: { expr: fn.expr, from: a, to: b, n: 4, method },
    },
    answer: qText(area),
    verify: [`S = (${qText(dx)})(${xs.map((x) => fn.atText(qText(x))).join(" + ")})`],
    hint: md`$\Delta x = \frac{${b} - ${a}}{4} = ${qTex(dx)}$. The ${method} sum uses heights at the ${method} ends of the four pieces: $x = ${xs.map(qTex).join(", ")}$. Add the heights, then multiply by $\Delta x$.`,
    solution: [
      { math: md`\Delta x = \frac{${b} - ${a}}{4} = ${qTex(dx)}`, note: "Four equal pieces." },
      { math: md`x = ${xs.map(qTex).join(",\\ ")}`, note: md`The ${method} endpoint of each piece.` },
      { math: md`f(x) = ${hs.map(qTex).join(",\\ ")}`, note: md`The heights of the four rectangles, from $f(x) = ${fn.tex}$.` },
      { math: md`${method === "left" ? "L" : "R"}_4 = ${qTex(dx)} \left(${hs.map(qTex).join(" + ")}\right) = ${qTex(dx)} \cdot ${qTex(total)} = ${qTex(area)}`, note: md`Each rectangle has area height $\times \Delta x$; factor out the common width.` },
    ],
  };
};

const exactArea: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const m = r.int(1, 3);
    const c = r.int(0, 4);
    const a = r.int(0, 2);
    const b = a + r.int(2, 4);
    const f = (x: number) => m * x + c;
    const area = q((f(a) + f(b)) * (b - a), 2);
    return {
      prompt: md`Evaluate $\int_{${a}}^{${b}} (${poly([[m, "x"], [c, ""]])}) \, dx$ exactly: it is the area under the line $y = ${poly([[m, "x"], [c, ""]])}$ between $${a}$ and $${b}$. Fractions are fine, like 27/2.`,
      answer: qText(area),
      hint: md`The region is a trapezoid standing on the $x$-axis${c === 0 && a === 0 ? " (here a triangle)" : ""}: parallel sides of lengths $f(${a})$ and $f(${b})$, and width $${b - a}$. No limit is needed when geometry already knows the area.`,
      solution: [
        { math: md`f(${a}) = ${f(a)}, \quad f(${b}) = ${f(b)}`, note: "The two vertical sides of the trapezoid." },
        { math: md`A = \frac{${f(a)} + ${f(b)}}{2} \cdot ${b - a} = ${qTex(area)}`, note: md`Trapezoid area: average of the parallel sides times the distance between them. Rectangle sums close in on exactly this number as $n$ grows.` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.int(1, 6);
    return {
      prompt: md`Evaluate $\int_{0}^{${b}} x^2 \, dx$ exactly: the area under the parabola $y = x^2$ from $0$ to $${b}$. Fractions are fine, like 8/3.`,
      answer: frac(b ** 3, 3),
      hint: md`The lesson proved the area under $y = x^2$ from $0$ to $b$ is $\frac{b^3}{3}$.`,
      solution: [
        { math: md`R_n = \frac{${b}^3}{n^3} \sum_{k=1}^{n} k^2 = ${b ** 3} \cdot \frac{(1 + \frac{1}{n})(2 + \frac{1}{n})}{6}`, note: md`Right sum with $n$ rectangles of width $\frac{${b}}{n}$, using $\sum k^2 = \frac{n(n+1)(2n+1)}{6}$.` },
        { math: md`\lim_{n \to \infty} R_n = ${b ** 3} \cdot \frac{1 \cdot 2}{6} = ${fracTex(b ** 3, 3)}`, note: md`The $\frac{1}{n}$ terms vanish. So $\int_0^{${b}} x^2 \, dx = \frac{${b}^3}{3} = ${fracTex(b ** 3, 3)}$.` },
      ],
    };
  }
  if (kind === 2) {
    const a = r.int(1, 4);
    const b = a + r.int(1, 3);
    return {
      prompt: md`Evaluate $\int_{${a}}^{${b}} x^2 \, dx$ exactly: the area under $y = x^2$ from $${a}$ to $${b}$. Fractions are fine, like 26/3.`,
      answer: frac(b ** 3 - a ** 3, 3),
      hint: md`The area from $${a}$ to $${b}$ is the area from $0$ to $${b}$ minus the area from $0$ to $${a}$, and each of those is $\frac{(\text{end})^3}{3}$.`,
      solution: [
        { math: md`\int_0^{${b}} x^2 \, dx = \frac{${b}^3}{3} = \frac{${b ** 3}}{3}, \quad \int_0^{${a}} x^2 \, dx = \frac{${a}^3}{3} = \frac{${a ** 3}}{3}`, note: md`The lesson's formula $\frac{b^3}{3}$, twice.` },
        { math: md`\int_{${a}}^{${b}} x^2 \, dx = \frac{${b ** 3} - ${a ** 3}}{3} = ${fracTex(b ** 3 - a ** 3, 3)}`, note: "Taking away the part from 0 to " + a + " leaves the strip we want. Areas of pieces add." },
      ],
    };
  }
  const b = r.int(1, 4);
  const c = r.int(1, 5);
  return {
    prompt: md`Evaluate $\int_{0}^{${b}} (x^2 + ${c}) \, dx$ exactly: the area under $y = x^2 + ${c}$ from $0$ to $${b}$. Fractions are fine, like 23/3.`,
    answer: frac(b ** 3 + 3 * c * b, 3),
    hint: md`Raising the parabola by $${c}$ puts a $${b} \times ${c}$ rectangle under it. Area under $x^2 + ${c}$ = area under $x^2$ + area of that rectangle.`,
    solution: [
      { math: md`\int_0^{${b}} x^2 \, dx = \frac{${b}^3}{3} = \frac{${b ** 3}}{3}`, note: "The curved part, from the lesson's formula." },
      { math: md`\text{rectangle} = ${b} \cdot ${c} = ${b * c}`, note: md`Every rectangle in a Riemann sum for $x^2 + ${c}$ is $${c}$ taller than the one for $x^2$, and those extra pieces make a $${b} \times ${c}$ rectangle.` },
      { math: md`\frac{${b ** 3}}{3} + ${b * c} = ${fracTex(b ** 3 + 3 * c * b, 3)}`, note: "Add the two parts." },
    ],
  };
};

const underOrOver: Generator = (r) => {
  const fns: { tex: string; expr: string; interval: [number, number]; increasing: boolean; ymax: number }[] = [
    { tex: "x^2", expr: "x^2", interval: [0, 3], increasing: true, ymax: 10 },
    { tex: "\\frac{1}{x}", expr: "1/x", interval: [1, 4], increasing: false, ymax: 1.3 },
    { tex: "2^x", expr: "2^x", interval: [0, 3], increasing: true, ymax: 9 },
    { tex: "10 - x^2", expr: "10 - x^2", interval: [0, 3], increasing: false, ymax: 11 },
    { tex: "\\sqrt{x}", expr: "sqrt(x)", interval: [0, 4], increasing: true, ymax: 2.5 },
    { tex: "6 - x", expr: "6 - x", interval: [0, 4], increasing: false, ymax: 7 },
    { tex: "\\ln x", expr: "ln(x)", interval: [1, 5], increasing: true, ymax: 2 },
    { tex: "\\frac{4}{x^2}", expr: "4/x^2", interval: [1, 4], increasing: false, ymax: 4.5 },
  ];
  const f = r.pick(fns);
  const method = r.pick(["left", "right"] as const);
  const under = f.increasing === (method === "left");
  const n = r.pick([4, 5, 6]);
  const dir = f.increasing ? "rises" : "falls";
  return {
    prompt: md`On $[${f.interval[0]}, ${f.interval[1]}]$, is the ${method} Riemann sum for $y = ${f.tex}$ (any $n$) an underestimate or an overestimate of the exact area?`,
    figure: {
      kind: "plot",
      x: [f.interval[0] - 0.5, f.interval[1] + 0.5],
      y: [-0.5, f.ymax],
      curves: [{ expr: f.expr, label: `y = ${f.tex}` }],
      riemann: { expr: f.expr, from: f.interval[0], to: f.interval[1], n, method },
    },
    choices: ["underestimate", "overestimate"],
    accept: [under ? "underestimate" : "overestimate"],
    hint: md`Does the curve rise or fall across the interval? On each piece, the ${method} endpoint gives the ${under ? "smallest" : "largest"} height when the curve ${dir}.`,
    solution: [
      { math: md`y = ${f.tex} \text{ ${dir} on } [${f.interval[0]}, ${f.interval[1]}]`, note: f.increasing ? "Larger inputs give larger outputs here." : "Larger inputs give smaller outputs here." },
      {
        math: md`\text{${method} sum is an ${under ? "underestimate" : "overestimate"}}`,
        note: md`On each piece the ${method} endpoint is where the curve is ${under ? "lowest" : "highest"}, so each rectangle ${under ? "fits inside the strip under the curve" : "covers the strip under the curve and sticks out above it"}. ${under ? "Sum of smaller pieces: too small." : "Sum of larger pieces: too big."}`,
      },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit8: Unit = {
  title: "A Preview of Calculus",
  lessons: [
    {
      id: slug("Limits by tables and graphs"),
      title: "Limits by tables and graphs",
      summary: "What it means for f(x) to approach a value, read from tables, graphs and algebra, including one-sided limits and limits that don't exist.",
      blocks: [
        {
          kind: "text",
          body: md`Take $f(x) = \frac{x^2 - 4}{x - 2}$. At $x = 2$ it is $\frac{0}{0}$: undefined, a hole in the domain. But the interesting question isn't what happens *at* 2. It's what happens *near* 2. Try some values:

$$\begin{array}{c|cccccc} x & 1.9 & 1.99 & 1.999 & 2.001 & 2.01 & 2.1 \\ \hline f(x) & 3.9 & 3.99 & 3.999 & 4.001 & 4.01 & 4.1 \end{array}$$

The outputs crowd toward 4 from both sides. They never equal 4, because $x$ never equals 2, but you can get them as close to 4 as you want. That trend is called a limit.`,
        },
        {
          kind: "key",
          title: "Limit (informal)",
          body: md`$$\lim_{x \to a} f(x) = L$$

means: $f(x)$ can be made as close to $L$ as we like by taking $x$ close enough to $a$, **without** $x$ equalling $a$. Read it "the limit of $f(x)$ as $x$ approaches $a$ is $L$."

The value $f(a)$ plays no part. It may equal $L$, be something else, or not exist at all.`,
        },
        {
          kind: "why",
          title: "Why does the table head for 4?",
          body: md`For every $x \ne 2$, the factor $x - 2$ is not zero, so cancelling it is legal:

$$\frac{x^2 - 4}{x - 2} = \frac{(x - 2)(x + 2)}{x - 2} = x + 2 \qquad (x \ne 2).$$

Away from $x = 2$, $f$ *is* the line $y = x + 2$, and that line is near 4 whenever $x$ is near 2. The limit is 4 because the function near 2 behaves like $x + 2$, and $2 + 2 = 4$. The graph is the line with one point missing.`,
        },
        {
          kind: "plot",
          x: [-1, 5],
          y: [-1, 7],
          curves: [{ expr: "(x^2 - 4)/(x - 2)", label: "y = \\frac{x^2 - 4}{x - 2}" }],
          points: [
            { x: 2, y: 4, open: true, label: "(2, 4)" },
            { x: "c", y: "c + 2", label: "({c}, {=c + 2})", color: 2 },
          ],
          params: [{ name: "c", min: 0.5, max: 3.5, step: 0.01, value: 1.2 }],
          caption: md`Slide $c$ toward 2. The orange point rides along the graph and its height heads for 4, but the hole at $(2, 4)$ is never filled. The limit describes where the point is heading, not where it lands.`,
        },
        {
          kind: "key",
          title: "Finding a 0/0 limit by algebra",
          body: md`When substituting $x = a$ gives $\frac{0}{0}$, the top and bottom share the factor $x - a$. **Factor, cancel it, then substitute.** The simplified expression equals the original everywhere except at $x = a$, and the limit never looks at $x = a$, so the two have the same limit.`,
        },
        {
          kind: "example",
          title: "Factor and cancel",
          problem: md`Find $\lim_{x \to 3} \frac{x^2 - x - 6}{x - 3}$.`,
          steps: [
            { math: md`\frac{x^2 - x - 6}{x - 3} = \frac{(x - 3)(x + 2)}{x - 3}`, note: md`Substituting 3 gives $\frac{0}{0}$, which guarantees $x - 3$ is a factor of the top.` },
            { math: md`= x + 2 \qquad (x \ne 3)`, note: "Cancel. Near 3 (but not at 3) the function is this line." },
            { math: md`\lim_{x \to 3} (x + 2) = 5`, note: "Now substitution is safe: the line has no hole." },
          ],
        },
        {
          kind: "text",
          body: md`Some functions approach different values from the two sides. $g(x) = \frac{|x|}{x}$ equals $-1$ for every negative $x$ and $1$ for every positive $x$:

$$\begin{array}{c|cccccc} x & -0.1 & -0.01 & -0.001 & 0.001 & 0.01 & 0.1 \\ \hline g(x) & -1 & -1 & -1 & 1 & 1 & 1 \end{array}$$

There is no single number the outputs crowd toward. We need a finer tool.`,
        },
        {
          kind: "key",
          title: "One-sided limits",
          body: md`- $\lim_{x \to a^-} f(x)$ is the **left-hand limit**: $x$ approaches $a$ through values smaller than $a$.
- $\lim_{x \to a^+} f(x)$ is the **right-hand limit**: $x$ approaches $a$ through values larger than $a$.

The two-sided limit $\lim_{x \to a} f(x)$ exists exactly when both one-sided limits exist and are equal. Then all three are the same number.

For $g(x) = \frac{|x|}{x}$: $\lim_{x \to 0^-} g(x) = -1$, $\lim_{x \to 0^+} g(x) = 1$, and $\lim_{x \to 0} g(x)$ does not exist.`,
        },
        {
          kind: "why",
          title: "Why must both sides agree?",
          body: md`"Close enough to $a$" means every $x$ within some small distance of $a$, and that neighbourhood always has points on both sides. If the left values crowd toward $-1$ and the right values toward $1$, no single $L$ works: whatever $L$ you propose, half the nearby points are at least distance 1 from it. A limit is a promise about *all* nearby inputs, so one disagreeing side breaks it.`,
        },
        {
          kind: "plot",
          x: [-2, 4],
          y: [-1, 5],
          curves: [
            { expr: "x + 1", label: "y = f(x)", domain: [-2, 1] },
            { expr: "4 - x", domain: [1, 4] },
          ],
          points: [
            { x: 1, y: 2, open: true },
            { x: 1, y: 3, open: true },
            { x: 1, y: 1, label: "f(1) = 1" },
          ],
          caption: md`Reading a graph at $x = 1$: tracing from the left, the curve heads to height 2, so $\lim_{x \to 1^-} f(x) = 2$. From the right it heads to 3, so $\lim_{x \to 1^+} f(x) = 3$. The solid dot says $f(1) = 1$. Three different numbers, and the two-sided limit does not exist.`,
        },
        {
          kind: "text",
          body: md`Open circles mark heights a graph approaches but never reaches; a solid dot marks the actual value. When reading a limit from a graph, cover the point at $x = a$ with your thumb. What's left tells you the limit. What's under your thumb tells you $f(a)$, a separate question.

Two other ways a limit can fail. As $x \to 0$, $\frac{1}{x^2}$ grows past every bound: we write $\lim_{x \to 0} \frac{1}{x^2} = \infty$ to describe the behaviour, but $\infty$ is not a number, and the limit does not exist. And $\sin\frac{1}{x}$ swings between $-1$ and $1$ faster and faster near 0, settling on nothing.`,
        },
        {
          kind: "why",
          title: "Why tables suggest but algebra proves",
          body: md`A table of $\sin\frac{\pi}{x}$ at $x = 0.1, 0.01, 0.001$ shows $\sin 10\pi = 0$, $\sin 100\pi = 0$, $\sin 1000\pi = 0$. It looks like the limit is 0. But at $x = \frac{2}{4001}$, also very close to 0, the value is $\sin\frac{4001\pi}{2} = 1$. The function has no limit at 0; the table only sampled lucky points.

A table can show you what a limit *probably* is. Factoring and cancelling, as in the examples above, shows what it *is*, for every nearby $x$ at once. Use tables to guess and algebra to confirm.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{x \to -1} \frac{x^2 - 1}{x + 1}$.`,
          answer: "-2",
          explain: md`$\frac{x^2 - 1}{x + 1} = \frac{(x + 1)(x - 1)}{x + 1} = x - 1$ for $x \ne -1$, and $x - 1 \to -2$.`,
        },
        {
          kind: "check",
          prompt: md`Let $h(x) = \frac{x + |x|}{x}$. For $x < 0$, $h(x) = 0$; for $x > 0$, $h(x) = 2$. What is $\lim_{x \to 0} h(x)$?`,
          choices: ["0", "1", "2", "does not exist"],
          accept: ["does not exist"],
          explain: md`The left-hand limit is 0 and the right-hand limit is 2. They disagree, so the two-sided limit does not exist. (Not 1: a limit is never "the average of the two sides".)`,
        },
      ],
      practice: [limitByCancel, limitFromTable, limitFromGraph],
    },
    {
      id: slug("The tangent line problem"),
      title: "The tangent line problem",
      summary: "Secant slopes close in on the tangent slope, and the difference quotient limit gives it exactly.",
      blocks: [
        {
          kind: "text",
          body: md`In Geometry a tangent to a circle is the line that touches it at one point, and it is perpendicular to the radius there. A parabola has no center and no radius. What should "the tangent line to $y = x^2$ at $(1, 1)$" even mean?

The question matters beyond geometry. If the curve is a position graph, the slope of its tangent is the speed at that instant, a speedometer reading. Averages over an interval we can already do (Unit 1's average rate of change). The instant is the new problem.`,
        },
        {
          kind: "key",
          title: "Secant and tangent",
          body: md`Fix a point $P = (a, f(a))$ on the curve and pick a second point $Q = (a + h, f(a + h))$. The line through $P$ and $Q$ is a **secant line**, and its slope is the difference quotient

$$m_{PQ} = \frac{f(a + h) - f(a)}{h}.$$

The **tangent line** at $P$ is the line the secants settle toward as $Q$ slides into $P$, that is, as $h \to 0$. Its slope is $\displaystyle\lim_{h \to 0} \frac{f(a + h) - f(a)}{h}$.`,
        },
        {
          kind: "plot",
          x: [-1.5, 3.5],
          y: [-1.5, 6],
          curves: [
            { expr: "x^2", label: "y = x^2" },
            { expr: "1 + (2 + h)(x - 1)", label: "\\text{secant, slope } {=2 + h}", color: 2 },
            { expr: "2x - 1", label: "\\text{tangent, slope } 2", color: 3, dashed: true },
          ],
          points: [
            { x: 1, y: 1, label: "P" },
            { x: "1 + h", y: "(1 + h)^2", label: "Q", color: 2 },
          ],
          params: [{ name: "h", tex: "h", min: -1.9, max: 2, step: 0.1, value: 1 }],
          caption: md`Slide $h$ toward 0 from either side. $Q$ slides along the parabola into $P = (1, 1)$ and the orange secant swings toward the dashed line of slope 2. (At $h = 0$ exactly there is no secant, since $Q = P$; the picture there shows the line the secants were heading for.)`,
        },
        {
          kind: "text",
          body: md`Numbers first. For $y = x^2$ at $a = 1$, the secant slope is $\frac{(1 + h)^2 - 1}{h}$:

$$\begin{array}{c|ccccc} h & 1 & 0.5 & 0.1 & 0.01 & 0.001 \\ \hline m_{PQ} & 3 & 2.5 & 2.1 & 2.01 & 2.001 \end{array} \qquad \begin{array}{c|ccc} h & -0.1 & -0.01 & -0.001 \\ \hline m_{PQ} & 1.9 & 1.99 & 1.999 \end{array}$$

From both sides the slopes crowd toward 2. That is Lesson 1's situation exactly: a $\frac{0}{0}$ expression at $h = 0$ with a clear trend nearby.`,
        },
        {
          kind: "why",
          title: "Why the slope is exactly 2",
          body: md`For $h \ne 0$,

$$\frac{(1 + h)^2 - 1}{h} = \frac{1 + 2h + h^2 - 1}{h} = \frac{2h + h^2}{h} = \frac{h(2 + h)}{h} = 2 + h.$$

The secant slope is $2 + h$: the tangent slope 2 plus an error of exactly $h$. Shrinking $h$ shrinks the error to nothing, so $\lim_{h \to 0}(2 + h) = 2$. Factor, cancel, substitute, the same three moves as Lesson 1. The table's guess becomes a fact.`,
        },
        {
          kind: "example",
          title: "The slope of y = x² everywhere at once",
          problem: md`Find the slope of the tangent line to $y = x^2$ at a general point $x = a$.`,
          steps: [
            { math: md`\frac{(a + h)^2 - a^2}{h} = \frac{a^2 + 2ah + h^2 - a^2}{h}`, note: "Set up the difference quotient and expand." },
            { math: md`= \frac{h(2a + h)}{h} = 2a + h \qquad (h \ne 0)`, note: md`The $a^2$ terms cancel; every surviving term has a factor $h$.` },
            { math: md`\lim_{h \to 0} (2a + h) = 2a`, note: md`At $x = 1$ the slope is 2, at $x = 3$ it is 6, at $x = -2$ it is $-4$. One calculation covers every point of the parabola.` },
          ],
        },
        {
          kind: "key",
          title: "The derivative (a preview)",
          body: md`The tangent slope at $x = a$ is called the **derivative** of $f$ at $a$, written $f'(a)$:

$$f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h}.$$

We just showed that for $f(x) = x^2$, $f'(a) = 2a$. The derivative is the central object of Calculus 1; there you will learn rules that produce it without a limit each time. Here the point is that the limit is what it *means*.`,
        },
        {
          kind: "why",
          title: "Why a limit, and not just h = 0?",
          body: md`Set $h = 0$ and $Q$ becomes $P$. One point determines no line, and the quotient reads $\frac{0}{0}$. A slope "at a single point" has no direct meaning; it only makes sense as the value the two-point slopes approach. The limit is not a trick for dodging division by zero. It is the definition.

The same reason rules out the old "touches at one point" idea. The vertical line $x = 1$ meets $y = x^2$ only at $(1, 1)$, yet nobody would call it tangent there. And the line $y = 0$ is the tangent to $y = x^3$ at the origin even though it crosses the curve. What makes a line tangent is matching the curve's direction, and direction is a limit of secant slopes.`,
        },
        {
          kind: "example",
          title: "A tangent to a hyperbola",
          problem: md`Find the slope of the tangent line to $y = \frac{1}{x}$ at $x = 2$.`,
          steps: [
            { math: md`\frac{\frac{1}{2 + h} - \frac{1}{2}}{h}`, note: md`The difference quotient with $a = 2$.` },
            { math: md`\frac{1}{2 + h} - \frac{1}{2} = \frac{2 - (2 + h)}{2(2 + h)} = \frac{-h}{2(2 + h)}`, note: "Combine the top over a common denominator. Only a multiple of $h$ survives." },
            { math: md`\frac{-h}{2(2 + h)} \cdot \frac{1}{h} = \frac{-1}{2(2 + h)} \qquad (h \ne 0)`, note: md`Dividing by $h$ cancels the $h$ on top.` },
            { math: md`\lim_{h \to 0} \frac{-1}{2(2 + h)} = -\frac{1}{4}`, note: md`Negative, as it should be: $y = \frac{1}{x}$ falls as $x$ increases.` },
          ],
        },
        {
          kind: "example",
          title: "From slope to line",
          problem: md`Find the equation of the tangent line to $y = x^2$ at $(1, 1)$.`,
          steps: [
            { math: md`m = f'(1) = 2 \cdot 1 = 2`, note: md`From $f'(a) = 2a$.` },
            { math: md`y - 1 = 2(x - 1)`, note: "Point-slope form through the point of tangency." },
            { math: md`y = 2x - 1`, note: md`Check: at $x = 1$, $y = 1$. The line passes through $P$ with the right slope.` },
          ],
        },
        {
          kind: "proof",
          title: "The tangent to a parabola touches it exactly once, from below",
          given: md`$f(x) = x^2$ and a point $x = a$`,
          prove: md`The tangent line at $x = a$ is $y = 2ax - a^2$, and $x^2 \ge 2ax - a^2$ for every $x$, with equality only at $x = a$`,
          steps: [
            { statement: md`$f'(a) = \lim_{h \to 0} \frac{(a + h)^2 - a^2}{h} = 2a$`, reason: "Shown in the example above (expand, cancel, let $h \to 0$)" },
            { statement: md`The tangent line is $y - a^2 = 2a(x - a)$, i.e. $y = 2ax - a^2$`, reason: md`Point-slope form through $(a, a^2)$ with slope $2a$` },
            { statement: md`$x^2 - (2ax - a^2) = x^2 - 2ax + a^2 = (x - a)^2$`, reason: "Algebra: a perfect square" },
            { statement: md`$(x - a)^2 \ge 0$, with equality only when $x = a$`, reason: "A real square is never negative and is zero only when its base is zero" },
            { statement: md`$x^2 \ge 2ax - a^2$ for all $x$, with equality only at $x = a$`, reason: "Steps 3 and 4: the parabola sits on or above its tangent and meets it only at the point of tangency" },
          ],
        },
        {
          kind: "text",
          body: md`The proof gives a second way to recognise the tangent to a parabola: it is the one line through $(a, a^2)$ that the parabola meets exactly once, touching without crossing. For $y = x^2 + bx + c$ the same algebra gives $f(x) - (\text{tangent}) = (x - a)^2$ again, so the shortcut $f'(a) = 2a + b$ can always be checked this way.

Back to speed. A dropped stone falls $s(t) = 16t^2$ feet in $t$ seconds. Its average speed over $[1, 1 + h]$ is $\frac{16(1 + h)^2 - 16}{h} = 32 + 16h$ feet per second, and as $h \to 0$ this is $32$. The stone's speed at the instant $t = 1$ is 32 ft/s: a tangent slope, and the answer to a question arithmetic alone cannot ask.`,
        },
        {
          kind: "check",
          prompt: md`Find $\lim_{h \to 0} \frac{(3 + h)^2 - 9}{h}$.`,
          answer: "6",
          explain: md`$(3 + h)^2 - 9 = 6h + h^2 = h(6 + h)$, so the quotient is $6 + h$ for $h \ne 0$, and $6 + h \to 6$. This is the slope of $y = x^2$ at $x = 3$.`,
        },
        {
          kind: "check",
          prompt: md`Find the tangent line to $y = x^2$ at $x = -2$. Type the right side of $y = \ldots$ as an expression in $x$.`,
          answer: "-4x - 4",
          explain: md`Slope $f'(-2) = 2(-2) = -4$, through $(-2, 4)$: $y - 4 = -4(x + 2)$, so $y = -4x - 4$.`,
        },
      ],
      practice: [tangentSlopeLimit, secantSlope, tangentLineEquation],
    },
    {
      id: slug("The area problem"),
      title: "The area problem",
      summary: "Rectangle sums estimate the area under a curve, and as the rectangles get thinner they close in on the exact area.",
      blocks: [
        {
          kind: "text",
          body: md`Geometry measures polygons by cutting them into triangles, and circles by squeezing them between polygons. Now take the region under $y = x^2$ from $x = 0$ to $x = 1$: flat on the bottom, straight on the right, curved on top. No formula from Geometry fits it.

The plan is the one Archimedes used for the circle. Cover the region with shapes we *can* measure, rectangles, and make the fit better and better.`,
        },
        {
          kind: "key",
          title: "Riemann sums",
          body: md`To estimate the area under $y = f(x)$ on $[a, b]$, cut $[a, b]$ into $n$ equal pieces of width $\Delta x = \frac{b - a}{n}$. On each piece stand a rectangle whose height is the value of $f$ at a chosen point of the piece:

- the **left sum** $L_n$ uses the left end of each piece,
- the **right sum** $R_n$ uses the right end,
- the **midpoint sum** uses the middle.

Each rectangle has area $\text{height} \times \Delta x$, and the sum of the $n$ areas is the estimate.`,
        },
        {
          kind: "plot",
          x: [-0.2, 1.3],
          y: [-0.15, 1.2],
          curves: [{ expr: "x^2", label: "y = x^2,\\quad L_{n} = {=(n - 1) n (2n - 1) / (6 n^3)},\\quad R_{n} = {=(n + 1)(2n + 1) / (6 n^2)}" }],
          riemann: { expr: "x^2", from: 0, to: 1, n: "n", method: "left" },
          params: [{ name: "n", tex: "n", min: 1, max: 60, step: 1, value: 4 }],
          caption: md`Left rectangles under $y = x^2$ on $[0, 1]$. Slide $n$ up. The gaps between the rectangles and the curve shrink, and the left and right sums (shown in the legend) move toward each other.`,
        },
        {
          kind: "example",
          title: "Left and right sums with n = 4",
          problem: md`Estimate the area under $y = x^2$ on $[0, 1]$ with four rectangles, using left endpoints and then right endpoints.`,
          steps: [
            { math: md`\Delta x = \frac{1 - 0}{4} = \frac{1}{4}`, note: md`Pieces: $[0, \frac14], [\frac14, \frac12], [\frac12, \frac34], [\frac34, 1]$.` },
            { math: md`L_4 = \frac14\left(0^2 + \left(\tfrac14\right)^2 + \left(\tfrac12\right)^2 + \left(\tfrac34\right)^2\right) = \frac14 \cdot \frac{14}{16} = \frac{7}{32}`, note: md`Left ends $0, \frac14, \frac12, \frac34$. Heights $0, \frac1{16}, \frac14, \frac9{16}$. $L_4 = 0.21875$.` },
            { math: md`R_4 = \frac14\left(\left(\tfrac14\right)^2 + \left(\tfrac12\right)^2 + \left(\tfrac34\right)^2 + 1^2\right) = \frac14 \cdot \frac{30}{16} = \frac{15}{32}`, note: md`Right ends $\frac14, \frac12, \frac34, 1$. $R_4 = 0.46875$.` },
            { math: md`\frac{7}{32} \le A \le \frac{15}{32}`, note: "The true area is trapped between them. Not a great estimate yet, but an honest one." },
          ],
        },
        {
          kind: "why",
          title: "Why the area is squeezed, and why the squeeze closes",
          body: md`On $[0, 1]$, $y = x^2$ rises. So on each piece the curve is lowest at the left end and highest at the right end: the left rectangle fits inside the strip under the curve, and the right rectangle covers it. Adding up, $L_n \le A \le R_n$ for every $n$.

How far apart are they? Every interior height appears in both sums; only the ends differ:

$$R_n - L_n = \Delta x \,\big(f(1) - f(0)\big) = \frac{1}{n}(1 - 0) = \frac{1}{n}.$$

As $n$ grows, $\frac{1}{n} \to 0$. Two numbers that trap $A$ and get arbitrarily close to each other must both be heading for $A$. So the exact area is $\lim_{n \to \infty} L_n = \lim_{n \to \infty} R_n$, if we can compute either one.`,
        },
        {
          kind: "text",
          body: md`The numbers agree:

$$\begin{array}{c|cccc} n & 4 & 10 & 100 & 1000 \\ \hline L_n & 0.21875 & 0.285 & 0.32835 & 0.3328335 \\ R_n & 0.46875 & 0.385 & 0.33835 & 0.3338335 \end{array}$$

Both rows crowd toward $0.333\ldots = \frac{1}{3}$. A table suggests; now we prove it, with a formula from Unit 7.`,
        },
        {
          kind: "proof",
          title: "The area under y = x² from 0 to 1 is 1/3",
          given: md`$R_n$ is the right Riemann sum for $y = x^2$ on $[0, 1]$ with $n$ rectangles, and $\sum_{k=1}^{n} k^2 = \frac{n(n + 1)(2n + 1)}{6}$`,
          prove: md`$\lim_{n \to \infty} R_n = \frac{1}{3}$, so the area is $\frac{1}{3}$`,
          steps: [
            { statement: md`$\Delta x = \frac{1}{n}$ and the right endpoints are $x_k = \frac{k}{n}$ for $k = 1, 2, \ldots, n$`, reason: md`$n$ equal pieces of $[0, 1]$` },
            { statement: md`$R_n = \sum_{k=1}^{n} \left(\frac{k}{n}\right)^2 \cdot \frac{1}{n} = \frac{1}{n^3} \sum_{k=1}^{n} k^2$`, reason: "Definition of the right sum; the common factor comes out of the sum" },
            { statement: md`$R_n = \frac{n(n + 1)(2n + 1)}{6n^3}$`, reason: "The sum-of-squares formula, proved by induction in Unit 7" },
            { statement: md`$R_n = \frac{1}{6}\left(1 + \frac{1}{n}\right)\left(2 + \frac{1}{n}\right)$`, reason: md`Divide each of the three factors $n$, $n + 1$, $2n + 1$ by one $n$` },
            { statement: md`$\lim_{n \to \infty} R_n = \frac{1}{6} \cdot 1 \cdot 2 = \frac{1}{3}$`, reason: md`$\frac{1}{n} \to 0$ as $n \to \infty$ (Unit 7)` },
            { statement: md`$L_n = R_n - \frac{1}{n} \to \frac{1}{3}$ too, and $L_n \le A \le R_n$, so $A = \frac{1}{3}$`, reason: "The squeeze from the box above: a number trapped between two sequences with the same limit equals that limit" },
          ],
        },
        {
          kind: "key",
          title: "The exact area is a limit, and calculus has a name for it",
          body: md`The area under $y = f(x)$ on $[a, b]$ is the limit of its Riemann sums as $n \to \infty$. Calculus writes that limit

$$\int_a^b f(x) \, dx,$$

the **definite integral**: a stretched S for "sum", $f(x)$ for the heights, $dx$ for the vanishing width. We have just shown $\int_0^1 x^2 \, dx = \frac{1}{3}$.

Repeating the proof on $[0, b]$ with $\Delta x = \frac{b}{n}$ and $x_k = \frac{kb}{n}$ gives $R_n = \frac{b^3}{n^3}\sum k^2 \to \frac{b^3}{3}$. So $\int_0^b x^2 \, dx = \frac{b^3}{3}$, and the area from $a$ to $b$ is the difference $\frac{b^3}{3} - \frac{a^3}{3}$.`,
        },
        {
          kind: "example",
          title: "Checking against geometry",
          problem: md`Find the area under $y = 2x + 1$ from $x = 0$ to $x = 3$ two ways: by geometry, and as a limit of left sums.`,
          steps: [
            { math: md`A = \frac{1 + 7}{2} \cdot 3 = 12`, note: md`The region is a trapezoid with parallel sides $f(0) = 1$ and $f(3) = 7$ and width 3.` },
            { math: md`L_n = \sum_{k=0}^{n-1} \left(2 \cdot \frac{3k}{n} + 1\right)\frac{3}{n} = \frac{3}{n}\left(\frac{6}{n} \cdot \frac{(n - 1)n}{2} + n\right)`, note: md`Left ends $x_k = \frac{3k}{n}$, widths $\frac{3}{n}$, and $\sum_{k=0}^{n-1} k = \frac{(n-1)n}{2}$ (Unit 7).` },
            { math: md`L_n = \frac{3}{n}(3(n - 1) + n) = \frac{3(4n - 3)}{n} = 12 - \frac{9}{n}`, note: "Simplify." },
            { math: md`\lim_{n \to \infty} \left(12 - \frac{9}{n}\right) = 12`, note: "The rectangle limit agrees with the trapezoid. The new method reproduces the old answers where both apply, which is what gives us confidence in it where only the new one does." },
          ],
        },
        {
          kind: "plot",
          x: [-0.5, 3.5],
          y: [-0.5, 8],
          curves: [{ expr: "2x + 1", label: "y = 2x + 1,\\quad L_{n} = 12 - \\frac{9}{{n}} = {=12 - 9/n}" }],
          riemann: { expr: "2x + 1", from: 0, to: 3, n: "n", method: "left", color: 2 },
          params: [{ name: "n", tex: "n", min: 1, max: 60, step: 1, value: 3 }],
          caption: md`Left rectangles under $y = 2x + 1$. The missing triangles along the top are the $\frac{9}{n}$ shortfall; each extra rectangle shrinks them.`,
        },
        {
          kind: "why",
          title: "Why do slopes and areas belong in the same course?",
          body: md`Lesson 2 took a position graph and found speed as a tangent slope. Turn it around: start from a speed graph. Over a short time $\Delta t$ at speed $v$, you travel about $v \, \Delta t$, which is the area of a thin rectangle under the speed graph. Add them up and let $\Delta t \to 0$: distance travelled is the *area* under the speed curve.

So slope turns position into speed, and area turns speed back into position. The two problems of this unit are inverses of each other. That fact, the Fundamental Theorem of Calculus, is where the next course is heading.`,
        },
        {
          kind: "check",
          prompt: md`Find the right Riemann sum $R_4$ for $y = x^2$ on $[0, 2]$. Give the exact value as a fraction.`,
          answer: "15/4",
          explain: md`$\Delta x = \frac12$, right ends $\frac12, 1, \frac32, 2$, heights $\frac14, 1, \frac94, 4$. Sum $= \frac{30}{4} = \frac{15}{2}$, times $\frac12$ gives $\frac{15}{4}$. The exact area is $\frac{2^3}{3} = \frac83 \approx 2.67$, and $R_4 = 3.75$ overshoots, as a right sum of a rising function must.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $\int_{0}^{2} x^2 \, dx$, the exact area under the parabola from 0 to 2. Fractions are fine.`,
          answer: "8/3",
          explain: md`$\int_0^b x^2 \, dx = \frac{b^3}{3}$ with $b = 2$: $\frac{8}{3}$.`,
        },
      ],
      practice: [riemannSum, exactArea, underOrOver],
    },
  ],
};
