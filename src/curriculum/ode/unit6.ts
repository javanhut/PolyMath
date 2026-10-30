import { frac, fracTex, paren, poly } from "../../math/random";
import { md, slug, type Generator, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A coefficient written in front of a symbol: 1 and -1 hide, others show. */
const coefTex = (c: number) => (c === 1 ? "" : c === -1 ? "-" : String(c));

/** A middle term " + 3x y'" or " - y", or "" when the coefficient is 0. */
function term(c: number, body: string): string {
  if (c === 0) return "";
  const mag = Math.abs(c) === 1 ? body : `${Math.abs(c)}${body}`;
  return c < 0 ? ` - ${mag}` : ` + ${mag}`;
}

/** Leading term "3x y'" or "-y" (never "+"). */
function lead(c: number, body: string): string {
  const mag = Math.abs(c) === 1 ? body : `${Math.abs(c)}${body}`;
  return c < 0 ? `-${mag}` : mag;
}

/** The factor (x - c) in LaTeX or answer syntax: x, (x - 2), (x + 3). */
const factorOf = (c: number) => (c === 0 ? "x" : c > 0 ? `(x - ${c})` : `(x + ${-c})`);

/** 1 when the slider N is at least k and 0 below it (N takes integer values); the plot parser has no step function, so abs does the job. */
const onFrom = (k: number) => `(1 + (N - ${k - 0.5})/abs(N - ${k - 0.5}))/2`;

/** The partial sum of the listed terms, keeping the first N + 1 of them. */
const partialSum = (terms: string[]) => terms.map((t, k) => (k === 0 ? `(${t})` : `${onFrom(k)}*(${t})`)).join(" + ");

function factorial(n: number): number {
  let f = 1;
  for (let k = 2; k <= n; k++) f *= k;
  return f;
}

/** Terms of the cosine series, (-1)^k x^(2k)/(2k)!. */
const cosTerms = Array.from({ length: 9 }, (_, k) => `${k % 2 ? "-" : ""}${k === 0 ? "1" : `x^${2 * k}/${factorial(2 * k)}`}`);

/** Terms of the first Airy solution y_1 = 1 + x^3/6 + x^6/180 + ...: a_{3k} = a_{3k-3} / ((3k)(3k - 1)). */
const airyTerms = (() => {
  const out = ["1"];
  let den = 1;
  for (let k = 1; k <= 10; k++) {
    den *= 3 * k * (3 * k - 1);
    out.push(`x^${3 * k}/${den}`);
  }
  return out;
})();

/** sqrt(n) in simplest answer syntax: sqrt(8) -> 2sqrt(2), sqrt(9) -> 3. */
function sqrtText(n: number): string {
  let k = 1;
  for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) k = d;
  const inner = n / (k * k);
  if (inner === 1) return String(k);
  return `${k === 1 ? "" : k}sqrt(${inner})`;
}

function sqrtTex(n: number): string {
  let k = 1;
  for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) k = d;
  const inner = n / (k * k);
  if (inner === 1) return String(k);
  return `${k === 1 ? "" : k}\\sqrt{${inner}}`;
}

// ── Practice generators: power series solutions ────────────────────────────

const firstOrderCoefficients: Generator = (r) => {
  const kind = r.int(0, 2);
  const a0 = r.pick([1, 2, 3, 4, -1, -2]);
  const tupleHint = "Give them as a tuple of exact values, like (2, 1/2, 1/6).";
  if (kind === 0) {
    const k = r.pick([2, 3, 4, -2, -3]);
    // a_{n+1} = k a_n / (n + 1)
    const a1 = k * a0;
    const [a2n, a2d] = [k * k * a0, 2];
    const [a3n, a3d] = [k ** 3 * a0, 6];
    return {
      prompt: md`A power series solution $y = \sum_{n=0}^{\infty} a_n x^n$ of $y' = ${coefTex(k)}y$ has $a_0 = ${a0}$. Find $a_1$, $a_2$ and $a_3$. ${tupleHint}`,
      answer: `(${a1}, ${frac(a2n, a2d)}, ${frac(a3n, a3d)})`,
      form: "tuple",
      verify: [`(a - (${k})*(${a0}))^2 + (2b - (${k}) a)^2 + (3c - (${k}) b)^2 = 0`],
      hint: md`Write $y' = \sum (n+1) a_{n+1} x^n$ and match the coefficient of $x^n$ on each side: $(n+1) a_{n+1} = ${k} a_n$.`,
      solution: [
        { math: md`y' = \sum_{n=1}^{\infty} n a_n x^{n-1} = \sum_{n=0}^{\infty} (n+1) a_{n+1} x^n`, note: "Differentiate term by term, then shift the index so the power is $x^n$." },
        { math: md`(n+1) a_{n+1} = ${k} a_n \quad\Rightarrow\quad a_{n+1} = \frac{${k} a_n}{n+1}`, note: md`The coefficient of $x^n$ in $y'$ must equal the coefficient of $x^n$ in $${coefTex(k)}y$.` },
        { math: md`a_1 = ${k} a_0 = ${a1}`, note: md`$n = 0$.` },
        { math: md`a_2 = \frac{${k} a_1}{2} = ${fracTex(a2n, a2d)}`, note: md`$n = 1$.` },
        { math: md`a_3 = \frac{${k} a_2}{3} = ${fracTex(a3n, a3d)}`, note: md`$n = 2$. In general $a_n = \frac{${a0} \cdot ${paren(k)}^n}{n!}$, so $y = ${a0 === 1 ? "" : a0}e^{${coefTex(k)}x}$.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.pick([2, 3, 4, -2, -4, 6]);
    // y' = k x y: (n+1) a_{n+1} = k a_{n-1}; the odd coefficients vanish.
    const a2 = frac(k * a0, 2);
    const a4 = frac(k * k * a0, 8);
    const a6 = frac(k ** 3 * a0, 48);
    return {
      prompt: md`A power series solution $y = \sum_{n=0}^{\infty} a_n x^n$ of $y' = ${coefTex(k)}xy$ has $a_0 = ${a0}$. The odd coefficients all turn out to be 0. Find $a_2$, $a_4$ and $a_6$. ${tupleHint}`,
      answer: `(${a2}, ${a4}, ${a6})`,
      form: "tuple",
      verify: [`(2a - (${k})*(${a0}))^2 + (4b - (${k}) a)^2 + (6c - (${k}) b)^2 = 0`],
      hint: md`$xy = \sum a_n x^{n+1} = \sum_{n \ge 1} a_{n-1} x^n$. Matching with $y' = \sum (n+1) a_{n+1} x^n$ gives $(n+1) a_{n+1} = ${k} a_{n-1}$.`,
      solution: [
        { math: md`y' = \sum_{n=0}^{\infty} (n+1) a_{n+1} x^n, \qquad ${coefTex(k)}xy = \sum_{n=1}^{\infty} ${k} a_{n-1} x^n`, note: md`Multiplying by $x$ raises every power by one; rename the index so the power is $x^n$ again.` },
        { math: md`a_1 = 0, \qquad (n+1) a_{n+1} = ${k} a_{n-1} \;\; (n \ge 1)`, note: md`The $x^0$ term on the right is missing, so $a_1 = 0$. Each coefficient reaches back two places, so $a_3 = a_5 = \cdots = 0$ as well.` },
        { math: md`a_2 = \frac{${k} a_0}{2} = ${fracTex(k * a0, 2)}`, note: md`$n = 1$.` },
        { math: md`a_4 = \frac{${k} a_2}{4} = ${fracTex(k * k * a0, 8)}`, note: md`$n = 3$.` },
        { math: md`a_6 = \frac{${k} a_4}{6} = ${fracTex(k ** 3 * a0, 48)}`, note: md`$n = 5$. The pattern is $a_{2m} = \frac{${a0}}{m!}\left(\frac{${k}}{2}\right)^m$, the series of $${a0 === 1 ? "" : a0}e^{${fracTex(k, 2)} x^2}$.` },
      ],
    };
  }
  const k = r.pick([2, 3, 4, 6, -2, -4]);
  // y' = y + k x: (n+1) a_{n+1} = a_n + k [n = 1]
  const a1 = a0;
  const a2 = frac(a0 + k, 2);
  const a3 = frac(a0 + k, 6);
  return {
    prompt: md`A power series solution $y = \sum_{n=0}^{\infty} a_n x^n$ of $y' = y ${k < 0 ? "-" : "+"} ${Math.abs(k)}x$ has $a_0 = ${a0}$. Find $a_1$, $a_2$ and $a_3$. ${tupleHint}`,
    answer: `(${a1}, ${a2}, ${a3})`,
    form: "tuple",
    verify: [`(a - (${a0}))^2 + (2b - a - (${k}))^2 + (3c - b)^2 = 0`],
    hint: md`The right side is $\sum a_n x^n$ plus one extra term, $${k}x$. It only changes the matching for $x^1$.`,
    solution: [
      { math: md`\sum_{n=0}^{\infty} (n+1) a_{n+1} x^n = \sum_{n=0}^{\infty} a_n x^n ${k < 0 ? "-" : "+"} ${Math.abs(k)}x`, note: "Both sides as series in $x^n$." },
      { math: md`x^0:\; a_1 = a_0 = ${a1}`, note: md`No extra term at $x^0$.` },
      { math: md`x^1:\; 2a_2 = a_1 ${k < 0 ? "-" : "+"} ${Math.abs(k)} \quad\Rightarrow\quad a_2 = ${fracTex(a0 + k, 2)}`, note: md`The $${k}x$ joins in here.` },
      { math: md`x^2:\; 3a_3 = a_2 \quad\Rightarrow\quad a_3 = ${fracTex(a0 + k, 6)}`, note: md`From here on $(n+1) a_{n+1} = a_n$ again.` },
    ],
  };
};

const secondOrderCoefficients: Generator = (r) => {
  const kind = r.int(0, 2);
  const a0 = r.pick([1, 2, 3, -1, -2, 4]);
  const a1 = r.pick([1, 2, 3, -1, -3, 0]);
  const tupleHint = "Give them as a tuple of exact values, like (-1, 1/3, 0).";
  const series = md`y = \sum_{n=0}^{\infty} a_n x^n`;
  if (kind === 0) {
    const p = r.int(-3, 3);
    const q = r.nonzero(-4, 4);
    // y'' + p x y' + q y = 0: (n+2)(n+1) a_{n+2} + (p n + q) a_n = 0
    const eq = `y''${term(p, "x y'")}${term(q, "y")} = 0`;
    const a2 = frac(-q * a0, 2);
    const a3 = frac(-(p + q) * a1, 6);
    const a4 = frac((2 * p + q) * q * a0, 24);
    const pnq = poly([[p, "n"], [q, ""]]);
    return {
      prompt: md`The equation $${eq}$ has a power series solution $${series}$ with $a_0 = ${a0}$ and $a_1 = ${a1}$. Find $a_2$, $a_3$ and $a_4$. ${tupleHint}`,
      answer: `(${a2}, ${a3}, ${a4})`,
      form: "tuple",
      verify: [`(2a + (${q})*(${a0}))^2 + (6b + (${p + q})*(${a1}))^2 + (12c + (${2 * p + q}) a)^2 = 0`],
      hint: md`Shift $y''$ to $\sum (n+2)(n+1) a_{n+2} x^n$. ${p ? md`Note $x y' = \sum n a_n x^n$ needs no shift.` : ""} The coefficient of $x^n$ gives $(n+2)(n+1) a_{n+2} = -(${pnq}) a_n$.`,
      solution: [
        {
          math: md`y'' = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n${p ? md`, \qquad x y' = \sum_{n=0}^{\infty} n a_n x^n` : ""}, \qquad y = \sum_{n=0}^{\infty} a_n x^n`,
          note: md`Every sum written with the power $x^n$.${p ? " Multiplying $y'$ by $x$ puts the power back to $x^n$, so that sum needs no shift." : ""}`,
        },
        { math: md`(n+2)(n+1) a_{n+2} + (${pnq}) a_n = 0`, note: md`The coefficient of $x^n$ must be 0 for every $n$.` },
        { math: md`a_{n+2} = -\frac{(${pnq}) a_n}{(n+2)(n+1)}`, note: "The recurrence. Each coefficient reaches back two places." },
        { math: md`n = 0:\; a_2 = -\frac{${q} a_0}{2} = ${fracTex(-q * a0, 2)}`, note: "" },
        { math: md`n = 1:\; a_3 = -\frac{${p + q} a_1}{6} = ${fracTex(-(p + q) * a1, 6)}`, note: "" },
        { math: md`n = 2:\; a_4 = -\frac{${2 * p + q} a_2}{12} = ${fracTex((2 * p + q) * q * a0, 24)}`, note: md`Use the $a_2$ just found.` },
      ],
    };
  }
  if (kind === 1) {
    const k = r.pick([1, 2, 3, -1, -2, 6]);
    // y'' = k x y: 2 a_2 = 0, (n+2)(n+1) a_{n+2} = k a_{n-1}
    const a3 = frac(k * a0, 6);
    const a4 = frac(k * a1, 12);
    return {
      prompt: md`The equation $y'' = ${coefTex(k)}xy$ has a power series solution $${series}$ with $a_0 = ${a0}$ and $a_1 = ${a1}$. Find $a_2$, $a_3$ and $a_4$. ${tupleHint}`,
      answer: `(0, ${a3}, ${a4})`,
      form: "tuple",
      verify: [`(2a)^2 + (6b - (${k})*(${a0}))^2 + (12c - (${k})*(${a1}))^2 = 0`],
      hint: md`$xy = \sum a_{n-1} x^n$ starts at $n = 1$, so the $x^0$ equation reads $2a_2 = 0$. For $n \ge 1$, $(n+2)(n+1) a_{n+2} = ${k} a_{n-1}$.`,
      solution: [
        { math: md`y'' = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n, \qquad ${coefTex(k)}xy = \sum_{n=1}^{\infty} ${k} a_{n-1} x^n`, note: md`Multiplying by $x$ raises each power, so the right side has no $x^0$ term.` },
        { math: md`x^0:\; 2a_2 = 0 \quad\Rightarrow\quad a_2 = 0`, note: "Nothing on the right to match." },
        { math: md`x^n\;(n \ge 1):\; (n+2)(n+1) a_{n+2} = ${k} a_{n-1}`, note: "The recurrence reaches back three places." },
        { math: md`n = 1:\; 6a_3 = ${k} a_0 \quad\Rightarrow\quad a_3 = ${fracTex(k * a0, 6)}`, note: "" },
        { math: md`n = 2:\; 12a_4 = ${k} a_1 \quad\Rightarrow\quad a_4 = ${fracTex(k * a1, 12)}`, note: "" },
        { math: md`(a_2, a_3, a_4) = (0, ${fracTex(k * a0, 6)}, ${fracTex(k * a1, 12)})`, note: md`$a_5 = \frac{${k} a_2}{20} = 0$ next, and every third coefficient after $a_2$ is 0 too.` },
      ],
    };
  }
  const k = r.pick([1, 2, 3, -1, -3, 4]);
  // y'' + k x^2 y = 0: a_2 = a_3 = 0, (n+2)(n+1) a_{n+2} = -k a_{n-2}
  const a4 = frac(-k * a0, 12);
  const a5 = frac(-k * a1, 20);
  return {
    prompt: md`The equation $y''${term(k, "x^2 y")} = 0$ has a power series solution $${series}$ with $a_0 = ${a0}$ and $a_1 = ${a1}$. Find $a_3$, $a_4$ and $a_5$. ${tupleHint}`,
    answer: `(0, ${a4}, ${a5})`,
    form: "tuple",
    verify: [`(6a)^2 + (12b + (${k})*(${a0}))^2 + (20c + (${k})*(${a1}))^2 = 0`],
    hint: md`$x^2 y = \sum a_{n-2} x^n$ starts at $n = 2$. So $a_2 = a_3 = 0$, and for $n \ge 2$, $(n+2)(n+1) a_{n+2} = ${-k} a_{n-2}$.`,
    solution: [
      { math: md`y'' = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n, \qquad ${coefTex(k)}x^2 y = \sum_{n=2}^{\infty} ${k} a_{n-2} x^n`, note: md`Multiplying by $x^2$ raises each power by two.` },
      { math: md`x^0:\; 2a_2 = 0, \qquad x^1:\; 6a_3 = 0`, note: md`Nothing to match for $n = 0, 1$, so $a_2 = a_3 = 0$.` },
      { math: md`x^n\;(n \ge 2):\; (n+2)(n+1) a_{n+2} = ${-k} a_{n-2}`, note: "The recurrence reaches back four places." },
      { math: md`n = 2:\; 12a_4 = ${-k} a_0 \quad\Rightarrow\quad a_4 = ${fracTex(-k * a0, 12)}`, note: "" },
      { math: md`n = 3:\; 20a_5 = ${-k} a_1 \quad\Rightarrow\quad a_5 = ${fracTex(-k * a1, 20)}`, note: "" },
    ],
  };
};

const recognizeSeries: Generator = (r) => {
  const kind = r.int(0, 4);
  const A = r.pick([1, 2, 3, 4]);
  const k = r.pick([2, 3, 4]);
  const format = "Type it as a function of $x$, like 5e^(7x) or 5cos(7x).";
  const Atex = A === 1 ? "" : String(A);
  if (kind === 0) {
    // y' = k y, y(0) = A: a_n = A k^n / n!
    const terms = [A, A * k, frac(A * k * k, 2), frac(A * k ** 3, 6)];
    return {
      prompt: md`Solving $y' = ${k}y$, $y(0) = ${A}$ by power series gives $a_{n+1} = \frac{${k} a_n}{n+1}$, so $a_n = \frac{${Atex === "" ? "" : `${A} \\cdot `}${k}^n}{n!}$ and

$$y = ${terms[0]} + ${terms[1]}x + ${fracTex(A * k * k, 2)}x^2 + ${fracTex(A * k ** 3, 6)}x^3 + \cdots$$

Which elementary function is this? ${format}`,
      answer: `${A} e^(${k}x)`,
      hint: md`Compare with $e^u = \sum \frac{u^n}{n!}$. What is $u$ here?`,
      solution: [
        { math: md`y = ${Atex}\sum_{n=0}^{\infty} \frac{(${k}x)^n}{n!}`, note: md`$${k}^n x^n = (${k}x)^n$.` },
        { math: md`y = ${Atex}e^{${k}x}`, note: md`The exponential series with $u = ${k}x$. Check: $y' = ${A * k}e^{${k}x} = ${k}y$ and $y(0) = ${A}$.` },
      ],
    };
  }
  if (kind === 1) {
    // y'' + k^2 y = 0, y(0) = A, y'(0) = 0: A cos(kx)
    const k2 = k * k;
    return {
      prompt: md`Solving $y'' + ${k2}y = 0$, $y(0) = ${A}$, $y'(0) = 0$ by power series gives $a_{n+2} = -\frac{${k2} a_n}{(n+2)(n+1)}$, so the odd coefficients vanish and

$$y = ${A} - ${fracTex(A * k2, 2)}x^2 + ${fracTex(A * k2 * k2, 24)}x^4 - ${fracTex(A * k2 ** 3, 720)}x^6 + \cdots$$

Which elementary function is this? ${format}`,
      answer: `${A} cos(${k}x)`,
      hint: md`Only even powers, alternating signs, factorials of even numbers underneath. Which series from Calculus 2 looks like that? The constant $${k2} = ${k}^2$ is a hint about the argument.`,
      solution: [
        { math: md`a_{2m} = ${Atex}\frac{(-1)^m ${k2}^m}{(2m)!} = ${Atex}\frac{(-1)^m ${k}^{2m}}{(2m)!}`, note: md`Each step multiplies by $-${k2}$ and divides by the next two integers, which builds $(2m)!$.` },
        { math: md`y = ${Atex}\sum_{m=0}^{\infty} \frac{(-1)^m (${k}x)^{2m}}{(2m)!} = ${Atex}\cos(${k}x)`, note: md`The cosine series with argument $${k}x$. Check: $y'' = -${A * k2}\cos(${k}x) = -${k2}y$, $y(0) = ${A}$, $y'(0) = 0$.` },
      ],
    };
  }
  if (kind === 2) {
    // y'' + k^2 y = 0, y(0) = 0, y'(0) = B: (B/k) sin(kx); choose B = A k so the amplitude is A
    const k2 = k * k;
    const B = A * k;
    return {
      prompt: md`Solving $y'' + ${k2}y = 0$, $y(0) = 0$, $y'(0) = ${B}$ by power series gives $a_{n+2} = -\frac{${k2} a_n}{(n+2)(n+1)}$, so the even coefficients vanish and

$$y = ${B}x - ${fracTex(B * k2, 6)}x^3 + ${fracTex(B * k2 * k2, 120)}x^5 - \cdots$$

Which elementary function is this? ${format}`,
      answer: `${A} sin(${k}x)`,
      hint: md`Odd powers only, alternating signs, odd factorials underneath: the sine series. Pull the argument $${k}x$ together and see what constant is left in front.`,
      solution: [
        { math: md`a_{2m+1} = ${B}\frac{(-1)^m ${k2}^m}{(2m+1)!} = ${Atex}\frac{(-1)^m ${k}^{2m+1}}{(2m+1)!}`, note: md`Write $${B} \cdot ${k}^{2m} = ${A} \cdot ${k}^{2m+1}$ so the power of $${k}$ matches the power of $x$.` },
        { math: md`y = ${Atex}\sum_{m=0}^{\infty} \frac{(-1)^m (${k}x)^{2m+1}}{(2m+1)!} = ${Atex}\sin(${k}x)`, note: md`Check: $y'(0) = ${A} \cdot ${k} = ${B}$.` },
      ],
    };
  }
  if (kind === 3) {
    // y' = k x y, y(0) = A: A e^(k x^2 / 2)
    const h = fracTex(k, 2);
    return {
      prompt: md`Solving $y' = ${k}xy$, $y(0) = ${A}$ by power series gives $a_{n+1} = \frac{${k} a_{n-1}}{n+1}$, so the odd coefficients vanish and

$$y = ${A} + ${fracTex(A * k, 2)}x^2 + ${fracTex(A * k * k, 8)}x^4 + ${fracTex(A * k ** 3, 48)}x^6 + \cdots$$

Which elementary function is this? ${format}`,
      answer: `${A} e^(${frac(k, 2)} x^2)`,
      hint: md`Look at the coefficients as $${A}\cdot\frac{c^m}{m!}$ for some constant $c$: $\frac{c}{1}, \frac{c^2}{2}, \frac{c^3}{6}$. Then the series is $${Atex}e^{c x^2}$.`,
      solution: [
        { math: md`a_{2m} = \frac{${A}}{m!}\left(${h}\right)^m`, note: md`$a_2 = ${A}\cdot${h}$, $a_4 = \frac{${A}}{2}\left(${h}\right)^2$, $a_6 = \frac{${A}}{6}\left(${h}\right)^3$.` },
        { math: md`y = ${Atex}\sum_{m=0}^{\infty} \frac{\left(${h}x^2\right)^m}{m!} = ${Atex}e^{${h}x^2}`, note: md`The exponential series with $u = ${h}x^2$. Check: $y' = ${k}x \cdot ${Atex}e^{${h}x^2} = ${k}xy$.` },
      ],
    };
  }
  // (1 - k x) y' = k y, y(0) = A: A / (1 - k x), a_n = A k^n
  return {
    prompt: md`Solving $(1 - ${k}x)y' = ${k}y$, $y(0) = ${A}$ by power series gives $a_{n+1} = ${k} a_n$, so

$$y = ${A} + ${A * k}x + ${A * k * k}x^2 + ${A * k ** 3}x^3 + \cdots$$

Which elementary function is this? ${format}`,
    answer: `${A}/(1 - ${k}x)`,
    hint: md`No factorials this time. A ratio of $${k}$ between consecutive terms is a geometric series.`,
    solution: [
      { math: md`y = ${Atex}\sum_{n=0}^{\infty} (${k}x)^n`, note: md`$a_n = ${A} \cdot ${k}^n$.` },
      { math: md`y = \frac{${A}}{1 - ${k}x}, \qquad |x| < \frac{1}{${k}}`, note: md`The geometric series with ratio $${k}x$. The radius of convergence is $\frac{1}{${k}}$, exactly the distance to the point where the coefficient $1 - ${k}x$ vanishes. That is the subject of the next lesson.` },
    ],
  };
};

// ── Practice generators: ordinary and singular points ──────────────────────

interface Poly {
  coef: number;
  /** Factors (x - root)^mult. */
  factors: { root: number; mult: number }[];
}

function polyTex(p: Poly): string {
  const body = p.factors.map((f) => `${factorOf(f.root)}${f.mult > 1 ? `^${f.mult}` : ""}`).join("");
  if (!body) return String(p.coef);
  return `${coefTex(p.coef)}${body}`;
}

function orderAt(p: Poly, x0: number): number {
  return p.factors.find((f) => f.root === x0)?.mult ?? 0;
}

const CLASSES = ["ordinary point", "regular singular point", "irregular singular point"];

const classifyPoint: Generator = (r) => {
  const shape = r.int(0, 3);
  let P: Poly;
  let Q: Poly;
  let R: Poly;
  let x0: number;
  if (shape === 0) {
    // x^m y'' + b x^j y' + d y = 0 at x = 0
    const m = r.int(1, 3);
    const j = r.int(0, 2);
    P = { coef: 1, factors: [{ root: 0, mult: m }] };
    Q = { coef: r.nonzero(-4, 4), factors: j ? [{ root: 0, mult: j }] : [] };
    R = { coef: r.nonzero(-5, 5), factors: [] };
    x0 = 0;
  } else if (shape === 1) {
    // (x - c)^m y'' + b y' + d x y = 0 at x = c, or at another point
    const c = r.nonzero(-3, 3);
    const m = r.int(1, 2);
    P = { coef: 1, factors: [{ root: c, mult: m }] };
    Q = { coef: r.nonzero(-4, 4), factors: [] };
    R = { coef: r.nonzero(-3, 3), factors: [{ root: 0, mult: 1 }] };
    x0 = r.next() < 0.7 ? c : r.pick([0, -c].filter((v) => v !== c));
  } else if (shape === 2) {
    // x^m (x - c) y'' + b x y' + d y = 0 at 0 or c
    const c = r.nonzero(-3, 3);
    const m = r.int(1, 3);
    P = { coef: 1, factors: [{ root: 0, mult: m }, { root: c, mult: 1 }] };
    Q = { coef: r.nonzero(-3, 3), factors: [{ root: 0, mult: 1 }] };
    R = { coef: r.nonzero(-4, 4), factors: [] };
    x0 = r.next() < 0.6 ? 0 : c;
  } else {
    // (x - c)^2 y'' + b (x - c) y' + d y = 0 at c (Euler shifted: regular) or at another point (ordinary)
    const c = r.int(-3, 3);
    P = { coef: 1, factors: [{ root: c, mult: 2 }] };
    Q = { coef: r.nonzero(-4, 4), factors: [{ root: c, mult: 1 }] };
    R = { coef: r.nonzero(-5, 5), factors: [] };
    x0 = r.next() < 0.6 ? c : r.pick([c + 1, c - 1, c + 2]);
  }
  const eq = `${polyTex(P)}y''${Q.coef < 0 ? " - " : " + "}${polyTex({ ...Q, coef: Math.abs(Q.coef) })}y'${R.coef < 0 ? " - " : " + "}${polyTex({ ...R, coef: Math.abs(R.coef) })}y = 0`;
  const [oP, oQ, oR] = [orderAt(P, x0), orderAt(Q, x0), orderAt(R, x0)];
  const cls = oP === 0 ? 0 : oQ - oP >= -1 && oR - oP >= -2 ? 1 : 2;
  const f = factorOf(x0);
  const pow = (e: number) => (e === 0 ? "" : e === 1 ? f : `${f}^{${e}}`);
  const behaves = (e: number, what: string) => (e >= 0 ? `${what} stays finite as $x \\to ${x0}$ (it behaves like $${pow(e) || "1"}$).` : `${what} behaves like $\\frac{1}{${pow(-e)}}$, which blows up as $x \\to ${x0}$.`);
  const solution =
    cls === 0
      ? [
          { math: md`P(${x0}) = ${polyTex(P)}\Big|_{x = ${x0}} \ne 0`, note: md`The coefficient of $y''$ doesn't vanish at $x = ${x0}$.` },
          { math: md`p(x) = \frac{${polyTex(Q)}}{${polyTex(P)}}, \qquad q(x) = \frac{${polyTex(R)}}{${polyTex(P)}}`, note: md`Both are quotients of polynomials with a nonzero denominator at $x = ${x0}$, so both are analytic there. **Ordinary point.**` },
        ]
      : [
          { math: md`P(${x0}) = 0`, note: md`The coefficient of $y''$ vanishes at $x = ${x0}$, so it is a singular point. Now decide which kind.` },
          { math: md`p(x) = \frac{${polyTex(Q)}}{${polyTex(P)}}, \qquad q(x) = \frac{${polyTex(R)}}{${polyTex(P)}}`, note: md`Near $x = ${x0}$, count factors of $${f}$: $p$ has $${oQ} - ${oP} = ${oQ - oP}$ net and $q$ has $${oR} - ${oP} = ${oR - oP}$ net.` },
          { math: md`${f}\,p(x) \sim ${pow(oQ - oP + 1) || "\\text{const}"}, \qquad ${f}^2\,q(x) \sim ${pow(oR - oP + 2) || "\\text{const}"}`, note: md`${behaves(oQ - oP + 1, `$${f}\\,p(x)$`)} ${behaves(oR - oP + 2, `$${f}^2\\,q(x)$`)}` },
          {
            math: md`x = ${x0}\text{ is a${cls === 1 ? " regular" : "n irregular"} singular point}`,
            note: cls === 1 ? "Both limits are finite, so the singularity is no worse than an Euler equation's. **Regular.**" : "At least one limit fails, so the equation is worse than any Euler equation near this point. **Irregular.**",
          },
        ];
  return {
    prompt: md`Classify the point $x = ${x0}$ for the equation $${eq}$.`,
    choices: CLASSES,
    accept: [CLASSES[cls]!],
    hint: md`First ask whether the coefficient of $y''$ is zero at $x = ${x0}$. If it is, divide through to get $p = Q/P$ and $q = R/P$ and test whether $${f}\,p(x)$ and $${f}^2\,q(x)$ stay finite as $x \to ${x0}$.`,
    solution,
  };
};

const singularPointsSet: Generator = (r) => {
  const kind = r.int(0, 4);
  let Ptex: string;
  let Ptext: string;
  let answer: string;
  let complex = false;
  let roots: string;
  if (kind === 0) {
    const c = r.int(1, 5);
    Ptex = `(x^2 - ${c * c})`;
    Ptext = `x^2 - ${c * c}`;
    answer = `${c}, -${c}`;
    roots = md`$x^2 - ${c * c} = (x - ${c})(x + ${c}) = 0$ at $x = ${c}$ and $x = -${c}$.`;
  } else if (kind === 1) {
    const [a, b] = [r.nonzero(-4, 4), r.nonzero(-4, 4)];
    const bb = a === b ? -a : b;
    Ptex = `(${poly([[1, "x^2"], [-(a + bb), "x"], [a * bb, ""]])})`;
    Ptext = poly([[1, "x^2"], [-(a + bb), "x"], [a * bb, ""]]);
    answer = `${a}, ${bb}`;
    roots = md`$${Ptext} = ${factorOf(a)}${factorOf(bb)} = 0$ at $x = ${a}$ and $x = ${bb}$.`;
  } else if (kind === 2) {
    const c = r.int(1, 4);
    Ptex = `(x^2 + ${c * c})`;
    Ptext = `x^2 + ${c * c}`;
    answer = `${c === 1 ? "" : c}i, -${c === 1 ? "" : c}i`;
    complex = true;
    roots = md`$x^2 + ${c * c} = 0$ has no real roots, but $x = \pm ${c === 1 ? "" : c}i$ are roots. They count: the theorem measures distances in the complex plane.`;
  } else if (kind === 3) {
    const c = r.nonzero(-5, 5);
    Ptex = `(x^2 ${c > 0 ? "-" : "+"} ${Math.abs(c)}x)`;
    Ptext = `x^2 - ${c}x`.replace("- -", "+ ");
    answer = `0, ${c}`;
    roots = md`$x^2 ${c > 0 ? "-" : "+"} ${Math.abs(c)}x = x${factorOf(c)} = 0$ at $x = 0$ and $x = ${c}$.`;
  } else {
    const c = r.int(1, 4);
    Ptex = `(x^3 - ${c * c}x)`;
    Ptext = `x^3 - ${c * c}x`;
    answer = `0, ${c}, -${c}`;
    roots = md`$x^3 - ${c * c}x = x(x - ${c})(x + ${c}) = 0$ at $x = 0$, $${c}$ and $-${c}$.`;
  }
  const qKind = r.int(0, 2);
  const b = r.nonzero(-5, 5);
  const Qtex = qKind === 0 ? `${lead(b, "x")}y'` : qKind === 1 ? `${lead(b, "")}y'` : `${lead(b, "(x + 1)")}y'`;
  const d = r.nonzero(-6, 6);
  const eq = `${Ptex}y''${Qtex.startsWith("-") ? " - " : " + "}${Qtex.replace(/^-/, "")}${term(d, "y")} = 0`;
  const n = answer.split(",").length;
  return {
    prompt: md`Find all singular points of $${eq}$, real and complex. List them separated by commas${complex ? ", typing i for the imaginary unit" : ""}.`,
    answer,
    form: "set",
    complex,
    verify: [`${Ptext} = 0`],
    hint: md`Write the equation as $y'' + p(x)y' + q(x)y = 0$. The coefficients $p$ and $q$ are polynomials divided by $${Ptex}$, so they fail to be analytic exactly where $${Ptex}$ is zero${complex ? ", including complex zeros" : ""}.`,
    solution: [
      { math: md`p(x) = \frac{${Qtex.replace("y'", "")}}{${Ptex}}, \qquad q(x) = \frac{${d}}{${Ptex}}`, note: md`Divide through by the coefficient of $y''$. The constant $${d}$ in $q$ never vanishes, so every zero of the denominator is a genuine singular point.` },
      { math: md`${Ptext} = 0`, note: roots },
      { math: md`\{${answer}\}`, note: md`${n === 2 ? "Two" : "Three"} singular points. Every other point${complex ? " on the real line" : ""} is an ordinary point.` },
    ],
  };
};

const eulerExponents: Generator = (r) => {
  const q = r.pick([1, 1, 2, 3]);
  let p = r.int(-5, 5);
  if (q > 1) while (p % q === 0) p = r.int(-5, 5);
  const r2 = r.int(-4, 4);
  const r1 = frac(p, q);
  // (q r - p)(r - r2) = q r^2 - (p + q r2) r + p r2 = A r(r-1) + B r + C
  const A = q;
  const B = q - (p + q * r2);
  const C = p * r2;
  const eq = `${lead(A, "x^2 y''")}${term(B, "x y'")}${term(C, "y")} = 0`;
  const quad = poly([[q, "r^2"], [-(p + q * r2), "r"], [p * r2, ""]]);
  const answer = r1 === String(r2) ? r1 : `${r1}, ${r2}`;
  return {
    prompt: md`For $x > 0$, find every exponent $r$ for which $y = x^r$ solves $${eq}$. Give the values as a comma-separated list, like 2, -1/2.`,
    answer,
    form: "set",
    verify: [`${A} r (r - 1) + (${B}) r + (${C}) = 0`],
    hint: md`Substitute $y = x^r$, $y' = r x^{r-1}$, $y'' = r(r-1)x^{r-2}$. Every term becomes a constant times $x^r$; divide it out and solve the quadratic in $r$.`,
    solution: [
      { math: md`y = x^r, \quad y' = r x^{r-1}, \quad y'' = r(r-1) x^{r-2}`, note: "Each derivative lowers the power by one." },
      { math: md`${A === 1 ? "" : A} r(r-1) x^r${term(B, "r x^r")}${term(C, "x^r")} = 0`, note: md`$x^2 \cdot x^{r-2} = x^r$ and $x \cdot x^{r-1} = x^r$: every term has the same power.` },
      { math: md`${A === 1 ? "" : A} r(r-1)${term(B, "r")}${term(C, "")} = 0 \quad\Rightarrow\quad ${quad} = 0`, note: md`Divide by $x^r$ (not zero for $x > 0$). This is the **indicial equation**.` },
      { math: md`(${poly([[q, "r"], [-p, ""]])})(${poly([[1, "r"], [-r2, ""]])}) = 0`, note: "Factor." },
      { math: md`r = ${fracTex(p, q)} \quad\text{or}\quad r = ${r2}`, note: md`So $y = c_1 x^{${fracTex(p, q)}} + c_2 x^{${r2}}$ is the general solution for $x > 0$.` },
    ],
  };
};

const radiusBound: Generator = (r) => {
  const complexRoots = r.next() < 0.5;
  let Ptex: string;
  let x0: number;
  let answer: string;
  let answerTex: string;
  let where: string;
  let distance: string;
  if (complexRoots) {
    const a = r.int(-2, 2);
    const c = r.int(1, 3);
    // (x - a)^2 + c^2 = x^2 - 2a x + a^2 + c^2
    Ptex = `(${poly([[1, "x^2"], [-2 * a, "x"], [a * a + c * c, ""]])})`;
    x0 = r.pick([-3, -2, -1, 0, 1, 2, 3]);
    const d2 = (x0 - a) ** 2 + c * c;
    answer = sqrtText(d2);
    answerTex = sqrtTex(d2);
    where = md`$${Ptex.slice(1, -1)} = ${a === 0 ? "x^2" : `(x ${a < 0 ? "+" : "-"} ${Math.abs(a)})^2`} + ${c * c} = 0$ gives $x = ${a === 0 ? "" : `${a} `}\pm ${c === 1 ? "" : c}i$: no real zeros, but two complex singular points.`;
    distance = md`$|${x0} - (${a} \pm ${c === 1 ? "" : c}i)| = \sqrt{${(x0 - a) ** 2} + ${c * c}} = ${answerTex}$. Both are the same distance away.`;
  } else {
    const a = r.int(-4, 4);
    let b = r.int(-4, 4);
    while (b === a) b = r.int(-4, 4);
    Ptex = `(${poly([[1, "x^2"], [-(a + b), "x"], [a * b, ""]])})`;
    const candidates = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter((v) => v !== a && v !== b);
    x0 = r.pick(candidates);
    const R = Math.min(Math.abs(x0 - a), Math.abs(x0 - b));
    answer = String(R);
    answerTex = String(R);
    where = md`$${Ptex.slice(1, -1)} = ${factorOf(a)}${factorOf(b)} = 0$ at $x = ${a}$ and $x = ${b}$.`;
    distance = md`The distances from $x_0 = ${x0}$ are $|${x0} - ${paren(a)}| = ${Math.abs(x0 - a)}$ and $|${x0} - ${paren(b)}| = ${Math.abs(x0 - b)}$. The nearer one wins.`;
  }
  const b = r.nonzero(-4, 4);
  const d = r.nonzero(-5, 5);
  const eq = `${Ptex}y''${term(b, "x y'")}${term(d, "y")} = 0`;
  return {
    prompt: md`The power series solution of $${eq}$ about $x_0 = ${x0}$ converges at least for $|x - ${paren(x0)}| < R$. Find the largest $R$ the theorem guarantees. Give an exact value, like 3 or sqrt(5).`,
    answer,
    simplified: true,
    hint: md`Find every zero of the coefficient of $y''$, complex ones included. $R$ is the distance from $x_0 = ${x0}$ to the nearest one.`,
    solution: [
      { math: md`P(x) = ${Ptex.slice(1, -1)}`, note: md`The singular points are where $P = 0$, because $p = Q/P$ and $q = R/P$ fail to be analytic there.` },
      { math: md`P(x) = 0`, note: where },
      { math: md`R = ${answerTex}`, note: distance },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit6: Unit = {
  title: "Series Solutions",
  lessons: [
    {
      id: slug("Power series solutions"),
      title: "Power series solutions",
      summary: "When no formula solves an equation, a power series still can: substitute, match coefficients, and read off a recurrence.",
      blocks: [
        {
          kind: "text",
          body: md`Every equation solved so far had something special about it: constant coefficients, a separable shape, an integrating factor that could be found. The equation

$$y'' - xy = 0$$

has none of that. Its coefficient $-x$ is as simple as a non-constant coefficient can be, and still no combination of exponentials, trig functions, powers and logs solves it. Yet it describes real things (light near a caustic, a quantum particle in a uniform field), so it needs solving.

The way out is the idea that closed Calculus 2: most functions worth having are **power series**. We don't know a formula for $y$, but we can look for its coefficients one at a time.`,
        },
        {
          kind: "key",
          title: "Power series facts to reuse",
          body: md`Suppose $y = \sum_{n=0}^{\infty} a_n x^n$ converges for $|x| < R$ with $R > 0$. Then on that interval:

- $y$ is differentiable, and the derivative is found **term by term**: $y' = \sum_{n=1}^{\infty} n a_n x^{n-1}$, and $y'' = \sum_{n=2}^{\infty} n(n-1) a_n x^{n-2}$, each with the same radius $R$.
- **Coefficients are unique.** If $\sum a_n x^n = \sum b_n x^n$ for all $|x| < R$, then $a_n = b_n$ for every $n$. In particular a power series that is 0 on an interval has every coefficient 0.
- The coefficients are the Taylor coefficients: $a_n = \dfrac{y^{(n)}(0)}{n!}$.

The same holds about any center $x_0$ with $(x - x_0)^n$ in place of $x^n$.`,
        },
        {
          kind: "why",
          title: "Why the coefficients of a power series are unique",
          body: md`Set $f(x) = \sum c_n x^n$ and suppose $f(x) = 0$ for every $x$ in $(-R, R)$. Put in $x = 0$: every term with $n \ge 1$ vanishes, so $c_0 = f(0) = 0$.

Now differentiate. Term-by-term differentiation is allowed inside the radius, so $f'(x) = c_1 + 2c_2 x + 3c_3 x^2 + \cdots$. But $f$ is the zero function, so $f'$ is too, and $x = 0$ gives $c_1 = 0$. Differentiate again: $f''(x) = 2c_2 + 6c_3 x + \cdots = 0$, so $c_2 = 0$. Each derivative peels off one more coefficient, and $f^{(n)}(0) = n!\,c_n$ in general.

So two series that agree on an interval have a difference whose coefficients are all 0: they are the same series. That is what lets us **match coefficients** between the two sides of a differential equation.`,
        },
        {
          kind: "proof",
          title: "Identity theorem for power series",
          given: md`$\sum_{n=0}^{\infty} c_n x^n = 0$ for all $x$ with $|x| < R$, where $R > 0$`,
          prove: md`$c_n = 0$ for every $n$`,
          steps: [
            { statement: md`$f(x) = \sum c_n x^n$ is infinitely differentiable on $(-R, R)$, with $f^{(k)}(x) = \sum_{n \ge k} n(n-1)\cdots(n-k+1)\,c_n x^{n-k}$`, reason: "A power series may be differentiated term by term inside its radius of convergence, and the derivative has the same radius (Calculus 2)." },
            { statement: md`$f^{(k)}(0) = k!\,c_k$`, reason: md`At $x = 0$ every term with $n > k$ contains a factor $0^{n-k} = 0$; the $n = k$ term is $k(k-1)\cdots 1 \cdot c_k$.` },
            { statement: md`$f^{(k)}(x) = 0$ for all $x$ in $(-R, R)$`, reason: md`$f$ is the zero function on the interval, and the derivative of the zero function is zero.` },
            { statement: md`$k!\,c_k = 0$, so $c_k = 0$`, reason: md`Put $x = 0$ in the previous line and compare with step 2. $k! \ne 0$.` },
          ],
        },
        {
          kind: "text",
          body: md`Here is the whole method on an equation whose answer we already know. Watching it recover $e^x$ shows every move.`,
        },
        {
          kind: "example",
          title: "y' = y by series",
          problem: md`Find all power series solutions $y = \sum_{n=0}^{\infty} a_n x^n$ of $y' = y$.`,
          steps: [
            { math: md`y' = \sum_{n=1}^{\infty} n a_n x^{n-1} = a_1 + 2a_2 x + 3a_3 x^2 + \cdots`, note: "Differentiate term by term. The constant term is gone, so the sum starts at $n = 1$." },
            { math: md`y' = \sum_{n=0}^{\infty} (n+1) a_{n+1} x^n`, note: md`Rename the index so the power is $x^n$: the term $n a_n x^{n-1}$ with $n$ replaced by $n + 1$ is $(n+1) a_{n+1} x^n$. Same terms, new labels.` },
            { math: md`\sum_{n=0}^{\infty} (n+1) a_{n+1} x^n = \sum_{n=0}^{\infty} a_n x^n`, note: md`The equation $y' = y$ with both sides as series in $x^n$.` },
            { math: md`(n+1) a_{n+1} = a_n \quad (n = 0, 1, 2, \ldots)`, note: "Coefficients are unique, so the coefficient of each $x^n$ must agree. This is a **recurrence relation**." },
            { math: md`a_1 = a_0, \quad a_2 = \frac{a_1}{2} = \frac{a_0}{2}, \quad a_3 = \frac{a_2}{3} = \frac{a_0}{6}, \quad a_4 = \frac{a_3}{4} = \frac{a_0}{24}`, note: md`Nothing fixes $a_0$: it is the free constant. Everything else follows from it.` },
            { math: md`a_n = \frac{a_0}{n!}, \qquad y = a_0 \sum_{n=0}^{\infty} \frac{x^n}{n!} = a_0 e^x`, note: md`The pattern is $a_n = \frac{a_{n-1}}{n}$ applied $n$ times. The series is the one for $e^x$, and $a_0 = y(0)$: the general solution from Unit 1, found without separating anything.` },
          ],
        },
        {
          kind: "why",
          title: "Why shifting the index changes nothing",
          body: md`A sum doesn't care what its index is called. $\sum_{n=1}^{\infty} n a_n x^{n-1}$ means $1a_1 x^0 + 2a_2 x^1 + 3a_3 x^2 + \cdots$. Write $m = n - 1$, so $n = m + 1$ and $m$ runs from 0: the same list of terms is $\sum_{m=0}^{\infty} (m+1) a_{m+1} x^m$. Then call $m$ by the letter $n$ again. The rule is

$$\sum_{n=k}^{\infty} b_n x^{n-k} = \sum_{n=0}^{\infty} b_{n+k} x^{n}.$$

Lower the starting value by $k$, raise every index inside by $k$. For $y''$ this gives $\sum_{n=2}^{\infty} n(n-1) a_n x^{n-2} = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n$.

Multiplying by $x$ goes the other way: $x y' = \sum_{n=1}^{\infty} n a_n x^n$ already has the power $x^n$, and $x y = \sum_{n=0}^{\infty} a_n x^{n+1} = \sum_{n=1}^{\infty} a_{n-1} x^n$. The point of all this shuffling is to get **every** sum written with $x^n$, so the coefficients of $x^n$ can be collected into one equation.`,
        },
        {
          kind: "key",
          title: "The power series method",
          body: md`To solve a linear equation near $x = 0$:

1. Assume $y = \sum_{n=0}^{\infty} a_n x^n$ and write $y'$ and $y''$ term by term.
2. Multiply by any polynomial coefficients, so each piece is a sum of terms $(\ldots) x^{\text{power}}$.
3. Shift indices until every sum has the power $x^n$. Watch the starting values: a sum that starts at $n = 1$ contributes nothing to the $x^0$ equation.
4. Collect the coefficient of $x^n$ and set it to 0 (or equal to the forcing term's coefficient). The result is a **recurrence relation** that gives later coefficients from earlier ones.
5. For a second-order equation, $a_0 = y(0)$ and $a_1 = y'(0)$ are free; the recurrence fixes the rest. Compute as many as you need, look for a pattern, and identify the function if you can.

Near another point $x_0$, use powers of $(x - x_0)$ instead.`,
        },
        {
          kind: "example",
          title: "y'' + y = 0 by series",
          problem: md`Find the general power series solution of $y'' + y = 0$.`,
          steps: [
            { math: md`y'' = \sum_{n=2}^{\infty} n(n-1) a_n x^{n-2} = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n`, note: "Differentiate twice, then shift by 2." },
            { math: md`\sum_{n=0}^{\infty} \big[(n+2)(n+1) a_{n+2} + a_n\big] x^n = 0`, note: md`Add $y = \sum a_n x^n$. Both sums start at $n = 0$ with the power $x^n$, so they combine term by term.` },
            { math: md`a_{n+2} = -\frac{a_n}{(n+2)(n+1)}`, note: "Every coefficient of the zero series is 0. This recurrence steps by 2, so the even and odd coefficients form separate chains." },
            { math: md`a_2 = -\frac{a_0}{2}, \quad a_4 = -\frac{a_2}{12} = \frac{a_0}{24}, \quad a_6 = -\frac{a_4}{30} = -\frac{a_0}{720}`, note: md`The even chain, from $a_0$: $a_{2m} = \frac{(-1)^m a_0}{(2m)!}$.` },
            { math: md`a_3 = -\frac{a_1}{6}, \quad a_5 = -\frac{a_3}{20} = \frac{a_1}{120}, \quad a_7 = -\frac{a_5}{42} = -\frac{a_1}{5040}`, note: md`The odd chain, from $a_1$: $a_{2m+1} = \frac{(-1)^m a_1}{(2m+1)!}$.` },
            { math: md`y = a_0\left(1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \cdots\right) + a_1\left(x - \frac{x^3}{3!} + \frac{x^5}{5!} - \cdots\right) = a_0 \cos x + a_1 \sin x`, note: md`Two free constants, two independent solutions, exactly as Unit 3 promised. The series method produced $\cos$ and $\sin$ from the equation alone.` },
          ],
        },
        {
          kind: "plot",
          x: [-7, 7],
          y: [-3, 3],
          curves: [
            { expr: "cos(x)", label: "\\cos x", color: 1, dashed: true },
            { expr: partialSum(cosTerms), label: "s_{N}(x)", color: 2 },
          ],
          params: [{ name: "N", tex: "N", min: 0, max: 8, step: 1, value: 1 }],
          caption: md`The partial sum $s_N(x) = \sum_{m=0}^{N} \frac{(-1)^m x^{2m}}{(2m)!}$ of the even-chain solution, against $\cos x$. Slide $N$. Each extra term widens the stretch where the two agree, and the series converges for every $x$, so any point is eventually captured. Far from 0 the partial sums run off: a polynomial has to.`,
        },
        {
          kind: "text",
          body: md`**Initial conditions come for free.** Put $x = 0$ into $y = a_0 + a_1 x + a_2 x^2 + \cdots$ and every term but the first dies: $y(0) = a_0$. Differentiate first and $y'(0) = a_1$. So an initial value problem hands you the two free coefficients directly, and the recurrence does the rest. In general $a_n = \frac{y^{(n)}(0)}{n!}$: the series solution *is* the Taylor series of the solution, and the recurrence is a machine for producing Taylor coefficients without differentiating anything.

Now the equation we couldn't touch before.`,
        },
        {
          kind: "example",
          title: "The Airy equation",
          problem: md`Find two independent power series solutions of $y'' - xy = 0$.`,
          steps: [
            { math: md`y'' = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n, \qquad xy = \sum_{n=0}^{\infty} a_n x^{n+1} = \sum_{n=1}^{\infty} a_{n-1} x^n`, note: md`Shift $y''$ down by 2 and $xy$ up by 1. The second sum starts at $n = 1$.` },
            { math: md`2a_2 + \sum_{n=1}^{\infty} \big[(n+2)(n+1) a_{n+2} - a_{n-1}\big] x^n = 0`, note: md`The $n = 0$ term of $y''$ has no partner in $xy$, so it stands alone.` },
            { math: md`a_2 = 0, \qquad a_{n+2} = \frac{a_{n-1}}{(n+2)(n+1)} \;\; (n \ge 1)`, note: "This recurrence steps by 3: three separate chains, from $a_0$, from $a_1$ and from $a_2$." },
            { math: md`a_3 = \frac{a_0}{6}, \quad a_6 = \frac{a_3}{30} = \frac{a_0}{180}, \quad a_9 = \frac{a_6}{72} = \frac{a_0}{12960}`, note: md`The chain from $a_0$ ($n = 1, 4, 7$).` },
            { math: md`a_4 = \frac{a_1}{12}, \quad a_7 = \frac{a_4}{42} = \frac{a_1}{504}, \quad a_{10} = \frac{a_7}{90} = \frac{a_1}{45360}`, note: md`The chain from $a_1$ ($n = 2, 5, 8$).` },
            { math: md`a_5 = \frac{a_2}{20} = 0, \quad a_8 = 0, \quad a_{11} = 0, \;\ldots`, note: md`The chain from $a_2 = 0$ is all zeros.` },
            { math: md`y = a_0\left(1 + \frac{x^3}{6} + \frac{x^6}{180} + \frac{x^9}{12960} + \cdots\right) + a_1\left(x + \frac{x^4}{12} + \frac{x^7}{504} + \cdots\right)`, note: md`Call the brackets $y_1$ and $y_2$. They have no names among the elementary functions (they are combinations of the **Airy functions** Ai and Bi), but we can compute them to any accuracy, and by the ratio test each series converges for every $x$: the ratio of consecutive terms is about $\frac{|x|^3}{9m^2}$, which goes to 0.` },
          ],
        },
        {
          kind: "plot",
          x: [-8, 2.5],
          y: [-3, 5],
          curves: [{ expr: partialSum(airyTerms), label: "y_1 \\text{ to } x^{3N}", color: 1 }],
          params: [{ name: "N", tex: "N", min: 0, max: 10, step: 1, value: 2 }],
          caption: md`Partial sums of the Airy solution $y_1 = 1 + \frac{x^3}{6} + \frac{x^6}{180} + \cdots$, through the $x^{3N}$ term. There is no formula to compare against, but slide $N$ and watch the curve stop changing on a widening interval: that is convergence. To the left the true $y_1$ oscillates with shrinking swings; to the right it climbs steeply.`,
        },
        {
          kind: "example",
          title: "An initial value problem with a hidden formula",
          problem: md`Solve $y'' - xy' - y = 0$, $y(0) = 1$, $y'(0) = 0$ by power series, and identify the function.`,
          steps: [
            { math: md`y'' = \sum_{n=0}^{\infty} (n+2)(n+1) a_{n+2} x^n, \quad xy' = \sum_{n=0}^{\infty} n a_n x^n, \quad y = \sum_{n=0}^{\infty} a_n x^n`, note: md`$xy'$ needs no shift: $x \cdot n a_n x^{n-1} = n a_n x^n$. Its $n = 0$ term is 0 anyway, so starting at $n = 0$ is harmless.` },
            { math: md`(n+2)(n+1) a_{n+2} - n a_n - a_n = 0 \quad\Rightarrow\quad a_{n+2} = \frac{(n+1) a_n}{(n+2)(n+1)} = \frac{a_n}{n+2}`, note: "Collect the coefficient of $x^n$. The factor $(n + 1)$ cancels: a lucky equation." },
            { math: md`a_0 = y(0) = 1, \qquad a_1 = y'(0) = 0`, note: "The initial conditions set the two free coefficients. The odd chain starts from 0, so every odd coefficient is 0." },
            { math: md`a_2 = \frac{1}{2}, \quad a_4 = \frac{a_2}{4} = \frac{1}{8}, \quad a_6 = \frac{a_4}{6} = \frac{1}{48}, \quad a_8 = \frac{a_6}{8} = \frac{1}{384}`, note: md`Denominators $2, 8, 48, 384$: each is the previous one times the next even number, so $a_{2m} = \frac{1}{2 \cdot 4 \cdots 2m} = \frac{1}{2^m m!}$.` },
            { math: md`y = \sum_{m=0}^{\infty} \frac{x^{2m}}{2^m m!} = \sum_{m=0}^{\infty} \frac{(x^2/2)^m}{m!} = e^{x^2/2}`, note: md`The exponential series with $u = x^2/2$. Check: $y' = xy$, so $y'' = y + xy'$, and $y'' - xy' - y = 0$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A power series solution of $y' = 2y$ has $a_0 = 3$. What is $a_3$?`,
          answer: "4",
          explain: md`The recurrence is $(n+1) a_{n+1} = 2a_n$. So $a_1 = 6$, $a_2 = \frac{2 \cdot 6}{2} = 6$, $a_3 = \frac{2 \cdot 6}{3} = 4$. (Check: $y = 3e^{2x}$ has $x^3$ coefficient $3 \cdot \frac{2^3}{3!} = 4$.)`,
        },
        {
          kind: "check",
          prompt: md`Rewrite $\sum_{n=2}^{\infty} n(n-1) a_n x^{n-2}$ so that the power is $x^n$. What is the coefficient of $x^n$?`,
          choices: ["$(n+2)(n+1)\\,a_{n+2}$", "$n(n-1)\\,a_n$", "$(n-2)(n-1)\\,a_{n-2}$", "$(n+1)n\\,a_{n+1}$"],
          accept: ["$(n+2)(n+1)\\,a_{n+2}$"],
          explain: md`Lower the start by 2 and raise every index by 2: $n(n-1) a_n x^{n-2}$ becomes $(n+2)(n+1) a_{n+2} x^n$, summed from $n = 0$. Check with the first term: $n = 2$ in the original gives $2 \cdot 1 \cdot a_2 x^0$; $n = 0$ in the new form gives $2 \cdot 1 \cdot a_2 x^0$. Same.`,
        },
        {
          kind: "text",
          body: md`Two questions are left open. The Airy series converged everywhere, and $y' = y$ gave $e^x$, which also converges everywhere. But the last practice problem below has a series that stops at $|x| = \frac{1}{k}$. What decides the radius, before you have computed a single coefficient? And are there equations where the method fails outright? Both are answered by looking at where the coefficients misbehave, which is the next lesson.`,
        },
      ],
      practice: [firstOrderCoefficients, secondOrderCoefficients, recognizeSeries],
    },
    {
      id: slug("Ordinary and singular points"),
      title: "Ordinary and singular points",
      summary: "Where the series method is guaranteed to work, how far the series reaches, and the two kinds of trouble spot.",
      blocks: [
        {
          kind: "text",
          body: md`The series method asks for a lot of faith: we assumed a power series solution existed, then computed it. When is that assumption safe? And once the coefficients are in hand, how far does the series converge?

Both answers come from the coefficients of the equation itself. Write a second-order linear equation in **standard form**, with the $y''$ coefficient divided out:

$$y'' + p(x)\,y' + q(x)\,y = 0.$$

When the original equation is $P(x)y'' + Q(x)y' + R(x)y = 0$, this means $p = Q/P$ and $q = R/P$. Dividing by $P$ is where the trouble hides.`,
        },
        {
          kind: "key",
          title: "Ordinary and singular points",
          body: md`A point $x_0$ is an **ordinary point** of $y'' + p(x)y' + q(x)y = 0$ if $p$ and $q$ are both **analytic** at $x_0$: each has a power series in $(x - x_0)$ that converges near $x_0$. Otherwise $x_0$ is a **singular point**.

For polynomial coefficients $P y'' + Q y' + R y = 0$ with no common factor, $p = Q/P$ and $q = R/P$ are analytic wherever $P \ne 0$. So:

$$x_0 \text{ is ordinary} \iff P(x_0) \ne 0, \qquad x_0 \text{ is singular} \iff P(x_0) = 0.$$

Complex zeros of $P$ count as singular points too, and they matter even for real solutions.`,
        },
        {
          kind: "why",
          title: "Why P(x₀) ≠ 0 is the condition that matters",
          body: md`Run the method on $P y'' + Q y' + R y = 0$ about $x_0 = 0$ and look at the equation for the coefficient of $x^n$. The term $P(x) y''$ contributes $P(0) \cdot (n+2)(n+1) a_{n+2}$ plus terms involving $a_{n+1}, a_n, \ldots$ (from the higher powers of $x$ in $P$). Everything else in the $x^n$ equation involves only $a_{n+1}$ and earlier coefficients. So the recurrence has the shape

$$P(0)\,(n+2)(n+1)\,a_{n+2} = (\text{a combination of } a_0, \ldots, a_{n+1}).$$

If $P(0) \ne 0$, divide and $a_{n+2}$ is determined. Every coefficient follows from $a_0$ and $a_1$, forever: the method always produces a candidate solution, with exactly two free constants.

If $P(0) = 0$, the left side is 0 and the equation says nothing about $a_{n+2}$. Instead it is a *constraint* on earlier coefficients, which may force them to be 0 or may be impossible to satisfy. The method can lose solutions or find none at all. Example: $x^2 y'' - 2y = 0$ has solutions $x^2$ and $x^{-1}$. The series method about 0 finds $x^2$ (a very short series) and misses $x^{-1}$ completely, which is no power series.`,
        },
        {
          kind: "proof",
          title: "At an ordinary point the coefficients are determined",
          given: md`$P y'' + Q y' + R y = 0$ with polynomial $P, Q, R$ and $P(0) \ne 0$; $y = \sum a_n x^n$ with $a_0, a_1$ chosen`,
          prove: md`every $a_n$ is uniquely determined by $a_0$ and $a_1$`,
          steps: [
            { statement: md`$P(x) = p_0 + p_1 x + p_2 x^2 + \cdots$ with $p_0 = P(0) \ne 0$; similarly $Q = \sum q_k x^k$, $R = \sum r_k x^k$`, reason: "Polynomials are their own (finite) power series." },
            { statement: md`$P y'' = \sum_n \Big[\sum_{k=0}^{n} p_k (n-k+2)(n-k+1) a_{n-k+2}\Big] x^n$`, reason: md`Multiply the series $P = \sum p_k x^k$ and $y'' = \sum (m+2)(m+1) a_{m+2} x^m$; the coefficient of $x^n$ collects all pairs with $k + m = n$ (Cauchy product).` },
            { statement: md`The $k = 0$ term is $p_0 (n+2)(n+1) a_{n+2}$; every other term in the $x^n$ coefficient of $P y''$, $Q y'$ and $R y$ involves only $a_j$ with $j \le n + 1$`, reason: md`For $k \ge 1$ the index is $n - k + 2 \le n + 1$. In $Q y'$ the highest index is $n + 1$ (from $q_0 (n+1) a_{n+1}$) and in $R y$ it is $n$.` },
            { statement: md`$p_0 (n+2)(n+1) a_{n+2} = -(\text{terms in } a_0, \ldots, a_{n+1})$`, reason: md`The coefficient of $x^n$ in $P y'' + Q y' + R y$ must be 0 (identity theorem).` },
            { statement: md`$a_{n+2}$ is uniquely determined for every $n \ge 0$`, reason: md`Divide by $p_0 (n+2)(n+1) \ne 0$. By induction on $n$, starting from the given $a_0, a_1$, each coefficient is fixed by the ones before it.` },
          ],
        },
        {
          kind: "text",
          body: md`That proof produces a *formal* series: all the coefficients, but no promise that the series converges anywhere except $x = 0$. The promise is the main theorem of this lesson. Its proof (a comparison with a geometric series, like the argument for the interval of convergence in Calculus 2, but with a recurrence to control) is longer than it is enlightening, so we state it and spend the effort on seeing why the radius is what it is.`,
        },
        {
          kind: "key",
          title: "Theorem: series solutions at an ordinary point",
          body: md`Let $x_0$ be an ordinary point of $y'' + p(x)y' + q(x)y = 0$. Then every solution can be written as a power series

$$y = \sum_{n=0}^{\infty} a_n (x - x_0)^n = a_0 y_1(x) + a_1 y_2(x),$$

where $y_1, y_2$ are independent power series solutions, and the series converges at least for $|x - x_0| < R$, where $R$ is the distance from $x_0$ to the **nearest singular point** (real or complex) of the equation. If there are no singular points, it converges for every $x$.

For $P y'' + Q y' + R y = 0$: find all zeros of $P$ in the complex plane; $R$ is the distance from $x_0$ to the closest one.`,
        },
        {
          kind: "why",
          title: "Why complex singular points count",
          body: md`Take the first-order equation $(1 + x^2) y' + 2xy = 0$. Its coefficient $1 + x^2$ is never 0 for real $x$, so every real point looks ordinary. Separate variables (Unit 1): $\frac{dy}{y} = -\frac{2x}{1 + x^2}\,dx$, so $y = \frac{C}{1 + x^2}$. A perfectly smooth function on the whole real line.

Now solve it by series about $x_0 = 0$: $y = C(1 - x^2 + x^4 - x^6 + \cdots)$, the geometric series in $-x^2$. It converges only for $|x| < 1$. Nothing on the real line explains the number 1. The explanation is at $x = \pm i$, where $1 + x^2 = 0$: the solution $\frac{C}{1 + x^2}$ blows up there, and a power series about 0 converges on a *disc* in the complex plane. The disc can't contain a point where the function is infinite, so its radius is at most the distance to $\pm i$, which is 1.

The same thing governs second-order equations. The solutions are analytic in the complex plane wherever $p$ and $q$ are, and the disc of convergence about $x_0$ reaches out until it bumps into a singular point.`,
        },
        {
          kind: "plot",
          x: [-2, 2],
          y: [-1, 2.5],
          curves: [
            { expr: "1/(1 + x^2)", label: "\\frac{1}{1 + x^2}", color: 1, dashed: true },
            { expr: "(1 - (-x^2)^(N + 1))/(1 + x^2)", label: "s_{N}(x)", color: 2 },
          ],
          vlines: [{ x: -1, label: "x = -1" }, { x: 1, label: "x = 1" }],
          params: [{ name: "N", tex: "N", min: 0, max: 12, step: 1, value: 2 }],
          caption: md`Partial sums $s_N = 1 - x^2 + \cdots + (-1)^N x^{2N}$ of the series for $\frac{1}{1 + x^2}$. Slide $N$: inside $|x| < 1$ the partial sums close in on the curve; outside, they fly off no matter how large $N$ is. The function itself is harmless there. The wall at $|x| = 1$ is the shadow of the singular points $\pm i$.`,
        },
        {
          kind: "diagram",
          view: [-3.2, 3.2, -2.4, 2.4],
          grid: true,
          points: [
            { name: "I", x: 0, y: 1, label: "i", dir: "ne", },
            { name: "J", x: 0, y: -1, label: "-i", dir: "se" },
            { name: "C", x: "c", y: 0, label: "x_0 = {c}", dir: "s" },
          ],
          circles: [{ center: "C", radius: "sqrt(c^2 + 1)", color: 1, dashed: true }],
          segments: [{ from: "C", to: "I", color: 2, label: "R" }],
          params: [{ name: "c", tex: "x_0", min: -2.5, max: 2.5, step: 0.25, value: 0 }],
          readouts: [{ label: "R = \\sqrt{x_0^2 + 1}", value: "sqrt(c^2 + 1)" }],
          caption: md`The complex plane for $(1 + x^2)y' + 2xy = 0$. The singular points are $\pm i$. A series about a real center $x_0$ converges on the largest disc that reaches neither of them. Slide $x_0$: moving the center away from 0 lets the series reach further along the real line, with radius $\sqrt{x_0^2 + 1}$.`,
        },
        {
          kind: "example",
          title: "Singular points and the guaranteed radius",
          problem: md`For $(x^2 - 4) y'' + 3x y' + y = 0$, find the singular points and the radius of convergence guaranteed for series solutions about $x_0 = 1$ and about $x_0 = 0$.`,
          steps: [
            { math: md`p(x) = \frac{3x}{x^2 - 4}, \qquad q(x) = \frac{1}{x^2 - 4}`, note: "Standard form. Both fail to be analytic exactly where the denominator vanishes." },
            { math: md`x^2 - 4 = 0 \quad\Rightarrow\quad x = 2, \; x = -2`, note: "The singular points. No complex ones this time." },
            { math: md`x_0 = 1: \quad R = \min(|1 - 2|, |1 - (-2)|) = \min(1, 3) = 1`, note: md`The nearer singular point, $x = 2$, sets the radius. The series about 1 is guaranteed on $(0, 2)$.` },
            { math: md`x_0 = 0: \quad R = \min(|0 - 2|, |0 + 2|) = 2`, note: md`Guaranteed on $(-2, 2)$. The theorem says "at least": a particular solution might happen to converge further, but you can't count on it.` },
          ],
        },
        {
          kind: "text",
          body: md`Singular points are where the interesting physics usually lives: the center of a drum, the origin of a radial field, the ends of an interval. So we can't just avoid them. The question becomes: how bad is the singularity? The simplest singular equation shows the benchmark.`,
        },
        {
          kind: "example",
          title: "An Euler equation",
          problem: md`Solve $x^2 y'' + 2x y' - 6y = 0$ for $x > 0$.`,
          steps: [
            { math: md`y = x^r, \qquad y' = r x^{r-1}, \qquad y'' = r(r-1) x^{r-2}`, note: "Try a power, for a reason explained below." },
            { math: md`r(r-1) x^r + 2r x^r - 6 x^r = 0`, note: md`$x^2 \cdot x^{r-2} = x^r$ and $x \cdot x^{r-1} = x^r$. Every term is a constant times $x^r$.` },
            { math: md`r(r-1) + 2r - 6 = 0 \quad\Rightarrow\quad r^2 + r - 6 = (r + 3)(r - 2) = 0`, note: md`Divide by $x^r \ne 0$. This is the **indicial equation**.` },
            { math: md`y = c_1 x^2 + c_2 x^{-3}`, note: md`Two independent solutions, so this is the general solution on $x > 0$. Notice $x^{-3}$: no power series about 0 can produce it. The point $x = 0$ (where $P = x^2$ vanishes) is singular, and the method of the last lesson would find only $x^2$.` },
          ],
        },
        {
          kind: "why",
          title: "Why x^r is the right guess for an Euler equation",
          body: md`In $x^2 y'' + \alpha x y' + \beta y = 0$, each derivative is paired with exactly enough powers of $x$ to undo it: $x^2 y''$ and $x y'$ and $y$ all have "net degree zero". Feed in $x^r$ and each term returns a constant times $x^r$, so the equation collapses to a quadratic in $r$:

$$r(r-1) + \alpha r + \beta = 0.$$

Compare with Unit 3: for constant coefficients, $e^{rt}$ worked because differentiation only multiplied it by $r$. Here $x \frac{d}{dx}$ plays that role, since $x \frac{d}{dx} x^r = r x^r$. In fact the substitution $x = e^t$ turns an Euler equation into a constant-coefficient one, which is why the cases match: two real roots give $x^{r_1}, x^{r_2}$; a repeated root gives $x^r$ and $x^r \ln x$; complex roots $\lambda \pm i\mu$ give $x^{\lambda} \cos(\mu \ln x)$ and $x^{\lambda} \sin(\mu \ln x)$.

In standard form an Euler equation has $p = \frac{\alpha}{x}$ and $q = \frac{\beta}{x^2}$: a simple pole and a double pole at the singular point. That is the benchmark for "mild".`,
        },
        {
          kind: "key",
          title: "Regular and irregular singular points",
          body: md`A singular point $x_0$ of $y'' + p(x)y' + q(x)y = 0$ is **regular** if

$$(x - x_0)\,p(x) \qquad\text{and}\qquad (x - x_0)^2\,q(x)$$

are both analytic at $x_0$ (for rational $p, q$: both have finite limits as $x \to x_0$). Otherwise it is **irregular**.

In words: $p$ may blow up no faster than $\frac{1}{x - x_0}$ and $q$ no faster than $\frac{1}{(x - x_0)^2}$. That is exactly the Euler shape. Near a regular singular point the equation behaves like an Euler equation with slowly varying coefficients, and the **method of Frobenius** finds solutions of the form

$$y = (x - x_0)^r \sum_{n=0}^{\infty} a_n (x - x_0)^n,$$

a power series times a power $r$ from an indicial equation. That method is the start of the next course; this lesson gives you the test for when it applies.`,
        },
        {
          kind: "why",
          title: "Why the powers are 1 and 2",
          body: md`Multiply the standard form by $(x - x_0)^2$:

$$(x - x_0)^2 y'' + \big[(x - x_0) p(x)\big](x - x_0) y' + \big[(x - x_0)^2 q(x)\big] y = 0.$$

If the two brackets are analytic, call them $\alpha(x)$ and $\beta(x)$. Then at $x_0$ itself the equation reads $(x - x_0)^2 y'' + \alpha(x_0)(x - x_0) y' + \beta(x_0) y \approx 0$: an Euler equation. The brackets being analytic is precisely what lets the Euler behaviour $x^r$ be corrected by a power series.

When the condition fails, the solutions can behave in ways no power times a series can capture. The equation $x^4 y'' + 2x^3 y' + y = 0$ has $p = \frac{2}{x}$ (fine) but $q = \frac{1}{x^4}$ (too strong), so $0$ is irregular. Its solutions are $\cos\frac{1}{x}$ and $\sin\frac{1}{x}$, which oscillate infinitely often as $x \to 0$. No expression $x^r \sum a_n x^n$ does that.`,
        },
        {
          kind: "example",
          title: "Classifying the singular points",
          problem: md`Classify every singular point of $x^2 (x - 1)^2 y'' + (x - 1) y' + 3y = 0$.`,
          steps: [
            { math: md`p(x) = \frac{x - 1}{x^2 (x-1)^2} = \frac{1}{x^2 (x - 1)}, \qquad q(x) = \frac{3}{x^2 (x-1)^2}`, note: md`Divide by $P = x^2(x-1)^2$. Singular points: $x = 0$ and $x = 1$.` },
            { math: md`x_0 = 0: \quad x\,p(x) = \frac{1}{x(x-1)} \to \infty`, note: md`One factor of $x$ isn't enough to tame the $x^2$ in the denominator. **Irregular** singular point. (No need to test $q$.)` },
            { math: md`x_0 = 1: \quad (x-1)\,p(x) = \frac{1}{x^2} \to 1, \qquad (x-1)^2 q(x) = \frac{3}{x^2} \to 3`, note: "Both finite. **Regular** singular point: Frobenius works here." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find all singular points of $(x^2 - 9) y'' + x y' + 5y = 0$. List them separated by commas.`,
          answer: "3, -3",
          form: "set",
          explain: md`$p = \frac{x}{x^2 - 9}$ and $q = \frac{5}{x^2 - 9}$ fail to be analytic where $x^2 - 9 = 0$: at $x = 3$ and $x = -3$. Every other point is ordinary, and a series about $x_0 = 0$ is guaranteed for $|x| < 3$.`,
        },
        {
          kind: "check",
          prompt: md`Classify $x = 0$ for the equation $x^3 y'' + x^2 y' + y = 0$.`,
          choices: CLASSES,
          accept: ["irregular singular point"],
          explain: md`$P(0) = 0$, so it is singular. $p = \frac{x^2}{x^3} = \frac{1}{x}$ and $x\,p = 1$: fine. But $q = \frac{1}{x^3}$ and $x^2 q = \frac{1}{x}$, which blows up. One failure is enough: **irregular**.`,
        },
        {
          kind: "check",
          prompt: md`For which exponents $r$ is $y = x^r$ a solution of $x^2 y'' - 4x y' + 6y = 0$ (for $x > 0$)? List both, separated by a comma.`,
          answer: "2, 3",
          form: "set",
          explain: md`$r(r-1) - 4r + 6 = r^2 - 5r + 6 = (r - 2)(r - 3) = 0$, so $r = 2$ or $r = 3$, and $y = c_1 x^2 + c_2 x^3$.`,
        },
        {
          kind: "text",
          body: md`**Where this leads.** At an ordinary point, the method of the last lesson always works and the theorem tells you how far to trust it. At a regular singular point, Frobenius' method does the same job with a power $(x - x_0)^r$ out front; it produces the Bessel functions (vibrating drums, heat in a cylinder) and the Legendre polynomials (gravity and electrostatics in spherical coordinates), the two most used special functions in physics. At an irregular singular point, you need other tools. Knowing which case you are in is the first step of every such problem, and it costs only a glance at the coefficient of $y''$.`,
        },
      ],
      practice: [classifyPoint, singularPointsSet, eulerExponents, radiusBound],
    },
  ],
};
