import { frac, fracTex, gcd, poly } from "../../math/random";
import { md, slug, type Generator, type Step, type Unit } from "../types";

// ── Exact fraction helpers ──────────────────────────────────────────────────

type Frac = { n: number; d: number };
function fr(n: number, d = 1): Frac {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const fadd = (a: Frac, b: Frac): Frac => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fmul = (a: Frac, b: Frac): Frac => fr(a.n * b.n, a.d * b.d);
const ftext = (f: Frac) => frac(f.n, f.d);
const ftex = (f: Frac) => fracTex(f.n, f.d);
/** A fraction in parentheses when negative, for use inside a sum. */
const ftexP = (f: Frac) => (f.n < 0 ? `\\left(${ftex(f)}\\right)` : ftex(f));

/** "ln(p/q)" or "ln(p)" as answer text. */
const lnText = (p: number, q: number) => (q === 1 ? `ln(${p})` : `ln(${p}/${q})`);
/** "\ln \frac{p}{q}" or "\ln p" as LaTeX. */
const lnTex = (p: number, q: number) => (q === 1 ? `\\ln ${p}` : `\\ln\\frac{${p}}{${q}}`);
/** log2 of a power of two, or null. */
function log2(n: number): number | null {
  let k = 0;
  while (n > 1 && n % 2 === 0) [n, k] = [n / 2, k + 1];
  return n === 1 ? k : null;
}
/** A coefficient as text, with 1 hidden: "3t", "t", "-t". */
const coef = (n: number) => (n === 1 ? "" : n === -1 ? "-" : String(n));
/** "A + B e^(-k t)" with the sign of B handled. */
const sumText = (a: number, b: number, tail: string) => (b < 0 ? `${a} - ${-b}${tail}` : `${a} + ${b}${tail}`);
const sumTex = (a: number, b: number, tail: string) => (b < 0 ? `${a} - ${-b}${tail}` : `${a} + ${b}${tail}`);

// ── Lesson 1: Growth and decay ──────────────────────────────────────────────

const growthConstant: Generator = (r) => {
  const kind = r.int(0, 2);
  const T = r.pick([2, 3, 4, 5, 6, 8, 10, 12]);
  if (kind === 0) {
    const m = r.pick([2, 3, 4, 5]);
    const word = { 2: "doubles", 3: "triples", 4: "quadruples", 5: "grows fivefold" }[m]!;
    return {
      prompt: md`A bacteria culture ${word} every ${T} hours. Its size follows $y = y_0 e^{kt}$ with $t$ in hours. Find $k$ exactly (type $\frac{\ln 2}{3}$ as ln(2)/3).`,
      answer: `ln(${m})/${T}`,
      verify: [`e^(${T} k) = ${m}`],
      hint: md`After ${T} hours the size is $${m}y_0$. Set $y_0 e^{${T}k} = ${m}y_0$ and solve for $k$ with a logarithm.`,
      solution: [
        { math: md`y_0 e^{${T}k} = ${m}y_0`, note: md`At $t = ${T}$ the culture is ${m} times its starting size.` },
        { math: md`e^{${T}k} = ${m}`, note: md`Divide by $y_0$. The starting amount drops out, so $k$ doesn't depend on it.` },
        { math: md`${T}k = \ln ${m}`, note: "Take the natural log of both sides." },
        { math: md`k = \frac{\ln ${m}}{${T}} \approx ${(Math.log(m) / T).toFixed(4)}`, note: "Per hour." },
      ],
    };
  }
  if (kind === 1) {
    const m = r.pick([2, 3, 4, 5]);
    const word = { 2: "half", 3: "a third", 4: "a quarter", 5: "a fifth" }[m]!;
    const unit = r.pick(["days", "years", "hours"]);
    return {
      prompt: md`A radioactive sample shrinks to ${word} of its mass every ${T} ${unit}. Its mass follows $m = m_0 e^{kt}$ with $t$ in ${unit}. Find $k$ exactly; it is negative (type $-\frac{\ln 2}{3}$ as -ln(2)/3).`,
      answer: `-ln(${m})/${T}`,
      verify: [`e^(${T} k) = 1/${m}`],
      hint: md`After ${T} ${unit} the mass is $\frac{m_0}{${m}}$. Set $m_0 e^{${T}k} = \frac{m_0}{${m}}$ and take logs. Remember $\ln\frac{1}{${m}} = -\ln ${m}$.`,
      solution: [
        { math: md`m_0 e^{${T}k} = \frac{m_0}{${m}}`, note: md`At $t = ${T}$ only ${word} is left.` },
        { math: md`e^{${T}k} = \frac{1}{${m}}`, note: md`Divide by $m_0$.` },
        { math: md`${T}k = \ln\frac{1}{${m}} = -\ln ${m}`, note: md`Natural log of both sides; $\ln\frac{1}{a} = -\ln a$.` },
        { math: md`k = -\frac{\ln ${m}}{${T}} \approx ${(-Math.log(m) / T).toFixed(4)}`, note: "Negative, as decay must be." },
      ],
    };
  }
  const y0 = r.pick([40, 80, 120, 200, 400]);
  const [p, q] = r.pick([[3, 2], [5, 2], [5, 4], [3, 4], [2, 5], [4, 5], [3, 1], [1, 2]] as const);
  const y1 = (y0 * p) / q;
  return {
    prompt: md`A population is ${y0} at $t = 0$ and ${y1} at $t = ${T}$ (hours). Assume $y = y_0 e^{kt}$. Find $k$ exactly (type $\frac{\ln 2}{3}$ as ln(2)/3; $k$ may be negative).`,
    answer: `${lnText(p, q)}/${T}`,
    verify: [`${y0} e^(${T} k) = ${y1}`],
    hint: md`$y_0 = ${y0}$. Substitute $t = ${T}$, $y = ${y1}$ and solve for $k$: divide first, then take logs.`,
    solution: [
      { math: md`${y0} e^{${T}k} = ${y1}`, note: md`$y_0 = ${y0}$ is the value at $t = 0$. The second reading goes in for $t$ and $y$.` },
      { math: md`e^{${T}k} = \frac{${y1}}{${y0}} = ${q === 1 ? p : `\\frac{${p}}{${q}}`}`, note: "Divide and reduce the fraction." },
      { math: md`k = \frac{${lnTex(p, q)}}{${T}} \approx ${(Math.log(p / q) / T).toFixed(4)}`, note: p < q ? "The log of a number below 1 is negative: the population is shrinking." : "Positive: the population is growing." },
    ],
  };
};

const timeToReach: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const H = r.pick([4, 5, 8, 10, 12, 20, 30, 50]);
    const y0 = r.pick([80, 120, 160, 200, 400]);
    const unit = r.pick(["years", "days", "hours"]);
    if (r.next() < 0.45) {
      const n = r.int(1, 3);
      const y1 = y0 / 2 ** n;
      return {
        prompt: md`A ${y0} g sample of a radioactive isotope has a half-life of ${H} ${unit}. How long until ${y1} g remain? Give the exact time in ${unit}.`,
        answer: String(H * n),
        verify: [`${y0} (1/2)^(T/${H}) = ${y1}`],
        hint: md`Each half-life halves the mass. How many halvings take ${y0} down to ${y1}?`,
        solution: [
          { math: md`\frac{${y1}}{${y0}} = \left(\frac{1}{2}\right)^{${n}}`, note: md`${n === 1 ? "One halving" : `${n} halvings`} in a row.` },
          { math: md`t = ${n} \cdot ${H} = ${H * n}`, note: md`${n} half-lives of ${H} ${unit} each.` },
        ],
      };
    }
    const [p, q] = r.pick([[5, 2], [5, 1], [10, 1], [8, 5], [20, 1], [5, 4]] as const);
    const y1 = (y0 * q) / p;
    return {
      prompt: md`A ${y0} g sample of a radioactive isotope has a half-life of ${H} ${unit}. How long until ${y1} g remain? Give the exact time in ${unit} (type $\frac{10\ln 5}{\ln 2}$ as 10 ln(5)/ln(2)).`,
      answer: `${H} ${lnText(p, q)}/ln(2)`,
      verify: [`${y0} (1/2)^(T/${H}) = ${y1}`],
      hint: md`Write the model with the half-life built in: $m = ${y0}\left(\frac12\right)^{t/${H}}$. Set it equal to ${y1}, divide, and take logs.`,
      solution: [
        { math: md`${y0}\left(\tfrac{1}{2}\right)^{t/${H}} = ${y1}`, note: md`Half-life form of the model: the exponent counts half-lives.` },
        { math: md`\left(\tfrac{1}{2}\right)^{t/${H}} = \frac{${q}}{${p}}`, note: md`Divide by ${y0} and reduce.` },
        { math: md`\frac{t}{${H}} \ln\tfrac{1}{2} = \ln\frac{${q}}{${p}}`, note: "Take logs; the exponent comes down." },
        { math: md`t = ${H}\,\frac{${lnTex(p, q)}}{\ln 2} \approx ${((H * Math.log(p / q)) / Math.LN2).toFixed(2)}`, note: md`Both logs were negative; the minus signs cancel. In ${unit}.` },
      ],
    };
  }
  if (kind === 1) {
    const D = r.pick([3, 4, 5, 6, 10, 12]);
    const P0 = r.pick([50, 100, 200, 500, 1000]);
    const m = r.pick([2, 3, 4, 5, 6, 8, 10, 12, 20]);
    const P1 = P0 * m;
    const n = log2(m);
    return {
      prompt: md`A colony of ${P0} cells doubles every ${D} hours. How long until there are ${P1} cells? Give the exact time in hours${n === null ? " (type $\\frac{10\\ln 5}{\\ln 2}$ as 10 ln(5)/ln(2))" : ""}.`,
      answer: n === null ? `${D} ln(${m})/ln(2)` : String(D * n),
      verify: [`${P0} 2^(T/${D}) = ${P1}`],
      hint: md`Doubling-time form: $P = ${P0} \cdot 2^{t/${D}}$. The exponent counts doublings. Set $P = ${P1}$.`,
      solution: [
        { math: md`${P0} \cdot 2^{t/${D}} = ${P1}`, note: "Doubling-time form of the model." },
        { math: md`2^{t/${D}} = ${m}`, note: md`Divide by ${P0}.` },
        n === null
          ? { math: md`t = ${D}\,\frac{\ln ${m}}{\ln 2} \approx ${((D * Math.log(m)) / Math.LN2).toFixed(2)}`, note: md`Take logs and multiply by ${D}. In hours.` }
          : { math: md`\frac{t}{${D}} = ${n}, \qquad t = ${D * n}`, note: md`$${m} = 2^{${n}}$: ${n} doublings of ${D} hours each.` },
      ],
    };
  }
  const k = r.pick([0.02, 0.04, 0.05, 0.1, 0.25]);
  const m = r.pick([2, 3, 4, 5, 10]);
  return {
    prompt: md`An investment grows continuously: $\frac{dy}{dt} = ${k}y$ with $t$ in years. How long until it is ${m} times its starting value? Give the exact time (type $\frac{\ln 3}{0.05}$ as ln(3)/0.05).`,
    answer: `ln(${m})/${k}`,
    verify: [`e^(${k} T) = ${m}`],
    hint: md`The solution is $y = y_0 e^{${k}t}$. You want $y = ${m}y_0$; divide by $y_0$ and take logs.`,
    solution: [
      { math: md`y_0 e^{${k}t} = ${m}y_0`, note: md`Solution of $y' = ${k}y$, set equal to ${m} times the start.` },
      { math: md`${k}t = \ln ${m}`, note: md`Divide by $y_0$, then take logs.` },
      { math: md`t = \frac{\ln ${m}}{${k}} \approx ${(Math.log(m) / k).toFixed(2)}`, note: "Years." },
    ],
  };
};

const solveGrowthIVP: Generator = (r) => {
  const kind = r.int(0, 2);
  const y0 = r.pick([2, 3, 5, 8, 10, 20, 50, 100]);
  if (kind === 0) {
    const k = r.pick([-3, -2, -1, 1, 2, 3, 0.5, -0.5, 0.25, -0.25, 0.1, -0.2]);
    const kTex = k === 1 ? "" : k === -1 ? "-" : String(k);
    return {
      prompt: md`Solve the initial value problem $\frac{dy}{dt} = ${kTex}y$, $y(0) = ${y0}$. Give $y$ as a function of $t$ (type $5e^{3t}$ as 5e^(3t)).`,
      answer: `${y0}e^(${kTex}t)`,
      verify: [`ln(y/${y0}) = ${k} t`],
      hint: md`Every solution of $y' = ky$ is $y = Ce^{kt}$, and $C$ is the value at $t = 0$.`,
      solution: [
        { math: md`y = Ce^{${kTex}t}`, note: md`The general solution of $y' = ky$ with $k = ${k}$.` },
        { math: md`y(0) = Ce^{0} = C = ${y0}`, note: "The initial condition fixes the constant." },
        { math: md`y = ${y0}e^{${kTex}t}`, note: k > 0 ? "Growth." : "Decay." },
      ],
    };
  }
  if (kind === 1) {
    const T = r.pick([2, 3, 4, 5, 6]);
    const m = r.pick([2, 3, 4, 5]);
    return {
      prompt: md`A quantity satisfies $y' = ky$ with $y(0) = ${y0}$ and $y(${T}) = ${y0 * m}$. Find $y$ as a function of $t$ (type $5e^{3t}$ as 5e^(3t); you may also write it with a power of ${m}).`,
      answer: `${y0}e^((ln(${m})/${T})t)`,
      verify: [`ln(y/${y0}) = ln(${m}) t/${T}`],
      hint: md`Start from $y = ${y0}e^{kt}$ and use the second condition to find $k$. Then write the answer. $${y0} \cdot ${m}^{t/${T}}$ is the same function.`,
      solution: [
        { math: md`y = ${y0}e^{kt}`, note: md`$y(0) = ${y0}$ gives the constant.` },
        { math: md`${y0}e^{${T}k} = ${y0 * m}, \qquad e^{${T}k} = ${m}`, note: md`Use $y(${T}) = ${y0 * m}$.` },
        { math: md`k = \frac{\ln ${m}}{${T}}`, note: "Take logs." },
        { math: md`y = ${y0}e^{(\ln ${m})t/${T}} = ${y0} \cdot ${m}^{t/${T}}`, note: md`Since $e^{\ln ${m}} = ${m}$, the two forms are equal. The second one says: it multiplies by ${m} every ${T} units of time.` },
      ],
    };
  }
  const k = r.pick([-2, -1, 1, 2, 3, 0.5, -0.5]);
  const t0 = r.pick([1, 2, 3, 4]);
  const kTex = k === 1 ? "" : k === -1 ? "-" : String(k);
  return {
    prompt: md`Solve $\frac{dy}{dt} = ${kTex}y$ with $y(${t0}) = ${y0}$. Give $y$ as a function of $t$ (type $5e^{3(t - 2)}$ as 5e^(3(t - 2))).`,
    answer: `${y0}e^(${kTex}(t - ${t0}))`,
    verify: [`ln(y/${y0}) = ${k}(t - ${t0})`],
    hint: md`The general solution is $Ce^{${kTex}t}$. The condition isn't at $t = 0$, so $C$ isn't ${y0}. Either solve for $C$, or shift time: $y = ${y0}e^{k(t - ${t0})}$ equals ${y0} at $t = ${t0}$.`,
    solution: [
      { math: md`y = Ce^{${kTex}t}`, note: "General solution." },
      { math: md`Ce^{${k * t0}} = ${y0}, \qquad C = ${y0}e^{${-k * t0}}`, note: md`Substitute $t = ${t0}$, $y = ${y0}$.` },
      { math: md`y = ${y0}e^{${-k * t0}}e^{${kTex}t} = ${y0}e^{${kTex}(t - ${t0})}`, note: md`Combine the exponents. The shifted form shows the condition directly: at $t = ${t0}$ the exponent is 0.` },
    ],
  };
};

// ── Lesson 2: Newton's law of cooling ───────────────────────────────────────

const coolingConstant: Generator = (r) => {
  const kind = r.int(0, 2);
  const t1 = r.pick([5, 10, 15, 20, 30]);
  if (kind === 0) {
    const A = r.pick([15, 20, 22, 25]);
    const G = r.pick([40, 60, 72, 80, 90]);
    const m = r.pick([2, 3, 4, 5, 6, 8].filter((d) => G % d === 0));
    const T0 = A + G;
    const T1 = A + G / m;
    return {
      prompt: md`A cup of tea at $${T0}^\circ$C sits in a room at $${A}^\circ$C. After ${t1} minutes it is $${T1}^\circ$C. Using $\frac{dT}{dt} = -k(T - ${A})$, find $k$ exactly (type $\frac{\ln 2}{10}$ as ln(2)/10).`,
      answer: `ln(${m})/${t1}`,
      verify: [`${A} + (${T0} - ${A}) e^(-${t1} k) = ${T1}`],
      hint: md`Work with the gap $T - ${A}$. It starts at ${G} and is ${G / m} after ${t1} minutes, so the gap has been divided by ${m}: $${G}e^{-${t1}k} = ${G / m}$.`,
      solution: [
        { math: md`T - ${A} = ${G}e^{-kt}`, note: md`The gap decays exponentially from its starting value $${T0} - ${A} = ${G}$.` },
        { math: md`${G}e^{-${t1}k} = ${T1 - A}`, note: md`At $t = ${t1}$ the gap is $${T1} - ${A} = ${T1 - A}$.` },
        { math: md`e^{-${t1}k} = \frac{1}{${m}}`, note: "Divide." },
        { math: md`k = \frac{\ln ${m}}{${t1}} \approx ${(Math.log(m) / t1).toFixed(4)}`, note: md`Take logs: $-${t1}k = -\ln ${m}$. Per minute.` },
      ],
    };
  }
  if (kind === 1) {
    const A = r.pick([20, 22, 24, 25]);
    const G = r.pick([12, 16, 18, 20]);
    const m = r.pick([2, 3, 4].filter((d) => G % d === 0));
    const T0 = A - G;
    const T1 = A - G / m;
    return {
      prompt: md`A drink at $${T0}^\circ$C is taken from the fridge into a room at $${A}^\circ$C. After ${t1} minutes it is $${T1}^\circ$C. Using $\frac{dT}{dt} = -k(T - ${A})$, find $k$ exactly (type $\frac{\ln 2}{10}$ as ln(2)/10).`,
      answer: `ln(${m})/${t1}`,
      verify: [`${A} + (${T0} - ${A}) e^(-${t1} k) = ${T1}`],
      hint: md`Warming works the same way. The gap $T - ${A}$ starts at $-${G}$ and is $-${G / m}$ after ${t1} minutes: it has been divided by ${m}.`,
      solution: [
        { math: md`T - ${A} = -${G}e^{-kt}`, note: md`The gap is negative because the drink is colder than the room. It still shrinks by the factor $e^{-kt}$.` },
        { math: md`-${G}e^{-${t1}k} = -${G / m}`, note: md`At $t = ${t1}$ the gap is $${T1} - ${A} = -${G / m}$.` },
        { math: md`e^{-${t1}k} = \frac{1}{${m}}`, note: "Divide; the signs cancel." },
        { math: md`k = \frac{\ln ${m}}{${t1}} \approx ${(Math.log(m) / t1).toFixed(4)}`, note: "Per minute." },
      ],
    };
  }
  const A = r.pick([20, 25]);
  const G0 = r.pick([60, 70, 80, 90]);
  const G1 = r.pick([30, 40, 45, 50].filter((g) => g < G0 && gcd(G0, g) < g));
  const g = gcd(G0, G1);
  const [p, q] = [G0 / g, G1 / g];
  return {
    prompt: md`Soup at $${A + G0}^\circ$C cools in a kitchen at $${A}^\circ$C. After ${t1} minutes it is $${A + G1}^\circ$C. Using $\frac{dT}{dt} = -k(T - ${A})$, find $k$ exactly (type $\frac{1}{10}\ln\frac{7}{4}$ as ln(7/4)/10).`,
    answer: `${lnText(p, q)}/${t1}`,
    verify: [`${A} + ${G0} e^(-${t1} k) = ${A + G1}`],
    hint: md`The gap goes from ${G0} to ${G1} in ${t1} minutes: $${G0}e^{-${t1}k} = ${G1}$. Solve for $k$; the fraction reduces.`,
    solution: [
      { math: md`${G0}e^{-${t1}k} = ${G1}`, note: md`Gap at the start, ${G0}; gap at $t = ${t1}$, ${G1}.` },
      { math: md`e^{-${t1}k} = \frac{${G1}}{${G0}} = \frac{${q}}{${p}}`, note: "Divide and reduce." },
      { math: md`-${t1}k = \ln\frac{${q}}{${p}} = -\ln\frac{${p}}{${q}}`, note: md`Logs; flipping the fraction flips the sign.` },
      { math: md`k = \frac{1}{${t1}}\ln\frac{${p}}{${q}} \approx ${(Math.log(p / q) / t1).toFixed(4)}`, note: "Per minute." },
    ],
  };
};

const coolingTime: Generator = (r) => {
  const kind = r.int(0, 2);
  const A = r.pick([15, 20, 22, 25]);
  if (kind < 2) {
    const H = r.pick([5, 8, 10, 12, 15, 20]);
    const G0 = r.pick([40, 60, 80, 120, 160]);
    const n = r.int(1, 3);
    const powerOfTwo = kind === 0;
    const ratio = powerOfTwo ? [2 ** n, 1] : r.pick([[5, 2], [5, 1], [10, 1], [8, 5], [20, 1], [5, 4]] as const).slice();
    const [p, q] = ratio as [number, number];
    const G1 = (G0 * q) / p;
    if (!Number.isInteger(G1)) return coolingTime(r);
    const T0 = A + G0;
    const T2 = A + G1;
    return {
      prompt: md`A metal block at $${T0}^\circ$C is left in a room at $${A}^\circ$C. The gap between the block and the room halves every ${H} minutes. How long until the block is $${T2}^\circ$C? Give the exact time in minutes${powerOfTwo ? "" : " (type $\\frac{10\\ln 5}{\\ln 2}$ as 10 ln(5)/ln(2))"}.`,
      answer: powerOfTwo ? String(H * n) : `${H} ${lnText(p, q)}/ln(2)`,
      verify: [`${A} + ${G0} (1/2)^(T/${H}) = ${T2}`],
      hint: md`Write the gap in half-life form: $T - ${A} = ${G0}\left(\frac12\right)^{t/${H}}$. You need the gap to be $${T2} - ${A} = ${G1}$.`,
      solution: [
        { math: md`${G0}\left(\tfrac12\right)^{t/${H}} = ${G1}`, note: md`The gap starts at ${G0} and must reach ${G1}. "Halves every ${H} minutes" is $k = \frac{\ln 2}{${H}}$, so $e^{-kt} = \left(\frac12\right)^{t/${H}}$.` },
        { math: md`\left(\tfrac12\right)^{t/${H}} = \frac{${q}}{${p}}`, note: "Divide and reduce." },
        powerOfTwo
          ? { math: md`\frac{t}{${H}} = ${n}, \qquad t = ${H * n}`, note: md`$\frac{1}{${p}} = \left(\frac12\right)^{${n}}$: ${n} halvings.` }
          : { math: md`t = ${H}\,\frac{${lnTex(p, q)}}{\ln 2} \approx ${((H * Math.log(p / q)) / Math.LN2).toFixed(2)}`, note: md`Take logs of both sides and divide by $\ln\frac12 = -\ln 2$. Minutes.` },
      ],
    };
  }
  const k = r.pick([0.02, 0.04, 0.05, 0.1]);
  const G0 = r.pick([50, 60, 70, 80]);
  const G1 = r.pick([5, 10, 15, 20, 30]);
  const T0 = A + G0;
  const T2 = A + G1;
  const t = Math.log(G0 / G1) / k;
  return {
    prompt: md`Coffee at $${T0}^\circ$C is poured in a room at $${A}^\circ$C, and $\frac{dT}{dt} = -${k}(T - ${A})$ with $t$ in minutes. When does it reach $${T2}^\circ$C? Round to 1 decimal place.`,
    answer: t.toFixed(1),
    tolerance: 0.05,
    hint: md`$T - ${A} = ${G0}e^{-${k}t}$. Set the gap to $${T2} - ${A} = ${G1}$ and solve with a log.`,
    solution: [
      { math: md`${G0}e^{-${k}t} = ${G1}`, note: md`Gap at the start ${G0}; target gap ${G1}.` },
      { math: md`e^{-${k}t} = \frac{${G1}}{${G0}}`, note: "Divide." },
      { math: md`t = \frac{1}{${k}}\ln\frac{${G0}}{${G1}} \approx ${t.toFixed(1)}`, note: md`$-${k}t = \ln\frac{${G1}}{${G0}}$; flipping the fraction removes the sign. Minutes.` },
    ],
  };
};

const coolingSolution: Generator = (r) => {
  const kind = r.int(0, 2);
  const A = r.pick([10, 15, 20, 22, 25]);
  const G = r.pick([-15, -10, 30, 50, 60, 70, 80, 160]);
  const T0 = A + G;
  if (kind === 0) {
    const k = r.pick([0.02, 0.04, 0.05, 0.1, 0.2]);
    return {
      prompt: md`An object at $${T0}^\circ$C is placed in surroundings at $${A}^\circ$C, and $\frac{dT}{dt} = -${k}(T - ${A})$. Find $T$ as a function of $t$ (type $20 + 70e^{-0.1t}$ as 20 + 70e^(-0.1t)).`,
      answer: sumText(A, G, `e^(-${k}t)`),
      verify: [`ln((T - ${A})/(${G})) = -${k} t`],
      hint: md`The gap $u = T - ${A}$ satisfies $u' = -${k}u$, so it decays from its starting value $${T0} - ${A} = ${G}$.`,
      solution: [
        { math: md`u = T - ${A}, \qquad u' = -${k}u`, note: md`Subtracting the constant ${A} doesn't change the derivative.` },
        { math: md`u = ${G}e^{-${k}t}`, note: md`Growth and decay: $u(0) = ${T0} - ${A} = ${G}$.` },
        { math: md`T = ${sumTex(A, G, `e^{-${k}t}`)}`, note: md`Add the room temperature back. As $t \to \infty$, $T \to ${A}$.` },
      ],
    };
  }
  if (kind === 1) {
    const H = r.pick([5, 8, 10, 12, 20]);
    return {
      prompt: md`An object at $${T0}^\circ$C is placed in surroundings at $${A}^\circ$C. The gap to the surroundings halves every ${H} minutes. Find $T$ as a function of $t$ in minutes (type $20 + 70\left(\frac12\right)^{t/10}$ as 20 + 70(1/2)^(t/10)).`,
      answer: sumText(A, G, `(1/2)^(t/${H})`),
      verify: [`ln((T - ${A})/(${G})) = -(ln(2)/${H}) t`],
      hint: md`A gap that halves every ${H} minutes is $${G}\left(\frac12\right)^{t/${H}}$. Add ${A}.`,
      solution: [
        { math: md`T - ${A} = ${G}\left(\tfrac12\right)^{t/${H}}`, note: md`Starting gap ${G}; the exponent counts how many ${H}-minute halvings have happened.` },
        { math: md`T = ${sumTex(A, G, `\\left(\\tfrac12\\right)^{t/${H}}`)}`, note: md`Equivalently $${sumTex(A, G, `e^{-(\\ln 2/${H})t}`)}$, since $\left(\frac12\right)^{t/${H}} = e^{-(\ln 2)t/${H}}$.` },
      ],
    };
  }
  const k = r.pick([0.02, 0.05, 0.1]);
  const t1 = r.pick([5, 10, 15, 20, 30]);
  const T = A + G * Math.exp(-k * t1);
  return {
    prompt: md`An object at $${T0}^\circ$C is placed in surroundings at $${A}^\circ$C, and $\frac{dT}{dt} = -${k}(T - ${A})$ with $t$ in minutes. Find the temperature after ${t1} minutes, rounded to 1 decimal place.`,
    answer: T.toFixed(1),
    tolerance: 0.05,
    hint: md`$T = ${sumTex(A, G, `e^{-${k}t}`)}$. Substitute $t = ${t1}$.`,
    solution: [
      { math: md`T = ${sumTex(A, G, `e^{-${k}t}`)}`, note: md`Gap $${T0} - ${A} = ${G}$, decaying at rate ${k}.` },
      { math: md`T(${t1}) = ${sumTex(A, G, `e^{${-k * t1}}`)} \approx ${sumTex(A, Math.round(G * Math.exp(-k * t1) * 100) / 100, "")}`, note: md`$e^{${-k * t1}} \approx ${Math.exp(-k * t1).toFixed(4)}$.` },
      { math: md`T(${t1}) \approx ${T.toFixed(1)}`, note: "Degrees Celsius." },
    ],
  };
};

// ── Lesson 3: Mixing problems ───────────────────────────────────────────────

const writeMixingODE: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    const V = r.pick([50, 100, 200, 400, 500, 1000]);
    const rate = r.pick([2, 3, 4, 5, 8, 10]);
    const c = r.pick([0, 1, 2, 3, 4]);
    const inflow = c === 0 ? "Pure water" : `Brine with ${c} g of salt per liter`;
    return {
      prompt: md`A tank holds ${V} L of well-stirred salt water. ${inflow} flows in at ${rate} L/min, and the mixture drains at ${rate} L/min. Let $Q(t)$ be the grams of salt in the tank. Write $\frac{dQ}{dt}$ as an expression in $Q$ (type $6 - \frac{2Q}{50}$ as 6 - 2Q/50).`,
      answer: c === 0 ? `-${rate}Q/${V}` : `${rate * c} - ${rate}Q/${V}`,
      hint: md`Rate in = flow × concentration in. Rate out = flow × concentration in the tank, and the tank's concentration is $\frac{Q}{${V}}$.`,
      solution: [
        { math: md`\text{rate in} = ${rate} \cdot ${c} = ${rate * c}`, note: md`L/min times g/L is g/min.${c === 0 ? " Pure water brings no salt." : ""}` },
        { math: md`\text{rate out} = ${rate} \cdot \frac{Q}{${V}}`, note: md`The outflow carries the tank's own concentration, $\frac{Q}{${V}}$ g/L. The volume stays ${V} L because the flows match.` },
        { math: md`\frac{dQ}{dt} = ${c === 0 ? "" : `${rate * c} `}- \frac{${rate}Q}{${V}}`, note: "Rate in minus rate out." },
      ],
    };
  }
  const V0 = r.pick([100, 200, 400, 500]);
  const rin = r.pick([2, 3, 4, 5, 6]);
  const rout = r.pick([1, 2, 3, 4, 5, 6].filter((x) => x !== rin));
  const c = r.pick([0, 1, 2]);
  const d = rin - rout;
  const inflow = c === 0 ? "Pure water" : `Brine with ${c} g/L of salt`;
  const vol = d > 0 ? `${V0} + ${coef(d)}t` : `${V0} - ${coef(-d)}t`;
  return {
    prompt: md`A tank starts with ${V0} L of well-stirred salt water. ${inflow} flows in at ${rin} L/min and the mixture drains at ${rout} L/min. Let $Q(t)$ be the grams of salt. Write $\frac{dQ}{dt}$ as an expression in $Q$ and $t$ (type $4 - \frac{2Q}{100 + t}$ as 4 - 2Q/(100 + t)).`,
    answer: c === 0 ? `-${coef(rout)}Q/(${vol})` : `${rin * c} - ${coef(rout)}Q/(${vol})`,
    hint: md`The flows don't match, so the volume changes: $V(t) = ${V0} + (${rin} - ${rout})t$. The concentration in the tank is $\frac{Q}{V(t)}$.`,
    solution: [
      { math: md`V(t) = ${V0} + (${rin} - ${rout})t = ${vol}`, note: md`Each minute ${rin} L come in and ${rout} L go out.` },
      { math: md`\text{rate in} = ${rin} \cdot ${c} = ${rin * c}, \qquad \text{rate out} = ${rout} \cdot \frac{Q}{${vol}}`, note: "Flow times concentration, each side." },
      { math: md`\frac{dQ}{dt} = ${c === 0 ? "" : `${rin * c} `}- \frac{${coef(rout)}Q}{${vol}}`, note: d < 0 ? md`Valid until the tank empties at $t = ${V0 / -d}$.` : "Rate in minus rate out." },
    ],
  };
};

const mixingLongRun: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const V = r.pick([50, 100, 200, 400, 500]);
    const rate = r.pick([2, 3, 4, 5, 8]);
    const c = r.pick([1, 2, 3, 4]);
    const Q0 = r.pick([0, 10, 20, 50]);
    return {
      prompt: md`A ${V} L tank starts with ${Q0} g of salt. Brine at ${c} g/L flows in at ${rate} L/min and the mixture drains at ${rate} L/min. How many grams of salt are in the tank in the long run?`,
      answer: String(c * V),
      verify: [`${rate * c} - ${rate} L/${V} = 0`],
      hint: md`In the long run the amount settles where $\frac{dQ}{dt} = 0$: rate in equals rate out.`,
      solution: [
        { math: md`\frac{dQ}{dt} = ${rate * c} - \frac{${rate}Q}{${V}}`, note: "Rate in minus rate out." },
        { math: md`${rate * c} - \frac{${rate}Q}{${V}} = 0 \quad\Rightarrow\quad Q = ${c * V}`, note: md`The equilibrium. It's $cV$: the tank ends up at the inflow concentration ${c} g/L.` },
        { math: md`Q(t) = ${c * V} + (${Q0} - ${c * V})e^{-${frac(rate, V)}t} \to ${c * V}`, note: md`The gap to equilibrium decays, so every start leads to ${c * V} g.` },
      ],
    };
  }
  if (kind === 1) {
    const V = r.pick([50, 100, 200, 400]);
    const rate = r.pick([2, 4, 5, 8, 10]);
    const Q0 = r.pick([20, 40, 50, 80, 100]);
    const [p, q] = r.pick([[2, 1], [4, 1], [5, 1], [10, 1], [5, 2], [8, 5], [5, 4]] as const);
    const Q1 = (Q0 * q) / p;
    if (!Number.isInteger(Q1)) return mixingLongRun(r);
    return {
      prompt: md`A ${V} L tank holds ${Q0} g of dissolved salt. Pure water flows in at ${rate} L/min and the mixture drains at ${rate} L/min. How long until only ${Q1} g of salt remain? Give the exact time in minutes (type $25\ln 4$ as 25 ln(4)).`,
      answer: `${V % rate === 0 ? V / rate : `(${frac(V, rate)})`} ${lnText(p, q)}`,
      verify: [`${Q0} e^(-${rate} T/${V}) = ${Q1}`],
      hint: md`With pure water coming in, $\frac{dQ}{dt} = -\frac{${rate}}{${V}}Q$: plain exponential decay from ${Q0}.`,
      solution: [
        { math: md`\frac{dQ}{dt} = 0 - \frac{${rate}Q}{${V}}, \qquad Q = ${Q0}e^{-${frac(rate, V)}t}`, note: md`Nothing comes in; the outflow carries $\frac{Q}{${V}}$ g/L.` },
        { math: md`${Q0}e^{-${frac(rate, V)}t} = ${Q1}, \qquad e^{-${frac(rate, V)}t} = \frac{${q}}{${p}}`, note: "Set the amount to the target and divide." },
        { math: md`t = ${fracTex(V, rate)}\,${lnTex(p, q)} \approx ${((V / rate) * Math.log(p / q)).toFixed(1)}`, note: md`Take logs and multiply by $-\frac{${V}}{${rate}}$; flipping the fraction absorbs the sign. Minutes.` },
      ],
    };
  }
  const V = r.pick([60, 120, 240, 300, 600]);
  const rate = r.pick([2, 3, 4, 5, 6, 10]);
  const c = r.pick([1, 2, 3]);
  const m = r.pick([2, 3, 4, 5, 6, 10].filter((d) => (c * V) % d === 0));
  const Q1 = (c * V * (m - 1)) / m;
  return {
    prompt: md`A ${V} L tank starts full of pure water. Brine at ${c} g/L flows in at ${rate} L/min and the mixture drains at ${rate} L/min. How long until the tank holds ${Q1} g of salt? Give the exact time in minutes (type $30\ln 4$ as 30 ln(4)).`,
    answer: `${V % rate === 0 ? V / rate : `(${frac(V, rate)})`} ln(${m})`,
    verify: [`${c * V} (1 - e^(-${rate} T/${V})) = ${Q1}`],
    hint: md`The equilibrium is $cV = ${c * V}$ g, and $Q = ${c * V}\left(1 - e^{-${frac(rate, V)}t}\right)$. The target is $\frac{${m - 1}}{${m}}$ of the way there.`,
    solution: [
      { math: md`Q = ${c * V} + (0 - ${c * V})e^{-${frac(rate, V)}t} = ${c * V}\left(1 - e^{-${frac(rate, V)}t}\right)`, note: md`Equilibrium $cV = ${c * V}$, starting gap $-${c * V}$.` },
      { math: md`1 - e^{-${frac(rate, V)}t} = \frac{${Q1}}{${c * V}} = \frac{${m - 1}}{${m}}`, note: "Divide by the equilibrium amount." },
      { math: md`e^{-${frac(rate, V)}t} = \frac{1}{${m}}, \qquad t = ${fracTex(V, rate)}\ln ${m} \approx ${((V / rate) * Math.log(m)).toFixed(1)}`, note: md`The remaining gap is $\frac{1}{${m}}$ of the original. Minutes.` },
    ],
  };
};

const mixingSolution: Generator = (r) => {
  const kind = r.int(0, 1);
  if (kind === 0) {
    const V = r.pick([50, 100, 200, 400]);
    const rate = r.pick([2, 4, 5, 8, 10]);
    const c = r.pick([1, 2, 3]);
    const Q0 = r.pick([0, 10, 20, 50, 500, 800].filter((q) => q !== c * V));
    const E = c * V;
    const k = frac(rate, V);
    return {
      prompt: md`A ${V} L tank starts with ${Q0} g of salt. Brine at ${c} g/L flows in at ${rate} L/min and the mixture drains at ${rate} L/min. Find $Q(t)$, the grams of salt after $t$ minutes (type $200 - 150e^{-t/20}$ as 200 - 150e^(-t/20)).`,
      answer: sumText(E, Q0 - E, `e^(-${rate}t/${V})`),
      hint: md`$\frac{dQ}{dt} = ${rate * c} - \frac{${rate}}{${V}}Q = -\frac{${rate}}{${V}}(Q - ${E})$. The gap to ${E} decays exponentially.`,
      solution: [
        { math: md`\frac{dQ}{dt} = ${rate * c} - \frac{${rate}Q}{${V}} = -${k === "1" ? "" : k}(Q - ${E})`, note: md`Rate in minus rate out, then factor. The equilibrium is $Q = ${E}$.` },
        { math: md`Q - ${E} = (${Q0} - ${E})e^{-${k}t}`, note: md`The gap $u = Q - ${E}$ satisfies $u' = -${k}u$, with $u(0) = ${Q0 - E}$.` },
        { math: md`Q(t) = ${sumTex(E, Q0 - E, `e^{-${k}t}`)}`, note: Q0 < E ? md`Starts at ${Q0} and climbs toward ${E}.` : md`Starts at ${Q0} and falls toward ${E}.` },
      ],
    };
  }
  const V0 = r.pick([100, 200, 400]);
  const Q0 = r.pick([20, 40, 50, 80]);
  const [rin, rout] = r.pick([[3, 2], [4, 2], [5, 3], [4, 1], [2, 4], [1, 3], [2, 3], [3, 1]] as const);
  const d = rin - rout;
  const vol = d > 0 ? `${V0} + ${coef(d)}t` : `${V0} - ${coef(-d)}t`;
  const expo = fracTex(rout, Math.abs(d));
  const expoText = frac(rout, Math.abs(d));
  const answer = d > 0 ? `${Q0}(${V0}/(${vol}))^(${expoText})` : `${Q0}((${vol})/${V0})^(${expoText})`;
  const answerTex = d > 0 ? `${Q0}\\left(\\frac{${V0}}{${vol}}\\right)^{${expo}}` : `${Q0}\\left(\\frac{${vol}}{${V0}}\\right)^{${expo}}`;
  return {
    prompt: md`A tank starts with ${V0} L of water in which ${Q0} g of salt is dissolved. Pure water flows in at ${rin} L/min and the mixture drains at ${rout} L/min. Find $Q(t)$, the grams of salt after $t$ minutes${d < 0 ? ", while the tank still has water" : ""} (type $40\left(\frac{100}{100 + t}\right)^{2}$ as 40(100/(100 + t))^2).`,
    answer,
    hint: md`The volume is $${vol}$, so $\frac{dQ}{dt} = -\frac{${rout}Q}{${vol}}$. This is separable: $\frac{dQ}{Q} = -\frac{${rout}\,dt}{${vol}}$.`,
    solution: [
      { math: md`\frac{dQ}{dt} = -\frac{${rout}}{${vol}}Q`, note: md`Volume $V(t) = ${V0} + (${rin} - ${rout})t$; the outflow carries concentration $\frac{Q}{V(t)}$.` },
      { math: md`\int \frac{dQ}{Q} = -\int \frac{${rout}}{${vol}}\,dt`, note: "Separate the variables." },
      { math: md`\ln Q = ${d > 0 ? "-" : ""}${fracTex(rout, Math.abs(d))}\ln\left(${vol}\right) + C`, note: md`$\int \frac{${rout}\,dt}{${vol}} = \frac{${rout}}{${d}}\ln(${vol})$, the chain rule in reverse: the derivative of $${vol}$ is $${d}$.${d < 0 ? " Two minus signs make a plus." : ""}` },
      { math: md`Q = C_1 (${vol})^{${d > 0 ? `-${expo}` : expo}}`, note: "Exponentiate. The constant collects into a factor." },
      { math: md`Q(t) = ${answerTex}`, note: md`$Q(0) = ${Q0}$ fixes $C_1$; writing it as a ratio to ${V0} makes the check at $t = 0$ obvious.` },
    ],
  };
};

// ── Lesson 4: Euler's method ────────────────────────────────────────────────

type Field = { tex: string; value: (t: Frac, y: Frac) => Frac; text: (t: string, y: string) => string };

function linearField(a: number, b: number, c: number): Field {
  return {
    tex: poly([[a, "t"], [b, "y"], [c, ""]]),
    value: (t, y) => fadd(fadd(fmul(fr(a), t), fmul(fr(b), y)), fr(c)),
    text: (t, y) => `${a}*(${t}) + ${b}*(${y}) + ${c}`,
  };
}

/** The rows of an Euler table as KaTeX. */
function eulerTable(rows: { t: Frac; y: Frac; f: Frac | null }[]): string {
  const body = rows.map((row, i) => `${i} & ${ftex(row.t)} & ${ftex(row.y)} & ${row.f ? ftex(row.f) : ""}`).join(" \\\\ ");
  return md`\begin{array}{c|c|c|c} n & t_n & y_n & f(t_n, y_n) \\ \hline ${body} \end{array}`;
}

/** Run Euler's method exactly, returning the problem's answer, verify string and solution steps. */
function eulerRun(f: Field, y0: number, h: Frac, n: number, exactAt?: string) {
  const rows: { t: Frac; y: Frac; f: Frac | null }[] = [];
  let t = fr(0);
  let y = fr(y0);
  let expr = String(y0);
  const steps: Step[] = [];
  for (let i = 0; i < n; i++) {
    const slope = f.value(t, y);
    rows.push({ t, y, f: slope });
    const next = fadd(y, fmul(h, slope));
    steps.push({
      math: md`y_{${i + 1}} = ${ftex(y)} + ${ftex(h)}\left(${ftexP(slope)}\right) = ${ftex(next)}`,
      note: md`At $t_{${i}} = ${ftex(t)}$ the slope is $f(${ftex(t)}, ${ftex(y)}) = ${ftex(slope)}$. Move one step along that slope.`,
    });
    expr = `(${expr}) + (${ftext(h)})*(${f.text(ftext(t), expr)})`;
    t = fadd(t, h);
    y = next;
  }
  rows.push({ t, y, f: null });
  steps.push({ math: eulerTable(rows), note: md`$y_{${n}} = ${ftex(y)} \approx ${(y.n / y.d).toFixed(4)}$ is the Euler approximation to $y(${ftex(t)})$.${exactAt ? ` ${exactAt}` : ""}` });
  return { answer: ftext(y), verify: [`y = ${expr}`], steps, tEnd: t };
}

const eulerLinear: Generator = (r) => {
  const a = r.pick([-2, -1, 1, 1, 2]);
  const b = r.pick([-1, 1, 1, 2]);
  const c = r.pick([0, 0, 0, 1, -1]);
  const y0 = r.pick([0, 1, 1, 2, -1, 3]);
  const h = r.pick([fr(1, 2), fr(1, 2), fr(1, 4), fr(1, 5)]);
  const n = r.int(2, 3);
  const f = linearField(a, b, c);
  const run = eulerRun(f, y0, h, n);
  return {
    prompt: md`Use Euler's method with step $h = ${ftex(h)}$ on $y' = ${f.tex}$, $y(0) = ${y0}$. Find $y_{${n}}$, the approximation to $y(${ftex(run.tEnd)})$ after ${n} steps. Give an exact fraction.`,
    answer: run.answer,
    verify: run.verify,
    hint: md`Each step is $y_{n+1} = y_n + h\,f(t_n, y_n)$ with $t_n = nh$ and $f(t, y) = ${f.tex}$. Keep the fractions exact.`,
    solution: run.steps,
  };
};

const eulerNonlinear: Generator = (r) => {
  const fields: Field[] = [
    { tex: "y^2", value: (_t, y) => fmul(y, y), text: (_t, y) => `(${y})^2` },
    { tex: "ty", value: (t, y) => fmul(t, y), text: (t, y) => `(${t})*(${y})` },
    { tex: "y^2 - t", value: (t, y) => fadd(fmul(y, y), fmul(fr(-1), t)), text: (t, y) => `(${y})^2 - (${t})` },
    { tex: "t^2 + y", value: (t, y) => fadd(fmul(t, t), y), text: (t, y) => `(${t})^2 + (${y})` },
    { tex: "t - y^2", value: (t, y) => fadd(t, fmul(fr(-1), fmul(y, y))), text: (t, y) => `(${t}) - (${y})^2` },
    { tex: "1 + y^2", value: (_t, y) => fadd(fr(1), fmul(y, y)), text: (_t, y) => `1 + (${y})^2` },
    { tex: "2t - y^2", value: (t, y) => fadd(fmul(fr(2), t), fmul(fr(-1), fmul(y, y))), text: (t, y) => `2*(${t}) - (${y})^2` },
  ];
  const f = r.pick(fields);
  const y0 = r.pick(f.tex === "y^2" || f.tex === "ty" ? [1, 2, -1] : [0, 1, 2, -1]);
  const h = r.pick([fr(1, 2), fr(1, 2), fr(1, 4)]);
  const run = eulerRun(f, y0, h, 2);
  return {
    prompt: md`Use Euler's method with step $h = ${ftex(h)}$ on $y' = ${f.tex}$, $y(0) = ${y0}$. Find $y_2$, the approximation to $y(${ftex(run.tEnd)})$ after 2 steps. Give an exact fraction.`,
    answer: run.answer,
    verify: run.verify,
    hint: md`Euler doesn't care that the equation is nonlinear: $y_{n+1} = y_n + h\,f(t_n, y_n)$ with $f(t, y) = ${f.tex}$. Two steps, exact fractions.`,
    solution: run.steps,
  };
};

const eulerError: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const h1 = r.pick([0.1, 0.2, 0.5]);
    const h2 = r.pick([0.05, 0.1, 0.25, 0.025, 1].filter((h) => h !== h1));
    const E1 = r.pick([0.06, 0.08, 0.12, 0.2, 0.3]);
    const E2 = (E1 * h2) / h1;
    return {
      prompt: md`With step $h = ${h1}$, Euler's method for an initial value problem has an error of about ${E1} at $t = 2$. About what error do you expect with $h = ${h2}$? Use the fact that Euler's error is proportional to $h$.`,
      answer: String(Math.round(E2 * 1e6) / 1e6),
      tolerance: 1e-6,
      verify: [`E/${E1} = ${h2}/${h1}`],
      hint: md`Error $\approx Ch$. Changing $h$ by a factor changes the error by the same factor.`,
      solution: [
        { math: md`\frac{E_2}{E_1} = \frac{h_2}{h_1} = \frac{${h2}}{${h1}} = ${h2 / h1}`, note: "First-order method: error scales with the step." },
        { math: md`E_2 \approx ${E1} \cdot ${h2 / h1} = ${Math.round(E2 * 1e6) / 1e6}`, note: h2 < h1 ? "Smaller steps, smaller error, and more steps to compute." : "Bigger steps, bigger error." },
      ],
    };
  }
  const n = r.pick([2, 3, 4, 5, 6]);
  if (kind === 1) {
    return {
      prompt: md`Apply Euler's method to $y' = y$, $y(0) = 1$ with $h = \frac{1}{${n}}$, taking ${n} steps to reach $t = 1$. Find $y_{${n}}$ exactly (as a fraction or a power, like (3/2)^2).`,
      answer: `(${n + 1}/${n})^${n}`,
      verify: [`y = 1${` * (1 + 1/${n})`.repeat(n)}`],
      hint: md`With $f = y$ each step is $y_{k+1} = y_k + \frac{1}{${n}}y_k = \left(1 + \frac{1}{${n}}\right)y_k$: the same multiplier every time.`,
      solution: [
        { math: md`y_{k+1} = y_k + \tfrac{1}{${n}}\,y_k = \tfrac{${n + 1}}{${n}}\,y_k`, note: md`Euler step with $f(t, y) = y$ and $h = \frac{1}{${n}}$.` },
        { math: md`y_{${n}} = \left(\tfrac{${n + 1}}{${n}}\right)^{${n}} \cdot 1 = ${fracTex((n + 1) ** n, n ** n)} \approx ${(((n + 1) / n) ** n).toFixed(4)}`, note: md`${n} multiplications by the same factor. The exact value is $y(1) = e \approx 2.7183$.` },
      ],
    };
  }
  const approx = ((n + 1) / n) ** n;
  const err = Math.E - approx;
  return {
    prompt: md`Euler's method on $y' = y$, $y(0) = 1$ with $h = \frac{1}{${n}}$ gives $y_{${n}} = \left(\frac{${n + 1}}{${n}}\right)^{${n}}$ as its estimate of $y(1) = e$. How far below $e$ is it? Round to 3 decimal places.`,
    answer: err.toFixed(3),
    tolerance: 0.0005,
    hint: md`Compute $\left(\frac{${n + 1}}{${n}}\right)^{${n}}$ as a decimal and subtract it from $e \approx 2.718282$.`,
    solution: [
      { math: md`\left(\tfrac{${n + 1}}{${n}}\right)^{${n}} \approx ${approx.toFixed(5)}`, note: md`${n} Euler steps of size $\frac{1}{${n}}$.` },
      { math: md`e - ${approx.toFixed(5)} \approx ${err.toFixed(3)}`, note: md`Euler undershoots here because $e^t$ curves upward: each tangent line sits below the curve.` },
    ],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit2: Unit = {
  title: "Modeling",
  lessons: [
    {
      id: slug("Growth and decay"),
      title: "Growth and decay",
      summary: "Where the exponential comes from: a rate proportional to the amount, half-lives and doubling times.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 1 was about solving differential equations. This unit is about where they come from. A model starts with a sentence about how something changes, turns the sentence into an equation, and solves it. Then the solution makes predictions you can test.

The simplest sentence of all: **the rate of change is proportional to the amount present.** Bacteria divide, so twice as many bacteria produce twice as many new ones per hour. Money in an account earns interest in proportion to the balance. In a lump of radioactive material each atom has the same chance of decaying in the next second, so twice as many atoms means twice as many decays.`,
        },
        {
          kind: "key",
          title: "The proportional-rate model",
          body: md`If $y(t)$ is the amount at time $t$, then

$$\frac{dy}{dt} = ky$$

for some constant $k$. When $k > 0$ this is **growth**; when $k < 0$ it is **decay**. The constant is the *relative* rate of change, $k = \frac{y'}{y}$: the fraction of the amount added (or lost) per unit of time.`,
        },
        {
          kind: "why",
          title: "Why a proportional rate forces an exponential",
          body: md`The equation is separable (Unit 1). For $y \ne 0$,

$$\frac{1}{y}\,\frac{dy}{dt} = k \quad\Rightarrow\quad \int \frac{dy}{y} = \int k\,dt \quad\Rightarrow\quad \ln|y| = kt + C.$$

Exponentiate: $|y| = e^{C}e^{kt}$, so $y = \pm e^{C} e^{kt}$. Call the constant in front $A$. Then $y = Ae^{kt}$, and setting $t = 0$ shows $A = y(0)$. The constant function $y = 0$ is also a solution, and it is the case $A = 0$.

Here is the same fact said without calculus. "Grows by the same fraction each hour" means the amount is **multiplied** by a fixed factor each hour. Repeated multiplication is an exponential. The differential equation is just the instantaneous version of that sentence.`,
        },
        {
          kind: "proof",
          title: "Only one function fits",
          given: md`$y' = ky$ for all $t$, and $y(0) = y_0$`,
          prove: md`$y(t) = y_0 e^{kt}$`,
          steps: [
            { statement: md`Let $u(t) = y(t)\,e^{-kt}$.`, reason: "A helper function: the solution with its expected growth divided out." },
            { statement: md`$u' = y'e^{-kt} - ky\,e^{-kt}$`, reason: "Product rule and chain rule (Calculus 1)." },
            { statement: md`$u' = ky\,e^{-kt} - ky\,e^{-kt} = 0$`, reason: md`Substitute $y' = ky$.` },
            { statement: md`$u$ is constant`, reason: "A function with zero derivative everywhere is constant (Mean Value Theorem)." },
            { statement: md`$u(0) = y(0)e^{0} = y_0$`, reason: "Evaluate at 0." },
            { statement: md`$y(t)e^{-kt} = y_0$, so $y(t) = y_0e^{kt}$`, reason: md`Multiply both sides by $e^{kt}$.` },
          ],
        },
        {
          kind: "text",
          body: md`The proof does more than the separation argument: it never divides by $y$, so it covers $y_0 = 0$ too, and it shows there is no other solution hiding anywhere. Whatever starts at $y_0$ and obeys $y' = ky$ **must** be $y_0 e^{kt}$. That is why one measurement of the starting amount and one of the rate pin down the whole future.`,
        },
        {
          kind: "plot",
          x: [-3, 3],
          y: [-1, 8],
          curves: [{ expr: "a e^(k x)", label: "y = a e^{kt}" }],
          points: [{ x: 0, y: "a", label: "(0, {a})", color: 2 }],
          field: { dx: "1", dy: "k y", density: 14 },
          params: [
            { name: "a", tex: "y_0", min: 0.5, max: 4, step: 0.5, value: 2 },
            { name: "k", tex: "k", min: -1.5, max: 1.5, step: 0.1, value: 0.5 },
          ],
          caption: md`The arrows are the direction field of $y' = ky$: at height $y$ the slope is $ky$, so arrows get steeper farther from the axis. The curve threads through them. Slide $k$ past zero and growth turns into decay; slide $y_0$ and the curve changes height but keeps its shape.`,
        },
        {
          kind: "key",
          title: "Doubling time and half-life",
          body: md`For growth ($k > 0$) the **doubling time** $T_d$ is the time for the amount to double. For decay, write $y = y_0 e^{-kt}$ with $k > 0$; the **half-life** $T_h$ is the time for the amount to halve. Both come from the same calculation:

$$T_d = \frac{\ln 2}{k}, \qquad T_h = \frac{\ln 2}{k}.$$

The model can be written with the doubling time or half-life in the exponent, which is often the most readable form:

$$y = y_0 \cdot 2^{t/T_d} \qquad\text{or}\qquad y = y_0 \left(\tfrac12\right)^{t/T_h}.$$`,
        },
        {
          kind: "why",
          title: "Why the half-life doesn't depend on how much you start with",
          body: md`Set $y_0 e^{-kt} = \frac12 y_0$. The $y_0$ cancels at once: $e^{-kt} = \frac12$, so $-kt = \ln\frac12 = -\ln 2$ and $t = \frac{\ln 2}{k}$. The starting amount never entered.

That is a real physical statement. A gram of carbon-14 and a tonne of it both lose half their atoms in 5730 years, because each atom decides on its own; the ones around it don't matter. Every half-life halves whatever is left, so after $n$ half-lives a fraction $\left(\frac12\right)^n$ remains.

The two forms of the model are the same function. Since $2 = e^{\ln 2}$, we have $2^{t/T_d} = e^{(\ln 2)\,t/T_d}$, which is $e^{kt}$ exactly when $k = \frac{\ln 2}{T_d}$.`,
        },
        {
          kind: "example",
          title: "From a doubling time to a prediction",
          problem: md`A culture of 200 bacteria doubles every 3 hours. When will it reach 5000?`,
          steps: [
            { math: md`y = 200 \cdot 2^{t/3}`, note: md`Doubling-time form. Equivalently $200e^{kt}$ with $k = \frac{\ln 2}{3} \approx 0.231$ per hour.` },
            { math: md`200 \cdot 2^{t/3} = 5000 \quad\Rightarrow\quad 2^{t/3} = 25`, note: "Set the amount to the target and divide." },
            { math: md`\frac{t}{3}\ln 2 = \ln 25 \quad\Rightarrow\quad t = \frac{3\ln 25}{\ln 2} \approx 13.9 \text{ hours}`, note: md`Take logs. Sanity check: $2^{4} = 16 < 25 < 32 = 2^5$, so between 4 and 5 doublings, that is 12 to 15 hours.` },
          ],
        },
        {
          kind: "example",
          title: "Carbon dating",
          problem: md`Carbon-14 has a half-life of 5730 years. A bone contains 30% of the carbon-14 a living animal would have. How old is it?`,
          steps: [
            { math: md`\frac{y}{y_0} = \left(\tfrac12\right)^{t/5730} = 0.30`, note: "The starting amount is unknown, but only the ratio matters." },
            { math: md`\frac{t}{5730}\ln\tfrac12 = \ln 0.30`, note: "Logs of both sides." },
            { math: md`t = 5730\,\frac{\ln 0.30}{\ln 0.5} = 5730\,\frac{\ln\frac{10}{3}}{\ln 2} \approx 9950 \text{ years}`, note: md`Both logs are negative, so the ratio is positive. Between one half-life (50% left) and two (25% left), as it should be.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Solve $\frac{dy}{dt} = -0.25y$ with $y(0) = 80$. Give $y$ as a function of $t$ (type $e^{-0.25t}$ as e^(-0.25t)).`,
          answer: "80e^(-0.25t)",
          explain: md`The general solution is $Ce^{-0.25t}$ and $C = y(0) = 80$. Negative $k$: this is decay, with half-life $\frac{\ln 2}{0.25} \approx 2.77$.`,
        },
        {
          kind: "text",
          body: md`**Percent rates.** Algebra 2 wrote growth as $y = y_0(1 + r)^t$: up by $r$ per year. That is the same model with $e^{k} = 1 + r$, so $k = \ln(1 + r)$. For small $r$ the two are close ($\ln 1.05 \approx 0.0488$), which is why "5% a year" and "$k = 0.05$" are often treated as the same thing. They aren't quite: a continuous rate $k$ gives $e^{k} - 1$ per year, a little more than $k$.`,
        },
        {
          kind: "check",
          prompt: md`A substance has a half-life of 12 years. In the model $y = y_0e^{-kt}$, what is $k$? Give the exact value (type $\frac{\ln 2}{12}$ as ln(2)/12).`,
          answer: "ln(2)/12",
          explain: md`Half-life $T_h = \frac{\ln 2}{k}$, so $k = \frac{\ln 2}{T_h} = \frac{\ln 2}{12} \approx 0.0578$ per year.`,
        },
      ],
      practice: [growthConstant, timeToReach, solveGrowthIVP],
    },
    {
      id: slug("Newton's law of cooling"),
      title: "Newton's law of cooling",
      summary: "The rate of cooling is proportional to the temperature gap; solving it with a substitution, and using it to tell time.",
      blocks: [
        {
          kind: "text",
          body: md`Pour a cup of coffee and leave it. It cools quickly at first and then more and more slowly, and it never gets colder than the room. Its temperature is not proportional to anything, so $T' = kT$ is the wrong model: a cup at $40^\circ$C in a $20^\circ$C room cools, but a cup at $40^\circ$C in a $60^\circ$C room warms up. What matters is not the temperature but the **difference** between the cup and its surroundings.`,
        },
        {
          kind: "key",
          title: "Newton's law of cooling",
          body: md`An object at temperature $T(t)$ in surroundings at constant temperature $A$ changes temperature at a rate proportional to the gap:

$$\frac{dT}{dt} = -k\,(T - A), \qquad k > 0.$$

The same law describes warming: if $T < A$ the right side is positive and $T$ rises.`,
        },
        {
          kind: "why",
          title: "Why the difference, and why the minus sign",
          body: md`Heat flows from hot to cold, and experiments show that for modest gaps the flow rate is roughly proportional to the gap. The object's temperature changes in proportion to the heat it gains or loses, so $T'$ is proportional to $T - A$.

Now the sign. If $T > A$ the object is hotter than its surroundings, it loses heat, and $T$ should **fall**: $T' < 0$ while $T - A > 0$. The constant of proportionality must be negative, and we write it as $-k$ so that $k$ is a positive number. Check the other case: if $T < A$ then $T - A < 0$ and $T' = -k(T - A) > 0$. The object warms. Both directions come out of the one equation, and at $T = A$ nothing happens: the room temperature is the equilibrium.`,
        },
        {
          kind: "why",
          title: "Why a substitution turns cooling into growth and decay",
          body: md`Let $u = T - A$ be the gap. Since $A$ is a constant, $u' = T'$. The equation becomes

$$u' = -ku,$$

which is the decay equation from the last lesson. So $u = u_0 e^{-kt}$ where $u_0 = T_0 - A$ is the starting gap, and $T = A + u$.

The integrating factor from Unit 1 gives the same answer and is worth seeing once. Write $T' + kT = kA$. Multiply by $\mu = e^{kt}$: $(Te^{kt})' = kAe^{kt}$. Integrate: $Te^{kt} = Ae^{kt} + C$, so $T = A + Ce^{-kt}$. Either way, the gap shrinks exponentially while the room temperature stays put.`,
        },
        {
          kind: "key",
          title: "The cooling curve",
          body: md`With $T(0) = T_0$,

$$T(t) = A + (T_0 - A)\,e^{-kt}.$$

The gap $T - A$ decays like a radioactive sample: it halves every $\frac{\ln 2}{k}$ units of time, and $T \to A$ as $t \to \infty$.`,
        },
        {
          kind: "plot",
          x: [0, 60],
          y: [0, 100],
          curves: [{ expr: "a + (s - a) e^(-k x)", label: "T(t)" }],
          hlines: [{ y: "a", label: "T = A" }],
          points: [{ x: 0, y: "s", label: "T_0 = {s}", color: 2 }],
          field: { dx: "1", dy: "-k (y - a)", density: 12 },
          params: [
            { name: "a", tex: "A", min: 0, max: 40, step: 5, value: 20 },
            { name: "s", tex: "T_0", min: 0, max: 100, step: 5, value: 90 },
            { name: "k", tex: "k", min: 0.02, max: 0.4, step: 0.02, value: 0.1 },
          ],
          caption: md`Every arrow points toward the room temperature, and the farther from it, the steeper. Move $T_0$ below $A$ to see warming: the same curve, flipped. Larger $k$ means a thinner cup or a breeze: faster approach to $A$.`,
        },
        {
          kind: "example",
          title: "Coffee",
          problem: md`Coffee at $90^\circ$C is poured in a $20^\circ$C room. Ten minutes later it is $60^\circ$C. When will it be $30^\circ$C?`,
          steps: [
            { math: md`T = 20 + 70e^{-kt}`, note: md`$A = 20$ and the starting gap is $90 - 20 = 70$.` },
            { math: md`20 + 70e^{-10k} = 60 \quad\Rightarrow\quad e^{-10k} = \frac{40}{70} = \frac47`, note: "Use the reading at 10 minutes to find the gap's shrink factor." },
            { math: md`k = \frac{1}{10}\ln\frac74 \approx 0.0560`, note: md`$-10k = \ln\frac47 = -\ln\frac74$. Per minute.` },
            { math: md`20 + 70e^{-kt} = 30 \quad\Rightarrow\quad e^{-kt} = \frac17`, note: md`Now set the temperature to 30: the gap must shrink from 70 to 10.` },
            { math: md`t = \frac{\ln 7}{k} = \frac{10\ln 7}{\ln\frac74} \approx 34.8 \text{ minutes}`, note: md`It took 10 minutes to lose the first 30 degrees and about 25 more to lose the next 30. Cooling slows as the gap closes.` },
          ],
        },
        {
          kind: "proof",
          title: "The gap halves in equal times",
          given: md`$T(t) = A + (T_0 - A)e^{-kt}$ and $H = \frac{\ln 2}{k}$`,
          prove: md`$T(t + H) - A = \frac12\,\big(T(t) - A\big)$ for every $t$`,
          steps: [
            { statement: md`$T(t + H) - A = (T_0 - A)e^{-k(t + H)}$`, reason: "The cooling curve." },
            { statement: md`$= (T_0 - A)e^{-kt}\,e^{-kH}$`, reason: md`$e^{m + n} = e^m e^n$.` },
            { statement: md`$e^{-kH} = e^{-\ln 2} = \frac12$`, reason: md`$kH = \ln 2$ by the choice of $H$.` },
            { statement: md`$= \frac12 (T_0 - A)e^{-kt} = \frac12\big(T(t) - A\big)$`, reason: "The cooling curve again." },
          ],
        },
        {
          kind: "text",
          body: md`So the gap has a half-life, exactly like a radioactive sample. In the coffee example $e^{-10k} = \frac47$, a little more than a half, so the gap halves in a bit more than 10 minutes: $H = \frac{10\ln 2}{\ln(7/4)} \approx 12.4$ minutes. That is often the most natural way to state $k$: "the gap halves every 12 minutes."

The law also runs backwards in time, which is how it is used in forensics.`,
        },
        {
          kind: "example",
          title: "Time of death",
          problem: md`A body is found in a $20^\circ$C room. At 1 pm its temperature is $30^\circ$C; at 2 pm it is $28^\circ$C. Normal body temperature is $37^\circ$C. When did the person die?`,
          steps: [
            { math: md`T = 20 + 10e^{-kt}`, note: md`Measure $t$ in hours from 1 pm. Gap at 1 pm: 10.` },
            { math: md`10e^{-k} = 8 \quad\Rightarrow\quad k = \ln\frac{10}{8} = \ln 1.25 \approx 0.223`, note: "The gap went from 10 to 8 in one hour." },
            { math: md`20 + 10e^{-kt} = 37 \quad\Rightarrow\quad e^{-kt} = 1.7`, note: md`At death the gap was 17. A gap bigger than 10 means a negative $t$: before 1 pm.` },
            { math: md`t = -\frac{\ln 1.7}{\ln 1.25} \approx -2.38 \text{ hours}`, note: "About 2 hours 23 minutes before 1 pm: roughly 10:37 am." },
          ],
        },
        {
          kind: "check",
          prompt: md`A roast at $180^\circ$C comes out of the oven into a $20^\circ$C kitchen, and $\frac{dT}{dt} = -0.1(T - 20)$ with $t$ in minutes. Find $T(t)$ (type $e^{-0.1t}$ as e^(-0.1t)).`,
          answer: "20 + 160e^(-0.1t)",
          explain: md`$A = 20$ and the starting gap is $180 - 20 = 160$, so $T = 20 + 160e^{-0.1t}$. The gap halves every $\frac{\ln 2}{0.1} \approx 6.9$ minutes.`,
        },
        {
          kind: "text",
          body: md`**What the model leaves out.** The constant $k$ depends on the object: its size, its material, whether the air is moving. A thin cup cools faster than a thick mug. And the law is an approximation: for very large gaps, radiation adds a term that grows faster than the difference. For a cup in a kitchen it is excellent.`,
        },
        {
          kind: "check",
          prompt: md`Water at $90^\circ$C in a $20^\circ$C room is $55^\circ$C after 10 minutes. Find $k$ in $\frac{dT}{dt} = -k(T - 20)$ exactly (type $\frac{\ln 2}{10}$ as ln(2)/10).`,
          answer: "ln(2)/10",
          explain: md`The gap went from 70 to 35, so it halved in 10 minutes: $e^{-10k} = \frac12$ and $k = \frac{\ln 2}{10}$.`,
        },
      ],
      practice: [coolingConstant, coolingTime, coolingSolution],
    },
    {
      id: slug("Mixing problems"),
      title: "Mixing problems",
      summary: "Rate in minus rate out: salt in a stirred tank, the equilibrium it approaches, and what happens when the volume changes.",
      blocks: [
        {
          kind: "text",
          body: md`A tank holds $V$ liters of water with some salt dissolved in it. Salt water flows in at $r$ liters per minute, carrying $c$ grams of salt per liter. The tank is stirred so the mixture is uniform, and it drains at the same $r$ liters per minute. How much salt is in the tank at time $t$?

Call that amount $Q(t)$, in grams. We can't write $Q$ down directly, but we can say exactly how it changes.`,
        },
        {
          kind: "diagram",
          view: [-1.2, 7, -0.8, 5.2],
          points: [
            { name: "A", x: 0, y: 0, label: "", hidden: true },
            { name: "B", x: 4, y: 0, label: "", hidden: true },
            { name: "C", x: 4, y: 3.2, label: "", hidden: true },
            { name: "D", x: 0, y: 3.2, label: "", hidden: true },
            { name: "E", x: 4, y: 2.4, label: "", hidden: true },
            { name: "F", x: 0, y: 2.4, label: "", hidden: true },
            { name: "P", x: 1, y: 4.6, label: "", hidden: true },
            { name: "Q", x: 1, y: 3.4, label: "", hidden: true },
            { name: "R", x: 4.1, y: 0.4, label: "", hidden: true },
            { name: "S", x: 5.6, y: 0.4, label: "", hidden: true },
          ],
          polygons: [{ points: ["A", "B", "E", "F"], fill: 1 }],
          segments: [
            { from: "D", to: "A" },
            { from: "A", to: "B" },
            { from: "B", to: "C" },
            { from: "P", to: "Q", arrow: true, color: 2 },
            { from: "R", to: "S", arrow: true, color: 4 },
          ],
          labels: [
            { x: 2.9, y: 4.4, text: "r \\text{ L/min at } c \\text{ g/L}" },
            { x: 2, y: 1.2, text: "Q(t) \\text{ g in } V \\text{ L}" },
            { x: 5.8, y: 1.1, text: "r \\text{ L/min at } \\tfrac{Q}{V} \\text{ g/L}" },
          ],
          caption: md`What comes in is decided by the pipe. What goes out is decided by the tank: the drain carries whatever concentration is in there right now.`,
        },
        {
          kind: "key",
          title: "Rate in minus rate out",
          body: md`For any quantity that flows in and out,

$$\frac{dQ}{dt} = (\text{rate in}) - (\text{rate out}),$$

and a rate of salt is a flow rate times a concentration: $\frac{\text{L}}{\text{min}} \times \frac{\text{g}}{\text{L}} = \frac{\text{g}}{\text{min}}$. For the stirred tank,

$$\frac{dQ}{dt} = rc - r\,\frac{Q}{V}.$$`,
        },
        {
          kind: "why",
          title: "Why the outflow carries Q/V",
          body: md`"Well stirred" means the concentration is the same everywhere in the tank, so it must be the total salt over the total volume: $\frac{Q}{V}$ grams per liter. In a short time $dt$, the drain removes $r\,dt$ liters, and each liter carries $\frac{Q}{V}$ grams. Salt out: $\frac{Q}{V}\,r\,dt$. Divide by $dt$ to get the rate.

The inflow is simpler because its concentration is fixed by whoever is filling the pipe: $r\,dt$ liters at $c$ grams each, so $rc\,dt$ grams in. The difference, divided by $dt$, is $Q'$.

Notice what makes the problem a differential equation: the rate out depends on $Q$ itself. More salt in the tank means saltier outflow. The equation describes a feedback, and that is why its solution is exponential rather than a straight line.`,
        },
        {
          kind: "proof",
          title: "Solving the constant-volume tank",
          given: md`$Q' = rc - \frac{r}{V}Q$ and $Q(0) = Q_0$`,
          prove: md`$Q(t) = cV + (Q_0 - cV)\,e^{-rt/V}$`,
          steps: [
            { statement: md`$Q' = -\frac{r}{V}(Q - cV)$`, reason: md`Factor out $-\frac{r}{V}$: $rc = \frac{r}{V}\cdot cV$.` },
            { statement: md`Let $u = Q - cV$. Then $u' = Q'$.`, reason: md`$cV$ is a constant.` },
            { statement: md`$u' = -\frac{r}{V}u$`, reason: "Substitute." },
            { statement: md`$u = u(0)\,e^{-rt/V}$`, reason: md`Growth and decay with $k = -\frac{r}{V}$ (previous lesson).` },
            { statement: md`$u(0) = Q_0 - cV$`, reason: "Initial condition." },
            { statement: md`$Q = cV + (Q_0 - cV)e^{-rt/V}$`, reason: md`$Q = u + cV$.` },
          ],
        },
        {
          kind: "why",
          title: "Why the tank ends up at the inflow concentration",
          body: md`The equilibrium is where $Q' = 0$: rate in equals rate out, $rc = r\frac{Q}{V}$, so $Q = cV$. That is a tank of volume $V$ at concentration $c$, the same as the inflow. It had to be: if the tank were saltier than the inflow, more salt would leave than arrive and $Q$ would fall; if less salty, $Q$ would rise. Either way the gap to $cV$ shrinks, and the proof shows it shrinks exponentially, with $e^{-rt/V}$.

The number $\frac{V}{r}$ is the time it takes for the inflow to deliver one full tank of liquid. Every $\frac{V}{r}$ minutes the gap to equilibrium shrinks by the factor $e^{-1} \approx 0.37$. So a 100 L tank fed at 5 L/min has mostly settled after about 60 minutes, three tankfuls.`,
        },
        {
          kind: "plot",
          x: [0, 120],
          y: [0, 400],
          curves: [{ expr: "100c + (q - 100c) e^(-r x/100)", label: "Q(t)" }],
          hlines: [{ y: "100c", label: "Q = cV" }],
          points: [{ x: 0, y: "q", label: "Q_0 = {q}", color: 2 }],
          field: { dx: "1", dy: "r c - r y/100", density: 12 },
          params: [
            { name: "c", tex: "c \\text{ (g/L in)}", min: 0, max: 3, step: 0.5, value: 2 },
            { name: "q", tex: "Q_0", min: 0, max: 400, step: 20, value: 40 },
            { name: "r", tex: "r \\text{ (L/min)}", min: 1, max: 10, step: 1, value: 5 },
          ],
          caption: md`A 100 L tank. The dashed line is the equilibrium $cV = {=100c}$ g. Start above it or below it; the curve approaches it either way, and faster when the flow $r$ is larger. Set $c = 0$ to flush the tank with fresh water.`,
        },
        {
          kind: "example",
          title: "Filling a fresh tank with brine",
          problem: md`A 100 L tank of pure water is fed brine at 2 g/L, 5 L/min, and drains at 5 L/min. How much salt is in it after 20 minutes?`,
          steps: [
            { math: md`\frac{dQ}{dt} = 5 \cdot 2 - 5 \cdot \frac{Q}{100} = 10 - \frac{Q}{20}`, note: md`Rate in 10 g/min; rate out is the flow times the tank's concentration.` },
            { math: md`Q = 200 + (0 - 200)e^{-t/20} = 200\left(1 - e^{-t/20}\right)`, note: md`Equilibrium $cV = 200$ g; starting gap $-200$; $\frac{r}{V} = \frac{1}{20}$.` },
            { math: md`Q(20) = 200(1 - e^{-1}) \approx 126.4 \text{ g}`, note: md`One tankful of time has passed, and the gap is down to $e^{-1}$ of what it was: $200 - 126.4 = 73.6 \approx 200 \cdot 0.368$.` },
          ],
        },
        {
          kind: "example",
          title: "Flushing a tank",
          problem: md`A 200 L tank holds 50 g of salt. Fresh water flows in at 4 L/min and the mixture drains at 4 L/min. When is only 5 g left?`,
          steps: [
            { math: md`\frac{dQ}{dt} = 0 - \frac{4Q}{200} = -\frac{Q}{50}`, note: md`Nothing comes in, so this is pure decay with $k = \frac{r}{V} = \frac{1}{50}$.` },
            { math: md`Q = 50e^{-t/50}`, note: md`$Q_0 = 50$, equilibrium 0.` },
            { math: md`50e^{-t/50} = 5 \quad\Rightarrow\quad t = 50\ln 10 \approx 115 \text{ minutes}`, note: md`$e^{-t/50} = \frac{1}{10}$, so $\frac{t}{50} = \ln 10$. Removing 90% of the salt takes $\ln 10 \approx 2.3$ tankfuls.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A 50 L tank of salt water is fed brine at 3 g/L, 2 L/min, and drains at 2 L/min. Write $\frac{dQ}{dt}$ as an expression in $Q$ (type $6 - \frac{2Q}{50}$ as 6 - 2Q/50).`,
          answer: "6 - 2Q/50",
          explain: md`Rate in: $2 \cdot 3 = 6$ g/min. Rate out: $2 \cdot \frac{Q}{50}$ g/min. So $Q' = 6 - \frac{Q}{25}$, and the tank heads for $cV = 150$ g.`,
        },
        {
          kind: "text",
          body: md`**When the volume changes.** If the inflow and outflow rates differ, say $r_{\text{in}}$ and $r_{\text{out}}$, the volume is $V(t) = V_0 + (r_{\text{in}} - r_{\text{out}})t$ and the outflow concentration is $\frac{Q}{V(t)}$:

$$\frac{dQ}{dt} = r_{\text{in}}\,c - r_{\text{out}}\,\frac{Q}{V_0 + (r_{\text{in}} - r_{\text{out}})t}.$$

This is still linear in $Q$, so the integrating factor of Unit 1 solves it. With fresh water coming in ($c = 0$) it is also separable, which is quicker.`,
        },
        {
          kind: "example",
          title: "A tank that is filling up",
          problem: md`A tank starts with 100 L of water and 40 g of salt. Fresh water flows in at 3 L/min; the mixture drains at 2 L/min. Find $Q(t)$ and the salt left after 100 minutes.`,
          steps: [
            { math: md`V(t) = 100 + t, \qquad \frac{dQ}{dt} = -\frac{2Q}{100 + t}`, note: "The volume gains 1 L per minute. No salt comes in." },
            { math: md`\int \frac{dQ}{Q} = -2\int \frac{dt}{100 + t} \quad\Rightarrow\quad \ln Q = -2\ln(100 + t) + C`, note: "Separate and integrate." },
            { math: md`Q = \frac{C_1}{(100 + t)^2}`, note: md`Exponentiate: $e^{-2\ln(100 + t)} = (100 + t)^{-2}$.` },
            { math: md`Q(t) = 40\left(\frac{100}{100 + t}\right)^{2}`, note: md`$Q(0) = 40$ gives $C_1 = 40 \cdot 100^2$. Written as a ratio, the check at $t = 0$ is immediate.` },
            { math: md`Q(100) = 40 \cdot \left(\tfrac12\right)^2 = 10 \text{ g}`, note: md`After 100 minutes the tank has doubled in volume, and the salt has fallen to a quarter: the exponent 2 is $\frac{r_{\text{out}}}{r_{\text{in}} - r_{\text{out}}}$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`In the tank of the previous Try it (50 L, brine at 3 g/L in at 2 L/min, out at 2 L/min), how many grams of salt does the tank hold in the long run?`,
          answer: "150",
          explain: md`Set $Q' = 0$: $6 - \frac{2Q}{50} = 0$ gives $Q = 150 = cV$. The tank ends at the inflow concentration, 3 g/L.`,
        },
      ],
      practice: [writeMixingODE, mixingLongRun, mixingSolution],
    },
    {
      id: slug("Euler's method"),
      title: "Euler's method",
      summary: "Following the slope in small steps: a numerical method derived from the tangent line, and why its error shrinks with the step.",
      blocks: [
        {
          kind: "text",
          body: md`Every equation so far had a formula for its solution. Most don't. There is no elementary formula for the solution of $y' = t^2 + y^2$, and the equations engineers and biologists write are usually like that. But the equation still tells you something at every point: the slope. In Unit 1 you drew direction fields and sketched solutions by following the arrows. Euler's method is that sketch done with arithmetic.`,
        },
        {
          kind: "key",
          title: "Euler's method",
          body: md`To approximate the solution of $y' = f(t, y)$, $y(t_0) = y_0$, choose a step size $h$ and repeat:

$$t_{n+1} = t_n + h, \qquad y_{n+1} = y_n + h\,f(t_n, y_n).$$

Each $y_n$ approximates $y(t_n)$. The equation supplies the slope $f(t_n, y_n)$ at the current point; the method moves along that slope for a time $h$.`,
        },
        {
          kind: "why",
          title: "Why the tangent line",
          body: md`Calculus 1 gave the linear approximation: near $t$, a differentiable function is close to its tangent line,

$$y(t + h) \approx y(t) + h\,y'(t).$$

Normally you need to know $y$ to find $y'$. But a differential equation hands you $y'$ directly: $y'(t) = f(t, y(t))$. So from the point $(t_0, y_0)$, which you do know, you can compute the slope there and step forward: $y_1 = y_0 + h f(t_0, y_0)$.

Now you are at $(t_1, y_1)$. That point is probably not exactly on the true solution, but the equation still gives a slope there, so pretend it is and step again. Each step follows one arrow of the direction field. Small $h$ means short arrows and a path that hugs the field.`,
        },
        {
          kind: "example",
          title: "Two steps on y' = y",
          problem: md`Approximate $y(1)$ for $y' = y$, $y(0) = 1$ using $h = 0.5$. Compare with the exact value $e$.`,
          steps: [
            { math: md`y_1 = y_0 + h\,f(t_0, y_0) = 1 + 0.5(1) = 1.5`, note: md`At $(0, 1)$ the slope is $y = 1$.` },
            { math: md`y_2 = y_1 + h\,f(t_1, y_1) = 1.5 + 0.5(1.5) = 2.25`, note: md`At $(0.5, 1.5)$ the slope is 1.5.` },
            { math: md`\begin{array}{c|c|c|c} n & t_n & y_n & f(t_n, y_n) \\ \hline 0 & 0 & 1 & 1 \\ 1 & 0.5 & 1.5 & 1.5 \\ 2 & 1 & 2.25 & \end{array}`, note: md`The table is the usual way to keep the bookkeeping straight. The exact value is $e \approx 2.718$, so the error is about $0.47$. The method undershoots because $e^t$ bends upward and each tangent line lies below it.` },
          ],
        },
        {
          kind: "plot",
          x: [0, 2.1],
          y: [0, 7.5],
          curves: [
            { expr: "e^x", label: "y = e^t \\text{ (exact)}", color: 3 },
            { expr: "(1 + h)^(x/h)", label: "\\text{through the Euler points}", color: 1, dashed: true },
          ],
          points: [
            { x: 0, y: 1, label: "y_0", color: 2 },
            { x: "h", y: "1 + h", label: "y_1", color: 2 },
            { x: "2h", y: "(1 + h)^2", label: "y_2", color: 2 },
            { x: "3h", y: "(1 + h)^3", label: "y_3", color: 2 },
            { x: "4h", y: "(1 + h)^4", label: "y_4", color: 2 },
          ],
          field: { dx: "1", dy: "y", density: 12 },
          params: [{ name: "h", tex: "h", min: 0.1, max: 1, step: 0.1, value: 0.5 }],
          caption: md`Euler's method for $y' = y$, $y(0) = 1$. The dashed curve passes through every Euler point; at $t = 1$ it reads {=(1 + h)^(1/h)}, against $e \approx 2.71828$. Shrink $h$ and the dashed curve closes in on the exact one.`,
        },
        {
          kind: "example",
          title: "Four steps on y' = t + y",
          problem: md`Approximate $y(1)$ for $y' = t + y$, $y(0) = 1$ with $h = 0.25$.`,
          steps: [
            { math: md`y_1 = 1 + 0.25(0 + 1) = 1.25`, note: md`Slope at $(0, 1)$: $t + y = 1$.` },
            { math: md`y_2 = 1.25 + 0.25(0.25 + 1.25) = 1.625`, note: md`Slope at $(0.25, 1.25)$: $1.5$.` },
            { math: md`y_3 = 1.625 + 0.25(0.5 + 1.625) = 2.15625`, note: md`Slope at $(0.5, 1.625)$: $2.125$.` },
            { math: md`y_4 = 2.15625 + 0.25(0.75 + 2.15625) = 2.8828125`, note: md`Slope at $(0.75, 2.15625)$: $2.90625$.` },
            { math: md`\begin{array}{c|c|c|c} n & t_n & y_n & f(t_n, y_n) \\ \hline 0 & 0 & 1 & 1 \\ 1 & 0.25 & 1.25 & 1.5 \\ 2 & 0.5 & 1.625 & 2.125 \\ 3 & 0.75 & 2.15625 & 2.90625 \\ 4 & 1 & 2.8828 & \end{array}`, note: md`This equation is linear, so Unit 1 solves it exactly: $y = 2e^{t} - t - 1$ and $y(1) = 2e - 2 \approx 3.4366$. Euler is off by about $0.55$. With $h = 0.25$ that is poor; the next box says how to do better.` },
          ],
        },
        {
          kind: "why",
          title: "Why the error shrinks in proportion to h",
          body: md`Taylor's theorem (Calculus 2) says the tangent line misses the true function by about $\frac{h^2}{2}y''$. So one Euler step, started from a point on the true solution, has an error of about $Ch^2$ for some constant $C$ that depends on how curved the solution is. That is the **local** error.

To travel from $t = a$ to $t = b$ takes $N = \frac{b - a}{h}$ steps. Stacking $N$ errors of size $Ch^2$ gives a **global** error of about

$$N \cdot Ch^2 = \frac{b - a}{h}\,Ch^2 = C(b - a)\,h.$$

Halve the step and you double the number of steps, but each one is four times as accurate. The net effect: the error halves. (Early errors also get carried along and amplified by the equation itself, but that only changes the constant, not the power of $h$.)

Watch it happen on $y' = y$ at $t = 1$:

$$\begin{array}{c|c|c|c} h & y_N & e - y_N & \text{ratio} \\ \hline 1 & 2 & 0.718 & \\ 1/2 & 2.25 & 0.468 & 0.65 \\ 1/4 & 2.4414 & 0.277 & 0.59 \\ 1/8 & 2.5658 & 0.1525 & 0.55 \\ 1/16 & 2.6379 & 0.0804 & 0.53 \\ 1/32 & 2.6770 & 0.0413 & 0.51 \end{array}$$

Each halving of $h$ cuts the error by a ratio that creeps toward $\frac12$.`,
        },
        {
          kind: "plot",
          x: [0, 1.1],
          y: [0, 0.8],
          curves: [{ expr: "e x/2", label: "\\text{slope } e/2", color: 3, dashed: true }],
          points: [
            { x: 1, y: 0.7183, label: "h = 1", color: 2 },
            { x: 0.5, y: 0.4683, color: 2 },
            { x: 0.25, y: 0.2769, color: 2 },
            { x: 0.125, y: 0.1525, color: 2 },
            { x: 0.0625, y: 0.0804, color: 2 },
          ],
          caption: md`The error $e - y_N$ against the step $h$, for $y' = y$. The points settle onto a straight line through the origin: error proportional to $h$. The slope of that line is the constant $C(b - a)$, here $\frac{e}{2}$.`,
        },
        {
          kind: "key",
          title: "Order of a method",
          body: md`Euler's method is **first order**: its error is proportional to $h$. Halving the step halves the error, and getting one more correct decimal digit costs ten times as many steps.

That is slow. Better methods (improved Euler, Runge–Kutta) use the same idea, step along a slope, but estimate the slope more cleverly, with errors proportional to $h^2$ or $h^4$. Those are what calculators and software actually run. Euler's method is the one you can do by hand, and the one the others are built on.`,
        },
        {
          kind: "proof",
          title: "Euler's method recovers the exponential",
          given: md`$y' = ky$, $y(0) = y_0$, Euler's method with step $h$, and $n = \frac{t}{h}$ steps`,
          prove: md`$y_n = y_0(1 + kh)^n$, and $y_n \to y_0e^{kt}$ as $h \to 0$`,
          steps: [
            { statement: md`$y_{m+1} = y_m + h\,(ky_m) = (1 + kh)\,y_m$`, reason: md`Euler step with $f(t, y) = ky$.` },
            { statement: md`$y_n = (1 + kh)^n y_0$`, reason: "Each step multiplies by the same factor (induction on the number of steps)." },
            { statement: md`$y_n = y_0 (1 + kh)^{t/h}$`, reason: md`$n = \frac{t}{h}$.` },
            { statement: md`$(1 + kh)^{t/h} = \Big((1 + kh)^{1/(kh)}\Big)^{kt}$`, reason: md`$\frac{t}{h} = \frac{1}{kh}\cdot kt$ and $(a^m)^n = a^{mn}$.` },
            { statement: md`$(1 + kh)^{1/(kh)} \to e$ as $h \to 0$`, reason: md`With $m = \frac{1}{kh}$ this is $\left(1 + \frac1m\right)^m \to e$, the limit that defines $e$ (Algebra 2, Unit 6).` },
            { statement: md`$y_n \to y_0 e^{kt}$`, reason: "The exact solution from the first lesson of this unit." },
          ],
        },
        {
          kind: "text",
          body: md`That proof is also a second derivation of $e$: compound interest in tiny steps. Euler's method with step $h$ on $y' = y$ is exactly the balance of an account paying 100% a year, compounded $\frac1h$ times a year. For $h = 1$ it is simple doubling, 2; as $h \to 0$ it is continuous compounding, $e$.

Euler's method handles nonlinear equations just as easily. The arithmetic doesn't care what $f$ looks like.`,
        },
        {
          kind: "example",
          title: "A nonlinear equation",
          problem: md`Approximate $y(1)$ for $y' = ty$, $y(0) = 1$ with $h = \frac12$, using exact fractions.`,
          steps: [
            { math: md`y_1 = 1 + \tfrac12\,(0 \cdot 1) = 1`, note: md`At $t = 0$ the slope $ty$ is 0, so the first step is flat.` },
            { math: md`y_2 = 1 + \tfrac12\left(\tfrac12 \cdot 1\right) = \tfrac54`, note: md`At $(\frac12, 1)$ the slope is $\frac12$.` },
            { math: md`y(1) = e^{1/2} \approx 1.6487`, note: md`The exact solution is $y = e^{t^2/2}$ (separable). Euler gives 1.25: with only two steps on a curve that bends sharply upward, the tangent lines lag badly. With $h = 0.1$ the estimate is about 1.56; with $h = 0.01$, about 1.64.` },
          ],
        },
        {
          kind: "check",
          prompt: md`Use Euler's method with $h = \frac12$ on $y' = 2t$, $y(0) = 0$. What is $y_2$, the approximation to $y(1)$? Give an exact fraction.`,
          answer: "1/2",
          explain: md`$y_1 = 0 + \frac12(2 \cdot 0) = 0$ and $y_2 = 0 + \frac12(2 \cdot \frac12) = \frac12$. The exact value is $y = t^2$, so $y(1) = 1$: Euler is half right, because each step uses the slope at the start of the interval, where it is smallest.`,
        },
        {
          kind: "check",
          prompt: md`With $h = 0.1$, Euler's method on some problem has an error of 0.08 at $t = 3$. About what error would $h = 0.025$ give?`,
          answer: "0.02",
          tolerance: 0.002,
          explain: md`The step is divided by 4, so the error is divided by about 4: $0.08 / 4 = 0.02$. First-order methods scale their error with $h$.`,
        },
      ],
      practice: [eulerLinear, eulerNonlinear, eulerError],
    },
  ],
};
