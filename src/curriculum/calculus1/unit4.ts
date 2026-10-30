import { frac, fracTex, gcd, poly } from "../../math/random";
import { md, slug, type Block, type Generator, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** (n/d) pi as answer text: "40pi", "3pi/2". */
function piTimes(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  const c = n === 1 ? "" : n === -1 ? "-" : String(n);
  return d === 1 ? `${c}pi` : `${c}pi/${d}`;
}

/** (n/d) pi as LaTeX. */
function piTimesTex(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  const c = n === 1 ? "" : n === -1 ? "-" : String(n);
  return d === 1 ? `${c}\\pi` : `\\frac{${c}\\pi}{${d}}`;
}

/** n/(d pi) as answer text: "3/(5pi)", "2/pi". */
function overPi(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  return d === 1 ? `${n}/pi` : `${n}/(${d}pi)`;
}

/** n/(d pi) as LaTeX. */
function overPiTex(n: number, d: number): string {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  return `\\frac{${n}}{${d === 1 ? "" : d}\\pi}`;
}

/** A number as a factor in LaTeX, parenthesised when negative. */
const par = (n: number) => (n < 0 ? `(${n})` : String(n));

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [4, 3, 5],
  [6, 8, 10],
  [8, 6, 10],
  [5, 12, 13],
  [12, 5, 13],
  [8, 15, 17],
  [15, 8, 17],
  [9, 12, 15],
  [12, 9, 15],
  [7, 24, 25],
];

// ── Lesson 1 generators: implicit differentiation ───────────────────────────

const slopeAtPoint: Generator = (r) => {
  const kind = r.int(0, 2);
  let x0 = r.nonzero(-4, 4);
  let y0 = r.nonzero(-4, 4);
  if (kind === 0) {
    const a = r.int(1, 3);
    const b = r.int(1, 3);
    const c = a * x0 * x0 + b * y0 * y0;
    const curve = `${poly([[a, "x^2"], [b, "y^2"]])} = ${c}`;
    return {
      prompt: md`The point $(${x0}, ${y0})$ lies on the curve $${curve}$. Find $\frac{dy}{dx}$ at that point. Give an exact value (a fraction if needed).`,
      answer: frac(-a * x0, b * y0),
      verify: [`${2 * a}*(${x0}) + ${2 * b}*(${y0})*q = 0`],
      hint: md`Differentiate both sides with respect to $x$. By the chain rule $y^2$ becomes $2y\,\frac{dy}{dx}$. Only then substitute $x = ${x0}$ and $y = ${y0}$.`,
      solution: [
        { math: md`${2 * a}x + ${2 * b}y\,\frac{dy}{dx} = 0`, note: md`Differentiate both sides. The constant $${c}$ has derivative 0, and $\frac{d}{dx}\,y^2 = 2y\,\frac{dy}{dx}$.` },
        { math: md`\frac{dy}{dx} = -\frac{${2 * a}x}{${2 * b}y}`, note: md`Solve for $\frac{dy}{dx}$.` },
        { math: md`\frac{dy}{dx} = -\frac{${2 * a}(${x0})}{${2 * b}(${y0})} = ${fracTex(-a * x0, b * y0)}`, note: md`Substitute the point.` },
      ],
    };
  }
  if (kind === 1) {
    let k = r.pick([1, -1, 3, -3]);
    while (k * x0 + 2 * y0 === 0) {
      k = r.pick([1, -1, 3, -3]);
      y0 = r.nonzero(-4, 4);
    }
    const c = x0 * x0 + k * x0 * y0 + y0 * y0;
    const curve = `${poly([[1, "x^2"], [k, "xy"], [1, "y^2"]])} = ${c}`;
    const num = -(2 * x0 + k * y0);
    const den = k * x0 + 2 * y0;
    return {
      prompt: md`The point $(${x0}, ${y0})$ lies on the curve $${curve}$. Find $\frac{dy}{dx}$ at that point. Give an exact value (a fraction if needed).`,
      answer: frac(num, den),
      verify: [`2*(${x0}) + ${k}*(${y0}) + (${k}*(${x0}) + 2*(${y0}))*q = 0`],
      hint: md`The $xy$ term needs the product rule: $\frac{d}{dx}(xy) = y + x\,\frac{dy}{dx}$. Collect the $\frac{dy}{dx}$ terms before substituting.`,
      solution: [
        { math: md`2x + ${poly([[k, "y"], [k, "x\\,\\frac{dy}{dx}"]])} + 2y\,\frac{dy}{dx} = 0`, note: md`Differentiate: $x^2 \to 2x$; $${poly([[k, "xy"]])} \to ${poly([[k, "y"], [k, "x\\,\\frac{dy}{dx}"]])}$ (product rule); $y^2 \to 2y\,\frac{dy}{dx}$.` },
        { math: md`(${poly([[k, "x"], [2, "y"]])})\frac{dy}{dx} = -(${poly([[2, "x"], [k, "y"]])})`, note: md`Gather the $\frac{dy}{dx}$ terms on one side.` },
        { math: md`\frac{dy}{dx} = -\frac{${poly([[2, "x"], [k, "y"]])}}{${poly([[k, "x"], [2, "y"]])}}`, note: "Divide." },
        { math: md`\frac{dy}{dx} = -\frac{2(${x0}) ${k < 0 ? "-" : "+"} ${Math.abs(k)}(${y0})}{${k === 1 ? "" : k === -1 ? "-" : k}(${x0}) + 2(${y0})} = ${fracTex(num, den)}`, note: md`Substitute $x = ${x0}$, $y = ${y0}$.` },
      ],
    };
  }
  while (3 * y0 * y0 + x0 === 0) x0 = r.nonzero(-4, 4);
  const c = y0 ** 3 + x0 * y0;
  const curve = `y^3 + xy = ${c}`;
  const den = 3 * y0 * y0 + x0;
  return {
    prompt: md`The point $(${x0}, ${y0})$ lies on the curve $${curve}$. Find $\frac{dy}{dx}$ at that point. Give an exact value (a fraction if needed).`,
    answer: frac(-y0, den),
    verify: [`3*(${y0})^2*q + ${y0} + (${x0})*q = 0`],
    hint: md`$\frac{d}{dx}\,y^3 = 3y^2\,\frac{dy}{dx}$, and $xy$ needs the product rule.`,
    solution: [
      { math: md`3y^2\,\frac{dy}{dx} + y + x\,\frac{dy}{dx} = 0`, note: md`Differentiate each term. Every term with $y$ in it picks up a $\frac{dy}{dx}$.` },
      { math: md`(3y^2 + x)\frac{dy}{dx} = -y`, note: md`Collect the $\frac{dy}{dx}$ terms.` },
      { math: md`\frac{dy}{dx} = -\frac{y}{3y^2 + x} = -\frac{${y0}}{3(${y0})^2 ${x0 < 0 ? "-" : "+"} ${Math.abs(x0)}} = ${fracTex(-y0, den)}`, note: md`Divide, then substitute $x = ${x0}$, $y = ${y0}$.` },
    ],
  };
};

const implicitDerivative: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const a = r.int(1, 4);
    const b = r.int(1, 4);
    const c = r.pick([1, 4, 9, 12, 16, 20, 25, 36]);
    const g = gcd(a, b);
    const [an, bn] = [a / g, b / g];
    const num = an === 1 ? "x" : `${an}x`;
    const den = bn === 1 ? "y" : `${bn}y`;
    return {
      prompt: md`Find $\frac{dy}{dx}$ for the curve $${poly([[a, "x^2"], [b, "y^2"]])} = ${c}$. Give your answer in terms of $x$ and $y$.`,
      answer: `-(${num})/(${den})`,
      verify: [`${2 * a}x + ${2 * b}y q = 0`],
      hint: md`Differentiate both sides with respect to $x$. The right side is a constant.`,
      solution: [
        { math: md`${2 * a}x + ${2 * b}y\,\frac{dy}{dx} = 0`, note: md`Power rule on $x^2$; chain rule on $y^2$: $2y\,\frac{dy}{dx}$. The constant's derivative is 0.` },
        { math: md`\frac{dy}{dx} = -\frac{${2 * a}x}{${2 * b}y} = -\frac{${num}}{${den}}`, note: md`Solve for $\frac{dy}{dx}$ and cancel the common factor.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.pick([1, -1, 3, -3]);
    const c = r.pick([3, 5, 7, 9, 11, 13]);
    const num = poly([[2, "x"], [k, "y"]]);
    const den = poly([[k, "x"], [2, "y"]]);
    return {
      prompt: md`Find $\frac{dy}{dx}$ for the curve $${poly([[1, "x^2"], [k, "xy"], [1, "y^2"]])} = ${c}$. Give your answer in terms of $x$ and $y$.`,
      answer: `-(${num})/(${den})`,
      verify: [`${poly([[2, "x"], [k, "y"], [k, "x q"], [2, "y q"]])} = 0`],
      hint: md`The $xy$ term is a product of two functions of $x$: $\frac{d}{dx}(xy) = 1 \cdot y + x\,\frac{dy}{dx}$.`,
      solution: [
        { math: md`2x + ${poly([[k, "y"], [k, "x\\,\\frac{dy}{dx}"]])} + 2y\,\frac{dy}{dx} = 0`, note: md`Differentiate term by term, product rule on $xy$.` },
        { math: md`(${den})\frac{dy}{dx} = -(${num})`, note: md`Move the terms without $\frac{dy}{dx}$ to the right and factor it out on the left.` },
        { math: md`\frac{dy}{dx} = -\frac{${num}}{${den}}`, note: "Divide." },
      ],
    };
  }
  if (kind === 2) {
    const k = r.pick([2, 3, 4, 6]);
    const num = poly([[k, "y"], [-3, "x^2"]]);
    const den = poly([[3, "y^2"], [-k, "x"]]);
    return {
      prompt: md`Find $\frac{dy}{dx}$ for the curve $x^3 + y^3 = ${k}xy$. Give your answer in terms of $x$ and $y$.`,
      answer: `(${num})/(${den})`,
      verify: [`3x^2 + 3y^2 q = ${k}y + ${k}x q`],
      hint: md`Differentiate both sides; the right side needs the product rule. Then collect every $\frac{dy}{dx}$ term on one side.`,
      solution: [
        { math: md`3x^2 + 3y^2\,\frac{dy}{dx} = ${k}y + ${k}x\,\frac{dy}{dx}`, note: md`Left: power rule and chain rule. Right: product rule on $${k}xy$.` },
        { math: md`(${den})\frac{dy}{dx} = ${num}`, note: md`$\frac{dy}{dx}$ terms left, everything else right.` },
        { math: md`\frac{dy}{dx} = \frac{${num}}{${den}}`, note: "Divide." },
      ],
    };
  }
  if (kind === 3) {
    const c = r.pick([2, 4, 5, 6, 10]);
    return {
      prompt: md`Find $\frac{dy}{dx}$ for the curve $y^3 + xy = ${c}$. Give your answer in terms of $x$ and $y$.`,
      answer: "-y/(3y^2 + x)",
      verify: ["3y^2 q + y + x q = 0"],
      hint: md`$\frac{d}{dx}\,y^3 = 3y^2\,\frac{dy}{dx}$. The $xy$ term is a product.`,
      solution: [
        { math: md`3y^2\,\frac{dy}{dx} + y + x\,\frac{dy}{dx} = 0`, note: "Differentiate each term." },
        { math: md`(3y^2 + x)\frac{dy}{dx} = -y`, note: md`Factor out $\frac{dy}{dx}$.` },
        { math: md`\frac{dy}{dx} = -\frac{y}{3y^2 + x}`, note: "Divide." },
      ],
    };
  }
  const k = r.pick([2, 4, 6, 8, 10]);
  return {
    prompt: md`Find $\frac{dy}{dx}$ for the curve $x^2 + y^2 = ${k}x$. Give your answer in terms of $x$ and $y$.`,
    answer: `(${k} - 2x)/(2y)`,
    verify: [`2x + 2y q = ${k}`],
    hint: md`The right side is not a constant this time: its derivative is $${k}$.`,
    solution: [
      { math: md`2x + 2y\,\frac{dy}{dx} = ${k}`, note: md`Differentiate both sides. $\frac{d}{dx}(${k}x) = ${k}$.` },
      { math: md`\frac{dy}{dx} = \frac{${k} - 2x}{2y}`, note: md`Subtract $2x$, divide by $2y$.` },
    ],
  };
};

const implicitTangentLine: Generator = (r) => {
  const kind = r.int(0, 2);
  const x0 = r.nonzero(-4, 4);
  const y0 = r.nonzero(-4, 4);
  // Slope -(a x0)/(b y0), intercept c/(b y0) for a x^2 + b y^2 = c; for xy = c slope -y0/x0, intercept 2y0.
  let a = 1;
  let b = 1;
  let curve: string;
  let diff: string;
  let diffNote: string;
  let mN: number;
  let mD: number;
  let iN: number;
  let iD: number;
  let verify: string;
  if (kind === 2) {
    const c = x0 * y0;
    curve = `xy = ${c}`;
    diff = md`y + x\,\frac{dy}{dx} = 0`;
    diffNote = md`Product rule on $xy$; the constant's derivative is 0.`;
    [mN, mD, iN, iD] = [-y0, x0, 2 * y0, 1];
    verify = `${y0}(x - (${x0})) + ${x0}(q - (${y0})) = 0`;
  } else {
    if (kind === 1) {
      a = r.int(1, 3);
      b = r.pick([1, 2, 3, 4].filter((n) => n !== a));
    }
    const c = a * x0 * x0 + b * y0 * y0;
    curve = `${poly([[a, "x^2"], [b, "y^2"]])} = ${c}`;
    diff = md`${2 * a}x + ${2 * b}y\,\frac{dy}{dx} = 0`;
    diffNote = md`Power rule on $x^2$, chain rule on $y^2$.`;
    [mN, mD, iN, iD] = [-a * x0, b * y0, c, b * y0];
    verify = `${2 * a * x0}(x - (${x0})) + ${2 * b * y0}(q - (${y0})) = 0`;
  }
  const m = frac(mN, mD);
  const bb = frac(iN, iD);
  return {
    prompt: md`Find the equation of the tangent line to the curve $${curve}$ at the point $(${x0}, ${y0})$. Write it as $y = mx + b$ (you may type just $mx + b$).`,
    answer: `${m}*x + ${bb}`,
    verify: [verify],
    hint: md`Differentiate implicitly to get $\frac{dy}{dx}$, evaluate it at $(${x0}, ${y0})$ for the slope, then use point-slope form.`,
    solution: [
      { math: diff, note: diffNote },
      { math: md`m = \left.\frac{dy}{dx}\right|_{(${x0},\, ${y0})} = ${fracTex(mN, mD)}`, note: md`Solve for $\frac{dy}{dx}$ and substitute the point.` },
      { math: md`y - ${par(y0)} = ${fracTex(mN, mD)}\,(x - ${par(x0)})`, note: "Point-slope form." },
      { math: md`y = ${mN === mD ? "" : mN === -mD ? "-" : fracTex(mN, mD)}x ${iN * iD < 0 ? "-" : "+"} ${fracTex(Math.abs(iN), Math.abs(iD))}`, note: md`Distribute and add $${y0}$.` },
    ],
  };
};

// ── Lesson 2 generators: inverse functions ──────────────────────────────────

const inverseTrigDerivative: Generator = (r) => {
  const kind = r.int(0, 7);
  const a = r.int(2, 5);
  if (kind === 0) {
    return {
      prompt: md`Differentiate $\arctan(${a}x)$.`,
      answer: `${a}/(1 + ${a * a}x^2)`,
      hint: md`$\frac{d}{dx}\arctan u = \frac{u'}{1 + u^2}$ with $u = ${a}x$.`,
      solution: [
        { math: md`\frac{1}{1 + (${a}x)^2} \cdot ${a}`, note: md`Chain rule: derivative of the outer $\arctan$ at $u = ${a}x$, times $u' = ${a}$.` },
        { math: md`\frac{${a}}{1 + ${a * a}x^2}`, note: md`$(${a}x)^2 = ${a * a}x^2$.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`Differentiate $\arctan\left(\frac{x}{${a}}\right)$.`,
      answer: `${a}/(${a * a} + x^2)`,
      hint: md`Here $u = \frac{x}{${a}}$, so $u' = \frac{1}{${a}}$. Clear the small fraction at the end by multiplying top and bottom by $${a * a}$.`,
      solution: [
        { math: md`\frac{1}{1 + \left(\frac{x}{${a}}\right)^2} \cdot \frac{1}{${a}}`, note: "Chain rule." },
        { math: md`\frac{1}{${a}} \cdot \frac{${a * a}}{${a * a} + x^2}`, note: md`Multiply top and bottom of the big fraction by $${a * a}$.` },
        { math: md`\frac{${a}}{${a * a} + x^2}`, note: md`$\frac{${a * a}}{${a}} = ${a}$.` },
      ],
    };
  }
  if (kind === 2 || kind === 3) {
    const neg = kind === 3;
    const name = neg ? "\\arccos" : "\\arcsin";
    return {
      prompt: md`Differentiate $${name}\left(\frac{x}{${a}}\right)$. Type sqrt(...) for a square root.`,
      answer: `${neg ? "-" : ""}1/sqrt(${a * a} - x^2)`,
      hint: md`$\frac{d}{dx}${name} u = ${neg ? "-" : ""}\frac{u'}{\sqrt{1 - u^2}}$ with $u = \frac{x}{${a}}$. Then simplify $\sqrt{1 - \frac{x^2}{${a * a}}}$.`,
      solution: [
        { math: md`${neg ? "-" : ""}\frac{1}{\sqrt{1 - \left(\frac{x}{${a}}\right)^2}} \cdot \frac{1}{${a}}`, note: "Chain rule." },
        { math: md`${neg ? "-" : ""}\frac{1}{${a}} \cdot \frac{1}{\sqrt{\frac{${a * a} - x^2}{${a * a}}}} = ${neg ? "-" : ""}\frac{1}{${a}} \cdot \frac{${a}}{\sqrt{${a * a} - x^2}}`, note: md`$\sqrt{\frac{${a * a} - x^2}{${a * a}}} = \frac{\sqrt{${a * a} - x^2}}{${a}}$.` },
        { math: md`${neg ? "-" : ""}\frac{1}{\sqrt{${a * a} - x^2}}`, note: md`The $${a}$'s cancel.` },
      ],
    };
  }
  if (kind === 4) {
    const k = 2;
    return {
      prompt: md`Differentiate $\arcsin(${k}x)$. Type sqrt(...) for a square root.`,
      answer: `${k}/sqrt(1 - ${k * k}x^2)`,
      hint: md`$\frac{d}{dx}\arcsin u = \frac{u'}{\sqrt{1 - u^2}}$ with $u = ${k}x$.`,
      solution: [
        { math: md`\frac{1}{\sqrt{1 - (${k}x)^2}} \cdot ${k}`, note: md`Chain rule: outer $\arcsin$ at $u = ${k}x$, times $u' = ${k}$.` },
        { math: md`\frac{${k}}{\sqrt{1 - ${k * k}x^2}}`, note: md`$(${k}x)^2 = ${k * k}x^2$.` },
      ],
    };
  }
  if (kind === 5) {
    return {
      prompt: md`Differentiate $\arctan(x^2)$.`,
      answer: "2x/(1 + x^4)",
      hint: md`$u = x^2$, so $u' = 2x$ and $u^2 = x^4$.`,
      solution: [
        { math: md`\frac{1}{1 + (x^2)^2} \cdot 2x`, note: "Chain rule." },
        { math: md`\frac{2x}{1 + x^4}`, note: "" },
      ],
    };
  }
  if (kind === 6) {
    return {
      prompt: md`Differentiate $x\arctan x$. Type atan for $\arctan$.`,
      answer: "atan(x) + x/(1 + x^2)",
      hint: "Product rule, with the arctan derivative for the second factor.",
      solution: [
        { math: md`1 \cdot \arctan x + x \cdot \frac{1}{1 + x^2}`, note: md`Product rule: $(uv)' = u'v + uv'$.` },
        { math: md`\arctan x + \frac{x}{1 + x^2}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`Differentiate $\arctan(e^x)$.`,
    answer: "e^x/(1 + e^(2x))",
    hint: md`$u = e^x$, so $u' = e^x$ and $u^2 = e^{2x}$.`,
    solution: [
      { math: md`\frac{1}{1 + (e^x)^2} \cdot e^x`, note: "Chain rule." },
      { math: md`\frac{e^x}{1 + e^{2x}}`, note: md`$(e^x)^2 = e^{2x}$.` },
    ],
  };
};

const inverseRuleAtPoint: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.int(1, 4);
    const b = r.int(-3, 3);
    const c = r.int(-2, 2);
    const d = c ** 3 + a * c + b;
    const fp = 3 * c * c + a;
    const f = poly([[1, "x^3"], [a, "x"], [b, ""]]);
    return {
      prompt: md`Let $f(x) = ${f}$ and let $g$ be the inverse function of $f$. Find $g'(${d})$. Give an exact value. (First find the number $c$ with $f(c) = ${d}$; it's a small integer.)`,
      answer: frac(1, fp),
      verify: [`q * (3*(${c})^2 + ${a}) = 1`],
      hint: md`$g'(${d}) = \frac{1}{f'(c)}$ where $f(c) = ${d}$. Try small integers for $c$. ($f$ is increasing, since $f'(x) = 3x^2 + ${a} > 0$, so there is only one.)`,
      solution: [
        { math: md`f(${c}) = ${par(c)}^3 ${a === 1 ? "" : `+ ${a}`}${a === 1 ? "+" : "\\cdot"} ${par(c)} ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${d}`, note: md`So $g(${d}) = ${c}$: the inverse sends ${d} back to ${c}.` },
        { math: md`f'(x) = 3x^2 + ${a}, \qquad f'(${c}) = ${fp}`, note: "The slope of $f$ at the matching point." },
        { math: md`g'(${d}) = \frac{1}{f'(${c})} = ${fracTex(1, fp)}`, note: md`Inverse function rule: $g'(x) = \frac{1}{f'(g(x))}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(1, 5);
    return {
      prompt: md`Let $f(x) = ${a === 1 ? "" : a}x + e^x$ and let $g = f^{-1}$. Find $g'(1)$. Give an exact value.`,
      answer: frac(1, a + 1),
      verify: [`q * (${a} + e^0) = 1`],
      hint: md`Which $x$ makes $${a === 1 ? "" : a}x + e^x = 1$? Then take the reciprocal of $f'$ there.`,
      solution: [
        { math: md`f(0) = 0 + e^0 = 1`, note: md`So $g(1) = 0$.` },
        { math: md`f'(x) = ${a} + e^x, \qquad f'(0) = ${a} + 1 = ${a + 1}`, note: "" },
        { math: md`g'(1) = \frac{1}{f'(0)} = ${fracTex(1, a + 1)}`, note: "Inverse function rule." },
      ],
    };
  }
  const a = r.int(1, 4);
  return {
    prompt: md`Let $f(x) = x + ${a === 1 ? "" : a}\sin x$ and let $g = f^{-1}$. Find $g'(0)$. Give an exact value.`,
    answer: frac(1, a + 1),
    verify: [`q * (1 + ${a} cos(0)) = 1`],
    hint: md`$f(0) = 0$, so $g(0) = 0$. You need $f'(0)$.`,
    solution: [
      { math: md`f(0) = 0 + ${a === 1 ? "" : a}\sin 0 = 0`, note: md`So $g(0) = 0$.` },
      { math: md`f'(x) = 1 + ${a === 1 ? "" : a}\cos x, \qquad f'(0) = 1 + ${a} = ${a + 1}`, note: "" },
      { math: md`g'(0) = \frac{1}{f'(0)} = ${fracTex(1, a + 1)}`, note: "Inverse function rule." },
    ],
  };
};

const inverseTrigValue: Generator = (r) => {
  const [a, b, c] = r.pick(TRIPLES);
  const kind = r.int(0, 3);
  if (kind === 0 || kind === 1) {
    const neg = kind === 1;
    const name = neg ? "\\arccos" : "\\arcsin";
    return {
      prompt: md`Find $f'(x)$ when $f(x) = ${name}\left(\frac{x}{${c}}\right)$ and $x = ${a}$. Give an exact value.`,
      answer: frac(neg ? -1 : 1, b),
      hint: md`$f'(x) = ${neg ? "-" : ""}\frac{1/${c}}{\sqrt{1 - (x/${c})^2}}$. At $x = ${a}$ the square root is $\sqrt{1 - \frac{${a * a}}{${c * c}}}$, and $${c * c} - ${a * a} = ${b * b}$.`,
      solution: [
        { math: md`f'(x) = ${neg ? "-" : ""}\frac{1}{\sqrt{1 - \left(\frac{x}{${c}}\right)^2}} \cdot \frac{1}{${c}}`, note: md`Derivative of $${name}$, chain rule with $u = \frac{x}{${c}}$.` },
        { math: md`f'(${a}) = ${neg ? "-" : ""}\frac{1}{${c}} \cdot \frac{1}{\sqrt{1 - \frac{${a * a}}{${c * c}}}} = ${neg ? "-" : ""}\frac{1}{${c}} \cdot \frac{1}{\sqrt{\frac{${b * b}}{${c * c}}}}`, note: md`$${c * c} - ${a * a} = ${b * b}$: a Pythagorean triple.` },
        { math: md`= ${neg ? "-" : ""}\frac{1}{${c}} \cdot \frac{${c}}{${b}} = ${fracTex(neg ? -1 : 1, b)}`, note: md`$\sqrt{\frac{${b * b}}{${c * c}}} = \frac{${b}}{${c}}$, and the $${c}$'s cancel.` },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`Find $f'(x)$ when $f(x) = \arctan\left(\frac{x}{${a}}\right)$ and $x = ${b}$. Give an exact value.`,
      answer: frac(a, c * c),
      hint: md`$f'(x) = \frac{1/${a}}{1 + (x/${a})^2}$. Multiply top and bottom by $${a * a}$ before substituting.`,
      solution: [
        { math: md`f'(x) = \frac{1}{1 + \left(\frac{x}{${a}}\right)^2} \cdot \frac{1}{${a}} = \frac{${a}}{${a * a} + x^2}`, note: md`Chain rule, then clear the inner fraction by multiplying top and bottom by $${a * a}$.` },
        { math: md`f'(${b}) = \frac{${a}}{${a * a} + ${b * b}} = ${fracTex(a, c * c)}`, note: md`$${a * a} + ${b * b} = ${c * c}$.` },
      ],
    };
  }
  const k = r.int(2, 4);
  return {
    prompt: md`Find $f'(x)$ when $f(x) = \arctan(${k}x)$ and $x = 1$. Give an exact value.`,
    answer: frac(k, 1 + k * k),
    hint: md`$f'(x) = \frac{${k}}{1 + ${k * k}x^2}$.`,
    solution: [
      { math: md`f'(x) = \frac{1}{1 + (${k}x)^2} \cdot ${k} = \frac{${k}}{1 + ${k * k}x^2}`, note: "Chain rule." },
      { math: md`f'(1) = \frac{${k}}{1 + ${k * k}} = ${fracTex(k, 1 + k * k)}`, note: "" },
    ],
  };
};

// ── Lesson 3 generators: related rates ──────────────────────────────────────

const expandingShapes: Generator = (r) => {
  const kind = r.int(0, 2);
  const forward = r.next() < 0.5;
  if (kind === 0) {
    const R = r.int(3, 12);
    if (forward) {
      const v = r.int(1, 4);
      return {
        prompt: md`A circular oil slick spreads so that its radius grows at ${v} m/s. How fast is its area growing when the radius is ${R} m? Give an exact answer in square meters per second (write pi for $\pi$).`,
        answer: piTimes(2 * R * v, 1),
        verify: [`q = 2 pi (${R}) (${v})`],
        hint: md`$A = \pi r^2$ holds at every moment. Differentiate both sides with respect to $t$, remembering that $r$ is a function of $t$.`,
        solution: [
          { math: md`A = \pi r^2`, note: md`The equation linking the two changing quantities, true at all times.` },
          { math: md`\frac{dA}{dt} = 2\pi r\,\frac{dr}{dt}`, note: md`Differentiate with respect to $t$: chain rule on $r^2$.` },
          { math: md`\frac{dA}{dt} = 2\pi(${R})(${v}) = ${piTimesTex(2 * R * v, 1)}`, note: md`Now substitute the instant: $r = ${R}$, $\frac{dr}{dt} = ${v}$. Units: square meters per second.` },
        ],
      };
    }
    const k = r.pick([6, 8, 10, 12, 18, 20, 24, 30]);
    return {
      prompt: md`A circular ripple's area grows at ${k} square centimeters per second. How fast is its radius growing when the radius is ${R} cm? Give an exact answer in cm/s (write pi for $\pi$).`,
      answer: overPi(k, 2 * R),
      verify: [`2 pi (${R}) q = ${k}`],
      hint: md`Differentiate $A = \pi r^2$ with respect to $t$, then solve the result for $\frac{dr}{dt}$.`,
      solution: [
        { math: md`\frac{dA}{dt} = 2\pi r\,\frac{dr}{dt}`, note: md`From $A = \pi r^2$, differentiated with respect to $t$.` },
        { math: md`${k} = 2\pi(${R})\frac{dr}{dt}`, note: md`Substitute $\frac{dA}{dt} = ${k}$ and $r = ${R}$.` },
        { math: md`\frac{dr}{dt} = \frac{${k}}{${2 * R}\pi} = ${overPiTex(k, 2 * R)}`, note: "Divide. Units: cm/s." },
      ],
    };
  }
  if (kind === 1) {
    const R = r.int(2, 6);
    if (forward) {
      const v = r.int(1, 3);
      return {
        prompt: md`A spherical balloon is inflated so that its radius grows at ${v} cm/s. How fast is its volume increasing when the radius is ${R} cm? Give an exact answer in cubic centimeters per second (write pi for $\pi$).`,
        answer: piTimes(4 * R * R * v, 1),
        verify: [`q = 4 pi (${R})^2 (${v})`],
        hint: md`$V = \frac{4}{3}\pi r^3$. Differentiate with respect to $t$; the chain rule puts a $\frac{dr}{dt}$ on the right.`,
        solution: [
          { math: md`V = \tfrac{4}{3}\pi r^3`, note: "True at every moment." },
          { math: md`\frac{dV}{dt} = 4\pi r^2\,\frac{dr}{dt}`, note: md`$\frac{d}{dt} r^3 = 3r^2\frac{dr}{dt}$, and $\frac{4}{3} \cdot 3 = 4$.` },
          { math: md`\frac{dV}{dt} = 4\pi(${R})^2(${v}) = ${piTimesTex(4 * R * R * v, 1)}`, note: "Substitute the instant. Units: cubic centimeters per second." },
        ],
      };
    }
    const k = r.pick([8, 12, 16, 20, 24, 32, 36, 48]);
    return {
      prompt: md`Air is pumped into a spherical balloon at ${k} cubic centimeters per second. How fast is the radius growing when the radius is ${R} cm? Give an exact answer in cm/s (write pi for $\pi$).`,
      answer: overPi(k, 4 * R * R),
      verify: [`4 pi (${R})^2 q = ${k}`],
      hint: md`Differentiate $V = \frac{4}{3}\pi r^3$ with respect to $t$, substitute, and solve for $\frac{dr}{dt}$.`,
      solution: [
        { math: md`\frac{dV}{dt} = 4\pi r^2\,\frac{dr}{dt}`, note: md`From $V = \frac{4}{3}\pi r^3$.` },
        { math: md`${k} = 4\pi(${R})^2\,\frac{dr}{dt} = ${4 * R * R}\pi\,\frac{dr}{dt}`, note: md`Substitute $\frac{dV}{dt} = ${k}$, $r = ${R}$.` },
        { math: md`\frac{dr}{dt} = ${overPiTex(k, 4 * R * R)}`, note: "Divide. The same pump inflates a big balloon more slowly, as the formula says." },
      ],
    };
  }
  const s = r.int(2, 10);
  if (forward) {
    const v = r.int(1, 3);
    return {
      prompt: md`A cubic salt crystal grows so that each edge lengthens at ${v} mm per hour. How fast is its volume growing when the edge is ${s} mm? Give an exact answer in cubic millimeters per hour.`,
      answer: String(3 * s * s * v),
      verify: [`q = 3 (${s})^2 (${v})`],
      hint: md`$V = s^3$. Differentiate with respect to $t$.`,
      solution: [
        { math: md`\frac{dV}{dt} = 3s^2\,\frac{ds}{dt}`, note: md`Chain rule on $s^3$.` },
        { math: md`\frac{dV}{dt} = 3(${s})^2(${v}) = ${3 * s * s * v}`, note: "Substitute the instant. Units: cubic millimeters per hour." },
      ],
    };
  }
  const k = r.pick([6, 12, 18, 24, 30, 36, 48, 60]);
  return {
    prompt: md`A cubic salt crystal gains volume at ${k} cubic millimeters per hour. How fast is each edge growing when the edge is ${s} mm? Give an exact answer in mm per hour (a fraction if needed).`,
    answer: frac(k, 3 * s * s),
    verify: [`3 (${s})^2 q = ${k}`],
    hint: md`Differentiate $V = s^3$ with respect to $t$, then solve for $\frac{ds}{dt}$.`,
    solution: [
      { math: md`\frac{dV}{dt} = 3s^2\,\frac{ds}{dt}`, note: "" },
      { math: md`${k} = 3(${s})^2\,\frac{ds}{dt} = ${3 * s * s}\,\frac{ds}{dt}`, note: "Substitute." },
      { math: md`\frac{ds}{dt} = ${fracTex(k, 3 * s * s)}`, note: "Divide. Units: mm per hour." },
    ],
  };
};

const rightTriangleRates: Generator = (r) => {
  const [a, b, c] = r.pick(TRIPLES);
  const kind = r.int(0, 2);
  if (kind === 0) {
    const v = r.int(1, 4);
    return {
      prompt: md`A ${c}-ft ladder leans against a vertical wall. Its bottom slides away from the wall at ${v} ft/s. Let $y$ be the height of the top. Find $\frac{dy}{dt}$ when the bottom is ${a} ft from the wall. Give an exact value in ft/s (it is negative, since the top is moving down).`,
      answer: frac(-a * v, b),
      verify: [`2(${a})(${v}) + 2(${b}) q = 0`],
      hint: md`Let $x$ be the distance of the bottom from the wall. $x^2 + y^2 = ${c}^2$ at all times. Differentiate with respect to $t$. When $x = ${a}$, the Pythagorean Theorem gives $y = ${b}$.`,
      solution: [
        { math: md`x^2 + y^2 = ${c * c}`, note: md`The ladder, wall and ground form a right triangle with hypotenuse ${c} at every moment.` },
        { math: md`2x\,\frac{dx}{dt} + 2y\,\frac{dy}{dt} = 0`, note: md`Differentiate with respect to $t$: both $x$ and $y$ change, so both get the chain rule.` },
        { math: md`y = \sqrt{${c * c} - ${a * a}} = ${b}`, note: md`The height at the instant $x = ${a}$.` },
        { math: md`2(${a})(${v}) + 2(${b})\frac{dy}{dt} = 0`, note: md`Substitute $x = ${a}$, $\frac{dx}{dt} = ${v}$, $y = ${b}$.` },
        { math: md`\frac{dy}{dt} = -\frac{${a * v}}{${b}}${gcd(a * v, b) > 1 ? ` = ${fracTex(-a * v, b)}` : ""}`, note: "Negative: the top is sliding down, as expected." },
      ],
    };
  }
  if (kind === 1) {
    const u = r.pick([20, 30, 40, 50, 60]);
    const w = r.pick([20, 30, 40, 50, 60, 70, 80]);
    const num = a * u + b * w;
    return {
      prompt: md`Two cars leave an intersection at the same time. One drives east at ${u} mi/h, the other north at ${w} mi/h. How fast is the distance between them increasing when the eastbound car is ${a} mi from the intersection and the northbound car is ${b} mi? Give an exact value in mi/h.`,
      answer: frac(num, c),
      verify: [`2(${a})(${u}) + 2(${b})(${w}) = 2(${c}) q`],
      hint: md`Let $x$ and $y$ be the cars' distances from the intersection and $z$ the distance between them: $x^2 + y^2 = z^2$. Differentiate with respect to $t$. At the instant, $z = ${c}$.`,
      solution: [
        { math: md`x^2 + y^2 = z^2`, note: "The roads are perpendicular, so this holds at all times." },
        { math: md`2x\,\frac{dx}{dt} + 2y\,\frac{dy}{dt} = 2z\,\frac{dz}{dt}`, note: md`Differentiate with respect to $t$.` },
        { math: md`z = \sqrt{${a}^2 + ${b}^2} = ${c}`, note: "The distance at that instant." },
        { math: md`2(${a})(${u}) + 2(${b})(${w}) = 2(${c})\frac{dz}{dt}`, note: "Substitute the instant." },
        { math: md`\frac{dz}{dt} = \frac{${a * u} + ${b * w}}{${c}} = ${fracTex(num, c)}`, note: "Divide by $2$ and by $z$. Units: mi/h." },
      ],
    };
  }
  const v = r.int(1, 3);
  return {
    prompt: md`A boat is pulled toward a dock by a rope that passes through a pulley ${b} ft above the boat's bow. The rope is pulled in at ${v} ft/s. How fast is the boat approaching the dock when ${c} ft of rope are out? Give the speed as a positive exact value in ft/s.`,
    answer: frac(c * v, a),
    verify: [`(${a}) q = (${c})(${v})`],
    hint: md`Let $x$ be the horizontal distance to the dock and $z$ the rope length: $x^2 + ${b}^2 = z^2$. The rope shortens, so $\frac{dz}{dt} = -${v}$. When $z = ${c}$, $x = ${a}$.`,
    solution: [
      { math: md`x^2 + ${b * b} = z^2`, note: md`Right triangle: horizontal distance $x$, fixed height ${b}, rope $z$.` },
      { math: md`2x\,\frac{dx}{dt} = 2z\,\frac{dz}{dt}`, note: md`Differentiate with respect to $t$. The constant ${b * b} contributes 0.` },
      { math: md`x = \sqrt{${c}^2 - ${b}^2} = ${a}`, note: md`At the instant $z = ${c}$.` },
      { math: md`(${a})\frac{dx}{dt} = (${c})(-${v})`, note: md`Divide by 2 and substitute. The rope is getting shorter, so $\frac{dz}{dt} = -${v}$.` },
      { math: md`\frac{dx}{dt} = -${fracTex(c * v, a)}`, note: md`Negative because $x$ is shrinking. The boat approaches at $${fracTex(c * v, a)}$ ft/s, faster than the rope is pulled.` },
    ],
  };
};

const similarTriangleRates: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [R, H] = r.pick<[number, number]>([
      [2, 4],
      [3, 6],
      [4, 8],
      [5, 10],
      [2, 6],
      [3, 9],
      [4, 12],
    ]);
    const k = r.int(2, 10);
    const h = r.int(1, H - 1);
    return {
      prompt: md`A tank is an inverted cone ${H} m deep and ${R} m in radius at the top. Water flows in at ${k} cubic meters per minute. How fast is the water level rising when the water is ${h} m deep? Give an exact answer in m/min (write pi for $\pi$).`,
      answer: overPi(k * H * H, R * R * h * h),
      verify: [`pi (${R}/${H})^2 (${h})^2 q = ${k}`],
      hint: md`The water is a cone of radius $r$ and depth $h$ with $V = \frac{1}{3}\pi r^2 h$. Similar triangles give $\frac{r}{h} = \frac{${R}}{${H}}$ at all times; use that to write $V$ in terms of $h$ alone before differentiating.`,
      solution: [
        { math: md`\frac{r}{h} = \frac{${R}}{${H}} \quad\Rightarrow\quad r = ${fracTex(R, H)}\,h`, note: "The water's surface and the tank's rim are always similar triangles with the apex." },
        { math: md`V = \tfrac{1}{3}\pi r^2 h = \tfrac{1}{3}\pi\left(${fracTex(R, H)}\,h\right)^2 h = ${piTimesTex(R * R, 3 * H * H)}\,h^3`, note: md`Substitute: now $V$ depends on $h$ only. This substitution is safe because $r = ${fracTex(R, H)}h$ holds at every moment, not just at one instant.` },
        { math: md`\frac{dV}{dt} = ${piTimesTex(R * R, H * H)}\,h^2\,\frac{dh}{dt}`, note: md`Differentiate with respect to $t$: $\frac{d}{dt}h^3 = 3h^2\frac{dh}{dt}$, and the 3 cancels.` },
        { math: md`${k} = ${piTimesTex(R * R, H * H)}(${h})^2\,\frac{dh}{dt}`, note: md`Substitute $\frac{dV}{dt} = ${k}$ and $h = ${h}$.` },
        { math: md`\frac{dh}{dt} = \frac{${k} \cdot ${H * H}}{${R * R} \cdot ${h * h}\,\pi} = ${overPiTex(k * H * H, R * R * h * h)}`, note: "Solve. Units: meters per minute." },
      ],
    };
  }
  if (kind === 1) {
    const L = r.pick([12, 15, 16, 18, 20]);
    const P = r.pick([5, 6]);
    const v = r.int(3, 6);
    const d = r.pick([10, 20, 30]);
    return {
      prompt: md`A streetlight is ${L} ft tall. A person ${P} ft tall walks away from it at ${v} ft/s. How fast is the tip of the person's shadow moving (relative to the ground) when the person is ${d} ft from the light? Give an exact value in ft/s.`,
      answer: frac(v * L, L - P),
      verify: [`q/${L} = (q - ${v})/${P}`],
      hint: md`Let $x$ be the person's distance from the light and $s$ the shadow's length. The light's pole and the person make similar triangles: $\frac{x + s}{${L}} = \frac{s}{${P}}$. The tip is at $x + s$.`,
      solution: [
        { math: md`\frac{x + s}{${L}} = \frac{s}{${P}}`, note: md`Similar triangles: the big one from the lamp's base to the shadow's tip, the small one from the person's feet to the tip.` },
        { math: md`${P}(x + s) = ${L}s \quad\Rightarrow\quad s = \frac{${P}}{${L - P}}\,x`, note: md`Cross-multiply and solve for $s$. This relation holds at every moment.` },
        { math: md`T = x + s = \frac{${L}}{${L - P}}\,x`, note: md`$T$ is the position of the shadow's tip.` },
        { math: md`\frac{dT}{dt} = \frac{${L}}{${L - P}}\,\frac{dx}{dt} = \frac{${L}}{${L - P}}(${v}) = ${fracTex(v * L, L - P)}`, note: md`The tip moves at a constant multiple of the walking speed. The ${d} ft doesn't matter: the answer is the same at every distance.` },
      ],
    };
  }
  const [a, b, c] = r.pick(TRIPLES.filter((t) => t[0] <= 12));
  const s = r.pick([10, 20]);
  const d = a * s;
  const h = b * s;
  const v = r.int(2, 6);
  // tan(theta) = h/d; sec^2(theta) theta' = v/d; theta' = v d/(d^2 + h^2).
  return {
    prompt: md`A hot-air balloon rises straight up at ${v} m/s. An observer stands ${d} m from the launch point. How fast is the observer's angle of elevation $\theta$ increasing when the balloon is ${h} m high? Give an exact value in radians per second.`,
    answer: frac(v * d, c * c * s * s),
    verify: [`(1 + (${h}/${d})^2) q = ${v}/${d}`],
    hint: md`$\tan\theta = \frac{h}{${d}}$ at all times. Differentiate with respect to $t$: $\sec^2\theta\,\frac{d\theta}{dt} = \frac{1}{${d}}\frac{dh}{dt}$. Use $\sec^2\theta = 1 + \tan^2\theta$.`,
    solution: [
      { math: md`\tan\theta = \frac{h}{${d}}`, note: md`Opposite over adjacent in the right triangle made by the observer, the launch point and the balloon.` },
      { math: md`\sec^2\theta\,\frac{d\theta}{dt} = \frac{1}{${d}}\,\frac{dh}{dt}`, note: md`Differentiate with respect to $t$: chain rule on $\tan\theta$.` },
      { math: md`\sec^2\theta = 1 + \tan^2\theta = 1 + \left(\frac{${h}}{${d}}\right)^2 = ${fracTex(c * c, a * a)}`, note: md`At the instant, $\tan\theta = \frac{${h}}{${d}} = \frac{${b}}{${a}}$.` },
      { math: md`\frac{d\theta}{dt} = ${fracTex(a * a, c * c)} \cdot \frac{${v}}{${d}} = ${fracTex(v * d, c * c * s * s)}`, note: "Solve. Units: radians per second." },
    ],
  };
};

// ── Figures ─────────────────────────────────────────────────────────────────

const circleTangents: Block = {
  kind: "plot",
  x: [-8, 8],
  y: [-8, 8],
  parametric: [{ x: "5cos(t)", y: "5sin(t)", t: [0, 6.2832], label: "x^2 + y^2 = 25" }],
  curves: [
    { expr: "sqrt(25 - a^2) - a (x - a)/sqrt(25 - a^2)", color: 2, dashed: true },
    { expr: "-sqrt(25 - a^2) + a (x - a)/sqrt(25 - a^2)", color: 3, dashed: true },
  ],
  points: [
    { x: "a", y: "sqrt(25 - a^2)", label: "({a}, {=sqrt(25 - a^2)})", color: 2 },
    { x: "a", y: "-sqrt(25 - a^2)", label: "({a}, {=-sqrt(25 - a^2)})", color: 3 },
  ],
  params: [{ name: "a", tex: md`x`, min: -4.5, max: 4.5, step: 0.5, value: 3 }],
  caption: md`One $x$, two points on the circle, two tangent lines. The upper slope is ${"{=-a/sqrt(25 - a^2)}"} and the lower slope is ${"{=a/sqrt(25 - a^2)}"}. Both come from the single formula $\frac{dy}{dx} = -\frac{x}{y}$ derived below: same $x$, opposite $y$, opposite slope.`,
};

const foliumFigure: Block = {
  kind: "contour",
  x: [-3.5, 5],
  y: [-3.5, 5],
  expr: "x^3 + y^3 - 6x y",
  levels: [0],
  points: [{ x: 3, y: 3, label: "(3, 3)", color: 2 }],
  caption: md`The curve $x^3 + y^3 = 6xy$, drawn as the level set where $x^3 + y^3 - 6xy = 0$. There is no formula $y = f(x)$ for it, and near the origin a vertical line crosses it three times. Still, every point away from the origin has a tangent line, and implicit differentiation finds its slope. At $(3, 3)$ the slope is $-1$.`,
};

const mirrorFigure: Block = {
  kind: "plot",
  x: [-2.5, 6.5],
  y: [-2.5, 6.5],
  curves: [
    { expr: "x", color: 4, dashed: true, label: "y = x" },
    { expr: "e^x", color: 1, label: "y = e^x" },
    { expr: "ln(x)", color: 2, label: "y = \\ln x" },
    { expr: "e^c + e^c (x - c)", color: 1, dashed: true },
    { expr: "c + (x - e^c)/e^c", color: 2, dashed: true },
  ],
  points: [
    { x: "c", y: "e^c", label: "({c}, {=e^c})", color: 1 },
    { x: "e^c", y: "c", label: "({=e^c}, {c})", color: 2 },
  ],
  params: [{ name: "c", tex: md`c`, min: -1.5, max: 1.5, step: 0.25, value: 0.5 }],
  caption: md`$y = e^x$ and its inverse $y = \ln x$ are mirror images across $y = x$, and so are their tangent lines. The blue tangent has slope ${"{=e^c}"}; the orange one has slope ${"{=1/e^c}"}. Reflecting swaps rise and run, so one slope is the reciprocal of the other.`,
};

const arcsinTriangle: Block = {
  kind: "diagram",
  view: [-1.2, 5.2, -1, 4.6],
  params: [{ name: "s", tex: md`x`, min: 0.1, max: 0.95, step: 0.05, value: 0.6 }],
  points: [
    { name: "A", x: 0, y: 0, label: "", dir: "sw" },
    { name: "B", x: "4sqrt(1 - s^2)", y: 0, label: "", dir: "se" },
    { name: "C", x: "4sqrt(1 - s^2)", y: "4s", label: "", dir: "ne" },
  ],
  polygons: [{ points: ["A", "B", "C"], fill: 1 }],
  segments: [
    { from: "A", to: "C", label: md`1` },
    { from: "B", to: "C", color: 2, label: md`x = {s}` },
    { from: "A", to: "B", color: 3, label: md`\sqrt{1 - x^2} = {=sqrt(1 - s^2)}` },
  ],
  angles: [
    { at: "B", from: "C", to: "A", right: true },
    { at: "A", from: "B", to: "C", label: md`y`, color: 1 },
  ],
  readouts: [
    { label: md`y = \arcsin x`, value: "asin(s)", unit: md`\text{ rad}` },
    { label: md`\cos y`, value: "sqrt(1 - s^2)" },
  ],
  caption: md`If $y = \arcsin x$, then $\sin y = x$: a right triangle with hypotenuse 1 and opposite side $x$. The adjacent side is $\sqrt{1 - x^2}$, so $\cos y = \sqrt{1 - x^2}$. Slide $x$ toward 1: the adjacent side shrinks to 0, and $\frac{1}{\cos y}$ blows up. That's the steep end of the arcsin graph.`,
};

const arcsinPlot: Block = {
  kind: "plot",
  x: [-1.6, 1.6],
  y: [-2, 4.5],
  curves: [
    { expr: "asin(x)", label: "y = \\arcsin x", color: 1, domain: [-1, 1] },
    { expr: "1/sqrt(1 - x^2)", label: "y = \\frac{1}{\\sqrt{1 - x^2}}", color: 2, domain: [-0.999, 0.999] },
  ],
  vlines: [{ x: -1 }, { x: 1 }],
  points: [
    { x: 0, y: 1, label: "(0, 1)", color: 2 },
    { x: 1, y: 1.5708, label: "(1, \\tfrac{\\pi}{2})", color: 1 },
    { x: -1, y: -1.5708, label: "(-1, -\\tfrac{\\pi}{2})", color: 1 },
  ],
  caption: md`$\arcsin x$ (blue) and its derivative $\frac{1}{\sqrt{1 - x^2}}$ (orange). At $x = 0$ the slope is 1, matching $\sin$'s slope of 1 at the origin. Toward $x = \pm 1$ the arcsin graph turns vertical and the derivative climbs without bound.`,
};

const ladderFigure: Block = {
  kind: "diagram",
  view: [-3.6, 11.5, -1.6, 11.5],
  params: [{ name: "a", tex: md`x`, min: 1, max: 9.5, step: 0.5, value: 6 }],
  points: [
    { name: "O", x: 0, y: 0, label: "", dir: "sw" },
    { name: "W", x: 0, y: 11, label: "", hidden: true },
    { name: "G", x: 11, y: 0, label: "", hidden: true },
    { name: "B", x: "a", y: 0, label: "", dir: "s" },
    { name: "T", x: 0, y: "sqrt(100 - a^2)", label: "", dir: "w" },
  ],
  segments: [
    { from: "O", to: "W" },
    { from: "O", to: "G" },
    { from: "B", to: "T", color: 2, label: md`10` },
  ],
  angles: [{ at: "O", from: "B", to: "T", right: true }],
  labels: [
    { x: "a/2", y: -0.9, text: md`x = {a}` },
    { x: -1.9, y: "sqrt(100 - a^2)/2", text: md`y = {=sqrt(100 - a^2)}` },
  ],
  readouts: [
    { label: md`x^2 + y^2`, value: "a^2 + (100 - a^2)" },
    { label: md`\frac{dy}{dt} \text{ when } \frac{dx}{dt} = 2`, value: "-2a/sqrt(100 - a^2)", unit: md`\text{ ft/s}` },
  ],
  caption: md`A 10-ft ladder. Slide the bottom out. The top comes down, and the second readout shows how fast it comes down when the bottom moves at 2 ft/s: slowly at first, then faster and faster. The top's speed depends on where the ladder is, which is why the problem must name an instant.`,
};

const coneFigure: Block = {
  kind: "diagram",
  view: [-5.5, 6.5, -1, 9.6],
  params: [{ name: "h", tex: md`h`, min: 0.5, max: 7.5, step: 0.5, value: 3 }],
  points: [
    { name: "A", x: 0, y: 0, label: "", dir: "s" },
    { name: "L", x: -4, y: 8, label: "", hidden: true },
    { name: "R", x: 4, y: 8, label: "", hidden: true },
    { name: "C", x: 0, y: 8, label: "", hidden: true },
    { name: "P", x: "-h/2", y: "h", label: "", hidden: true },
    { name: "Q", x: "h/2", y: "h", label: "", hidden: true },
    { name: "M", x: 0, y: "h", label: "", hidden: true },
  ],
  polygons: [{ points: ["A", "P", "Q"], fill: 1 }],
  segments: [
    { from: "A", to: "L" },
    { from: "A", to: "R" },
    { from: "L", to: "R" },
    { from: "C", to: "R", label: md`4`, dashed: true },
    { from: "A", to: "C", dashed: true },
    { from: "M", to: "Q", color: 2, label: md`r = {=h/2}` },
  ],
  angles: [{ at: "C", from: "R", to: "A", right: true }],
  labels: [
    { x: 5, y: 4, text: md`8` },
    { x: -1.1, y: "h/2", text: md`h = {h}` },
  ],
  readouts: [
    { label: md`\frac{r}{h}`, value: "(h/2)/h" },
    { label: md`V = \tfrac{1}{3}\pi r^2 h`, value: "pi (h/2)^2 h/3" },
  ],
  caption: md`A cross-section of the conical tank (radius 4, depth 8) with water to depth $h$. The water's surface and the tank's rim make similar triangles with the apex, so $\frac{r}{h} = \frac{4}{8}$ no matter the depth: $r = \frac{h}{2}$ always.`,
};

const balloonFigure: Block = {
  kind: "diagram",
  view: [-1.5, 8, -1, 9.8],
  params: [{ name: "h", tex: md`h`, min: 0.5, max: 9, step: 0.5, value: 6 }],
  points: [
    { name: "O", x: 0, y: 0, label: "", dir: "sw" },
    { name: "L", x: 6, y: 0, label: "", dir: "se" },
    { name: "B", x: 6, y: "h", label: "", dir: "ne" },
  ],
  segments: [
    { from: "O", to: "L", label: md`600` },
    { from: "L", to: "B", color: 2, label: md`h = {=100h}` },
    { from: "O", to: "B", dashed: true },
  ],
  angles: [
    { at: "L", from: "B", to: "O", right: true },
    { at: "O", from: "L", to: "B", label: md`\theta`, color: 1 },
  ],
  readouts: [
    { label: md`\tan\theta`, value: "h/6" },
    { label: md`\theta`, value: "atan(h/6) 180/pi", unit: md`^\circ` },
  ],
  caption: md`The camera at $O$, the launch pad 600 m away, and the rocket at height $h$. Slide $h$ up. The angle grows quickly at first and then more slowly, because the far end of the triangle barely turns the sightline. The rate $\frac{d\theta}{dt}$ depends on $h$.`,
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Implicit Differentiation",
  lessons: [
    {
      id: slug("Implicit differentiation"),
      title: "Implicit differentiation",
      summary: "When y is tied to x by an equation instead of a formula: differentiate both sides, and every y brings a dy/dx with it.",
      blocks: [
        {
          kind: "text",
          body: md`Every function you have differentiated so far came with a formula: $y = x^2$, $y = \sin x$, $y = e^{3x}$. Many curves don't. The circle $x^2 + y^2 = 25$ has a tangent line at every point, but it isn't the graph of one function: solving for $y$ gives two, $y = \sqrt{25 - x^2}$ and $y = -\sqrt{25 - x^2}$. The curve $x^3 + y^3 = 6xy$ is worse. It can't be solved for $y$ in any usable way at all. This lesson finds slopes on such curves without solving for $y$.`,
        },
        circleTangents,
        {
          kind: "key",
          title: "Explicit and implicit",
          body: md`A function is **explicit** when it's written as $y = f(x)$. An equation in $x$ and $y$, like $x^2 + y^2 = 25$, defines $y$ **implicitly**: near most points of the curve there is exactly one $y$ for each $x$, so a small piece of the curve is the graph of some function $y = f(x)$, even if we never write a formula for it. The circle's upper half is one such function, its lower half another.`,
        },
        {
          kind: "why",
          title: "Why both sides can be differentiated",
          body: md`Suppose a piece of the curve is the graph of $y = f(x)$ for $x$ in some interval. Then $x^2 + (f(x))^2 = 25$ for **every** $x$ in that interval. That isn't an equation to solve; it's an identity. The function $x^2 + (f(x))^2$ and the constant function $25$ are the same function. Two functions with the same values have the same graph, so the same slopes, so the same derivative. Differentiating both sides of an identity keeps it an identity.

Compare an equation that's true for one $x$, like $2x = 6$. Differentiating gives $2 = 0$, nonsense, because the two sides are different functions that happen to agree at one point. Implicit differentiation works only on equations that hold along a whole stretch of the curve.`,
        },
        {
          kind: "why",
          title: "Why the derivative of y² is 2y dy/dx",
          body: md`On the curve, $y$ is a function of $x$, so $y^2$ means $(f(x))^2$: a composition with outer function "square" and inner function $f$. The chain rule (Unit 3) gives

$$\frac{d}{dx}(f(x))^2 = 2f(x) \cdot f'(x) = 2y\,\frac{dy}{dx}.$$

The $\frac{dy}{dx}$ is the whole point. $\frac{d}{dy}\,y^2 = 2y$ measures how $y^2$ responds to a change in $y$. We want its response to a change in $x$, and that has to go through $y$: rates multiply. The same reasoning gives $\frac{d}{dx}\,y^n = ny^{n-1}\frac{dy}{dx}$, $\frac{d}{dx}\sin y = \cos y\,\frac{dy}{dx}$, and in general $\frac{d}{dx}\,g(y) = g'(y)\,\frac{dy}{dx}$. Every time you differentiate something containing $y$, a factor of $\frac{dy}{dx}$ comes out. Terms with only $x$ differentiate as usual.`,
        },
        {
          kind: "example",
          title: "The circle",
          problem: md`Find $\frac{dy}{dx}$ for $x^2 + y^2 = 25$, and the slopes at $(3, 4)$ and $(3, -4)$.`,
          steps: [
            { math: md`\frac{d}{dx}\left(x^2 + y^2\right) = \frac{d}{dx}(25)`, note: "Differentiate both sides with respect to $x$." },
            { math: md`2x + 2y\,\frac{dy}{dx} = 0`, note: md`Power rule on $x^2$; chain rule on $y^2$; a constant's derivative is 0.` },
            { math: md`\frac{dy}{dx} = -\frac{x}{y}`, note: md`Subtract $2x$, divide by $2y$. The answer involves both $x$ and $y$, and that's normal.` },
            { math: md`\text{at } (3, 4):\ -\tfrac{3}{4}, \qquad \text{at } (3, -4):\ \tfrac{3}{4}`, note: "Substitute each point. Same $x$, opposite slopes: the picture above." },
          ],
        },
        {
          kind: "proof",
          title: "The method is sound",
          given: md`On an interval, $y = f(x)$ is differentiable and $x^2 + (f(x))^2 = 25$ for every $x$ in the interval.`,
          prove: md`$f'(x) = -\dfrac{x}{f(x)}$ wherever $f(x) \ne 0$.`,
          steps: [
            { statement: md`$x^2 + (f(x))^2 = 25$ for all $x$ in the interval`, reason: "Given" },
            { statement: md`$\frac{d}{dx}\left[x^2 + (f(x))^2\right] = \frac{d}{dx}[25]$`, reason: "Equal functions have the same graph, so the same slope at every point" },
            { statement: md`$2x + \frac{d}{dx}(f(x))^2 = 0$`, reason: "Sum rule, power rule, and the derivative of a constant is 0 (Unit 3)" },
            { statement: md`$\frac{d}{dx}(f(x))^2 = 2f(x)\,f'(x)$`, reason: md`Chain rule: outer function $u^2$, inner function $u = f(x)$` },
            { statement: md`$2x + 2f(x)\,f'(x) = 0$`, reason: "Substitute step 4 into step 3" },
            { statement: md`$f'(x) = -\dfrac{x}{f(x)}$`, reason: md`Subtract $2x$; divide by $2f(x)$, which isn't 0` },
            { statement: md`$\dfrac{dy}{dx} = -\dfrac{x}{y}$`, reason: md`Rewrite with $y = f(x)$. This is exactly what implicit differentiation produced, so the shortcut is justified` },
          ],
        },
        {
          kind: "key",
          title: "Implicit differentiation",
          body: md`To find $\frac{dy}{dx}$ from an equation in $x$ and $y$:

- Differentiate both sides with respect to $x$. Treat $y$ as a function of $x$: every $y$-term gets the chain rule and a factor of $\frac{dy}{dx}$. Products like $xy$ need the product rule.
- Collect the terms containing $\frac{dy}{dx}$ on one side, the rest on the other.
- Factor out $\frac{dy}{dx}$ and divide.

The result is usually in terms of both $x$ and $y$. To get a number, substitute a point on the curve.`,
        },
        {
          kind: "example",
          title: "A curve with no formula",
          problem: md`Find $\frac{dy}{dx}$ for $x^3 + y^3 = 6xy$, and the slope at $(3, 3)$.`,
          steps: [
            { math: md`3x^2 + 3y^2\,\frac{dy}{dx} = 6y + 6x\,\frac{dy}{dx}`, note: md`Left side: power rule and chain rule. Right side: product rule, $\frac{d}{dx}(6xy) = 6y + 6x\frac{dy}{dx}$.` },
            { math: md`3y^2\,\frac{dy}{dx} - 6x\,\frac{dy}{dx} = 6y - 3x^2`, note: md`$\frac{dy}{dx}$ terms left, everything else right.` },
            { math: md`\frac{dy}{dx} = \frac{6y - 3x^2}{3y^2 - 6x} = \frac{2y - x^2}{y^2 - 2x}`, note: "Factor and divide; cancel the 3." },
            { math: md`\left.\frac{dy}{dx}\right|_{(3, 3)} = \frac{6 - 9}{9 - 6} = -1`, note: md`Check: $27 + 27 = 54 = 6 \cdot 9$, so $(3, 3)$ really is on the curve.` },
          ],
        },
        foliumFigure,
        {
          kind: "why",
          title: "Why solving for dy/dx is always one division",
          body: md`Each term of the equation differentiates to something with at most one factor of $\frac{dy}{dx}$. A term in $x$ alone has none. A term like $y^3$ gives $3y^2\frac{dy}{dx}$: one factor. A product like $6xy$ gives $6y + 6x\frac{dy}{dx}$: a term with none plus a term with one. Nothing ever multiplies two of them together, so the differentiated equation is **linear** in $\frac{dy}{dx}$, however tangled the original curve. Collect, factor, divide. It always works.`,
        },
        {
          kind: "example",
          title: "Product rule and chain rule together",
          problem: md`Find $\frac{dy}{dx}$ when $x\sin y + y^2 = x$.`,
          steps: [
            { math: md`1 \cdot \sin y + x\cos y\,\frac{dy}{dx} + 2y\,\frac{dy}{dx} = 1`, note: md`$x\sin y$ is a product: $(x)'\sin y + x(\sin y)'$, and $(\sin y)' = \cos y\frac{dy}{dx}$ by the chain rule.` },
            { math: md`(x\cos y + 2y)\frac{dy}{dx} = 1 - \sin y`, note: md`Move $\sin y$ to the right; factor out $\frac{dy}{dx}$.` },
            { math: md`\frac{dy}{dx} = \frac{1 - \sin y}{x\cos y + 2y}`, note: "Divide." },
          ],
        },
        {
          kind: "text",
          body: md`**Cross-check with the explicit version.** The upper half of the circle is $y = \sqrt{25 - x^2} = (25 - x^2)^{1/2}$. The chain rule gives $\frac{dy}{dx} = \frac{1}{2}(25 - x^2)^{-1/2}(-2x) = \frac{-x}{\sqrt{25 - x^2}} = -\frac{x}{y}$. Same answer, more work, and it only covers one half. The implicit form covers both halves at once.

**Horizontal and vertical tangents.** With $\frac{dy}{dx}$ written as a fraction, the tangent is horizontal where the numerator is 0 (and the denominator isn't), and vertical where the denominator is 0 (and the numerator isn't). On the circle, $-\frac{x}{y}$ is 0 at $(0, \pm 5)$ and undefined at $(\pm 5, 0)$, exactly the top, bottom and sides.`,
        },
        {
          kind: "check",
          prompt: md`Find $\frac{dy}{dx}$ for $x^2 + xy + y^2 = 7$. Give it in terms of $x$ and $y$.`,
          answer: "-(2x + y)/(x + 2y)",
          explain: md`Differentiate: $2x + (y + x\frac{dy}{dx}) + 2y\frac{dy}{dx} = 0$. Collect: $(x + 2y)\frac{dy}{dx} = -(2x + y)$, so $\frac{dy}{dx} = -\frac{2x + y}{x + 2y}$.`,
        },
        {
          kind: "check",
          prompt: md`The point $(1, 2)$ lies on $x^3 + y^3 = 9$. Find $\frac{dy}{dx}$ there.`,
          answer: "-1/4",
          explain: md`$3x^2 + 3y^2\frac{dy}{dx} = 0$ gives $\frac{dy}{dx} = -\frac{x^2}{y^2} = -\frac{1}{4}$ at $(1, 2)$.`,
        },
      ],
      practice: [slopeAtPoint, implicitDerivative, implicitTangentLine],
    },
    {
      id: slug("Derivatives of inverse functions"),
      title: "Derivatives of inverse functions",
      summary: "Reflecting across y = x turns a slope into its reciprocal. From that: the derivatives of arcsin, arccos and arctan, and the power rule for every rational exponent.",
      blocks: [
        {
          kind: "text",
          body: md`An inverse function undoes another: $g = f^{-1}$ means $g(f(x)) = x$ and $f(g(x)) = x$. In Algebra 2 you saw that the graph of $f^{-1}$ is the graph of $f$ reflected across the line $y = x$, because reflection swaps the two coordinates. Reflection also swaps rise and run. A slope of $\frac{\text{rise}}{\text{run}} = m$ becomes $\frac{\text{run}}{\text{rise}} = \frac{1}{m}$. That is the whole lesson in one sentence. The rest is making it precise and using it.`,
        },
        mirrorFigure,
        {
          kind: "key",
          title: "The inverse function rule",
          body: md`If $f$ is differentiable and one-to-one, and $g = f^{-1}$, then at any $x$ where $f'(g(x)) \ne 0$,

$$g'(x) = \frac{1}{f'(g(x))}.$$

In Leibniz notation, with $y = g(x)$ so that $x = f(y)$: $\dfrac{dy}{dx} = \dfrac{1}{dx/dy}$. The slope of the inverse at a point is the reciprocal of the slope of the original at the **matching** point: not at $x$, but at $g(x)$.`,
        },
        {
          kind: "why",
          title: "Why: implicit differentiation does it in one line",
          body: md`Let $y = g(x)$. Since $g$ undoes $f$, this says $f(y) = x$, and that holds for every $x$ in the domain of $g$. Differentiate both sides with respect to $x$, treating $y$ as a function of $x$:

$$f'(y)\,\frac{dy}{dx} = 1, \qquad\text{so}\qquad \frac{dy}{dx} = \frac{1}{f'(y)} = \frac{1}{f'(g(x))}.$$

The chain rule put the $\frac{dy}{dx}$ there, and the division is allowed only when $f'(y) \ne 0$. If $f'(y) = 0$, the tangent to $f$ is horizontal at that point; reflected, it's vertical, and $g$ has no derivative there. Example: $f(x) = x^3$ has $f'(0) = 0$, and its inverse $g(x) = \sqrt[3]{x}$ has a vertical tangent at 0 (Unit 2).

This derivation assumes $g$ is differentiable, since it uses $\frac{dy}{dx}$. The proof below removes that assumption.`,
        },
        {
          kind: "proof",
          title: "The inverse function rule",
          given: md`$f$ is one-to-one and differentiable, $g = f^{-1}$ is continuous, $b = g(a)$, and $f'(b) \ne 0$.`,
          prove: md`$g'(a) = \dfrac{1}{f'(b)}$.`,
          steps: [
            { statement: md`$g'(a) = \lim_{x \to a} \dfrac{g(x) - g(a)}{x - a}$, if this limit exists`, reason: "Definition of the derivative (Unit 2)" },
            { statement: md`Write $u = g(x)$. Then $x = f(u)$, and $a = f(b)$`, reason: md`$g$ undoes $f$: $f(g(x)) = x$` },
            { statement: md`$\dfrac{g(x) - g(a)}{x - a} = \dfrac{u - b}{f(u) - f(b)}$ for $x \ne a$`, reason: md`Substitute step 2. The denominator isn't 0: $f$ is one-to-one and $u \ne b$ because $x \ne a$` },
            { statement: md`As $x \to a$, $u \to b$ with $u \ne b$`, reason: md`$g$ is continuous at $a$: $g(x) \to g(a)$, and $g$ is one-to-one` },
            { statement: md`$\lim_{u \to b} \dfrac{f(u) - f(b)}{u - b} = f'(b) \ne 0$`, reason: "Definition of $f'(b)$, and the given" },
            { statement: md`$\lim_{u \to b} \dfrac{u - b}{f(u) - f(b)} = \dfrac{1}{f'(b)}$`, reason: "Quotient law for limits (Unit 1); allowed because the limit on the bottom isn't 0" },
            { statement: md`$g'(a) = \dfrac{1}{f'(b)} = \dfrac{1}{f'(g(a))}$`, reason: "Steps 1, 3, 4 and 6: the difference quotient of $g$ at $a$ is the reciprocal of a quotient whose limit is $f'(b)$" },
          ],
        },
        {
          kind: "text",
          body: md`The continuity of $g$ in the proof isn't an extra assumption in practice: a one-to-one continuous function on an interval has a continuous inverse. (Its graph is a reflection of an unbroken curve, and reflection doesn't break it.)

Now the payoff. The inverse trig functions from Trigonometry are inverses of functions we can already differentiate, so the rule hands us their derivatives.`,
        },
        {
          kind: "example",
          title: "The derivative of arcsin",
          problem: md`Find $\frac{d}{dx}\arcsin x$.`,
          steps: [
            { math: md`y = \arcsin x \iff \sin y = x, \quad -\tfrac{\pi}{2} \le y \le \tfrac{\pi}{2}`, note: "The definition of arcsin, with its range." },
            { math: md`\cos y\,\frac{dy}{dx} = 1`, note: md`Differentiate $\sin y = x$ implicitly.` },
            { math: md`\frac{dy}{dx} = \frac{1}{\cos y}`, note: md`Divide. This is the inverse rule: $\frac{1}{f'(y)}$ with $f = \sin$.` },
            { math: md`\cos y = \sqrt{1 - \sin^2 y} = \sqrt{1 - x^2}`, note: md`Pythagorean identity. The square root is the **positive** one because $\cos y \ge 0$ on $[-\frac{\pi}{2}, \frac{\pi}{2}]$.` },
            { math: md`\frac{d}{dx}\arcsin x = \frac{1}{\sqrt{1 - x^2}}, \quad -1 < x < 1`, note: "At the endpoints the denominator is 0: vertical tangents." },
          ],
        },
        arcsinTriangle,
        {
          kind: "why",
          title: "Why arccos gets a minus sign",
          body: md`Run the same steps with $y = \arccos x$, so $\cos y = x$ with $0 \le y \le \pi$. Differentiating: $-\sin y\,\frac{dy}{dx} = 1$, so $\frac{dy}{dx} = -\frac{1}{\sin y}$. On $[0, \pi]$, $\sin y \ge 0$, so $\sin y = +\sqrt{1 - x^2}$ and

$$\frac{d}{dx}\arccos x = -\frac{1}{\sqrt{1 - x^2}}.$$

The sign came from $\frac{d}{dy}\cos y = -\sin y$. It makes sense: $\arccos$ is decreasing, so its slope should be negative. It also agrees with the identity $\arcsin x + \arccos x = \frac{\pi}{2}$: the two derivatives add to 0, as the derivative of a constant must.`,
        },
        {
          kind: "example",
          title: "The derivative of arctan",
          problem: md`Find $\frac{d}{dx}\arctan x$.`,
          steps: [
            { math: md`y = \arctan x \iff \tan y = x, \quad -\tfrac{\pi}{2} < y < \tfrac{\pi}{2}`, note: "Definition." },
            { math: md`\sec^2 y\,\frac{dy}{dx} = 1`, note: md`Differentiate implicitly; $\frac{d}{dy}\tan y = \sec^2 y$ (Unit 3).` },
            { math: md`\frac{dy}{dx} = \frac{1}{\sec^2 y} = \frac{1}{1 + \tan^2 y}`, note: md`$\sec^2 y = 1 + \tan^2 y$: the Pythagorean identity divided by $\cos^2 y$.` },
            { math: md`\frac{d}{dx}\arctan x = \frac{1}{1 + x^2}`, note: md`$\tan y = x$. No square root and no sign question this time, and it's defined for every $x$.` },
          ],
        },
        {
          kind: "key",
          title: "Inverse trig derivatives",
          body: md`$$\frac{d}{dx}\arcsin x = \frac{1}{\sqrt{1 - x^2}}, \qquad \frac{d}{dx}\arccos x = -\frac{1}{\sqrt{1 - x^2}}, \qquad \frac{d}{dx}\arctan x = \frac{1}{1 + x^2}.$$

With the chain rule, for any differentiable $u$:

$$\frac{d}{dx}\arcsin u = \frac{u'}{\sqrt{1 - u^2}}, \qquad \frac{d}{dx}\arctan u = \frac{u'}{1 + u^2}.$$

When typing answers, write $\arcsin$, $\arccos$, $\arctan$ as asin, acos, atan.`,
        },
        arcsinPlot,
        {
          kind: "example",
          title: "With the chain rule",
          problem: md`Differentiate $\arctan(3x)$ and $\arcsin(x^2)$.`,
          steps: [
            { math: md`\frac{d}{dx}\arctan(3x) = \frac{1}{1 + (3x)^2} \cdot 3 = \frac{3}{1 + 9x^2}`, note: md`Outer derivative at $u = 3x$, times $u' = 3$.` },
            { math: md`\frac{d}{dx}\arcsin(x^2) = \frac{1}{\sqrt{1 - (x^2)^2}} \cdot 2x = \frac{2x}{\sqrt{1 - x^4}}`, note: md`$u = x^2$, $u' = 2x$, $u^2 = x^4$.` },
          ],
        },
        {
          kind: "why",
          title: "The power rule for rational exponents",
          body: md`Unit 3 derived $\frac{d}{dx}x^n = nx^{n-1}$ for whole numbers $n$ and promised the rest. Implicit differentiation delivers it for every fraction. Let $y = x^{p/q}$ with $p$, $q$ integers, $q > 0$, and $x > 0$. Raise both sides to the $q$:

$$y^q = x^p.$$

Both exponents are integers now, so differentiate with the rules we have: $q\,y^{q-1}\,\frac{dy}{dx} = p\,x^{p-1}$. Solve and substitute $y = x^{p/q}$:

$$\frac{dy}{dx} = \frac{p}{q} \cdot \frac{x^{p-1}}{y^{q-1}} = \frac{p}{q} \cdot \frac{x^{p-1}}{x^{p(q-1)/q}} = \frac{p}{q}\,x^{\,p - 1 - p + p/q} = \frac{p}{q}\,x^{\frac{p}{q} - 1}.$$

The exponent arithmetic: $\frac{p(q-1)}{q} = p - \frac{p}{q}$. So $\frac{d}{dx}x^{p/q} = \frac{p}{q}x^{p/q - 1}$, the power rule with a fraction in it. (For an irrational exponent, Unit 3's logarithmic differentiation of $x^r = e^{r\ln x}$ finishes the job.)`,
        },
        {
          kind: "check",
          prompt: md`Differentiate $\arctan\left(\frac{x}{2}\right)$.`,
          answer: "2/(4 + x^2)",
          explain: md`$\frac{1}{1 + (x/2)^2} \cdot \frac{1}{2} = \frac{1}{2} \cdot \frac{4}{4 + x^2} = \frac{2}{4 + x^2}$.`,
        },
        {
          kind: "check",
          prompt: md`Let $f(x) = x^3 + x$ and $g = f^{-1}$. Find $g'(2)$.`,
          answer: "1/4",
          explain: md`$f(1) = 2$, so $g(2) = 1$. $f'(x) = 3x^2 + 1$, so $f'(1) = 4$ and $g'(2) = \frac{1}{f'(1)} = \frac{1}{4}$.`,
        },
      ],
      practice: [inverseTrigDerivative, inverseRuleAtPoint, inverseTrigValue],
    },
    {
      id: slug("Related rates"),
      title: "Related rates",
      summary: "Quantities that change together: differentiate the equation that links them, with respect to time, to link their rates.",
      blocks: [
        {
          kind: "text",
          body: md`Drop a stone in a pond. A circular ripple spreads, its radius growing at 2 cm/s. How fast is the area inside the ripple growing when the radius is 10 cm?

Two quantities change here, the radius $r$ and the area $A$, and both are functions of time $t$. They are never independent: $A = \pi r^2$ at every moment. One equation links the quantities, so differentiating it links their rates. That is the entire idea of related rates. The technique is implicit differentiation from Lesson 1 with $t$ as the independent variable.`,
        },
        {
          kind: "why",
          title: "Why differentiate with respect to time",
          body: md`$A = \pi r^2$ is an identity in $t$: writing $A(t) = \pi\,(r(t))^2$ makes that visible. The right side is a composition, so the chain rule gives

$$\frac{dA}{dt} = 2\pi r\,\frac{dr}{dt}.$$

This is Lesson 1's rule again: every quantity that depends on $t$ picks up its own rate when differentiated. The equation says how a tiny change in $r$ produces a change in $A$ (the factor $2\pi r$, the circumference), and how fast $r$ is changing ($\frac{dr}{dt}$). Multiply, and you have how fast $A$ changes.`,
        },
        {
          kind: "example",
          title: "The ripple",
          problem: md`The radius grows at 2 cm/s. How fast is the area growing when $r = 10$ cm?`,
          steps: [
            { math: md`A = \pi r^2`, note: "True at every moment: the equation to differentiate." },
            { math: md`\frac{dA}{dt} = 2\pi r\,\frac{dr}{dt}`, note: md`Differentiate with respect to $t$.` },
            { math: md`\frac{dA}{dt} = 2\pi(10)(2) = 40\pi \approx 126 \text{ cm}^2\text{/s}`, note: md`Only now substitute the instant: $r = 10$, $\frac{dr}{dt} = 2$.` },
          ],
        },
        {
          kind: "key",
          title: "Solving a related-rates problem",
          body: md`- Draw the situation. Name every quantity that changes with a letter; write the constants as numbers.
- Write down the rates you know (as derivatives, with signs) and the rate you want.
- Find an equation linking the quantities that holds **at every moment**: geometry, the Pythagorean Theorem, similar triangles, trigonometry.
- Differentiate both sides with respect to $t$. Every changing quantity gets a $\frac{d}{dt}$ by the chain rule.
- Substitute the values at the instant in question, and solve for the unknown rate. Check the sign and the units.`,
        },
        {
          kind: "why",
          title: "Why you substitute after differentiating, never before",
          body: md`A 10-ft ladder leans against a wall; its bottom is 6 ft out. At that instant, $x = 6$. If you write $x = 6$ into $x^2 + y^2 = 100$ before differentiating, you get $36 + y^2 = 100$, an equation about one frozen moment. Differentiating it gives $2y\frac{dy}{dt} = 0$, so the top isn't moving. Nonsense.

Setting $x = 6$ turned a changing quantity into a constant, and constants have derivative 0: the information that $x$ was moving is gone. The equation you differentiate must hold at every time, with every changing quantity still a letter. The snapshot values go in afterwards.`,
        },
        ladderFigure,
        {
          kind: "example",
          title: "The sliding ladder",
          problem: md`A 10-ft ladder leans against a wall. Its bottom slides away from the wall at 2 ft/s. How fast is the top sliding down when the bottom is 6 ft from the wall?`,
          steps: [
            { math: md`x^2 + y^2 = 100`, note: md`$x$ is the bottom's distance from the wall, $y$ the top's height. Known: $\frac{dx}{dt} = 2$. Wanted: $\frac{dy}{dt}$ when $x = 6$.` },
            { math: md`2x\,\frac{dx}{dt} + 2y\,\frac{dy}{dt} = 0`, note: md`Differentiate with respect to $t$. Both $x$ and $y$ move, so both get a rate.` },
            { math: md`y = \sqrt{100 - 36} = 8`, note: "The height at that instant, from the Pythagorean Theorem." },
            { math: md`2(6)(2) + 2(8)\frac{dy}{dt} = 0 \quad\Rightarrow\quad \frac{dy}{dt} = -\frac{24}{16} = -\frac{3}{2}`, note: md`Substitute, then solve. The top slides down at $1.5$ ft/s. The minus sign says "down": $y$ is decreasing.` },
          ],
        },
        coneFigure,
        {
          kind: "example",
          title: "Filling a conical tank",
          problem: md`A tank is an inverted cone 8 m deep and 4 m in radius at the top. Water flows in at 2 cubic meters per minute. How fast is the water level rising when the water is 3 m deep?`,
          steps: [
            { math: md`V = \tfrac{1}{3}\pi r^2 h`, note: md`The water is itself a cone, of radius $r$ and depth $h$. Known: $\frac{dV}{dt} = 2$. Wanted: $\frac{dh}{dt}$ when $h = 3$.` },
            { math: md`\frac{r}{h} = \frac{4}{8} \quad\Rightarrow\quad r = \frac{h}{2}`, note: "Similar triangles, at every moment. Two unknown rates would be one too many; this removes one." },
            { math: md`V = \tfrac{1}{3}\pi\left(\frac{h}{2}\right)^2 h = \frac{\pi}{12}h^3`, note: md`Now $V$ depends on $h$ alone.` },
            { math: md`\frac{dV}{dt} = \frac{\pi}{4}h^2\,\frac{dh}{dt}`, note: md`Differentiate: $\frac{\pi}{12} \cdot 3h^2 = \frac{\pi}{4}h^2$.` },
            { math: md`2 = \frac{\pi}{4}(9)\frac{dh}{dt} \quad\Rightarrow\quad \frac{dh}{dt} = \frac{8}{9\pi} \approx 0.28 \text{ m/min}`, note: md`Substitute $h = 3$ and solve.` },
          ],
        },
        {
          kind: "why",
          title: "Why r = h/2 could be substituted before differentiating",
          body: md`Didn't we just break the rule? No. $r = \frac{h}{2}$ is not a snapshot value; it holds at **every** moment, because the water's surface and the tank's rim always make similar triangles with the apex. Substituting an identity keeps the equation true for all $t$, so differentiating it is still legal. Substituting a one-time value like $h = 3$ is what's forbidden before differentiating.

The test: would the relation still be true a second later? $r = \frac{h}{2}$, yes. $h = 3$, no.`,
        },
        balloonFigure,
        {
          kind: "example",
          title: "A changing angle",
          problem: md`A camera 600 m from a launch pad follows a rocket rising straight up at 300 m/s. How fast is the camera's angle of elevation $\theta$ changing when the rocket is 600 m high?`,
          steps: [
            { math: md`\tan\theta = \frac{h}{600}`, note: md`Opposite over adjacent. Known: $\frac{dh}{dt} = 300$. Wanted: $\frac{d\theta}{dt}$ when $h = 600$.` },
            { math: md`\sec^2\theta\,\frac{d\theta}{dt} = \frac{1}{600}\,\frac{dh}{dt}`, note: md`Differentiate with respect to $t$: chain rule on $\tan\theta$.` },
            { math: md`\sec^2\theta = 1 + \tan^2\theta = 1 + 1 = 2`, note: md`At $h = 600$, $\tan\theta = 1$ (the angle is $45^\circ$).` },
            { math: md`\frac{d\theta}{dt} = \frac{1}{2} \cdot \frac{300}{600} = \frac{1}{4} \text{ rad/s}`, note: md`Radians, because the derivative of $\tan$ is $\sec^2$ only in radians (Unit 3).` },
          ],
        },
        {
          kind: "text",
          body: md`**Signs and units.** A rate is negative when its quantity is decreasing: the ladder's $\frac{dy}{dt} = -\frac{3}{2}$, or a rope being pulled in at $\frac{dz}{dt} = -3$. Write the sign when you record what's known, and read the sign of the answer back as a direction. The units of a rate are the quantity's units per unit of time: $\text{m}^2\text{/s}$ for an area, $\text{m/min}$ for a depth, rad/s for an angle.

**Which quantities matter.** Sometimes a number in the problem never gets used. The shadow of a person walking away from a streetlight lengthens at a rate that doesn't depend on where they are; a problem can still tell you where they are. Don't force every number into the solution.`,
        },
        {
          kind: "check",
          prompt: md`A spherical balloon's radius grows at 1 cm/s. How fast is its volume growing when the radius is 3 cm? Give an exact answer (write pi for $\pi$).`,
          answer: "36pi",
          explain: md`$V = \frac{4}{3}\pi r^3$, so $\frac{dV}{dt} = 4\pi r^2\frac{dr}{dt} = 4\pi(9)(1) = 36\pi$ cubic cm per second.`,
        },
        {
          kind: "check",
          prompt: md`Two cars leave an intersection, one east at 60 mi/h and one north at 80 mi/h. How fast is the distance between them growing when they are 3 mi and 4 mi from the intersection?`,
          answer: "100",
          explain: md`$z^2 = x^2 + y^2$ gives $2z\frac{dz}{dt} = 2x\frac{dx}{dt} + 2y\frac{dy}{dt}$. With $z = 5$: $\frac{dz}{dt} = \frac{3(60) + 4(80)}{5} = \frac{500}{5} = 100$ mi/h.`,
        },
      ],
      practice: [expandingShapes, rightTriangleRates, similarTriangleRates],
    },
  ],
};
