import { md, slug, type Generator, type Unit } from "../types";

// ── Shared wording and helpers ──────────────────────────────────────────────

const CENT = "Round to the nearest cent, and type just the number, with no dollar sign or commas.";
const ROUND1 = "Round to 1 decimal place.";
const EXACT_LN = "Give an exact answer using ln, like ln(2)/0.05 or 20 ln(2); any equal form is accepted. A rounded decimal is not.";

/** Tidy a float for display: 1.0600000000001 -> "1.06". */
const num = (x: number) => String(Number(x.toPrecision(12)));

/** x rounded to d decimal places, or null when x is too close to a rounding tie to trust. */
function rounded(x: number, d: number): string | null {
  const s = x * 10 ** d;
  if (Math.abs(s - Math.floor(s) - 0.5) < 1e-3) return null;
  return (Math.round(s) / 10 ** d).toFixed(d);
}

/** A rounded value for a solution line, e.g. 1.0616778. */
const approx = (x: number, d = 4) => x.toFixed(d);

const PERIODS: Record<number, string> = { 1: "once a year", 2: "twice a year", 4: "quarterly", 12: "monthly", 365: "daily" };

/** (1 + r/n) as LaTeX: 1 + \frac{0.06}{12}. */
const perTex = (rate: number, n: number) => (n === 1 ? `1 + ${num(rate / 100)}` : `1 + \\frac{${num(rate / 100)}}{${n}}`);
/** (1 + r/n) as typed text. */
const perText = (rate: number, n: number) => (n === 1 ? `1 + ${num(rate / 100)}` : `1 + ${num(rate / 100)}/${n}`);

/** A logistic function as LaTeX. */
const logisticTex = (L: number, C: number, k: number) => `\\frac{${L}}{1 + ${C}e^{-${num(k)}t}}`;

/** A small table of (x, y) values as a KaTeX array. */
function table(xs: (number | string)[], ys: (number | string)[], xName = "x", yName = "y"): string {
  return `$$\\begin{array}{c|${"c".repeat(xs.length)}} ${xName} & ${xs.join(" & ")} \\\\ \\hline ${yName} & ${ys.join(" & ")} \\end{array}$$`;
}

// ── Lesson 1: Compound and continuous interest ──────────────────────────────

const DEPOSITS = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000, 8000, 10000];
const RATES = [2, 3, 4, 5, 6, 8, 10, 12];

const compoundAmount: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    for (;;) {
      const P = r.pick([400, 500, 800, 1000, 1600, 2000, 2500, 4000, 5000, 10000]);
      const rate = r.pick([2, 4, 5, 10, 20, 25]);
      const t = r.int(2, 3);
      const cents = P * 100 * (100 + rate) ** t;
      if (cents % 100 ** t !== 0) continue;
      const A = cents / 100 ** t / 100;
      const b = num(1 + rate / 100);
      return {
        prompt: md`Compute $${P}(1 + ${num(rate / 100)})^{${t}}$, the balance in dollars after ${t} years when ${P} dollars earns ${rate}% a year, compounded once a year. The answer comes out to whole cents; type just the number.`,
        answer: num(A),
        hint: md`Each year multiplies the balance by $${b}$. Work out $${b}^{${t}}$ first, then multiply by ${P}.`,
        solution: [
          { math: md`${P}(${b})^{${t}}`, note: md`${rate}% more each year means times $1 + ${num(rate / 100)} = ${b}$ each year.` },
          { math: md`${P}(${num((1 + rate / 100) ** t)})`, note: md`$${b}^{${t}}$ is the total growth factor over ${t} years.` },
          { math: num(A), note: "" },
        ],
      };
    }
  }
  if (kind === 1) {
    for (;;) {
      const P = r.pick(DEPOSITS);
      const rate = r.pick(RATES);
      const n = r.pick([2, 4, 12]);
      const t = r.int(2, 10);
      const per = 1 + rate / 100 / n;
      const A = P * per ** (n * t);
      const key = rounded(A, 2);
      if (!key) continue;
      return {
        prompt: md`You deposit ${P} dollars at ${rate}% a year, compounded ${PERIODS[n]}. How much is in the account after ${t} years? ${CENT}`,
        answer: key,
        tolerance: 0.005,
        hint: md`$A = P\left(1 + \frac{r}{n}\right)^{nt}$ with $n = ${n}$ payments a year. The exponent counts payments, not years.`,
        solution: [
          { math: md`A = ${P}\left(${perTex(rate, n)}\right)^{${n} \cdot ${t}}`, note: md`$P = ${P}$, $r = ${num(rate / 100)}$, $n = ${n}$, $t = ${t}$.` },
          { math: md`A = ${P}(${num(per)})^{${n * t}}`, note: md`Each payment is $\frac{${num(rate / 100)}}{${n}} = ${num(rate / 100 / n)}$ of the balance, and there are ${n * t} of them.` },
          { math: md`A \approx ${P}(${approx(per ** (n * t), 6)}) \approx ${key}`, note: "Round at the end, not in the middle." },
        ],
      };
    }
  }
  if (kind === 2) {
    for (;;) {
      const P = r.pick(DEPOSITS);
      const rate = r.pick(RATES);
      const t = r.int(2, 15);
      const A = P * Math.exp((rate / 100) * t);
      const key = rounded(A, 2);
      if (!key) continue;
      return {
        prompt: md`You invest ${P} dollars at ${rate}% a year, compounded continuously. How much is it worth after ${t} years? ${CENT}`,
        answer: key,
        tolerance: 0.005,
        hint: md`Continuous compounding is $A = Pe^{rt}$. Multiply the rate (as a decimal) by the time, then use the $e^{x}$ key.`,
        solution: [
          { math: md`A = ${P}e^{${num(rate / 100)} \cdot ${t}} = ${P}e^{${num((rate / 100) * t)}}`, note: md`$P = ${P}$, $r = ${num(rate / 100)}$, $t = ${t}$.` },
          { math: md`A \approx ${P}(${approx(Math.exp((rate / 100) * t), 6)}) \approx ${key}`, note: md`$e^{${num((rate / 100) * t)}}$ is the total growth factor: the limit of compounding more and more often.` },
        ],
      };
    }
  }
  for (;;) {
    const rate = r.pick(RATES);
    const n = r.pick([2, 4, 12, 365]);
    const apy = ((1 + rate / 100 / n) ** n - 1) * 100;
    const key = rounded(apy, 2);
    if (!key) continue;
    return {
      prompt: md`An account pays ${rate}% a year, compounded ${PERIODS[n]}. Find its effective annual rate: the percent the balance really grows by in one year. Give a percent rounded to 2 decimal places, like 6.17 for 6.17%.`,
      answer: key,
      tolerance: 0.005,
      hint: md`Follow 1 dollar for one year: it becomes $\left(1 + \frac{${num(rate / 100)}}{${n}}\right)^{${n}}$. The growth is that number minus 1.`,
      solution: [
        { math: md`\left(${perTex(rate, n)}\right)^{${n}} \approx ${approx((1 + rate / 100 / n) ** n, 6)}`, note: md`One year holds ${n} payments of $${num(rate / 100 / n)}$ of the balance each.` },
        { math: md`${approx((1 + rate / 100 / n) ** n, 6)} - 1 \approx ${approx(apy / 100, 6)}`, note: "The growth factor minus 1 is the fraction gained." },
        { math: md`\approx ${key}\%`, note: md`More than the ${rate}% nominal rate, because interest paid during the year earns interest too.` },
      ],
    };
  }
};

const doublingTime: Generator = (r) => {
  const kind = r.int(0, 4);
  const P = r.pick(DEPOSITS);
  const rate = r.pick(RATES);
  const rr = num(rate / 100);
  if (kind === 0 || kind === 2) {
    const m = kind === 0 ? 2 : r.pick([3, 4, 5]);
    const word = m === 2 ? "double" : m === 3 ? "triple" : `grow to ${m} times its size`;
    const t = Math.log(m) / (rate / 100);
    return {
      prompt: md`Solve $${P}e^{${rr}t} = ${P * m}$. It gives the time, in years, for ${P} dollars at ${rate}% compounded continuously to ${word}. ${EXACT_LN}`,
      answer: `ln(${m})/${rr}`,
      hint: md`Divide both sides by ${P} first. Then $\ln$ undoes $e^{x}$: $\ln(e^{u}) = u$.`,
      solution: [
        { math: md`e^{${rr}t} = ${m}`, note: md`Divide by ${P}. The starting amount drops out, so the answer is the same for any deposit.` },
        { math: md`${rr}t = \ln ${m}`, note: md`Take $\ln$ of both sides; $\ln e^{u} = u$ because $\ln$ is the inverse of $e^{x}$.` },
        { math: md`t = \frac{\ln ${m}}{${rr}} \approx ${approx(t, 2)}`, note: md`About ${approx(t, 1)} years.` },
      ],
    };
  }
  if (kind === 1) {
    const t = Math.log(2) / Math.log(1 + rate / 100);
    return {
      prompt: md`Solve $${P}(${num(1 + rate / 100)})^{t} = ${2 * P}$. It gives the doubling time, in years, of ${P} dollars at ${rate}% compounded once a year. ${EXACT_LN}`,
      answer: `ln(2)/ln(${num(1 + rate / 100)})`,
      hint: md`Divide by ${P}, then take $\ln$ of both sides and use $\ln(b^{t}) = t \ln b$.`,
      solution: [
        { math: md`(${num(1 + rate / 100)})^{t} = 2`, note: md`Divide by ${P}.` },
        { math: md`t \ln ${num(1 + rate / 100)} = \ln 2`, note: md`$\ln(b^{t}) = t\ln b$: the exponent comes down.` },
        { math: md`t = \frac{\ln 2}{\ln ${num(1 + rate / 100)}} \approx ${approx(t, 2)}`, note: md`The rule of 70 estimates $\frac{70}{${rate}} \approx ${approx(70 / rate, 1)}$: close, and closer for small rates.` },
      ],
    };
  }
  if (kind === 3) {
    const T = r.pick([5, 6, 8, 9, 10, 12, 15, 20]);
    return {
      prompt: md`An investment compounded continuously doubles every ${T} years. Find its yearly rate $r$, as a decimal. ${EXACT_LN}`,
      answer: `ln(2)/${T}`,
      verify: [`e^(${T} r) = 2`],
      hint: md`Doubling means $Pe^{r \cdot ${T}} = 2P$. Solve for $r$ the same way you solve for $t$.`,
      solution: [
        { math: md`e^{${T}r} = 2`, note: md`$Pe^{${T}r} = 2P$, divided by $P$.` },
        { math: md`${T}r = \ln 2`, note: md`$\ln$ of both sides.` },
        { math: md`r = \frac{\ln 2}{${T}} \approx ${approx(Math.log(2) / T, 4)}`, note: md`About ${approx((100 * Math.log(2)) / T, 2)}% a year. Doubling time and rate trade places: $T = \frac{\ln 2}{r}$ and $r = \frac{\ln 2}{T}$.` },
      ],
    };
  }
  const n = r.pick([2, 4, 12]);
  const per = 1 + rate / 100 / n;
  const t = Math.log(2) / (n * Math.log(per));
  return {
    prompt: md`Solve $${P}\left(${perTex(rate, n)}\right)^{${n}t} = ${2 * P}$. It gives the doubling time, in years, at ${rate}% compounded ${PERIODS[n]}. ${EXACT_LN}`,
    answer: `ln(2)/(${n} ln(${perText(rate, n)}))`,
    hint: md`Divide by ${P}, take $\ln$, and bring the whole exponent $${n}t$ down: $\ln(b^{${n}t}) = ${n}t \ln b$.`,
    solution: [
      { math: md`(${num(per)})^{${n}t} = 2`, note: md`Divide by ${P}; $${perTex(rate, n)} = ${num(per)}$.` },
      { math: md`${n}t \ln(${num(per)}) = \ln 2`, note: "The exponent comes down." },
      { math: md`t = \frac{\ln 2}{${n} \ln(${num(per)})} \approx ${approx(t, 2)}`, note: md`Slightly less than $\frac{\ln 2}{\ln ${num(1 + rate / 100)}} \approx ${approx(Math.log(2) / Math.log(1 + rate / 100), 2)}$ for yearly compounding: more payments, faster doubling.` },
    ],
  };
};

const howLong: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 2) {
    for (;;) {
      const T = r.pick([4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25]);
      const m = r.pick([2, 2, 3]);
      const rate = (100 * Math.log(m)) / T;
      const key = rounded(rate, 2);
      if (!key) continue;
      return {
        prompt: md`What yearly rate, compounded continuously, makes money ${m === 2 ? "double" : "triple"} in ${T} years? Give a percent rounded to 2 decimal places, like 6.93.`,
        answer: key,
        tolerance: 0.005,
        hint: md`Solve $e^{${T}r} = ${m}$ for $r$, then turn the decimal into a percent.`,
        solution: [
          { math: md`e^{${T}r} = ${m}`, note: md`$Pe^{rt} = ${m}P$ at $t = ${T}$, divided by $P$.` },
          { math: md`r = \frac{\ln ${m}}{${T}} \approx ${approx(Math.log(m) / T, 5)}`, note: md`$\ln ${m} \approx ${approx(Math.log(m), 4)}$.` },
          { math: md`r \approx ${key}\%`, note: m === 2 ? md`Check with the rule of 70: $\frac{70}{${T}} = ${approx(70 / T, 2)}$.` : "" },
        ],
      };
    }
  }
  for (;;) {
    const P = r.pick(DEPOSITS);
    const rate = r.pick(RATES);
    const factor = r.pick([1.5, 2, 2.5, 3, 4, 5]);
    const A = P * factor;
    if (!Number.isInteger(A)) continue;
    const rr = num(rate / 100);
    if (kind === 0) {
      const t = Math.log(factor) / (rate / 100);
      const key = rounded(t, 1);
      if (!key) continue;
      return {
        prompt: md`${P} dollars is invested at ${rate}% a year, compounded continuously. How many years until it is worth ${A} dollars? ${ROUND1}`,
        answer: key,
        tolerance: 0.05,
        hint: md`Set $${P}e^{${rr}t} = ${A}$, divide by ${P}, then take $\ln$ of both sides.`,
        solution: [
          { math: md`e^{${rr}t} = \frac{${A}}{${P}} = ${num(factor)}`, note: "Divide both sides by the deposit." },
          { math: md`${rr}t = \ln ${num(factor)} \approx ${approx(Math.log(factor), 4)}`, note: md`$\ln$ undoes $e^{x}$.` },
          { math: md`t = \frac{\ln ${num(factor)}}{${rr}} \approx ${key}`, note: "Years." },
        ],
      };
    }
    const n = r.pick([2, 4, 12]);
    const per = 1 + rate / 100 / n;
    const t = Math.log(factor) / (n * Math.log(per));
    const key = rounded(t, 1);
    if (!key) continue;
    return {
      prompt: md`${P} dollars is invested at ${rate}% a year, compounded ${PERIODS[n]}. How many years until it is worth ${A} dollars? ${ROUND1}`,
      answer: key,
      tolerance: 0.05,
      hint: md`Set $${P}(${num(per)})^{${n}t} = ${A}$. After dividing by ${P}, take $\ln$ and bring the exponent $${n}t$ down.`,
      solution: [
        { math: md`(${num(per)})^{${n}t} = ${num(factor)}`, note: md`Each payment multiplies by $${perTex(rate, n)} = ${num(per)}$; divide both sides by ${P}.` },
        { math: md`${n}t \ln(${num(per)}) = \ln ${num(factor)}`, note: md`$\ln(b^{u}) = u \ln b$.` },
        { math: md`t = \frac{\ln ${num(factor)}}{${n}\ln(${num(per)})} \approx \frac{${approx(Math.log(factor), 4)}}{${n}(${approx(Math.log(per), 6)})} \approx ${key}`, note: "Years. The number of payments is " + n + "t, so divide by " + n + " to get years." },
      ],
    };
  }
};

// ── Lesson 2: Logistic growth ───────────────────────────────────────────────

const STARTS = [50, 100, 200, 250, 400, 500];
const ODDS = [2, 3, 4, 5, 7, 9];
const KS = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6];

const logisticRead: Generator = (r) => {
  const kind = r.int(0, 4);
  const P0 = r.pick(STARTS);
  const C = r.pick(ODDS);
  const L = P0 * (1 + C);
  const k = r.pick(KS);
  const model = logisticTex(L, C, k);
  const [thing, unit] = r.pick([["population of fish in a lake", "years"], ["number of people in a town who have heard a rumor", "days"], ["number of trees in a planted forest", "years"], ["number of bacteria in a dish", "hours"]] as const);
  if (kind === 0) {
    return {
      prompt: md`Evaluate $${model}$ when $t = 0$. This is the starting value of a logistic model for the ${thing}.`,
      answer: String(P0),
      hint: md`$e^{0} = 1$, so the denominator is just $1 + ${C}$.`,
      solution: [
        { math: md`\frac{${L}}{1 + ${C}e^{0}} = \frac{${L}}{1 + ${C}}`, note: md`Any nonzero number to the power 0 is 1.` },
        { math: md`\frac{${L}}{${1 + C}} = ${P0}`, note: md`The start is the carrying capacity divided by $1 + C$.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`Solve $${model} = ${L / 2}$. It gives the time, in ${unit}, when the ${thing} is halfway to its carrying capacity. ${EXACT_LN}`,
      answer: `ln(${C})/${num(k)}`,
      hint: md`Cross-multiply to get $1 + ${C}e^{-${num(k)}t} = 2$, then isolate the power before taking $\ln$.`,
      solution: [
        { math: md`1 + ${C}e^{-${num(k)}t} = \frac{${L}}{${L / 2}} = 2`, note: md`$\frac{${L}}{D} = ${L / 2}$ means $D = ${L}/${L / 2}$.` },
        { math: md`e^{-${num(k)}t} = \frac{1}{${C}}`, note: md`Subtract 1, divide by ${C}.` },
        { math: md`-${num(k)}t = \ln\frac{1}{${C}} = -\ln ${C}`, note: md`$\ln\frac{1}{a} = -\ln a$.` },
        { math: md`t = \frac{\ln ${C}}{${num(k)}} \approx ${approx(Math.log(C) / k, 2)}`, note: "The midpoint, where growth is fastest." },
      ],
    };
  }
  if (kind === 2) {
    for (;;) {
      const m = r.pick([2, 3, 4, 5, 9]);
      if (L % (m + 1) !== 0) continue;
      const P1 = (L * m) / (m + 1);
      return {
        prompt: md`Solve $${model} = ${P1}$. It gives the time, in ${unit}, when the ${thing} reaches ${P1}. ${EXACT_LN}`,
        answer: `ln(${C * m})/${num(k)}`,
        hint: md`Get the denominator alone: $1 + ${C}e^{-${num(k)}t} = \frac{${L}}{${P1}}$. Then isolate $e^{-${num(k)}t}$ and take $\ln$.`,
        solution: [
          { math: md`1 + ${C}e^{-${num(k)}t} = \frac{${L}}{${P1}} = \frac{${m + 1}}{${m}}`, note: "Cross-multiply and divide." },
          { math: md`${C}e^{-${num(k)}t} = \frac{1}{${m}} \;\Rightarrow\; e^{-${num(k)}t} = \frac{1}{${C * m}}`, note: md`Subtract 1: $\frac{${m + 1}}{${m}} - 1 = \frac{1}{${m}}$. Then divide by ${C}.` },
          { math: md`-${num(k)}t = -\ln ${C * m}`, note: md`$\ln\frac{1}{a} = -\ln a$.` },
          { math: md`t = \frac{\ln ${C * m}}{${num(k)}} \approx ${approx(Math.log(C * m) / k, 2)}`, note: "" },
        ],
      };
    }
  }
  if (kind === 3) {
    return {
      prompt: md`The ${thing} after $t$ ${unit} is modeled by $P(t) = ${model}$. Find the carrying capacity: the value $P$ approaches as $t$ grows without bound.`,
      answer: String(L),
      // For huge t the decaying term is gone and the model equals its ceiling.
      verify: [`${L}/(1 + ${C}e^(-${num(k)}*1000)) = L`],
      hint: md`What happens to $e^{-${num(k)}t}$ as $t$ gets large? Then what happens to the denominator?`,
      solution: [
        { math: md`e^{-${num(k)}t} \to 0 \text{ as } t \to \infty`, note: md`A decaying exponential dies away: at $t = 50$ it is already about $${Math.exp(-k * 50).toExponential(1).replace("e-", " \\cdot 10^{-").concat("}")}$.` },
        { math: md`1 + ${C}e^{-${num(k)}t} \to 1 + 0 = 1`, note: "" },
        { math: md`P(t) \to \frac{${L}}{1} = ${L}`, note: md`The carrying capacity is the numerator, ${L}. The denominator is always more than 1, so $P$ stays below it.` },
      ],
    };
  }
  return {
    prompt: md`A ${thing} has carrying capacity ${L} and starts at ${P0}. Its logistic model is $P(t) = \frac{${L}}{1 + Ce^{-kt}}$. Find $C$.`,
    answer: String(C),
    verify: [`${L}/(1 + C) = ${P0}`],
    hint: md`At $t = 0$ the model gives $\frac{${L}}{1 + C}$, and that must equal ${P0}.`,
    solution: [
      { math: md`\frac{${L}}{1 + C} = ${P0}`, note: md`$P(0) = ${P0}$, and $e^{0} = 1$.` },
      { math: md`1 + C = \frac{${L}}{${P0}} = ${1 + C}`, note: "" },
      { math: md`C = ${C}`, note: md`$C = \frac{L - P_0}{P_0} = \frac{${L - P0}}{${P0}}$: the room left divided by the amount present, at the start.` },
    ],
  };
};

const logisticBuild: Generator = (r) => {
  const kind = r.int(0, 2);
  for (;;) {
    const P0 = r.pick(STARTS);
    const C = r.pick(ODDS);
    const L = P0 * (1 + C);
    const m = r.pick([1, 2, 3, 4, 9]);
    if (L % (m + 1) !== 0) continue;
    const P1 = (L * m) / (m + 1);
    const t1 = r.pick([2, 3, 4, 5, 6, 8, 10]);
    const thing = r.pick(["A population of deer on an island", "The number of households in a town with a new app", "A colony of yeast cells", "The number of infected plants in a greenhouse"]);
    const k = Math.log(C * m) / t1;
    const kText = `ln(${C * m})/${t1}`;
    const ratio = { math: md`1 + Ce^{-${t1}k} = \frac{${L}}{${P1}} = \frac{${m + 1}}{${m}}`, note: md`$P(${t1}) = ${P1}$. Cross-multiply and divide.` };
    if (kind === 0) {
      return {
        prompt: md`${thing} has carrying capacity ${L}. It starts at ${P0}, and after ${t1} years it is ${P1}. In the logistic model $P(t) = \frac{${L}}{1 + ${C}e^{-kt}}$, find $k$. ${EXACT_LN}`,
        answer: kText,
        verify: [`${L}/(1 + ${C} e^(-${t1} k)) = ${P1}`],
        hint: md`Substitute $t = ${t1}$ and $P = ${P1}$, then isolate $e^{-${t1}k}$.`,
        solution: [
          { math: md`\frac{${L}}{1 + ${C}e^{-${t1}k}} = ${P1}`, note: "The data point goes into the model." },
          { ...ratio, math: ratio.math.replace("Ce", `${C}e`) },
          { math: md`${C}e^{-${t1}k} = \frac{1}{${m}} \;\Rightarrow\; e^{-${t1}k} = \frac{1}{${C * m}}`, note: md`Subtract 1, then divide by ${C}.` },
          { math: md`-${t1}k = -\ln ${C * m} \;\Rightarrow\; k = \frac{\ln ${C * m}}{${t1}} \approx ${approx(k, 3)}`, note: md`$\ln\frac{1}{a} = -\ln a$; the minus signs cancel.` },
        ],
      };
    }
    if (kind === 1) {
      const kk = r.pick(KS);
      // Choose t1 so the answer is tidy: C = (1/m) e^{k t1}.
      return {
        prompt: md`${thing} has carrying capacity ${L} and grows logistically with $k = ${num(kk)}$: $P(t) = \frac{${L}}{1 + Ce^{-${num(kk)}t}}$. After ${t1} years it numbers ${P1}. Find $C$ exactly (type $e^{1.2}$ as e^(1.2)).`,
        answer: `e^(${num(kk * t1)})/${m}`,
        verify: [`${L}/(1 + C e^(-${num(kk)}*${t1})) = ${P1}`],
        hint: md`Substitute $t = ${t1}$, $P = ${P1}$. Isolate $Ce^{-${num(kk * t1)}}$, then multiply by $e^{${num(kk * t1)}}$.`,
        solution: [
          { math: md`1 + Ce^{-${num(kk)} \cdot ${t1}} = \frac{${L}}{${P1}} = \frac{${m + 1}}{${m}}`, note: "Cross-multiply and divide." },
          { math: md`Ce^{-${num(kk * t1)}} = \frac{1}{${m}}`, note: "Subtract 1." },
          { math: md`C = \frac{1}{${m}}e^{${num(kk * t1)}} = \frac{e^{${num(kk * t1)}}}{${m}} \approx ${approx(Math.exp(kk * t1) / m, 3)}`, note: md`Multiply both sides by $e^{${num(kk * t1)}}$; $e^{-u}e^{u} = 1$.` },
        ],
      };
    }
    return {
      prompt: md`${thing} has carrying capacity ${L}. It starts at ${P0}, and after ${t1} years it is ${P1}. Find $C$ and $k$ in the logistic model $P(t) = \frac{${L}}{1 + Ce^{-kt}}$. Give the pair as (C, k), exactly, like (5, ln(10)/4).`,
      answer: `(${C}, ${kText})`,
      form: "tuple",
      verify: [`${L}/(1 + C e^(0 k)) = ${P0}`, `${L}/(1 + C e^(-${t1} k)) = ${P1}`],
      hint: md`The start fixes $C$: $\frac{${L}}{1 + C} = ${P0}$. Then the second point fixes $k$.`,
      solution: [
        { math: md`\frac{${L}}{1 + C} = ${P0} \;\Rightarrow\; C = \frac{${L}}{${P0}} - 1 = ${C}`, note: md`At $t = 0$, $e^{0} = 1$.` },
        { ...ratio, math: ratio.math.replace("Ce", `${C}e`) },
        { math: md`e^{-${t1}k} = \frac{1}{${C * m}}`, note: md`Subtract 1 to get $\frac{1}{${m}}$, then divide by ${C}.` },
        { math: md`k = \frac{\ln ${C * m}}{${t1}} \approx ${approx(k, 3)}`, note: md`So $(C, k) = \left(${C}, \frac{\ln ${C * m}}{${t1}}\right)$.` },
      ],
    };
  }
};

const logisticValue: Generator = (r) => {
  const kind = r.int(0, 2);
  for (;;) {
    const P0 = r.pick(STARTS);
    const C = r.pick(ODDS);
    const L = P0 * (1 + C);
    const k = r.pick(KS);
    const model = logisticTex(L, C, k);
    const [thing, unit] = r.pick([["population of a fish species in a lake", "years"], ["number of people in a town who own the new phone", "months"], ["number of weeds in a field", "weeks"], ["number of cells in a culture", "hours"]] as const);
    const model0 = md`The ${thing} after $t$ ${unit} is $P(t) = ${model}$.`;
    if (kind === 0) {
      const t = r.int(2, 14);
      const value = L / (1 + C * Math.exp(-k * t));
      const key = rounded(value, 0);
      if (!key) continue;
      return {
        prompt: md`${model0} Find $P(${t})$, rounded to the nearest whole number.`,
        answer: key,
        tolerance: 0.5,
        hint: md`Work out the exponent $-${num(k)} \cdot ${t}$ first, then $e$ to that power, then the denominator.`,
        solution: [
          { math: md`P(${t}) = \frac{${L}}{1 + ${C}e^{-${num(k * t)}}}`, note: md`$${num(k)} \cdot ${t} = ${num(k * t)}$.` },
          { math: md`e^{-${num(k * t)}} \approx ${approx(Math.exp(-k * t), 5)}`, note: "A small number: the decaying term is fading." },
          { math: md`P(${t}) \approx \frac{${L}}{${approx(1 + C * Math.exp(-k * t), 5)}} \approx ${approx(value, 1)} \approx ${key}`, note: md`Compare the carrying capacity ${L}: the population is at ${Math.round((100 * value) / L)}% of it.` },
        ],
      };
    }
    if (kind === 1) {
      const pct = r.pick([75, 80, 90, 95]);
      const f = pct / 100;
      const t = Math.log((C * f) / (1 - f)) / k;
      const key = rounded(t, 1);
      if (!key) continue;
      return {
        prompt: md`${model0} After how many ${unit} does it reach ${pct}% of its carrying capacity? ${ROUND1}`,
        answer: key,
        tolerance: 0.05,
        hint: md`${pct}% of ${L} is ${f * L}. Set $P(t) = ${f * L}$, isolate $e^{-${num(k)}t}$, take $\ln$.`,
        solution: [
          { math: md`\frac{${L}}{1 + ${C}e^{-${num(k)}t}} = ${f * L} \;\Rightarrow\; 1 + ${C}e^{-${num(k)}t} = \frac{1}{${num(f)}}`, note: md`$\frac{${L}}{${num(f)} \cdot ${L}} = \frac{1}{${num(f)}}$.` },
          { math: md`e^{-${num(k)}t} = \frac{${num(1 / f - 1)}}{${C}} \approx ${approx((1 - f) / (f * C), 5)}`, note: md`$\frac{1}{${num(f)}} - 1 = ${num(1 / f - 1)}$, then divide by ${C}.` },
          { math: md`t = \frac{\ln\left(${approx((1 - f) / (f * C), 5)}\right)}{-${num(k)}} \approx ${key}`, note: md`In ${unit}. The $\ln$ of a number below 1 is negative, and dividing by $-${num(k)}$ makes $t$ positive.` },
        ],
      };
    }
    const P1 = Math.round((L * r.int(55, 95)) / 1000) * 10;
    if (P1 <= P0 || P1 >= L || P1 === L / 2) continue;
    const t = Math.log((C * P1) / (L - P1)) / k;
    const key = rounded(t, 1);
    if (!key) continue;
    return {
      prompt: md`${model0} After how many ${unit} does it reach ${P1}? ${ROUND1}`,
      answer: key,
      tolerance: 0.05,
      hint: md`Cross-multiply to get $1 + ${C}e^{-${num(k)}t} = \frac{${L}}{${P1}}$, then isolate the power and take $\ln$.`,
      solution: [
        { math: md`1 + ${C}e^{-${num(k)}t} = \frac{${L}}{${P1}} \approx ${approx(L / P1, 5)}`, note: "Cross-multiply and divide." },
        { math: md`e^{-${num(k)}t} \approx \frac{${approx(L / P1 - 1, 5)}}{${C}} \approx ${approx((L - P1) / (C * P1), 6)}`, note: "Subtract 1, divide by " + C + "." },
        { math: md`t \approx \frac{\ln(${approx((L - P1) / (C * P1), 6)})}{-${num(k)}} \approx ${key}`, note: `In ${unit}.` },
      ],
    };
  }
};

// ── Lesson 3: Fitting models to data ────────────────────────────────────────

const fitExact: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.pick([2, 3, 4, 5, 6, 10]);
    const b = r.pick([2, 3, 4, 5]);
    const ys = [0, 1, 2, 3].map((x) => a * b ** x);
    return {
      prompt: md`The table fits $y = ab^{x}$ exactly.

${table([0, 1, 2, 3], ys)}

Find $a$ and $b$. Give the pair as (a, b).`,
      answer: `(${a}, ${b})`,
      form: "tuple",
      verify: [`a b = ${ys[1]}`, `a b^2 = ${ys[2]}`],
      hint: md`At $x = 0$, $y = ab^{0} = a$. Each step of 1 in $x$ multiplies $y$ by $b$.`,
      solution: [
        { math: md`a = y(0) = ${a}`, note: md`$b^{0} = 1$, so the value at $x = 0$ is $a$ itself.` },
        { math: md`b = \frac{${ys[1]}}{${ys[0]}} = \frac{${ys[2]}}{${ys[1]}} = \frac{${ys[3]}}{${ys[2]}} = ${b}`, note: "Every ratio of neighbours is the same. That constant ratio is what makes the data exponential." },
        { math: md`y = ${a} \cdot ${b}^{x}`, note: md`Check: $x = 3$ gives $${a} \cdot ${b ** 3} = ${ys[3]}$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([2, 3, 5, 10]);
    const p = r.pick([2, 3]);
    const ys = [1, 2, 3, 4].map((x) => a * x ** p);
    return {
      prompt: md`The table fits a power model $y = ax^{p}$ exactly.

${table([1, 2, 3, 4], ys)}

Find $a$ and $p$. Give the pair as (a, p).`,
      answer: `(${a}, ${p})`,
      form: "tuple",
      verify: [`a 2^p = ${ys[1]}`, `a 3^p = ${ys[2]}`],
      hint: md`At $x = 1$, $y = a$. Doubling $x$ from 1 to 2 multiplies $y$ by $2^{p}$.`,
      solution: [
        { math: md`a = y(1) = ${a}`, note: md`$1^{p} = 1$ for any $p$.` },
        { math: md`\frac{y(2)}{y(1)} = \frac{${ys[1]}}{${ys[0]}} = ${2 ** p} = 2^{p}`, note: md`So $p = ${p}$. Check with $x = 4$: $\frac{y(4)}{y(2)} = \frac{${ys[3]}}{${ys[1]}} = ${2 ** p}$ too.` },
        { math: md`y = ${a}x^{${p}}`, note: md`Check: $x = 3$ gives $${a} \cdot ${3 ** p} = ${ys[2]}$. Not exponential: the ratios of neighbours $${2 ** p}, ${num(1.5 ** p)}, \ldots$ are not constant.` },
      ],
    };
  }
  const a = r.pick([64, 80, 96, 128, 160, 240, 320]);
  const d = r.pick([2, 2, 4]);
  if (d === 4 && a % 64 !== 0) return fitExact(r);
  const ys = [0, 1, 2, 3].map((x) => a / d ** x);
  return {
    prompt: md`The table fits $y = ab^{x}$ exactly.

${table([0, 1, 2, 3], ys)}

Find $a$ and $b$. Give the pair as (a, b); fractions are fine.`,
    answer: `(${a}, 1/${d})`,
    form: "tuple",
    verify: [`a b = ${ys[1]}`, `a b^3 = ${ys[3]}`],
    hint: md`The values shrink, so $b$ is less than 1. What is each value divided by the one before it?`,
    solution: [
      { math: md`a = y(0) = ${a}`, note: "" },
      { math: md`b = \frac{${ys[1]}}{${ys[0]}} = \frac{1}{${d}}`, note: md`Each step divides by ${d}, which is multiplying by $\frac{1}{${d}}$. Decay is still exponential: a constant ratio below 1.` },
      { math: md`y = ${a}\left(\tfrac{1}{${d}}\right)^{x}`, note: md`Check: $x = 3$ gives $\frac{${a}}{${d ** 3}} = ${ys[3]}$.` },
    ],
  };
};

const chooseModel: Generator = (r) => {
  const kind = r.int(0, 2);
  const xs = [1, 2, 3, 4];
  let ys: number[];
  let name: string;
  let rule: string;
  if (kind === 0) {
    const m = r.pick([3, 4, 5, 6, 7, 8]);
    const c = r.pick([1, 2, 3, 5, 7, 9, 11]);
    ys = xs.map((x) => m * x + c);
    name = "linear";
    rule = md`y = ${m}x + ${c}`;
  } else if (kind === 1) {
    const a = r.pick([2, 3, 4, 5, 6]);
    const b = r.pick([2, 3, 4]);
    ys = xs.map((x) => a * b ** x);
    name = "exponential";
    rule = md`y = ${a} \cdot ${b}^{x}`;
  } else {
    const a = r.pick([1, 2, 3, 4, 5]);
    const p = r.pick([2, 3]);
    ys = xs.map((x) => a * x ** p);
    name = "power";
    rule = md`y = ${a === 1 ? "" : a}x^{${p}}`;
  }
  const diffs = ys.slice(1).map((y, i) => y - ys[i]!);
  const ratios = ys.slice(1).map((y, i) => num(y / ys[i]!));
  const choices = ["linear", "exponential", "power"];
  return {
    prompt: md`Which kind of model fits this table exactly?

${table(xs, ys)}`,
    choices,
    accept: [name],
    hint: "Equal steps in x. Are the differences in y constant? Are the ratios constant? If neither, test y against x^2 or x^3.",
    solution: [
      { math: md`\text{differences: } ${diffs.join(",\\; ")}`, note: kind === 0 ? "Constant differences: equal steps in x add the same amount to y. That is a line." : "Not constant, so not linear." },
      { math: md`\text{ratios: } ${ratios.join(",\\; ")}`, note: kind === 1 ? "Constant ratios: equal steps in x multiply y by the same factor. That is exponential." : "Not constant, so not exponential." },
      ...(kind === 2
        ? [{ math: md`\frac{y}{x^{${ys[1]! / ys[0]! === 4 ? 2 : 3}}} = ${ys.map((y, i) => num(y / xs[i]! ** (ys[1]! / ys[0]! === 4 ? 2 : 3))).join(",\\; ")}`, note: md`Constant, so $y$ is a fixed multiple of a power of $x$. Also: doubling $x$ from 1 to 2 or from 2 to 4 multiplies $y$ by $${ys[1]! / ys[0]!}$ both times.` }]
        : []),
      { math: rule, note: md`The model is **${name}**.` },
    ],
  };
};

const fitFromPoints: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const a = r.pick([2, 3, 4, 5, 6, 8, 10]);
    const b = r.pick([2, 3, 5]);
    const n = r.pick([2, 3, 4]);
    const y = a * b ** n;
    return {
      prompt: md`An exponential model $y = ab^{x}$ passes through $(0, ${a})$ and $(${n}, ${y})$. Find $b$.`,
      answer: String(b),
      verify: [`${a} b^${n} = ${y}`],
      hint: md`$a = ${a}$ from the first point. The second point then says $${a}b^{${n}} = ${y}$.`,
      solution: [
        { math: md`a = ${a}`, note: md`At $x = 0$, $y = a$.` },
        { math: md`${a}b^{${n}} = ${y} \;\Rightarrow\; b^{${n}} = ${b ** n}`, note: "Substitute the second point and divide by a." },
        { math: md`b = \sqrt[${n}]{${b ** n}} = ${b}`, note: md`So $y = ${a} \cdot ${b}^{x}$: it is multiplied by ${b} for every step of 1 in $x$.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.pick([2, 3, 4, 5, 6]);
    const p = r.pick([2, 3]);
    const x = r.pick([2, 3, 4]);
    const y = a * x ** p;
    return {
      prompt: md`A power model $y = ax^{p}$ passes through $(1, ${a})$ and $(${x}, ${y})$. Find $p$.`,
      answer: String(p),
      verify: [`${a} * ${x}^p = ${y}`],
      hint: md`$a = ${a}$ from the point at $x = 1$. Then $${x}^{p} = \frac{${y}}{${a}}$.`,
      solution: [
        { math: md`a = ${a}`, note: md`At $x = 1$, $y = a \cdot 1^{p} = a$.` },
        { math: md`${a} \cdot ${x}^{p} = ${y} \;\Rightarrow\; ${x}^{p} = ${x ** p}`, note: "Substitute and divide by a." },
        { math: md`p = ${p}`, note: md`$${x}^{${p}} = ${x ** p}$. In general $p = \frac{\ln(${x ** p})}{\ln ${x}}$, by taking logs.` },
      ],
    };
  }
  if (kind === 2) {
    const c = r.pick([0.5, 0.8, 1, 1.2, 1.5, 2, 2.5]);
    const m = r.pick([0.2, 0.25, 0.3, 0.4, 0.5, 0.6]);
    return {
      prompt: md`Plotting $(x, \ln y)$ for a data set gave points close to the line $\ln y = ${num(c)} + ${num(m)}x$. Write the fitted model as $y = ab^{x}$ and give $(a, b)$ exactly (type $e^{1.2}$ as e^(1.2)).`,
      answer: `(e^(${num(c)}), e^(${num(m)}))`,
      form: "tuple",
      // The line's values at x = 1 and x = 2, written in terms of the model.
      verify: [`ln(a) + ln(b) = ${num(c + m)}`, `ln(a) + 2 ln(b) = ${num(c + 2 * m)}`],
      hint: md`$\ln y = \ln a + x\ln b$. Match it to the line: intercept $= \ln a$, slope $= \ln b$. Then undo the logs with $e$.`,
      solution: [
        { math: md`\ln y = \ln a + (\ln b)x`, note: md`Take $\ln$ of $y = ab^{x}$: $\ln(ab^{x}) = \ln a + \ln b^{x} = \ln a + x\ln b$.` },
        { math: md`\ln a = ${num(c)}, \qquad \ln b = ${num(m)}`, note: "Intercept and slope of the fitted line." },
        { math: md`a = e^{${num(c)}} \approx ${approx(Math.exp(c), 3)}, \qquad b = e^{${num(m)}} \approx ${approx(Math.exp(m), 3)}`, note: md`$e^{\ln a} = a$. The growth factor is about ${approx(Math.exp(m), 2)} per unit of $x$.` },
      ],
    };
  }
  const c = r.pick([0.5, 0.7, 1, 1.4, 2]);
  const p = r.pick([1.5, 2, 2.5, 3]);
  return {
    prompt: md`Plotting $(\ln x, \ln y)$ for a data set gave points close to the line $\ln y = ${num(c)} + ${num(p)}\ln x$. Write the fitted model as $y = ax^{p}$ and give $(a, p)$ exactly (type $e^{0.7}$ as e^(0.7)).`,
    answer: `(e^(${num(c)}), ${num(p)})`,
    form: "tuple",
    // The model's values at x = 2 and x = 3.
    verify: [`a 2^p = 2^${num(p)} e^(${num(c)})`, `a 3^p = 3^${num(p)} e^(${num(c)})`],
    hint: md`$\ln y = \ln a + p\ln x$. The slope of the log-log line is $p$ itself, and the intercept is $\ln a$.`,
    solution: [
      { math: md`\ln y = \ln a + p\ln x`, note: md`Take $\ln$ of $y = ax^{p}$: $\ln(ax^{p}) = \ln a + p\ln x$.` },
      { math: md`p = ${num(p)}, \qquad \ln a = ${num(c)}`, note: "Slope and intercept. Only a wears a log, so only a needs undoing." },
      { math: md`a = e^{${num(c)}} \approx ${approx(Math.exp(c), 3)}`, note: md`So $y \approx ${approx(Math.exp(c), 2)}x^{${num(p)}}$.` },
    ],
  };
};

// ── The unit ────────────────────────────────────────────────────────────────

export const unit3: Unit = {
  title: "Exponential and Logarithmic Models",
  lessons: [
    {
      id: slug("Compound and continuous interest"),
      title: "Compound and continuous interest",
      summary: "Interest on interest: deriving A = P(1 + r/n)^(nt), pushing n to infinity to get Pe^(rt), and solving for time with logarithms.",
      blocks: [
        {
          kind: "text",
          body: md`Interest is rent paid for the use of money. A bank that pays 5% a year on a 1000 dollar deposit adds 50 dollars at the end of the year. The question this lesson answers is what happens after that: does the 50 dollars itself earn interest?

With **simple interest** it doesn't. The bank pays 5% of the *original* deposit every year, so you gain 50 dollars a year, forever. After $t$ years you have $1000 + 50t$. In general, simple interest at rate $r$ gives $A = P + Prt = P(1 + rt)$: a line.

With **compound interest** it does. The 50 dollars joins the balance, and next year's 5% is taken of 1050, giving 52.50. The year after, 5% of 1102.50. Interest on interest.`,
        },
        {
          kind: "why",
          title: "Why simple interest is a line and compound interest is a curve",
          body: md`Simple interest *adds* the same amount each year. Equal steps in time add equal amounts: that is an arithmetic sequence, and its graph is a line (Algebra 1).

Compound interest *multiplies* by the same factor each year. Adding 5% of the balance to the balance is the same as multiplying it by 1.05, for the reason you met in Algebra 2: $A + 0.05A = 1.05A$. Equal steps in time multiply by equal factors: a geometric sequence, which is exponential growth.

Watch the two pull apart. At 10% on 1000 dollars:

$$\begin{array}{r|rrrr} \text{year} & 0 & 1 & 2 & 3 \\ \hline \text{simple} & 1000 & 1100 & 1200 & 1300 \\ \text{compound} & 1000 & 1100 & 1210 & 1331 \end{array}$$

The gap is 10 dollars after two years and 31 after three. It only widens, because the compound balance is multiplied by 1.1 while the simple one is nudged up by a fixed 100.`,
        },
        {
          kind: "why",
          title: "Where A = P(1 + r/n)^(nt) comes from",
          body: md`Banks usually pay interest more often than once a year. Say the yearly rate is $r$ (as a decimal: 0.06 for 6%) and it is paid $n$ times a year. Each payment can't be the whole $r$; the year's rate is split evenly, so each payment is the fraction $\frac{r}{n}$ of the current balance. At 6% paid monthly, each payment is $\frac{0.06}{12} = 0.005$: half a percent.

Adding $\frac{r}{n}$ of the balance multiplies the balance by $1 + \frac{r}{n}$. That happens $n$ times a year, so in $t$ years it happens $nt$ times. Multiplying by the same factor $nt$ times is raising it to the power $nt$:

$$A = P\left(1 + \frac{r}{n}\right)^{nt}.$$

Nothing here is new. It is the growth model $A = P \cdot b^{\text{steps}}$ from Algebra 2, with the step being one payment, $b = 1 + \frac{r}{n}$, and $nt$ steps.`,
        },
        {
          kind: "key",
          title: "Compound interest",
          body: md`A deposit $P$ at yearly rate $r$, compounded $n$ times a year, is worth after $t$ years

$$A = P\left(1 + \frac{r}{n}\right)^{nt}.$$

Common values of $n$: 1 (yearly), 2 (semiannually), 4 (quarterly), 12 (monthly), 365 (daily). The rate $r$ is called the **nominal** rate; the balance grows by more than $r$ in a year whenever $n > 1$.`,
        },
        {
          kind: "example",
          title: "Quarterly compounding",
          problem: md`2500 dollars is deposited at 4% a year, compounded quarterly. Find the balance after 3 years.`,
          steps: [
            { math: md`A = 2500\left(1 + \frac{0.04}{4}\right)^{4 \cdot 3}`, note: md`$P = 2500$, $r = 0.04$, $n = 4$, $t = 3$.` },
            { math: md`A = 2500(1.01)^{12}`, note: "Twelve payments of 1% each. The exponent counts payments, not years." },
            { math: md`A \approx 2500(1.126825) \approx 2817.06`, note: "Compounded once a year it would be 2500(1.04)^3 = 2812.16. Quarterly compounding earns 4.90 dollars more." },
          ],
        },
        {
          kind: "plot",
          x: [0, 20],
          y: [0, 5000],
          curves: [
            { expr: "1000 e^(r x)", label: "y = 1000e^{rx}", color: 3, dashed: true },
            { expr: "1000 (1 + r/n)^(n x)", label: "y = 1000\\left(1 + \\frac{r}{n}\\right)^{nx}", color: 1 },
            { expr: "1000 (1 + r x)", label: "\\text{simple: } y = 1000(1 + rx)", color: 2 },
          ],
          params: [
            { name: "r", tex: "r", min: 0.02, max: 0.12, step: 0.01, value: 0.06 },
            { name: "n", tex: "n", min: 1, max: 52, step: 1, value: 1 },
          ],
          caption: md`1000 dollars for $x$ years. Simple interest (orange) is a line. Compound interest (blue) curves upward, and sliding $n$ up lifts it toward the dashed green ceiling, $1000e^{rx}$. After 20 years the compound balance is {=1000(1 + r/n)^(20n)} and the continuous one is {=1000e^(20r)}.`,
        },
        {
          kind: "why",
          title: "Why more frequent compounding has a ceiling",
          body: md`Slide $n$ in the plot from 1 to 52 and the blue curve rises, but by less and less. Going from yearly to monthly matters; going from weekly to daily barely does. In Algebra 2 you saw why: one year's growth factor is $\left(1 + \frac{r}{n}\right)^{n}$, and writing $m = \frac{n}{r}$ turns it into

$$\left(1 + \frac{1}{m}\right)^{mr} = \left[\left(1 + \frac{1}{m}\right)^{m}\right]^{r}.$$

As $n$ grows so does $m$, and the bracket closes in on $e = 2.71828\ldots$, the number defined as the limit of $\left(1 + \frac{1}{m}\right)^{m}$. So however often the bank pays, one year can multiply the balance by at most $e^{r}$, and $t$ years by at most $(e^{r})^{t} = e^{rt}$. Paying "infinitely often" is called **continuous** compounding, and it reaches that ceiling exactly.`,
        },
        {
          kind: "key",
          title: "Continuous compounding",
          body: md`Compounded continuously at yearly rate $r$, a deposit $P$ grows in $t$ years to

$$A = Pe^{rt}.$$

Type it as P e^(r t), for example 500e^(0.04t). The same formula describes any quantity growing at a steady instantaneous rate: populations, bacteria, inflation. For decay (radioactive material, a cooling drink) the exponent is negative, $A = Pe^{-rt}$.`,
        },
        {
          kind: "example",
          title: "Continuous compounding",
          problem: md`The same 2500 dollars at 4% for 3 years, compounded continuously.`,
          steps: [
            { math: md`A = 2500e^{0.04 \cdot 3} = 2500e^{0.12}`, note: md`$rt = 0.12$: the exponent is the rate times the time.` },
            { math: md`A \approx 2500(1.127497) \approx 2818.74`, note: "Only 1.68 dollars more than quarterly. The ceiling is close to what quarterly already achieves." },
          ],
        },
        {
          kind: "text",
          body: md`So far $t$ was given and we found $A$. The more interesting questions run the other way. *How long until my money doubles? What rate do I need?* Then the unknown is in the exponent, and the tool for pulling it down is the logarithm (Algebra 2, Unit 6). The plan is always the same: divide to isolate the power, take $\ln$ of both sides, and use $\ln(b^{u}) = u \ln b$, or for base $e$ simply $\ln(e^{u}) = u$.`,
        },
        {
          kind: "proof",
          title: "The doubling time under continuous compounding is ln 2 / r",
          given: md`$A = Pe^{rt}$ with $P > 0$ and $r > 0$`,
          prove: md`$A = 2P$ exactly when $t = \dfrac{\ln 2}{r}$`,
          steps: [
            { statement: md`$Pe^{rt} = 2P$`, reason: "The balance has doubled." },
            { statement: md`$e^{rt} = 2$`, reason: md`Divide both sides by $P$, which is not 0.` },
            { statement: md`$\ln(e^{rt}) = \ln 2$`, reason: md`$\ln$ is a function: equal inputs give equal outputs. It is one-to-one, so this step reverses too.` },
            { statement: md`$rt = \ln 2$`, reason: md`$\ln$ and $e^{x}$ are inverses: $\ln(e^{u}) = u$.` },
            { statement: md`$t = \dfrac{\ln 2}{r}$`, reason: md`Divide by $r \neq 0$. Every step was reversible, so this $t$ is the only one.` },
          ],
        },
        {
          kind: "key",
          title: "Doubling time",
          body: md`- Compounded continuously at rate $r$: $\;T = \dfrac{\ln 2}{r}$.
- Compounded $n$ times a year: $\;T = \dfrac{\ln 2}{n \ln\left(1 + \frac{r}{n}\right)}$ years. For yearly compounding, $T = \dfrac{\ln 2}{\ln(1 + r)}$.
- **Rule of 70:** $T \approx \dfrac{70}{\text{rate in percent}}$. At 7%, about 10 years; at 2%, about 35.

The deposit $P$ never appears. Doubling time depends only on the rate, because the proof divided $P$ away.`,
        },
        {
          kind: "why",
          title: "Why the rule of 70 works",
          body: md`$\ln 2 = 0.6931\ldots$, so the continuous doubling time is $\frac{0.693}{r}$. With the rate as a percent, $r = \frac{\text{rate}}{100}$, that is $\frac{69.3}{\text{rate}}$. The number 70 is close and has many divisors, so it is easy to use in your head.

For yearly compounding the exact answer is $\frac{\ln 2}{\ln(1 + r)}$, and that is nearly the same because $\ln(1 + r) \approx r$ when $r$ is small:

$$\ln 1.02 = 0.0198, \qquad \ln 1.05 = 0.0488, \qquad \ln 1.10 = 0.0953.$$

The graph of $\ln x$ passes through $(1, 0)$ with slope 1, so just to the right of 1 it is almost the line $y = x - 1$. The approximation slips as $r$ grows: at 10% the rule says 7 years and the true yearly answer is 7.27.`,
        },
        {
          kind: "example",
          title: "Doubling time with yearly compounding",
          problem: md`How long does money take to double at 6%, compounded once a year?`,
          steps: [
            { math: md`P(1.06)^{t} = 2P \;\Rightarrow\; (1.06)^{t} = 2`, note: md`Divide by $P$.` },
            { math: md`t \ln 1.06 = \ln 2`, note: md`Take $\ln$ of both sides and bring the exponent down: $\ln(b^{t}) = t \ln b$.` },
            { math: md`t = \frac{\ln 2}{\ln 1.06} \approx \frac{0.6931}{0.0583} \approx 11.9 \text{ years}`, note: md`The rule of 70 gives $\frac{70}{6} \approx 11.7$. Close.` },
          ],
        },
        {
          kind: "example",
          title: "Finding the rate",
          problem: md`An investment of 3000 dollars grew to 5000 dollars in 8 years with continuous compounding. What was the rate?`,
          steps: [
            { math: md`3000e^{8r} = 5000 \;\Rightarrow\; e^{8r} = \frac{5}{3}`, note: "Divide by 3000." },
            { math: md`8r = \ln\frac{5}{3} \approx 0.5108`, note: md`$\ln$ of both sides.` },
            { math: md`r \approx 0.0639`, note: "About 6.39% a year." },
          ],
        },
        {
          kind: "key",
          title: "Effective annual rate",
          body: md`The **effective annual rate** (banks call it APY) is the percent the balance actually grows by in one year:

$$\left(1 + \frac{r}{n}\right)^{n} - 1, \qquad \text{or } e^{r} - 1 \text{ for continuous compounding.}$$

6% compounded monthly: $(1.005)^{12} - 1 = 0.0617$, so 6.17%. It lets you compare accounts with different $n$ on equal footing. Follow one dollar for one year: that is all the formula does.`,
        },
        {
          kind: "check",
          prompt: md`1000 dollars is deposited at 8% a year, compounded quarterly. How much is in the account after 2 years? ${CENT}`,
          answer: "1171.66",
          tolerance: 0.005,
          explain: md`$A = 1000\left(1 + \frac{0.08}{4}\right)^{4 \cdot 2} = 1000(1.02)^{8} \approx 1000(1.171659) \approx 1171.66$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $500e^{0.04t} = 1000$ for the doubling time $t$. ${EXACT_LN}`,
          answer: "ln(2)/0.04",
          explain: md`Divide by 500: $e^{0.04t} = 2$. Take $\ln$: $0.04t = \ln 2$, so $t = \frac{\ln 2}{0.04} = 25\ln 2 \approx 17.3$ years.`,
        },
      ],
      practice: [compoundAmount, doublingTime, howLong],
    },
    {
      id: slug("Logistic growth"),
      title: "Logistic growth",
      summary: "Growth with a ceiling: the logistic function L/(1 + Ce^(-kt)), why it levels off at the carrying capacity, and where it grows fastest.",
      blocks: [
        {
          kind: "text",
          body: md`Exponential growth never stops. A population doubling every year would, after 60 years, outnumber the atoms in the solar system. Real populations don't do that. Bacteria run out of sugar, deer run out of forest, a rumor runs out of people who haven't heard it. Growth starts out exponential and then slows and levels off.

The **logistic** model captures this with one extra ingredient: a ceiling. Its graph is the S-shaped curve you see in the plot below.`,
        },
        {
          kind: "key",
          title: "Logistic function",
          body: md`$$P(t) = \frac{L}{1 + Ce^{-kt}}, \qquad L, C, k > 0.$$

- $L$ is the **carrying capacity**, the ceiling the population approaches.
- $k$ sets how fast it grows: a larger $k$ makes a steeper S.
- $C$ is fixed by the starting value: $P(0) = \dfrac{L}{1 + C}$.

Type it as L/(1 + C e^(-k t)), for example 600/(1 + 5e^(-0.3t)).`,
        },
        {
          kind: "why",
          title: "Why the curve levels off at L",
          body: md`Look at the denominator, $1 + Ce^{-kt}$. The term $e^{-kt}$ is exponential decay (Algebra 2): as $t$ grows it shrinks toward 0, so the denominator shrinks toward $1 + 0 = 1$ and $P$ rises toward $\frac{L}{1} = L$. It never gets there, because $Ce^{-kt}$ is positive, so the denominator is always a little more than 1 and $P$ is always a little less than $L$. The line $y = L$ is a horizontal asymptote.

Run time backwards instead. As $t \to -\infty$, $e^{-kt}$ grows without bound, the denominator becomes huge, and $P$ sinks toward 0. The other asymptote is $y = 0$. Between the two the curve climbs, and it climbs all the way: $P$ is increasing because its denominator is decreasing.`,
        },
        {
          kind: "plot",
          x: [0, 20],
          y: [0, 1100],
          curves: [{ expr: "L/(1 + C e^(-k x))", label: "P(t) = \\frac{L}{1 + Ce^{-kt}}", color: 1 }],
          hlines: [{ y: "L", label: "L = {L}" }, { y: "L/2" }],
          points: [
            { x: 0, y: "L/(1 + C)", label: "(0, {=L/(1 + C)})", color: 2 },
            { x: "ln(C)/k", y: "L/2", label: "\\left({=ln(C)/k}, {=L/2}\\right)", color: 3 },
          ],
          params: [
            { name: "L", tex: "L", min: 200, max: 1000, step: 100, value: 600 },
            { name: "C", tex: "C", min: 1, max: 10, step: 1, value: 5 },
            { name: "k", tex: "k", min: 0.1, max: 1, step: 0.05, value: 0.3 },
          ],
          caption: md`Slide $L$ to move the ceiling, $k$ to change the steepness, and $C$ to change the start without changing the ceiling. The green point is the midpoint, where $P = \frac{L}{2}$; it sits at $t = \frac{\ln C}{k}$, as the proof below shows.`,
        },
        {
          kind: "why",
          title: "Where the formula comes from",
          body: md`Think of $L - P$ as the **room left**: the unfilled part of the ceiling. The logistic model makes one assumption about it:

*The ratio of filled to unfilled, $\dfrac{P}{L - P}$, grows exponentially.*

That is, $\dfrac{P}{L - P} = \dfrac{1}{C}e^{kt}$ for some constants $C$ and $k$. It is a natural assumption. When the population is tiny, $L - P \approx L$ is nearly constant, so the ratio growing exponentially means $P$ itself does: the familiar unlimited growth. When the population is nearly full, $P \approx L$, and the ratio growing exponentially means the room left shrinks exponentially, which is how a nearly full environment fills in.

Now solve that one equation for $P$:

$$CP = (L - P)e^{kt} \;\Rightarrow\; CP + Pe^{kt} = Le^{kt} \;\Rightarrow\; P\left(C + e^{kt}\right) = Le^{kt}.$$

$$P = \frac{Le^{kt}}{C + e^{kt}} = \frac{L}{Ce^{-kt} + 1},$$

dividing top and bottom by $e^{kt}$ in the last step. That is the logistic function. The constant $\frac{1}{C}$ is the starting ratio: at $t = 0$, $\frac{P_0}{L - P_0} = \frac{1}{C}$, so $C = \frac{L - P_0}{P_0}$, room left over amount present.`,
        },
        {
          kind: "key",
          title: "Reading off C",
          body: md`$$P(0) = \frac{L}{1 + C} \qquad\text{so}\qquad C = \frac{L}{P_0} - 1 = \frac{L - P_0}{P_0}.$$

A lake that can hold 600 fish and is stocked with 100 has $C = \frac{600}{100} - 1 = 5$: five units of room for every fish.`,
        },
        {
          kind: "example",
          title: "Building a logistic model",
          problem: md`A lake can support 600 fish. It is stocked with 100, and four years later there are 400. Find the logistic model.`,
          steps: [
            { math: md`L = 600, \qquad C = \frac{600}{100} - 1 = 5`, note: "The ceiling is given; the start fixes C." },
            { math: md`\frac{600}{1 + 5e^{-4k}} = 400 \;\Rightarrow\; 1 + 5e^{-4k} = \frac{600}{400} = 1.5`, note: md`Substitute $t = 4$, $P = 400$, then cross-multiply and divide.` },
            { math: md`5e^{-4k} = 0.5 \;\Rightarrow\; e^{-4k} = 0.1`, note: "Isolate the power: subtract 1, divide by 5." },
            { math: md`-4k = \ln 0.1 = -\ln 10 \;\Rightarrow\; k = \frac{\ln 10}{4} \approx 0.576`, note: md`$\ln$ of both sides; $\ln\frac{1}{10} = -\ln 10$.` },
            { math: md`P(t) = \frac{600}{1 + 5e^{-0.576t}}`, note: md`Check: $P(4) = \frac{600}{1 + 5e^{-\ln 10}} = \frac{600}{1 + 0.5} = 400$.` },
          ],
        },
        {
          kind: "proof",
          title: "The midpoint is at t = ln C / k, and the curve is symmetric about it",
          given: md`$P(t) = \dfrac{L}{1 + Ce^{-kt}}$ and $t_m = \dfrac{\ln C}{k}$`,
          prove: md`$P(t_m) = \dfrac{L}{2}$, and $P(t_m + s) + P(t_m - s) = L$ for every $s$`,
          steps: [
            { statement: md`$e^{-kt_m} = e^{-\ln C} = \dfrac{1}{C}$`, reason: md`$kt_m = \ln C$, and $e^{-\ln C} = \frac{1}{e^{\ln C}} = \frac{1}{C}$.` },
            { statement: md`$P(t_m) = \dfrac{L}{1 + C \cdot \frac{1}{C}} = \dfrac{L}{2}$`, reason: "Substitute into the denominator." },
            { statement: md`$P(t_m + s) = \dfrac{L}{1 + Ce^{-kt_m}e^{-ks}} = \dfrac{L}{1 + e^{-ks}}$`, reason: md`$e^{-k(t_m + s)} = e^{-kt_m}e^{-ks}$ and $Ce^{-kt_m} = 1$.` },
            { statement: md`$P(t_m - s) = \dfrac{L}{1 + e^{ks}}$`, reason: md`The same with $-s$ in place of $s$.` },
            { statement: md`$\dfrac{L}{1 + e^{-ks}} = \dfrac{Le^{ks}}{e^{ks} + 1}$`, reason: md`Multiply top and bottom by $e^{ks}$.` },
            { statement: md`$P(t_m + s) + P(t_m - s) = \dfrac{Le^{ks} + L}{e^{ks} + 1} = L$`, reason: md`Common denominator $e^{ks} + 1$; factor $L$ out of the top and cancel.` },
          ],
        },
        {
          kind: "why",
          title: "Why the growth is fastest at the midpoint",
          body: md`The symmetry says the curve above the midpoint is the curve below it turned upside down: as far as $P$ is below $\frac{L}{2}$ at time $t_m - s$, it is above $\frac{L}{2}$ at time $t_m + s$. So the curve speeds up all the way to the midpoint and then slows down by the mirror image. The midpoint is where it is steepest. It is called the **inflection point**: the curve bends upward before it and downward after it.

There is a direct reason too. How fast a population grows depends on two things: how many are there to reproduce, proportional to $P$, and how much room is left, proportional to $L - P$. Their product $P(L - P)$ is a downward parabola in $P$ with zeros at $P = 0$ and $P = L$, so its vertex, the fastest growth, is halfway between, at $P = \frac{L}{2}$ (Algebra 1). Calculus will show that the logistic curve is exactly the one whose growth rate is proportional to $P(L - P)$.`,
        },
        {
          kind: "plot",
          x: [0, 16],
          y: [0, 700],
          curves: [
            { expr: "100 e^(0.4x)", label: "100e^{0.4t}", color: 2, dashed: true },
            { expr: "600/(1 + 5e^(-0.4x))", label: "\\frac{600}{1 + 5e^{-0.4t}}", color: 1 },
          ],
          hlines: [{ y: 600, label: "L = 600" }],
          points: [{ x: "ln(5)/0.4", y: 300, label: "\\text{midpoint}", color: 3 }],
          caption: md`Exponential and logistic growth from the same start of 100 and the same $k = 0.4$. For the first couple of years they are nearly identical: room is plentiful. Then the room-left factor pulls the logistic curve away and bends it toward the ceiling, while the exponential leaves the picture.`,
        },
        {
          kind: "example",
          title: "Predicting with the model",
          problem: md`A population follows $P(t) = \dfrac{600}{1 + 5e^{-0.5t}}$. Find $P(6)$, and the time when the population reaches 90% of capacity.`,
          steps: [
            { math: md`P(6) = \frac{600}{1 + 5e^{-3}} \approx \frac{600}{1 + 5(0.049787)} = \frac{600}{1.248935} \approx 480`, note: md`Exponent first: $-0.5 \cdot 6 = -3$. The population is at 80% of capacity.` },
            { math: md`\frac{600}{1 + 5e^{-0.5t}} = 540 \;\Rightarrow\; 1 + 5e^{-0.5t} = \frac{600}{540} = \frac{10}{9}`, note: "90% of 600 is 540. Cross-multiply and divide." },
            { math: md`5e^{-0.5t} = \frac{1}{9} \;\Rightarrow\; e^{-0.5t} = \frac{1}{45}`, note: "Subtract 1, divide by 5." },
            { math: md`-0.5t = -\ln 45 \;\Rightarrow\; t = 2\ln 45 \approx 7.6 \text{ years}`, note: md`The midpoint was at $t = \frac{\ln 5}{0.5} \approx 3.2$. From 50% to 90% takes longer than from 17% to 50%: growth is slowing.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A town of 8000 people will eventually all hear a piece of news. Today 500 have heard it. In the logistic model $N(t) = \frac{8000}{1 + Ce^{-kt}}$, find $C$.`,
          answer: "15",
          explain: md`$N(0) = \frac{8000}{1 + C} = 500$, so $1 + C = 16$ and $C = 15$. Or directly: $C = \frac{L - N_0}{N_0} = \frac{7500}{500} = 15$.`,
        },
        {
          kind: "check",
          prompt: md`Solve $\frac{600}{1 + 5e^{-0.3t}} = 300$. ${EXACT_LN}`,
          answer: "ln(5)/0.3",
          explain: md`$1 + 5e^{-0.3t} = 2$, so $e^{-0.3t} = \frac{1}{5}$ and $-0.3t = -\ln 5$. Then $t = \frac{\ln 5}{0.3} \approx 5.4$. This is the midpoint, $\frac{\ln C}{k}$.`,
        },
      ],
      practice: [logisticRead, logisticBuild, logisticValue],
    },
    {
      id: slug("Fitting models to data"),
      title: "Fitting models to data",
      summary: "Telling linear, exponential and power growth apart from a table, and using logarithms to turn curves into lines you can fit.",
      blocks: [
        {
          kind: "text",
          body: md`Real quantities arrive as tables of measurements, not formulas. The job of modeling is to look at a table and decide what kind of formula is behind it, then find the constants. Three families cover most of what you'll meet:

- **Linear:** $y = mx + c$.
- **Exponential:** $y = ab^{x}$, equal to $ae^{kx}$ with $b = e^{k}$.
- **Power:** $y = ax^{p}$.

Each leaves a fingerprint in the table.`,
        },
        {
          kind: "key",
          title: "Three fingerprints",
          body: md`For equal steps in $x$:

- **Linear:** the *differences* of consecutive $y$ values are constant.
- **Exponential:** the *ratios* of consecutive $y$ values are constant.
- **Power:** neither is constant, but *multiplying* $x$ by a factor always multiplies $y$ by the same factor. Doubling $x$ multiplies $y$ by $2^{p}$.

A table with $x = 1, 2, 3, 4$ and $y = 3, 12, 27, 48$ has differences $9, 15, 21$ and ratios $4, 2.25, 1.78$: not linear, not exponential. But $y$ goes $\times 4$ from $x = 1$ to $2$ and again from $x = 2$ to $4$. So $2^{p} = 4$, $p = 2$, and $y = 3x^{2}$.`,
        },
        {
          kind: "why",
          title: "Why constant ratios mean exponential",
          body: md`If $y = ab^{x}$, then stepping $x$ up by 1 gives

$$\frac{y(x + 1)}{y(x)} = \frac{ab^{x + 1}}{ab^{x}} = b.$$

The ratio is $b$ no matter where you are in the table. That is one direction. The other direction is what lets us *read* a table: if every ratio of neighbours is the same number $b$, then $y(1) = y(0)b$, $y(2) = y(1)b = y(0)b^{2}$, and so on, so $y(x) = y(0)b^{x}$. Constant ratios force the exponential form, with $a = y(0)$.

The same argument with subtraction in place of division shows that constant differences $m$ force $y(x) = y(0) + mx$: a line.`,
        },
        {
          kind: "why",
          title: "Why a power law answers to multiplying x",
          body: md`If $y = ax^{p}$, multiply $x$ by any factor $c$:

$$\frac{y(cx)}{y(x)} = \frac{a(cx)^{p}}{ax^{p}} = \frac{c^{p}x^{p}}{x^{p}} = c^{p},$$

using $(cx)^{p} = c^{p}x^{p}$. The factor $c^{p}$ doesn't depend on $x$. Compare the exponential: $\frac{y(cx)}{y(x)} = b^{cx - x} = b^{(c - 1)x}$, which grows with $x$. So "doubling $x$ always multiplies $y$ by the same amount" is the fingerprint of a power law, and "adding 1 to $x$ always multiplies $y$ by the same amount" is the fingerprint of an exponential.`,
        },
        {
          kind: "example",
          title: "Fitting an exponential from a table",
          problem: md`Find a formula for the table.

$$\begin{array}{c|cccc} x & 0 & 1 & 2 & 3 \\ \hline y & 5 & 15 & 45 & 135 \end{array}$$`,
          steps: [
            { math: md`\text{differences: } 10, 30, 90 \qquad \text{ratios: } 3, 3, 3`, note: "Not linear. Constant ratios: exponential." },
            { math: md`b = 3, \qquad a = y(0) = 5`, note: md`$b$ is the common ratio; $a$ is the value at $x = 0$, since $b^{0} = 1$.` },
            { math: md`y = 5 \cdot 3^{x}`, note: md`Check the last entry: $5 \cdot 27 = 135$.` },
          ],
        },
        {
          kind: "text",
          body: md`Tables rarely include $x = 0$, and the points you have may not be neighbours. Then use any two points. From $(0, 4)$ and $(3, 32)$ on $y = ab^{x}$: $a = 4$, and $4b^{3} = 32$ gives $b^{3} = 8$, $b = 2$. From $(1, 3)$ and $(2, 12)$ on $y = ax^{p}$: $a = 3$ (since $1^{p} = 1$), and $3 \cdot 2^{p} = 12$ gives $2^{p} = 4$, $p = 2$. When the power isn't obvious, take logs: $p = \frac{\ln 4}{\ln 2}$.`,
        },
        {
          kind: "key",
          title: "Linearizing with logarithms",
          body: md`Taking $\ln$ of both sides turns each curved model into a line:

$$\begin{array}{lll} \text{model} & \text{take } \ln & \text{straight when you plot} \\ \hline y = ab^{x} & \ln y = \ln a + (\ln b)\,x & (x, \ln y) \\ y = ax^{p} & \ln y = \ln a + p\,\ln x & (\ln x, \ln y) \end{array}$$

Slopes and intercepts turn back into the constants: for the exponential, $b = e^{\text{slope}}$ and $a = e^{\text{intercept}}$; for the power law, $p = \text{slope}$ and $a = e^{\text{intercept}}$. A line is the one shape you can fit by eye, or with a ruler, or with least squares in a later course. So the recipe is: plot the logged data, see which plot is straight, fit the line, undo the logs.`,
        },
        {
          kind: "proof",
          title: "A line in (x, ln y) is an exponential in (x, y)",
          given: md`$\ln y = mx + c$ for all $x$ in the data, with $y > 0$`,
          prove: md`$y = ab^{x}$ with $a = e^{c}$ and $b = e^{m}$`,
          steps: [
            { statement: md`$y = e^{mx + c}$`, reason: md`$e^{x}$ and $\ln x$ are inverses: $e^{\ln y} = y$.` },
            { statement: md`$y = e^{c} \cdot e^{mx}$`, reason: md`Product rule for exponents, $e^{u + v} = e^{u}e^{v}$.` },
            { statement: md`$y = e^{c}\left(e^{m}\right)^{x}$`, reason: md`Power rule, $e^{mx} = (e^{m})^{x}$.` },
            { statement: md`$y = ab^{x}$ with $a = e^{c}$, $b = e^{m}$`, reason: "Name the constants. Both are positive, as a base and a starting value should be." },
          ],
        },
        {
          kind: "plot",
          x: [-0.5, 4.5],
          y: [0, 55],
          curves: [{ expr: "a b^x", label: "y = ab^{x}", color: 1 }],
          points: [
            { x: 0, y: 3, color: 2 },
            { x: 1, y: 6, color: 2 },
            { x: 2, y: 12, color: 2 },
            { x: 3, y: 24, color: 2 },
            { x: 4, y: 48, color: 2 },
          ],
          params: [
            { name: "a", tex: "a", min: 1, max: 6, step: 0.5, value: 1 },
            { name: "b", tex: "b", min: 1, max: 3, step: 0.1, value: 1.5 },
          ],
          caption: md`Fit the curve to the orange data by eye: $a$ sets the height at $x = 0$ and $b$ the ratio between neighbours. It is hard to judge a fit to a curve. The next plot shows the same data after taking logs.`,
        },
        {
          kind: "plot",
          x: [-0.5, 4.5],
          y: [0, 4.5],
          curves: [{ expr: "ln(a) + x ln(b)", label: "\\ln y = \\ln a + (\\ln b)\\,x", color: 1 }],
          points: [
            { x: 0, y: 1.0986, color: 2 },
            { x: 1, y: 1.7918, color: 2 },
            { x: 2, y: 2.4849, color: 2 },
            { x: 3, y: 3.1781, color: 2 },
            { x: 4, y: 3.8712, color: 2 },
          ],
          params: [
            { name: "a", tex: "a", min: 1, max: 6, step: 0.5, value: 1 },
            { name: "b", tex: "b", min: 1, max: 3, step: 0.1, value: 1.5 },
          ],
          caption: md`The same data as $(x, \ln y)$. The points lie on a line, which is the fingerprint of an exponential, and the fitted line's slope is $\ln b = {=ln(b)}$ and intercept $\ln a = {=ln(a)}$. With $a = 3$ and $b = 2$ the line passes through every point: the data is $y = 3 \cdot 2^{x}$.`,
        },
        {
          kind: "example",
          title: "Real data: a growing population",
          problem: md`A city's population, in millions, was 2.5 in 1990, 3.1 in 2000, 3.8 in 2010 and 4.7 in 2020. Fit a model.`,
          steps: [
            { math: md`\text{differences: } 0.6, 0.7, 0.9 \qquad \text{ratios: } 1.24, 1.23, 1.24`, note: "Measured data is never perfectly anything, but the ratios are far steadier than the differences. Choose exponential." },
            { math: md`y = ab^{x}, \quad x = \text{decades since 1990}, \quad a = 2.5`, note: md`Measuring $x$ in decades keeps the numbers small; $a$ is the value at $x = 0$.` },
            { math: md`2.5b^{3} = 4.7 \;\Rightarrow\; b^{3} = 1.88 \;\Rightarrow\; b = 1.88^{1/3} \approx 1.234`, note: "Using the first and last points spreads the fit across the whole table. About 23% growth per decade." },
            { math: md`y \approx 2.5(1.234)^{x}`, note: md`Check the middle: $x = 1$ gives 3.09 (data 3.1) and $x = 2$ gives 3.81 (data 3.8). Good enough to predict 2030: $x = 4$ gives about 5.8 million.` },
          ],
        },
        {
          kind: "example",
          title: "Reading a log-log fit",
          problem: md`For a set of measurements, the points $(\ln x, \ln y)$ lie close to the line $\ln y = 0.7 + 2\ln x$. What is the model?`,
          steps: [
            { math: md`\ln y = \ln a + p\ln x`, note: "A straight log-log plot means a power law." },
            { math: md`p = 2, \qquad \ln a = 0.7 \;\Rightarrow\; a = e^{0.7} \approx 2.01`, note: md`The slope is $p$ as it stands; only the intercept needs $e$ to undo its log.` },
            { math: md`y \approx 2.01x^{2}`, note: md`Doubling $x$ should multiply $y$ by $2^{2} = 4$. That is the check to run against the raw table.` },
          ],
        },
        {
          kind: "key",
          title: "Choosing a model",
          body: md`1. Look at the context. A quantity with a ceiling wants the logistic model from the last lesson; unbounded growth by a percent wants exponential; a quantity that scales with size (area with length, volume with radius) wants a power.
2. Look at the fingerprints: differences, ratios, or the effect of doubling $x$.
3. Plot $(x, \ln y)$ and $(\ln x, \ln y)$. Whichever is straight tells you the family, and its line gives the constants.
4. Check the model against points you didn't use to build it.`,
        },
        {
          kind: "check",
          prompt: md`The table fits $y = ab^{x}$ exactly. Find $b$.

$$\begin{array}{c|cccc} x & 0 & 1 & 2 & 3 \\ \hline y & 4 & 12 & 36 & 108 \end{array}$$`,
          answer: "3",
          explain: md`Each value is 3 times the one before: $\frac{12}{4} = \frac{36}{12} = \frac{108}{36} = 3$. So $b = 3$, and $a = 4$ gives $y = 4 \cdot 3^{x}$.`,
        },
        {
          kind: "check",
          prompt: md`Plotting $(x, \ln y)$ gave the line $\ln y = 2 + 0.5x$. Find $b$ in the model $y = ab^{x}$, exactly (type $e^{0.5}$ as e^(0.5)).`,
          answer: "e^(0.5)",
          explain: md`$\ln y = \ln a + (\ln b)x$, so the slope $0.5$ is $\ln b$ and $b = e^{0.5} \approx 1.65$. The intercept gives $a = e^{2}$.`,
        },
      ],
      practice: [fitExact, chooseModel, fitFromPoints],
    },
  ],
};
