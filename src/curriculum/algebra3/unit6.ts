import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared wording and helpers ──────────────────────────────────────────────

const POINT = "Type it as a point, like (3, -2).";
const EXACT = "Give exact coordinates; type square roots like sqrt(3).";
const PAIR = "Type the pair as (x, y), like (1 + 3t, 2 - t); write cos(t) and sin(t) for cosines and sines.";
const IN_X = "Eliminate the parameter: write $y$ as an expression in $x$ (any equal form is accepted).";

/** m t + c as text and LaTeX: "2t - 3", "t + 1", "-t". */
const lint = (m: number, c: number) => poly([[m, "t"], [c, ""]]);
/** c + m t, the order used for lines: "1 + 3t", "3t", "-2 - t". */
const shift = (c: number, m: number) => poly([[c, ""], [m, "t"]]);
/** r cos t with the 1 hidden, as LaTeX. */
const rfn = (r: number, fn: string) => `${r === 1 ? "" : r}\\${fn} t`;
/** h + r cos t as LaTeX. */
const circTex = (h: number, r: number, fn: string) => (h === 0 ? rfn(r, fn) : `${h} + ${rfn(r, fn)}`);
/** A trig function name as a LaTeX command: "\cos". (Writing \${fn} inside md escapes the dollar instead.) */
const bs = (fn: string) => `\\${fn}`;
/** h + r cos(t) as typed text. */
const circText = (h: number, r: number, fn: string) => `${h === 0 ? "" : `${h} + `}${r === 1 ? "" : r}${fn}(t)`;

/** num * sqrt(s) / den, an exact cosine or sine. */
type Surd = [number, number, number];
const ANGLES: { tex: string; text: string; cos: Surd; sin: Surd }[] = [
  { tex: "0", text: "0", cos: [1, 1, 1], sin: [0, 1, 1] },
  { tex: "\\frac{\\pi}{6}", text: "pi/6", cos: [1, 3, 2], sin: [1, 1, 2] },
  { tex: "\\frac{\\pi}{4}", text: "pi/4", cos: [1, 2, 2], sin: [1, 2, 2] },
  { tex: "\\frac{\\pi}{3}", text: "pi/3", cos: [1, 1, 2], sin: [1, 3, 2] },
  { tex: "\\frac{\\pi}{2}", text: "pi/2", cos: [0, 1, 1], sin: [1, 1, 1] },
  { tex: "\\frac{2\\pi}{3}", text: "2pi/3", cos: [-1, 1, 2], sin: [1, 3, 2] },
  { tex: "\\frac{3\\pi}{4}", text: "3pi/4", cos: [-1, 2, 2], sin: [1, 2, 2] },
  { tex: "\\frac{5\\pi}{6}", text: "5pi/6", cos: [-1, 3, 2], sin: [1, 1, 2] },
  { tex: "\\pi", text: "pi", cos: [-1, 1, 1], sin: [0, 1, 1] },
  { tex: "\\frac{7\\pi}{6}", text: "7pi/6", cos: [-1, 3, 2], sin: [-1, 1, 2] },
  { tex: "\\frac{3\\pi}{2}", text: "3pi/2", cos: [0, 1, 1], sin: [-1, 1, 1] },
  { tex: "\\frac{5\\pi}{3}", text: "5pi/3", cos: [1, 1, 2], sin: [-1, 3, 2] },
];

/** A surd on its own: "sqrt(3)/2", "-1/2", "0". */
function surd([num, s, den]: Surd): { text: string; tex: string } {
  if (num === 0) return { text: "0", tex: "0" };
  if (s === 1) return { text: frac(num, den), tex: fracTex(num, den) };
  const sign = num < 0 ? "-" : "";
  return { text: `${sign}sqrt(${s})${den === 1 ? "" : `/${den}`}`, tex: den === 1 ? `${sign}\\sqrt{${s}}` : `${sign}\\frac{\\sqrt{${s}}}{${den}}` };
}

/** h + r · (num sqrt(s) / den) as typed text and LaTeX, e.g. "1 + 3sqrt(3)/2". */
function shifted(h: number, r: number, [num, s, den]: Surd): { text: string; tex: string } {
  if (num === 0) return { text: String(h), tex: String(h) };
  if (s === 1) {
    const n = h * den + r * num;
    return { text: frac(n, den), tex: fracTex(n, den) };
  }
  const g = gcd(r * num, den);
  const [kn, kd] = [(r * num) / g, den / g];
  const mag = Math.abs(kn);
  const coef = mag === 1 ? "" : String(mag);
  const text = `${coef}sqrt(${s})${kd === 1 ? "" : `/${kd}`}`;
  const tex = kd === 1 ? `${coef}\\sqrt{${s}}` : `\\frac{${coef}\\sqrt{${s}}}{${kd}}`;
  if (h === 0) return { text: `${kn < 0 ? "-" : ""}${text}`, tex: `${kn < 0 ? "-" : ""}${tex}` };
  const sign = kn < 0 ? "-" : "+";
  return { text: `${h} ${sign} ${text}`, tex: `${h} ${sign} ${tex}` };
}

// ── Lesson 1: Parametric curves ─────────────────────────────────────────────

const pointAtT: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [x0, y0] = [r.int(-5, 5), r.int(-5, 5)];
    const [a, b] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const k = r.pick([-3, -2, -1, 2, 3, 4]);
    const [X, Y] = [x0 + a * k, y0 + b * k];
    return {
      prompt: md`A point moves along the line $x = ${shift(x0, a)}$, $y = ${shift(y0, b)}$. Where is it when $t = ${k}$? ${POINT}`,
      answer: `(${X}, ${Y})`,
      form: "tuple",
      // The point is on the line through (x0, y0) with direction (a, b), and its displacement from (x0, y0) projects to (a^2 + b^2) k along that direction.
      verify: [`(x - ${paren(x0)})*${paren(b)} = (y - ${paren(y0)})*${paren(a)}`, `(x - ${paren(x0)})*${paren(a)} + (y - ${paren(y0)})*${paren(b)} = ${a * a + b * b}*${paren(k)}`],
      hint: md`Substitute $t = ${k}$ into both equations. The $x$-equation gives the $x$-coordinate and the $y$-equation gives the $y$-coordinate.`,
      solution: [
        { math: md`x = ${x0} ${a < 0 ? "-" : "+"} ${Math.abs(a)}(${k}) = ${X}`, note: md`Put $t = ${k}$ into the $x$-equation.` },
        { math: md`y = ${y0} ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${k}) = ${Y}`, note: md`And into the $y$-equation.` },
        { math: md`(${X}, ${Y})`, note: md`Starting from $(${x0}, ${y0})$ at $t = 0$, the point moved ${Math.abs(k)} steps of $\langle ${a}, ${b} \rangle$${k < 0 ? ", backwards, since $t$ is negative" : ""}.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, -1, 2, -2, 3]);
    const b = r.int(-4, 4);
    const c = r.nonzero(-3, 3);
    const d = r.int(-6, 6);
    const k = r.pick([-3, -2, -1, 2, 3]);
    const [X, Y] = [a * k + b, c * k * k + d];
    return {
      prompt: md`A point moves along the curve $x = ${lint(a, b)}$, $y = ${poly([[c, "t^2"], [d, ""]])}$. Where is it when $t = ${k}$? ${POINT}`,
      answer: `(${X}, ${Y})`,
      form: "tuple",
      // The point lies on the curve's own equation in x and y, and its x-coordinate is the one at t = k.
      // (Every verify equation has to mention both letters of the pair, hence the 0y.)
      verify: [`y = ${paren(c)}((x - ${paren(b)})/${paren(a)})^2 + ${paren(d)}`, `x + 0y = ${paren(a)}*${paren(k)} + ${paren(b)}`],
      hint: md`Substitute $t = ${k}$ into each equation. Square before multiplying: $(${k})^2 = ${k * k}$.`,
      solution: [
        { math: md`x = ${a === 1 ? "" : a === -1 ? "-" : a}(${k})${b === 0 ? "" : ` ${signed(b)}`} = ${X}`, note: md`The $x$-equation at $t = ${k}$.` },
        { math: md`y = ${c === 1 ? "" : c === -1 ? "-" : c}(${k})^2${d === 0 ? "" : ` ${signed(d)}`} = ${c === 1 ? "" : c === -1 ? "-" : c}(${k * k})${d === 0 ? "" : ` ${signed(d)}`} = ${Y}`, note: md`The $y$-equation at $t = ${k}$. The square comes first.` },
        { math: md`(${X}, ${Y})`, note: "One value of t, one point on the curve." },
      ],
    };
  }
  const [h, k] = [r.int(-3, 3), r.int(-3, 3)];
  const rad = r.int(1, 4);
  const ang = r.pick(ANGLES);
  const X = shifted(h, rad, ang.cos);
  const Y = shifted(k, rad, ang.sin);
  const [cs, sn] = [surd(ang.cos), surd(ang.sin)];
  return {
    prompt: md`A point moves around the circle $x = ${circTex(h, rad, "cos")}$, $y = ${circTex(k, rad, "sin")}$. Where is it when $t = ${ang.tex}$? ${POINT} ${EXACT}`,
    answer: `(${X.text}, ${Y.text})`,
    form: "tuple",
    // On the circle, and its displacement from the center points along the direction (cos t, sin t) with length r.
    verify: [`(x - ${paren(h)})^2 + (y - ${paren(k)})^2 = ${rad * rad}`, `(x - ${paren(h)}) cos(${ang.text}) + (y - ${paren(k)}) sin(${ang.text}) = ${rad}`],
    hint: md`$t$ is the angle at the center, measured from the positive $x$ direction. Use the exact values $\cos ${ang.tex} = ${cs.tex}$ and $\sin ${ang.tex} = ${sn.tex}$ from the unit circle.`,
    solution: [
      { math: md`\cos ${ang.tex} = ${cs.tex}, \qquad \sin ${ang.tex} = ${sn.tex}`, note: "Exact values from the unit circle (Trigonometry)." },
      { math: md`x = ${h === 0 ? "" : `${h} + `}${rad === 1 ? "" : rad}\left(${cs.tex}\right) = ${X.tex}`, note: md`${rad === 1 ? "The radius is 1, so the cosine is used as is" : `Scale the cosine by the radius ${rad}`}${h === 0 ? "" : `, then shift by the center's $x$-coordinate`}.` },
      { math: md`y = ${k === 0 ? "" : `${k} + `}${rad === 1 ? "" : rad}\left(${sn.tex}\right) = ${Y.tex}`, note: md`Same for $y$ with the sine.` },
      { math: md`\left(${X.tex}, ${Y.tex}\right)`, note: md`Check: this point is ${rad} away from $(${h}, ${k})$, since $(${rfn(rad, "cos")})^2 + (${rfn(rad, "sin")})^2 = ${rad * rad}$.` },
    ],
  };
};

const whenAtPoint: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [x0, y0] = [r.int(-5, 5), r.int(-5, 5)];
    const [a, b] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const k = r.pick([-3, -2, -1, 2, 3, 4, 5]);
    const [X, Y] = [x0 + a * k, y0 + b * k];
    return {
      prompt: md`The line $x = ${shift(x0, a)}$, $y = ${shift(y0, b)}$ passes through the point $(${X}, ${Y})$. At what value of $t$?`,
      answer: String(k),
      verify: [`${x0} + ${paren(a)} t = ${X}`, `${y0} + ${paren(b)} t = ${Y}`],
      hint: md`Set the $x$-equation equal to ${X} and solve for $t$. Then make sure the same $t$ gives $y = ${Y}$.`,
      solution: [
        { math: md`${shift(x0, a)} = ${X}`, note: md`The $x$-coordinate must be ${X}.` },
        { math: md`${a}t = ${X - x0} \;\Rightarrow\; t = ${k}`, note: md`${x0 === 0 ? "Divide" : `${x0 < 0 ? "Add" : "Subtract"} ${Math.abs(x0)}, then divide`} by ${a}.` },
        { math: md`y = ${y0} ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${k}) = ${Y}`, note: md`Check with the $y$-equation: the same $t$ gives $y = ${Y}$, so the point really is on the line at $t = ${k}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([1, -1, 2, -2, 3]);
    const b = r.int(-4, 4);
    const c = r.nonzero(-3, 3);
    const d = r.int(-6, 6);
    const k = r.pick([-3, -2, -1, 2, 3]);
    const [X, Y] = [a * k + b, c * k * k + d];
    return {
      prompt: md`The curve $x = ${lint(a, b)}$, $y = ${poly([[c, "t^2"], [d, ""]])}$ passes through $(${X}, ${Y})$. At what value of $t$?`,
      answer: String(k),
      verify: [`${paren(a)} t + ${paren(b)} = ${X}`, `${paren(c)} t^2 + ${paren(d)} = ${Y}`],
      hint: md`The $x$-equation is linear in $t$, so it has one solution. Solve it, then confirm with the $y$-equation.`,
      solution: [
        { math: md`${lint(a, b)} = ${X} \;\Rightarrow\; t = ${k}`, note: md`A linear equation has exactly one solution, so the $x$-coordinate pins down $t$.` },
        { math: md`y = ${c === 1 ? "" : c === -1 ? "-" : c}(${k})^2 ${d === 0 ? "" : signed(d)} = ${Y}`, note: md`Check: $t = ${k}$ gives the right $y$ too. (The $y$-equation alone would allow $t = \pm ${Math.abs(k)}$; the $x$-equation decides.)` },
      ],
    };
  }
  const [h, k] = [r.int(-3, 3), r.int(-3, 3)];
  const rad = r.int(1, 4);
  const ang = r.pick(ANGLES);
  const X = shifted(h, rad, ang.cos);
  const Y = shifted(k, rad, ang.sin);
  const [cs, sn] = [surd(ang.cos), surd(ang.sin)];
  return {
    prompt: md`The circle $x = ${circTex(h, rad, "cos")}$, $y = ${circTex(k, rad, "sin")}$, with $0 \le t < 2\pi$, passes through $\left(${X.tex}, ${Y.tex}\right)$. At what value of $t$? Type pi for $\pi$, like 5pi/6.`,
    answer: ang.text,
    verify: [`${h} + ${rad} cos(t) = ${X.text}`, `${k} + ${rad} sin(t) = ${Y.text}`],
    hint: md`Subtract the center and divide by the radius to find $\cos t$ and $\sin t$. Then find the one angle in $[0, 2\pi)$ with both of those values.`,
    solution: [
      { math: md`${rfn(rad, "cos")} = ${X.tex}${h === 0 ? "" : ` - ${paren(h)}`} \;\Rightarrow\; \cos t = ${cs.tex}`, note: md`From the $x$-equation.` },
      { math: md`${rfn(rad, "sin")} = ${Y.tex}${k === 0 ? "" : ` - ${paren(k)}`} \;\Rightarrow\; \sin t = ${sn.tex}`, note: md`From the $y$-equation.` },
      { math: md`t = ${ang.tex}`, note: md`The only angle in $[0, 2\pi)$ with $\cos t = ${cs.tex}$ and $\sin t = ${sn.tex}$. The signs of cosine and sine fix the quadrant; the values fix the angle.` },
    ],
  };
};

const writeLine: Generator = (r) => {
  const kind = r.int(0, 2);
  const [x0, y0] = [r.int(-5, 5), r.int(-5, 5)];
  const [a, b] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
  const answer = `(${shift(x0, a)}, ${shift(y0, b)})`;
  // The point lies on the line through (x0, y0) with direction (a, b), and its displacement from (x0, y0),
  // projected onto that direction, is (a^2 + b^2) t.
  const verify = [`(x - ${paren(x0)})*${paren(b)} = (y - ${paren(y0)})*${paren(a)}`, `(x - ${paren(x0)})*${paren(a)} + (y - ${paren(y0)})*${paren(b)} = ${a * a + b * b} t`];
  const vec = md`\langle ${a}, ${b} \rangle`;
  if (kind === 0) {
    const [X, Y] = [x0 + a, y0 + b];
    return {
      prompt: md`Write parametric equations for the line that is at $P(${x0}, ${y0})$ when $t = 0$ and at $Q(${X}, ${Y})$ when $t = 1$. ${PAIR}`,
      answer,
      form: "tuple",
      verify,
      hint: md`At $t = 0$ the point is $P$, so the constants are $P$'s coordinates. From $t = 0$ to $t = 1$ it moves from $P$ to $Q$, so the coefficients of $t$ are $Q - P$.`,
      solution: [
        { math: md`Q - P = \langle ${X} - ${paren(x0)}, ${Y} - ${paren(y0)} \rangle = ${vec}`, note: "One unit of time carries the point from P to Q, so this is the change per unit of t." },
        { math: md`x = ${shift(x0, a)}, \qquad y = ${shift(y0, b)}`, note: md`Start at $P$, add $t$ copies of $${vec}$.` },
        { math: md`t = 1: \; (${x0} ${signed(a)}, ${y0} ${signed(b)}) = (${X}, ${Y})`, note: md`Check: $t = 1$ lands on $Q$.` },
      ],
    };
  }
  if (kind === 1) {
    const right = a > 0 ? `${a} unit${Math.abs(a) === 1 ? "" : "s"} to the right` : `${-a} unit${Math.abs(a) === 1 ? "" : "s"} to the left`;
    const up = b > 0 ? `${b} unit${Math.abs(b) === 1 ? "" : "s"} up` : `${-b} unit${Math.abs(b) === 1 ? "" : "s"} down`;
    return {
      prompt: md`A point starts at $(${x0}, ${y0})$ when $t = 0$ and moves in a straight line, ${right} and ${up} every second. Write parametric equations for its position after $t$ seconds. ${PAIR}`,
      answer,
      form: "tuple",
      verify,
      hint: md`After $t$ seconds the horizontal change is $${poly([[a, "t"]])}$ and the vertical change is $${poly([[b, "t"]])}$. Add each to the starting coordinate.`,
      solution: [
        { math: md`x = ${x0} ${a < 0 ? "-" : "+"} ${Math.abs(a)} \cdot t`, note: md`Start at $x = ${x0}$; each second adds ${a} (${a < 0 ? "a move left" : "a move right"}).` },
        { math: md`y = ${y0} ${b < 0 ? "-" : "+"} ${Math.abs(b)} \cdot t`, note: md`Start at $y = ${y0}$; each second adds ${b}.` },
        { math: md`(${shift(x0, a)}, \; ${shift(y0, b)})`, note: md`The velocity is the direction vector $${vec}$; the slope of the path is $${fracTex(b, a)}$.` },
      ],
    };
  }
  const [X, Y] = [x0 + 2 * a, y0 + 2 * b];
  return {
    prompt: md`Write parametric equations for the line that is at $P(${x0}, ${y0})$ when $t = 0$ and at $Q(${X}, ${Y})$ when $t = 2$. ${PAIR}`,
    answer,
    form: "tuple",
    verify,
    hint: md`The trip from $P$ to $Q$ takes 2 units of time, so the change per unit of $t$ is half of $Q - P$.`,
    solution: [
      { math: md`Q - P = \langle ${2 * a}, ${2 * b} \rangle`, note: "The total change over two units of time." },
      { math: md`\tfrac{1}{2}\langle ${2 * a}, ${2 * b} \rangle = ${vec}`, note: "Per unit of t: half of that." },
      { math: md`x = ${shift(x0, a)}, \qquad y = ${shift(y0, b)}`, note: md`Check: $t = 2$ gives $(${x0} ${signed(2 * a)}, ${y0} ${signed(2 * b)}) = (${X}, ${Y})$.` },
    ],
  };
};

const writeCircle: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 2) {
    let [a, b] = [r.int(1, 6), r.int(1, 6)];
    while (a === b) b = r.int(1, 6);
    return {
      prompt: md`An ellipse is centered at the origin, crosses the $x$-axis at $(\pm ${a}, 0)$ and the $y$-axis at $(0, \pm ${b})$. Write parametric equations that trace it once counterclockwise as $t$ runs from $0$ to $2\pi$, starting at $(${a}, 0)$. ${PAIR}`,
      answer: `(${a === 1 ? "" : a}cos(t), ${b === 1 ? "" : b}sin(t))`,
      form: "tuple",
      // On the ellipse, and the point sits in direction (cos t, sin t) after undoing the stretches.
      verify: [`(x/${a})^2 + (y/${b})^2 = 1`, `x cos(t)/${a} + y sin(t)/${b} = 1`],
      hint: md`Start from the unit circle $(\cos t, \sin t)$ and stretch: multiply $x$ by ${a} and $y$ by ${b}.`,
      solution: [
        { math: md`(\cos t, \sin t)`, note: md`The unit circle, counterclockwise from $(1, 0)$.` },
        { math: md`x = ${a === 1 ? "" : a}\cos t, \qquad y = ${b === 1 ? "" : b}\sin t`, note: md`Stretching $x$ by ${a} sends $(1, 0)$ to $(${a}, 0)$; stretching $y$ by ${b} sends $(0, 1)$ to $(0, ${b})$.` },
        { math: md`t = 0: (${a}, 0), \quad t = \tfrac{\pi}{2}: (0, ${b})`, note: "Right, then top: counterclockwise, as asked." },
      ],
    };
  }
  const [h, k] = [r.int(-4, 4), r.int(-4, 4)];
  const rad = r.int(1, 5);
  const onCircle = `(x - ${paren(h)})^2 + (y - ${paren(k)})^2 = ${rad * rad}`;
  if (kind === 0) {
    return {
      prompt: md`Write parametric equations for the circle with center $(${h}, ${k})$ and radius ${rad}, traced once counterclockwise as $t$ runs from $0$ to $2\pi$, starting at the rightmost point. ${PAIR}`,
      answer: `(${circText(h, rad, "cos")}, ${circText(k, rad, "sin")})`,
      form: "tuple",
      verify: [onCircle, `(x - ${paren(h)}) cos(t) + (y - ${paren(k)}) sin(t) = ${rad}`],
      hint: md`Scale the unit circle by ${rad}, then shift it so the center lands on $(${h}, ${k})$.`,
      solution: [
        { math: md`(${rfn(rad, "cos")}, ${rfn(rad, "sin")})`, note: rad === 1 ? md`The unit circle itself, centered at the origin.` : md`A circle of radius ${rad} around the origin: the unit circle scaled by ${rad}.` },
        { math: md`x = ${circTex(h, rad, "cos")}, \qquad y = ${circTex(k, rad, "sin")}`, note: md`Add the center's coordinates to move the center to $(${h}, ${k})$.` },
        { math: md`t = 0: (${h + rad}, ${k})`, note: "The rightmost point, and the motion is counterclockwise since the next stop, at t = π/2, is the top." },
      ],
    };
  }
  return {
    prompt: md`Write parametric equations for the circle with center $(${h}, ${k})$ and radius ${rad}, traced once **clockwise** as $t$ runs from $0$ to $2\pi$, starting at the **top**. ${PAIR}`,
    answer: `(${circText(h, rad, "sin")}, ${circText(k, rad, "cos")})`,
    form: "tuple",
    verify: [onCircle, `(x - ${paren(h)}) sin(t) + (y - ${paren(k)}) cos(t) = ${rad}`],
    hint: md`Swap the roles of sine and cosine: $x = h + r\sin t$, $y = k + r\cos t$ starts at the top and turns clockwise. Check $t = 0$ and $t = \frac{\pi}{2}$.`,
    solution: [
      { math: md`x = ${circTex(h, rad, "sin")}, \qquad y = ${circTex(k, rad, "cos")}`, note: md`Sine and cosine swapped. The point is still ${rad} from the center because $\sin^2 t + \cos^2 t = 1$.` },
      { math: md`t = 0: (${h}, ${k + rad})`, note: md`$\sin 0 = 0$, $\cos 0 = 1$: the top of the circle.` },
      { math: md`t = \tfrac{\pi}{2}: (${h + rad}, ${k})`, note: "From the top to the right side is clockwise." },
    ],
  };
};

// ── Lesson 2: Eliminating the parameter ─────────────────────────────────────

/** A coefficient in front of a power of x, as typed text: "", "-", "(3/4)". */
const coefText = (n: number, d: number) => {
  const f = frac(n, d);
  return f === "1" ? "" : f === "-1" ? "-" : f.includes("/") ? `(${f})` : f;
};
const coefTex = (n: number, d: number) => {
  const f = fracTex(n, d);
  return f === "1" ? "" : f === "-1" ? "-" : f;
};
/** x over d as LaTeX, with "x" alone when d = 1. */
const over = (top: string, d: number) => (d === 1 ? top : `\\frac{${top}}{${d}}`);

const eliminateParameter: Generator = (r) => {
  const kind = r.int(0, 5);
  if (kind === 0) {
    const b = r.nonzero(-4, 4);
    const c = r.nonzero(-3, 3);
    const d = r.int(-5, 5);
    const e = r.int(-6, 6);
    const coeffs: [number, number, number] = [c, d - 2 * b * c, c * b * b - d * b + e];
    const answer = poly([[coeffs[0], "x^2"], [coeffs[1], "x"], [coeffs[2], ""]]);
    const yt = poly([[c, "t^2"], [d, "t"], [e, ""]]);
    const tx = poly([[1, "x"], [-b, ""]]);
    return {
      prompt: md`The curve is $x = ${lint(1, b)}$, $y = ${yt}$. ${IN_X}`,
      answer,
      hint: md`The $x$-equation is the simpler one. Solve it for $t$, then replace every $t$ in the $y$-equation.`,
      solution: [
        { math: md`t = ${tx}`, note: md`Solve $x = ${lint(1, b)}$ for $t$.` },
        { math: md`y = ${c === 1 ? "" : c === -1 ? "-" : c}(${tx})^2 ${d === 0 ? "" : `${d < 0 ? "-" : "+"} ${Math.abs(d) === 1 ? "" : Math.abs(d)}(${tx})`} ${e === 0 ? "" : signed(e)}`, note: md`Substitute into $y = ${yt}$.` },
        { math: md`y = ${answer}`, note: md`Expand $(${tx})^2 = ${poly([[1, "x^2"], [-2 * b, "x"], [b * b, ""]])}$ and combine like terms. A parabola, as the $t^2$ promised.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([2, 3, -2, 4]);
    const c = r.pick([1, -1, 2, 3, a * a, -a * a]);
    const d = r.int(-5, 5);
    const answer = `${coefText(c, a * a)}x^2${d === 0 ? "" : ` ${signed(d)}`}`;
    return {
      prompt: md`The curve is $x = ${lint(a, 0)}$, $y = ${poly([[c, "t^2"], [d, ""]])}$. ${IN_X}`,
      answer,
      hint: md`$t = \frac{x}{${a}}$. Squaring that gives $\frac{x^2}{${a * a}}$.`,
      solution: [
        { math: md`t = \frac{x}{${a}}`, note: md`Solve the $x$-equation for $t$.` },
        { math: md`y = ${c === 1 ? "" : c === -1 ? "-" : c}\left(\frac{x}{${a}}\right)^2 ${d === 0 ? "" : signed(d)}`, note: "Substitute." },
        { math: md`y = ${coefTex(c, a * a)}x^2 ${d === 0 ? "" : signed(d)}`, note: md`$\left(\frac{x}{${a}}\right)^2 = \frac{x^2}{${a * a}}$. Multiplying $t$ by ${a} in the $x$-equation widened the parabola by that factor.` },
      ],
    };
  }
  if (kind === 2) {
    const b = r.nonzero(-5, 5);
    const k = r.pick([1, 2, 3, 4, 6, -1, -2, -3]);
    const denom = poly([[1, "x"], [-b, ""]]);
    return {
      prompt: md`The curve is $x = ${lint(1, b)}$, $y = \frac{${k}}{t}$. ${IN_X}`,
      answer: `${k}/(${denom})`,
      hint: md`Solve for $t$ from the $x$-equation and put that expression in the denominator.`,
      solution: [
        { math: md`t = ${denom}`, note: md`From $x = ${lint(1, b)}$.` },
        { math: md`y = \frac{${k}}{${denom}}`, note: md`A hyperbola with vertical asymptote $x = ${b}$: the curve never reaches $x = ${b}$ because $t = 0$ is not allowed in $\frac{${k}}{t}$.` },
      ],
    };
  }
  if (kind === 3) {
    const base = r.pick(["2", "3", "e"]);
    const p = r.pick([2, 2, 3, -1]);
    const d = r.int(-4, 4);
    const bigBase = base === "e" ? null : String(Number(base) ** Math.abs(p));
    const yTex = base === "e" ? `e^{${p === -1 ? "-" : p}t}` : p === -1 ? `${base}^{-t}` : `${bigBase}^{t}`;
    const xPow = p === -1 ? "1/x" : `x^${p}`;
    const xPowTex = p === -1 ? "\\frac{1}{x}" : `x^${p}`;
    return {
      prompt: md`The curve is $x = ${base}^{t}$, $y = ${yTex}${d === 0 ? "" : ` ${signed(d)}`}$. ${IN_X}`,
      answer: `${xPow}${d === 0 ? "" : ` ${signed(d)}`}`,
      hint:
        p === -1
          ? md`A negative exponent is a reciprocal: $${base}^{-t} = \frac{1}{${base}^{t}}$. What is $${base}^{t}$ called here?`
          : md`Write $y$ in terms of $${base}^{t}$ using the power-of-a-power rule: $${yTex} = (${base}^{t})^{${p}}$.`,
      solution: [
        {
          math: p === -1 ? md`${base}^{-t} = \frac{1}{${base}^{t}} = \frac{1}{x}` : md`${yTex} = (${base}^{t})^{${p}} = x^${p}`,
          note: p === -1 ? md`A negative exponent is a reciprocal (Algebra 1, Unit 6).` : md`${base === "e" ? `$e^{${p}t} = (e^t)^${p}$ by the power-of-a-power rule` : `$${bigBase} = ${base}^${p}$, so $${bigBase}^t = ${base}^{${p}t} = (${base}^t)^${p}$`}.`,
        },
        { math: md`y = ${xPowTex} ${d === 0 ? "" : signed(d)}`, note: md`Only the part of the graph with $x > 0$ is traced, because $${base}^{t}$ is always positive.` },
      ],
    };
  }
  if (kind === 4) {
    const c = r.nonzero(-3, 3);
    const d = r.int(-5, 5);
    return {
      prompt: md`The curve is $x = \sqrt{t}$, $y = ${poly([[c, "t"], [d, ""]])}$ for $t \ge 0$. ${IN_X}`,
      answer: `${c === 1 ? "" : c === -1 ? "-" : c}x^2${d === 0 ? "" : ` ${signed(d)}`}`,
      hint: md`Square the $x$-equation to get $t$ by itself.`,
      solution: [
        { math: md`x^2 = t`, note: md`Square both sides of $x = \sqrt{t}$.` },
        { math: md`y = ${c === 1 ? "" : c === -1 ? "-" : c}x^2 ${d === 0 ? "" : signed(d)}`, note: md`Substitute. Since $\sqrt{t} \ge 0$, only the right half ($x \ge 0$) of this parabola is traced.` },
      ],
    };
  }
  const a = r.pick([2, 3, -2, 4]);
  const b = r.int(-4, 4);
  const m = r.nonzero(-3, 3);
  const d = r.int(-5, 5);
  const answer = poly([[m, "x"], [d - m * b, ""]]);
  return {
    prompt: md`The curve is $x = ${lint(a, b)}$, $y = ${lint(a * m, d)}$. ${IN_X}`,
    answer,
    hint: md`Solve the $x$-equation for $t$ and substitute. The result should be a line; its slope is the ratio of the two $t$-coefficients.`,
    solution: [
      { math: md`t = \frac{x ${signed(-b)}}{${a}}`, note: md`From $x = ${lint(a, b)}$.` },
      { math: md`y = ${a * m} \cdot \frac{x ${signed(-b)}}{${a}} ${d === 0 ? "" : signed(d)} = ${m === 1 ? "" : m === -1 ? "-" : m}(x ${signed(-b)}) ${d === 0 ? "" : signed(d)}`, note: md`$\frac{${a * m}}{${a}} = ${m}$.` },
      { math: md`y = ${answer}`, note: md`A line with slope $\frac{${a * m}}{${a}} = ${m}$: rise per unit of $t$ over run per unit of $t$.` },
    ],
  };
};

const conicForm: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [h, k] = [r.int(-4, 4), r.int(-4, 4)];
    const rad = r.int(1, 5);
    const swap = r.next() < 0.3;
    const [fx, fy] = swap ? ["sin", "cos"] : ["cos", "sin"];
    // Three points of the curve, at t = 0, pi/2 and pi; each must be r from (h, k).
    const pts = swap ? [[h, k + rad], [h + rad, k], [h, k - rad]] : [[h + rad, k], [h, k + rad], [h - rad, k]];
    const xm = h === 0 ? "x" : `x ${signed(-h)}`;
    const ym = k === 0 ? "y" : `y ${signed(-k)}`;
    const sq = (s: string) => (s.length === 1 ? `${s}^2` : `(${s})^2`);
    const r2 = rad === 1 ? "" : String(rad * rad);
    return {
      prompt: md`Eliminate the parameter from $x = ${circTex(h, rad, fx)}$, $y = ${circTex(k, rad, fy)}$. The result is a circle: give its center and radius as $(h, k, r)$.`,
      answer: `(${h}, ${k}, ${rad})`,
      form: "tuple",
      verify: pts.map(([X, Y]) => `sqrt((${X} - h)^2 + (${Y} - k)^2) = r`),
      hint: md`Move the constants to the left so the trig functions are alone, then square and add. Use $\cos^2 t + \sin^2 t = 1$.`,
      solution: [
        { math: md`${xm} = ${rfn(rad, fx)}, \qquad ${ym} = ${rfn(rad, fy)}`, note: "Isolate the trig parts." },
        { math: md`${sq(xm)} + ${sq(ym)} = ${r2}${bs(fx)}^2 t + ${r2}${bs(fy)}^2 t = ${r2}(\cos^2 t + \sin^2 t)`, note: "Square both and add." },
        { math: md`${sq(xm)} + ${sq(ym)} = ${rad * rad}`, note: md`$\cos^2 t + \sin^2 t = 1$. A circle with center $(${h}, ${k})$ and radius $\sqrt{${rad * rad}} = ${rad}$.` },
      ],
    };
  }
  if (kind === 1) {
    let [a, b] = [r.int(1, 6), r.int(1, 6)];
    while (a === b) b = r.int(1, 6);
    const swap = r.next() < 0.3;
    const [fx, fy] = swap ? ["sin", "cos"] : ["cos", "sin"];
    return {
      prompt: md`Eliminate the parameter from $x = ${rfn(a, fx)}$, $y = ${rfn(b, fy)}$. The result is an ellipse $\frac{x^2}{A} + \frac{y^2}{B} = 1$. Give $(A, B)$.`,
      answer: `(${a * a}, ${b * b})`,
      form: "tuple",
      // The points at t = 1 and t = 2 lie on the ellipse.
      verify: [1, 2].map((t) => `(${a} ${fx}(${t}))^2/A + (${b} ${fy}(${t}))^2/B = 1`),
      hint: md`Divide each equation by its coefficient so that $${bs(fx)} t$ and $${bs(fy)} t$ stand alone. Then square and add.`,
      solution: [
        { math: md`${over("x", a)} = ${bs(fx)} t, \qquad ${over("y", b)} = ${bs(fy)} t`, note: "Isolate the trig functions." },
        { math: md`${over("x^2", a * a)} + ${over("y^2", b * b)} = ${bs(fx)}^2 t + ${bs(fy)}^2 t = 1`, note: md`Square and add; the Pythagorean identity turns the right side into 1.` },
        { math: md`(A, B) = (${a * a}, ${b * b})`, note: md`An ellipse reaching $\pm ${a}$ on the $x$-axis and $\pm ${b}$ on the $y$-axis.` },
      ],
    };
  }
  const [a, b] = [r.int(1, 5), r.int(1, 5)];
  return {
    prompt: md`Eliminate the parameter from $x = ${rfn(a, "sec")}$, $y = ${rfn(b, "tan")}$. The result is a hyperbola $\frac{x^2}{A} - \frac{y^2}{B} = 1$. Give $(A, B)$.`,
    answer: `(${a * a}, ${b * b})`,
    form: "tuple",
    // The points at t = 0.5 and t = 1 lie on the hyperbola.
    verify: [0.5, 1].map((t) => `(${a} sec(${t}))^2/A - (${b} tan(${t}))^2/B = 1`),
    hint: md`Use $1 + \tan^2 t = \sec^2 t$, which comes from dividing $\cos^2 t + \sin^2 t = 1$ by $\cos^2 t$.`,
    solution: [
      { math: md`${over("x", a)} = \sec t, \qquad ${over("y", b)} = \tan t`, note: "Isolate the trig functions." },
      { math: md`${over("x^2", a * a)} - ${over("y^2", b * b)} = \sec^2 t - \tan^2 t = 1`, note: md`Square each, then subtract: $\sec^2 t - \tan^2 t = 1$ is the Pythagorean identity divided through by $\cos^2 t$.` },
      { math: md`(A, B) = (${a * a}, ${b * b})`, note: md`A hyperbola opening left and right, with vertices at $(\pm ${a}, 0)$.` },
    ],
  };
};

const projectile: Generator = (r) => {
  const kind = r.int(0, 4);
  const c = r.pick([12, 16, 20, 24, 30, 40]);
  // Vertical: y = h + s t - 16 t^2 with s a multiple of 16, so the flight time T is a whole number.
  let h: number, s: number, T: number;
  if (r.next() < 0.5) {
    T = r.int(1, 4);
    s = 16 * T;
    h = 0;
  } else {
    T = r.int(2, 4);
    const u = r.int(1, T - 1);
    s = 16 * (T - u);
    h = 16 * T * u;
  }
  const yTex = h === 0 ? md`${s}t - 16t^2` : md`${h} + ${s}t - 16t^2`;
  const eqs = md`$x = ${c}t$, $y = ${yTex}$`;
  const setting = h === 0 ? md`A ball is kicked from the ground. Its position after $t$ seconds, in feet, is ${eqs}.` : md`A ball is thrown from a height of ${h} feet. Its position after $t$ seconds, in feet, is ${eqs}.`;
  const factored: Step =
    h === 0
      ? { math: md`16t(${T} - t) = 0 \;\Rightarrow\; t = 0 \text{ or } t = ${T}`, note: md`Factor out $16t$. The ball is on the ground at the start and again at $t = ${T}$.` }
      : { math: md`16t^2 - ${s}t - ${h} = 0 \;\Rightarrow\; 16(t - ${T})(t + ${h / (16 * T)}) = 0`, note: md`Multiply by $-1$ and factor. The roots are $t = ${T}$ and $t = -${h / (16 * T)}$; a negative time is before the throw, so it is discarded.` };
  if (kind === 0) {
    return {
      prompt: md`${setting} How long is the ball in the air, in seconds?`,
      answer: String(T),
      verify: [`${h} + ${s} T - 16 T^2 = 0`],
      hint: md`The ball lands when its height is 0. Set $y = 0$ and solve; keep the positive time.`,
      solution: [{ math: md`${yTex} = 0`, note: "Landing means height zero." }, factored, { math: md`t = ${T}`, note: md`${T} second${T === 1 ? "" : "s"} in the air. The $x$-equation played no part: horizontal motion doesn't affect when it lands.` }],
    };
  }
  if (kind === 1) {
    const R = c * T;
    return {
      prompt: md`${setting} How far from the launch point, horizontally, does the ball land? Give the distance in feet.`,
      answer: String(R),
      // The landing point (R, 0) is on the trajectory: at the time x = R, the height is 0.
      verify: [`${h} + ${s}*(R/${c}) - 16*(R/${c})^2 = 0`],
      hint: md`First find the landing time from $y = 0$. Then the range is the $x$-coordinate at that time.`,
      solution: [factored, { math: md`x = ${c}(${T}) = ${R}`, note: md`At the landing time $t = ${T}$, the horizontal position is ${R} feet.` }],
    };
  }
  if (kind === 2) {
    const tp = s / 32;
    const H = h + (s * s) / 64;
    const tpTex = fracTex(s, 32);
    return {
      prompt: md`${setting} What is the greatest height the ball reaches, in feet?`,
      answer: String(H),
      // The peak is at t = s/32, when the vertical velocity s - 32t is zero.
      verify: [`H = ${h} + ${s}*(${s}/32) - 16*(${s}/32)^2`],
      hint: md`$y$ is a quadratic in $t$ opening downward, so its maximum is at the vertex, $t = -\frac{b}{2a}$ (Algebra 1). Here $a = -16$ and $b = ${s}$.`,
      solution: [
        { math: md`t = -\frac{${s}}{2(-16)} = ${tpTex}`, note: md`The vertex of $y = -16t^2 + ${s}t ${h === 0 ? "" : signed(h)}$. This is the moment the upward velocity has dropped to zero${h === 0 ? ", halfway through the flight" : ""}.` },
        { math: md`y = ${h === 0 ? "" : `${h} + `}${s}(${tpTex}) - 16(${tpTex})^2 = ${h === 0 ? "" : `${h} + `}${s * tp} - ${16 * tp * tp}`, note: "Substitute the peak time." },
        { math: md`y = ${H}`, note: md`The greatest height is ${H} feet.` },
      ],
    };
  }
  if (kind === 3 && T >= 2) {
    const t1 = r.int(1, T - 1);
    const X = c * t1;
    const Y = h + s * t1 - 16 * t1 * t1;
    return {
      prompt: md`${setting} How high is the ball, in feet, when it has traveled ${X} feet horizontally?`,
      answer: String(Y),
      // The point (X, Y) is on the trajectory: y at the time x = X.
      verify: [`Y = ${h} + ${s}*(${X}/${c}) - 16*(${X}/${c})^2`],
      hint: md`Use the $x$-equation to find the time when $x = ${X}$, then put that time into the $y$-equation.`,
      solution: [
        { math: md`${c}t = ${X} \;\Rightarrow\; t = ${t1}`, note: "The time at which the ball is that far along." },
        { math: md`y = ${h === 0 ? "" : `${h} + `}${s}(${t1}) - 16(${t1})^2 = ${h === 0 ? "" : `${h} + `}${s * t1} - ${16 * t1 * t1}`, note: md`Height at $t = ${t1}$.` },
        { math: md`y = ${Y}`, note: md`${Y} feet up when ${X} feet along.` },
      ],
    };
  }
  const answer = `${h === 0 ? "" : `${h} + `}${coefText(s, c)}x - ${coefText(16, c * c)}x^2`;
  return {
    prompt: md`${setting} Eliminate $t$ to write the ball's height $y$ as an expression in its horizontal distance $x$ (any equal form is accepted).`,
    answer,
    hint: md`Solve the $x$-equation for $t$: $t = \frac{x}{${c}}$. Substitute into $y$.`,
    solution: [
      { math: md`t = \frac{x}{${c}}`, note: md`From $x = ${c}t$.` },
      { math: md`y = ${h === 0 ? "" : `${h} + `}${s}\left(\frac{x}{${c}}\right) - 16\left(\frac{x}{${c}}\right)^2`, note: md`Substitute into $y = ${yTex}$.` },
      { math: md`y = ${h === 0 ? "" : `${h} + `}${coefTex(s, c)}x - ${coefTex(16, c * c)}x^2`, note: md`The path is a parabola in the $xy$-plane, opening downward. Time is gone from the equation, but the shape of the flight remains.` },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Parametric Equations",
  lessons: [
    {
      id: slug("Parametric curves"),
      title: "Parametric curves",
      summary: "Describing a moving point by two equations in a third variable: tables, orientation, lines and circles.",
      blocks: [
        {
          kind: "text",
          body: md`Until now a curve has been a rule $y = f(x)$: choose an $x$, get a $y$. That rule says nothing about *how* a point travels along the curve, and it can't describe a circle at all, since a circle has two $y$-values above most $x$-values.

Both problems go away when we add a third variable. Picture a point moving in the plane. At each time $t$ it has a position $(x, y)$, so each coordinate is a function of $t$ on its own:

$$x = f(t), \qquad y = g(t).$$

Give me a time and I give you a location. The curve is the trail the point leaves behind.`,
        },
        {
          kind: "key",
          title: "Parametric equations",
          body: md`A pair of equations $x = f(t)$, $y = g(t)$, with $t$ running over an interval, are **parametric equations**. The variable $t$ is the **parameter**; it is not plotted. The **parametric curve** is the set of points $(f(t), g(t))$.

- Each value of $t$ gives one point. Different values of $t$ may give the same point.
- The **orientation** is the direction the point moves as $t$ increases. Draw it with arrows on the curve.
- The parameter interval matters: $0 \le t \le 1$ and $-\infty < t < \infty$ can trace different amounts of the same path.`,
        },
        {
          kind: "example",
          title: "Sketching from a table",
          problem: md`Sketch the curve $x = t^2 - 1$, $y = t$ for $-2 \le t \le 2$, and mark its orientation.`,
          steps: [
            {
              math: md`\begin{array}{c|ccccc} t & -2 & -1 & 0 & 1 & 2 \\ \hline x = t^2 - 1 & 3 & 0 & -1 & 0 & 3 \\ y = t & -2 & -1 & 0 & 1 & 2 \end{array}`,
              note: md`Pick values of $t$ and compute both coordinates for each one.`,
            },
            {
              math: md`(3, -2) \to (0, -1) \to (-1, 0) \to (0, 1) \to (3, 2)`,
              note: md`Plot the points and join them **in order of $t$**. The arrows point from the bottom right, through $(-1, 0)$, to the top right.`,
            },
            {
              math: md`x = y^2 - 1`,
              note: md`Since $y = t$, we can replace $t$ by $y$: the trail is a parabola lying on its side. It is not the graph of any function of $x$.`,
            },
          ],
        },
        {
          kind: "plot",
          x: [-2, 5],
          y: [-3, 3],
          parametric: [{ x: "t^2 - 1", y: "t", t: [-2.5, 2.5], label: "x = t^2 - 1,\\ y = t" }],
          points: [{ x: "t^2 - 1", y: "t", label: "t = {t}:\\ ({=t^2 - 1}, {t})", color: 2 }],
          params: [{ name: "t", min: -2.5, max: 2.5, step: 0.1, value: 1 }],
          caption: md`Slide $t$ and watch the point run along the curve. The trail is a sideways parabola; a vertical line at $x = 3$ meets it twice, so no single $y = f(x)$ could draw it.`,
        },
        {
          kind: "why",
          title: "Why one curve can need two equations",
          body: md`The vertical line test (Algebra 1) says a graph is a function of $x$ only when no vertical line crosses it twice. The sideways parabola fails: at $x = 3$ it has $y = 2$ and $y = -2$. So no formula $y = f(x)$ can produce it. The trouble is that we asked $x$ to be in charge.

Parametric equations put $t$ in charge instead. For each $t$ there is exactly one $x$ and exactly one $y$, so both $f$ and $g$ are honest functions, and yet together they draw a curve that loops, crosses itself or comes back on itself. Think of the curve as a movie, with the frame number $t$, rather than as a still picture.

There is also information in the equations that a plain equation in $x$ and $y$ lacks. $x = y^2 - 1$ describes the same set of points, but it doesn't say where the point is at $t = 1$, which way it travels, or how fast. The parameter carries all of that. Lesson 2 is about moving between the two descriptions.`,
        },
        {
          kind: "key",
          title: "Parametric equations of a line",
          body: md`The line through $(x_0, y_0)$ in the direction $\langle a, b \rangle$ is

$$x = x_0 + at, \qquad y = y_0 + bt.$$

At $t = 0$ the point is $(x_0, y_0)$. Each unit of $t$ moves it $a$ to the right and $b$ up. The slope is $\frac{b}{a}$ (when $a \ne 0$), and $\langle a, b \rangle$ is called the **direction vector**. If $t$ is time, it is also the velocity.`,
        },
        {
          kind: "why",
          title: "Why these equations draw a line",
          body: md`Take any two values of the parameter, $t_1$ and $t_2$. The two points are $(x_0 + at_1, y_0 + bt_1)$ and $(x_0 + at_2, y_0 + bt_2)$. The slope between them is

$$\frac{\Delta y}{\Delta x} = \frac{b t_2 - b t_1}{a t_2 - a t_1} = \frac{b(t_2 - t_1)}{a(t_2 - t_1)} = \frac{b}{a}.$$

The $t$'s cancel. So the slope from any point of the curve to any other is the same number $\frac{b}{a}$, and a set of points with one common slope lies on one line (Algebra 1, Unit 4). The constant speed is also visible: between $t$ and $t + 1$ the point always moves the same distance, $\sqrt{a^2 + b^2}$.

Solving the $x$-equation for $t$ and substituting into $y$ gives $y - y_0 = \frac{b}{a}(x - x_0)$: point-slope form. The parametric form is the same line with a clock attached.`,
        },
        {
          kind: "example",
          title: "A line through two points, with timing",
          problem: md`Find parametric equations for the line that is at $P(1, 3)$ when $t = 0$ and at $Q(4, 1)$ when $t = 1$.`,
          steps: [
            { math: md`\langle a, b \rangle = Q - P = \langle 4 - 1, 1 - 3 \rangle = \langle 3, -2 \rangle`, note: md`In one unit of time the point goes from $P$ to $Q$, so the change per unit of $t$ is $Q - P$.` },
            { math: md`x = 1 + 3t, \qquad y = 3 - 2t`, note: md`Start at $P$ and add $t$ copies of the direction vector.` },
            { math: md`t = 1: (1 + 3, 3 - 2) = (4, 1) = Q`, note: md`Check. Also, $t = \frac12$ gives the midpoint $(2.5, 2)$, and $t = 2$ continues past $Q$ to $(7, -1)$.` },
          ],
        },
        {
          kind: "plot",
          x: [-4, 9],
          y: [-3, 6],
          parametric: [{ x: "1 + 3t", y: "3 - 2t", t: [-2, 3], label: "x = 1 + 3t,\\ y = 3 - 2t" }],
          points: [
            { x: 1, y: 3, label: "P\\ (t = 0)", color: 3 },
            { x: 4, y: 1, label: "Q\\ (t = 1)", color: 3 },
            { x: "1 + 3t", y: "3 - 2t", label: "t = {t}:\\ ({=1 + 3t}, {=3 - 2t})", color: 2 },
          ],
          params: [{ name: "t", min: -1.5, max: 2.5, step: 0.1, value: 0.5 }],
          caption: md`Each step of $0.1$ in $t$ moves the point the same distance. Negative $t$ is before the point reached $P$; the line extends both ways.`,
        },
        {
          kind: "key",
          title: "Parametric equations of a circle",
          body: md`The circle with center $(h, k)$ and radius $r$ is traced once, counterclockwise, by

$$x = h + r\cos t, \qquad y = k + r\sin t, \qquad 0 \le t \le 2\pi.$$

Here $t$ is the angle at the center, measured from the positive $x$ direction. (Trigonometry books write $\theta$; in this app the angle is typed as t.) The point starts at $(h + r, k)$, the rightmost point, when $t = 0$.`,
        },
        {
          kind: "proof",
          title: "The parametric circle really is a circle",
          given: md`$x = h + r\cos t$ and $y = k + r\sin t$, with $r > 0$`,
          prove: md`Every point $(x, y)$ is at distance $r$ from $(h, k)$, that is, $(x - h)^2 + (y - k)^2 = r^2$`,
          steps: [
            { statement: md`$x - h = r\cos t$ and $y - k = r\sin t$`, reason: "Subtraction Property of Equality, applied to each given equation" },
            { statement: md`$(x - h)^2 + (y - k)^2 = r^2\cos^2 t + r^2\sin^2 t$`, reason: "Square both equations and add" },
            { statement: md`$= r^2(\cos^2 t + \sin^2 t)$`, reason: "Distributive Property" },
            { statement: md`$\cos^2 t + \sin^2 t = 1$`, reason: md`$(\cos t, \sin t)$ is a point on the unit circle, so its distance from the origin is 1 (Pythagorean Theorem, Trigonometry)` },
            { statement: md`$(x - h)^2 + (y - k)^2 = r^2$`, reason: "Substitution" },
          ],
        },
        {
          kind: "why",
          title: "Why counterclockwise, and how to change it",
          body: md`Check two times. At $t = 0$: $(h + r\cos 0, k + r\sin 0) = (h + r, k)$, the right side. At $t = \frac{\pi}{2}$: $(h, k + r)$, the top. Right, then top, is counterclockwise. The proof above never used the order, so any mix of $\cos$ and $\sin$ with the same $r$ stays on the circle; the mix only changes the motion:

- $x = h + r\sin t$, $y = k + r\cos t$ starts at the top $(h, k + r)$ and goes **clockwise** (at $t = \frac{\pi}{2}$ it is at the right).
- $x = h + r\cos t$, $y = k - r\sin t$ starts at the right and goes clockwise.
- $x = h + r\cos 2t$, $y = k + r\sin 2t$ goes around twice as fast: one lap takes $0 \le t \le \pi$.

Stretching gives an **ellipse**. $x = a\cos t$, $y = b\sin t$ is the unit circle with every $x$ multiplied by $a$ and every $y$ by $b$ (the transformations of Algebra 2, Unit 1). It crosses the axes at $(\pm a, 0)$ and $(0, \pm b)$.`,
        },
        {
          kind: "plot",
          x: [-5, 5],
          y: [-5, 5],
          parametric: [{ x: "a cos(t)", y: "b sin(t)", t: [0, 6.2832], label: "x = a\\cos t,\\ y = b\\sin t" }],
          points: [
            { x: "a", y: 0, label: "t = 0", color: 3 },
            { x: "a cos(t)", y: "b sin(t)", label: "t = {t}:\\ ({=a cos(t)}, {=b sin(t)})", color: 2 },
          ],
          params: [
            { name: "a", min: 1, max: 4.5, step: 0.5, value: 3 },
            { name: "b", min: 1, max: 4.5, step: 0.5, value: 3 },
            { name: "t", min: 0, max: 6.28, step: 0.05, value: 0.8 },
          ],
          caption: md`With $a = b$ the curve is a circle of radius $a$. Slide $a$ or $b$ to stretch it into an ellipse. Slide $t$: the point moves counterclockwise from $(a, 0)$, and $t = 2\pi \approx 6.28$ brings it back.`,
        },
        {
          kind: "check",
          prompt: md`A point moves along $x = 2t - 1$, $y = t^2 + 1$. Where is it when $t = 3$? ${POINT}`,
          answer: "(5, 10)",
          form: "tuple",
          explain: md`$x = 2(3) - 1 = 5$ and $y = 3^2 + 1 = 10$. One value of $t$, one point.`,
        },
        {
          kind: "text",
          body: md`The same trail can be walked in many ways. $x = t$, $y = t^2$ and $x = 2t$, $y = 4t^2$ both trace the parabola $y = x^2$, the second one twice as fast. $x = -t$, $y = t^2$ traces it in the opposite direction. A curve has many **parametrizations**; the picture is the same, the movie is different.

Curves that cross themselves are routine for parametric equations. The one below passes through the origin twice, at $t = 0$ and at $t = \pi$, heading in different directions.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-1.5, 1.5],
          parametric: [{ x: "sin(2t)", y: "sin(t)", t: [0, 6.2832], label: "x = \\sin 2t,\\ y = \\sin t" }],
          points: [{ x: "sin(2t)", y: "sin(t)", label: "t = {t}:\\ ({=sin(2t)}, {=sin(t)})", color: 2 }],
          params: [{ name: "t", min: 0, max: 6.28, step: 0.05, value: 0.5 }],
          caption: md`A figure eight. The $x$-coordinate completes two full waves while $y$ completes one, so the point crosses the center twice per lap.`,
        },
        {
          kind: "check",
          prompt: md`The curve $x = \cos t$, $y = -\sin t$ for $0 \le t \le 2\pi$ is the unit circle. Which way is it traced?`,
          choices: ["clockwise", "counterclockwise"],
          accept: ["clockwise"],
          explain: md`At $t = 0$ the point is $(1, 0)$. At $t = \frac{\pi}{2}$ it is $(0, -1)$, the bottom. From the right side to the bottom is clockwise. Negating $\sin t$ reflects the motion across the $x$-axis, which reverses the direction of travel.`,
        },
      ],
      practice: [pointAtT, whenAtPoint, writeLine, writeCircle],
    },
    {
      id: slug("Eliminating the parameter"),
      title: "Eliminating the parameter",
      summary: "Turning a pair of parametric equations back into one equation in x and y, by substitution or with cos² t + sin² t = 1, and the parabola of a thrown ball.",
      blocks: [
        {
          kind: "text",
          body: md`Parametric equations tell you where the point is at each moment. Sometimes you only want the shape of the trail: is it a line, a parabola, a circle? For that you want a single equation in $x$ and $y$ with no $t$ in it. Getting there is called **eliminating the parameter**.

Two tools do almost all of the work. If one equation can be solved for $t$, substitute into the other. If the equations involve $\cos t$ and $\sin t$, use $\cos^2 t + \sin^2 t = 1$.`,
        },
        {
          kind: "key",
          title: "Eliminating by substitution",
          body: md`1. Solve the simpler equation for $t$.
2. Substitute that expression for $t$ in the other equation.
3. Note which $x$-values (or $y$-values) the curve actually covers. The new equation may describe more points than the parametric curve traces.`,
        },
        {
          kind: "example",
          title: "Substitution",
          problem: md`Eliminate the parameter from $x = t + 1$, $y = t^2$.`,
          steps: [
            { math: md`t = x - 1`, note: md`The $x$-equation is linear, so solve it for $t$.` },
            { math: md`y = (x - 1)^2`, note: md`Replace $t$ in $y = t^2$.` },
            { math: md`y = x^2 - 2x + 1`, note: md`A parabola with vertex $(1, 0)$. Every real $t$ is allowed, and $x = t + 1$ takes every real value, so the whole parabola is traced.` },
          ],
        },
        {
          kind: "why",
          title: "Why the new equation describes the same points, and when it says too much",
          body: md`Suppose $(x, y)$ is on the parametric curve, so $x = t + 1$ and $y = t^2$ for some $t$. Then $t = x - 1$ is forced, and $y = t^2 = (x - 1)^2$. So every point of the curve satisfies the new equation. Conversely, if $y = (x - 1)^2$, set $t = x - 1$; then $x = t + 1$ and $y = t^2$, so the point is on the curve. The two descriptions pick out exactly the same set.

The converse can fail when the parameter can't reach every value. Take $x = t^2$, $y = t^4$. Substituting $t^2 = x$ gives $y = x^2$. But $x = t^2$ is never negative, so the curve is only the right half of that parabola. The point $(-1, 1)$ satisfies $y = x^2$ and is not on the curve. That is why step 3 matters: carry the restriction $x \ge 0$ along with the equation.

What's lost in the process is the timing and the direction. The equation $y = (x - 1)^2$ doesn't know that the point was at $(1, 0)$ when $t = 0$, or that it moves left to right.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-2, 7],
          curves: [{ expr: "x^2 - 1", label: "y = x^2 - 1", color: 3, dashed: true }],
          parametric: [{ x: "sqrt(t)", y: "t - 1", t: [0, 8], label: "x = \\sqrt{t},\\ y = t - 1", color: 1 }],
          points: [{ x: "sqrt(t)", y: "t - 1", label: "t = {t}:\\ ({=sqrt(t)}, {=t - 1})", color: 2 }],
          params: [{ name: "t", min: 0, max: 7, step: 0.1, value: 2 }],
          caption: md`Eliminating $t$ from $x = \sqrt{t}$, $y = t - 1$ gives $y = x^2 - 1$ (dashed). The curve itself is only the right half, since $\sqrt{t} \ge 0$. Slide $t$: the point never visits the left branch.`,
        },
        {
          kind: "example",
          title: "An exponential parameter",
          problem: md`Eliminate the parameter from $x = 2^{t}$, $y = 4^{t} + 1$.`,
          steps: [
            { math: md`4^{t} = (2^2)^{t} = (2^{t})^2`, note: md`Write $y$ in terms of $2^{t}$ using the power-of-a-power rule (Algebra 1, Unit 6).` },
            { math: md`y = (2^{t})^2 + 1 = x^2 + 1`, note: md`Substitute $x$ for $2^{t}$.` },
            { math: md`y = x^2 + 1, \quad x > 0`, note: md`$2^{t}$ is positive for every $t$, so only the right half of the parabola is traced. As $t \to -\infty$ the point slides toward $(0, 1)$ without arriving.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Eliminate the parameter from $x = 2t$, $y = 4t^2 - 1$. Write $y$ as an expression in $x$.`,
          answer: "x^2 - 1",
          explain: md`$t = \frac{x}{2}$, so $y = 4\left(\frac{x}{2}\right)^2 - 1 = 4 \cdot \frac{x^2}{4} - 1 = x^2 - 1$.`,
        },
        {
          kind: "key",
          title: "Eliminating with the Pythagorean identity",
          body: md`When $x$ and $y$ involve $\cos t$ and $\sin t$, isolate them, square, and add:

$$\cos^2 t + \sin^2 t = 1.$$

Dividing this identity by $\cos^2 t$ gives $1 + \tan^2 t = \sec^2 t$, which handles curves written with $\sec t$ and $\tan t$.`,
        },
        {
          kind: "why",
          title: "Why cos² t + sin² t = 1",
          body: md`By definition, $(\cos t, \sin t)$ is the point on the unit circle at angle $t$. The distance from the origin to that point is the radius, 1. The distance formula, which is the Pythagorean Theorem, says that distance is $\sqrt{\cos^2 t + \sin^2 t}$. So $\cos^2 t + \sin^2 t = 1$ for every angle $t$.

For the second identity, divide every term by $\cos^2 t$ (allowed when $\cos t \ne 0$):

$$\frac{\cos^2 t}{\cos^2 t} + \frac{\sin^2 t}{\cos^2 t} = \frac{1}{\cos^2 t} \quad\Longrightarrow\quad 1 + \tan^2 t = \sec^2 t.$$

Both identities trade two trig functions for a constant, which is exactly what eliminating $t$ needs.`,
        },
        {
          kind: "proof",
          title: "A stretched circle is an ellipse",
          given: md`$x = h + a\cos t$ and $y = k + b\sin t$, with $a, b > 0$`,
          prove: md`$\dfrac{(x - h)^2}{a^2} + \dfrac{(y - k)^2}{b^2} = 1$`,
          steps: [
            { statement: md`$\dfrac{x - h}{a} = \cos t$ and $\dfrac{y - k}{b} = \sin t$`, reason: "Subtract the constants, then divide by the coefficients" },
            { statement: md`$\dfrac{(x - h)^2}{a^2} + \dfrac{(y - k)^2}{b^2} = \cos^2 t + \sin^2 t$`, reason: "Square both equations and add" },
            { statement: md`$\dfrac{(x - h)^2}{a^2} + \dfrac{(y - k)^2}{b^2} = 1$`, reason: md`Pythagorean identity $\cos^2 t + \sin^2 t = 1$` },
          ],
        },
        {
          kind: "example",
          title: "Ellipse and hyperbola",
          problem: md`Eliminate the parameter from (a) $x = 3\cos t$, $y = 2\sin t$ and (b) $x = 2\sec t$, $y = 3\tan t$.`,
          steps: [
            { math: md`\text{(a)}\quad \frac{x}{3} = \cos t, \qquad \frac{y}{2} = \sin t`, note: "Isolate the trig functions." },
            { math: md`\frac{x^2}{9} + \frac{y^2}{4} = \cos^2 t + \sin^2 t = 1`, note: md`Square and add. An ellipse reaching $\pm 3$ on the $x$-axis and $\pm 2$ on the $y$-axis. The whole ellipse is traced, once per $2\pi$.` },
            { math: md`\text{(b)}\quad \frac{x}{2} = \sec t, \qquad \frac{y}{3} = \tan t`, note: "Isolate again." },
            { math: md`\frac{x^2}{4} - \frac{y^2}{9} = \sec^2 t - \tan^2 t = 1`, note: md`Square and **subtract**, because the identity is $\sec^2 t - \tan^2 t = 1$. This is a hyperbola opening left and right (Unit 5).` },
          ],
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-6, 6],
          curves: [
            { expr: "1.5x", label: "y = \\pm\\tfrac{3}{2}x", color: 4, dashed: true },
            { expr: "-1.5x", color: 4, dashed: true },
          ],
          parametric: [
            { x: "2 sec(t)", y: "3 tan(t)", t: [-1.35, 1.35], label: "x = 2\\sec t,\\ y = 3\\tan t", color: 1 },
            { x: "2 sec(t)", y: "3 tan(t)", t: [1.79, 4.49], color: 1 },
          ],
          points: [{ x: "2 sec(t)", y: "3 tan(t)", label: "t = {t}:\\ ({=2 sec(t)}, {=3 tan(t)})", color: 2 }],
          params: [{ name: "t", min: -1.3, max: 1.3, step: 0.05, value: 0.6 }],
          caption: md`The hyperbola $\frac{x^2}{4} - \frac{y^2}{9} = 1$. For $-\frac{\pi}{2} < t < \frac{\pi}{2}$ the point runs up the right branch; the left branch comes from $\frac{\pi}{2} < t < \frac{3\pi}{2}$, where $\sec t < 0$. The dashed lines are the asymptotes.`,
        },
        {
          kind: "check",
          prompt: md`Eliminating the parameter from $x = 3\cos t$, $y = 3\sin t$ gives which equation?`,
          choices: [md`$x^2 + y^2 = 9$`, md`$x^2 + y^2 = 3$`, md`$x + y = 3$`, md`$y = 3x$`],
          accept: [md`$x^2 + y^2 = 9$`],
          explain: md`$x^2 + y^2 = 9\cos^2 t + 9\sin^2 t = 9(\cos^2 t + \sin^2 t) = 9$. A circle of radius 3, not $\sqrt{3}$: the radius is squared in the equation.`,
        },
        {
          kind: "key",
          title: "Projectile motion",
          body: md`A ball launched from height $h$ with speed $v$ at an angle $\alpha$ above the horizontal, ignoring air resistance, is at

$$x = (v\cos\alpha)\,t, \qquad y = h + (v\sin\alpha)\,t - \tfrac{1}{2}gt^2,$$

where $g$ is the acceleration due to gravity: $32$ ft/s² or $9.8$ m/s². In feet, $\frac12 g = 16$.

- It lands when $y = 0$. The **range** is the value of $x$ at that time.
- The vertical velocity is $v\sin\alpha - gt$. It is zero at the peak, $t = \frac{v\sin\alpha}{g}$, so the **maximum height** is $h + \frac{(v\sin\alpha)^2}{2g}$.`,
        },
        {
          kind: "why",
          title: "Why the horizontal motion is linear and the vertical motion is quadratic",
          body: md`Split the launch velocity into components (Trigonometry): $v\cos\alpha$ sideways and $v\sin\alpha$ upward.

**Horizontal.** Nothing pushes the ball sideways once it's in flight, so its horizontal velocity stays $v\cos\alpha$. Distance is rate times time: $x = (v\cos\alpha)t$.

**Vertical.** Gravity changes the vertical velocity at the steady rate $g$, downward. So after $t$ seconds the upward velocity is $v\sin\alpha - gt$: a linear function of time. How far does a linear velocity carry you? Plot velocity against time: a straight line. The distance covered is the area under it from $0$ to $t$ (constant velocity gives a rectangle, rate times time, and the same idea holds slice by slice). Under a straight line that area is a trapezoid, and a trapezoid's area is the average of its two parallel sides times its width:

$$\frac{v\sin\alpha + (v\sin\alpha - gt)}{2} \cdot t = (v\sin\alpha)t - \tfrac12 gt^2.$$

Add the starting height $h$ and you have the $y$-equation. The $-\frac12 g t^2$ is why the path bends down into a parabola.`,
        },
        {
          kind: "example",
          title: "A kicked ball",
          problem: md`A ball is kicked from the ground at 64 ft/s at an angle of $30^\circ$. Find its equations of motion, its time in the air, its range and its maximum height. Then eliminate $t$.`,
          steps: [
            { math: md`v\cos 30^\circ = 64 \cdot \tfrac{\sqrt3}{2} = 32\sqrt3, \qquad v\sin 30^\circ = 64 \cdot \tfrac12 = 32`, note: "The two velocity components." },
            { math: md`x = 32\sqrt3\, t, \qquad y = 32t - 16t^2`, note: md`$h = 0$ and $\frac12 g = 16$ in feet.` },
            { math: md`32t - 16t^2 = 16t(2 - t) = 0 \;\Rightarrow\; t = 2`, note: md`Landing: $y = 0$. The root $t = 0$ is the kick itself.` },
            { math: md`x(2) = 64\sqrt3 \approx 110.9 \text{ ft}`, note: "The range: horizontal position at landing." },
            { math: md`t = \tfrac{32}{32} = 1, \qquad y(1) = 32 - 16 = 16 \text{ ft}`, note: md`The peak is when the vertical velocity $32 - 32t$ is zero, halfway through the flight.` },
            { math: md`t = \frac{x}{32\sqrt3} \;\Rightarrow\; y = \frac{x}{\sqrt3} - \frac{x^2}{192}`, note: md`Eliminating $t$: a downward parabola through the origin. Its other $x$-intercept is $x = 64\sqrt3$, the range again.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 480],
          y: [0, 240],
          parametric: [{ x: "v cos(a pi/180) t", y: "v sin(a pi/180) t - 16t^2", t: [0, 8], label: "\\text{path for } v, \\alpha" }],
          points: [{ x: "v cos(a pi/180) t", y: "v sin(a pi/180) t - 16t^2", label: "t = {t}\\text{ s}:\\ ({=v cos(a pi/180) t}, {=v sin(a pi/180) t - 16t^2})", color: 2 }],
          params: [
            { name: "v", tex: "v \\text{ (ft/s)}", min: 40, max: 120, step: 4, value: 96 },
            { name: "a", tex: "\\alpha \\text{ (degrees)}", min: 10, max: 80, step: 5, value: 45 },
            { name: "t", tex: "t \\text{ (s)}", min: 0, max: 8, step: 0.1, value: 1 },
          ],
          caption: md`Range $\approx {=v^2 sin(2 a pi/180)/32}$ ft, flight time $\approx {=v sin(a pi/180)/16}$ s. Slide $\alpha$: the range is largest at $45^\circ$, and $30^\circ$ and $60^\circ$ land in the same place. Slide $v$: doubling the speed quadruples the range.`,
        },
        {
          kind: "why",
          title: "Why 45° gives the greatest range",
          body: md`From the ground ($h = 0$), the ball lands when $(v\sin\alpha)t - \frac12 gt^2 = 0$, so $t = \frac{2v\sin\alpha}{g}$. The range is the horizontal position then:

$$R = (v\cos\alpha)\cdot\frac{2v\sin\alpha}{g} = \frac{v^2 \cdot 2\sin\alpha\cos\alpha}{g} = \frac{v^2\sin 2\alpha}{g},$$

using the double-angle identity $\sin 2\alpha = 2\sin\alpha\cos\alpha$ (Trigonometry). Now $\sin 2\alpha \le 1$, with equality exactly when $2\alpha = 90^\circ$, so $\alpha = 45^\circ$ gives the longest throw, $\frac{v^2}{g}$.

Two angles that add to $90^\circ$ have the same range: $\sin(180^\circ - 2\alpha) = \sin 2\alpha$. A high lob at $60^\circ$ and a flat shot at $30^\circ$ land together; the lob just takes longer. The formula also shows the range grows with $v^2$: twice the speed, four times the distance.`,
        },
      ],
      practice: [eliminateParameter, conicForm, projectile],
    },
  ],
};
