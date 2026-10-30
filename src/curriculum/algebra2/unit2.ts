import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, type Figure, type Generator, type Step, type Unit } from "../types";

// ── Shared wording ──────────────────────────────────────────────────────────

const POINT = "Give the point as (x, y).";
const ABI = md`Write the answer in the form $a + bi$, leaving out a part that is 0 (write $5i$, not $0 + 5i$).`;
const ROOT_I = md`Simplify any square root (type $2\sqrt{3}\,i$ as 2sqrt(3)i).`;
const SOLS_C = md`Give all solutions, separated by commas, in the form $a + bi$. You can use ±, typed as +/-, like 2 +/- 3i.`;

// ── Formatting helpers ──────────────────────────────────────────────────────

/** ax^2 + bx + c, written the way a person would. */
const quad = (a: number, b: number, c: number) => poly([[a, "x^2"], [b, "x"], [c, ""]]);

/** The factor (x - r), or just x when r = 0. */
const fac = (r: number) => (r === 0 ? "x" : `(${poly([[1, "x"], [-r, ""]])})`);

/** A leading coefficient: "" for 1, "-" for -1. */
const lead = (a: number) => (a === 1 ? "" : a === -1 ? "-" : String(a));

/** a(x - h)^2 + k */
function vertexForm(a: number, h: number, k: number): string {
  const sq = h === 0 ? "x^2" : `${fac(h)}^2`;
  return `${lead(a)}${sq}${k === 0 ? "" : ` ${signed(k)}`}`;
}

/** f(t) for f(x) = ax^2 + bx + c, as plain text for hidden verify equations. */
const fAt = (a: number, b: number, c: number, t: string) => `(${a})(${t})^2 + (${b})(${t}) + (${c})`;

/** a + bi with integer parts, as answer text (also valid LaTeX). */
const cx = (re: number, im: number) => poly([[re, ""], [im, "i"]]);

/** n = k^2 m with m square-free. */
function surd(n: number): [number, number] {
  let k = 1;
  for (let f = 2; f * f <= n; f++) {
    while (n % (f * f) === 0) {
      n /= f * f;
      k *= f;
    }
  }
  return [k, n];
}

/** k·√m (k > 0) as answer text and LaTeX; m = 1 means no root. */
function rootTerm(k: number, m: number): { text: string; tex: string } {
  if (m === 1) return { text: String(k), tex: String(k) };
  const c = k === 1 ? "" : String(k);
  return { text: `${c}sqrt(${m})`, tex: md`${c}\sqrt{${m}}` };
}

/** k·√m·i (k > 0) as answer text and LaTeX. */
function imagTerm(k: number, m: number): { text: string; tex: string } {
  const c = k === 1 ? "" : String(k);
  if (m === 1) return { text: `${c}i`, tex: `${c}i` };
  return { text: `${c}sqrt(${m})i`, tex: md`${c}i\sqrt{${m}}` };
}

/** (k√m / d)·i, reduced, as answer text and LaTeX (k, d > 0). */
function imagFraction(k: number, m: number, d: number): { text: string; tex: string } {
  const g = gcd(k, d);
  const [kk, dd] = [k / g, d / g];
  if (dd === 1) return imagTerm(kk, m);
  const top = rootTerm(kk, m);
  return { text: `(${top.text}/${dd})i`, tex: md`\frac{${top.tex}}{${dd}}i` };
}

/** (reN + imN i)/den with integers, each part reduced, as answer text and LaTeX. */
function cxFrac(reN: number, imN: number, den: number): { text: string; tex: string } {
  if (den < 0) [reN, imN, den] = [-reN, -imN, -den];
  const reText = reN === 0 ? "" : frac(reN, den);
  const reTex = reN === 0 ? "" : fracTex(reN, den);
  if (imN === 0) return { text: reText || "0", tex: reTex || "0" };
  const im = imagFraction(Math.abs(imN), 1, den);
  const sign = imN < 0 ? "-" : "+";
  if (!reText) return { text: `${imN < 0 ? "-" : ""}${im.text}`, tex: `${imN < 0 ? "-" : ""}${im.tex}` };
  return { text: `${reText} ${sign} ${im.text}`, tex: `${reTex} ${sign} ${im.tex}` };
}

/** p ± (imaginary part) as a solution list and a LaTeX line. */
function pmAnswer(reText: string, reTex: string, im: { text: string; tex: string }): { answer: string; tex: string } {
  if (reText === "0") return { answer: `${im.text}, -${im.text}`, tex: md`x = \pm ${im.tex}` };
  return { answer: `${reText} + ${im.text}, ${reText} - ${im.text}`, tex: md`x = ${reTex} \pm ${im.tex}` };
}

// ── Lesson 1: Vertex form ───────────────────────────────────────────────────

/** A random quadratic with integer vertex (h, k), h != 0. */
function pickVertex(r: { int(lo: number, hi: number): number; nonzero(lo: number, hi: number): number }, a: number) {
  const h = r.nonzero(-5, 5);
  const k = r.int(-9, 9);
  return { a, h, k, b: -2 * a * h, c: a * h * h + k };
}

/** Find the vertex with h = -b/(2a), then k = f(h). */
function formulaSteps(a: number, b: number, c: number, h: number, k: number): Step[] {
  return [
    { math: md`h = -\frac{b}{2a} = -\frac{${b}}{${2 * a}} = ${h}`, note: md`Here $a = ${a}$ and $b = ${b}$. This is the axis of symmetry.` },
    {
      math: md`k = f(${h}) = ${lead(a)}(${h})^2 ${signed(b)}(${h}) ${c ? signed(c) : ""} = ${a * h * h} ${signed(b * h)} ${c ? signed(c) : ""} = ${k}`,
      note: "The height of the vertex is the value of the function there.",
    },
  ];
}

/** Rewrite ax^2 + bx + c in vertex form by completing the square. */
function squareSteps(a: number, b: number, c: number, h: number, k: number): Step[] {
  const hh = h * h;
  if (a === 1) {
    return [
      {
        math: md`y = (${quad(1, b, hh)}) - ${hh} ${c ? signed(c) : ""}`,
        note: md`Half of $${b}$ is $${-h}$, and $${paren(-h)}^2 = ${hh}$. Add and subtract it: that adds 0, so the function doesn't change.`,
      },
      { math: md`y = ${vertexForm(1, h, k)}`, note: c ? md`The group is a perfect square, $${fac(h)}^2$, and $-${hh} ${signed(c)} = ${k}$.` : md`The group is a perfect square, $${fac(h)}^2$.` },
    ];
  }
  return [
    { math: md`y = ${lead(a)}\left(${quad(1, -2 * h, 0)}\right) ${c ? signed(c) : ""}`, note: md`Factor $${a}$ out of the two $x$-terms only: $${b} \div ${paren(a)} = ${-2 * h}$.` },
    {
      math: md`y = ${lead(a)}\left(${quad(1, -2 * h, hh)} - ${hh}\right) ${c ? signed(c) : ""}`,
      note: md`Inside, half of $${-2 * h}$ is $${-h}$, and its square is $${hh}$. Add and subtract it inside the parentheses.`,
    },
    {
      math: md`y = ${lead(a)}${fac(h)}^2 ${signed(-a * hh)} ${c ? signed(c) : ""}`,
      note: md`The $-${hh}$ was inside, so it leaves multiplied by $${a}$: $${a} \cdot (-${hh}) = ${-a * hh}$.`,
    },
    // With c = 0 the line above is already vertex form.
    ...(c ? [{ math: md`y = ${vertexForm(a, h, k)}`, note: "Combine the constants." }] : []),
  ];
}

const vertexOfQuadratic: Generator = (r) => {
  const kind = r.int(0, 2);
  const { a, h, k, b, c } = pickVertex(r, kind === 0 ? 1 : r.pick([2, 3, -1, -2, -3]));
  const steps = kind === 1 ? formulaSteps(a, b, c, h, k) : squareSteps(a, b, c, h, k);
  return {
    prompt: md`Find the vertex of $y = ${quad(a, b, c)}$. ${POINT}`,
    answer: `(${h}, ${k})`,
    form: "tuple",
    // f(h) = k, and the points one step either side are a higher (or lower) by a: that pins down the vertex.
    verify: [`k = ${fAt(a, b, c, "h")}`, `${fAt(a, b, c, "h + 1")} = k + (${a})`, `${fAt(a, b, c, "h - 1")} = k + (${a})`],
    hint:
      kind === 1
        ? md`The vertex is at $h = -\frac{b}{2a}$. Then $k$ is the value of the function at $h$.`
        : a === 1
          ? md`Complete the square: take half of the $x$-coefficient, square it, then add and subtract it.`
          : md`Factor $${a}$ out of the $x$-terms first, then complete the square inside the parentheses.`,
    solution: [...steps, { math: md`\text{vertex } (${h}, ${k})`, note: md`In $a(x - h)^2 + k$ the vertex is $(h, k)$. Watch the sign: $${fac(h)}$ means $h = ${h}$.` }],
  };
};

const quadraticFeatures: Generator = (r) => {
  const kind = r.int(0, 3);
  const { a, h, k, b, c } = pickVertex(r, r.pick([1, 2, 3, -1, -2, -3]));
  const fx = quad(a, b, c);
  const up = a > 0;
  if (kind === 0) {
    const word = up ? "minimum" : "maximum";
    return {
      prompt: md`What is the ${word} value of $f(x) = ${fx}$?`,
      answer: String(k),
      // At the extreme value m, f(x) = m has exactly one solution: its discriminant is 0.
      verify: [`(${b})^2 - 4(${a})((${c}) - m) = 0`],
      hint: md`The ${word} is the $y$-coordinate of the vertex. Find $h = -\frac{b}{2a}$ first.`,
      solution: [
        ...formulaSteps(a, b, c, h, k),
        { math: md`${word === "minimum" ? "\\text{minimum}" : "\\text{maximum}"} = ${k}`, note: md`$a = ${a}$ is ${up ? "positive, so the parabola opens up and the vertex is its lowest point" : "negative, so the parabola opens down and the vertex is its highest point"}.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`The axis of symmetry of $y = ${fx}$ is the line $x = h$. Find $h$.`,
      answer: String(h),
      // Points one step either side of the axis have equal heights.
      verify: [`${fAt(a, b, c, "h + 1")} = ${fAt(a, b, c, "h - 1")}`],
      hint: md`The axis passes through the vertex: $h = -\frac{b}{2a}$.`,
      solution: [
        { math: md`h = -\frac{b}{2a} = -\frac{${b}}{2 \cdot ${paren(a)}}`, note: md`$a = ${a}$ and $b = ${b}$.` },
        { math: md`h = -\frac{${b}}{${2 * a}} = ${h}`, note: md`So the axis is the vertical line $x = ${h}$.` },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`Give the range of $f(x) = ${fx}$ in interval notation (type $\infty$ as inf).`,
      answer: up ? `[${k}, inf)` : `(-inf, ${k}]`,
      form: "inequality",
      hint: md`Find the vertex. Does the parabola open up or down from there?`,
      solution: [
        ...formulaSteps(a, b, c, h, k),
        {
          math: up ? md`f(x) = ${vertexForm(a, h, k)} \ge ${k}` : md`f(x) = ${vertexForm(a, h, k)} \le ${k}`,
          note: md`$a = ${a}$ is ${up ? "positive" : "negative"}, so $${lead(a)}${fac(h)}^2$ is never ${up ? "negative" : "positive"}. Every other value on that side of $${k}$ is reached too.`,
        },
        { math: up ? md`[${k}, \infty)` : md`(-\infty, ${k}]`, note: md`The bracket includes $${k}$, which the vertex reaches.` },
      ],
    };
  }
  return {
    prompt: md`Write $y = ${fx}$ in vertex form $y = a(x - h)^2 + k$. Give the three numbers as (a, h, k).`,
    answer: `(${a}, ${h}, ${k})`,
    form: "tuple",
    // a(x - h)^2 + k must agree with the quadratic at x = 0, 1 and -1; three points fix a quadratic.
    verify: [`a(0 - h)^2 + k = ${c}`, `a(1 - h)^2 + k = ${a + b + c}`, `a(-1 - h)^2 + k = ${a - b + c}`],
    hint: a === 1 ? "Complete the square: half the x-coefficient, squared, added and subtracted." : md`Factor $${a}$ out of the $x$-terms, then complete the square inside.`,
    solution: [...squareSteps(a, b, c, h, k), { math: md`(a, h, k) = (${a}, ${h}, ${k})`, note: md`Match with $a(x - h)^2 + k$. A $${fac(h)}$ means $h = ${h}$.` }],
  };
};

const buildAndApply: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const h = r.int(-4, 4);
    const k = r.int(-6, 6);
    const d = r.pick([-2, -1, 1, 2]);
    const a = r.pick([-3, -2, -1, 1, 2, 3]);
    const [xp, yp] = [h + d, a * d * d + k];
    const lo = Math.min(k, yp) - 2;
    const hi = Math.max(k, yp) + 2;
    const figure: Figure = {
      kind: "plot",
      x: [h - 4, h + 4],
      y: [lo, hi],
      curves: [{ expr: vertexForm(a, h, k) }],
      points: [
        { x: h, y: k, label: md`\text{vertex } (${h}, ${k})`, color: 2 },
        { x: xp, y: yp, label: md`(${xp}, ${yp})`, color: 4 },
      ],
    };
    return {
      prompt: md`A parabola has vertex $(${h}, ${k})$ and passes through $(${xp}, ${yp})$. Its equation is $y = a(x - h)^2 + k$. Find $a$.`,
      answer: String(a),
      figure,
      verify: [`(${yp}) = a((${xp}) - (${h}))^2 + (${k})`],
      hint: md`Put the vertex into $y = a(x - h)^2 + k$, then substitute the other point for $x$ and $y$.`,
      solution: [
        { math: md`y = a${fac(h)}^2 ${k ? signed(k) : ""}`, note: "The vertex gives h and k. Only a is unknown." },
        { math: md`${yp} = a(${xp} - ${paren(h)})^2 ${k ? signed(k) : ""}`, note: md`The point $(${xp}, ${yp})$ is on the graph, so it satisfies the equation.` },
        { math: md`${yp} = ${d * d === 1 ? "" : d * d}a ${k ? signed(k) : ""}`, note: md`$(${xp} - ${paren(h)})^2 = ${paren(d)}^2 = ${d * d}$.` },
        { math: d * d === 1 ? (k ? md`a = ${yp} ${signed(-k)} = ${a}` : md`a = ${a}`) : md`a = \frac{${yp - k}}{${d * d}} = ${a}`, note: md`So $y = ${vertexForm(a, h, k)}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, 2, 3, -1, -2]);
    const h = r.nonzero(-5, 5);
    const k = r.nonzero(-9, 9);
    const [b, c] = [-2 * a * h, a * h * h + k];
    return {
      prompt: md`Expand $${vertexForm(a, h, k)}$ into standard form $ax^2 + bx + c$.`,
      answer: quad(a, b, c),
      expanded: true,
      simplified: true,
      hint: md`Square the binomial first: $(x - h)^2 = x^2 - 2hx + h^2$. Then ${a === 1 ? "" : md`multiply by $${a}$ and `}combine the constants.`,
      solution: [
        { math: md`${lead(a)}\left(${quad(1, -2 * h, h * h)}\right) ${signed(k)}`, note: md`$${fac(h)}^2 = x^2 ${signed(-2 * h)}x + ${h * h}$: the middle term is twice the product.` },
        ...(a === 1 ? [] : [{ math: md`${quad(a, b, a * h * h)} ${signed(k)}`, note: md`Distribute $${a}$ to every term.` }]),
        { math: quad(a, b, c), note: "Combine the constants." },
      ],
    };
  }
  if (kind === 2) {
    const n = r.int(1, 3);
    const v = 32 * n;
    const s = r.int(2, 12);
    const top = s + 16 * n * n;
    const askTime = r.next() < 0.4;
    const ht = md`h(t) = -16t^2 + ${v}t + ${s}`;
    const steps: Step[] = [
      { math: md`t = -\frac{b}{2a} = -\frac{${v}}{2(-16)} = ${n}`, note: md`The height is a quadratic in $t$ with $a = -16$ and $b = ${v}$. Since $a < 0$ it opens down, so its vertex is the highest point.` },
      { math: md`h(${n}) = -16(${n})^2 + ${v}(${n}) + ${s} = ${-16 * n * n} + ${v * n} + ${s} = ${top}`, note: "The greatest height is the value at the vertex." },
    ];
    return askTime
      ? {
          prompt: md`A ball is thrown straight up. Its height in feet after $t$ seconds is $${ht}$. After how many seconds does it reach its greatest height?`,
          answer: String(n),
          verify: [`-16(t + 1)^2 + ${v}(t + 1) + ${s} = -16(t - 1)^2 + ${v}(t - 1) + ${s}`],
          hint: md`The greatest height is at the vertex, where $t = -\frac{b}{2a}$.`,
          solution: [steps[0]!],
        }
      : {
          prompt: md`A ball is thrown straight up. Its height in feet after $t$ seconds is $${ht}$. What is the greatest height it reaches, in feet?`,
          answer: String(top),
          // h(t) = m has exactly one solution at the greatest height.
          verify: [`(${v})^2 - 4(-16)(${s} - m) = 0`],
          hint: md`Find the time of the vertex, $t = -\frac{b}{2a}$, then the height at that time.`,
          solution: steps,
        };
  }
  const wall = r.next() < 0.5;
  const n = r.int(3, 15);
  const P = 4 * n;
  if (wall) {
    return {
      prompt: md`A rectangular pen is built against a long wall, so fence is needed on only three sides. There are ${P} meters of fence. What is the largest possible area, in square meters?`,
      answer: String(2 * n * n),
      // x(P - 2x) = A has exactly one solution at the largest area.
      verify: [`(${P})^2 - 8A = 0`],
      hint: md`Call the two sides that meet the wall $x$. The side opposite the wall is then $${P} - 2x$.`,
      solution: [
        { math: md`A = x(${P} - 2x) = -2x^2 + ${P}x`, note: md`Two sides of length $x$ and one of length $${P} - 2x$ use all ${P} meters.` },
        { math: md`x = -\frac{${P}}{2(-2)} = ${n}`, note: "The parabola opens down, so the vertex gives the largest area." },
        { math: md`A = ${n}(${P} - ${2 * n}) = ${n} \cdot ${2 * n} = ${2 * n * n}`, note: md`The best pen is ${n} by ${2 * n}: the side along the wall is twice the others.` },
      ],
    };
  }
  return {
    prompt: md`A rectangle has a perimeter of ${P} meters. What is the largest possible area, in square meters?`,
    answer: String(n * n),
    // x(P/2 - x) = A has exactly one solution at the largest area.
    verify: [`(${P / 2})^2 - 4A = 0`],
    hint: md`If one side is $x$, the other is $${P / 2} - x$. Write the area and find its vertex.`,
    solution: [
      { math: md`A = x(${P / 2} - x) = -x^2 + ${P / 2}x`, note: md`Two sides of each kind: $2x + 2(${P / 2} - x) = ${P}$.` },
      { math: md`A = -(x - ${n})^2 + ${n * n}`, note: md`Complete the square: half of $${P / 2}$ is $${n}$, and $${n}^2 = ${n * n}$.` },
      { math: md`A_{\max} = ${n * n}`, note: md`The area is ${n * n} minus a square, so it's largest when the square is 0, at $x = ${n}$: a ${n} by ${n} square.` },
    ],
  };
};

// ── Lesson 2: Imaginary and complex numbers ─────────────────────────────────

const POW_I = ["1", "i", "-1", "-i"];

const rootsAndPowers: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const m = r.int(1, 6);
    const s = r.pick([1, 1, 2, 3, 5, 6, 7]);
    const n = m * m * s;
    if (n === 1) {
      return {
        prompt: md`Simplify $\sqrt{-1}$.`,
        answer: "i",
        complex: true,
        simplified: true,
        hint: md`What number squares to $-1$?`,
        solution: [{ math: md`\sqrt{-1} = i`, note: md`$i$ is defined as the number with $i^2 = -1$, and $\sqrt{-1}$ names it.` }],
      };
    }
    const t = imagTerm(m, s);
    return {
      prompt: md`Simplify $\sqrt{-${n}}$. Write it as a multiple of $i$. ${ROOT_I}`,
      answer: t.text,
      complex: true,
      simplified: true,
      hint: md`For $a > 0$, $\sqrt{-a} = i\sqrt{a}$. Then look for a perfect square inside the root.`,
      solution: [
        { math: md`\sqrt{-${n}} = i\sqrt{${n}}`, note: md`$(i\sqrt{${n}})^2 = i^2 \cdot ${n} = -${n}$.` },
        ...(s === 1
          ? [{ math: md`i\sqrt{${n}} = ${t.tex}`, note: md`$${n} = ${m}^2$.` }]
          : m === 1
            ? [{ math: t.tex, note: md`${s} has no square factor, so the root is already simplified.` }]
            : [{ math: md`i\sqrt{${m * m} \cdot ${s}} = ${t.tex}`, note: md`$${m * m}$ is a perfect square, and $\sqrt{${m * m}} = ${m}$.` }]),
      ],
    };
  }
  if (kind === 1) {
    const n = r.int(5, 60);
    const q = Math.floor(n / 4);
    const rem = n % 4;
    return {
      prompt: md`Simplify $i^{${n}}$.`,
      answer: POW_I[rem]!,
      complex: true,
      simplified: true,
      hint: md`$i^4 = 1$, so powers of $i$ repeat every 4. Divide ${n} by 4 and use the remainder.`,
      solution: [
        { math: md`${n} = 4 \cdot ${q} + ${rem}`, note: "Split off as many fours as possible." },
        { math: md`i^{${n}} = (i^4)^{${q}} \cdot i^{${rem}} = 1^{${q}} \cdot i^{${rem}}`, note: md`Exponent rules, and $i^4 = (i^2)^2 = (-1)^2 = 1$.` },
        { math: md`i^{${n}} = ${POW_I[rem]!}`, note: md`$i^0 = 1$, $i^1 = i$, $i^2 = -1$, $i^3 = -i$.` },
      ],
    };
  }
  if (kind === 2) {
    const s = r.pick([2, 3, 5]);
    const m1 = r.int(1, 3);
    let m2 = r.int(1, 4);
    while (m2 === m1) m2 = r.int(1, 4);
    const [p, q] = [s * m1 * m1, s * m2 * m2];
    const both = r.next() < 0.6;
    if (both) {
      return {
        prompt: md`Simplify $\sqrt{-${p}} \cdot \sqrt{-${q}}$.`,
        answer: String(-s * m1 * m2),
        complex: true,
        simplified: true,
        hint: md`Write each root with $i$ first. The rule $\sqrt{a}\sqrt{b} = \sqrt{ab}$ only holds when $a, b \ge 0$.`,
        solution: [
          { math: md`\sqrt{-${p}} \cdot \sqrt{-${q}} = i\sqrt{${p}} \cdot i\sqrt{${q}}`, note: "Take the i out of each root first." },
          { math: md`= i^2 \sqrt{${p * q}}`, note: md`Now both numbers under the roots are positive, so $\sqrt{${p}}\sqrt{${q}} = \sqrt{${p * q}}$ is safe.` },
          { math: md`= -1 \cdot ${s * m1 * m2} = ${-s * m1 * m2}`, note: md`$\sqrt{${p * q}} = ${s * m1 * m2}$. Not $+${s * m1 * m2}$: that's the trap.` },
        ],
      };
    }
    return {
      prompt: md`Simplify $\sqrt{-${p}} \cdot \sqrt{${q}}$. ${ABI}`,
      answer: `${s * m1 * m2}i`,
      complex: true,
      simplified: true,
      hint: md`Write $\sqrt{-${p}}$ as $i\sqrt{${p}}$ first.`,
      solution: [
        { math: md`\sqrt{-${p}} \cdot \sqrt{${q}} = i\sqrt{${p}}\sqrt{${q}}`, note: "Take the i out of the negative root." },
        { math: md`= i\sqrt{${p * q}} = ${s * m1 * m2}i`, note: md`Both are positive now, so the roots combine: $\sqrt{${p * q}} = ${s * m1 * m2}$.` },
      ],
    };
  }
  const a = r.coef(-6, 6);
  const b = r.coef(-6, 6);
  return {
    prompt: md`Simplify $(${a}i)(${b}i)$.`,
    answer: String(-a * b),
    complex: true,
    simplified: true,
    hint: md`Multiply the numbers, multiply the $i$'s, and use $i^2 = -1$.`,
    solution: [
      { math: md`(${a}i)(${b}i) = ${a * b}i^2`, note: "Commutative and associative laws: numbers together, i's together." },
      { math: md`= ${a * b}(-1) = ${-a * b}`, note: md`$i^2 = -1$.` },
    ],
  };
};

const complexArithmetic: Generator = (r) => {
  const kind = r.int(0, 4);
  const [a, b] = [r.nonzero(-7, 7), r.nonzero(-7, 7)];
  const [c, d] = [r.nonzero(-7, 7), r.nonzero(-7, 7)];
  const z = cx(a, b);
  const w = cx(c, d);
  if (kind === 0 || kind === 1) {
    const plus = kind === 0;
    const [re, im] = plus ? [a + c, b + d] : [a - c, b - d];
    return {
      prompt: md`Simplify $(${z}) ${plus ? "+" : "-"} (${w})$. ${ABI}`,
      answer: cx(re, im),
      complex: true,
      simplified: true,
      hint: plus ? "Add the real parts, then add the imaginary parts." : "Subtract the real parts and the imaginary parts. The minus applies to both parts of the second number.",
      solution: [
        { math: md`(${a} ${plus ? "+" : "-"} ${paren(c)}) + (${b} ${plus ? "+" : "-"} ${paren(d)})i`, note: md`Group the real parts and the $i$ parts, like combining like terms.` },
        { math: cx(re, im), note: "" },
      ],
    };
  }
  if (kind === 2) {
    const [re, im] = [a * c - b * d, a * d + b * c];
    return {
      prompt: md`Simplify $(${z})(${w})$. ${ABI}`,
      answer: cx(re, im),
      complex: true,
      simplified: true,
      hint: md`Distribute (FOIL), then replace $i^2$ with $-1$.`,
      solution: [
        { math: poly([[a * c, ""], [a * d, "i"], [b * c, "i"], [b * d, "i^2"]]), note: "Multiply every term by every term." },
        { math: poly([[a * c, ""], [a * d + b * c, "i"], [-b * d, ""]]), note: md`Combine the $i$ terms, and $${poly([[b * d, "i^2"]])} = ${Math.abs(b * d) === 1 ? "" : md`${b * d}(-1) = `}${-b * d}$.` },
        { math: cx(re, im), note: "Combine the real parts." },
      ],
    };
  }
  if (kind === 3) {
    const [re, im] = [a * a - b * b, 2 * a * b];
    return {
      prompt: md`Simplify $(${z})^2$. ${ABI}`,
      answer: cx(re, im),
      complex: true,
      simplified: true,
      hint: md`Square the binomial: $(a + bi)^2 = a^2 + 2abi + b^2i^2$.`,
      solution: [
        { math: md`(${z})^2 = ${poly([[a * a, ""], [2 * a * b, "i"], [b * b, "i^2"]])}`, note: md`$(p + q)^2 = p^2 + 2pq + q^2$ with $p = ${a}$ and $q = ${b === 1 ? "" : b === -1 ? "-" : b}i$.` },
        { math: md`= ${a * a} ${signed(2 * a * b)}i - ${b * b}`, note: md`$i^2 = -1$.` },
        { math: cx(re, im), note: "Combine the real parts." },
      ],
    };
  }
  const k = r.pick([-1, 1, 2, -2, 3]);
  const [re, im] = [-k * b, k * a];
  const ki = k === 1 ? "i" : k === -1 ? "-i" : `${k}i`;
  return {
    prompt: md`Simplify $${ki}(${z})$. ${ABI}`,
    answer: cx(re, im),
    complex: true,
    simplified: true,
    hint: md`Distribute $${ki}$, then use $i^2 = -1$.`,
    solution: [
      { math: md`${ki}(${z}) = ${poly([[k * a, "i"], [k * b, "i^2"]])}`, note: "Distribute." },
      { math: md`= ${poly([[k * a, "i"], [-k * b, ""]])}`, note: md`$i^2 = -1$.` },
      { math: cx(re, im), note: "Write the real part first." },
    ],
  };
};

const conjugatesAndDivision: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [a, b] = [r.nonzero(-8, 8), r.int(1, 8)];
    return {
      prompt: md`Simplify $(${cx(a, b)})(${cx(a, -b)})$.`,
      answer: String(a * a + b * b),
      complex: true,
      simplified: true,
      hint: md`These are conjugates. $(a + bi)(a - bi) = a^2 + b^2$.`,
      solution: [
        { math: poly([[a * a, ""], [-a * b, "i"], [a * b, "i"], [-b * b, "i^2"]]), note: "Distribute. The two middle terms cancel." },
        { math: md`${a * a} + ${b * b} = ${a * a + b * b}`, note: md`$${poly([[-b * b, "i^2"]])} = +${b * b}$. A number times its conjugate is always real.` },
      ],
    };
  }
  if (kind === 1 || kind === 2) {
    const [c, d] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
    const [a, b] = kind === 1 ? [r.int(1, 10) * r.sign(), 0] : [r.nonzero(-8, 8), r.nonzero(-8, 8)];
    const D = c * c + d * d;
    const [reN, imN] = [a * c + b * d, b * c - a * d];
    const ans = cxFrac(reN, imN, D);
    const top = kind === 1 ? String(a) : cx(a, b);
    return {
      prompt: md`Simplify $\frac{${top}}{${cx(c, d)}}$. ${ABI}`,
      answer: ans.text,
      complex: true,
      simplified: true,
      hint: md`Multiply the top and bottom by the conjugate of the bottom, $${cx(c, -d)}$.`,
      solution: [
        { math: md`\frac{${top}}{${cx(c, d)}} \cdot \frac{${cx(c, -d)}}{${cx(c, -d)}}`, note: "Multiplying by this fraction is multiplying by 1." },
        { math: md`\text{bottom: } (${cx(c, d)})(${cx(c, -d)}) = ${c * c} + ${d * d} = ${D}`, note: "Conjugates multiply to a real number." },
        kind === 1
          ? { math: md`\text{top: } ${a}(${cx(c, -d)}) = ${cx(a * c, -a * d)}`, note: "Distribute." }
          : {
              math: md`\text{top: } (${cx(a, b)})(${cx(c, -d)}) = ${poly([[a * c, ""], [-a * d, "i"], [b * c, "i"], [-b * d, "i^2"]])} = ${cx(reN, imN)}`,
              note: md`$i^2 = -1$, so $${poly([[-b * d, "i^2"]])} = ${b * d}$.`,
            },
        { math: md`\frac{${cx(reN, imN)}}{${D}} = ${ans.tex}`, note: "Divide each part by the real denominator, and reduce." },
      ],
    };
  }
  if (kind === 3) {
    const k = r.pick([2, 3, 4, -2, -3]);
    const [p, q] = [r.nonzero(-5, 5), r.nonzero(-5, 5)];
    const [a, b] = [k * p, k * q];
    // (a + bi)/(ki) = (a + bi)(-i)/k = (b - ai)/k = q - p i
    return {
      prompt: md`Simplify $\frac{${cx(a, b)}}{${k}i}$. ${ABI}`,
      answer: cx(q, -p),
      complex: true,
      simplified: true,
      hint: md`Multiply the top and bottom by $i$, so the bottom becomes $${k}i^2 = ${-k}$.`,
      solution: [
        { math: md`\frac{${cx(a, b)}}{${k}i} \cdot \frac{i}{i} = \frac{${poly([[a, "i"], [b, "i^2"]])}}{${k}i^2}`, note: "Multiply by i/i, which is 1." },
        { math: md`= \frac{${poly([[a, "i"], [-b, ""]])}}{${-k}}`, note: md`$i^2 = -1$ on the top and the bottom.` },
        { math: cx(q, -p), note: md`Divide each part by $${-k}$.` },
      ],
    };
  }
  const [a, b] = [r.nonzero(-6, 6), r.nonzero(-6, 6)];
  const n = a * a + b * b;
  const [k, m] = surd(n);
  const ans = rootTerm(k, m);
  const z = cx(a, b);
  const figure: Figure = {
    kind: "diagram",
    grid: true,
    view: [Math.min(0, a) - 1.5, Math.max(0, a) + 1.5, Math.min(0, b) - 1.5, Math.max(0, b) + 1.5],
    points: [
      { name: "O", x: 0, y: 0, label: "0", dir: a > 0 ? "w" : "e" },
      { name: "Z", x: a, y: b, label: "z", dir: b > 0 ? "n" : "s" },
    ],
    segments: [{ from: "O", to: "Z", arrow: true, color: 1 }],
  };
  return {
    prompt: md`The diagram shows $z = ${z}$ in the complex plane. Find $|z|$. Give an exact answer, with any square root simplified (type $2\sqrt{5}$ as 2sqrt(5)).`,
    answer: ans.text,
    figure,
    complex: true,
    simplified: true,
    verify: [`x^2 = (${z})(${cx(a, -b)})`],
    hint: md`$|a + bi|$ is the distance from 0 to the point $(a, b)$: $\sqrt{a^2 + b^2}$.`,
    solution: [
      { math: md`|z| = \sqrt{${paren(a)}^2 + ${paren(b)}^2}`, note: md`The legs of the right triangle are $|${a}|$ across and $|${b}|$ up or down. Pythagorean Theorem.` },
      { math: md`= \sqrt{${a * a} + ${b * b}} = \sqrt{${n}}`, note: "" },
      ...(k > 1 ? [{ math: md`\sqrt{${n}} = ${ans.tex}`, note: m === 1 ? md`${n} is a perfect square.` : md`$${n} = ${k * k} \cdot ${m}$.` }] : []),
    ],
  };
};

// ── Lesson 3: Complex solutions of quadratics ───────────────────────────────

const squareRootSolve: Generator = (r) => {
  const kind = r.int(0, 3);
  const m = r.int(1, 7);
  const s = r.pick([1, 1, 1, 2, 3, 5]);
  const n = m * m * s;
  const t = imagTerm(m, s);
  const rootSteps = (lhs: string, h: number): Step[] => {
    const res = pmAnswer(String(h), String(h), t);
    const why =
      n === 1
        ? md`$\sqrt{-1} = i$.`
        : s === 1
          ? md`$\sqrt{-${n}} = i\sqrt{${n}} = ${m}i$.`
          : m === 1
            ? md`$\sqrt{-${n}} = i\sqrt{${n}}$, and ${n} has no square factor.`
            : md`$\sqrt{-${n}} = i\sqrt{${n}}$, and $\sqrt{${n}} = \sqrt{${m * m}}\sqrt{${s}} = ${m}\sqrt{${s}}$.`;
    return [
      { math: md`${lhs} = \pm\sqrt{-${n}}`, note: md`Square root property: there are two numbers whose square is $-${n}$.` },
      { math: md`${lhs} = \pm ${t.tex}`, note: why },
      ...(h === 0 ? [] : [{ math: res.tex, note: h > 0 ? md`Add ${h} to both sides.` : md`Subtract ${-h} from both sides.` }]),
    ];
  };
  if (kind === 0 || kind === 1) {
    const a = kind === 0 ? 1 : r.int(2, 4);
    const eq = md`${lead(a)}x^2 + ${a * n} = 0`;
    const res = pmAnswer("0", "0", t);
    return {
      prompt: md`Solve $${eq}$. ${SOLS_C} ${ROOT_I}`,
      answer: res.answer,
      form: "set",
      complex: true,
      simplified: true,
      hint: md`Get $x^2$ alone, then take square roots. $\sqrt{-a} = i\sqrt{a}$.`,
      solution: [
        { math: md`x^2 = -${n}`, note: a === 1 ? md`Subtract ${n}.` : md`Subtract ${a * n}, then divide by ${a}.` },
        ...rootSteps("x", 0),
      ],
    };
  }
  const h = r.nonzero(-6, 6);
  if (kind === 2) {
    const res = pmAnswer(String(h), String(h), t);
    return {
      prompt: md`Solve $${fac(h)}^2 = -${n}$. ${SOLS_C} ${ROOT_I}`,
      answer: res.answer,
      form: "set",
      complex: true,
      simplified: true,
      hint: md`Treat $${fac(h)}$ as one number whose square is $-${n}$.`,
      solution: rootSteps(poly([[1, "x"], [-h, ""]]), h),
    };
  }
  const res = pmAnswer(String(h), String(h), t);
  return {
    prompt: md`Solve $${fac(h)}^2 + ${n} = 0$. ${SOLS_C} ${ROOT_I}`,
    answer: res.answer,
    form: "set",
    complex: true,
    simplified: true,
    hint: md`Subtract ${n}, then take square roots of both sides.`,
    solution: [{ math: md`${fac(h)}^2 = -${n}`, note: md`Subtract ${n} from both sides.` }, ...rootSteps(poly([[1, "x"], [-h, ""]]), h)],
  };
};

/** Solve ax^2 + bx + c = 0 (a > 0) with the quadratic formula, complex roots allowed. */
function complexFormula(a: number, b: number, c: number): { answer: string; steps: Step[] } {
  const D = b * b - 4 * a * c;
  const steps: Step[] = [
    { math: md`a = ${a}, \quad b = ${b}, \quad c = ${c}`, note: "Read the coefficients off standard form, signs included." },
    {
      math: md`b^2 - 4ac = ${paren(b)}^2 - 4(${a})(${c}) = ${b * b} ${signed(-4 * a * c)} = ${D}`,
      note: D < 0 ? "Negative, so the two solutions are not real: they're complex conjugates." : D === 0 ? "Zero, so there is one real solution." : "Positive, so there are two real solutions.",
    },
  ];
  if (D >= 0) {
    const s = Math.sqrt(D);
    steps.push({ math: md`x = \frac{${-b} \pm ${s}}{${2 * a}}`, note: md`$\sqrt{${D}} = ${s}$. The solutions are real this time.` });
    steps.push(
      s === 0
        ? { math: md`x = ${fracTex(-b, 2 * a)}`, note: "Adding or subtracting 0 gives the same number, so there is one solution." }
        : { math: md`x = ${fracTex(-b + s, 2 * a)} \quad\text{or}\quad x = ${fracTex(-b - s, 2 * a)}`, note: "Take the + and the - separately." },
    );
    const roots = [frac(-b + s, 2 * a), frac(-b - s, 2 * a)];
    return { answer: roots[0] === roots[1] ? roots[0]! : roots.join(", "), steps };
  }
  const N = -D;
  const [k, m] = surd(N);
  const it = imagTerm(k, m);
  steps.push({ math: md`\sqrt{${D}} = i\sqrt{${N}}${k > 1 || m === 1 ? md` = ${it.tex}` : ""}`, note: k > 1 && m > 1 ? md`$\sqrt{-a} = i\sqrt{a}$, and $${N} = ${k * k} \cdot ${m}$.` : md`$\sqrt{-a} = i\sqrt{a}$.` });
  steps.push({ math: md`x = \frac{${-b} \pm ${it.tex}}{${2 * a}}`, note: md`Substitute into $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.` });
  const reText = frac(-b, 2 * a);
  const reTex = fracTex(-b, 2 * a);
  const im = imagFraction(k, m, 2 * a);
  const res = pmAnswer(reText, reTex, im);
  steps.push({ math: res.tex, note: "Split into the real part and the imaginary part, and reduce each fraction separately." });
  return { answer: res.answer, steps };
}

const formulaSolve: Generator = (r) => {
  const roll = r.next();
  let a = 1;
  let b: number;
  let c: number;
  if (roll < 0.15) {
    // A real case, so the discriminant still has to be checked.
    const [p, q] = [r.int(-6, 6), r.int(-6, 6)];
    [b, c] = [-(p + q), p * q];
  } else if (roll < 0.45) {
    const p = r.nonzero(-5, 5);
    const q = r.int(1, 6);
    [b, c] = [-2 * p, p * p + q * q];
  } else if (roll < 0.7) {
    b = r.pick([-5, -3, -1, 1, 3, 5]);
    c = r.int(Math.floor((b * b) / 4) + 1, Math.floor((b * b) / 4) + 7);
  } else {
    a = r.int(2, 4);
    b = r.int(-6, 6);
    c = r.int(Math.floor((b * b) / (4 * a)) + 1, Math.floor((b * b) / (4 * a)) + 5);
  }
  const f = complexFormula(a, b, c);
  const rearranged = r.next() < 0.3 && b !== 0;
  const eq = rearranged ? md`${poly([[a, "x^2"], [c, ""]])} = ${poly([[-b, "x"]])}` : md`${quad(a, b, c)} = 0`;
  return {
    prompt: md`Solve $${eq}$. ${SOLS_C} ${ROOT_I}`,
    answer: f.answer,
    form: "set",
    complex: true,
    simplified: true,
    hint: rearranged ? md`Get 0 on one side first, then use the quadratic formula.` : md`Use the quadratic formula. If $b^2 - 4ac < 0$, write $\sqrt{b^2 - 4ac}$ as $i\sqrt{4ac - b^2}$.`,
    solution: rearranged ? [{ math: md`${quad(a, b, c)} = 0`, note: md`Move the $x$-term to the left so the equation is in standard form.` }, ...f.steps] : f.steps,
  };
};

const conjugatePairs: Generator = (r) => {
  const kind = r.int(0, 3);
  const p = r.nonzero(-5, 5);
  const q = r.int(1, 6);
  const [b, c] = [-2 * p, p * p + q * q];
  const plus = cx(p, q);
  const minus = cx(p, -q);
  if (kind === 0) {
    const givenPlus = r.next() < 0.5;
    const [given, other] = givenPlus ? [plus, minus] : [minus, plus];
    return {
      prompt: md`One solution of $${quad(1, b, c)} = 0$ is $${given}$. What is the other solution? ${ABI}`,
      answer: other,
      complex: true,
      simplified: true,
      // It solves the equation, and the two solutions add to -b/a.
      verify: [`x^2 + (${b})x + (${c}) = 0`, `x + (${given}) = ${-b}`],
      hint: "The coefficients are real, so the solutions come in conjugate pairs.",
      solution: [
        { math: md`\overline{${given}} = ${other}`, note: "With real coefficients, the conjugate of a solution is a solution. Flip the sign of the imaginary part." },
        { math: md`(${given}) + (${other}) = ${-b} = -b`, note: md`Check: the two solutions should add to $-\frac{b}{a} = ${-b}$, the real parts doubling and the imaginary parts cancelling.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`Multiply $(x - (${plus}))(x - (${minus}))$ to build a quadratic with these solutions.`,
      answer: quad(1, b, c),
      complex: true,
      expanded: true,
      simplified: true,
      hint: md`Group it as $((x ${signed(-p)}) - ${q === 1 ? "" : q}i)((x ${signed(-p)}) + ${q === 1 ? "" : q}i)$, a difference of squares.`,
      solution: [
        { math: md`\big((${poly([[1, "x"], [-p, ""]])}) - ${q === 1 ? "" : q}i\big)\big((${poly([[1, "x"], [-p, ""]])}) + ${q === 1 ? "" : q}i\big)`, note: "Regroup each factor as (x - p) and the imaginary part." },
        { math: md`(${poly([[1, "x"], [-p, ""]])})^2 - ${q * q === 1 ? "" : q * q}i^2`, note: md`Difference of squares: $(u - v)(u + v) = u^2 - v^2$.` },
        { math: md`${quad(1, b, p * p)} + ${q * q}`, note: md`$-${q * q === 1 ? "" : q * q}i^2 = +${q * q}$.` },
        { math: quad(1, b, c), note: "A quadratic with real coefficients, as conjugate pairs promise." },
      ],
    };
  }
  if (kind === 2) {
    const z = r.next() < 0.5 ? plus : minus;
    return {
      prompt: md`For which real number $c$ is $${z}$ a solution of $${poly([[1, "x^2"], [b, "x"]])} + c = 0$?`,
      answer: String(c),
      complex: true,
      verify: [`(${z})^2 + (${b})(${z}) + c = 0`],
      hint: md`Substitute $x = ${z}$ and solve for $c$. Or use the conjugate pair: the product of the two solutions is $\frac{c}{a}$.`,
      solution: [
        { math: md`(${z})^2 ${signed(b)}(${z}) + c = 0`, note: "A solution makes the equation true." },
        { math: md`(${cx(p * p - q * q, z === plus ? 2 * p * q : -2 * p * q)}) + (${cx(b * p, z === plus ? b * q : -b * q)}) + c = 0`, note: md`$(${z})^2 = ${p * p} ${signed(z === plus ? 2 * p * q : -2 * p * q)}i - ${q * q}$, and distribute $${b}$.` },
        { math: md`${p * p - q * q + b * p} + c = 0`, note: "The imaginary parts cancel, as they must for a real c." },
        { math: md`c = ${c}`, note: md`Check: $(${plus})(${minus}) = ${p * p} + ${q * q} = ${c}$, the product of the pair.` },
      ],
    };
  }
  // Classify without solving.
  const type = r.int(0, 2);
  let A = r.int(1, 3);
  let B: number;
  let C: number;
  if (type === 0) {
    B = r.int(-6, 6);
    C = -r.int(1, 8);
  } else if (type === 1) {
    const s = r.nonzero(-4, 4);
    [A, B, C] = [1, -2 * s, s * s];
  } else {
    B = r.int(-6, 6);
    C = Math.floor((B * B) / (4 * A)) + r.int(1, 4);
  }
  const D = B * B - 4 * A * C;
  const choices = ["two real solutions", "one real solution", "two nonreal complex solutions"];
  const right = choices[D > 0 ? 0 : D === 0 ? 1 : 2]!;
  return {
    prompt: md`Without solving, describe the solutions of $${quad(A, B, C)} = 0$.`,
    choices,
    accept: [right],
    hint: md`Compute the discriminant $b^2 - 4ac$ and look at its sign.`,
    solution: [
      { math: md`b^2 - 4ac = ${paren(B)}^2 - 4(${A})(${C}) = ${B * B} ${signed(-4 * A * C)} = ${D}`, note: md`With $a = ${A}$, $b = ${B}$, $c = ${C}$.` },
      { math: md`\text{${right}}`, note: D > 0 ? "Positive: its square root is real, and ± gives two different real numbers." : D === 0 ? "Zero: ± 0 gives the same number twice." : "Negative: its square root is imaginary, so ± gives a conjugate pair." },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Quadratics and Complex Numbers",
  lessons: [
    {
      id: "vertex-form",
      title: "Vertex form",
      summary: "Turning any ax² + bx + c into a(x − h)² + k by completing the square, and reading off the vertex, the axis, the maximum or minimum, and the range.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 1, Unit 8 you met two ways of writing a quadratic. **Standard form** $y = ax^2 + bx + c$ is how quadratics usually arrive. **Vertex form** $y = a(x - h)^2 + k$ shows the shape of the graph at a glance. They describe the same functions. This lesson turns one into the other, and uses the result to answer questions like "what is the largest value?" without drawing anything.`,
        },
        {
          kind: "key",
          title: "What vertex form tells you",
          body: md`For $f(x) = a(x - h)^2 + k$ with $a \ne 0$:

- The vertex is $(h, k)$, and the axis of symmetry is the line $x = h$.
- If $a > 0$, the parabola opens up. Its **minimum** value is $k$, and its range is $[k, \infty)$.
- If $a < 0$, the parabola opens down. Its **maximum** value is $k$, and its range is $(-\infty, k]$.`,
        },
        {
          kind: "why",
          title: "Why the range is exactly [k, ∞) when a > 0",
          body: md`Two things have to be true: the function never goes below $k$, and it reaches every value from $k$ up.

**Never below.** $(x - h)^2$ is a square, so it is at least 0. Multiplying by a positive $a$ keeps it at least 0, so $f(x) = a(x - h)^2 + k \ge k$.

**Every value from $k$ up.** Pick any $y \ge k$ and solve $a(x - h)^2 + k = y$:

$$(x - h)^2 = \frac{y - k}{a} \quad\Rightarrow\quad x = h \pm \sqrt{\frac{y - k}{a}}.$$

The number under the root is not negative, so this $x$ exists. So every $y \ge k$ is an output. When $a < 0$ the same argument, with the inequalities flipped, gives $(-\infty, k]$.`,
        },
        {
          kind: "why",
          title: "Completing the square in an expression: add zero",
          body: md`When you completed the square in Algebra 1, you were solving an equation, so you added the missing corner to **both sides**. Here there's only one side: $y = x^2 - 8x + 13$ is a formula, not a puzzle.

So add the corner and subtract it again. Adding $16 - 16$ adds 0, which changes nothing about the function:

$$x^2 - 8x + 13 = (x^2 - 8x + 16) - 16 + 13.$$

The group in parentheses is now a perfect square.`,
        },
        {
          kind: "example",
          title: "When a = 1",
          problem: md`Write $y = x^2 - 8x + 13$ in vertex form and find the vertex.`,
          steps: [
            { math: md`y = (x^2 - 8x + 16) - 16 + 13`, note: md`Half of $-8$ is $-4$, and $(-4)^2 = 16$. Add and subtract it.` },
            { math: md`y = (x - 4)^2 - 3`, note: md`The group is $(x - 4)^2$, and $-16 + 13 = -3$.` },
            { math: md`\text{vertex } (4, -3)`, note: "It opens up, so the minimum value is -3, at x = 4." },
          ],
        },
        {
          kind: "example",
          title: "When a is not 1",
          problem: md`Write $y = 2x^2 + 12x + 7$ in vertex form.`,
          steps: [
            { math: md`y = 2(x^2 + 6x) + 7`, note: md`Factor 2 out of the $x$-terms only, so the square starts with a plain $x^2$. Leave the 7 outside.` },
            { math: md`y = 2(x^2 + 6x + 9 - 9) + 7`, note: md`Half of 6 is 3, and $3^2 = 9$. Add and subtract it **inside** the parentheses.` },
            { math: md`y = 2(x + 3)^2 - 18 + 7`, note: md`The $-9$ is inside, so it is multiplied by 2 on its way out: $2 \cdot (-9) = -18$. This is the step people miss.` },
            { math: md`y = 2(x + 3)^2 - 11`, note: md`Vertex $(-3, -11)$. Check at $x = 0$: $2(9) - 11 = 7$, matching the original.` },
          ],
        },
        {
          kind: "proof",
          title: "The vertex of any quadratic",
          given: md`$f(x) = ax^2 + bx + c$ with $a \ne 0$.`,
          prove: md`$f(x) = a\left(x + \frac{b}{2a}\right)^2 + c - \frac{b^2}{4a}$, so the vertex is at $h = -\frac{b}{2a}$, and $k = f(h)$.`,
          steps: [
            { statement: md`$f(x) = a\left(x^2 + \frac{b}{a}x\right) + c$`, reason: md`Distributive property: factor $a$ out of the $x$-terms (allowed since $a \ne 0$)` },
            { statement: md`$f(x) = a\left(x^2 + \frac{b}{a}x + \frac{b^2}{4a^2} - \frac{b^2}{4a^2}\right) + c$`, reason: md`Add 0: half of $\frac{b}{a}$ is $\frac{b}{2a}$, and its square is $\frac{b^2}{4a^2}$` },
            { statement: md`$f(x) = a\left(x + \frac{b}{2a}\right)^2 - a \cdot \frac{b^2}{4a^2} + c$`, reason: "The first three terms are a perfect square; the leftover leaves the parentheses multiplied by a" },
            { statement: md`$f(x) = a\left(x + \frac{b}{2a}\right)^2 + c - \frac{b^2}{4a}$`, reason: md`Cancel one factor of $a$` },
            { statement: md`$h = -\frac{b}{2a}$ and $k = c - \frac{b^2}{4a}$`, reason: md`Match with $a(x - h)^2 + k$: $x + \frac{b}{2a} = x - \left(-\frac{b}{2a}\right)$` },
            { statement: md`$f(h) = a \cdot 0^2 + k = k$`, reason: md`Substitute $x = h$: the square is 0` },
          ],
        },
        {
          kind: "key",
          title: "Vertex from standard form",
          body: md`For $f(x) = ax^2 + bx + c$, the vertex is at

$$h = -\frac{b}{2a}, \qquad k = f(h).$$

You don't need to memorize the formula for $k$: once you have $h$, just evaluate the function there. This is the same $-\frac{b}{2a}$ that sits in the middle of the quadratic formula.`,
        },
        {
          kind: "plot",
          x: [-8, 8],
          y: [-11, 10],
          curves: [{ expr: "a x^2 + b x + c", label: "y = ax^2 + bx + c" }],
          points: [{ x: "-b/(2a)", y: "c - b^2/(4a)", label: md`\text{vertex } ({=-b/(2a)}, {=c - b^2/(4a)})`, color: 2 }],
          params: [
            { name: "a", min: 1, max: 3, step: 0.5, value: 1 },
            { name: "b", min: -4, max: 4, step: 1, value: -4 },
            { name: "c", min: -6, max: 6, step: 1, value: 1 },
          ],
          caption: md`Slide $c$ and the parabola moves straight up and down: $c$ only adds to every output, so $h$ stays put. Slide $b$ and the vertex moves sideways too, because $h = -\frac{b}{2a}$ depends on $b$. A bigger $a$ narrows the curve and pulls the vertex toward the $y$-axis.`,
        },
        {
          kind: "example",
          title: "Using the formula, with a < 0",
          problem: md`Find the vertex, the maximum value and the range of $f(x) = -3x^2 + 12x - 5$.`,
          steps: [
            { math: md`h = -\frac{12}{2(-3)} = 2`, note: md`$a = -3$ and $b = 12$.` },
            { math: md`k = f(2) = -3(4) + 24 - 5 = 7`, note: "Evaluate at the axis." },
            { math: md`\text{vertex } (2, 7), \quad \max = 7`, note: "a is negative, so the parabola opens down and the vertex is the highest point." },
            { math: md`\text{range } (-\infty, 7]`, note: "Every value up to 7 and including it." },
          ],
        },
        {
          kind: "example",
          title: "Finding the equation from the vertex",
          problem: md`A parabola has vertex $(1, -2)$ and passes through $(3, 6)$. Find its equation.`,
          steps: [
            { math: md`y = a(x - 1)^2 - 2`, note: "The vertex gives h and k. One number is still unknown." },
            { math: md`6 = a(3 - 1)^2 - 2`, note: md`The point $(3, 6)$ lies on the graph, so it satisfies the equation.` },
            { math: md`8 = 4a \quad\Rightarrow\quad a = 2`, note: "Solve for a." },
            { math: md`y = 2(x - 1)^2 - 2 = 2x^2 - 4x`, note: md`Check: $2(9) - 12 = 6$. ✓` },
          ],
        },
        {
          kind: "example",
          title: "The best rectangle",
          problem: md`You have 40 meters of fence for a rectangular pen. What is the largest area you can enclose?`,
          steps: [
            { math: md`A = x(20 - x)`, note: md`If one side is $x$, the two pairs of sides use 40 m, so the other side is $20 - x$.` },
            { math: md`A = -x^2 + 20x = -(x^2 - 20x + 100 - 100)`, note: "Factor out -1 and complete the square inside." },
            { math: md`A = -(x - 10)^2 + 100`, note: md`The $-100$ comes out multiplied by $-1$.` },
            { math: md`A_{\max} = 100 \text{ at } x = 10`, note: md`The area is 100 minus a square. It's largest when the square is 0. The best rectangle is a 10 by 10 square.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the vertex of $y = x^2 + 10x + 21$. ${POINT}`,
          answer: "(-5, -4)",
          form: "tuple",
          explain: md`Half of 10 is 5 and $5^2 = 25$: $y = (x^2 + 10x + 25) - 25 + 21 = (x + 5)^2 - 4$. Or $h = -\frac{10}{2} = -5$ and $f(-5) = 25 - 50 + 21 = -4$.`,
        },
        {
          kind: "check",
          prompt: md`Give the range of $f(x) = -2(x - 1)^2 + 5$ in interval notation (type $\infty$ as inf).`,
          answer: "(-inf, 5]",
          form: "inequality",
          explain: md`$a = -2 < 0$, so $-2(x - 1)^2 \le 0$ and $f(x) \le 5$, with 5 reached at $x = 1$. The range is $(-\infty, 5]$.`,
        },
      ],
      practice: [vertexOfQuadratic, quadraticFeatures, buildAndApply],
    },
    {
      id: "imaginary-and-complex-numbers",
      title: "Imaginary and complex numbers",
      summary: "Defining i by i² = −1, why that's a legitimate move, and how to add, multiply, divide and measure complex numbers.",
      blocks: [
        {
          kind: "text",
          body: md`The equation $x^2 = -1$ has no real solution. Every real number squared is 0 or positive. That's a fact about the real numbers, and it isn't going to change.

But this has happened before, and every time the answer was to build a bigger number system:

- With only counting numbers, $x + 5 = 3$ has no solution. Negative numbers fix that.
- With only integers, $3x = 1$ has no solution. Fractions fix that.
- With only fractions, $x^2 = 2$ has no solution. The irrational numbers, like $\sqrt{2}$, fix that.

Each time, the new numbers kept the old rules of arithmetic working. We'll do the same once more.`,
        },
        {
          kind: "key",
          title: "The imaginary unit and complex numbers",
          body: md`- $i$ is a number with $i^2 = -1$.
- For $a > 0$, $\sqrt{-a} = i\sqrt{a}$. For example, $\sqrt{-9} = 3i$.
- A **complex number** is $a + bi$ with $a$ and $b$ real. $a$ is the **real part** and $b$ is the **imaginary part**.
- Real numbers are the complex numbers with $b = 0$. Numbers $bi$ with $b \ne 0$ (no real part) are called **pure imaginary**. A complex number that isn't real is called **nonreal**.
- $a + bi = c + di$ exactly when $a = c$ and $b = d$.`,
        },
        {
          kind: "why",
          title: "Why are we allowed to invent i?",
          body: md`$i$ isn't on the number line, and we never claim it is. What we need is that the new system is **consistent**: that the arithmetic rules we rely on still hold and never lead to a contradiction like $1 = 0$.

In 1835 William Rowan Hamilton settled this. Define a complex number to be a pair of real numbers $(a, b)$, with

$$(a, b) + (c, d) = (a + c,\; b + d), \qquad (a, b)(c, d) = (ac - bd,\; ad + bc).$$

Where does that product come from? It's what distributing would give if $i^2 = -1$: $(a + bi)(c + di) = ac + adi + bci + bdi^2 = (ac - bd) + (ad + bc)i$. Hamilton turned that hope into a definition that uses only real numbers.

Pairs $(a, 0)$ add and multiply exactly like the real numbers $a$. And $(0, 1)(0, 1) = (0 - 1,\; 0 + 0) = (-1, 0)$, so the pair $(0, 1)$ squares to $-1$. That pair is $i$.

Checking the commutative, associative and distributive laws for these pairs is ordinary real-number algebra. So if complex numbers ever contradicted themselves, the real numbers would too. Writing $a + bi$ is just a friendlier name for $(a, b)$.

One thing is lost: complex numbers can't be put in order. Neither $i > 0$ nor $i < 0$ can hold, since either would make $i^2 = -1$ positive.`,
        },
        {
          kind: "why",
          title: "Why √(−a) = i√a, and a trap to avoid",
          body: md`For $a > 0$, $(i\sqrt{a})^2 = i^2 (\sqrt{a})^2 = -a$. So $i\sqrt{a}$ is a square root of $-a$, and we choose it as **the** square root, the way $\sqrt{9}$ means 3 rather than $-3$. (The other root is $-i\sqrt{a}$.)

The rule $\sqrt{a}\sqrt{b} = \sqrt{ab}$ from Algebra 1 was proved for $a, b \ge 0$, and it really does fail otherwise:

$$\sqrt{-4}\cdot\sqrt{-9} = 2i \cdot 3i = 6i^2 = -6, \quad\text{but}\quad \sqrt{(-4)(-9)} = \sqrt{36} = 6.$$

So take the $i$ out of every negative root **first**, then multiply.`,
        },
        {
          kind: "proof",
          title: "Powers of i repeat every four",
          given: md`$i^2 = -1$, and $n$ is a whole number.`,
          prove: md`$i^{n + 4} = i^n$, so $i^n$ depends only on the remainder when $n$ is divided by 4.`,
          steps: [
            { statement: md`$i^3 = i^2 \cdot i = -i$`, reason: "Exponent rule, and the definition of i" },
            { statement: md`$i^4 = (i^2)^2 = (-1)^2 = 1$`, reason: "Power of a power" },
            { statement: md`$i^{n + 4} = i^n \cdot i^4 = i^n \cdot 1 = i^n$`, reason: "Product of powers, then the identity property" },
            { statement: md`The powers run $i, -1, -i, 1, i, -1, -i, 1, \dots$`, reason: "Repeat the previous step" },
          ],
        },
        {
          kind: "example",
          title: "A big power",
          problem: md`Simplify $i^{35}$.`,
          steps: [
            { math: md`35 = 4 \cdot 8 + 3`, note: "Divide by 4: quotient 8, remainder 3." },
            { math: md`i^{35} = (i^4)^8 \cdot i^3 = 1 \cdot i^3`, note: "Each block of four is 1." },
            { math: md`i^{35} = -i`, note: "" },
          ],
        },
        {
          kind: "text",
          body: md`**Adding and subtracting.** Since the usual laws still hold, you treat $i$ like a variable and combine like terms:

$$(3 + 2i) + (1 - 5i) = (3 + 1) + (2 - 5)i = 4 - 3i.$$

**The complex plane.** A real number is a point on a line. A complex number $a + bi$ has two parts, so it needs a plane: plot it at the point $(a, b)$, with the real part across and the imaginary part up. Drawn as an arrow from 0, a complex number is a vector, like the translation vectors of Geometry, Unit 9. Adding complex numbers adds the vectors.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-6, 6, -6, 6],
          params: [
            { name: "a", min: -3, max: 3, step: 1, value: 3 },
            { name: "b", min: -3, max: 3, step: 1, value: 1 },
            { name: "c", min: -3, max: 3, step: 1, value: 1 },
            { name: "d", min: -3, max: 3, step: 1, value: 2 },
          ],
          points: [
            { name: "O", x: 0, y: 0, label: "0", dir: "sw" },
            { name: "Z", x: "a", y: "b", label: "z\\;({a}, {b})", dir: "e" },
            { name: "W", x: "c", y: "d", label: "w\\;({c}, {d})", dir: "w" },
            { name: "S", x: "a + c", y: "b + d", label: "z + w\\;({=a + c}, {=b + d})", dir: "ne" },
          ],
          segments: [
            { from: "O", to: "Z", arrow: true, color: 1 },
            { from: "O", to: "W", arrow: true, color: 2 },
            { from: "Z", to: "S", arrow: true, color: 2, dashed: true },
            { from: "W", to: "S", arrow: true, color: 1, dashed: true },
            { from: "O", to: "S", arrow: true, color: 3 },
          ],
          labels: [
            { x: 5.3, y: 0.5, text: "\\text{Re}" },
            { x: 0.6, y: 5.5, text: "\\text{Im}" },
          ],
          caption: md`$z = a + bi$ and $w = c + di$. To add, put the tail of $w$ at the tip of $z$ (dashed): you land at $(a + c,\; b + d)$, which is $z + w$. Real parts add across, imaginary parts add up. Either order gives the same point, which is why addition is commutative.`,
        },
        {
          kind: "example",
          title: "Multiplying",
          problem: md`Simplify $(3 + 2i)(4 - i)$.`,
          steps: [
            { math: md`12 - 3i + 8i - 2i^2`, note: "Distribute, exactly as with (3 + 2x)(4 - x)." },
            { math: md`12 + 5i - 2(-1)`, note: md`Combine the $i$ terms, and replace $i^2$ with $-1$.` },
            { math: md`14 + 5i`, note: "Always finish in the form a + bi." },
          ],
        },
        {
          kind: "why",
          title: "What multiplying by i does to the picture",
          body: md`$i(a + bi) = ai + bi^2 = -b + ai$. So the point $(a, b)$ moves to $(-b, a)$.

That is the $90^\circ$ rotation rule about the origin from Geometry, Unit 9: $(x, y) \to (-y, x)$. Multiplying by $i$ turns the arrow a quarter turn counterclockwise. Doing it twice is a half turn, which sends every point $z$ to $-z$. That is $i^2 = -1$ as a picture.`,
        },
        {
          kind: "key",
          title: "Conjugate and modulus",
          body: md`- The **conjugate** of $z = a + bi$ is $\bar{z} = a - bi$: the mirror image across the real axis.
- $z\bar{z} = (a + bi)(a - bi) = a^2 + b^2$, a real number.
- To divide by $c + di$, multiply the top and bottom by its conjugate $c - di$. The bottom becomes the real number $c^2 + d^2$.
- The **modulus** $|a + bi| = \sqrt{a^2 + b^2}$ is the distance from 0 to the point $(a, b)$. Also $|z|^2 = z\bar{z}$.`,
        },
        {
          kind: "proof",
          title: "A number times its conjugate is real",
          given: md`$z = a + bi$ with $a$, $b$ real, and $\bar{z} = a - bi$.`,
          prove: md`$z\bar{z} = a^2 + b^2$, which is real and not negative, and is 0 only when $z = 0$.`,
          steps: [
            { statement: md`$z\bar{z} = a^2 - abi + abi - b^2i^2$`, reason: "Distributive property" },
            { statement: md`$z\bar{z} = a^2 - b^2i^2$`, reason: "The middle terms are opposites" },
            { statement: md`$z\bar{z} = a^2 + b^2$`, reason: md`$i^2 = -1$` },
            { statement: md`$a^2 + b^2 \ge 0$, with equality only when $a = b = 0$`, reason: "Squares of real numbers are never negative" },
          ],
        },
        {
          kind: "example",
          title: "Dividing",
          problem: md`Simplify $\frac{5 + i}{2 - 3i}$.`,
          steps: [
            { math: md`\frac{5 + i}{2 - 3i} \cdot \frac{2 + 3i}{2 + 3i}`, note: "Multiply by 1, written with the conjugate of the bottom." },
            { math: md`\frac{10 + 15i + 2i + 3i^2}{4 + 9}`, note: md`Top: distribute. Bottom: $2^2 + 3^2$, by the proof above.` },
            { math: md`\frac{7 + 17i}{13} = \frac{7}{13} + \frac{17}{13}i`, note: md`$3i^2 = -3$, and $10 - 3 = 7$. Split into real and imaginary parts.` },
          ],
        },
        {
          kind: "why",
          title: "Why the conjugate trick always works",
          body: md`It's the same idea as rationalizing a denominator like $\frac{1}{2 - \sqrt{3}}$ in Algebra 1: multiply by $\frac{2 + \sqrt{3}}{2 + \sqrt{3}}$, which is 1, and the root disappears from the bottom.

Here the proof shows the bottom always becomes $c^2 + d^2$, a positive real number unless $c + di = 0$. So every nonzero complex number has a reciprocal:

$$\frac{1}{c + di} = \frac{c - di}{c^2 + d^2}.$$

That's exactly the inverse property from Algebra 1, Unit 1. Division works in the complex numbers just as it does in the reals, except by 0.`,
        },
        {
          kind: "diagram",
          grid: true,
          view: [-5, 5, -5, 5],
          params: [
            { name: "a", min: -4, max: 4, step: 1, value: 3 },
            { name: "b", min: -4, max: 4, step: 1, value: 4 },
          ],
          points: [
            { name: "O", x: 0, y: 0, label: "0", dir: "sw" },
            { name: "Z", x: "a", y: "b", label: "z = ({a}, {b})", dir: "ne" },
            { name: "F", x: "a", y: 0, hidden: true },
            { name: "C", x: "a", y: "-b", label: "\\bar{z} = ({a}, {=-b})", dir: "se" },
          ],
          segments: [
            { from: "O", to: "Z", arrow: true, color: 1, label: "|z|" },
            { from: "O", to: "F", dashed: true, label: "|a|" },
            { from: "F", to: "Z", dashed: true, label: "|b|" },
            { from: "O", to: "C", arrow: true, color: 2, dashed: true },
          ],
          angles: [{ at: "F", from: "O", to: "Z", right: true }],
          readouts: [{ label: "|z| = \\sqrt{a^2 + b^2}", value: "sqrt(a^2 + b^2)" }],
          caption: md`The modulus is the length of the arrow. Its legs are $|a|$ and $|b|$, so the Pythagorean Theorem gives $|z| = \sqrt{a^2 + b^2}$. The conjugate $\bar{z}$ is the reflection across the real axis, the same distance from 0.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $(2 - 3i)(2 + 3i)$.`,
          answer: "13",
          complex: true,
          simplified: true,
          explain: md`Conjugates: $2^2 + 3^2 = 4 + 9 = 13$. The $i$ terms cancel.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $\frac{4 + 2i}{1 + i}$. ${ABI}`,
          answer: "3 - i",
          complex: true,
          simplified: true,
          explain: md`Multiply by $\frac{1 - i}{1 - i}$. Top: $4 - 4i + 2i - 2i^2 = 6 - 2i$. Bottom: $1 + 1 = 2$. So the answer is $3 - i$.`,
        },
        {
          kind: "check",
          prompt: md`Find $|-5 + 12i|$.`,
          answer: "13",
          explain: md`$\sqrt{(-5)^2 + 12^2} = \sqrt{25 + 144} = \sqrt{169} = 13$.`,
        },
      ],
      practice: [rootsAndPowers, complexArithmetic, conjugatesAndDivision],
    },
    {
      id: "complex-solutions-of-quadratics",
      title: "Complex solutions of quadratics",
      summary: "Square roots of negatives, the quadratic formula when the discriminant is negative, and why the solutions come in conjugate pairs.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 1, a negative discriminant meant **no real solutions**: the parabola misses the $x$-axis. That's still true. But with complex numbers available, those equations do have solutions. They just aren't real, so they don't show up as crossings on the graph.`,
        },
        {
          kind: "example",
          title: "The simplest case",
          problem: md`Solve $x^2 + 9 = 0$.`,
          steps: [
            { math: md`x^2 = -9`, note: "Subtract 9." },
            { math: md`x = \pm\sqrt{-9} = \pm 3i`, note: md`$\sqrt{-9} = i\sqrt{9} = 3i$.` },
            { math: md`(3i)^2 + 9 = 9i^2 + 9 = -9 + 9 = 0 \;\checkmark`, note: md`And $(-3i)^2 = 9i^2 = -9$ too, so both work.` },
          ],
        },
        {
          kind: "why",
          title: "Why exactly two solutions, and no others?",
          body: md`Factor, using the difference of squares and $i^2 = -1$:

$$x^2 + 9 = x^2 - 9i^2 = (x - 3i)(x + 3i).$$

Multiply it out to check: $x^2 + 3ix - 3ix - 9i^2 = x^2 + 9$.

Now use the zero product property from Algebra 1, Unit 8. Its proof only needed one fact: a nonzero number has a reciprocal. Last lesson showed every nonzero complex number does, $\frac{1}{c + di} = \frac{c - di}{c^2 + d^2}$. So the property holds for complex numbers too: $(x - 3i)(x + 3i) = 0$ forces $x = 3i$ or $x = -3i$, and nothing else.`,
        },
        {
          kind: "key",
          title: "Square root property, extended",
          body: md`If $x^2 = -d$ with $d > 0$, then

$$x = \pm i\sqrt{d}.$$

As before, a squared group works the same way: $(x - h)^2 = -d$ gives $x = h \pm i\sqrt{d}$.`,
        },
        {
          kind: "example",
          title: "A squared group",
          problem: md`Solve $(x - 2)^2 + 12 = 0$.`,
          steps: [
            { math: md`(x - 2)^2 = -12`, note: "Subtract 12." },
            { math: md`x - 2 = \pm i\sqrt{12} = \pm 2i\sqrt{3}`, note: md`$\sqrt{12} = \sqrt{4}\sqrt{3} = 2\sqrt{3}$.` },
            { math: md`x = 2 \pm 2i\sqrt{3}`, note: "Add 2. Type it as 2 +/- 2sqrt(3)i." },
          ],
        },
        {
          kind: "why",
          title: "Why the quadratic formula still works",
          body: md`Look back at the derivation in Algebra 1, Unit 8. It divided by $a$, added the same number to both sides, recognized a perfect square, and took square roots. The first three steps use only the laws of arithmetic, which complex numbers keep. The last step is the square root property, which we just extended. So for every quadratic with real coefficients,

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a},$$

where, if $b^2 - 4ac < 0$, the root means $\sqrt{b^2 - 4ac} = i\sqrt{4ac - b^2}$.`,
        },
        {
          kind: "key",
          title: "What the discriminant says now",
          body: md`For $ax^2 + bx + c = 0$ with real $a$, $b$, $c$:

- $b^2 - 4ac > 0$: two real solutions.
- $b^2 - 4ac = 0$: one real solution (a double root).
- $b^2 - 4ac < 0$: two **nonreal** solutions, a conjugate pair

$$x = -\frac{b}{2a} \pm \frac{\sqrt{4ac - b^2}}{2a}\,i.$$`,
        },
        {
          kind: "example",
          title: "The formula with a negative discriminant",
          problem: md`Solve $x^2 - 4x + 13 = 0$.`,
          steps: [
            { math: md`b^2 - 4ac = 16 - 52 = -36`, note: md`$a = 1$, $b = -4$, $c = 13$. Negative: complex solutions.` },
            { math: md`\sqrt{-36} = 6i`, note: "" },
            { math: md`x = \frac{4 \pm 6i}{2} = 2 \pm 3i`, note: "Divide both parts by 2." },
            { math: md`(2 + 3i)^2 - 4(2 + 3i) + 13 = (-5 + 12i) - 8 - 12i + 13 = 0 \;\checkmark`, note: md`$(2 + 3i)^2 = 4 + 12i + 9i^2 = -5 + 12i$.` },
          ],
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 10],
          curves: [{ expr: "(x - h)^2 + k", label: "y = (x - h)^2 + k" }],
          points: [{ x: "h", y: "k", label: md`\text{vertex } ({h}, {k}); \quad \text{solutions } x = {h} \pm \sqrt{{=-k}}`, color: 2 }],
          params: [
            { name: "h", min: -3, max: 3, step: 1, value: 2 },
            { name: "k", min: -4, max: 9, step: 1, value: 9 },
          ],
          caption: md`Solving $(x - h)^2 + k = 0$ gives $x = h \pm \sqrt{-k}$. Lower the vertex below the axis ($k < 0$) and the two real crossings sit $\sqrt{-k}$ either side of $h$. Lift it above ($k > 0$) and the root becomes $i\sqrt{k}$: the solutions are $h \pm i\sqrt{k}$. The real part is still the axis of symmetry, $x = h$. With $h = 2$ and $k = 9$ this is $x^2 - 4x + 13$, with solutions $2 \pm 3i$.`,
        },
        {
          kind: "why",
          title: "Conjugates respect sums and products",
          body: md`Take $z = p + qi$ and $w = r + si$. Then

$$zw = (pr - qs) + (ps + qr)i, \qquad \bar{z}\,\bar{w} = (p - qi)(r - si) = (pr - qs) - (ps + qr)i.$$

So $\overline{zw} = \bar{z}\,\bar{w}$. Adding is easier still: $\overline{z + w} = \bar{z} + \bar{w}$. And a real number is its own conjugate. These three facts are all the next proof needs.`,
        },
        {
          kind: "proof",
          title: "Nonreal solutions come in conjugate pairs",
          given: md`$z$ is a solution of $ax^2 + bx + c = 0$, where $a$, $b$, $c$ are real.`,
          prove: md`$\bar{z}$ is also a solution.`,
          steps: [
            { statement: md`$az^2 + bz + c = 0$`, reason: md`$z$ is a solution` },
            { statement: md`$\overline{az^2 + bz + c} = \overline{0} = 0$`, reason: "Equal numbers have equal conjugates, and 0 is real" },
            { statement: md`$\bar{a}\,\bar{z}^2 + \bar{b}\,\bar{z} + \bar{c} = 0$`, reason: "The conjugate of a sum is the sum of the conjugates, and the same for products" },
            { statement: md`$a\bar{z}^2 + b\bar{z} + c = 0$`, reason: md`$a$, $b$, $c$ are real, so each is its own conjugate` },
            { statement: md`$\bar{z}$ is a solution`, reason: "Definition of a solution" },
          ],
        },
        {
          kind: "why",
          title: "Building a quadratic from its solutions",
          body: md`Run the factoring backwards. If the solutions are $z$ and $w$, the quadratic $(x - z)(x - w) = x^2 - (z + w)x + zw$ has them. For the pair $2 \pm 3i$:

$$z + w = 4, \qquad zw = 2^2 + 3^2 = 13,$$

so $x^2 - 4x + 13$, the equation from the example. The sum and the product are both real, which is why the coefficients came out real. The same holds for every quadratic, straight from the formula. Its solutions are $-\frac{b}{2a} + s$ and $-\frac{b}{2a} - s$, where $s = \frac{\sqrt{b^2 - 4ac}}{2a}$. Adding, the $s$ parts cancel, so the sum is $-\frac{b}{a}$. Multiplying is a difference of squares:

$$\frac{b^2}{4a^2} - s^2 = \frac{b^2 - (b^2 - 4ac)}{4a^2} = \frac{c}{a}.$$

When $b^2 - 4ac < 0$, $s$ is imaginary, but still $s^2 = \frac{b^2 - 4ac}{4a^2}$, because $(i\sqrt{d})^2 = -d$. So the solutions of $ax^2 + bx + c = 0$ always add to $-\frac{b}{a}$ and multiply to $\frac{c}{a}$. That gives a quick check on any answer.`,
        },
        {
          kind: "example",
          title: "Rearrange, then reduce each part",
          problem: md`Solve $2x^2 + 5 = 2x$.`,
          steps: [
            { math: md`2x^2 - 2x + 5 = 0`, note: "Standard form first." },
            { math: md`b^2 - 4ac = 4 - 40 = -36`, note: "" },
            { math: md`x = \frac{2 \pm 6i}{4}`, note: md`$-b = 2$, $\sqrt{-36} = 6i$, and $2a = 4$.` },
            { math: md`x = \frac{1}{2} \pm \frac{3}{2}i`, note: md`Reduce the real part and the imaginary part separately. Check: they add to $1 = -\frac{b}{a}$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 + 25 = 0$. ${SOLS_C}`,
          answer: "5i, -5i",
          form: "set",
          complex: true,
          simplified: true,
          explain: md`$x^2 = -25$, so $x = \pm\sqrt{-25} = \pm 5i$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x^2 + 2x + 5 = 0$. ${SOLS_C}`,
          answer: "-1 + 2i, -1 - 2i",
          form: "set",
          complex: true,
          simplified: true,
          explain: md`$b^2 - 4ac = 4 - 20 = -16$, so $x = \frac{-2 \pm 4i}{2} = -1 \pm 2i$.`,
        },
      ],
      practice: [squareRootSolve, formulaSolve, conjugatePairs],
    },
  ],
};
