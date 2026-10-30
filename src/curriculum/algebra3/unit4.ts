import { frac, fracTex, gcd, paren, poly, signed } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Shared helpers ──────────────────────────────────────────────────────────

const VARS = ["x", "y", "z"];

/** "2x - y + 3z" from a coefficient list. */
const lin = (c: number[], vars = VARS) => poly(c.map((k, i) => [k, vars[i]!] as [number, string]));
/** "2x - y + 3z = 4". */
const eqn = (c: number[], rhs: number, vars = VARS) => `${lin(c, vars)} = ${rhs}`;
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const det2 = (a: number, b: number, c: number, d: number) => a * d - b * c;
function det3(m: number[][]): number {
  const [a, b, c] = m[0] as [number, number, number];
  const [d, e, f] = m[1] as [number, number, number];
  const [g, h, i] = m[2] as [number, number, number];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/** A matrix in LaTeX. With `aug`, the last column sits behind a bar. */
function matTex(rows: (number | string)[][], aug = false): string {
  const body = rows.map((r) => r.join(" & ")).join(" \\\\ ");
  if (!aug) return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
  const n = rows[0]!.length;
  return `\\left[\\begin{array}{${"c".repeat(n - 1)}|c} ${body} \\end{array}\\right]`;
}
/** A determinant in bars. */
const vmatTex = (rows: (number | string)[][]) => `\\begin{vmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{vmatrix}`;
/** A single row as a bracketed row vector. */
const rowTex = (row: (number | string)[]) => `\\begin{bmatrix} ${row.join(" & ")} \\end{bmatrix}`;
/** Answer text for a matrix: [[1, 2], [3, 4]]. */
const matAns = (rows: (number | string)[][]) => `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
/** "R_2 - 3R_1" for the replacement R_i + k R_j. */
const combo = (i: number, k: number, j: number) => `R_${i} ${k < 0 ? "-" : "+"} ${Math.abs(k) === 1 ? "" : Math.abs(k)}R_${j}`;
/** "k times" wording for a replacement step. */
const times = (k: number) => (Math.abs(k) === 1 ? "" : `${Math.abs(k)} times `);
const addOrSubtract = (k: number) => (k < 0 ? "subtract" : "add");
/** Shuffle a copy of a list. */
function shuffle<T>(r: { next(): number }, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
/** A polynomial in x from high-degree-first coefficients: ptext([1, -2, 5]) = "x^2 - 2x + 5". */
function ptext(c: number[]): string {
  const n = c.length - 1;
  return poly(c.map((k, i) => [k, n - i === 0 ? "" : n - i === 1 ? "x" : `x^${n - i}`] as [number, string]));
}
/** "x - 3" or "x + 2" for the factor x - a. */
const minus = (a: number) => (a === 0 ? "x" : a > 0 ? `x - ${a}` : `x + ${-a}`);
/** The factor x - a ready to sit next to another factor: "(x - 3)", or just "x". */
const fac = (a: number) => (a === 0 ? "x" : `(${minus(a)})`);
/** A product of two plain numbers with the dot shown: "(-6) \cdot 0". */
const prod = (a: number, b: number) => `${paren(a)} \\cdot ${paren(b)}`;
/** A signed term for the middle of an expression: "+ 3x", "- y", "+ C". */
const term = (k: number, v: string) => `${k < 0 ? "-" : "+"} ${Math.abs(k) === 1 ? "" : Math.abs(k)}${v}`;
/** Coefficients substituted into their variables: plugTex([2, -1, 3], [4, -2, 0]) = "2(4) - (-2) + 3(0)". */
function plugTex(coeffs: number[], vals: (number | string)[]): string {
  let out = "";
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const v = String(vals[i]!);
    const wrapped = /^-?\d+$/.test(v) ? `(${v})` : `\\left(${v}\\right)`;
    const mag = `${Math.abs(c) === 1 ? "" : Math.abs(c)}${wrapped}`;
    out += out ? ` ${c < 0 ? "-" : "+"} ${mag}` : c < 0 ? `-${mag}` : mag;
  });
  return out || "0";
}
/** A sum of plain numbers with zero terms dropped: ["8", "- 6"] joined, or null when fewer than two terms remain. */
function sumTex(terms: number[]): string | null {
  const kept = terms.filter((t) => t !== 0);
  if (kept.length < 2) return null;
  return kept.map((t, i) => (i === 0 ? String(t) : signed(t))).join(" ");
}

// ── Lesson 1: Systems in three variables ────────────────────────────────────

const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
] as const;

/** A system already shaped for back-substitution: one equation in one unknown, one in two, one in three. */
const solveTriangular: Generator = (r) => {
  for (;;) {
    const sol = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    const [p0, p1, p2] = r.pick(PERMS);
    if (sol[p0] === 0 || sol[p1] === 0) continue;
    const E3 = [0, 0, 0];
    E3[p0] = r.pick([1, 2, 3, -1, -2]);
    const E2 = [0, 0, 0];
    E2[p0] = r.nonzero(-3, 3);
    E2[p1] = r.pick([1, 2, -1, 3, -2]);
    const E1 = [r.nonzero(-3, 3), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const d = [dot(E1, sol), dot(E2, sol), dot(E3, sol)];
    const [v0, v1, v2] = [VARS[p0]!, VARS[p1]!, VARS[p2]!];
    const shown = shuffle(r, [eqn(E1, d[0]!), eqn(E2, d[1]!), eqn(E3, d[2]!)]);
    const e3c = E3[p0]!;
    const e2c = E2[p1]!;
    const e1c = E1[p2]!;
    const sub2 = E2[p0]! * sol[p0]!;
    const sub1 = E1[p0]! * sol[p0]! + E1[p1]! * sol[p1]!;
    const lhs1 = `${poly([[e1c, v2]])}${sub1 === 0 ? "" : ` ${signed(sub1)}`}`;
    return {
      prompt: md`Solve the system $${shown[0]}$, $${shown[1]}$, $${shown[2]}$. Give the answer as $(x, y, z)$.`,
      answer: `(${sol.join(", ")})`,
      form: "tuple",
      hint: md`One equation has a single unknown. Solve it, then substitute into the equation with two unknowns, then into the last one.`,
      solution: [
        {
          math: e3c === 1 ? md`${v0} = ${sol[p0]}` : md`${eqn(E3, d[2]!)} \;\Rightarrow\; ${v0} = ${sol[p0]}`,
          note: e3c === 1 ? md`One equation already gives $${v0}$.` : md`One equation has only $${v0}$. Divide both sides by ${e3c}.`,
        },
        {
          math: md`${poly([[e2c, v1]])} ${signed(sub2)} = ${d[1]} \;\Rightarrow\; ${poly([[e2c, v1]])} = ${d[1]! - sub2}${e2c === 1 ? "" : md` \;\Rightarrow\; ${v1} = ${sol[p1]}`}`,
          note: md`Substitute $${v0} = ${sol[p0]}$ into $${eqn(E2, d[1]!)}$: the term $${poly([[E2[p0]!, v0]])}$ becomes $${prod(E2[p0]!, sol[p0]!)} = ${sub2}$.`,
        },
        {
          math: e1c === 1 && sub1 === 0 ? md`${v2} = ${sol[p2]}` : md`${lhs1} = ${d[0]} \;\Rightarrow\; ${v2} = ${sol[p2]}`,
          note: md`Substitute both known values into $${eqn(E1, d[0]!)}$: $${poly([[E1[p0]!, v0], [E1[p1]!, v1]])}$ becomes $${E1[p0]! * sol[p0]!} ${signed(E1[p1]! * sol[p1]!)} = ${sub1}$. Then solve for $${v2}$.`,
        },
        {
          math: md`(x, y, z) = (${sol.join(", ")})`,
          note: md`Check in the equation you haven't used for a value: $${plugTex(E1, sol)} = ${d[0]}$. ✓`,
        },
      ],
    };
  }
};

/** Full elimination: remove x from two equations, solve the 2×2 that remains, back-substitute. */
const solveElimination: Generator = (r) => {
  for (;;) {
    const sol = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    if (sol.filter((v) => v === 0).length > 1) continue;
    const E1 = [1, r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const E2 = [r.nonzero(-2, 2), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const E3 = [r.nonzero(-2, 2), r.nonzero(-3, 3), r.nonzero(-3, 3)];
    if (det3([E1, E2, E3]) === 0) continue;
    const d = [dot(E1, sol), dot(E2, sol), dot(E3, sol)];
    // After E2 - a2 E1 and E3 - a3 E1: m y + n z = k.
    const a2 = E2[0]!;
    const a3 = E3[0]!;
    const F2 = [E2[1]! - a2 * E1[1]!, E2[2]! - a2 * E1[2]!];
    const F3 = [E3[1]! - a3 * E1[1]!, E3[2]! - a3 * E1[2]!];
    const k2 = d[1]! - a2 * d[0]!;
    const k3 = d[2]! - a3 * d[0]!;
    if ([...F2, ...F3].some((v) => v === 0 || Math.abs(v) > 6)) continue;
    const [m1, n1] = F2 as [number, number];
    const [m2, n2] = F3 as [number, number];
    // Multipliers so that the z-coefficients agree: u n1 = v n2 = lcm.
    const g = gcd(n1, n2);
    let u = n2 / g;
    let v = n1 / g;
    if (u < 0 && v < 0) [u, v] = [-u, -v];
    const yz = ["y", "z"];
    const G2 = [u * m1, u * n1];
    const G3 = [v * m2, v * n2];
    const coefY = G2[0]! - G3[0]!;
    const rhsY = u * k2 - v * k3;
    if (Math.abs(rhsY) > 60) continue;
    const y = sol[1]!;
    const z = sol[2]!;
    const x = sol[0]!;
    const multiply = [u === 1 ? "" : `the first by ${u}`, v === 1 ? "" : `the second by ${v}`].filter(Boolean).join(" and ");
    const scaled: Step[] =
      u === 1 && v === 1
        ? []
        : [
            {
              math: md`${eqn(G2, u * k2, yz)} \qquad ${eqn(G3, v * k3, yz)}`,
              note: md`Multiply ${multiply} so both have a $z$-coefficient of ${u * n1}.`,
            },
          ];
    const xSum = sumTex([d[0]!, -E1[1]! * y, -E1[2]! * z]);
    return {
      prompt: md`Solve the system $${eqn(E1, d[0]!)}$, $${eqn(E2, d[1]!)}$, $${eqn(E3, d[2]!)}$. Give the answer as $(x, y, z)$.`,
      answer: `(${sol.join(", ")})`,
      form: "tuple",
      hint: md`The first equation has $x$ with coefficient 1. Use it to remove $x$ from the other two, which leaves a two-variable system in $y$ and $z$.`,
      solution: [
        {
          math: md`E_2 ${a2 < 0 ? "+" : "-"} ${Math.abs(a2) === 1 ? "" : Math.abs(a2)}E_1: \quad ${eqn(F2, k2, yz)}`,
          note: md`${a2 < 0 ? "Add" : "Subtract"} ${times(a2)}the first equation ${a2 < 0 ? "to" : "from"} the second. The $x$ terms cancel.`,
        },
        {
          math: md`E_3 ${a3 < 0 ? "+" : "-"} ${Math.abs(a3) === 1 ? "" : Math.abs(a3)}E_1: \quad ${eqn(F3, k3, yz)}`,
          note: md`Same move on the third equation. Now two equations involve only $y$ and $z$.`,
        },
        ...scaled,
        {
          math: md`${poly([[coefY, "y"]])} = ${rhsY} \;\Rightarrow\; y = ${y}`,
          note: md`Subtract the second from the first: the $z$ terms cancel.`,
        },
        {
          math: md`${poly([[n1, "z"]])} = ${k2} ${signed(-m1 * y)} = ${k2 - m1 * y}${n1 === 1 ? "" : md` \;\Rightarrow\; z = ${z}`}`,
          note: md`Put $y = ${y}$ into $${eqn(F2, k2, yz)}$.`,
        },
        {
          math: xSum ? md`x = ${xSum} = ${x}` : md`x = ${x}`,
          note: md`Back into the first equation, $${eqn(E1, d[0]!)}$, with $y = ${y}$ and $z = ${z}$: $x = ${d[0]} ${term(-E1[1]!, `(${y})`)} ${term(-E1[2]!, `(${z})`)}$.`,
        },
        {
          math: md`(x, y, z) = (${sol.join(", ")})`,
          note: md`Check in the third original equation: $${plugTex(E3, sol)} = ${d[2]}$. ✓`,
        },
      ],
    };
  }
};

/** Three points determine a parabola: a 3×3 system in a, b, c. */
const fitParabola: Generator = (r) => {
  for (;;) {
    const a = r.nonzero(-3, 3);
    const b = r.int(-4, 4);
    const c = r.int(-5, 5);
    const xs = shuffle(r, [-3, -2, -1, 0, 1, 2, 3]).slice(0, 3);
    const [x1, x2, x3] = xs as [number, number, number];
    const f = (x: number) => a * x * x + b * x + c;
    const ys = xs.map(f);
    if (ys.some((y) => Math.abs(y) > 20)) continue;
    const [y1, y2, y3] = ys as [number, number, number];
    const abc = ["a", "b", "c"];
    const E = (x: number, y: number) => eqn([x * x, x, 1], y, abc);
    // (E2 - E1)/(x2 - x1): a(x1 + x2) + b = s12, and the same with E3.
    const s12 = (y2 - y1) / (x2 - x1);
    const s13 = (y3 - y1) / (x3 - x1);
    const diffNote = (xi: number, which: string) =>
      x1 + xi === 0
        ? md`${which} minus first: $c$ cancels, and so do the $a$ terms, since $(${xi})^2 = (${x1})^2$. Divide by ${xi - x1}.`
        : xi - x1 === 1
          ? md`${which} minus first: $c$ cancels.`
          : xi - x1 === -1
            ? md`${which} minus first: $c$ cancels. Multiply by $-1$ to tidy the signs.`
            : md`${which} minus first: $c$ cancels. Then divide by $${xi - x1}$, which works because $${xi * xi - x1 * x1} = (${xi - x1})(${x1 + xi})$.`;
    return {
      prompt: md`A parabola $y = ax^2 + bx + c$ passes through $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, ${y3})$. Find $a$, $b$ and $c$. Give them as $(a, b, c)$.`,
      answer: `(${a}, ${b}, ${c})`,
      form: "tuple",
      verify: xs.map((x, i) => `a*(${x})^2 + b*(${x}) + c = ${ys[i]}`),
      figure: {
        kind: "plot",
        x: [-4, 4],
        y: [Math.min(-2, ...ys) - 2, Math.max(2, ...ys) + 2],
        points: xs.map((x, i) => ({ x, y: ys[i]!, label: md`(${x}, ${ys[i]})`, color: 2 as const })),
      },
      hint: md`Each point gives one equation in $a$, $b$, $c$ when you substitute its $x$ and $y$. Subtracting equations removes $c$ right away.`,
      solution: [
        {
          math: md`${E(x1, y1)} \qquad ${E(x2, y2)} \qquad ${E(x3, y3)}`,
          note: md`Substitute each point into $y = ax^2 + bx + c$. Three unknowns, three equations.`,
        },
        {
          math: md`${eqn([x2 * x2 - x1 * x1, x2 - x1], y2 - y1, abc)} \;\Rightarrow\; ${eqn([x1 + x2, 1], s12, abc)}`,
          note: diffNote(x2, "Second"),
        },
        {
          math: md`${eqn([x3 * x3 - x1 * x1, x3 - x1], y3 - y1, abc)} \;\Rightarrow\; ${eqn([x1 + x3, 1], s13, abc)}`,
          note: diffNote(x3, "Third"),
        },
        {
          math: md`${poly([[x2 - x3, "a"]])} = ${s12 - s13} \;\Rightarrow\; a = ${a}`,
          note: md`Subtract the two reduced equations: $b$ cancels.`,
        },
        {
          math: md`b = ${s12} - ${paren(a)}(${x1 + x2}) = ${b}`,
          note: md`From $${eqn([x1 + x2, 1], s12, abc)}$.`,
        },
        {
          math: md`c = ${y1} - ${paren(a)}(${x1 * x1}) - ${paren(b)}(${x1}) = ${c}`,
          note: md`From the first point's equation. So $y = ${ptext([a, b, c])}$.`,
        },
      ],
    };
  }
};

// ── Lesson 2: Matrices and row operations ───────────────────────────────────

const rowOperation: Generator = (r) => {
  for (;;) {
    const rows = r.int(0, 1) ? 3 : 2;
    const cols = rows + 1;
    const M = Array.from({ length: rows }, () => Array.from({ length: cols }, () => r.int(-5, 5)));
    if (M.some((row) => row.every((v) => v === 0))) continue;
    const kind = r.int(0, 2);
    const like = rows === 2 ? "[[1, 2, 3], [4, 5, 6]]" : "[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]";
    let i = r.int(1, rows);
    let j = r.int(1, rows);
    while (j === i) j = r.int(1, rows);
    if (kind === 0 && i > j) [i, j] = [j, i];
    const result = M.map((row) => [...row]);
    let opTex: string;
    let steps: Step[];
    let k = 0;
    if (kind === 0) {
      opTex = `R_${i} \\leftrightarrow R_${j}`;
      result[i - 1] = M[j - 1]!;
      result[j - 1] = M[i - 1]!;
      steps = [{ math: matTex(result, true), note: md`Rows ${i} and ${j} trade places. Nothing else changes, and the system still says the same things, just in a different order.` }];
    } else if (kind === 1) {
      k = r.pick([-1, 2, 3, -2]);
      opTex = `R_${i} \\to ${k === -1 ? "-" : k}R_${i}`;
      result[i - 1] = M[i - 1]!.map((v) => k * v);
      steps = [
        { math: md`${k}\,${rowTex(M[i - 1]!)} = ${rowTex(result[i - 1]!)}`, note: md`Multiply every entry of row ${i} by ${k}, the bar column included. That's multiplying both sides of the equation by ${k}.` },
        { math: matTex(result, true), note: md`The other ${rows === 3 ? "rows stay" : "row stays"} as before.` },
      ];
    } else {
      k = r.nonzero(-3, 3);
      opTex = `R_${i} \\to ${combo(i, k, j)}`;
      result[i - 1] = M[i - 1]!.map((v, c) => v + k * M[j - 1]![c]!);
      steps = [
        {
          math: md`${rowTex(M[i - 1]!)} ${k < 0 ? "-" : "+"} ${Math.abs(k) === 1 ? "" : Math.abs(k)}\,${rowTex(M[j - 1]!)} = ${rowTex(result[i - 1]!)}`,
          note: md`Entry by entry, ${addOrSubtract(k)} ${times(k)}row ${j} ${k < 0 ? "from" : "to"} row ${i}. Row ${j} itself is only read, not changed.`,
        },
        { math: matTex(result, true), note: md`Only row ${i} is new.` },
      ];
    }
    return {
      prompt: md`Apply the row operation $${opTex}$ to $${matTex(M, true)}$. Type the result row by row, like ${like}.`,
      answer: matAns(result),
      form: "matrix",
      hint:
        kind === 0
          ? md`$R_${i} \leftrightarrow R_${j}$ means swap those two rows.`
          : kind === 1
            ? md`Multiply each entry of row ${i} by the same number, including the entry after the bar.`
            : md`Replace row ${i} by itself ${k < 0 ? "minus" : "plus"} ${times(k)}row ${j}, entry by entry. Row ${j} stays put.`,
      solution: steps,
    };
  }
};

/** Reduce a 2×3 augmented matrix to RREF with integer arithmetic throughout. */
const reduceToRref: Generator = (r) => {
  for (;;) {
    const x0 = r.int(-5, 5);
    const y0 = r.int(-5, 5);
    if (x0 === 0 && y0 === 0) continue;
    const kind = r.int(0, 2);
    const b1 = r.nonzero(-4, 4);
    const a2 = r.nonzero(-3, 3);
    const b2 = r.nonzero(-5, 5);
    const m = b2 - a2 * b1;
    if (m === 0 || Math.abs(m) > 9) continue;
    const steps: Step[] = [];
    // The row with leading 1 after any setup step.
    let top = [1, b1, x0 + b1 * y0];
    const second = [a2, b2, a2 * x0 + b2 * y0];
    let M: number[][];
    if (kind === 0) {
      M = [top, second];
    } else if (kind === 1) {
      M = [second, top];
      steps.push({ math: md`\xrightarrow{R_1 \leftrightarrow R_2} ${matTex([top, second], true)}`, note: md`The second row already starts with a 1, so swap it to the top. A leading 1 is the easiest pivot.` });
    } else {
      const s = r.pick([2, 3, -1, -2]);
      const scaledTop = top.map((v) => s * v);
      M = [scaledTop, second];
      steps.push({
        math: md`\xrightarrow{R_1 \to ${s === -1 ? "-" : fracTex(1, s)}R_1} ${matTex([top, second], true)}`,
        note: md`Every entry of row 1 is a multiple of ${s}, so dividing by ${s} makes the pivot 1 without creating fractions.`,
      });
      top = scaledTop;
    }
    const afterElim = [[1, b1, x0 + b1 * y0], [0, m, m * y0]];
    steps.push({
      math: md`\xrightarrow{R_2 \to ${combo(2, -a2, 1)}} ${matTex(afterElim, true)}`,
      note: md`Clear the entry below the pivot: ${addOrSubtract(-a2)} ${times(a2)}row 1 ${a2 > 0 ? "from" : "to"} row 2. The matrix is now in echelon form.`,
    });
    if (m !== 1) {
      steps.push({
        math: md`\xrightarrow{R_2 \to ${m === -1 ? "-" : fracTex(1, m)}R_2} ${matTex([[1, b1, x0 + b1 * y0], [0, 1, y0]], true)}`,
        note: md`Make the second pivot a 1 by dividing row 2 by ${m}.`,
      });
    }
    steps.push({
      math: md`\xrightarrow{R_1 \to ${combo(1, -b1, 2)}} ${matTex([[1, 0, x0], [0, 1, y0]], true)}`,
      note: md`Clear the entry above the second pivot. Each pivot is now the only nonzero entry in its column: reduced row echelon form. It reads $x = ${x0}$, $y = ${y0}$.`,
    });
    return {
      prompt: md`Row-reduce the augmented matrix $${matTex(M, true)}$ to reduced row echelon form. Type the matrix row by row, like [[1, 2, 3], [4, 5, 6]].`,
      answer: matAns([[1, 0, x0], [0, 1, y0]]),
      form: "matrix",
      hint: md`Get a 1 in the top-left${kind === 1 ? " (a swap does it)" : kind === 2 ? " (divide row 1)" : ""}, use it to clear the entry below, scale the second pivot to 1, then clear the entry above it.`,
      solution: steps,
    };
  }
};

/** Read the solution off an echelon-form augmented matrix by back-substitution. */
const solveFromEchelon: Generator = (r) => {
  for (;;) {
    const sol = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    if (sol.filter((v) => v === 0).length > 1) continue;
    const p1 = r.pick([1, 1, 2, -1]);
    const p2 = r.pick([1, 2, 3, -1, -2]);
    const p3 = r.pick([1, 2, 3, -1, -2, 4]);
    const R1 = [p1, r.nonzero(-3, 3), r.nonzero(-3, 3)];
    const R2 = [0, p2, r.nonzero(-3, 3)];
    const R3 = [0, 0, p3];
    const d = [dot(R1, sol), dot(R2, sol), dot(R3, sol)];
    const M = [R1, R2, R3].map((row, i) => [...row, d[i]!]);
    const [x, y, z] = sol as [number, number, number];
    return {
      prompt: md`The augmented matrix $${matTex(M, true)}$ is in row echelon form. Solve the system it represents. Give the answer as $(x, y, z)$.`,
      answer: `(${sol.join(", ")})`,
      form: "tuple",
      // Every verify equation must name all three unknowns, so zero coefficients are written out.
      verify: [R1, R2, R3].map((R, i) => `${R[0]}*x + ${R[1]}*y + ${R[2]}*z = ${d[i]}`),
      hint: md`Turn each row back into an equation (the columns are $x$, $y$, $z$ and the constant). Start from the bottom row and work upward.`,
      solution: [
        { math: md`${eqn(R1, d[0]!)} \qquad ${eqn(R2, d[1]!)} \qquad ${eqn(R3, d[2]!)}`, note: md`Each row is an equation; the bar is the equals sign.` },
        { math: md`${eqn(R3, d[2]!)} \;\Rightarrow\; z = ${z}`, note: p3 === 1 ? md`The last row gives $z$ directly.` : md`Divide the last row by ${p3}.` },
        {
          math: md`${poly([[p2, "y"]])} ${signed(R2[2]! * z)} = ${d[1]} \;\Rightarrow\; y = ${y}`,
          note: md`Substitute $z = ${z}$ into the middle row.`,
        },
        {
          math: md`${poly([[p1, "x"]])} ${signed(R1[1]! * y + R1[2]! * z)} = ${d[0]} \;\Rightarrow\; x = ${x}`,
          note: md`Substitute $y = ${y}$ and $z = ${z}$ into the top row: $${poly([[R1[1]!, "y"], [R1[2]!, "z"]])} = ${R1[1]! * y} ${signed(R1[2]! * z)} = ${R1[1]! * y + R1[2]! * z}$.`,
        },
        { math: md`(x, y, z) = (${sol.join(", ")})`, note: md`Back-substitution is why echelon form is the goal: once the staircase is there, each unknown falls out in turn.` },
      ],
    };
  }
};

// ── Lesson 3: Determinants and Cramer's rule ────────────────────────────────

const det2Practice: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const [a, b, c, d] = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)];
    const D = det2(a, b, c, d);
    return {
      prompt: md`Find the determinant of $${matTex([[a, b], [c, d]])}$.`,
      answer: String(D),
      hint: md`Down-right product minus up-right product: $ad - bc$.`,
      solution: [
        { math: md`${vmatTex([[a, b], [c, d]])} = ${prod(a, d)} - ${prod(b, c)}`, note: md`Multiply along the main diagonal, then subtract the product along the other diagonal.` },
        { math: md`${a * d} ${signed(-b * c)} = ${D}`, note: D === 0 ? md`A zero determinant: the rows are proportional, so a system with these coefficients would have no unique solution.` : md`Nonzero, so a system with these coefficients has exactly one solution.` },
      ],
    };
  }
  if (kind === 1) {
    // Find k so that the determinant is zero: k d - b c = 0.
    for (;;) {
      const [b, c, d] = [r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-5, 5)];
      const pos = r.int(0, 1);
      // k is top-left (k d = b c) or bottom-right (a k = b c).
      const num = b * c;
      const den = d;
      if (num % den !== 0 && Math.abs(den) > 4) continue;
      const k = frac(num, den);
      const matrix = pos === 0 ? [["k", b], [c, d]] : [[d, b], [c, "k"]];
      return {
        prompt: md`Find $k$ so that $${vmatTex(matrix)} = 0$.`,
        answer: k,
        verify: [`k*${paren(d)} - ${paren(b)}*${paren(c)} = 0`],
        hint: md`Write out $ad - bc$ with $k$ in its place and set it equal to zero.`,
        solution: [
          { math: pos === 0 ? md`k \cdot ${paren(d)} - ${prod(b, c)} = 0` : md`${paren(d)} \cdot k - ${prod(b, c)} = 0`, note: md`The determinant formula, with the unknown entry.` },
          { math: md`${poly([[d, "k"]])} = ${num} \;\Rightarrow\; k = ${fracTex(num, den)}`, note: md`With this $k$ the two rows are proportional: a system with these coefficients would have parallel or identical lines, never a single solution.` },
        ],
      };
    }
  }
  // Area of a parallelogram spanned by two vectors.
  for (;;) {
    const [a, b, c, d] = [r.int(1, 5), r.int(0, 3), r.int(0, 3), r.int(1, 5)];
    const D = det2(a, b, c, d);
    if (D === 0 || (a === c && b === d)) continue;
    const area = Math.abs(D);
    const W = a + c + 1;
    const H = b + d + 1;
    return {
      prompt: md`The vectors $\langle ${a}, ${b} \rangle$ and $\langle ${c}, ${d} \rangle$ span the parallelogram shown. Find its area.`,
      answer: String(area),
      figure: {
        kind: "diagram",
        view: [-1, Math.max(W, H), -1, Math.max(W, H)],
        grid: true,
        points: [
          { name: "O", x: 0, y: 0, dir: "sw" },
          { name: "P", x: a, y: b, label: md`(${a}, ${b})`, dir: "se" },
          { name: "Q", x: c, y: d, label: md`(${c}, ${d})`, dir: "nw" },
          { name: "R", x: a + c, y: b + d, label: md`(${a + c}, ${b + d})`, dir: "ne" },
        ],
        polygons: [{ points: ["O", "P", "R", "Q"], fill: 1 }],
        segments: [
          { from: "O", to: "P", arrow: true, color: 2 },
          { from: "O", to: "Q", arrow: true, color: 3 },
        ],
      },
      hint: md`The area is the absolute value of the determinant whose rows are the two vectors.`,
      solution: [
        { math: md`\left| ${vmatTex([[a, b], [c, d]])} \right| = |${prod(a, d)} - ${prod(b, c)}|`, note: md`Rows are the two vectors. The lesson's box-minus-triangles argument gives area $= |ad - bc|$.` },
        { math: md`|${a * d} ${signed(-b * c)}| = |${D}| = ${area}`, note: D < 0 ? md`The determinant came out negative because $\langle ${c}, ${d} \rangle$ sits clockwise from $\langle ${a}, ${b} \rangle$. Area is never negative, so take the absolute value.` : md`Positive here, since the second vector is counterclockwise from the first.` },
      ],
    };
  }
};

const det3Practice: Generator = (r) => {
  for (;;) {
    const M = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-4, 4)));
    if (r.next() < 0.4) M[0]![r.int(0, 2)] = 0;
    if (M.some((row) => row.every((v) => v === 0)) || [0, 1, 2].some((j) => M.every((row) => row[j] === 0))) continue;
    const [a, b, c] = M[0] as [number, number, number];
    const [d, e, f] = M[1] as [number, number, number];
    const [g, h, i] = M[2] as [number, number, number];
    const m1 = det2(e, f, h, i);
    const m2 = det2(d, f, g, i);
    const m3 = det2(d, e, g, h);
    const D = a * m1 - b * m2 + c * m3;
    const zeros = [a, b, c].filter((v) => v === 0).length;
    return {
      prompt: md`Find the determinant of $${matTex(M)}$.`,
      answer: String(D),
      hint: md`Expand along the first row: $a \cdot M_{11} - b \cdot M_{12} + c \cdot M_{13}$, where each minor is the $2 \times 2$ determinant left after deleting that entry's row and column.${zeros ? " A zero entry kills its whole term." : ""}`,
      solution: [
        {
          math: md`${paren(a)} ${vmatTex([[e, f], [h, i]])} - ${paren(b)} ${vmatTex([[d, f], [g, i]])} + ${paren(c)} ${vmatTex([[d, e], [g, h]])}`,
          note: md`Cofactor expansion along the first row. Signs go $+\,-\,+$. Each minor deletes the entry's row and column.`,
        },
        {
          math: md`${paren(a)}(${prod(e, i)} - ${prod(f, h)}) - ${paren(b)}(${prod(d, i)} - ${prod(f, g)}) + ${paren(c)}(${prod(d, h)} - ${prod(e, g)})`,
          note: md`Each $2 \times 2$ determinant is $ad - bc$.`,
        },
        {
          math: md`${paren(a)}(${m1}) - ${paren(b)}(${m2}) + ${paren(c)}(${m3}) = ${a * m1} ${signed(-b * m2)} ${signed(c * m3)} = ${D}`,
          note: D === 0 ? md`Zero: one row is a combination of the others, so a system with these coefficients has no unique solution.` : "",
        },
      ],
    };
  }
};

const cramerPractice: Generator = (r) => {
  for (;;) {
    const [a, b, c, d] = [r.nonzero(-5, 5), r.nonzero(-5, 5), r.nonzero(-5, 5), r.nonzero(-5, 5)];
    const D = det2(a, b, c, d);
    if (D === 0 || Math.abs(D) > 12) continue;
    let e: number;
    let f: number;
    if (r.next() < 0.5) {
      const x0 = r.int(-4, 4);
      const y0 = r.int(-4, 4);
      if (x0 === 0 && y0 === 0) continue;
      e = a * x0 + b * y0;
      f = c * x0 + d * y0;
    } else {
      e = r.int(-9, 9);
      f = r.int(-9, 9);
      if (e === 0 && f === 0) continue;
    }
    const Dx = det2(e, b, f, d);
    const Dy = det2(a, e, c, f);
    return {
      prompt: md`Solve $${eqn([a, b], e)}$, $${eqn([c, d], f)}$ using Cramer's rule. Give the answer as $(x, y)$.`,
      answer: `(${frac(Dx, D)}, ${frac(Dy, D)})`,
      form: "tuple",
      hint: md`$D$ is the coefficient determinant. For $D_x$, replace the $x$-column by the constants; for $D_y$, replace the $y$-column. Then $x = D_x / D$ and $y = D_y / D$.`,
      solution: [
        { math: md`D = ${vmatTex([[a, b], [c, d]])} = ${prod(a, d)} - ${prod(b, c)} = ${D}`, note: md`Nonzero, so Cramer's rule applies and the solution is unique.` },
        { math: md`D_x = ${vmatTex([[e, b], [f, d]])} = ${prod(e, d)} - ${prod(b, f)} = ${Dx}`, note: md`The constants $${e}, ${f}$ take the place of the $x$-coefficients.` },
        { math: md`D_y = ${vmatTex([[a, e], [c, f]])} = ${prod(a, f)} - ${prod(e, c)} = ${Dy}`, note: md`The constants take the place of the $y$-coefficients.` },
        {
          math: md`x = \frac{D_x}{D} = ${fracTex(Dx, D)}, \qquad y = \frac{D_y}{D} = ${fracTex(Dy, D)}`,
          note: md`Check in the first equation: $${plugTex([a, b], [fracTex(Dx, D), fracTex(Dy, D)])} = ${e}$. ✓`,
        },
      ],
    };
  }
};

// ── Lesson 4: Partial fractions ─────────────────────────────────────────────

/** Evaluate a high-first coefficient list at x. */
const at = (c: number[], x: number) => c.reduce((s, k) => s * x + k, 0);
/** Multiply polynomials given high-first. */
function pmul(p: number[], q: number[]): number[] {
  const out = new Array<number>(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j]! += a * b)));
  return out;
}
const padd = (p: number[], q: number[]): number[] => {
  const n = Math.max(p.length, q.length);
  const P = [...new Array<number>(n - p.length).fill(0), ...p];
  const Q = [...new Array<number>(n - q.length).fill(0), ...q];
  return P.map((v, i) => v + Q[i]!);
};
const pscale = (p: number[], k: number) => p.map((v) => v * k);
/** Verify equations: the identity evaluated at a few x values, with the constants left as unknowns. */
const atPoints = (xs: number[], left: (x: number) => string, N: number[]) => xs.map((x) => `${left(x)} = ${at(N, x)}`);

const distinctLinear: Generator = (r) => {
  for (;;) {
    const a = r.int(-4, 4);
    let b = r.int(-4, 4);
    while (b === a) b = r.int(-4, 4);
    const A = r.nonzero(-5, 5);
    const B = r.nonzero(-5, 5);
    const kind = r.int(0, 2);
    const fa = [1, -a];
    const fb = [1, -b];
    const den = pmul(fa, fb);
    if (kind < 2) {
      // N = A(x - b) + B(x - a)
      const N = padd(pscale(fb, A), pscale(fa, B));
      if (N.every((v) => v === 0)) continue;
      const denTex = kind === 0 ? `${fac(a)}${fac(b)}` : ptext(den);
      const factorStep: Step[] = kind === 1 ? [{ math: md`${ptext(den)} = ${fac(a)}${fac(b)}`, note: md`Factor the denominator first. The pieces are decided by its factors.` }] : [];
      return {
        prompt: md`Write $\dfrac{${ptext(N)}}{${denTex}}$ as $\dfrac{A}{${minus(a)}} + \dfrac{B}{${minus(b)}}$. Give the constants as $(A, B)$.`,
        answer: `(${A}, ${B})`,
        form: "tuple",
        verify: atPoints([a, b], (x) => `A*(${x - b}) + B*(${x - a})`, N),
        hint: md`Multiply through by the denominator to get $${ptext(N)} = A(${minus(b)}) + B(${minus(a)})$, then substitute $x = ${a}$ and $x = ${b}$: each kills one unknown.`,
        solution: [
          ...factorStep,
          { math: md`${ptext(N)} = A(${minus(b)}) + B(${minus(a)})`, note: md`Multiply both sides by $${fac(a)}${fac(b)}$. This must hold for every $x$.` },
          { math: md`x = ${a}: \quad ${at(N, a)} = A(${a - b}) \;\Rightarrow\; A = ${A}`, note: md`At $x = ${a}$ the factor $${minus(a)}$ is zero, so the $B$ term vanishes.` },
          { math: md`x = ${b}: \quad ${at(N, b)} = B(${b - a}) \;\Rightarrow\; B = ${B}`, note: md`At $x = ${b}$ the $A$ term vanishes.` },
          { math: md`\frac{${ptext(N)}}{${fac(a)}${fac(b)}} = ${A < 0 ? "-" : ""}\frac{${Math.abs(A)}}{${minus(a)}} ${B < 0 ? "-" : "+"} \frac{${Math.abs(B)}}{${minus(b)}}`, note: md`Check the $x$-coefficients: $A + B = ${A + B}$, matching the numerator. ✓` },
        ],
      };
    }
    // Improper: N = k(x - a)(x - b) + A(x - b) + B(x - a), ask for (A, B, k).
    const k = r.nonzero(-3, 3);
    const N = padd(pscale(den, k), padd(pscale(fb, A), pscale(fa, B)));
    const rem = padd(pscale(fb, A), pscale(fa, B));
    return {
      prompt: md`Write $\dfrac{${ptext(N)}}{${fac(a)}${fac(b)}}$ in the form $k + \dfrac{A}{${minus(a)}} + \dfrac{B}{${minus(b)}}$, where $k$ is a constant. Give $(A, B, k)$.`,
      answer: `(${A}, ${B}, ${k})`,
      form: "tuple",
      verify: atPoints([a, b, r.pick([0, 1, -1].filter((x) => x !== a && x !== b))], (x) => `A*(${x - b}) + B*(${x - a}) + k*(${x - a})*(${x - b})`, N),
      hint: md`The numerator's degree isn't below the denominator's, so divide first (Algebra 2). The quotient is $k$; the remainder over the denominator is a proper fraction to split as usual.`,
      solution: [
        { math: md`${ptext(N)} = ${k}(${ptext(den)}) + (${ptext(rem)})`, note: md`Divide: the leading coefficients give $k = ${k}$, and the remainder is what's left.` },
        { math: md`\frac{${ptext(N)}}{${fac(a)}${fac(b)}} = ${k} + \frac{${ptext(rem)}}{${fac(a)}${fac(b)}}`, note: md`A proper fraction remains. Decompose it.` },
        { math: md`${ptext(rem)} = A(${minus(b)}) + B(${minus(a)})`, note: md`Clear the denominator.` },
        { math: md`x = ${a}: \; ${at(rem, a)} = A(${a - b}) \Rightarrow A = ${A} \qquad x = ${b}: \; ${at(rem, b)} = B(${b - a}) \Rightarrow B = ${B}`, note: md`Each substitution kills one term.` },
        { math: md`${k} ${A < 0 ? "-" : "+"} \frac{${Math.abs(A)}}{${minus(a)}} ${B < 0 ? "-" : "+"} \frac{${Math.abs(B)}}{${minus(b)}}`, note: md`So $(A, B, k) = (${A}, ${B}, ${k})$.` },
      ],
    };
  }
};

const repeatedFactor: Generator = (r) => {
  for (;;) {
    const a = r.nonzero(-4, 4);
    const A = r.nonzero(-5, 5);
    const B = r.nonzero(-6, 6);
    const kind = r.int(0, 1);
    const fa = [1, -a];
    if (kind === 0) {
      // N = A(x - a) + B over (x - a)^2.
      const N = padd(pscale(fa, A), [B]);
      return {
        prompt: md`Write $\dfrac{${ptext(N)}}{(${minus(a)})^2}$ as $\dfrac{A}{${minus(a)}} + \dfrac{B}{(${minus(a)})^2}$. Give the constants as $(A, B)$.`,
        answer: `(${A}, ${B})`,
        form: "tuple",
        verify: atPoints([a, a + 1], (x) => `A*(${x - a}) + B`, N),
        hint: md`Clear the denominator: $${ptext(N)} = A(${minus(a)}) + B$. Substitute $x = ${a}$ to get $B$, then compare the $x$-coefficients for $A$.`,
        solution: [
          { math: md`${ptext(N)} = A(${minus(a)}) + B`, note: md`Multiply through by $(${minus(a)})^2$. The $A$ piece keeps one factor of $${minus(a)}$.` },
          { math: md`x = ${a}: \quad ${at(N, a)} = B`, note: md`The $A$ term vanishes at $x = ${a}$.` },
          { math: md`A = ${A}`, note: md`Compare $x$-coefficients: the left side has $${poly([[A, "x"]])}$, the right side has $Ax$.` },
          { math: md`\frac{${ptext(N)}}{(${minus(a)})^2} = ${A < 0 ? "-" : ""}\frac{${Math.abs(A)}}{${minus(a)}} ${B < 0 ? "-" : "+"} \frac{${Math.abs(B)}}{(${minus(a)})^2}`, note: md`Check the constants: $A(${-a}) + B = ${-a * A} ${signed(B)} = ${B - a * A}$, matching the numerator. ✓` },
        ],
      };
    }
    let b = r.int(-3, 3);
    while (b === a) b = r.int(-3, 3);
    const C = r.nonzero(-4, 4);
    const fb = [1, -b];
    // N = A(x - a)(x - b) + B(x - b) + C(x - a)^2.
    const N = padd(padd(pscale(pmul(fa, fb), A), pscale(fb, B)), pscale(pmul(fa, fa), C));
    if (N.some((v) => Math.abs(v) > 60)) continue;
    const fbTex = minus(b);
    return {
      prompt: md`Write $\dfrac{${ptext(N)}}{(${minus(a)})^2(${fbTex})}$ as $\dfrac{A}{${minus(a)}} + \dfrac{B}{(${minus(a)})^2} + \dfrac{C}{${fbTex}}$. Give the constants as $(A, B, C)$.`,
      answer: `(${A}, ${B}, ${C})`,
      form: "tuple",
      verify: atPoints([a, b, r.pick([0, 1, -1, 2].filter((x) => x !== a && x !== b))], (x) => `A*(${x - a})*(${x - b}) + B*(${x - b}) + C*(${x - a})^2`, N),
      hint: md`Clear the denominator, then substitute $x = ${a}$ (gives $B$) and $x = ${b}$ (gives $C$). For $A$, compare the $x^2$-coefficients.`,
      solution: [
        { math: md`${ptext(N)} = A(${minus(a)})(${fbTex}) + B(${fbTex}) + C(${minus(a)})^2`, note: md`Multiply both sides by the full denominator. Each piece keeps the factors it was missing.` },
        { math: md`x = ${a}: \quad ${at(N, a)} = B(${a - b}) \;\Rightarrow\; B = ${B}`, note: md`Both terms with a factor $${minus(a)}$ vanish.` },
        { math: md`x = ${b}: \quad ${at(N, b)} = C(${b - a})^2 = ${(b - a) ** 2 === 1 ? "" : (b - a) ** 2}C \;\Rightarrow\; C = ${C}`, note: md`Both terms with a factor $${fbTex}$ vanish.` },
        { math: md`x^2: \quad ${N[0]} = A + C \;\Rightarrow\; A = ${A}`, note: md`No substitution isolates $A$, so compare the $x^2$-coefficients: $A$ from the first term, $C$ from the last.` },
        { math: md`(A, B, C) = (${A}, ${B}, ${C})`, note: md`Check at $x = 0$: $A(${-a})(${-b}) + B(${-b}) + C(${-a})^2 = ${A * a * b} ${signed(-B * b)} ${signed(C * a * a)} = ${at(N, 0)}$. ✓` },
      ],
    };
  }
};

const irreducibleQuadratic: Generator = (r) => {
  for (;;) {
    const a = r.nonzero(-3, 3);
    const c = r.pick([1, 2, 3, 4, 5, 9]);
    const A = r.nonzero(-4, 4);
    const B = r.nonzero(-4, 4);
    const C = r.int(-4, 4);
    // N = A(x^2 + c) + (Bx + C)(x - a).
    const N = padd(pscale([1, 0, c], A), pmul([B, C], [1, -a]));
    if (N.some((v) => Math.abs(v) > 60)) continue;
    const q = `x^2 + ${c}`;
    return {
      prompt: md`Write $\dfrac{${ptext(N)}}{(${minus(a)})(${q})}$ as $\dfrac{A}{${minus(a)}} + \dfrac{Bx + C}{${q}}$. Give the constants as $(A, B, C)$.`,
      answer: `(${A}, ${B}, ${C})`,
      form: "tuple",
      verify: atPoints([a, 0, 1, -1].filter((x, i, xs) => xs.indexOf(x) === i), (x) => `A*(${x * x + c}) + (${x}*B + C)*(${x - a})`, N),
      hint: md`Clear the denominator: $${ptext(N)} = A(${q}) + (Bx + C)(${minus(a)})$. Substitute $x = ${a}$ for $A$, then compare the $x^2$ and constant coefficients.`,
      solution: [
        { math: md`${ptext(N)} = A(${q}) + (Bx + C)(${minus(a)})`, note: md`Multiply through. The quadratic factor can't be split further over the reals, so its numerator needs two constants.` },
        { math: md`x = ${a}: \quad ${at(N, a)} = A(${a * a + c}) \;\Rightarrow\; A = ${A}`, note: md`The $(Bx + C)$ term vanishes at $x = ${a}$.` },
        { math: md`x^2: \quad ${N[0]} = A + B \;\Rightarrow\; B = ${B}`, note: md`Expand the right side: $Ax^2 + ${c === 1 ? "" : c}A + Bx^2 ${term(-a, "Bx")} + Cx ${term(-a, "C")}$. Match the $x^2$ terms.` },
        { math: md`\text{constant}: \quad ${N[2]} = ${c === 1 ? "" : c}A ${term(-a, "C")} = ${c * A} ${term(-a, "C")} \;\Rightarrow\; C = ${C}`, note: md`Match the constant terms: $${c === 1 ? "" : c}A$ from the first piece, $${poly([[-a, "C"]])}$ from the second.` },
        { math: md`(A, B, C) = (${A}, ${B}, ${C})`, note: md`Check the $x$-coefficient: $${poly([[-a, "B"], [1, "C"]])} = ${-a * B} ${signed(C)} = ${N[1]}$, matching the numerator. ✓` },
      ],
    };
  }
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit4: Unit = {
  title: "Systems and Matrices",
  lessons: [
    {
      id: slug("Systems in three variables"),
      title: "Systems in three variables",
      summary: "Three planes and the point they share: elimination in three unknowns, why each step is allowed, and what no solution or infinitely many looks like.",
      blocks: [
        {
          kind: "text",
          body: md`In Algebra 1 you solved systems of two equations in $x$ and $y$. Each equation was a line, and a solution was a point on both lines. Now add a third unknown, $z$. Each equation becomes a flat surface in space, a **plane**, and solving three of them means finding the one point where all three planes meet.

The algebra is the same idea as before, elimination, just applied one more time. The new part is knowing *why* each move is legal, because the same moves run the matrix machinery in the next lesson.`,
        },
        {
          kind: "key",
          title: "Linear equations in three variables",
          body: md`A **linear equation in three variables** has the form $ax + by + cz = d$ with $a, b, c$ not all zero. Its graph is a plane.

A **solution** of a system is an ordered triple $(x, y, z)$ that makes every equation true at once. Geometrically, it's a point lying on all the planes.`,
        },
        {
          kind: "why",
          title: "Why ax + by + cz = d is a plane",
          body: md`Take $3x + 2y + 6z = 12$ and slice it at a fixed height, say $z = k$. What's left is $3x + 2y = 12 - 6k$: a line in that horizontal slice. Change $k$ by 1 and the right side changes by 6, but the left side's coefficients don't change. So the line slides sideways without turning, by the same distance for every unit of height.

Stack those parallel lines, each shifted steadily as you go up, and you get a flat sheet, not a curved one. That's a plane. (The proof below shows the same thing another way: the whole line through any two points of the graph stays on the graph, which is exactly flatness.)`,
        },
        {
          kind: "surface",
          x: [-2, 4],
          y: [-2, 6],
          z: [-2, 5],
          expr: "2 - x/2 - y/3",
          caption: md`The plane $3x + 2y + 6z = 12$, drawn as $z = 2 - \frac{x}{2} - \frac{y}{3}$. Turn it: every slice is a straight line, and it's flat in every direction.`,
        },
        {
          kind: "proof",
          title: "A linear system has 0, 1, or infinitely many solutions",
          given: md`Two different solutions $P = (x_1, y_1, z_1)$ and $Q = (x_2, y_2, z_2)$ of the same linear system`,
          prove: md`Every point $P + t(Q - P) = (x_1 + t(x_2 - x_1),\; y_1 + t(y_2 - y_1),\; z_1 + t(z_2 - z_1))$ is also a solution, for every number $t$`,
          steps: [
            { statement: md`Take any equation $ax + by + cz = d$ of the system. Then $ax_1 + by_1 + cz_1 = d$ and $ax_2 + by_2 + cz_2 = d$.`, reason: "P and Q are solutions." },
            { statement: md`$a(x_2 - x_1) + b(y_2 - y_1) + c(z_2 - z_1) = d - d = 0$`, reason: "Subtract the two equations." },
            { statement: md`$a(x_1 + t(x_2 - x_1)) + b(y_1 + t(y_2 - y_1)) + c(z_1 + t(z_2 - z_1)) = (ax_1 + by_1 + cz_1) + t \cdot 0 = d$`, reason: "Distribute and regroup, then use the two lines above." },
            { statement: md`So $P + t(Q - P)$ satisfies every equation, for every $t$.`, reason: "The equation was any one of them." },
            { statement: md`A system with two solutions has infinitely many: the whole line through $P$ and $Q$.`, reason: md`Different $t$ give different points. So the only possible counts are 0, exactly 1, or infinitely many.` },
          ],
        },
        {
          kind: "text",
          body: md`Now the method. You already know how to solve two equations in two unknowns. So the plan is: use one equation to remove one variable from the other two. That leaves a two-variable system, which you solve as before. Then go back and find the variable you removed.`,
        },
        {
          kind: "why",
          title: "Why you may add a multiple of one equation to another",
          body: md`Suppose $(x, y, z)$ satisfies both $E_1$ and $E_2$. Then both sides of $E_1$ are equal numbers, so $k$ times them are equal, and adding equals to the equal sides of $E_2$ keeps them equal. So the point satisfies $E_2 + kE_1$ too.

The move is also reversible: from $E_1$ and $E_2 + kE_1$, subtracting $kE_1$ gets $E_2$ back. So nothing that satisfied the new pair fails the old one either. The two systems have exactly the same solutions. That is the whole justification for elimination, and it never depends on which equations or which $k$.`,
        },
        {
          kind: "example",
          title: "Elimination in three unknowns",
          problem: md`Solve $x + 2y - z = 3$, $\;2x - y + 3z = 6$, $\;-x + 3y + 2z = 3$.`,
          steps: [
            { math: md`E_2 - 2E_1: \quad -5y + 5z = 0`, note: md`The first equation has $x$ with coefficient 1, so it's the convenient one. Subtract twice it from $E_2$: $(2 - 2)x + (-1 - 4)y + (3 + 2)z = 6 - 6$.` },
            { math: md`E_3 + E_1: \quad 5y + z = 6`, note: md`Add $E_1$ to $E_3$: the $x$ terms cancel again.` },
            { math: md`-5y + 5z = 0 \;\Rightarrow\; y = z`, note: md`Two equations in $y$ and $z$ now. The first says $y = z$.` },
            { math: md`5z + z = 6 \;\Rightarrow\; z = 1, \quad y = 1`, note: md`Substitute $y = z$ into $5y + z = 6$.` },
            { math: md`x + 2(1) - 1 = 3 \;\Rightarrow\; x = 2`, note: md`Back into $E_1$.` },
            { math: md`(x, y, z) = (2, 1, 1)`, note: md`Check in $E_2$: $4 - 1 + 3 = 6$. ✓ And $E_3$: $-2 + 3 + 2 = 3$. ✓` },
          ],
        },
        {
          kind: "key",
          title: "The elimination plan",
          body: md`1. Choose a variable with an easy coefficient (a 1 if you can) in one equation. Use that equation to eliminate the variable from the other two.
2. Solve the two-variable system that remains.
3. Back-substitute into one original equation to get the third variable.
4. Check the triple in **all** the original equations.

Write the answer as an ordered triple $(x, y, z)$, always in that order.`,
        },
        {
          kind: "check",
          prompt: md`Solve the system $x + y + z = 6$, $2y - z = 1$, $z = 3$. Give the answer as $(x, y, z)$.`,
          answer: "(1, 2, 3)",
          form: "tuple",
          explain: md`$z = 3$ is given. Then $2y - 3 = 1$ gives $y = 2$, and $x + 2 + 3 = 6$ gives $x = 1$. Systems like this, already in a staircase shape, are what elimination aims to produce.`,
        },
        {
          kind: "text",
          body: md`Three planes don't have to meet at a single point. Two planes can be parallel (no common point) or the same plane. Three planes can also meet in pairs along three parallel lines, like the three faces of a triangular prism, with no point on all three. Or all three can share a line, like pages of a book sharing the spine, giving infinitely many solutions.

Elimination detects all of this. If a step produces $0 = 0$, one equation was a combination of the others and there are infinitely many solutions (or none, if another step contradicts). If a step produces $0 = 5$ or any false statement, the system has **no solution**.`,
        },
        {
          kind: "diagram",
          view: [-4.5, 4.5, -4, 4.5],
          points: [
            { name: "A", x: -3, y: -3, hidden: true, label: "" },
            { name: "B", x: 3, y: 3, hidden: true, label: "" },
            { name: "C", x: -3, y: 3, hidden: true, label: "" },
            { name: "D", x: 3, y: -3, hidden: true, label: "" },
            { name: "P", x: -4, y: "s", hidden: true, label: "" },
            { name: "Q", x: 4, y: "s", hidden: true, label: "" },
          ],
          segments: [
            { from: "A", to: "B", kind: "line", color: 1 },
            { from: "C", to: "D", kind: "line", color: 2 },
            { from: "P", to: "Q", kind: "line", color: 3 },
          ],
          labels: [
            { x: 3.6, y: 3.6, text: "P_1" },
            { x: -3.6, y: 3.6, text: "P_2" },
            { x: 4.2, y: "s + 0.4", text: "P_3" },
          ],
          params: [{ name: "s", tex: "s", min: -2, max: 2, step: 0.5, value: 1.5 }],
          caption: md`Three planes seen end-on, each drawn as a line. At $s = 0$ they share a line (the point where all three cross): infinitely many solutions. Move $s$ away from 0 and they meet only in pairs, forming a prism: no solution.`,
        },
        {
          kind: "example",
          title: "A system with no solution",
          problem: md`Solve $x + y + z = 1$, $\;x - y + 2z = 2$, $\;2x + 3z = 4$.`,
          steps: [
            { math: md`E_1 + E_2: \quad 2x + 3z = 3`, note: md`Adding removes $y$ at once.` },
            { math: md`E_3: \quad 2x + 3z = 4`, note: md`The third equation has no $y$ already.` },
            { math: md`E_3 - (E_1 + E_2): \quad 0 = 1`, note: md`Subtracting gives a false statement. No triple can make $2x + 3z$ equal to both 3 and 4.` },
            { math: md`\text{no solution}`, note: md`Geometrically: $E_3$'s left side is the sum of the other two left sides, so the three planes are all parallel to one direction and form a prism. The constants don't match, so they never meet in a common point.` },
          ],
        },
        {
          kind: "check",
          prompt: md`While eliminating, you reach the line $0 = 0$, and no other step gives a contradiction. What does that tell you about the system?`,
          choices: ["Infinitely many solutions", "No solution", "Exactly one solution, (0, 0, 0)"],
          accept: ["Infinitely many solutions"],
          explain: md`$0 = 0$ means one equation was a combination of the others and carried no new information. Two independent planes meet in a line, and every point of that line is a solution.`,
        },
        {
          kind: "text",
          body: md`Where do three-variable systems come from? One place is fitting curves. A parabola $y = ax^2 + bx + c$ has three unknown coefficients, so three points pin it down: substitute each point and you get three linear equations in $a$, $b$, $c$. The practice includes these. Subtracting equations removes $c$ immediately, and the rest is the plan above.`,
        },
      ],
      practice: [solveTriangular, solveElimination, fitParabola],
    },
    {
      id: slug("Matrices and row operations"),
      title: "Matrices and row operations",
      summary: "Strip a system down to its numbers: augmented matrices, the three row operations and why each keeps every solution, Gaussian elimination to echelon form, and the unique reduced form.",
      blocks: [
        {
          kind: "text",
          body: md`Look back at the elimination in Lesson 1. Every line copied $x$, $y$, $z$, the plus signs and the equals sign. Only the numbers changed. A **matrix** keeps just the numbers, in a grid, so that elimination becomes arithmetic on rows.`,
        },
        {
          kind: "key",
          title: "Matrices and the augmented matrix",
          body: md`A **matrix** is a rectangular array of numbers. One with $m$ rows and $n$ columns is an $m \times n$ matrix (rows first). The entry in row $i$, column $j$ is written $a_{ij}$.

The **augmented matrix** of a linear system has one row per equation and one column per variable, with the constants in a final column behind a bar:

$$\begin{cases} x + 2y - z = 3 \\ 2x - y + 3z = 6 \\ -x + 3y + 2z = 3 \end{cases} \quad\longleftrightarrow\quad \left[\begin{array}{ccc|c} 1 & 2 & -1 & 3 \\ 2 & -1 & 3 & 6 \\ -1 & 3 & 2 & 3 \end{array}\right]$$

Every variable gets a column even when it's missing from an equation: a missing variable has coefficient 0.`,
        },
        {
          kind: "example",
          title: "Writing the augmented matrix",
          problem: md`Write the augmented matrix of $2x - z = 5$, $\;y + 4z = -1$, $\;x + 3y = 2$.`,
          steps: [
            { math: md`2x + 0y - z = 5, \quad 0x + y + 4z = -1, \quad x + 3y + 0z = 2`, note: "Fill in the missing variables with zero coefficients, in the order x, y, z." },
            { math: md`\left[\begin{array}{ccc|c} 2 & 0 & -1 & 5 \\ 0 & 1 & 4 & -1 \\ 1 & 3 & 0 & 2 \end{array}\right]`, note: "Coefficients left of the bar, constants right of it. The equals signs become the bar." },
          ],
        },
        {
          kind: "key",
          title: "The three elementary row operations",
          body: md`- **Swap** two rows: $R_i \leftrightarrow R_j$.
- **Scale** a row by a nonzero number: $R_i \to kR_i$, $k \ne 0$.
- **Replace** a row by itself plus a multiple of another row: $R_i \to R_i + kR_j$.

These are exactly the moves you make on equations: reorder them, multiply one through by a constant, add a multiple of one to another. The row being added, $R_j$, is only read; it stays where it is.`,
        },
        {
          kind: "why",
          title: "Why row operations never change the solutions",
          body: md`Each operation is one of the legal moves on equations from Lesson 1, and each can be undone by another row operation: swap the rows back, scale by $\frac{1}{k}$ (possible because $k \ne 0$), or replace $R_i$ by $R_i - kR_j$.

Going forward, every solution of the old system satisfies the new one. Going backward does the same in reverse. So the two systems have exactly the same solution set. That's why you're free to reduce a matrix as far as you like: the final, simple matrix describes the same points as the first one.

Notice the condition $k \ne 0$ in scaling. Multiplying a row by 0 turns an equation into $0 = 0$, which every point satisfies. That isn't reversible, and it throws information away.`,
        },
        {
          kind: "proof",
          title: "Row-equivalent systems have the same solutions",
          given: md`System $S'$ is obtained from system $S$ by one elementary row operation`,
          prove: md`$S$ and $S'$ have exactly the same solutions`,
          steps: [
            { statement: md`Every solution of $S$ is a solution of $S'$.`, reason: md`Swap: same equations. Scale: if $L = R$ then $kL = kR$. Replace: if $L_i = R_i$ and $L_j = R_j$ then $L_i + kL_j = R_i + kR_j$.` },
            { statement: md`The reverse move is also an elementary row operation and takes $S'$ back to $S$.`, reason: md`Swap again; scale by $\frac{1}{k}$, which exists since $k \ne 0$; replace $R_i \to R_i - kR_j$.` },
            { statement: md`Every solution of $S'$ is a solution of $S$.`, reason: "Apply the first line to the reverse operation." },
            { statement: md`The two solution sets are equal.`, reason: "Each contains the other." },
            { statement: md`Any chain of row operations preserves the solution set.`, reason: "Apply this result at every step of the chain." },
          ],
        },
        {
          kind: "plot",
          x: [-3, 5],
          y: [-3, 6],
          curves: [
            { expr: "(5 - x)/2", label: "E_1: x + 2y = 5", color: 1 },
            { expr: "3x - 1", label: "E_2: 3x - y = 1", color: 2 },
            { expr: "(1 + 5k - (3 + k)x)/(2k - 1)", label: "E_2 + kE_1", color: 3, dashed: true },
          ],
          points: [{ x: 1, y: 2, label: "(1, 2)", color: 4 }],
          params: [{ name: "k", tex: "k", min: -3, max: 3, step: 1, value: 1 }],
          caption: md`In two variables you can watch the replacement operation. The dashed line is $E_2 + kE_1$ for the current $k$. It turns as $k$ changes, but it always passes through the solution $(1, 2)$, because that point satisfies both equations and therefore every combination of them.`,
        },
        {
          kind: "key",
          title: "Echelon form and reduced row echelon form",
          body: md`The first nonzero entry of a row is its **leading entry** (or pivot). A matrix is in **row echelon form** when:

- rows of all zeros, if any, are at the bottom, and
- each leading entry is to the right of the leading entry in the row above (a staircase).

It is in **reduced row echelon form** (RREF) when, in addition, every leading entry is 1 and is the only nonzero entry in its column.

A system has many echelon forms (scale a row and it's still one), but exactly one reduced form. That's what makes RREF a good final answer: everyone who reduces correctly gets the same matrix.`,
        },
        {
          kind: "example",
          title: "Gaussian elimination",
          problem: md`Reduce $\left[\begin{array}{ccc|c} 1 & 2 & -1 & 3 \\ 2 & -1 & 3 & 6 \\ -1 & 3 & 2 & 3 \end{array}\right]$ to echelon form and solve.`,
          steps: [
            { math: md`\xrightarrow{R_2 \to R_2 - 2R_1} \left[\begin{array}{ccc|c} 1 & 2 & -1 & 3 \\ 0 & -5 & 5 & 0 \\ -1 & 3 & 2 & 3 \end{array}\right]`, note: md`The pivot is the 1 in the top-left. Clear below it: row 2 minus twice row 1 is $[2 - 2,\; -1 - 4,\; 3 + 2 \mid 6 - 6]$.` },
            { math: md`\xrightarrow{R_3 \to R_3 + R_1} \left[\begin{array}{ccc|c} 1 & 2 & -1 & 3 \\ 0 & -5 & 5 & 0 \\ 0 & 5 & 1 & 6 \end{array}\right]`, note: md`Row 3 plus row 1. The first column is done.` },
            { math: md`\xrightarrow{R_3 \to R_3 + R_2} \left[\begin{array}{ccc|c} 1 & 2 & -1 & 3 \\ 0 & -5 & 5 & 0 \\ 0 & 0 & 6 & 6 \end{array}\right]`, note: md`The next pivot is the $-5$. Clear below it: row 3 plus row 2. This is echelon form: a staircase of pivots $1, -5, 6$.` },
            { math: md`6z = 6 \Rightarrow z = 1, \qquad -5y + 5(1) = 0 \Rightarrow y = 1, \qquad x + 2(1) - 1 = 3 \Rightarrow x = 2`, note: md`Back-substitute from the bottom row up. This is the Lesson 1 system, and the same answer: $(2, 1, 1)$.` },
          ],
        },
        {
          kind: "example",
          title: "Continuing to reduced row echelon form",
          problem: md`Reduce the echelon form above to RREF.`,
          steps: [
            { math: md`\xrightarrow{R_2 \to -\frac{1}{5}R_2,\; R_3 \to \frac{1}{6}R_3} \left[\begin{array}{ccc|c} 1 & 2 & -1 & 3 \\ 0 & 1 & -1 & 0 \\ 0 & 0 & 1 & 1 \end{array}\right]`, note: "Make every pivot a 1." },
            { math: md`\xrightarrow{R_2 \to R_2 + R_3,\; R_1 \to R_1 + R_3} \left[\begin{array}{ccc|c} 1 & 2 & 0 & 4 \\ 0 & 1 & 0 & 1 \\ 0 & 0 & 1 & 1 \end{array}\right]`, note: md`Clear the entries **above** the third pivot, working upward.` },
            { math: md`\xrightarrow{R_1 \to R_1 - 2R_2} \left[\begin{array}{ccc|c} 1 & 0 & 0 & 2 \\ 0 & 1 & 0 & 1 \\ 0 & 0 & 1 & 1 \end{array}\right]`, note: md`Clear above the second pivot. Each pivot column is now a single 1. The matrix reads $x = 2$, $y = 1$, $z = 1$ with no back-substitution at all.` },
          ],
        },
        {
          kind: "why",
          title: "Why the process always finishes, and what the odd rows mean",
          body: md`Each stage picks the leftmost column that still has a nonzero entry in the unfinished rows, swaps that entry up if needed, and clears everything below it. The stage uses up one row and moves at least one column to the right. There are finitely many rows and columns, so the stages run out: echelon form is always reached. Clearing upward then gives RREF.

Reading the result:

- A row $[\,0\ 0\ 0 \mid c\,]$ with $c \ne 0$ says $0 = c$. **No solution.**
- A row of all zeros says $0 = 0$: that equation was redundant. If every variable still has a pivot, the solution is unique. If some variable's column has no pivot, that variable is **free**: pick it however you like, and the others follow. **Infinitely many solutions.**
- One pivot per variable and no contradiction: **exactly one solution**, which RREF displays directly.`,
        },
        {
          kind: "check",
          prompt: md`Apply $R_2 \to R_2 - 2R_1$ to $\left[\begin{array}{cc|c} 1 & 3 & 4 \\ 2 & 1 & 3 \end{array}\right]$. Type the result row by row, like [[1, 2, 3], [4, 5, 6]].`,
          answer: "[[1, 3, 4], [0, -5, -5]]",
          form: "matrix",
          explain: md`Row 2 minus twice row 1: $[2 - 2,\; 1 - 6 \mid 3 - 8] = [0,\; -5 \mid -5]$. Row 1 is unchanged.`,
        },
        {
          kind: "check",
          prompt: md`Reduce $\left[\begin{array}{cc|c} 1 & 2 & 5 \\ 3 & 1 & 5 \end{array}\right]$ to reduced row echelon form. Type it row by row.`,
          answer: "[[1, 0, 1], [0, 1, 2]]",
          form: "matrix",
          explain: md`$R_2 \to R_2 - 3R_1$ gives $[0, -5 \mid -10]$; scale by $-\frac{1}{5}$ to get $[0, 1 \mid 2]$. Then $R_1 \to R_1 - 2R_2$ gives $[1, 0 \mid 1]$. So $x = 1$, $y = 2$.`,
        },
      ],
      practice: [rowOperation, reduceToRref, solveFromEchelon],
    },
    {
      id: slug("Determinants and Cramer's rule"),
      title: "Determinants and Cramer's rule",
      summary: "The single number that decides whether a square system has one solution: where ad − bc comes from, Cramer's rule proved, the determinant as an area, and 3×3 determinants by cofactors.",
      blocks: [
        {
          kind: "text",
          body: md`Solve the general two-equation system once and for all, with letters instead of numbers:

$$ax + by = e, \qquad cx + dy = f.$$

Eliminate $y$ by multiplying the first equation by $d$ and the second by $b$, then subtracting. Eliminate $x$ the same way with $c$ and $a$. Both times, the same combination of coefficients appears in front of the unknown: $ad - bc$. That number controls everything.`,
        },
        {
          kind: "why",
          title: "Where ad − bc comes from",
          body: md`$$\begin{aligned} d \cdot (ax + by = e) &\quad\Rightarrow\quad adx + bdy = de \\ b \cdot (cx + dy = f) &\quad\Rightarrow\quad bcx + bdy = bf \end{aligned}$$

Subtract: $(ad - bc)\,x = de - bf$. Likewise, $a$ times the second minus $c$ times the first gives $(ad - bc)\,y = af - ce$.

If $ad - bc \ne 0$, you can divide, and there is exactly one solution. If $ad - bc = 0$, the left sides vanish: then either the right sides are also 0 (infinitely many solutions, the same line twice) or they aren't (no solution, parallel lines). So this one number tells you whether the system has a unique solution, before you solve it.`,
        },
        {
          kind: "key",
          title: "The 2 × 2 determinant",
          body: md`$$\begin{vmatrix} a & b \\ c & d \end{vmatrix} = ad - bc$$

Down-right product minus up-right product. The system $ax + by = e$, $cx + dy = f$ has exactly one solution when this determinant is nonzero.

The determinant is zero exactly when the rows are proportional: $ad = bc$ means $\frac{a}{c} = \frac{b}{d}$ (when $c, d \ne 0$), so one row is a multiple of the other and the two lines have the same slope.`,
        },
        {
          kind: "proof",
          title: "Cramer's rule for two equations",
          given: md`$ax + by = e$ and $cx + dy = f$ with $D = ad - bc \ne 0$`,
          prove: md`$x = \dfrac{D_x}{D}$ and $y = \dfrac{D_y}{D}$, where $D_x = \begin{vmatrix} e & b \\ f & d \end{vmatrix}$ and $D_y = \begin{vmatrix} a & e \\ c & f \end{vmatrix}$`,
          steps: [
            { statement: md`$adx + bdy = de$ and $bcx + bdy = bf$`, reason: md`Multiply the first equation by $d$ and the second by $b$.` },
            { statement: md`$(ad - bc)\,x = de - bf$`, reason: "Subtract the second from the first." },
            { statement: md`$x = \dfrac{de - bf}{ad - bc} = \dfrac{D_x}{D}$`, reason: md`Divide by $D \ne 0$. And $de - bf$ is exactly $\begin{vmatrix} e & b \\ f & d \end{vmatrix}$: the coefficient matrix with the $x$-column replaced by the constants.` },
            { statement: md`$acx + ady = af$ and $acx + bcy = ce$, so $(ad - bc)\,y = af - ce$`, reason: md`Multiply the second equation by $a$, the first by $c$, subtract.` },
            { statement: md`$y = \dfrac{af - ce}{ad - bc} = \dfrac{D_y}{D}$`, reason: md`Divide by $D$. Here $af - ce = \begin{vmatrix} a & e \\ c & f \end{vmatrix}$, the $y$-column replaced by the constants.` },
            { statement: md`These values do satisfy both equations.`, reason: md`Substitute: $a \cdot \frac{D_x}{D} + b \cdot \frac{D_y}{D} = \frac{ade - abf + abf - bce}{D} = \frac{e(ad - bc)}{D} = e$. The second equation checks the same way.` },
          ],
        },
        {
          kind: "key",
          title: "Cramer's rule",
          body: md`For $ax + by = e$, $cx + dy = f$ with $D = \begin{vmatrix} a & b \\ c & d \end{vmatrix} \ne 0$:

$$x = \frac{D_x}{D} = \frac{\begin{vmatrix} e & b \\ f & d \end{vmatrix}}{\begin{vmatrix} a & b \\ c & d \end{vmatrix}}, \qquad y = \frac{D_y}{D} = \frac{\begin{vmatrix} a & e \\ c & f \end{vmatrix}}{\begin{vmatrix} a & b \\ c & d \end{vmatrix}}.$$

To get $D_x$, replace the $x$-column of coefficients with the constants; for $D_y$, replace the $y$-column. The same rule works for three equations with $3 \times 3$ determinants, and in general for $n$ equations in $n$ unknowns.`,
        },
        {
          kind: "example",
          title: "Solving with Cramer's rule",
          problem: md`Solve $2x + 3y = 8$, $\;5x - y = 3$.`,
          steps: [
            { math: md`D = \begin{vmatrix} 2 & 3 \\ 5 & -1 \end{vmatrix} = 2(-1) - 3(5) = -17`, note: md`Nonzero, so there is exactly one solution.` },
            { math: md`D_x = \begin{vmatrix} 8 & 3 \\ 3 & -1 \end{vmatrix} = 8(-1) - 3(3) = -17`, note: md`Constants $8, 3$ replace the $x$-coefficients $2, 5$.` },
            { math: md`D_y = \begin{vmatrix} 2 & 8 \\ 5 & 3 \end{vmatrix} = 2(3) - 8(5) = -34`, note: md`Constants replace the $y$-coefficients $3, -1$.` },
            { math: md`x = \frac{-17}{-17} = 1, \qquad y = \frac{-34}{-17} = 2`, note: md`Check: $2(1) + 3(2) = 8$ ✓ and $5(1) - 2 = 3$ ✓.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the determinant of $\begin{bmatrix} 5 & 2 \\ 3 & 4 \end{bmatrix}$.`,
          answer: "14",
          explain: md`$5 \cdot 4 - 2 \cdot 3 = 20 - 6 = 14$.`,
        },
        {
          kind: "why",
          title: "The determinant is an area",
          body: md`Draw the vectors $\langle a, b \rangle$ and $\langle c, d \rangle$ from the origin and complete the parallelogram. Put it inside the box from $(0, 0)$ to $(a + c, b + d)$, which has area $(a + c)(b + d)$.

Outside the parallelogram but inside the box are two $a \times b$ right triangles (area $ab$ together), two $c \times d$ right triangles (area $cd$ together), and two $c \times b$ rectangles (area $2bc$). Subtract:

$$(a + c)(b + d) - ab - cd - 2bc = ab + ad + bc + cd - ab - cd - 2bc = ad - bc.$$

So the parallelogram's area is $ad - bc$ when the second vector is counterclockwise from the first, and $-(ad - bc)$ otherwise. Either way, **area $= |ad - bc|$**. A zero determinant means the two vectors point along the same line: the parallelogram is squashed flat, which is the proportional-rows case.`,
        },
        {
          kind: "diagram",
          view: [-1, 9, -1, 9],
          grid: true,
          points: [
            { name: "O", x: 0, y: 0, dir: "sw" },
            { name: "P", x: "a", y: "b", label: "(a, b)", dir: "se" },
            { name: "Q", x: "c", y: "d", label: "(c, d)", dir: "nw" },
            { name: "R", x: "a + c", y: "b + d", label: "(a + c, b + d)", dir: "ne" },
            { name: "X", x: "a + c", y: 0, hidden: true, label: "" },
            { name: "Y", x: 0, y: "b + d", hidden: true, label: "" },
          ],
          polygons: [{ points: ["O", "P", "R", "Q"], fill: 1 }],
          segments: [
            { from: "O", to: "P", arrow: true, color: 2 },
            { from: "O", to: "Q", arrow: true, color: 3 },
            { from: "X", to: "R", dashed: true },
            { from: "Y", to: "R", dashed: true },
          ],
          params: [
            { name: "a", tex: "a", min: 1, max: 5, step: 1, value: 4 },
            { name: "b", tex: "b", min: 0, max: 3, step: 1, value: 1 },
            { name: "c", tex: "c", min: 0, max: 3, step: 1, value: 1 },
            { name: "d", tex: "d", min: 1, max: 5, step: 1, value: 3 },
          ],
          readouts: [
            { label: "ad - bc", value: "a d - b c" },
            { label: "(a + c)(b + d)", value: "(a + c)(b + d)" },
          ],
          caption: md`The parallelogram spanned by $\langle a, b \rangle$ and $\langle c, d \rangle$ inside its box. Count grid squares and compare with $ad - bc$. Set $c = 0$ and $b = 0$: a rectangle, area $ad$.`,
        },
        {
          kind: "text",
          body: md`For three equations the coefficient matrix is $3 \times 3$, and there is again a single number that decides uniqueness. It's built from $2 \times 2$ determinants.`,
        },
        {
          kind: "key",
          title: "The 3 × 3 determinant by cofactor expansion",
          body: md`$$\begin{vmatrix} a & b & c \\ d & e & f \\ g & h & i \end{vmatrix} = a \begin{vmatrix} e & f \\ h & i \end{vmatrix} - b \begin{vmatrix} d & f \\ g & i \end{vmatrix} + c \begin{vmatrix} d & e \\ g & h \end{vmatrix}$$

Walk along the first row. Each entry multiplies its **minor**, the $2 \times 2$ determinant left when you delete that entry's row and column. The signs alternate $+\,-\,+$. (You may expand along any row or column, with the checkerboard of signs $\begin{smallmatrix} + & - & + \\ - & + & - \\ + & - & + \end{smallmatrix}$; the answer is the same. Pick the row or column with the most zeros.)`,
        },
        {
          kind: "why",
          title: "Why that formula is the right one",
          body: md`Take the system $ax + by + cz = p$, $dx + ey + fz = q$, $gx + hy + iz = s$ and eliminate $x$ from the last two equations using the first: $d \cdot E_1 - a \cdot E_2$ and $g \cdot E_1 - a \cdot E_3$ give

$$(bd - ae)\,y + (cd - af)\,z = dp - aq, \qquad (bg - ah)\,y + (cg - ai)\,z = gp - as.$$

This is a $2 \times 2$ system in $y$ and $z$, and we know it has a unique solution exactly when its own determinant is nonzero. Multiply that determinant out, $(bd - ae)(cg - ai) - (cd - af)(bg - ah)$, and every term has a factor of $a$. Pulling it out leaves

$$a\,(aei - afh - bdi + bfg + cdh - ceg) = a \cdot \begin{vmatrix} a & b & c \\ d & e & f \\ g & h & i \end{vmatrix}.$$

So (for $a \ne 0$) the $3 \times 3$ system has a unique solution exactly when the $3 \times 3$ determinant is nonzero. The formula isn't arbitrary: it's what elimination produces. Notice its shape: six products, each using one entry from every row and every column, half with a plus sign and half with a minus. The $2 \times 2$ formula has the same shape with two products.`,
        },
        {
          kind: "example",
          title: "A 3 × 3 determinant",
          problem: md`Find $\begin{vmatrix} 2 & 1 & 3 \\ 0 & -1 & 4 \\ 1 & 2 & 5 \end{vmatrix}$.`,
          steps: [
            { math: md`2 \begin{vmatrix} -1 & 4 \\ 2 & 5 \end{vmatrix} - 1 \begin{vmatrix} 0 & 4 \\ 1 & 5 \end{vmatrix} + 3 \begin{vmatrix} 0 & -1 \\ 1 & 2 \end{vmatrix}`, note: "Expand along the first row. Cover each entry's row and column to see its minor." },
            { math: md`2(-5 - 8) - 1(0 - 4) + 3(0 + 1)`, note: md`Each minor is $ad - bc$: $(-1)(5) - (4)(2) = -13$, $(0)(5) - (4)(1) = -4$, $(0)(2) - (-1)(1) = 1$.` },
            { math: md`-26 + 4 + 3 = -19`, note: md`Nonzero, so a system with this coefficient matrix has exactly one solution.` },
          ],
        },
        {
          kind: "text",
          body: md`Cramer's rule extends word for word: for three equations, $x = D_x / D$, $y = D_y / D$, $z = D_z / D$, each $D_\ast$ replacing one column of coefficients with the constants. It takes four $3 \times 3$ determinants, so for actually solving, elimination is usually less work. Cramer's rule earns its place as a formula: it shows the solution depends on the coefficients in a definite, predictable way, and it gives a single variable without finding the others.`,
        },
        {
          kind: "check",
          prompt: md`Solve $x + 2y = 7$, $3x - y = 7$ using Cramer's rule. Give the answer as $(x, y)$.`,
          answer: "(3, 2)",
          form: "tuple",
          explain: md`$D = (1)(-1) - (2)(3) = -7$. $D_x = (7)(-1) - (2)(7) = -21$, so $x = 3$. $D_y = (1)(7) - (7)(3) = -14$, so $y = 2$.`,
        },
      ],
      practice: [det2Practice, det3Practice, cramerPractice],
    },
    {
      id: slug("Partial fractions"),
      title: "Partial fractions",
      summary: "Run fraction addition backwards: split a rational function into simple pieces, see why the split always exists and is unique, and solve for the constants.",
      blocks: [
        {
          kind: "text",
          body: md`Adding fractions is routine:

$$\frac{2}{x - 1} + \frac{3}{x + 2} = \frac{2(x + 2) + 3(x - 1)}{(x - 1)(x + 2)} = \frac{5x + 1}{(x - 1)(x + 2)}.$$

**Partial fractions** is the reverse: start from $\frac{5x + 1}{(x - 1)(x + 2)}$ and recover the simple pieces. The pieces are easier to graph, to integrate (calculus lives on this), and to sum in series (Unit 7). The question is why the pieces always exist, and how to find them quickly.`,
        },
        {
          kind: "key",
          title: "The shape of a partial fraction decomposition",
          body: md`Start with a **proper** rational function: the numerator's degree is less than the denominator's. (If not, divide first; the remainder over the divisor is proper.) Factor the denominator completely over the reals. Then:

- each distinct linear factor $x - a$ contributes $\dfrac{A}{x - a}$;
- a repeated factor $(x - a)^k$ contributes $\dfrac{A_1}{x - a} + \dfrac{A_2}{(x - a)^2} + \cdots + \dfrac{A_k}{(x - a)^k}$;
- each irreducible quadratic $x^2 + px + q$ contributes $\dfrac{Bx + C}{x^2 + px + q}$.

The number of constants always equals the degree of the denominator.`,
        },
        {
          kind: "why",
          title: "Why the split exists for distinct linear factors",
          body: md`Take $\dfrac{N(x)}{(x - a)(x - b)}$ with $a \ne b$ and $\deg N \le 1$. We want constants with

$$N(x) = A(x - b) + B(x - a) \quad \text{for every } x.$$

Both sides are polynomials of degree at most 1. If they agree at two different inputs, they agree everywhere, because their difference would be a polynomial of degree at most 1 with two zeros, and only the zero polynomial does that.

So pick the two inputs that make the equation easiest: $x = a$ kills the $B$ term and forces $A = \frac{N(a)}{a - b}$; $x = b$ kills the $A$ term and forces $B = \frac{N(b)}{b - a}$. Those divisions are fine because $a \ne b$. With these values the two sides match at $a$ and $b$, so they match everywhere. That is both the existence proof and the method.`,
        },
        {
          kind: "proof",
          title: "Existence and uniqueness for two distinct linear factors",
          given: md`$a \ne b$ and a polynomial $N$ with $\deg N \le 1$`,
          prove: md`There are unique constants $A$, $B$ with $\dfrac{N(x)}{(x - a)(x - b)} = \dfrac{A}{x - a} + \dfrac{B}{x - b}$`,
          steps: [
            { statement: md`It's enough to find $A, B$ with $A(x - b) + B(x - a) = N(x)$ for all $x$.`, reason: md`Multiply the wanted identity by $(x - a)(x - b)$; the steps reverse for $x \ne a, b$.` },
            { statement: md`Let $A = \dfrac{N(a)}{a - b}$ and $B = \dfrac{N(b)}{b - a}$.`, reason: md`Defined because $a \ne b$.` },
            { statement: md`$P(x) = A(x - b) + B(x - a) - N(x)$ has $P(a) = 0$ and $P(b) = 0$.`, reason: md`$P(a) = A(a - b) - N(a) = 0$ by the choice of $A$; likewise $P(b) = 0$.` },
            { statement: md`$P$ is the zero polynomial.`, reason: md`$\deg P \le 1$, so $P(x) = mx + k$. If $m \ne 0$ it has exactly one zero, $-k/m$; if $m = 0$ and $k \ne 0$ it has none. Two zeros force $m = k = 0$.` },
            { statement: md`So $A(x - b) + B(x - a) = N(x)$ for every $x$: the decomposition exists.`, reason: md`$P = 0$.` },
            { statement: md`Any $A', B'$ that work must equal these.`, reason: md`The identity must hold at $x = a$ and $x = b$, which forces $A' = \frac{N(a)}{a - b}$ and $B' = \frac{N(b)}{b - a}$.` },
          ],
        },
        {
          kind: "example",
          title: "Distinct linear factors",
          problem: md`Decompose $\dfrac{5x + 1}{(x - 1)(x + 2)}$.`,
          steps: [
            { math: md`\frac{5x + 1}{(x - 1)(x + 2)} = \frac{A}{x - 1} + \frac{B}{x + 2}`, note: md`Two distinct linear factors, so two constants.` },
            { math: md`5x + 1 = A(x + 2) + B(x - 1)`, note: md`Multiply both sides by $(x - 1)(x + 2)$. This is an identity in $x$.` },
            { math: md`x = 1: \quad 6 = 3A \;\Rightarrow\; A = 2`, note: md`Choose $x$ to make the $B$ term vanish.` },
            { math: md`x = -2: \quad -9 = -3B \;\Rightarrow\; B = 3`, note: md`Choose $x$ to make the $A$ term vanish.` },
            { math: md`\frac{5x + 1}{(x - 1)(x + 2)} = \frac{2}{x - 1} + \frac{3}{x + 2}`, note: md`The fractions we started the lesson with. Check the $x$-coefficients: $A + B = 5$. ✓` },
          ],
        },
        {
          kind: "key",
          title: "Two ways to find the constants",
          body: md`After clearing denominators you have a polynomial identity. Either:

- **Substitute** convenient values of $x$. Each root of the denominator makes all but one term vanish and hands you a constant. (Also called the cover-up method.)
- **Compare coefficients** of $x^2$, $x$, and the constant on both sides. That gives a linear system in $A, B, \ldots$, which you solve by elimination or matrices (Lessons 1 and 2).

Mix them freely: substitute to get what you can, then compare coefficients for the rest.`,
        },
        {
          kind: "plot",
          x: [-6, 6],
          y: [-8, 8],
          curves: [
            { expr: "(5x + 1)/((x - 1)(x + 2))", label: "f(x) = \\frac{5x + 1}{(x - 1)(x + 2)}", color: 1 },
            { expr: "2/(x - 1)", label: "\\frac{2}{x - 1}", color: 2, dashed: true },
            { expr: "3/(x + 2)", label: "\\frac{3}{x + 2}", color: 3, dashed: true },
          ],
          vlines: [{ x: 1 }, { x: -2 }],
          caption: md`The solid curve is the sum of the two dashed ones at every $x$. Near $x = 1$ it behaves like $\frac{2}{x - 1}$; near $x = -2$, like $\frac{3}{x + 2}$. The decomposition says which piece is responsible for each asymptote.`,
        },
        {
          kind: "why",
          title: "Why a repeated factor needs every power",
          body: md`Try to write $\dfrac{3x + 7}{(x + 2)^2}$ as just $\dfrac{A}{x + 2}$. Clearing denominators asks for $3x + 7 = A(x + 2)$ for all $x$. Compare coefficients: $A = 3$ from the $x$ terms, but then the constants say $7 = 6$. Impossible. One constant can't match two coefficients.

Use $\dfrac{A}{x + 2} + \dfrac{B}{(x + 2)^2}$ instead: $3x + 7 = A(x + 2) + B$. Now two constants face two coefficients, and the system always solves: $A$ is the $x$-coefficient and $B$ absorbs whatever constant is left. In general a factor $(x - a)^k$ sits under up to $k$ coefficients of numerator, so it needs $k$ constants, one for each power. Fewer wouldn't be enough; more would be redundant.`,
        },
        {
          kind: "example",
          title: "A repeated factor",
          problem: md`Decompose $\dfrac{3x + 7}{(x + 2)^2}$.`,
          steps: [
            { math: md`3x + 7 = A(x + 2) + B`, note: md`Clear the denominator $(x + 2)^2$. The $A$ piece keeps one factor of $x + 2$; the $B$ piece keeps none.` },
            { math: md`x = -2: \quad 1 = B`, note: md`The only root available. It gives $B$.` },
            { math: md`A = 3`, note: md`No substitution isolates $A$, so compare $x$-coefficients: $3 = A$.` },
            { math: md`\frac{3x + 7}{(x + 2)^2} = \frac{3}{x + 2} + \frac{1}{(x + 2)^2}`, note: md`Check the constants: $3(2) + 1 = 7$. ✓` },
          ],
        },
        {
          kind: "why",
          title: "Why an irreducible quadratic takes Bx + C",
          body: md`A factor like $x^2 + 2$ has no real roots, so it can't be split into real linear factors, and a single constant over it isn't enough: a numerator over $x^2 + 2$ can be any polynomial of degree less than 2, which has two coefficients. So the piece is $\dfrac{Bx + C}{x^2 + 2}$.

Count constants in general: a denominator of degree $n$ gets exactly $n$ constants, and a proper numerator has at most $n$ coefficients (degrees $0$ through $n - 1$). Comparing coefficients gives $n$ linear equations in $n$ unknowns. The argument for distinct linear factors showed that system always has exactly one solution; the same is true in the other cases (the proof needs a bit more algebra, but no new ideas). That's why the shape in the key box always works.`,
        },
        {
          kind: "example",
          title: "An irreducible quadratic factor",
          problem: md`Decompose $\dfrac{3x^2 + 2x + 1}{(x - 1)(x^2 + 2)}$.`,
          steps: [
            { math: md`3x^2 + 2x + 1 = A(x^2 + 2) + (Bx + C)(x - 1)`, note: md`The linear factor gets $A$; the quadratic gets $Bx + C$. Three constants for a degree-3 denominator.` },
            { math: md`x = 1: \quad 6 = 3A \;\Rightarrow\; A = 2`, note: md`The only real root. It kills the second term.` },
            { math: md`x^2: \quad 3 = A + B \;\Rightarrow\; B = 1`, note: md`Expand the right side: $Ax^2 + 2A + Bx^2 - Bx + Cx - C$. Match $x^2$ terms.` },
            { math: md`\text{constant}: \quad 1 = 2A - C \;\Rightarrow\; C = 3`, note: md`Match the constant terms. (The $x$ terms give a check: $-B + C = 2$. ✓)` },
            { math: md`\frac{3x^2 + 2x + 1}{(x - 1)(x^2 + 2)} = \frac{2}{x - 1} + \frac{x + 3}{x^2 + 2}`, note: "" },
          ],
        },
        {
          kind: "check",
          prompt: md`Write $\dfrac{7x - 1}{(x - 1)(x + 2)}$ as $\dfrac{A}{x - 1} + \dfrac{B}{x + 2}$. Give the constants as $(A, B)$.`,
          answer: "(2, 5)",
          form: "tuple",
          explain: md`$7x - 1 = A(x + 2) + B(x - 1)$. At $x = 1$: $6 = 3A$, so $A = 2$. At $x = -2$: $-15 = -3B$, so $B = 5$.`,
        },
        {
          kind: "text",
          body: md`If the fraction is **improper** (numerator degree at least the denominator's), divide first, as in Algebra 2. For example $\dfrac{x^2 + 4x + 1}{(x - 1)(x + 2)} = 1 + \dfrac{3x + 3}{(x - 1)(x + 2)}$, and the remaining proper fraction decomposes as usual.

A preview of why this matters for sums: $\dfrac{1}{n(n + 1)} = \dfrac{1}{n} - \dfrac{1}{n + 1}$. Add this from $n = 1$ to $n = 100$ and almost everything cancels in pairs, leaving $1 - \frac{1}{101}$. Unit 7 uses this trick, called telescoping, on purpose.`,
        },
        {
          kind: "check",
          prompt: md`Write $\dfrac{4x - 5}{(x - 1)^2}$ as $\dfrac{A}{x - 1} + \dfrac{B}{(x - 1)^2}$. Give the constants as $(A, B)$.`,
          answer: "(4, -1)",
          form: "tuple",
          explain: md`$4x - 5 = A(x - 1) + B$. At $x = 1$: $-1 = B$. Comparing $x$-coefficients: $A = 4$.`,
        },
      ],
      practice: [distinctLinear, repeatedFactor, irreducibleQuadratic],
    },
  ],
};
