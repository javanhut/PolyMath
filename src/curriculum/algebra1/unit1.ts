import { paren, poly, signed } from "../../math/random";
import { md, type Generator, type Unit } from "../types";

// ── Practice generators ─────────────────────────────────────────────────────

const evaluateExpression: Generator = (r) => {
  const kind = r.int(0, 2);
  if (kind === 0) {
    const a = r.coef(-6, 6);
    const b = r.nonzero(-9, 9);
    const x = r.nonzero(-5, 5);
    return {
      prompt: md`Evaluate $${poly([[a, "x"], [b, ""]])}$ when $x = ${x}$.`,
      answer: String(a * x + b),
      hint: md`Replace $x$ with $(${x})$, in parentheses, then multiply before adding.`,
      solution: [
        { math: md`${a}(${x}) ${signed(b)}`, note: "Substitute, keeping the number in parentheses." },
        { math: md`${a * x} ${signed(b)}`, note: "Multiply first." },
        { math: String(a * x + b), note: "Then add." },
      ],
    };
  }
  if (kind === 1) {
    const b = r.nonzero(-6, 6);
    const c = r.int(-9, 9);
    const x = r.nonzero(-4, 4);
    const value = x * x + b * x + c;
    return {
      prompt: md`Evaluate $${poly([[1, "x^2"], [b, "x"], [c, ""]])}$ when $x = ${x}$.`,
      answer: String(value),
      hint: md`Square first: $(${x})^2 = ${x * x}$. A negative number squared is positive.`,
      solution: [
        { math: md`(${x})^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${x}) ${c ? signed(c) : ""}`, note: "Substitute with parentheses." },
        { math: md`${x * x} ${signed(b * x)} ${c ? signed(c) : ""}`, note: "Exponent first, then multiplication." },
        { math: String(value), note: "Add from left to right." },
      ],
    };
  }
  const a = r.coef(-5, 5);
  const b = r.coef(-5, 5);
  const x = r.nonzero(-4, 4);
  const y = r.nonzero(-4, 4);
  return {
    prompt: md`Evaluate $${poly([[a, "x"], [b, "y"]])}$ when $x = ${x}$ and $y = ${y}$.`,
    answer: String(a * x + b * y),
    hint: "Substitute both values in parentheses, do both multiplications, then add.",
    solution: [
      { math: md`${a}(${x}) ${b < 0 ? "-" : "+"} ${Math.abs(b)}(${y})`, note: "Substitute." },
      { math: md`${a * x} ${signed(b * y)}`, note: "Multiply." },
      { math: String(a * x + b * y), note: "Add." },
    ],
  };
};

const translatePhrase: Generator = (r) => {
  const k = r.int(2, 9);
  const m = r.int(2, 12);
  const phrases: [string, string, string][] = [
    [`the sum of a number $n$ and ${m}`, `n + ${m}`, `"Sum" means add.`],
    [`${m} less than a number $n$`, `n - ${m}`, `Start at $n$ and go down ${m}: "less than" reverses the order you read it in.`],
    [`${m} less than ${k} times a number $n$`, `${k}n - ${m}`, `Start with $${k}n$, then go down ${m}.`],
    [`the difference of ${m} and a number $n$`, `${m} - n`, `"The difference of A and B" is $A - B$, in that order.`],
    [`${k} times the sum of a number $n$ and ${m}`, `${k}(n + ${m})`, `The sum is one quantity, so it needs parentheses before multiplying.`],
    [`the product of ${k} and a number $n$, increased by ${m}`, `${k}n + ${m}`, `Product first ($${k}n$), then increase it.`],
    [`the quotient of a number $n$ and ${k}`, `n/${k}`, `"Quotient" means divide, first quantity on top.`],
    [`${m} more than the quotient of a number $n$ and ${k}`, `n/${k} + ${m}`, `Divide first, then add ${m}.`],
    [`twice a number $n$, decreased by ${m}`, `2n - ${m}`, `"Twice" means times 2.`],
  ];
  const [phrase, answer, why] = r.pick(phrases);
  return {
    prompt: md`Write an expression for: **${phrase}**.`,
    answer,
    hint: why,
    solution: [{ math: answer.replace(/(\w+)\/(\d+)/, "\\frac{$1}{$2}"), note: why }],
  };
};

const orderOfOperations: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [a, b, c, d] = [r.int(2, 20), r.int(2, 9), r.int(2, 9), r.int(1, 15)];
    return {
      prompt: md`Evaluate $${a} + ${b} \cdot ${c} - ${d}$.`,
      answer: String(a + b * c - d),
      hint: "Multiplication comes before addition and subtraction.",
      solution: [
        { math: md`${a} + ${b * c} - ${d}`, note: md`$${b} \cdot ${c}$ is one bundle; compute it first.` },
        { math: String(a + b * c - d), note: "Then add and subtract left to right." },
      ],
    };
  }
  if (kind === 1) {
    const [a, b, c, d] = [r.int(10, 40), r.int(2, 6), r.int(1, 6), r.int(1, 6)];
    return {
      prompt: md`Evaluate $${a} - ${b}(${c} + ${d})$.`,
      answer: String(a - b * (c + d)),
      hint: "Parentheses first, then the multiplication, then the subtraction.",
      solution: [
        { math: md`${a} - ${b}(${c + d})`, note: "Grouping first." },
        { math: md`${a} - ${b * (c + d)}`, note: "Multiply." },
        { math: String(a - b * (c + d)), note: "Subtract." },
      ],
    };
  }
  if (kind === 2) {
    const s = r.int(2, 6);
    const c = r.pick([2, 4].filter((n) => (s * s) % n === 0).concat(s));
    const p = r.int(1, s - 1);
    const d = r.int(1, 10);
    return {
      prompt: md`Evaluate $(${p} + ${s - p})^2 \div ${c} - ${d}$.`,
      answer: String((s * s) / c - d),
      hint: "Grouping, then the exponent, then division, then subtraction.",
      solution: [
        { math: md`${s}^2 \div ${c} - ${d}`, note: "Parentheses first." },
        { math: md`${s * s} \div ${c} - ${d}`, note: "Exponent." },
        { math: md`${(s * s) / c} - ${d}`, note: "Divide." },
        { math: String((s * s) / c - d), note: "Subtract." },
      ],
    };
  }
  if (kind === 3) {
    const [b, c, k] = [r.int(2, 6), r.int(2, 5), r.int(2, 6)];
    const a = b * k;
    return {
      prompt: md`Evaluate $${a} \div ${b} \cdot ${c}$.`,
      answer: String(k * c),
      hint: "Multiplication and division share a level: go left to right.",
      solution: [
        { math: md`${k} \cdot ${c}`, note: md`Left to right: $${a} \div ${b}$ comes first.` },
        { math: String(k * c), note: md`Not $${a} \div ${b * c}$: division is multiplying by $\frac{1}{${b}}$, and products can be done in order.` },
      ],
    };
  }
  const a = r.int(2, 6);
  const b = r.int(1, 20);
  const squareFirst = r.next() < 0.5;
  return squareFirst
    ? {
        prompt: md`Evaluate $-${a}^2 + ${b}$.`,
        answer: String(-a * a + b),
        hint: md`The exponent applies only to the ${a}. The minus is "the opposite of" and waits.`,
        solution: [
          { math: md`-(${a}^2) + ${b}`, note: "The square happens before the negation." },
          { math: md`-${a * a} + ${b}`, note: "" },
          { math: String(-a * a + b), note: "" },
        ],
      }
    : {
        prompt: md`Evaluate $(-${a})^2 - ${b}$.`,
        answer: String(a * a - b),
        hint: md`Here the parentheses make $-${a}$ the thing being squared.`,
        solution: [
          { math: md`${a * a} - ${b}`, note: md`$(-${a})(-${a}) = ${a * a}$: negative times negative is positive.` },
          { math: String(a * a - b), note: "" },
        ],
      };
};

const expandProduct: Generator = (r) => {
  const a = r.coef(-7, 7);
  const b = r.nonzero(-6, 6);
  const c = r.nonzero(-9, 9);
  const negOnly = r.next() < 0.25;
  if (negOnly) {
    return {
      prompt: md`Expand $-(${poly([[b, "x"], [c, ""]])})$.`,
      answer: poly([[-b, "x"], [-c, ""]]),
      expanded: true,
      hint: md`A minus in front of parentheses is $-1$ times everything inside.`,
      solution: [
        { math: md`-1 \cdot (${poly([[b, "x"], [c, ""]])})`, note: "Write the hidden -1." },
        { math: poly([[-b, "x"], [-c, ""]]), note: "Every sign inside flips." },
      ],
    };
  }
  return {
    prompt: md`Expand $${a}(${poly([[b, "x"], [c, ""]])})$.`,
    answer: poly([[a * b, "x"], [a * c, ""]]),
    expanded: true,
    hint: md`Multiply $${a}$ by **each** term inside, sign included.`,
    solution: [
      { math: md`${paren(a)} \cdot ${b === 1 ? "" : b === -1 ? "-" : paren(b)}x + ${paren(a)} \cdot ${paren(c)}`, note: "Distribute to every term." },
      { math: poly([[a * b, "x"], [a * c, ""]]), note: "" },
    ],
  };
};

const distributiveMentalMath: Generator = (r) => {
  const a = r.int(3, 9);
  const near = r.pick([10, 20, 50, 100]);
  const off = r.nonzero(-3, 3);
  const n = near + off;
  return {
    prompt: md`Use the distributive property to compute $${a} \cdot ${n}$ in your head.`,
    answer: String(a * n),
    hint: md`Write ${n} as $${near} ${signed(off)}$.`,
    solution: [
      { math: md`${a}(${near} ${signed(off)})`, note: "Split the awkward number into an easy one." },
      { math: md`${a * near} ${signed(a * off)}`, note: "Distribute." },
      { math: String(a * n), note: "" },
    ],
  };
};

const combineLikeTerms: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const [a, c] = [r.nonzero(-8, 9), r.nonzero(-8, 9)];
    const [b, d] = [r.nonzero(-9, 9), r.nonzero(-9, 9)];
    const ans = poly([[a + c, "x"], [b + d, ""]]);
    return {
      prompt: md`Simplify $${poly([[a, "x"], [b, ""], [c, "x"], [d, ""]])}$.`,
      answer: ans,
      simplified: true,
      hint: "Gather the x-terms and the constants separately. Each sign belongs to the term after it.",
      solution: [
        { math: md`(${poly([[a, "x"], [c, "x"]])}) + (${poly([[b, ""], [d, ""]])})`, note: "Group like terms." },
        { math: ans, note: md`$${a} + ${paren(c)} = ${a + c}$ x's, and $${b} + ${paren(d)} = ${b + d}$.` },
      ],
    };
  }
  if (kind === 1) {
    const [a, b] = [r.coef(2, 6), r.nonzero(-6, 6)];
    const [c, d] = [r.nonzero(-7, 7), r.nonzero(-9, 9)];
    const ans = poly([[a + c, "x"], [a * b + d, ""]]);
    return {
      prompt: md`Simplify $${a}(${poly([[1, "x"], [b, ""]])}) ${c < 0 ? "-" : "+"} ${poly([[Math.abs(c), "x"], [d, ""]])}$.`,
      answer: ans,
      simplified: true,
      expanded: true,
      hint: "Distribute first, then combine like terms.",
      solution: [
        { math: poly([[a, "x"], [a * b, ""], [c, "x"], [d, ""]]), note: "Distribute." },
        { math: ans, note: "Combine like terms." },
      ],
    };
  }
  if (kind === 2) {
    const [a, b, c] = [r.coef(3, 9), r.nonzero(1, 8), r.nonzero(-9, 9)];
    const d = r.nonzero(-9, 9);
    const ans = poly([[a - b, "x"], [-c + d, ""]]);
    return {
      prompt: md`Simplify $${poly([[a, "x"]])} - (${poly([[b, "x"], [c, ""]])}) ${signed(d)}$.`,
      answer: ans,
      simplified: true,
      expanded: true,
      hint: "The minus in front of the parentheses flips every sign inside.",
      solution: [
        { math: poly([[a, "x"], [-b, "x"], [-c, ""], [d, ""]]), note: "Distribute the -1." },
        { math: ans, note: "Combine like terms." },
      ],
    };
  }
  const [a, b, c, d] = [r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-6, 6), r.nonzero(-6, 6)];
  const ans = poly([[a + c, "x^2"], [b + d, "x"]]);
  return {
    prompt: md`Simplify $${poly([[a, "x^2"], [b, "x"], [c, "x^2"], [d, "x"]])}$.`,
    answer: ans,
    simplified: true,
    hint: md`$x^2$ terms and $x$ terms are **not** like terms. Combine each kind separately.`,
    solution: [{ math: ans, note: md`$x^2$: $${a} + ${paren(c)} = ${a + c}$. $x$: $${b} + ${paren(d)} = ${b + d}$.` }],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit1: Unit = {
  title: "The Language of Algebra",
  lessons: [
    {
      id: "variables-and-expressions",
      title: "Variables and expressions",
      summary: "Why letters stand for numbers, and how to read and evaluate expressions.",
      blocks: [
        {
          kind: "text",
          body: md`Arithmetic answers questions about particular numbers: what is $7 \cdot 8$? Algebra answers questions about **every** number at once, or about a number we haven't found yet. To do that we need a name for "some number". That is all a variable is.`,
        },
        {
          kind: "key",
          title: "Variable",
          body: md`A **variable** is a letter that stands for a number. It can stand for one particular number we don't know yet (an *unknown*), or for any number in a range (a *quantity that varies*).`,
        },
        {
          kind: "text",
          body: md`A taxi charges 3 dollars to start plus 2 dollars per mile. For 1 mile you pay $3 + 2 \cdot 1$. For 5 miles, $3 + 2 \cdot 5$. For 12 miles, $3 + 2 \cdot 12$. The pattern never changes; only the number of miles does. Name the miles $m$ and you can write the whole pattern once:

$$3 + 2m$$

That one line contains infinitely many arithmetic problems, one for every possible trip.`,
        },
        {
          kind: "key",
          title: "Expression",
          body: md`An **expression** combines numbers, variables and operations, like $3 + 2m$ or $\frac{x}{4} - 1$. An expression has a *value*, but it doesn't claim anything. An **equation** joins two expressions with $=$ and makes a claim that can be true or false. Equations come in Unit 2.`,
        },
        {
          kind: "text",
          body: md`Conventions you'll see everywhere:

- $2m$ means $2 \cdot m$. The $\times$ sign is dropped because it looks too much like $x$.
- $\frac{x}{4}$ means $x \div 4$.
- $x^2$ means $x \cdot x$.
- In $2m$, the number $2$ is the **coefficient** of $m$. In $x$ the coefficient is $1$; in $-x$ it is $-1$.`,
        },
        {
          kind: "why",
          title: "Why can we drop the multiplication sign?",
          body: md`Because a variable is a single letter, $2m$ can only mean "2 times $m$". That's also why we never drop the sign between two numbers: $23$ already means twenty-three, so $2 \cdot 3$ has to be written out.`,
        },
        {
          kind: "text",
          body: md`**Evaluating** an expression means substituting a number for each variable and doing the arithmetic. Always put the substituted number in parentheses. It costs nothing, and with negative numbers it prevents real mistakes.`,
        },
        {
          kind: "example",
          title: "Evaluating with a negative",
          problem: md`Evaluate $x^2 - 3x$ when $x = -2$.`,
          steps: [
            { math: md`(-2)^2 - 3(-2)`, note: "Substitute, in parentheses." },
            { math: md`4 - (-6)`, note: md`$(-2)^2 = (-2)(-2) = 4$ and $3(-2) = -6$.` },
            { math: md`4 + 6 = 10`, note: "Subtracting a negative is adding its opposite." },
          ],
        },
        {
          kind: "text",
          body: md`**Translating words into algebra.** *Sum, more than, increased by* mean $+$. *Difference, less than, decreased by* mean $-$. *Product, times, twice* mean $\cdot$. *Quotient, per, divided by* mean $\div$.`,
        },
        {
          kind: "why",
          title: `Why is "5 less than n" written n − 5?`,
          body: md`Test it with a real number. Five less than 12 is 7, and $7 = 12 - 5$. You start at $n$ and go down 5, so it is $n - 5$, even though the 5 is said first. When a phrase confuses you, try a concrete number.`,
        },
        {
          kind: "check",
          prompt: md`Write an expression for "three more than twice a number $n$".`,
          answer: "2n + 3",
          explain: md`"Twice a number" is $2n$; three more than that is $2n + 3$.`,
        },
      ],
      practice: [evaluateExpression, translatePhrase],
    },
    {
      id: "order-of-operations",
      title: "Order of operations, and why",
      summary: "Where the order comes from, and the traps it sets.",
      blocks: [
        {
          kind: "text",
          body: md`What is $2 + 3 \cdot 4$? Going left to right gives $20$. Multiplying first gives $14$. Both are reasonable ways to read it, so mathematicians had to agree on one. The agreed answer is $14$, and the choice isn't arbitrary.`,
        },
        {
          kind: "why",
          title: "Why multiply before adding?",
          body: md`Multiplication is shorthand for repeated addition: $3 \cdot 4$ *is* $4 + 4 + 4$. So $2 + 3 \cdot 4$ really says $2 + 4 + 4 + 4 = 14$. A product is one bundle of additions, and you work out a bundle before combining it with anything else.

The same logic applies one level up. Exponents are repeated multiplication, $4^3 = 4 \cdot 4 \cdot 4$, so they bundle even tighter than products.`,
        },
        {
          kind: "key",
          title: "The order",
          body: md`- **Grouping** first: parentheses, fraction bars, roots, absolute-value bars.
- **Exponents.**
- **Multiplication and division**, left to right.
- **Addition and subtraction**, left to right.`,
        },
        {
          kind: "why",
          title: "Why do multiplication and division share a level?",
          body: md`Division *is* multiplication by a reciprocal: $12 \div 3 = 12 \cdot \frac{1}{3}$. Subtraction *is* addition of the opposite: $10 - 4 = 10 + (-4)$. So each level really has only one operation, and you work through it left to right:

$$12 \div 3 \cdot 2 = 12 \cdot \tfrac{1}{3} \cdot 2 = 8, \quad\text{not}\quad 12 \div 6 = 2.$$`,
        },
        {
          kind: "text",
          body: md`The convention pays off in algebra. Because products bundle, $3x^2 + 2x + 1$ needs no parentheses at all, and everyone reads it the same way: square $x$, multiply by 3, then add the rest.`,
        },
        {
          kind: "example",
          title: "All the levels at once",
          problem: md`Evaluate $20 - 2 \cdot (3 + 1)^2 \div 8$.`,
          steps: [
            { math: md`20 - 2 \cdot 4^2 \div 8`, note: "Grouping first." },
            { math: md`20 - 2 \cdot 16 \div 8`, note: "Exponent." },
            { math: md`20 - 32 \div 8 = 20 - 4`, note: "Multiply and divide, left to right." },
            { math: md`16`, note: "Subtract last." },
          ],
        },
        {
          kind: "key",
          title: "The negative-square trap",
          body: md`$-3^2 = -9$, not $9$. The exponent applies only to the $3$: $-3^2 = -(3^2)$. To square negative three, write $(-3)^2 = 9$.

This is why substitution uses parentheses. If $x = -3$, then $x^2 = (-3)^2 = 9$, but $-x^2 = -(-3)^2 = -9$.`,
        },
        {
          kind: "why",
          title: "Why does the minus sign wait?",
          body: md`A leading minus means "the opposite of", which is the same as multiplying by $-1$: $-3^2 = -1 \cdot 3^2$. Exponents come before multiplication, so $3^2$ happens first.`,
        },
        {
          kind: "text",
          body: md`A fraction bar is a grouping symbol: $\frac{6 + 4}{2}$ means the whole top divided by the whole bottom, which is $5$. When you type it on one line, you need the parentheses: **(6+4)/2**.`,
        },
        {
          kind: "check",
          prompt: md`Evaluate $18 \div 3 \cdot 2 - 4^2$.`,
          answer: "-4",
          explain: md`Exponent: $4^2 = 16$. Left to right: $18 \div 3 = 6$, then $6 \cdot 2 = 12$. Finally $12 - 16 = -4$.`,
        },
      ],
      practice: [orderOfOperations],
    },
    {
      id: "properties-of-numbers",
      title: "The properties that make algebra work",
      summary: "Commutative, associative, identity, inverse, and above all distributive.",
      blocks: [
        {
          kind: "text",
          body: md`Every algebra move you'll ever make (simplifying, factoring, solving) is one of a handful of properties applied over and over. They are facts about how numbers behave. Learn them by name, because the answer to "why is this step allowed?" is always one of them.`,
        },
        {
          kind: "key",
          title: "For all numbers a, b, c",
          body: md`- **Commutative:** $a + b = b + a$ and $ab = ba$. Order doesn't matter.
- **Associative:** $(a + b) + c = a + (b + c)$ and $(ab)c = a(bc)$. Grouping doesn't matter.
- **Identity:** $a + 0 = a$ and $a \cdot 1 = a$.
- **Inverse:** $a + (-a) = 0$, and $a \cdot \frac{1}{a} = 1$ when $a \ne 0$.
- **Distributive:** $a(b + c) = ab + ac$.`,
        },
        {
          kind: "why",
          title: "Why is multiplication commutative?",
          body: md`Picture 3 rows of 5 dots. Counting by rows gives $3 \cdot 5$. Turn your head sideways and you see 5 rows of 3, which is $5 \cdot 3$. They are the same dots, so $3 \cdot 5 = 5 \cdot 3$. The arrangement is the proof, and it works for any whole numbers.`,
        },
        {
          kind: "text",
          body: md`Subtraction and division are **not** commutative: $5 - 2 \ne 2 - 5$. But subtraction is addition of the opposite, $5 - 2 = 5 + (-2)$, and addition *is* commutative, so $5 + (-2) = -2 + 5$. Rewriting subtraction as addition lets you rearrange terms freely, as long as each sign stays attached to the number after it.`,
        },
        {
          kind: "text",
          body: md`The **distributive property** matters most, because it is the only one that connects addition and multiplication. Drag the sliders to see why it's true:`,
        },
        { kind: "widget", widget: "area-model" },
        {
          kind: "why",
          title: "Why a(b + c) = ab + ac",
          body: md`A rectangle $a$ tall and $b + c$ wide has area $a(b + c)$. Cut it into two rectangles: one has area $ab$ and the other $ac$. Cutting doesn't change the total, so $a(b + c) = ab + ac$.`,
        },
        {
          kind: "example",
          title: "Distributing a negative",
          problem: md`Expand $-3(2x - 5)$.`,
          steps: [
            { math: md`-3(2x + (-5))`, note: "Subtraction is adding the opposite." },
            { math: md`(-3)(2x) + (-3)(-5)`, note: "Multiply -3 by every term." },
            { math: md`-6x + 15`, note: "Negative times negative is positive." },
          ],
        },
        {
          kind: "text",
          body: md`A minus sign in front of parentheses is a hidden $-1$: $-(x - 4) = -1 \cdot (x - 4) = -x + 4$. Every sign inside flips.

The distributive property also runs backwards. Pulling out a common factor, as in $6x + 9 = 3(2x + 3)$, is called **factoring**, and you'll use it constantly.`,
        },
        {
          kind: "check",
          prompt: md`Expand $4(3x + 2)$.`,
          answer: "12x + 8",
          expanded: true,
          explain: md`$4 \cdot 3x = 12x$ and $4 \cdot 2 = 8$.`,
        },
      ],
      practice: [expandProduct, distributiveMentalMath],
    },
    {
      id: "combining-like-terms",
      title: "Combining like terms",
      summary: "Simplifying expressions, justified by the distributive property.",
      blocks: [
        {
          kind: "text",
          body: md`What is $3x + 5x$? Read it aloud: three $x$'s plus five $x$'s. That's eight $x$'s, or $8x$, the same way 3 apples plus 5 apples is 8 apples.`,
        },
        {
          kind: "why",
          title: "The real reason",
          body: md`It's the distributive property run backwards: $3x + 5x = (3 + 5)x = 8x$. That is the whole justification, and it tells you exactly when combining is allowed.`,
        },
        {
          kind: "key",
          title: "Like terms",
          body: md`**Like terms** have exactly the same variable part: the same letters raised to the same powers. $4x$ and $-7x$ are like terms. $2x$ and $2x^2$ are not. $3xy$ and $-yx$ are, because $xy = yx$.

To combine like terms, add their coefficients and keep the variable part unchanged.`,
        },
        {
          kind: "why",
          title: "Why can't 2x + 3x² be combined?",
          body: md`The distributive property needs one common factor multiplied by a single number. The most you can pull out is $x$: $2x + 3x^2 = x(2 + 3x)$, and what's left inside isn't a single number. Check with $x = 2$: $2 \cdot 2 + 3 \cdot 4 = 16$, while a "combined" $5x^3$ would give $40$.`,
        },
        {
          kind: "example",
          title: "Distribute, then combine",
          problem: md`Simplify $4x - 3 + 2(x - 5) - x$.`,
          steps: [
            { math: md`4x - 3 + 2x - 10 - x`, note: "Distribute the 2." },
            { math: md`(4x + 2x - x) + (-3 - 10)`, note: "Group like terms, each keeping its own sign." },
            { math: md`5x - 13`, note: "Add coefficients." },
          ],
        },
        {
          kind: "text",
          body: md`**Check your own work.** Substitute any number into the original and into your simplified version. If the two values disagree, something went wrong. With $x = 1$ above: $4 - 3 + 2(-4) - 1 = -8$ and $5 - 13 = -8$. They agree.

PolyMath checks your answers the same way, by trying many values. That's why any correct form is accepted, but you'll be told when an answer can still be simplified.`,
        },
        {
          kind: "check",
          prompt: md`Simplify $7a + 3 - 2a + 4$.`,
          answer: "5a + 7",
          simplified: true,
          explain: md`$7a - 2a = 5a$ and $3 + 4 = 7$.`,
        },
      ],
      practice: [combineLikeTerms],
    },
  ],
};
