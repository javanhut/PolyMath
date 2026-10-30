import { frac, gcd } from "../../math/random";
import { md, type DiagramSpec, type Generator, type Step, type Unit } from "../types";

// ── Helpers ─────────────────────────────────────────────────────────────────

type Pt = NonNullable<DiagramSpec["points"]>[number];
type Poly = NonNullable<DiagramSpec["polygons"]>[number];

/** The answer-format line for pi answers. The example never equals the key `ans`. */
const piForm = (ans: string) => md`Give an exact answer in terms of $\pi$, like ${ans === "12pi" ? "10pi" : "12pi"}.`;
const piFracForm = (ans: string) =>
  ans === "12pi" || ans === "25pi/6" ? md`Give an exact answer in terms of $\pi$, like 10pi or 7pi/6.` : md`Give an exact answer in terms of $\pi$, like 12pi or 25pi/6.`;
const NO_UNITS = "Give a number without units.";

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** A construction point: no dot, no label. */
const hp = (name: string, x: number | string, y: number | string): Pt => ({ name, x, y, label: "", hidden: true });

/** Hidden points along a circular arc (angles in degrees, both ends included). */
function arc(prefix: string, cx: number, cy: number, rad: number, from: number, to: number, steps: number): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return hp(`${prefix}${i}`, round4(cx + rad * Math.cos(t)), round4(cy + rad * Math.sin(t)));
  });
}

/** Hidden points around an ellipse, for drawing the rim of a cone or cylinder. */
function ellipse(prefix: string, cx: number, cy: number, rx: number, ry: number, steps: number): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (2 * Math.PI * i) / steps;
    return hp(`${prefix}${i}`, round4(cx + rx * Math.cos(t)), round4(cy + ry * Math.sin(t)));
  });
}

/** A rectangle as four hidden corners and a polygon. */
function rect(prefix: string, x0: number, y0: number, x1: number, y1: number, fill?: 1 | 2 | 3 | 4): { pts: Pt[]; poly: Poly } {
  const pts = [hp(`${prefix}a`, x0, y0), hp(`${prefix}b`, x1, y0), hp(`${prefix}c`, x1, y1), hp(`${prefix}d`, x0, y1)];
  return { pts, poly: { points: pts.map((p) => p.name), fill } };
}

const piText = (k: number) => (k === 1 ? "pi" : `${k}pi`);
const piTex = (k: number) => (k === 1 ? md`\pi` : md`${k}\pi`);

/** (n/d)pi, reduced, as answer text and LaTeX. */
function piFrac(n: number, d: number): { text: string; tex: string } {
  const g = gcd(n, d);
  n /= g;
  d /= g;
  if (d === 1) return { text: piText(n), tex: piTex(n) };
  const top = n === 1 ? "" : String(n);
  return { text: `${top}pi/${d}`, tex: md`\frac{${top}\pi}{${d}}` };
}

/** A number written for LaTeX, with up to two decimals. */
const dec = (v: number) => String(Math.round(v * 100) / 100);

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
];

// ── Diagrams ────────────────────────────────────────────────────────────────

/** A 5 by 3 rectangle with its unit squares marked. */
function unitSquares(): DiagramSpec {
  const r = rect("R", 0, 0, 5, 3, 1);
  const pts: Pt[] = [...r.pts];
  const segs: NonNullable<DiagramSpec["segments"]> = [];
  for (let x = 1; x < 5; x++) {
    pts.push(hp(`vx${x}`, x, 0), hp(`vy${x}`, x, 3));
    segs.push({ from: `vx${x}`, to: `vy${x}`, dashed: true });
  }
  for (let y = 1; y < 3; y++) {
    pts.push(hp(`hx${y}`, 0, y), hp(`hy${y}`, 5, y));
    segs.push({ from: `hx${y}`, to: `hy${y}`, dashed: true });
  }
  segs.push({ from: "Ra", to: "Rb", label: "5" }, { from: "Rb", to: "Rc", label: "3" });
  return {
    view: [-0.8, 5.8, -0.8, 3.6],
    points: pts,
    polygons: [r.poly],
    segments: segs,
    caption: md`3 rows of 5 unit squares: area $5 \cdot 3 = 15$.`,
  };
}

/** Parallelogram ABCD with the triangle AED sliding over to BFC. */
function cutAndSlide(): DiagramSpec {
  return {
    view: [-0.8, 9, -0.9, 3.8],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 6, y: 0, dir: "s" },
      { name: "C", x: 8, y: 3, dir: "ne" },
      { name: "D", x: 2, y: 3, dir: "nw" },
      { name: "E", x: 2, y: 0, dir: "s" },
      { name: "F", x: 8, y: 0, dir: "se" },
      hp("T1", "6s", 0),
      hp("T2", "2 + 6s", 0),
      hp("T3", "2 + 6s", 3),
    ],
    polygons: [
      { points: ["E", "B", "C", "D"], fill: 1 },
      { points: ["A", "E", "D"], dashed: true },
      { points: ["B", "F", "C"], dashed: true },
      { points: ["T1", "T2", "T3"], fill: 2 },
    ],
    segments: [{ from: "D", to: "E", dashed: true, label: "h" }],
    angles: [
      { at: "E", from: "B", to: "D", right: true },
      { at: "F", from: "B", to: "C", right: true },
    ],
    labels: [{ x: 3, y: -0.55, text: "b = AB = 6" }],
    params: [{ name: "s", label: "slide", min: 0, max: 1, step: 0.05, value: 0 }],
    caption: md`Slide the orange triangle from the left end to the right end. It is the same triangle, only moved, and at the end it fits exactly against the blue piece with no overlap. So the area is unchanged, and the parallelogram has become a rectangle with base $b = 6$ and height $h = 3$.`,
  };
}

/** Triangle ABC and a rotated copy BDC forming parallelogram ABDC. */
function doubledTriangle(): DiagramSpec {
  return {
    view: [-0.8, 9, -0.9, 4.8],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 6, y: 0, dir: "se" },
      { name: "C", x: 2, y: 4, dir: "nw" },
      { name: "D", x: 8, y: 4, dir: "ne" },
      { name: "H", x: 2, y: 0, dir: "s" },
    ],
    polygons: [
      { points: ["A", "B", "C"], fill: 1 },
      { points: ["B", "D", "C"], fill: 2 },
    ],
    segments: [
      { from: "C", to: "H", dashed: true, label: "h" },
    ],
    angles: [{ at: "H", from: "B", to: "C", right: true }],
    labels: [{ x: 4, y: -0.55, text: "b" }],
    caption: md`A copy of $\triangle ABC$, turned halfway around the midpoint of $\overline{BC}$, fills out parallelogram $ABDC$.`,
  };
}

/** Trapezoid ABCD and a rotated copy forming a parallelogram with base b1 + b2. */
function doubledTrapezoid(): DiagramSpec {
  return {
    view: [-0.8, 9.8, -0.9, 3.9],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 5, y: 0, dir: "s" },
      { name: "C", x: 4, y: 3, dir: "n" },
      { name: "D", x: 1, y: 3, dir: "nw" },
      hp("P", 8, 0),
      hp("Q", 9, 3),
    ],
    polygons: [
      { points: ["A", "B", "C", "D"], fill: 1 },
      { points: ["Q", "C", "B", "P"], fill: 2 },
    ],
    segments: [
      { from: "A", to: "B", label: "b_1" },
      { from: "D", to: "C", label: "b_2" },
      { from: "B", to: "P", label: "b_2" },
      { from: "C", to: "Q", label: "b_1" },
    ],
    caption: md`Two copies of the trapezoid make a parallelogram with base $b_1 + b_2$ and the same height.`,
  };
}

/** Regular hexagon with side 4, its center and one apothem. */
function hexagonApothem(): DiagramSpec {
  const verts = Array.from({ length: 6 }, (_, k) => hp(`V${k}`, round4(4 * Math.cos((k * Math.PI) / 3)), round4(4 * Math.sin((k * Math.PI) / 3))));
  return {
    view: [-4.8, 4.8, -4.3, 4.3],
    points: [...verts, { name: "O", x: 0, y: 0, dir: "w" }, { name: "M", x: 3, y: round4(Math.sqrt(3)), dir: "ne" }],
    polygons: [{ points: verts.map((v) => v.name) }, { points: ["O", "V0", "V1"], fill: 1 }],
    segments: [
      ...verts.slice(2).map((v) => ({ from: "O", to: v.name, dashed: true })),
      { from: "O", to: "M", color: 2 as const, label: "a" },
      { from: "V0", to: "V1", label: "s" },
    ],
    angles: [{ at: "M", from: "O", to: "V1", right: true }],
    caption: md`Segments from the center cut a regular hexagon into 6 congruent triangles. Each has base $s$ and height $a$, the **apothem**.`,
  };
}

/** A circle with an inscribed regular n-gon, n set by a slider. */
function inscribedPolygon(): DiagramSpec {
  const MAX = 48;
  // Vertex k sits at angle 2 pi min(k, n) / n, so vertices past n pile up at the start.
  const pts = Array.from({ length: MAX + 1 }, (_, k) => hp(`P${k}`, `3cos(pi(${k} + n - abs(${k} - n))/n)`, `3sin(pi(${k} + n - abs(${k} - n))/n)`));
  return {
    view: [-3.6, 3.6, -3.6, 3.6],
    points: [...pts, { name: "O", x: 0, y: 0, label: "" }],
    circles: [{ center: "O", radius: 3, dashed: true }],
    segments: Array.from({ length: MAX }, (_, k) => ({ from: `P${k}`, to: `P${k + 1}`, color: 1 as const })),
    params: [{ name: "n", tex: md`\text{number of sides } n`, min: 3, max: 48, step: 1, value: 6 }],
    readouts: [{ label: md`\frac{\text{perimeter}}{\text{diameter}}`, value: "n sin(pi/n)" }],
    caption: md`A regular $n$-gon inside a circle. As $n$ grows, the perimeter hugs the circle, and perimeter divided by diameter creeps up toward $\pi \approx 3.14159$.`,
  };
}

/** A circle cut into n equal sectors, top half blue and bottom half orange. */
function slicedCircle(n: number, rad: number): DiagramSpec {
  const pts: Pt[] = [hp("O", 0, 0)];
  const polygons: Poly[] = [];
  const step = 360 / n;
  for (let j = 0; j < n; j++) {
    const a = arc(`c${j}_`, 0, 0, rad, j * step, (j + 1) * step, 4);
    pts.push(...a);
    polygons.push({ points: ["O", ...a.map((p) => p.name)], fill: j < n / 2 ? 1 : 2 });
  }
  return {
    view: [-rad - 0.6, rad + 0.6, -rad - 0.6, rad + 0.6],
    points: pts,
    polygons,
    caption: md`A circle of radius $r$ cut into ${n} equal sectors. The blue half's arcs make up half the circumference, $\pi r$; so do the orange half's.`,
  };
}

/** The same n sectors laid side by side, alternating up and down. */
function unrolledCircle(n: number, rad: number, caption: string): DiagramSpec {
  const half = Math.PI / n;
  const halfDeg = 180 / n;
  const s = rad * Math.sin(half);
  const c = rad * Math.cos(half);
  const m = n > 12 ? 3 : 6;
  const pts: Pt[] = [];
  const polygons: Poly[] = [];
  for (let k = 0; k < n / 2; k++) {
    // From the top half: apex at the bottom, arc on top.
    const down = hp(`D${k}`, round4((2 * k + 1) * s), 0);
    const da = arc(`d${k}_`, (2 * k + 1) * s, 0, rad, 90 + halfDeg, 90 - halfDeg, m);
    // From the bottom half: apex at the top, arc underneath.
    const up = hp(`U${k}`, round4(2 * k * s), round4(c));
    const ua = arc(`u${k}_`, 2 * k * s, c, rad, 270 - halfDeg, 270 + halfDeg, m);
    pts.push(down, ...da, up, ...ua);
    polygons.push({ points: [down.name, ...da.map((p) => p.name)], fill: 1 }, { points: [up.name, ...ua.map((p) => p.name)], fill: 2 });
  }
  const w = n * s;
  return {
    view: [-s - 1, w + 0.6, c - rad - 0.9, rad + 0.9],
    points: pts,
    polygons,
    labels: [
      { x: round4(w / 2), y: round4(rad + 0.55), text: md`\pi r` },
      { x: round4(w / 2 - s), y: round4(c - rad - 0.55), text: md`\pi r` },
      { x: round4(-s / 2 - 0.55), y: round4(c / 2), text: "r" },
    ],
    caption,
  };
}

/** A sector with a 120 degree angle in a circle of radius 3. */
function sectorFigure(): DiagramSpec {
  const a = arc("s", 0, 0, 3, 0, 120, 24);
  return {
    view: [-3.6, 3.6, -3.6, 3.6],
    points: [{ name: "O", x: 0, y: 0, dir: "s" }, ...a, { name: "P", x: 3, y: 0, dir: "e" }, { name: "Q", x: round4(3 * Math.cos((2 * Math.PI) / 3)), y: round4(3 * Math.sin((2 * Math.PI) / 3)), dir: "nw" }],
    circles: [{ center: "O", radius: 3 }],
    polygons: [{ points: ["O", ...a.map((p) => p.name)], fill: 1 }],
    segments: [{ from: "O", to: "P", label: "r" }],
    angles: [{ at: "O", from: "P", to: "Q", label: md`120^\circ` }],
    caption: md`A $120^\circ$ sector is $\frac{120}{360} = \frac{1}{3}$ of the circle, so its area is $\frac{1}{3}\pi r^2$.`,
  };
}

/** The net of a 4 by 2 by 3 box, laid out as a cross. */
function boxNet(): DiagramSpec {
  const faces = [
    rect("bot", 0, 0, 4, 2, 1),
    rect("fr", 0, -3, 4, 0, 2),
    rect("bk", 0, 2, 4, 5, 2),
    rect("top", 0, 5, 4, 7, 1),
    rect("lf", -3, 0, 0, 2, 3),
    rect("rt", 4, 0, 7, 2, 3),
  ];
  return {
    view: [-3.6, 7.6, -3.7, 7.6],
    points: faces.flatMap((f) => f.pts),
    polygons: faces.map((f) => f.poly),
    segments: [
      { from: "fra", to: "frb", label: "l = 4" },
      { from: "frb", to: "frc", label: "h = 3" },
      { from: "rtb", to: "rtc", label: "w = 2" },
    ],
    caption: md`The net of a box: two $l \times w$ faces (blue), two $l \times h$ faces (orange), two $w \times h$ faces (green). Fold up the edges and it closes into the box.`,
  };
}

/** The net of a cylinder: a rectangle and two circles. */
function cylinderNet(): DiagramSpec {
  const W = round4(2 * Math.PI);
  const body = rect("R", 0, 0, W, 3, 2);
  return {
    view: [-0.6, W + 0.9, -2.5, 5.5],
    points: [...body.pts, hp("T", 1.5, 4), hp("Tr", 2.5, 4), hp("Bo", 1.5, -1)],
    polygons: [body.poly],
    circles: [
      { center: "T", radius: 1, fill: 1 },
      { center: "Bo", radius: 1, fill: 1 },
    ],
    segments: [
      { from: "Ra", to: "Rb", label: md`2\pi r` },
      { from: "Rb", to: "Rc", label: "h" },
      { from: "T", to: "Tr", label: "r" },
    ],
    caption: md`Unroll the curved side of a cylinder and you get a rectangle. Its width is the distance once around the circle, $2\pi r$.`,
  };
}

/** The net of a square pyramid: a square and four isosceles triangles. */
function pyramidNet(): DiagramSpec {
  return {
    view: [-5.5, 5.5, -5.5, 5.5],
    points: [
      hp("S1", -2, -2),
      hp("S2", 2, -2),
      hp("S3", 2, 2),
      hp("S4", -2, 2),
      hp("N", 0, 5),
      hp("So", 0, -5),
      hp("W", -5, 0),
      hp("E", 5, 0),
      hp("M", 0, 2),
    ],
    polygons: [
      { points: ["S1", "S2", "S3", "S4"], fill: 1 },
      { points: ["S4", "S3", "N"], fill: 2 },
      { points: ["S1", "S2", "So"], fill: 2 },
      { points: ["S1", "S4", "W"], fill: 2 },
      { points: ["S2", "S3", "E"], fill: 2 },
    ],
    segments: [
      { from: "M", to: "N", dashed: true, label: md`\ell` },
      { from: "S1", to: "S2", label: "s" },
    ],
    angles: [{ at: "M", from: "S3", to: "N", right: true }],
    caption: md`The net of a square pyramid. Each triangle has base $s$ and height $\ell$, the **slant height**.`,
  };
}

/** A right cone seen from the side, with its height, radius and slant height. */
function coneSide(): DiagramSpec {
  const rim = ellipse("e", 0, 0, 3, 0.7, 32);
  return {
    view: [-3.7, 3.7, -1.1, 4.6],
    points: [...rim, { name: "V", x: 0, y: 4, dir: "n" }, { name: "O", x: 0, y: 0, dir: "sw" }, hp("L", -3, 0), hp("R", 3, 0)],
    polygons: [{ points: rim.map((p) => p.name) }],
    segments: [
      { from: "V", to: "L" },
      { from: "V", to: "R", label: md`\ell` },
      { from: "V", to: "O", dashed: true, label: "h" },
      { from: "O", to: "R", dashed: true, label: "r" },
    ],
    angles: [{ at: "O", from: "R", to: "V", right: true }],
    caption: md`The height, the radius and the slant height form a right triangle, so $\ell^2 = r^2 + h^2$. (A square pyramid has the same picture, with half the base edge in place of $r$.)`,
  };
}

/** The lateral surface of a cone with r = 3, slant height 5, flattened into a 216 degree sector. */
function coneNet(): DiagramSpec {
  const a = arc("k", 0, 0, 5, -18, 198, 36);
  return {
    view: [-5.6, 5.6, -2.2, 11.6],
    points: [{ name: "V", x: 0, y: 0, dir: "s" }, ...a, hp("C", 0, 8), hp("Cr", 3, 8)],
    polygons: [{ points: ["V", ...a.map((p) => p.name)], fill: 2 }],
    circles: [{ center: "C", radius: 3, fill: 1 }],
    segments: [
      { from: "V", to: "k0", label: md`\ell` },
      { from: "C", to: "Cr", label: "r" },
    ],
    labels: [{ x: -4.9, y: 3.6, text: md`2\pi r` }],
    caption: md`Slit a cone up one side and flatten it: the curved part becomes a sector of a circle of radius $\ell$, and its arc is the rim of the base, length $2\pi r$. Here $r = 3$ and $\ell = 5$.`,
  };
}

/** A sphere in the cylinder that just contains it. */
function sphereInCylinder(): DiagramSpec {
  const top = ellipse("t", 0, 2, 2, 0.45, 32);
  const bot = ellipse("b", 0, -2, 2, 0.45, 32);
  return {
    view: [-3, 3, -2.8, 2.8],
    points: [...top, ...bot, { name: "O", x: 0, y: 0, dir: "s" }, hp("Q", 2, 0), hp("A", -2, 2), hp("B", -2, -2), hp("C", 2, -2), hp("D", 2, 2)],
    polygons: [{ points: top.map((p) => p.name) }, { points: bot.map((p) => p.name) }],
    circles: [{ center: "O", radius: 2, fill: 1 }],
    segments: [
      { from: "A", to: "B" },
      { from: "D", to: "C", label: "2r" },
      { from: "O", to: "Q", dashed: true, label: "r" },
    ],
    caption: md`Archimedes compared a sphere with the cylinder around it: radius $r$, height $2r$. The curved side of that cylinder has area $2\pi r \cdot 2r = 4\pi r^2$, the same as the sphere.`,
  };
}

/** Two stacks of 8 identical coins, one straight and one pushed sideways. */
function coinStacks(): DiagramSpec {
  const pts: Pt[] = [];
  const polygons: Poly[] = [];
  for (let i = 0; i < 8; i++) {
    const y0 = i / 2;
    const y1 = (i + 1) / 2;
    const l = rect(`L${i}`, 0, y0, 3, y1, 1);
    pts.push(...l.pts);
    polygons.push(l.poly);
    const names = [`R${i}a`, `R${i}b`, `R${i}c`, `R${i}d`];
    pts.push(hp(names[0]!, `6 + ${i}k`, y0), hp(names[1]!, `9 + ${i}k`, y0), hp(names[2]!, `9 + ${i}k`, y1), hp(names[3]!, `6 + ${i}k`, y1));
    polygons.push({ points: names, fill: 2 });
  }
  pts.push(hp("X1", -0.4, "c"), hp("X2", 12.4, "c"));
  return {
    view: [-0.6, 12.6, -0.5, 4.5],
    points: pts,
    polygons,
    segments: [{ from: "X1", to: "X2", dashed: true, color: 4 }],
    params: [
      { name: "k", label: "push", min: -0.4, max: 0.4, step: 0.05, value: 0.3 },
      { name: "c", label: "cut height", min: 0.1, max: 3.9, step: 0.1, value: 1.7 },
    ],
    caption: md`Push the right-hand stack sideways. It leans, but it is the same 8 coins, so its volume can't change. The red cut meets both stacks in a coin-shaped slice of the same area at every height.`,
  };
}

/** A triangular prism cut into three pyramids, in an oblique drawing. */
function prismIntoPyramids(): DiagramSpec {
  return {
    view: [-0.8, 4.8, -0.7, 5.1],
    points: [
      { name: "A", x: 0, y: 0, dir: "sw" },
      { name: "B", x: 4, y: 0, dir: "se" },
      { name: "C", x: 1.6, y: 1.3, dir: "e" },
      { name: "D", x: 0, y: 3.2, dir: "w" },
      { name: "E", x: 4, y: 3.2, dir: "e" },
      { name: "F", x: 1.6, y: 4.5, dir: "n" },
    ],
    segments: [
      { from: "A", to: "B" },
      { from: "A", to: "D" },
      { from: "B", to: "E" },
      { from: "D", to: "E" },
      { from: "E", to: "F" },
      { from: "D", to: "F" },
      { from: "A", to: "C", dashed: true },
      { from: "B", to: "C", dashed: true },
      { from: "C", to: "F", dashed: true },
      { from: "B", to: "D", color: 2 },
      { from: "B", to: "F", color: 2, dashed: true },
      { from: "C", to: "D", color: 2, dashed: true },
    ],
    caption: md`Triangular prism $ABC$-$DEF$ ($D$ above $A$, $E$ above $B$, $F$ above $C$). The orange cuts split it into three pyramids: $ABCD$, $BCDF$ and $BDEF$. Dashed lines are hidden behind the front.`,
  };
}

/** A hemisphere beside a cylinder with a cone hollowed out, cut at the same height. */
function hemisphereVsCylinder(): DiagramSpec {
  const a = arc("h", -4, 0, 3, 0, 180, 36);
  return {
    view: [-7.6, 7.6, -0.7, 3.9],
    points: [
      ...a,
      { name: "O", x: -4, y: 0, dir: "s" },
      { name: "P", x: 4, y: 0, dir: "s" },
      hp("Q1", 1, 0),
      hp("Q2", 7, 0),
      hp("Q3", 7, 3),
      hp("Q4", 1, 3),
      hp("H1", "-4 - sqrt(9 - y^2)", "y"),
      hp("H2", "-4 + sqrt(9 - y^2)", "y"),
      hp("K1", 1, "y"),
      hp("K2", "4 - y", "y"),
      hp("K3", "4 + y", "y"),
      hp("K4", 7, "y"),
    ],
    polygons: [
      { points: a.map((p) => p.name), fill: 1 },
      { points: ["Q1", "P", "Q4"], fill: 1 },
      { points: ["P", "Q2", "Q3"], fill: 1 },
    ],
    segments: [
      { from: "Q4", to: "Q3" },
      { from: "H1", to: "H2", color: 4 },
      { from: "K1", to: "K2", color: 4 },
      { from: "K3", to: "K4", color: 4 },
      { from: "K2", to: "K3", dashed: true },
      { from: "O", to: "h0", label: "r" },
    ],
    params: [{ name: "y", tex: md`\text{height of the cut, } y`, min: 0, max: 3, step: 0.1, value: 1.5 }],
    readouts: [
      { label: md`\text{hemisphere slice}`, value: "pi(9 - y^2)" },
      { label: md`\text{cylinder-minus-cone slice}`, value: "9pi - pi y^2" },
    ],
    caption: md`Side views, with $r = 3$. Left: a hemisphere. Right: a cylinder of radius $r$ and height $r$ with a cone (point down) scooped out. A cut at height $y$ gives a disk on the left and a ring on the right. Move the slider: the two areas always match.`,
  };
}

// ── Practice figures ────────────────────────────────────────────────────────
// Each one is built from the problem's own numbers, so it is drawn to scale.
// Solids use an oblique drawing: back edges run up and to the right at half length.

type Seg = NonNullable<DiagramSpec["segments"]>[number];
type DiagramFigure = { kind: "diagram" } & DiagramSpec;

/** A construction point at rounded coordinates. */
const cp = (name: string, x: number, y: number): Pt => hp(name, round4(x), round4(y));

/** A view around the given points, padded by a share of the larger span. */
function fit(pts: Pt[], pad = 0.12): DiagramSpec["view"] {
  const xs = pts.map((p) => Number(p.x));
  const ys = pts.map((p) => Number(p.y));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const p = pad * Math.max(x1 - x0, y1 - y0, 1);
  return [round4(x0 - p), round4(x1 + p), round4(y0 - p), round4(y1 + p)];
}

const DEPTH = { x: 0.5 * Math.cos(Math.PI / 5), y: 0.5 * Math.sin(Math.PI / 5) };

const str = (v: number | string | undefined) => (v === undefined ? undefined : String(v));

/**
 * Pixels per unit for a view, the way Diagram.tsx draws it (at most 560 by 600 px, 22 px margins).
 * Labels are offset in pixels, so this is how a figure keeps a label clear of a nearby rim.
 */
function pxPerUnit(view: DiagramSpec["view"]): number {
  return Math.min((560 - 44) / (view[1] - view[0]), (600 - 44) / (view[3] - view[2]));
}

/** Hidden points along an ellipse from angle t0 to t1 (degrees), both ends included. */
function ellipseArc(prefix: string, cx: number, cy: number, rx: number, ry: number, t0: number, t1: number, steps: number): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = ((t0 + ((t1 - t0) * i) / steps) * Math.PI) / 180;
    return cp(`${prefix}${i}`, cx + rx * Math.cos(t), cy + ry * Math.sin(t));
  });
}

/** Segments joining consecutive points: a curve drawn piece by piece, e.g. the hidden back of a rim. */
const chain = (pts: Pt[], dashed: boolean): Seg[] => pts.slice(1).map((p, i) => ({ from: pts[i]!.name, to: p.name, dashed }));

/**
 * How many pieces a dashed curve about `px` pixels long is cut into. Each piece starts a new dash,
 * so pieces much shorter than a dash and a gap (11 px) would look solid.
 */
const dashSteps = (px: number) => Math.max(3, Math.min(16, Math.round(px / 22)));

/** Rough length of an ellipse arc of `deg` degrees, for dashSteps. */
const arcLength = (rx: number, ry: number, deg: number) => (deg / 360) * Math.PI * (rx + ry);

/**
 * How far a label sits from a radius drawn along a rim's long axis (rim half-height ry): 14 px,
 * the usual segment-label offset, or just past the rim when the rim passes closer than that.
 */
function rimLabelGap(ry: number, unit: number): number {
  const rim = 0.866 * ry * unit; // the rim's distance from the radius's midpoint, in px
  return (rim >= 26 ? 14 : rim + 12) / unit;
}

/** Parallelogram with base b along the bottom, top edge shifted right by dx, and a dashed height. */
function parallelogramFig(b: number, h: number, dx: number, lab: { base?: number | string; side?: number | string; height?: number | string }): DiagramFigure {
  // The height stands on B, inside the figure and clear of the base and side labels, while the top
  // edge reaches over B. When the shape leans past its own base, it drops from C, outside the figure.
  const far = dx > b;
  const pts = [cp("A", 0, 0), cp("B", b, 0), cp("C", b + dx, h), cp("D", dx, h), far ? cp("E", b + dx, 0) : cp("T", b, h)];
  const segments: Seg[] = [{ from: "A", to: "B", label: str(lab.base) }];
  if (lab.side !== undefined) segments.push({ from: "A", to: "D", label: str(lab.side) });
  if (far) segments.push({ from: "B", to: "E", dashed: true }, { from: "C", to: "E", dashed: true, label: str(lab.height) });
  else segments.push({ from: "T", to: "B", dashed: true, label: str(lab.height) });
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
    segments,
    angles: [far ? { at: "E", from: "B", to: "C", right: true } : { at: "B", from: "A", to: "T", right: true }],
  };
}

/** Triangle with base b and its apex above a point 35% of the way along, with a dashed height. */
function triangleHeightFig(b: number, h: number, lab: { base: string; height: string }): DiagramFigure {
  const pts = [cp("A", 0, 0), cp("B", b, 0), cp("C", 0.35 * b, h), cp("F", 0.35 * b, 0)];
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", "C"], fill: 1 }],
    segments: [
      { from: "A", to: "B", label: lab.base },
      { from: "C", to: "F", dashed: true, label: lab.height },
    ],
    angles: [{ at: "F", from: "B", to: "C", right: true }],
  };
}

/** Trapezoid with horizontal parallel bases and a dashed height between them. */
function trapezoidFig(bottom: number, top: number, h: number, lab: { bottom: number | string; top: number | string; height: number | string }): DiagramFigure {
  const off = 0.3 * (bottom - top);
  const lo = Math.max(0, off);
  const hi = Math.min(bottom, off + top);
  const x = lo + 0.25 * (hi - lo);
  const pts = [cp("A", 0, 0), cp("B", bottom, 0), cp("C", off + top, h), cp("D", off, h), cp("H1", x, h), cp("H2", x, 0)];
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
    segments: [
      { from: "A", to: "B", label: String(lab.bottom), parallel: 1 },
      { from: "D", to: "C", label: String(lab.top), parallel: 1 },
      { from: "H1", to: "H2", dashed: true, label: String(lab.height) },
    ],
    angles: [{ at: "H2", from: "B", to: "H1", right: true }],
  };
}

/** Kite or rhombus ABCD whose diagonal AC crosses BD at the fraction t of the way from A. */
function kiteFig(d1: number, d2: number, rhombus: boolean): DiagramFigure {
  const t = rhombus ? 0.5 : 0.3;
  const pts: Pt[] = [
    { name: "A", x: 0, y: 0, dir: "w" },
    { name: "B", x: round4(t * d1), y: d2 / 2, dir: "n" },
    { name: "C", x: d1, y: 0, dir: "e" },
    { name: "D", x: round4(t * d1), y: -d2 / 2, dir: "s" },
    cp("X", t * d1, 0),
  ];
  const outer: 1 | 2 = rhombus ? 1 : 2;
  return {
    kind: "diagram",
    view: fit(pts, 0.14),
    points: pts,
    polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }],
    segments: [
      { from: "A", to: "B", ticks: 1 },
      { from: "A", to: "D", ticks: 1 },
      { from: "C", to: "B", ticks: outer },
      { from: "C", to: "D", ticks: outer },
      { from: "A", to: "C", color: 2 },
      { from: "B", to: "D", color: 2 },
    ],
    angles: [{ at: "X", from: "C", to: "B", right: true }],
  };
}

/** Regular n-gon with side s and a horizontal bottom side; optionally its apothem to that side. */
function regularPolygonFig(n: number, s: number, lab: { side?: number | string; apothem?: number | string }): DiagramFigure {
  const R = s / (2 * Math.sin(Math.PI / n));
  const verts = Array.from({ length: n }, (_, k) => {
    const t = ((-90 - 180 / n + (k * 360) / n) * Math.PI) / 180;
    return cp(`V${k}`, R * Math.cos(t), R * Math.sin(t));
  });
  const a = R * Math.cos(Math.PI / n);
  const pts: Pt[] = [...verts, { name: "O", x: 0, y: 0, label: "", hidden: lab.apothem === undefined }, cp("M", 0, -a)];
  const segments: Seg[] = verts.map((v, k) => ({ from: v.name, to: verts[(k + 1) % n]!.name, ticks: 1 as const, label: k === 0 ? str(lab.side) : undefined }));
  const fig: DiagramFigure = { kind: "diagram", view: fit(pts, 0.1), points: pts, polygons: [{ points: verts.map((v) => v.name), fill: 1 }], segments };
  if (lab.apothem !== undefined) {
    segments.push({ from: "O", to: "M", dashed: true, color: 2, label: String(lab.apothem) });
    fig.angles = [{ at: "M", from: "V1", to: "O", right: true }];
  }
  return fig;
}

/** A rectangle w by h with a triangle of height t on its top side. */
function houseFig(w: number, h: number, t: number): DiagramFigure {
  const pts = [cp("A", 0, 0), cp("B", w, 0), cp("C", w, h), cp("P", w / 2, h + t), cp("D", 0, h), cp("M", w / 2, h)];
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", "C", "P", "D"], fill: 1 }],
    segments: [
      { from: "A", to: "B", label: String(w) },
      { from: "B", to: "C", label: String(h) },
      { from: "D", to: "C", dashed: true },
      { from: "M", to: "P", dashed: true, label: String(t) },
    ],
    angles: [{ at: "M", from: "C", to: "P", right: true }],
  };
}

/** A W by H rectangle with an a by b corner (dashed) cut from the top right. */
function lShapeFig(W: number, H: number, a: number, b: number): DiagramFigure {
  const pts = [cp("A", 0, 0), cp("B", W, 0), cp("C", W, H - b), cp("D", W - a, H - b), cp("E", W - a, H), cp("F", 0, H), cp("G", W, H)];
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [
      { points: ["A", "B", "C", "D", "E", "F"], fill: 1 },
      { points: ["D", "C", "G", "E"], dashed: true },
    ],
    segments: [
      { from: "A", to: "B", label: String(W) },
      { from: "F", to: "A", label: String(H) },
      { from: "E", to: "G", dashed: true, label: String(a) },
      { from: "C", to: "G", dashed: true, label: String(b) },
    ],
  };
}

/** A circle with a labeled radius or diameter. */
function circleFig(rad: number, kind: "radius" | "diameter", label: string): DiagramFigure {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const pts: Pt[] = [{ name: "O", x: 0, y: 0, label: "" }, cp("P", rad * c, rad * s), cp("Q", -rad * c, -rad * s)];
  return {
    kind: "diagram",
    view: [-1.2 * rad, 1.2 * rad, -1.2 * rad, 1.2 * rad],
    points: pts,
    circles: [{ center: "O", radius: rad, fill: 1 }],
    segments: [{ from: kind === "radius" ? "O" : "Q", to: "P", label: kind === "radius" ? label : undefined, color: 2 }],
    // A diameter's midpoint is the center, so its label goes beside the upper half instead.
    labels: kind === "diameter" ? [{ x: round4(0.5 * rad * c - 0.14 * rad * s), y: round4(0.5 * rad * s + 0.14 * rad * c), text: label }] : undefined,
  };
}

/** A shaded sector with central angle theta (degrees) and radius rad, its arc in color. */
function sectorFig(rad: number, theta: number): DiagramFigure {
  const t = (theta * Math.PI) / 180;
  const rim = arc("s", 0, 0, rad, 0, theta, Math.ceil(theta / 5));
  const pts: Pt[] = [{ name: "O", x: 0, y: 0, label: "" }, cp("P", rad, 0), cp("Q", rad * Math.cos(t), rad * Math.sin(t)), ...rim];
  const view = fit(pts, 0.15);
  const fig: DiagramFigure = {
    kind: "diagram",
    view,
    points: pts,
    polygons: [{ points: ["O", ...rim.map((p) => p.name)], fill: 1 }],
    arcs: [{ center: "O", from: "P", to: "Q", major: theta > 180 }],
    segments: [{ from: "O", to: "P", label: String(rad) }],
    angles: [{ at: "O", from: "P", to: "Q", label: theta >= 60 ? md`${theta}^\circ` : undefined, reflex: theta > 180 }],
  };
  if (theta < 60) {
    // A narrow angle has no room for its label next to the mark, so it goes further out along
    // the bisector, where the two radii are at least 34 px apart.
    const d = Math.max(40, 34 / (2 * Math.sin(t / 2))) / pxPerUnit(view);
    fig.labels = [{ x: round4(d * Math.cos(t / 2)), y: round4(d * Math.sin(t / 2)), text: md`${theta}^\circ` }];
  }
  return fig;
}

/** Two circles with a shared center and their radii labeled. */
function ringFig(R: number, rin: number): DiagramFigure {
  const t = (2 * Math.PI) / 3;
  const pts: Pt[] = [{ name: "O", x: 0, y: 0, label: "" }, cp("P", R, 0), cp("Q", rin * Math.cos(t), rin * Math.sin(t))];
  return {
    kind: "diagram",
    view: [-1.2 * R, 1.2 * R, -1.2 * R, 1.2 * R],
    points: pts,
    circles: [
      { center: "O", radius: R, fill: 1 },
      { center: "O", radius: rin },
    ],
    segments: [
      { from: "O", to: "P", color: 2 },
      { from: "O", to: "Q", label: String(rin), color: 2 },
    ],
    // The outer radius's label sits above its midpoint, or further out when the inner circle crosses there.
    labels: [{ x: round4((Math.abs(rin / R - 0.5) < 0.12 ? 0.78 : 0.5) * R), y: round4(0.1 * R), text: String(R) }],
  };
}

/** A w by h rectangle with a semicircle on its top side, shaded as one region; the dashed line is the semicircle's diameter. */
function windowFig(w: number, h: number): DiagramFigure {
  const top = arc("w", w / 2, h, w / 2, 0, 180, 24);
  const pts = [cp("A", 0, 0), cp("B", w, 0), cp("C", w, h), cp("D", 0, h), ...top];
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", ...top.map((p) => p.name)], fill: 1 }],
    segments: [
      { from: "A", to: "B", label: String(w) },
      { from: "B", to: "C", label: String(h) },
      { from: "D", to: "C", dashed: true },
    ],
  };
}

/** An s by s square with a quarter circle centered at its lower left corner; what is left of the square is shaded. */
function quarterCircleFig(s: number): DiagramFigure {
  const q = arc("q", 0, 0, s, 90, 0, 24);
  const pts: Pt[] = [{ name: "A", x: 0, y: 0, label: "" }, cp("B", s, 0), cp("C", s, s), cp("D", 0, s), ...q];
  return {
    kind: "diagram",
    view: fit(pts, 0.15),
    points: pts,
    polygons: [{ points: ["A", "B", "C", "D"] }, { points: ["C", ...q.map((p) => p.name)], fill: 1 }],
    arcs: [{ center: "A", from: "B", to: "D" }],
    segments: [{ from: "A", to: "B", label: String(s) }],
  };
}

/** A box l long, w deep and h tall. */
function boxFig(l: number, w: number, h: number): DiagramFigure {
  const [dx, dy] = [w * DEPTH.x, w * DEPTH.y];
  const pts = [cp("A", 0, 0), cp("B", l, 0), cp("C", l, h), cp("D", 0, h), cp("E", dx, dy), cp("F", l + dx, dy), cp("G", l + dx, h + dy), cp("H", dx, h + dy)];
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", "C", "D"], fill: 1 }, { points: ["D", "C", "G", "H"] }, { points: ["B", "F", "G", "C"] }],
    segments: [
      { from: "A", to: "E", dashed: true },
      { from: "E", to: "F", dashed: true },
      { from: "E", to: "H", dashed: true },
      { from: "A", to: "B", label: String(l) },
      { from: "B", to: "F", label: String(w) },
      { from: "A", to: "D", label: String(h) },
    ],
  };
}

/** A prism whose front base is a right triangle with legs a (across) and b (up), L deep. */
function triPrismFig(a: number, b: number, L: number, c?: number): DiagramFigure {
  const [dx, dy] = [L * DEPTH.x, L * DEPTH.y];
  const pts = [cp("P", 0, 0), cp("Q", a, 0), cp("R", 0, b), cp("P2", dx, dy), cp("Q2", a + dx, dy), cp("R2", dx, b + dy)];
  const segments: Seg[] = [
    { from: "P", to: "P2", dashed: true },
    { from: "P2", to: "Q2", dashed: true },
    { from: "P2", to: "R2", dashed: true },
    { from: "P", to: "Q", label: String(a) },
    { from: "P", to: "R", label: String(b) },
    { from: "Q", to: "Q2", label: String(L) },
  ];
  if (c !== undefined) segments.push({ from: "Q2", to: "R2", label: String(c) });
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["P", "Q", "R"], fill: 1 }, { points: ["Q", "Q2", "R2", "R"] }],
    segments,
    angles: [{ at: "P", from: "Q", to: "R", right: true }],
  };
}

// Round solids are seen from a little above, so each rim is an ellipse 0.3 times as tall as it is
// wide. The back of a bottom rim is hidden and drawn dashed.

/** An upright cylinder of radius r and height h. Labels go on the top radius and the right side. */
function cylinderFig(r: number, h: number, lab: { r: number | string; h: number | string }): DiagramFigure {
  const ry = 0.3 * r;
  const top = ellipse("t", 0, h, r, ry, 32);
  const bot = ellipse("b", 0, 0, r, ry, 32);
  const pts: Pt[] = [...top, ...bot, cp("R0", r, 0), cp("R1", r, h), { name: "T", x: 0, y: h, label: "" }];
  const view = fit(pts);
  const unit = pxPerUnit(view);
  const back = ellipseArc("k", 0, 0, r, ry, 0, 180, dashSteps(arcLength(r, ry, 180) * unit));
  // The outline: the front of the bottom rim, up the right side, the back of the top rim, down the left side.
  const outline = [...bot.slice(16), bot[0]!, ...top.slice(0, 17)];
  return {
    kind: "diagram",
    view,
    points: [...pts, ...back],
    polygons: [{ points: outline.map((p) => p.name), fill: 1 }, { points: top.map((p) => p.name), fill: 1 }],
    segments: [...chain(back, true), { from: "R0", to: "R1", label: String(lab.h) }, { from: "T", to: "R1", dashed: true }],
    labels: [{ x: round4(r / 2), y: round4(h + rimLabelGap(ry, unit)), text: String(lab.r) }],
  };
}

/** A right cone of radius r and height h; each label is drawn only when given. */
function coneFig(r: number, h: number, lab: { r?: number | string; h?: number | string; l?: number | string }): DiagramFigure {
  const ry = 0.3 * r;
  // The sides meet the rim where lines from the apex touch it: at angle t0 with sin t0 = ry / h.
  const t0 = h > 1.05 * ry ? (Math.asin(ry / h) * 180) / Math.PI : 0;
  const front = ellipseArc("e", 0, 0, r, ry, 180 - t0, 360 + t0, 32);
  const pts: Pt[] = [...front, cp("V", 0, h), { name: "O", x: 0, y: 0, label: "" }, cp("R", r, 0)];
  const view = fit(pts);
  const unit = pxPerUnit(view);
  const back = ellipseArc("k", 0, 0, r, ry, t0, 180 - t0, dashSteps(arcLength(r, ry, 180 - 2 * t0) * unit));
  const segments: Seg[] = [...chain(back, true), { from: "V", to: front[front.length - 1]!.name, label: str(lab.l) }, { from: "O", to: "R", dashed: true }];
  const fig: DiagramFigure = { kind: "diagram", view, points: [...pts, ...back], polygons: [{ points: ["V", ...front.map((p) => p.name)], fill: 1 }], segments };
  if (lab.r !== undefined) fig.labels = [{ x: round4(r / 2), y: round4(-rimLabelGap(ry, unit)), text: String(lab.r) }];
  if (lab.h !== undefined) {
    segments.push({ from: "V", to: "O", dashed: true, label: String(lab.h) });
    fig.angles = [{ at: "O", from: "R", to: "V", right: true }];
  }
  return fig;
}

/** A sphere of radius r with its equator: the front half solid, the back half dashed. */
function sphereFig(r: number): DiagramFigure {
  const ry = 0.3 * r;
  const view: DiagramSpec["view"] = [-1.2 * r, 1.2 * r, -1.2 * r, 1.2 * r];
  const front = ellipseArc("q", 0, 0, r, ry, 180, 360, 24);
  const back = ellipseArc("k", 0, 0, r, ry, 0, 180, dashSteps(arcLength(r, ry, 180) * pxPerUnit(view)));
  return {
    kind: "diagram",
    view,
    points: [...front, ...back, { name: "O", x: 0, y: 0, label: "" }, cp("P", r, 0)],
    circles: [{ center: "O", radius: r, fill: 1 }],
    segments: [...chain(front, false), ...chain(back, true), { from: "O", to: "P", label: String(r), color: 2 }],
  };
}

/** A solid hemisphere of radius r, flat face down. */
function hemisphereFig(r: number): DiagramFigure {
  const ry = 0.3 * r;
  const view: DiagramSpec["view"] = [-1.2 * r, 1.2 * r, -0.55 * r, 1.2 * r];
  const dome = arc("d", 0, 0, r, 0, 180, 36);
  const front = ellipseArc("f", 0, 0, r, ry, 180, 360, 24);
  const back = ellipseArc("k", 0, 0, r, ry, 0, 180, dashSteps(arcLength(r, ry, 180) * pxPerUnit(view)));
  return {
    kind: "diagram",
    view,
    points: [...dome, ...front, ...back, { name: "O", x: 0, y: 0, label: "" }, cp("R", r, 0)],
    polygons: [{ points: [...dome, ...front].map((p) => p.name), fill: 1 }],
    segments: [...chain(back, true), { from: "O", to: "R", dashed: true, label: String(r) }],
  };
}

/** A cylinder of radius r leaning right: top center (sx, h). Labels the radius, the left slanted side, and a dashed height outside on the right. */
function obliqueCylinderFig(r: number, h: number, slant: number): DiagramFigure {
  const sx = Math.sqrt(slant * slant - h * h);
  const ry = 0.3 * r;
  // The slanted sides touch each rim where the rim runs parallel to them: tan t1 = -ry sx / (r h).
  const t1 = (Math.atan2(-ry * sx, r * h) * 180) / Math.PI;
  const front = ellipseArc("f", 0, 0, r, ry, t1 + 180, t1 + 360, 24);
  const topBack = ellipseArc("g", sx, h, r, ry, t1, t1 + 180, 24);
  const top = ellipse("t", sx, h, r, ry, 32);
  const pts: Pt[] = [...front, ...topBack, ...top, { name: "O", x: 0, y: 0, label: "" }, cp("R0", r, 0), cp("R1", sx + r, h), cp("F", sx + r, 0)];
  const view = fit(pts);
  const unit = pxPerUnit(view);
  const back = ellipseArc("k", 0, 0, r, ry, t1, t1 + 180, dashSteps(arcLength(r, ry, 180) * unit));
  return {
    kind: "diagram",
    view,
    points: [...pts, ...back],
    polygons: [{ points: [...front, ...topBack].map((p) => p.name), fill: 1 }, { points: top.map((p) => p.name), fill: 1 }],
    segments: [
      ...chain(back, true),
      { from: front[0]!.name, to: topBack[topBack.length - 1]!.name, label: String(slant) },
      { from: "O", to: "R0", dashed: true },
      { from: "R0", to: "F", dashed: true },
      { from: "R1", to: "F", dashed: true, label: String(h) },
    ],
    labels: [{ x: round4(r / 2), y: round4(-rimLabelGap(ry, unit)), text: String(r) }],
    angles: [{ at: "F", from: "R0", to: "R1", right: true }],
  };
}

/** An oblique prism on a square base of side s, leaning right; slanted edges `slant` long, dashed height h. */
function obliquePrismFig(s: number, h: number, slant: number): DiagramFigure {
  const sx = Math.sqrt(slant * slant - h * h);
  const [dx, dy] = [s * DEPTH.x, s * DEPTH.y];
  // Seen from above and to the right, the right face shows, unless the prism leans so far that
  // its left face tips up toward the viewer and the right face turns away.
  const rightShows = h * DEPTH.x > sx * DEPTH.y;
  // The height stands on B while the top face reaches over B; otherwise it drops from A2, past B.
  const inside = sx <= s;
  const base: [string, number, number][] = [
    ["A", 0, 0],
    ["B", s, 0],
    ["C", s + dx, dy],
    ["D", dx, dy],
  ];
  const pts = [...base.map(([n, x, y]) => cp(n, x, y)), ...base.map(([n, x, y]) => cp(`${n}2`, x + sx, y + h)), inside ? cp("T", s, h) : cp("F", sx, 0)];
  const segments: Seg[] = [
    { from: "D", to: "C", dashed: true },
    ...(rightShows ? [{ from: "A", to: "D" }, { from: "D", to: "D2" }] : [{ from: "B", to: "C" }, { from: "C", to: "C2" }]).map((e) => ({ ...e, dashed: true })),
    { from: "A", to: "B", label: String(s) },
    { from: "A", to: "A2", label: String(slant) },
  ];
  if (inside) segments.push({ from: "T", to: "B", dashed: true, label: String(h) });
  else segments.push({ from: "A2", to: "F", dashed: true, label: String(h) }, { from: "B", to: "F", dashed: true });
  return {
    kind: "diagram",
    view: fit(pts),
    points: pts,
    polygons: [{ points: ["A", "B", "B2", "A2"], fill: 1 }, { points: ["A2", "B2", "C2", "D2"] }, { points: rightShows ? ["B", "C", "C2", "B2"] : ["A", "D", "D2", "A2"] }],
    segments,
    angles: [inside ? { at: "B", from: "A", to: "T", right: true } : { at: "F", from: "A", to: "A2", right: true }],
  };
}

/** A pyramid on an l by w rectangular base with its apex H above the center. Optional dashed height and front slant height. */
function pyramidFig(l: number, w: number, H: number, lab: { l: number | string; w?: number | string; h?: number | string; slant?: number | string }): DiagramFigure {
  const [dx, dy] = [w * DEPTH.x, w * DEPTH.y];
  // The front and right faces always show. A short pyramid also shows its left face, and a very
  // short one its back face, to a viewer above and to the right; the edges between faces that
  // don't show are hidden.
  const leftShows = H * DEPTH.x < (l / 2) * DEPTH.y;
  const backShows = H < (w / 2) * DEPTH.y;
  const pts = [cp("A", 0, 0), cp("B", l, 0), cp("C", l + dx, dy), cp("D", dx, dy), cp("M", (l + dx) / 2, dy / 2), cp("V", (l + dx) / 2, dy / 2 + H), cp("N", l / 2, 0)];
  const view = fit(pts);
  const segments: Seg[] = [
    { from: "A", to: "D", dashed: !leftShows },
    { from: "D", to: "C", dashed: !backShows },
    { from: "V", to: "D", dashed: !leftShows && !backShows },
    { from: "A", to: "B", label: String(lab.l) },
  ];
  const polygons: Poly[] = [{ points: ["A", "B", "V"], fill: 1 }, { points: ["B", "C", "V"] }];
  if (leftShows) polygons.push({ points: ["A", "D", "V"] });
  if (backShows) polygons.push({ points: ["D", "C", "V"] });
  const fig: DiagramFigure = { kind: "diagram", view, points: pts, polygons, segments };
  if (lab.w !== undefined) segments.push({ from: "B", to: "C", label: String(lab.w) });
  if (lab.h !== undefined) segments.push({ from: "V", to: "M", dashed: true, label: String(lab.h) });
  if (lab.slant !== undefined) {
    segments.push({ from: "V", to: "N", dashed: true, color: 2 });
    // Its label goes on the B side, inside the front face, away from the edges on the A side.
    const [ux, uy] = [-dx / 2, -(dy / 2 + H)]; // from V down to N
    const len = Math.hypot(ux, uy);
    const gap = 16 / pxPerUnit(view);
    const mid = { x: (l / 2 + (l + dx) / 2) / 2, y: (dy / 2 + H) / 2 };
    fig.labels = [{ x: round4(mid.x - (uy / len) * gap), y: round4(mid.y + (ux / len) * gap), text: String(lab.slant) }];
    fig.angles = [{ at: "N", from: "B", to: "V", right: true }];
  }
  return fig;
}

/** A triangle on a coordinate grid, each vertex labeled with its coordinates. */
function gridTriangleFig(a: [number, number], b: [number, number], c: [number, number]): DiagramFigure {
  const xs = [a[0], b[0], c[0], 0];
  const ys = [a[1], b[1], c[1], 0];
  const up = c[1] > a[1];
  const pt = (name: string, [x, y]: [number, number], dir: Pt["dir"]): Pt => ({ name, x, y, label: `(${x}, ${y})`, dir });
  return {
    kind: "diagram",
    grid: true,
    view: [Math.min(...xs) - 1.5, Math.max(...xs) + 1.5, Math.min(...ys) - 1.5, Math.max(...ys) + 1.5],
    points: [pt("P", a, up ? "sw" : "nw"), pt("Q", b, up ? "se" : "ne"), pt("R", c, up ? "n" : "s")],
    polygons: [{ points: ["P", "Q", "R"], fill: 1 }],
  };
}

// ── Lesson 1: Area from first principles ────────────────────────────────────

const basicAreas: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const b = r.int(4, 14);
    const h = r.int(3, 9);
    const side = h + r.int(1, 4);
    return {
      prompt: md`Find the area of the parallelogram. The vertical dashed segment is its height, perpendicular to the base. ${NO_UNITS}`,
      figure: parallelogramFig(b, h, Math.sqrt(side * side - h * h), { base: b, side, height: h }),
      answer: String(b * h),
      verify: [`A = ${b} * ${h}`],
      hint: "Area uses the height, which is perpendicular to the base. The slanted side is not the height.",
      solution: [
        { math: md`A = bh`, note: "Cut the triangle off one end and slide it to the other: the parallelogram becomes a rectangle with the same base and height." },
        { math: md`A = ${b} \cdot ${h} = ${b * h}`, note: md`The slanted side, ${side}, plays no part. It is longer than the height, which is why using it would overcount.` },
      ],
    };
  }
  if (kind === 1) {
    const x1 = r.int(-6, 0);
    const b = r.int(3, 10);
    const x2 = x1 + b;
    const y0 = r.int(-3, 2);
    const h = r.int(2, 8);
    const y3 = y0 + (r.next() < 0.5 ? h : -h);
    const x3 = r.int(x1 - 3, x2 + 3);
    const outside = x3 < x1 || x3 > x2;
    const [exFrac, exDec] = b * h === 15 ? ["21/2", "10.5"] : ["15/2", "7.5"];
    return {
      prompt: md`Find the area of the triangle with vertices $(${x1}, ${y0})$, $(${x2}, ${y0})$ and $(${x3}, ${y3})$. Give an exact answer (a fraction like ${exFrac} or a decimal like ${exDec} is fine).`,
      figure: gridTriangleFig([x1, y0], [x2, y0], [x3, y3]),
      answer: frac(b * h, 2),
      // The shoelace formula, independent of the base-and-height route.
      verify: [`A = abs((${x1})((${y0}) - (${y3})) + (${x2})((${y3}) - (${y0})) + (${x3})((${y0}) - (${y0})))/2`],
      hint: "Two vertices share a y-coordinate, so that side is horizontal. Use it as the base; the height is the vertical distance to the third vertex.",
      solution: [
        { math: md`b = ${x2} - ${x1 < 0 ? `(${x1})` : x1} = ${b}`, note: "The base runs along a horizontal line, so its length is the difference of the x-coordinates." },
        { math: md`h = |${y3} - ${y0 < 0 ? `(${y0})` : y0}| = ${h}`, note: outside ? "The height is the vertical distance from the third vertex to the line containing the base. Here the third vertex is not above the base itself, and that doesn't matter (the lesson shows why): the height is still measured to the base's line." : "The height is the vertical distance from the third vertex to the base's line." },
        { math: md`A = \frac{1}{2}bh = \frac{1}{2}(${b})(${h}) = ${b * h % 2 === 0 ? b * h / 2 : `\\frac{${b * h}}{2}`}`, note: "A triangle is half of a parallelogram with the same base and height." },
      ],
    };
  }
  if (kind === 2) {
    const b1 = r.int(3, 12);
    let b2 = r.int(3, 14);
    while (b2 === b1) b2 = r.int(3, 14);
    let h = r.int(2, 9);
    if (((b1 + b2) * h) % 2) h += 1;
    const A = ((b1 + b2) * h) / 2;
    return {
      prompt: md`Find the area of the trapezoid. Its two horizontal sides are parallel, and the dashed segment is its height. ${NO_UNITS}`,
      figure: trapezoidFig(Math.max(b1, b2), Math.min(b1, b2), h, { bottom: Math.max(b1, b2), top: Math.min(b1, b2), height: h }),
      answer: String(A),
      verify: [`A = (1/2)(${b1} + ${b2})(${h})`],
      hint: md`$A = \frac{1}{2}(b_1 + b_2)h$: two copies of the trapezoid make a parallelogram with base $b_1 + b_2$.`,
      solution: [
        { math: md`A = \frac{1}{2}(b_1 + b_2)h`, note: "Half of the parallelogram made from two copies." },
        { math: md`A = \frac{1}{2}(${b1} + ${b2})(${h}) = \frac{1}{2}(${b1 + b2})(${h})`, note: "Add the bases first." },
        { math: String(A), note: "" },
      ],
    };
  }
  const shape = r.pick(["kite", "rhombus"]);
  const d1 = r.int(3, 14);
  let d2 = r.int(2, 12);
  if ((d1 * d2) % 2) d2 += 1;
  if (shape === "rhombus" && d2 === d1) d2 += 2;
  return {
    prompt: md`Find the area of ${shape} $ABCD$. Its diagonals are $AC = ${d1}$ and $BD = ${d2}$. ${NO_UNITS}`,
    figure: kiteFig(d1, d2, shape === "rhombus"),
    answer: String((d1 * d2) / 2),
    verify: [`A = (1/2)(${d1})(${d2})`],
    hint: md`The diagonals of a ${shape} are perpendicular. One diagonal cuts it into two triangles whose heights add up to the other diagonal.`,
    solution: [
      { math: md`A = \frac{1}{2}d_1 \cdot x + \frac{1}{2}d_1 \cdot y = \frac{1}{2}d_1(x + y)`, note: md`Diagonal $d_1$ splits the ${shape} into two triangles with base $d_1$. Their heights $x$ and $y$ are the two pieces of the other diagonal.` },
      { math: md`A = \frac{1}{2}d_1 d_2 = \frac{1}{2}(${d1})(${d2})`, note: md`$x + y = d_2$.` },
      { math: String((d1 * d2) / 2), note: "" },
    ],
  };
};

const missingDimension: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const b = r.int(3, 15);
    const h = r.int(2, 12);
    return {
      prompt: md`Solve $${b}h = ${b * h}$ to find the height $h$ of the parallelogram, which has area ${b * h}.`,
      figure: parallelogramFig(b, h, Math.min(0.8 * b, Math.max(1, 0.35 * b, 0.2 * h)), { base: b, height: "h" }),
      answer: String(h),
      hint: md`The equation is $A = bh$ with the numbers filled in. Undo the multiplication.`,
      solution: [
        { math: md`${b}h = ${b * h}`, note: md`$A = bh$ with $A = ${b * h}$ and $b = ${b}$.` },
        { math: md`h = \frac{${b * h}}{${b}} = ${h}`, note: md`Divide both sides by ${b}.` },
      ],
    };
  }
  if (kind === 1) {
    const b = r.int(3, 16);
    let h = r.int(2, 12);
    if ((b * h) % 2) h += 1;
    const A = (b * h) / 2;
    return {
      prompt: md`The triangle has area ${A}. Find its height $h$, the dashed segment.`,
      figure: triangleHeightFig(b, h, { base: String(b), height: "h" }),
      answer: String(h),
      verify: [`(1/2)(${b}) h = ${A}`],
      hint: md`$A = \frac{1}{2}bh$, so $\frac{1}{2} \cdot ${b} \cdot h = ${A}$. Multiply both sides by 2 first, then divide by the base.`,
      solution: [
        { math: md`\frac{1}{2} \cdot ${b} \cdot h = ${A}`, note: md`$A = \frac{1}{2}bh$ with $A = ${A}$ and $b = ${b}$.` },
        { math: md`${b}h = ${2 * A}`, note: md`Multiply both sides by 2. The $\frac{1}{2}$ is there because a triangle is half a parallelogram.` },
        { math: md`h = \frac{${2 * A}}{${b}} = ${h}`, note: md`Divide both sides by ${b}.` },
      ],
    };
  }
  if (kind === 2) {
    const b1 = r.int(3, 12);
    let b2 = r.int(2, 14);
    while (b2 === b1) b2 = r.int(2, 14);
    let h = r.int(2, 10);
    if (((b1 + b2) * h) % 2) h += 1;
    const A = ((b1 + b2) * h) / 2;
    return {
      prompt: md`Solve $\frac{1}{2}(${b1} + b)(${h}) = ${A}$ to find the base $b$ of the trapezoid, which has area ${A}. Its horizontal sides are parallel.`,
      figure: trapezoidFig(b1, b2, h, { bottom: b1, top: "b", height: h }),
      answer: String(b2),
      hint: "Multiply both sides by 2, divide by the height, then subtract the known base.",
      solution: [
        { math: md`(${b1} + b)(${h}) = ${2 * A}`, note: "Multiply both sides by 2." },
        { math: md`${b1} + b = ${b1 + b2}`, note: md`Divide both sides by ${h}. This is the sum of the two bases.` },
        { math: md`b = ${b2}`, note: md`Subtract ${b1}.` },
      ],
    };
  }
  const n = r.pick([5, 6, 8, 10]);
  const s = r.int(2, 9);
  const P = n * s;
  // The apothem is fixed by the side, a = s / (2 tan(180°/n)); round it to a tenth.
  const a10 = Math.round((10 * s) / (2 * Math.tan(Math.PI / n)));
  const A = (P * a10) / 20;
  const name = { 5: "pentagon", 6: "hexagon", 8: "octagon", 10: "decagon" }[n];
  return {
    prompt: md`Solve $\frac{1}{2}(${P})a = ${dec(A)}$ to find the apothem $a$ of the regular ${name}, which has perimeter ${P} and area ${dec(A)} (the area was computed with the apothem rounded to the nearest tenth).`,
    figure: regularPolygonFig(n, s, { side: s, apothem: "a" }),
    answer: dec(a10 / 10),
    hint: md`$A = \frac{1}{2}Pa$. Multiply by 2, then divide by the perimeter.`,
    solution: [
      { math: md`${P}a = ${dec(2 * A)}`, note: "Multiply both sides by 2." },
      { math: md`a = \frac{${dec(2 * A)}}{${P}} = ${dec(a10 / 10)}`, note: md`Divide both sides by ${P}.` },
    ],
  };
};

const polygonsAndComposites: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const k = r.int(1, 6);
    const s = 2 * k;
    const coef = 6 * k * k;
    const apo = k === 1 ? md`\sqrt{3}` : md`${k}\sqrt{3}`;
    return {
      prompt: md`Find the area of the regular hexagon. Give an exact answer with the square root simplified (type $\sqrt{3}$ as sqrt(3)).`,
      figure: regularPolygonFig(6, s, { side: s }),
      answer: `${coef}sqrt(3)`,
      // Six equilateral triangles, each (sqrt 3 / 4) s^2: a different route from the apothem.
      verify: [`A = 6 (sqrt(3)/4)(${s})^2`],
      simplified: true,
      hint: "Segments from the center to the vertices make 6 equilateral triangles. The apothem is the height of one of them: use a 30-60-90 triangle.",
      solution: [
        { math: md`a = \frac{${s}}{2}\sqrt{3} = ${apo}`, note: md`The apothem is the long leg of a 30-60-90 triangle whose short leg is half a side, ${k}.` },
        { math: md`P = 6 \cdot ${s} = ${6 * s}`, note: "" },
        { math: md`A = \frac{1}{2}Pa = \frac{1}{2}(${6 * s})(${apo}) = ${coef}\sqrt{3}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const k = r.int(1, 7);
    const s = 2 * k;
    const ans = k === 1 ? "sqrt(3)" : `${k * k}sqrt(3)`;
    const h = k === 1 ? md`\sqrt{3}` : md`${k}\sqrt{3}`;
    return {
      prompt: md`Find the area of the equilateral triangle. Give an exact answer with the square root simplified (type $\sqrt{3}$ as sqrt(3)).`,
      figure: regularPolygonFig(3, s, { side: s }),
      answer: ans,
      // Heron's formula with semiperimeter 3s/2.
      verify: [`A = sqrt((${3 * k})(${3 * k} - ${s})^3)`],
      simplified: true,
      hint: "The altitude splits it into two 30-60-90 triangles. Find the height, then use one half base times height.",
      solution: [
        { math: md`h = ${h}`, note: md`Half the base is ${k}, the short leg; the height is the long leg, short leg times $\sqrt{3}$.` },
        { math: md`A = \frac{1}{2}(${s})(${h})`, note: "" },
        { math: k === 1 ? md`\sqrt{3}` : md`${k * k}\sqrt{3}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const n = r.pick([5, 8]);
    const s = n === 5 ? r.pick([6, 8, 10, 12]) : r.pick([4, 6, 8, 10]);
    const a10 = Math.round((10 * s) / (2 * Math.tan(Math.PI / n)));
    const a = a10 / 10;
    const A = (n * s * a10) / 20;
    const name = n === 5 ? "pentagon" : "octagon";
    const article = n === 5 ? "A" : "An";
    return {
      prompt: md`Find the area of the regular ${name}. Its apothem, the dashed segment, is rounded to the nearest tenth. Use the numbers shown, and don't round your answer.`,
      figure: regularPolygonFig(n, s, { side: s, apothem: dec(a) }),
      answer: dec(A),
      verify: [`A = (1/2)(${n} * ${s})(${dec(a)})`],
      hint: md`Area of a regular polygon: $A = \frac{1}{2}Pa$, where $P$ is the perimeter.`,
      solution: [
        { math: md`P = ${n} \cdot ${s} = ${n * s}`, note: md`${article} ${name} has ${n} equal sides.` },
        { math: md`A = \frac{1}{2}Pa = \frac{1}{2}(${n * s})(${dec(a)}) = ${dec(A)}`, note: md`The ${n} triangles from the center each have area $\frac{1}{2}sa$; together they give $\frac{1}{2}Pa$.` },
      ],
    };
  }
  if (kind === 3) {
    const w = r.int(3, 12);
    const h = r.int(2, 9);
    let t = r.int(2, 7);
    if ((w * t) % 2) t += 1;
    const A = w * h + (w * t) / 2;
    return {
      prompt: md`The figure is a rectangle with a triangle on top. The vertical dashed segment is the triangle's height. Find the total area. ${NO_UNITS}`,
      figure: houseFig(w, h, t),
      answer: String(A),
      verify: [`A = ${w} * ${h} + (1/2)(${w})(${t})`],
      hint: "Area addition: find the rectangle and the triangle separately, then add.",
      solution: [
        { math: md`${w} \cdot ${h} = ${w * h}`, note: "The rectangle." },
        { math: md`\frac{1}{2} \cdot ${w} \cdot ${t} = ${(w * t) / 2}`, note: "The triangle: base is the top side, height is how far the peak rises above it." },
        { math: md`${w * h} + ${(w * t) / 2} = ${A}`, note: "The pieces don't overlap, so the areas add." },
      ],
    };
  }
  const W = r.int(5, 14);
  const H = r.int(4, 12);
  const a = r.int(1, W - 2);
  const b = r.int(1, H - 2);
  return {
    prompt: md`A rectangular corner (dashed) was cut out of a rectangle, leaving the L-shape. Find the area of the L-shape. ${NO_UNITS}`,
    figure: lShapeFig(W, H, a, b),
    answer: String(W * H - a * b),
    verify: [`A = ${W} * ${H} - ${a} * ${b}`],
    hint: "The whole rectangle is the L-shape plus the missing corner. Subtract.",
    solution: [
      { math: md`${W} \cdot ${H} = ${W * H}`, note: "The whole rectangle." },
      { math: md`${a} \cdot ${b} = ${a * b}`, note: "The corner that was removed." },
      { math: md`${W * H} - ${a * b} = ${W * H - a * b}`, note: "Area addition: L-shape + corner = whole, so L-shape = whole - corner." },
    ],
  };
};

// ── Lesson 2: Circumference and area of circles ─────────────────────────────

const circleBasics: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const rad = r.int(2, 15);
    return {
      prompt: md`Find the circumference of the circle. The labeled segment is a radius. ${piForm(piText(2 * rad))}`,
      figure: circleFig(rad, "radius", String(rad)),
      answer: piText(2 * rad),
      verify: [`C = 2 pi (${rad})`],
      hint: md`$C = 2\pi r$: the diameter is twice the radius, and $C = \pi d$.`,
      solution: [
        { math: md`C = 2\pi r = 2\pi(${rad})`, note: md`$\pi$ is defined as $C/d$, so $C = \pi d = \pi(2r)$.` },
        { math: md`C = ${piTex(2 * rad)}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const d = r.int(3, 30);
    return {
      prompt: md`Find the circumference of the circle. The labeled segment is a diameter. ${piForm(piText(d))}`,
      figure: circleFig(d / 2, "diameter", String(d)),
      answer: piText(d),
      verify: [`C = pi (${d})`],
      hint: md`$\pi$ is circumference divided by diameter, so $C = \pi d$.`,
      solution: [{ math: md`C = \pi d = ${piTex(d)}`, note: md`Straight from the definition of $\pi$.` }],
    };
  }
  if (kind === 2) {
    const rad = r.int(2, 15);
    return {
      prompt: md`Find the area of the circle. The labeled segment is a radius. ${piForm(piText(rad * rad))}`,
      figure: circleFig(rad, "radius", String(rad)),
      answer: piText(rad * rad),
      verify: [`A = pi (${rad})^2`],
      hint: md`$A = \pi r^2$. Square the radius first.`,
      solution: [
        { math: md`A = \pi r^2 = \pi(${rad})^2`, note: "" },
        { math: md`A = ${piTex(rad * rad)}`, note: md`Only the radius is squared, not $\pi$.` },
      ],
    };
  }
  const half = r.int(2, 12);
  const d = 2 * half;
  return {
    prompt: md`Find the area of the circle. The labeled segment is a diameter. ${piForm(piText(half * half))}`,
    figure: circleFig(half, "diameter", String(d)),
    answer: piText(half * half),
    verify: [`A = pi (${d}/2)^2`],
    hint: md`The area formula uses the radius. Halve the diameter first.`,
    solution: [
      { math: md`r = \frac{${d}}{2} = ${half}`, note: "The radius is half the diameter." },
      { math: md`A = \pi r^2 = \pi(${half})^2 = ${piTex(half * half)}`, note: md`Squaring the diameter instead would give 4 times too much.` },
    ],
  };
};

const circleBackwards: Generator = (r) => {
  const kind = r.int(0, 3);
  const k = r.int(2, 14);
  if (kind === 0) {
    return {
      prompt: md`Solve $2\pi r = ${2 * k}\pi$ to find the radius $r$ of a circle with circumference $${2 * k}\pi$.`,
      answer: String(k),
      hint: md`Divide both sides by $2\pi$, which is just a number.`,
      solution: [
        { math: md`r = \frac{${2 * k}\pi}{2\pi}`, note: md`Divide both sides by $2\pi$.` },
        { math: md`r = ${k}`, note: md`The $\pi$'s cancel.` },
      ],
    };
  }
  if (kind === 1) {
    return {
      prompt: md`Solve $\pi r^2 = ${k * k}\pi$ to find the radius $r$ of a circle with area $${k * k}\pi$. A radius is a length, so give the positive solution.`,
      answer: String(k),
      hint: md`Divide by $\pi$, then take the square root.`,
      solution: [
        { math: md`r^2 = ${k * k}`, note: md`Divide both sides by $\pi$.` },
        { math: md`r = ${k}`, note: md`Take the positive square root; $-${k}$ also squares to ${k * k}, but a length can't be negative.` },
      ],
    };
  }
  if (kind === 2) {
    return {
      prompt: md`A circle has circumference $${2 * k}\pi$. Find its area. ${piForm(piText(k * k))}`,
      answer: piText(k * k),
      // A = C^2 / (4 pi), since C = 2 pi r and A = pi r^2.
      verify: [`A = (${2 * k} pi)^2 / (4 pi)`],
      hint: "Find the radius from the circumference first.",
      solution: [
        { math: md`2\pi r = ${2 * k}\pi \;\Rightarrow\; r = ${k}`, note: md`Divide both sides by $2\pi$.` },
        { math: md`A = \pi(${k})^2 = ${piTex(k * k)}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`A circle has area $${k * k}\pi$. Find its circumference. ${piForm(piText(2 * k))}`,
    answer: piText(2 * k),
    // C = 2 sqrt(pi A), since A = pi r^2 and C = 2 pi r.
    verify: [`C = 2 sqrt(pi (${k * k} pi))`],
    hint: "Find the radius from the area first.",
    solution: [
      { math: md`\pi r^2 = ${k * k}\pi \;\Rightarrow\; r^2 = ${k * k} \;\Rightarrow\; r = ${k}`, note: md`Divide by $\pi$, then take the positive square root.` },
      { math: md`C = 2\pi(${k}) = ${piTex(2 * k)}`, note: "" },
    ],
  };
};

const sectorsAndRegions: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 4) {
    const theta = r.pick([30, 40, 45, 60, 72, 90, 120, 135, 150, 180, 240, 270]);
    const rad = r.pick([2, 3, 4, 6, 9, 10, 12]);
    const A = piFrac(theta * rad * rad, 360);
    return {
      prompt: md`Solve $\frac{x}{360} \cdot \pi(${rad})^2 = ${A.tex}$ to find the central angle $x$, in degrees, of a sector with radius ${rad} and area $${A.tex}$.`,
      answer: String(theta),
      accept: [`${theta} degrees`, `${theta} deg`],
      hint: md`The whole circle has area $${piTex(rad * rad)}$. What fraction of that is the sector? That fraction of $360^\circ$ is the angle.`,
      solution: [
        { math: md`\frac{x}{360} \cdot ${piTex(rad * rad)} = ${A.tex}`, note: "The sector's share of the circle's area." },
        { math: md`\frac{x}{360} = ${A.tex} \div ${piTex(rad * rad)} = \frac{${frac(theta, 360).replace("/", "}{")}}`, note: md`Divide both sides by $${piTex(rad * rad)}$.` },
        { math: md`x = ${theta}`, note: "Multiply both sides by 360." },
      ],
    };
  }
  if (kind === 0) {
    const theta = r.pick([30, 45, 60, 72, 90, 120, 135, 150, 240, 270, 300]);
    const rad = r.int(2, 10);
    const A = piFrac(theta * rad * rad, 360);
    const fr = frac(theta, 360).split("/");
    const frTex = fr.length === 2 ? md`\frac{${fr[0]}}{${fr[1]}}` : fr[0]!;
    return {
      prompt: md`Find the area of the shaded sector. ${piFracForm(A.text)}`,
      figure: sectorFig(rad, theta),
      answer: A.text,
      verify: [`S = (${theta}/360) pi (${rad})^2`],
      hint: md`The sector is $\frac{${theta}}{360}$ of the whole circle, so it gets that fraction of the area.`,
      solution: [
        { math: md`\frac{${theta}}{360} = ${frTex}`, note: "The fraction of the full turn." },
        { math: md`\pi r^2 = \pi(${rad})^2 = ${piTex(rad * rad)}`, note: "The whole circle." },
        { math: md`${frTex} \cdot ${piTex(rad * rad)} = ${A.tex}`, note: "Equal central angles cut off congruent sectors, so the area is shared out in proportion to the angle." },
      ],
    };
  }
  if (kind === 1) {
    const R = r.int(3, 11);
    const rin = r.int(1, R - 1);
    return {
      prompt: md`The two circles share a center. Find the area of the flat ring between them. ${piForm(piText(R * R - rin * rin))}`,
      figure: ringFig(R, rin),
      answer: piText(R * R - rin * rin),
      verify: [`A = pi (${R})^2 - pi (${rin})^2`],
      hint: "Area addition: the big disk is the ring plus the small disk.",
      solution: [
        { math: md`\pi(${R})^2 - \pi(${rin})^2 = ${R * R}\pi - ${rin * rin}\pi`, note: "Big disk minus the hole." },
        { math: piTex(R * R - rin * rin), note: md`Not $\pi(${R} - ${rin})^2$: you subtract the areas, not the radii.` },
      ],
    };
  }
  if (kind === 2) {
    const half = r.int(1, 6);
    const w = 2 * half;
    const h = r.int(2, 10);
    const semi = piFrac(half * half, 2);
    return {
      prompt: md`The window is a rectangle with a semicircle on top. The semicircle's diameter is the rectangle's top side, dashed. Find the total area. Give an exact answer, like 15 + 7pi/2.`,
      figure: windowFig(w, h),
      answer: `${w * h} + ${semi.text}`,
      verify: [`A = ${w} * ${h} + (1/2) pi (${w}/2)^2`],
      hint: "The semicircle's radius is half the width. A semicircle is half of a circle's area.",
      solution: [
        { math: md`${w} \cdot ${h} = ${w * h}`, note: "The rectangle." },
        { math: md`\frac{1}{2}\pi(${half})^2 = ${semi.tex}`, note: md`The semicircle has radius $\frac{${w}}{2} = ${half}$.` },
        { math: md`${w * h} + ${semi.tex}`, note: md`Add the pieces. Leave it exact: ${w * h} and a multiple of $\pi$ don't combine.` },
      ],
    };
  }
  const s = r.int(2, 10);
  const q = piFrac(s * s, 4);
  return {
    prompt: md`The arc is a quarter circle centered at the square's lower left corner. Cutting the quarter circle out of the square leaves the shaded region. Find its area. Give an exact answer, like 20 - 5pi.`,
    figure: quarterCircleFig(s),
    answer: `${s * s} - ${q.text}`,
    verify: [`A = ${s}^2 - (1/4) pi (${s})^2`],
    hint: md`Square minus quarter circle. A quarter circle has $\frac{1}{4}$ of the area $\pi r^2$.`,
    solution: [
      { math: md`${s}^2 = ${s * s}`, note: "The square." },
      { math: md`\frac{1}{4}\pi(${s})^2 = ${q.tex}`, note: "The quarter circle." },
      { math: md`${s * s} - ${q.tex}`, note: "Area addition: what's left plus the quarter circle is the whole square." },
    ],
  };
};

// ── Lesson 3: Surface area ──────────────────────────────────────────────────

const prismCylinderSA: Generator = (r) => {
  const kind = r.int(0, 3);
  if (kind === 0) {
    const l = r.int(2, 10);
    let w = r.int(2, 9);
    while (w === l) w = r.int(2, 9);
    let h = r.int(2, 9);
    while (h === l || h === w) h = r.int(2, 9);
    const SA = 2 * (l * w + l * h + w * h);
    return {
      prompt: md`Find the total surface area of the closed box. ${NO_UNITS}`,
      figure: boxFig(l, w, h),
      answer: String(SA),
      verify: [`S = 2(${l} * ${w} + ${l} * ${h} + ${w} * ${h})`],
      hint: "Six rectangular faces, in three congruent pairs. Find one of each pair, add, and double.",
      solution: [
        { math: md`lw = ${l * w}, \quad lh = ${l * h}, \quad wh = ${w * h}`, note: "One face from each pair: top, front, side." },
        { math: md`2(${l * w} + ${l * h} + ${w * h}) = 2(${l * w + l * h + w * h})`, note: "Opposite faces are congruent, so each area appears twice." },
        { math: String(SA), note: "" },
      ],
    };
  }
  if (kind === 1) {
    const [a0, b0, c] = r.pick(TRIPLES.slice(0, 3));
    const [a, b] = r.next() < 0.5 ? [a0, b0] : [b0, a0];
    const L = r.int(2, 12);
    const SA = a * b + (a + b + c) * L;
    return {
      prompt: md`The right prism's bases are right triangles. Find its total surface area. ${NO_UNITS}`,
      figure: triPrismFig(a, b, L, c),
      answer: String(SA),
      verify: [`S = 2(1/2)(${a})(${b}) + (${a} + ${b} + ${c})(${L})`],
      hint: md`Two triangular bases plus the sides. The sides unroll into one rectangle: perimeter of the base times ${L}.`,
      solution: [
        { math: md`2 \cdot \frac{1}{2}(${a})(${b}) = ${a * b}`, note: "The two triangular bases. The legs are perpendicular, so one is the base and the other the height." },
        { math: md`(${a} + ${b} + ${c})(${L}) = ${a + b + c} \cdot ${L} = ${(a + b + c) * L}`, note: md`Lateral area $= Ph$.` },
        { math: md`${a * b} + ${(a + b + c) * L} = ${SA}`, note: "" },
      ],
    };
  }
  const rad = r.int(1, 9);
  const h = r.int(1, 12);
  if (kind === 2) {
    return {
      prompt: md`Find the total surface area of the closed cylinder (both circles and the curved side). ${piForm(piText(2 * rad * (rad + h)))}`,
      figure: cylinderFig(rad, h, { r: rad, h }),
      answer: piText(2 * rad * (rad + h)),
      verify: [`S = 2 pi (${rad})^2 + 2 pi (${rad})(${h})`],
      hint: md`Two circles of area $\pi r^2$, plus a rectangle $2\pi r$ wide and $h$ tall.`,
      solution: [
        { math: md`2\pi r^2 = 2\pi(${rad})^2 = ${piTex(2 * rad * rad)}`, note: "The top and bottom." },
        { math: md`2\pi r h = 2\pi(${rad})(${h}) = ${piTex(2 * rad * h)}`, note: "The curved side, unrolled into a rectangle." },
        { math: md`${piTex(2 * rad * rad)} + ${piTex(2 * rad * h)} = ${piTex(2 * rad * (rad + h))}`, note: "" },
      ],
    };
  }
  return {
    prompt: md`A paper label wraps exactly once around the curved side of the can, with no overlap and the top and bottom not covered. Find the area of the label. ${piForm(piText(2 * rad * h))}`,
    figure: cylinderFig(rad, h, { r: rad, h }),
    answer: piText(2 * rad * h),
    verify: [`A = 2 pi (${rad})(${h})`],
    hint: md`Unrolled, the label is a rectangle. How wide is it?`,
    solution: [
      { math: md`\text{width} = 2\pi(${rad}) = ${piTex(2 * rad)}`, note: "The label goes once around, so its width is the circumference." },
      { math: md`${piTex(2 * rad)} \cdot ${h} = ${piTex(2 * rad * h)}`, note: "Width times height." },
    ],
  };
};

const pyramidConeSphereSA: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const s = r.int(2, 12);
    // Slant height at most about s more than half the base, so a small base doesn't make a needle.
    const l = Math.ceil(s / 2) + r.int(1, Math.max(2, Math.min(8, s)));
    const SA = s * s + 2 * s * l;
    return {
      prompt: md`Find the total surface area of the square pyramid. The dashed segment on the front face is the slant height. ${NO_UNITS}`,
      figure: pyramidFig(s, s, Math.sqrt(l * l - (s * s) / 4), { l: s, slant: l }),
      answer: String(SA),
      verify: [`S = ${s}^2 + 4(1/2)(${s})(${l})`],
      hint: md`The base is a square. The four sides are triangles with base ${s} and height ${l}, the slant height.`,
      solution: [
        { math: md`${s}^2 = ${s * s}`, note: "The square base." },
        { math: md`4 \cdot \frac{1}{2}(${s})(${l}) = ${2 * s * l}`, note: md`Four triangles. Same thing as $\frac{1}{2}P\ell$ with $P = ${4 * s}$.` },
        { math: md`${s * s} + ${2 * s * l} = ${SA}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const [a0, b0, c] = r.pick(TRIPLES);
    const [a, h] = r.next() < 0.5 ? [a0, b0] : [b0, a0];
    const s = 2 * a;
    const SA = s * s + 2 * s * c;
    return {
      prompt: md`Find the total surface area of the square pyramid. The vertical dashed segment is its height, from the apex straight down to the center of the base. ${NO_UNITS}`,
      figure: pyramidFig(s, s, h, { l: s, h }),
      answer: String(SA),
      verify: [`S = ${s}^2 + 2(${s}) sqrt(${h}^2 + (${s}/2)^2)`],
      hint: md`You need the slant height. It is the hypotenuse of a right triangle with legs ${h} (the height) and ${a} (half the base edge).`,
      solution: [
        { math: md`\ell = \sqrt{${h}^2 + ${a}^2} = \sqrt{${h * h + a * a}} = ${c}`, note: "Pythagorean Theorem: from the center of the base straight out to the middle of an edge is half the edge." },
        { math: md`${s}^2 + 4 \cdot \frac{1}{2}(${s})(${c}) = ${s * s} + ${2 * s * c}`, note: "Base plus four triangular faces." },
        { math: String(SA), note: "" },
      ],
    };
  }
  if (kind === 2) {
    const useH = r.next() < 0.5;
    if (useH) {
      const [a0, b0, c] = r.pick(TRIPLES);
      const [rad, h] = r.next() < 0.5 ? [a0, b0] : [b0, a0];
      return {
        prompt: md`Find the total surface area of the cone, base included. ${piForm(piText(rad * (rad + c)))}`,
        figure: coneFig(rad, h, { r: rad, h }),
        answer: piText(rad * (rad + c)),
        verify: [`S = pi (${rad})^2 + pi (${rad}) sqrt(${rad}^2 + ${h}^2)`],
        hint: md`Lateral area is $\pi r \ell$, so you need the slant height $\ell$ first. Use the Pythagorean Theorem.`,
        solution: [
          { math: md`\ell = \sqrt{${rad}^2 + ${h}^2} = \sqrt{${rad * rad + h * h}} = ${c}`, note: "Radius, height and slant height form a right triangle." },
          { math: md`\pi r^2 + \pi r \ell = \pi(${rad})^2 + \pi(${rad})(${c})`, note: "Base plus lateral surface." },
          { math: md`${piTex(rad * rad)} + ${piTex(rad * c)} = ${piTex(rad * (rad + c))}`, note: "" },
        ],
      };
    }
    const rad = r.int(1, 9);
    const l = rad + r.int(1, 8);
    return {
      prompt: md`Find the total surface area of the cone, base included. The label on its side is the slant height. ${piForm(piText(rad * (rad + l)))}`,
      figure: coneFig(rad, Math.sqrt(l * l - rad * rad), { r: rad, l }),
      answer: piText(rad * (rad + l)),
      verify: [`S = pi (${rad})^2 + pi (${rad})(${l})`],
      hint: md`Base $\pi r^2$ plus lateral area $\pi r \ell$.`,
      solution: [
        { math: md`\pi(${rad})^2 = ${piTex(rad * rad)}`, note: "The circular base." },
        { math: md`\pi(${rad})(${l}) = ${piTex(rad * l)}`, note: "The lateral surface flattens into a sector with area $\\pi r \\ell$." },
        { math: md`${piTex(rad * rad)} + ${piTex(rad * l)} = ${piTex(rad * (rad + l))}`, note: "" },
      ],
    };
  }
  const rad = r.int(1, 12);
  if (kind === 3) {
    return {
      prompt: md`Find the surface area of the sphere. The labeled segment is a radius. ${piForm(piText(4 * rad * rad))}`,
      figure: sphereFig(rad),
      answer: piText(4 * rad * rad),
      verify: [`S = 4 pi (${rad})^2`],
      hint: md`$S = 4\pi r^2$, the curved side of the cylinder that just holds the sphere.`,
      solution: [{ math: md`4\pi r^2 = 4\pi(${rad})^2 = ${piTex(4 * rad * rad)}`, note: "Square the radius, then multiply by 4." }],
    };
  }
  return {
    prompt: md`Find the total surface area of the solid hemisphere (half a ball, flat face included). ${piForm(piText(3 * rad * rad))}`,
    figure: hemisphereFig(rad),
    answer: piText(3 * rad * rad),
    verify: [`S = (1/2)(4 pi (${rad})^2) + pi (${rad})^2`],
    hint: "Half of the sphere's curved surface, plus the flat circle.",
    solution: [
      { math: md`\frac{1}{2} \cdot 4\pi(${rad})^2 = ${piTex(2 * rad * rad)}`, note: "Half the sphere's surface." },
      { math: md`\pi(${rad})^2 = ${piTex(rad * rad)}`, note: "The flat face is a circle of the same radius." },
      { math: md`${piTex(2 * rad * rad)} + ${piTex(rad * rad)} = ${piTex(3 * rad * rad)}`, note: "" },
    ],
  };
};

const saMissingDimension: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const k = r.int(1, 10);
    const S = 4 * k * k;
    return {
      prompt: md`Solve $4\pi r^2 = ${S}\pi$ to find the radius $r$ of a sphere with surface area $${S}\pi$. Give the positive solution.`,
      answer: String(k),
      hint: md`Divide by $4\pi$, then take the square root.`,
      solution: [
        { math: md`r^2 = \frac{${S}\pi}{4\pi} = ${k * k}`, note: md`Divide both sides by $4\pi$.` },
        { math: md`r = ${k}`, note: md`The positive square root, since $r$ is a length.` },
      ],
    };
  }
  if (kind === 1) {
    const rad = r.int(1, 8);
    const h = r.int(1, 12);
    const S = 2 * rad * (rad + h);
    return {
      prompt: md`The closed cylinder has total surface area $${S}\pi$. Find its height $h$.`,
      figure: cylinderFig(rad, h, { r: rad, h: "h" }),
      answer: String(h),
      verify: [`2 pi (${rad})^2 + 2 pi (${rad}) h = ${S} pi`],
      hint: md`$S = 2\pi r^2 + 2\pi r h$, so $2\pi(${rad})^2 + 2\pi(${rad})h = ${S}\pi$. Work out $2\pi(${rad})^2$ and move it to the other side.`,
      solution: [
        { math: md`2\pi(${rad})^2 + 2\pi(${rad})h = ${S}\pi`, note: "Two circles plus the curved side." },
        { math: md`${piTex(2 * rad * rad)} + ${piTex(2 * rad)} h = ${S}\pi`, note: "Simplify the known parts." },
        { math: md`${piTex(2 * rad)} h = ${piTex(S - 2 * rad * rad)}`, note: md`Subtract $${piTex(2 * rad * rad)}$: that's the two circles' share. What's left is the curved side.` },
        { math: md`h = ${h}`, note: md`Divide both sides by $${piTex(2 * rad)}$.` },
      ],
    };
  }
  if (kind === 2) {
    const l = r.int(2, 10);
    let w = r.int(2, 9);
    while (w === l) w = r.int(2, 9);
    const h = r.int(2, 10);
    const S = 2 * (l * w + l * h + w * h);
    return {
      prompt: md`Solve $2(${l} \cdot ${w} + ${l}h + ${w}h) = ${S}$ to find the height $h$ of a closed box that is ${l} by ${w} and has surface area ${S}.`,
      answer: String(h),
      hint: "Divide by 2 first, then collect the h-terms.",
      solution: [
        { math: md`${l * w} + ${l}h + ${w}h = ${S / 2}`, note: "Divide both sides by 2." },
        { math: md`${l + w}h = ${S / 2 - l * w}`, note: md`Combine like terms and subtract ${l * w}.` },
        { math: md`h = ${h}`, note: md`Divide by ${l + w}.` },
      ],
    };
  }
  if (kind === 3) {
    const rad = r.int(1, 8);
    const l = rad + r.int(1, 9);
    const S = rad * (rad + l);
    return {
      prompt: md`The cone has total surface area $${S}\pi$, base included. Find its slant height $x$.`,
      figure: coneFig(rad, Math.sqrt(l * l - rad * rad), { r: rad, l: "x" }),
      answer: String(l),
      verify: [`pi (${rad})^2 + pi (${rad}) x = ${S} pi`],
      hint: md`Base plus lateral area: $\pi r^2 + \pi r x = ${S}\pi$, where $x$ is the slant height. Subtract the base's area, $\pi(${rad})^2$, then divide by $${piTex(rad)}$.`,
      solution: [
        { math: md`\pi(${rad})^2 + \pi(${rad})x = ${S}\pi`, note: md`$S = \pi r^2 + \pi r x$, with $x$ the slant height.` },
        { math: md`${piTex(rad)} x = ${S}\pi - ${piTex(rad * rad)} = ${piTex(S - rad * rad)}`, note: "Subtract the base." },
        { math: md`x = ${l}`, note: md`Divide by $${piTex(rad)}$.` },
      ],
    };
  }
  const s = r.int(2, 12);
  return {
    prompt: md`Solve $6s^2 = ${6 * s * s}$ to find the edge length $s$ of a cube with surface area ${6 * s * s}. Give the positive solution.`,
    answer: String(s),
    hint: "A cube has 6 congruent square faces. Divide by 6, then take the square root.",
    solution: [
      { math: md`s^2 = ${s * s}`, note: "Divide both sides by 6: that's the area of one face." },
      { math: md`s = ${s}`, note: "Positive square root." },
    ],
  };
};

// ── Lesson 4: Volume and Cavalieri's Principle ──────────────────────────────

const prismCylinderVolume: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const [l, w, h] = [r.int(2, 12), r.int(2, 9), r.int(2, 10)];
    return {
      prompt: md`Find the volume of the box. ${NO_UNITS}`,
      figure: boxFig(l, w, h),
      answer: String(l * w * h),
      verify: [`V = ${l} * ${w} * ${h}`],
      hint: "One layer of unit cubes covers the base. How many layers are there?",
      solution: [
        { math: md`B = ${l} \cdot ${w} = ${l * w}`, note: "The bottom layer holds this many unit cubes." },
        { math: md`V = Bh = ${l * w} \cdot ${h} = ${l * w * h}`, note: md`There are ${h} layers.` },
      ],
    };
  }
  if (kind === 1) {
    const a = r.int(2, 9);
    let b = r.int(2, 9);
    if ((a * b) % 2) b += 1;
    const L = r.int(2, 12);
    const B = (a * b) / 2;
    return {
      prompt: md`The prism's bases are right triangles. Find its volume. ${NO_UNITS}`,
      figure: triPrismFig(a, b, L),
      answer: String(B * L),
      verify: [`V = (1/2)(${a})(${b})(${L})`],
      hint: md`$V = Bh$, where $B$ is the area of the triangular base.`,
      solution: [
        { math: md`B = \frac{1}{2}(${a})(${b}) = ${B}`, note: "The legs are the base and height of the triangle." },
        { math: md`V = Bh = ${B} \cdot ${L} = ${B * L}`, note: "" },
      ],
    };
  }
  const rad = r.int(1, 9);
  const h = r.int(1, 12);
  if (kind === 2) {
    return {
      prompt: md`Find the volume of the cylinder. ${piForm(piText(rad * rad * h))}`,
      figure: cylinderFig(rad, h, { r: rad, h }),
      answer: piText(rad * rad * h),
      verify: [`V = pi (${rad})^2 (${h})`],
      hint: md`$V = Bh$ with a circular base, $B = \pi r^2$.`,
      solution: [
        { math: md`B = \pi(${rad})^2 = ${piTex(rad * rad)}`, note: "Area of the base." },
        { math: md`V = Bh = ${piTex(rad * rad)} \cdot ${h} = ${piTex(rad * rad * h)}`, note: "" },
      ],
    };
  }
  // The leaning solids get their own height, at least 3, and a slanted length at most about a third
  // longer, so they lean by no more than about 40 degrees and the drawing stays readable.
  const ht = r.int(3, 12);
  const slant = ht + r.int(1, Math.max(1, Math.round(ht / 3)));
  if (kind === 3) {
    return {
      prompt: md`Find the volume of the oblique (leaning) cylinder. The vertical dashed segment is its height, measured straight up from one base to the other. ${piForm(piText(rad * rad * ht))}`,
      figure: obliqueCylinderFig(rad, ht, slant),
      answer: piText(rad * rad * ht),
      verify: [`V = pi (${rad})^2 (${ht})`],
      hint: "Cavalieri: every horizontal slice is the same circle as the base, just shifted sideways. Which length is the height?",
      solution: [
        { math: md`B = \pi(${rad})^2 = ${piTex(rad * rad)}`, note: "Every cross-section is a circle of this area." },
        { math: md`V = Bh = ${piTex(rad * rad)} \cdot ${ht} = ${piTex(rad * rad * ht)}`, note: md`By Cavalieri's Principle it matches an upright cylinder with the same base and height. The slanted length ${slant} is not the height.` },
      ],
    };
  }
  const s = r.int(2, 10);
  return {
    prompt: md`Find the volume of the oblique prism. Its bases are squares, and the vertical dashed segment is its height, perpendicular to the bases. ${NO_UNITS}`,
    figure: obliquePrismFig(s, ht, slant),
    answer: String(s * s * ht),
    verify: [`V = ${s}^2 (${ht})`],
    hint: "Cavalieri: lean a stack of square cards and its volume stays the same. Use the perpendicular height.",
    solution: [
      { math: md`B = ${s}^2 = ${s * s}`, note: "Every cross-section is a square of this area." },
      { math: md`V = Bh = ${s * s} \cdot ${ht} = ${s * s * ht}`, note: md`The slanted edge, ${slant}, is longer than the height and isn't used.` },
    ],
  };
};

const pyramidConeSphereVolume: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const square = r.next() < 0.5;
    let l = r.int(2, 10);
    let w = square ? l : r.int(2, 9);
    // At most 3 times the longer base side, so the pyramid isn't a needle.
    let h = r.int(2, Math.min(12, 3 * Math.max(l, w)));
    if ((l * w * h) % 3) h = 3 * r.int(1, Math.min(4, Math.max(l, w)));
    const V = (l * w * h) / 3;
    return {
      prompt: md`Find the volume of the pyramid. Its base is ${square ? "a square" : "a rectangle"}, and the vertical dashed segment is its height. ${NO_UNITS}`,
      // The longer side goes in front, so the apex doesn't sit right above a front corner.
      figure: pyramidFig(Math.max(l, w), Math.min(l, w), h, { l: Math.max(l, w), w: square ? undefined : Math.min(l, w), h }),
      answer: String(V),
      verify: [`V = (1/3)(${l})(${w})(${h})`],
      hint: md`$V = \frac{1}{3}Bh$: a third of the prism with the same base and height.`,
      solution: [
        { math: md`B = ${l} \cdot ${w} = ${l * w}`, note: "Area of the base." },
        { math: md`V = \frac{1}{3}Bh = \frac{1}{3}(${l * w})(${h}) = ${V}`, note: "" },
      ],
    };
  }
  if (kind === 1) {
    const rad = r.int(1, 9);
    const h = 3 * r.int(1, 5);
    return {
      prompt: md`Find the volume of the cone. ${piForm(piText((rad * rad * h) / 3))}`,
      figure: coneFig(rad, h, { r: rad, h }),
      answer: piText((rad * rad * h) / 3),
      verify: [`V = (1/3) pi (${rad})^2 (${h})`],
      hint: md`$V = \frac{1}{3}\pi r^2 h$: a third of the cylinder with the same base and height.`,
      solution: [
        { math: md`B = \pi(${rad})^2 = ${piTex(rad * rad)}`, note: "" },
        { math: md`V = \frac{1}{3}(${piTex(rad * rad)})(${h}) = ${piTex((rad * rad * h) / 3)}`, note: "" },
      ],
    };
  }
  if (kind === 2) {
    const [a0, b0, c] = r.pick(TRIPLES);
    const [rad, h] = r.next() < 0.5 ? [a0, b0] : [b0, a0];
    const V = piFrac(rad * rad * h, 3);
    return {
      prompt: md`Find the volume of the cone. The label on its side is the slant height. ${piFracForm(V.text)}`,
      figure: coneFig(rad, h, { r: rad, h: "h", l: c }),
      answer: V.text,
      verify: [`V = (1/3) pi (${rad})^2 sqrt(${c}^2 - ${rad}^2)`],
      hint: md`Volume needs the height, not the slant height. Radius, height and slant height form a right triangle.`,
      solution: [
        { math: md`h = \sqrt{${c}^2 - ${rad}^2} = \sqrt{${c * c - rad * rad}} = ${h}`, note: "Pythagorean Theorem, with the slant height as the hypotenuse." },
        { math: md`V = \frac{1}{3}\pi(${rad})^2(${h}) = ${V.tex}`, note: "" },
      ],
    };
  }
  const rad = r.int(1, 9);
  if (kind === 3) {
    const V = piFrac(4 * rad ** 3, 3);
    return {
      prompt: md`Find the volume of the sphere. The labeled segment is a radius. ${piFracForm(V.text)}`,
      figure: sphereFig(rad),
      answer: V.text,
      verify: [`V = (4/3) pi (${rad})^3`],
      hint: md`$V = \frac{4}{3}\pi r^3$. Cube the radius first.`,
      solution: [
        { math: md`${rad}^3 = ${rad ** 3}`, note: "" },
        { math: md`V = \frac{4}{3}\pi(${rad ** 3}) = ${V.tex}`, note: "Two hemispheres, each a cylinder minus a cone." },
      ],
    };
  }
  const V = piFrac(2 * rad ** 3, 3);
  return {
    prompt: md`Find the volume of the solid hemisphere (half a ball). ${piFracForm(V.text)}`,
    figure: hemisphereFig(rad),
    answer: V.text,
    verify: [`V = (1/2)(4/3) pi (${rad})^3`],
    hint: md`Half of $\frac{4}{3}\pi r^3$. Or: cylinder $\pi r^2 \cdot r$ minus cone $\frac{1}{3}\pi r^2 \cdot r$.`,
    solution: [
      { math: md`\pi r^3 - \frac{1}{3}\pi r^3 = \frac{2}{3}\pi r^3`, note: "Cavalieri: the hemisphere matches a cylinder with a cone removed." },
      { math: md`\frac{2}{3}\pi(${rad})^3 = \frac{2}{3}\pi(${rad ** 3}) = ${V.tex}`, note: "" },
    ],
  };
};

const volumeMissingDimension: Generator = (r) => {
  const kind = r.int(0, 4);
  if (kind === 0) {
    const rad = r.int(1, 8);
    const h = r.int(1, 12);
    const V = rad * rad * h;
    return {
      prompt: md`The cylinder has volume $${piTex(V)}$. Find its height $h$.`,
      figure: cylinderFig(rad, h, { r: rad, h: "h" }),
      answer: String(h),
      verify: [`pi (${rad})^2 h = ${V} pi`],
      hint: md`$V = \pi r^2 h$, so $\pi(${rad})^2 h = ${piTex(V)}$. Divide both sides by $\pi(${rad})^2 = ${piTex(rad * rad)}$.`,
      solution: [
        { math: md`\pi(${rad})^2 h = ${piTex(rad * rad)} h = ${piTex(V)}`, note: "The base area times the height." },
        { math: md`h = \frac{${piTex(V)}}{${piTex(rad * rad)}} = ${h}`, note: md`Divide both sides by $${piTex(rad * rad)}$.` },
      ],
    };
  }
  if (kind === 1) {
    const s = r.int(2, 10);
    // At most 3 times the base edge, so the pyramid isn't a needle.
    let h = r.int(2, Math.min(15, 3 * s));
    if ((s * s * h) % 3) h = 3 * r.int(1, Math.min(5, s));
    const V = (s * s * h) / 3;
    return {
      prompt: md`Solve $\frac{1}{3}(${s})^2 h = ${V}$ to find the height $h$ of the square pyramid, which has volume ${V}.`,
      figure: pyramidFig(s, s, h, { l: s, h: "h" }),
      answer: String(h),
      hint: "Multiply both sides by 3, then divide by the base area.",
      solution: [
        { math: md`${s * s}h = ${3 * V}`, note: "Multiply both sides by 3." },
        { math: md`h = \frac{${3 * V}}{${s * s}} = ${h}`, note: md`Divide by the base area, ${s * s}.` },
      ],
    };
  }
  if (kind === 2) {
    const k = r.int(2, 6);
    const V = piFrac(4 * k ** 3, 3);
    const n = (4 * k ** 3) / gcd(4 * k ** 3, 3);
    const d = 3 / gcd(4 * k ** 3, 3);
    const rhs = d === 1 ? md`${n}\pi` : md`\frac{${n}}{${d}}\pi`;
    return {
      prompt: md`Solve $\frac{4}{3}\pi r^3 = ${rhs}$ to find the radius $r$ of a sphere with volume $${V.tex}$.`,
      answer: String(k),
      hint: md`Multiply both sides by $\frac{3}{4}$ and divide by $\pi$. Then take the cube root.`,
      solution: [
        { math: md`r^3 = ${k ** 3}`, note: md`Multiply by $\frac{3}{4}$ and divide by $\pi$.` },
        { math: md`r = ${k}`, note: md`$${k}^3 = ${k ** 3}$, and no other real number cubes to ${k ** 3}.` },
      ],
    };
  }
  if (kind === 3) {
    const rad = r.int(1, 8);
    const h = 3 * r.int(1, 4);
    const V = (rad * rad * h) / 3;
    return {
      prompt: md`The cone has volume $${piTex(V)}$. Find its radius $r$.`,
      figure: coneFig(rad, h, { r: "r", h }),
      answer: String(rad),
      verify: [`(1/3) pi r^2 (${h}) = ${V} pi`],
      hint: md`$V = \frac{1}{3}\pi r^2 h$, so $\frac{1}{3}\pi r^2(${h}) = ${piTex(V)}$. Simplify $\frac{1}{3}(${h})$, divide by $\pi$ and by that number, then take the square root.`,
      solution: [
        { math: md`\frac{1}{3}\pi r^2(${h}) = ${piTex(V)}`, note: md`$V = \frac{1}{3}\pi r^2 h$ with $h = ${h}$.` },
        { math: md`${h / 3 === 1 ? "" : h / 3}\pi r^2 = ${piTex(V)}`, note: md`$\frac{1}{3} \cdot ${h} = ${h / 3}$.` },
        { math: md`r^2 = ${rad * rad}`, note: md`Divide both sides by $${piTex(h / 3)}$.` },
        { math: md`r = ${rad}`, note: "Positive square root." },
      ],
    };
  }
  const s = r.int(2, 12);
  return {
    prompt: md`Solve $s^3 = ${s ** 3}$ to find the edge length $s$ of a cube with volume ${s ** 3}.`,
    answer: String(s),
    hint: "Which number times itself three times gives the volume?",
    solution: [{ math: md`s = \sqrt[3]{${s ** 3}} = ${s}`, note: md`$${s} \cdot ${s} \cdot ${s} = ${s ** 3}$.` }],
  };
};

// ── Lessons ─────────────────────────────────────────────────────────────────

export const unit8: Unit = {
  title: "Area and Volume",
  lessons: [
    {
      id: "area-from-first-principles",
      title: "Area from first principles",
      summary: "Area postulates, then the rectangle, parallelogram, triangle, trapezoid and regular polygon formulas, each derived from the one before.",
      blocks: [
        {
          kind: "text",
          body: md`You have used $A = lw$ for years. Where does it come from, and why is a triangle "half base times height"? This lesson starts from four plain assumptions about area and builds every formula from them. Each new shape gets cut up and rearranged into a shape we already understand.`,
        },
        {
          kind: "key",
          title: "Area postulates",
          body: md`The **area** of a region is a nonnegative number that measures how much of the plane it covers.

- **Unit square:** a square with side 1 has area 1.
- **Congruence:** congruent figures have equal areas.
- **Area addition** (the Area Addition Postulate): if a region is cut into pieces that don't overlap, its area is the sum of the pieces' areas.
- **Rectangle:** a rectangle with base $b$ and height $h$ has area $bh$.

We write $\text{Area}(ABCD)$ for the area of a figure $ABCD$.`,
        },
        { kind: "diagram", ...unitSquares() },
        {
          kind: "why",
          title: "Why the rectangle formula is a fair assumption",
          body: md`For whole-number sides you can count: a 5 by 3 rectangle holds 3 rows of 5 unit squares, so by area addition its area is 15.

For fractions, cut the unit square into an $n \times n$ grid. The $n^2$ small squares are congruent and fill the unit square, so each has area $\frac{1}{n^2}$. A $\frac{2}{3}$ by $\frac{1}{2}$ rectangle is exactly 4 columns by 3 rows of sixth-size squares, so its area is $\frac{12}{36} = \frac{1}{3} = \frac{2}{3} \cdot \frac{1}{2}$. The same counting gives $bh$ for any fractions.

Lengths like $\sqrt{2}$ can't be counted this way. Proving $bh$ for them needs limits, so we take the rectangle formula as a postulate. It is the only area formula we assume: every other area formula in this lesson is proved from it.`,
        },
        {
          kind: "text",
          body: md`Any side can be the **base**. The **height** that goes with it is the perpendicular distance from the base's line to the opposite side or vertex. The height is usually not a side of the figure.

A parallelogram leans, so it isn't a rectangle. But cut a right triangle off one end and slide it to the other end, and it becomes one.`,
        },
        { kind: "diagram", ...cutAndSlide() },
        {
          kind: "proof",
          title: "Area of a parallelogram",
          given: md`Parallelogram $ABCD$ with base $AB = b$. $\overline{DE} \perp \overleftrightarrow{AB}$ and $\overline{CF} \perp \overleftrightarrow{AB}$, with $E$ between $A$ and $B$ and $B$ between $E$ and $F$, and $DE = h$.`,
          prove: md`$\text{Area}(ABCD) = bh$`,
          steps: [
            { statement: md`$AD = BC$`, reason: "Opposite sides of a parallelogram are congruent" },
            { statement: md`$\angle AED = \angle BFC = 90^\circ$`, reason: "Definition of perpendicular" },
            { statement: md`$\angle DAE = \angle CBF$`, reason: md`Corresponding Angles Postulate ($\overline{AD} \parallel \overline{BC}$, transversal $\overleftrightarrow{AB}$)` },
            { statement: md`$\triangle AED \cong \triangle BFC$`, reason: "AAS" },
            { statement: md`$\text{Area}(\triangle AED) = \text{Area}(\triangle BFC)$ and $AE = BF$`, reason: "Congruent figures have equal areas; CPCTC" },
            { statement: md`$\text{Area}(ABCD) = \text{Area}(\triangle AED) + \text{Area}(EBCD)$`, reason: "Area addition" },
            { statement: md`$\text{Area}(EFCD) = \text{Area}(EBCD) + \text{Area}(\triangle BFC)$`, reason: "Area addition" },
            { statement: md`$\text{Area}(ABCD) = \text{Area}(EFCD)$`, reason: "Substitution (steps 5, 6, 7)" },
            { statement: md`$EF = EB + BF = EB + AE = AB = b$`, reason: "Segment Addition Postulate; substitution" },
            { statement: md`$EFCD$ is a rectangle with base $b$ and height $h$, so $\text{Area}(EFCD) = bh$`, reason: md`Its angles at $E$ and $F$ are right, and $\overline{DC} \parallel \overline{EF}$; rectangle postulate` },
            { statement: md`$\text{Area}(ABCD) = bh$`, reason: "Substitution" },
          ],
        },
        {
          kind: "text",
          body: md`(If a parallelogram leans so far that $E$ lands beyond $B$, this proof doesn't apply as written, but the answer is still $bh$. We show why after the triangle.)

A triangle is half of a parallelogram. Take a copy of the triangle, turn it halfway around the midpoint of one side, and the two copies fit together.`,
        },
        { kind: "diagram", ...doubledTriangle() },
        {
          kind: "proof",
          title: "Area of a triangle",
          given: md`$\triangle ABC$ with base $AB = b$ and height $h$ from $C$.`,
          prove: md`$\text{Area}(\triangle ABC) = \frac{1}{2}bh$`,
          steps: [
            { statement: md`Draw the line through $C$ parallel to $\overline{AB}$ and the line through $B$ parallel to $\overline{AC}$. They meet at $D$.`, reason: "Parallel Postulate" },
            { statement: md`$ABDC$ is a parallelogram`, reason: "Both pairs of opposite sides are parallel" },
            { statement: md`$\triangle ABC \cong \triangle DCB$`, reason: "A diagonal splits a parallelogram into two congruent triangles" },
            { statement: md`$\text{Area}(ABDC) = \text{Area}(\triangle ABC) + \text{Area}(\triangle DCB) = 2 \cdot \text{Area}(\triangle ABC)$`, reason: "Area addition; congruent figures have equal areas" },
            { statement: md`$\text{Area}(ABDC) = bh$`, reason: md`Area of a parallelogram: base $AB$, and its height is the distance from $C$ to $\overleftrightarrow{AB}$` },
            { statement: md`$2 \cdot \text{Area}(\triangle ABC) = bh$, so $\text{Area}(\triangle ABC) = \frac{1}{2}bh$`, reason: "Substitution; Division Property of Equality" },
          ],
        },
        {
          kind: "why",
          title: "When the height falls outside the base",
          body: md`Step 5 uses the parallelogram proof, which needs the foot of the height to land on the base. Say instead that the foot $H$ of the height from $C$ lands beyond $B$, as when the third vertex is $(11, 5)$ and the base runs from $(0, 0)$ to $(8, 0)$. (Beyond $A$ works the same way with the letters swapped.)

A right triangle with legs $x$ and $h$ is half of an $x$ by $h$ rectangle, because a diagonal splits the rectangle into two congruent triangles. So its area is $\frac{1}{2}xh$.

Now $\overline{CB}$ cuts the right triangle $\triangle AHC$ into $\triangle ABC$ and the right triangle $\triangle BHC$. By area addition,

$$\text{Area}(\triangle ABC) = \frac{1}{2}(AH)h - \frac{1}{2}(BH)h = \frac{1}{2}(AH - BH)h = \frac{1}{2}bh,$$

because $AH = AB + BH$ (Segment Addition Postulate), so $AH - BH = b$.

This also settles a parallelogram that leans far: the diagonal $\overline{BD}$ cuts parallelogram $ABCD$ into two congruent triangles, each with base $b$ and height $h$, so its area is $2 \cdot \frac{1}{2}bh = bh$.`,
        },
        { kind: "diagram", ...doubledTrapezoid() },
        {
          kind: "why",
          title: md`Why a trapezoid has area $\frac{1}{2}(b_1 + b_2)h$`,
          body: md`A **trapezoid** has one pair of parallel sides, the bases $b_1$ and $b_2$; its height $h$ is the distance between them. Turn a copy halfway around the midpoint of the leg $\overline{BC}$, as in the picture. The copy's angle at $B$ equals the original's angle at $C$, and $\angle ABC + \angle BCD = 180^\circ$ (Same-Side Interior Angles Theorem, since $\overline{AB} \parallel \overline{DC}$). So the two angles at $B$ form a straight angle, and the bottom edges join into one segment of length $b_1 + b_2$. The top edges join the same way at $C$. The two copies form a parallelogram with base $b_1 + b_2$ and height $h$. So one trapezoid is half of that:

$$A = \frac{1}{2}(b_1 + b_2)h.$$

A second way to see it: a diagonal cuts the trapezoid into two triangles, both with height $h$, one with base $b_1$ and one with base $b_2$. Their areas add to $\frac{1}{2}b_1h + \frac{1}{2}b_2h = \frac{1}{2}(b_1 + b_2)h$, by the Distributive Property.`,
        },
        {
          kind: "example",
          title: "A trapezoid and a kite",
          problem: md`(a) Find the area of a trapezoid with bases 7 and 13 and height 5. (b) A kite has perpendicular diagonals of lengths 10 and 6. Find its area.`,
          steps: [
            { math: md`\frac{1}{2}(7 + 13)(5) = \frac{1}{2}(20)(5) = 50`, note: "(a) Add the bases first." },
            { math: md`\frac{1}{2}(10)x + \frac{1}{2}(10)y = \frac{1}{2}(10)(x + y)`, note: md`(b) A kite's diagonals are perpendicular (Unit 6). The 10-diagonal cuts the kite into two triangles with base 10. Their heights $x$ and $y$ are the two pieces of the other diagonal.` },
            { math: md`\frac{1}{2}(10)(6) = 30`, note: md`Since $x + y = 6$. The same argument works for any quadrilateral whose diagonals cross at right angles, such as a rhombus or a square: its area is $\frac{1}{2}d_1 d_2$.` },
          ],
        },
        {
          kind: "text",
          body: md`A **regular polygon** has all sides congruent and all angles congruent. Its **center** is the center of the circle through all its vertices, and its **apothem** $a$ is the perpendicular distance from the center to a side.`,
        },
        { kind: "diagram", ...hexagonApothem() },
        {
          kind: "proof",
          title: "Area of a regular polygon",
          given: md`A regular $n$-gon with center $O$, side $s$, apothem $a$ and perimeter $P = ns$.`,
          prove: md`$\text{Area} = \frac{1}{2}aP$`,
          steps: [
            { statement: md`Segments from $O$ to the vertices cut the polygon into $n$ triangles.`, reason: "Area addition: the area is the sum of the triangles' areas" },
            { statement: "The $n$ triangles are congruent.", reason: md`SSS: two sides of each are radii of the circle through the vertices, and the third is a side $s$` },
            { statement: md`Each triangle has base $s$ and height $a$, so area $\frac{1}{2}sa$.`, reason: "The apothem is perpendicular to the side; area of a triangle" },
            { statement: md`$\text{Area} = n \cdot \frac{1}{2}sa = \frac{1}{2}a(ns) = \frac{1}{2}aP$`, reason: "Substitution; commutative and associative properties; $P = ns$" },
          ],
        },
        {
          kind: "example",
          title: "A regular hexagon",
          problem: md`Find the area of a regular hexagon with side 6.`,
          steps: [
            { math: md`\text{central angle} = \frac{360^\circ}{6} = 60^\circ`, note: "Each of the 6 triangles is isosceles with a $60^\circ$ apex, so its base angles are $60^\circ$ too: the triangles are equilateral." },
            { math: md`a = 3\sqrt{3}`, note: md`The apothem splits one triangle into two 30-60-90 triangles (Unit 5). The short leg is 3, so the long leg is $3\sqrt{3}$.` },
            { math: md`A = \frac{1}{2}aP = \frac{1}{2}(3\sqrt{3})(36) = 54\sqrt{3}`, note: md`$P = 6 \cdot 6 = 36$.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A trapezoid has bases 9 and 15 and height 4. Find its area.`,
          answer: "48",
          explain: md`$\frac{1}{2}(9 + 15)(4) = \frac{1}{2}(24)(4) = 48$.`,
        },
        {
          kind: "check",
          prompt: md`A triangle has vertices $(0, 0)$, $(8, 0)$ and $(11, 5)$. Find its area.`,
          answer: "20",
          explain: md`The base runs from $(0, 0)$ to $(8, 0)$, length 8. The height is the vertical distance from $(11, 5)$ to the base's line, 5, even though that vertex isn't above the base. $\frac{1}{2}(8)(5) = 20$.`,
        },
      ],
      practice: [basicAreas, missingDimension, polygonsAndComposites],
    },
    {
      id: "circumference-and-area-of-circles",
      title: "Circumference and area of circles",
      summary: "Why C/d is the same for every circle, pi as that ratio, and the area of a circle by slicing it into a near-parallelogram.",
      blocks: [
        {
          kind: "text",
          body: md`Unit 7 measured arcs with $C = 2\pi r$, taking on trust that $\frac{C}{d}$ is the same number for every circle. This lesson proves it, then finds the area. A circle has no straight sides, so none of the cutting tricks from the last lesson apply directly. Instead we squeeze it between polygons. Draw a regular polygon inside the circle with its vertices on the circle. As the number of sides grows, the polygon hugs the circle more and more tightly. The **circumference** of the circle is the number the polygons' perimeters approach.`,
        },
        { kind: "diagram", ...inscribedPolygon() },
        {
          kind: "why",
          title: "Why every circle has the same ratio",
          body: md`All circles have the same shape; only the size changes. Double the radius and every polygon inside doubles too: each of its sides doubles, so the perimeter doubles. Since that's true for every polygon, the circumference doubles as well. So circumference and diameter grow in step, and their ratio never changes. The proof below makes this exact with similar triangles.`,
        },
        {
          kind: "proof",
          title: "C/d is the same for all circles",
          given: md`Two circles with centers $O$ and $O'$ and radii $r$ and $R$. In each, a regular $n$-gon with its vertices on the circle; $\overline{PQ}$ and $\overline{P'Q'}$ are sides.`,
          prove: md`$\frac{C}{d} = \frac{C'}{d'}$`,
          steps: [
            { statement: md`$\angle POQ = \angle P'O'Q' = \frac{360^\circ}{n}$`, reason: "The $n$ central angles of a regular $n$-gon are congruent and fill the full turn" },
            { statement: md`$\frac{OP}{O'P'} = \frac{OQ}{O'Q'} = \frac{r}{R}$`, reason: "All four segments are radii" },
            { statement: md`$\triangle POQ \sim \triangle P'O'Q'$`, reason: "SAS Similarity Theorem" },
            { statement: md`$\frac{PQ}{P'Q'} = \frac{r}{R}$`, reason: "Corresponding sides of similar triangles are proportional" },
            { statement: md`$\frac{n \cdot PQ}{n \cdot P'Q'} = \frac{r}{R}$: the perimeters are in ratio $r : R$`, reason: "Multiply top and bottom by $n$" },
            { statement: md`$\frac{C}{C'} = \frac{r}{R} = \frac{2r}{2R} = \frac{d}{d'}$`, reason: "Step 5 holds for every $n$, and the perimeters approach the circumferences" },
            { statement: md`$\frac{C}{d} = \frac{C'}{d'}$`, reason: md`Multiply both sides of step 6 by $\frac{C'}{d}$` },
          ],
        },
        {
          kind: "key",
          title: "Pi and the circumference",
          body: md`Since the ratio is the same for every circle, it gets a name: $\pi$ (pi) is **circumference divided by diameter**. Then, because $d = 2r$:

$$C = \pi d = 2\pi r.$$

$\pi = 3.14159\ldots$ is not a fraction or a repeating decimal, so exact answers keep the symbol: a circle of radius 5 has circumference $10\pi$.`,
        },
        {
          kind: "why",
          title: "Why pi is between 3 and 4",
          body: md`A regular hexagon inside a circle of radius $r$ is made of 6 equilateral triangles, so each side is $r$ and the perimeter is $6r = 3d$. The circle bulges outside the hexagon, so $C > 3d$, and $\pi > 3$.

A square around the circle has side $d$ and perimeter $4d$. The circle fits inside it, so $C < 4d$, and $\pi < 4$. Archimedes pushed this to 96-sided polygons and found $3\frac{10}{71} < \pi < 3\frac{1}{7}$.`,
        },
        {
          kind: "text",
          body: md`**The area of a circle.** Cut the circle into equal sectors like a pizza. Lay them in a row, alternating point-down and point-up. The pieces are only moved, so the area doesn't change.`,
        },
        { kind: "diagram", ...slicedCircle(8, 3) },
        { kind: "diagram", ...unrolledCircle(8, 3, md`The 8 sectors in a row. The top edge is the blue arcs, half the circumference: $\pi r$. The bottom edge is the orange arcs, also $\pi r$. The slanted ends are radii.`) },
        { kind: "diagram", ...unrolledCircle(24, 3, md`With 24 sectors the bumps flatten and the ends stand up straighter. The strip is very nearly a parallelogram, in fact nearly a rectangle, with base $\pi r$ and height $r$.`) },
        {
          kind: "proof",
          title: "Area of a circle",
          given: md`A circle with radius $r$, so circumference $2\pi r$.`,
          prove: md`$\text{Area} = \pi r^2$`,
          steps: [
            { statement: md`Cut the circle into $2n$ congruent sectors and arrange them in a strip, alternating up and down.`, reason: "Area addition and congruence: the strip has the same area as the circle, for every $n$" },
            { statement: md`The strip's top edge is $n$ arcs, half the circumference: $\pi r$. So is the bottom.`, reason: md`The $2n$ arcs together make up the circumference $2\pi r$` },
            { statement: md`As $n$ grows, the strip approaches a rectangle with base $\pi r$ and height $r$.`, reason: "The arcs flatten toward straight segments, and the slanted ends (radii, length $r$) approach vertical" },
            { statement: md`The difference between the strip's area and $\pi r \cdot r$ shrinks toward 0.`, reason: "Area of a rectangle; the leftover slivers get thinner without bound" },
            { statement: md`$\text{Area} = \pi r \cdot r = \pi r^2$`, reason: md`The area is one fixed number, and it is closer to $\pi r^2$ than any positive amount, so it equals $\pi r^2$` },
          ],
        },
        {
          kind: "why",
          title: "Why the same pi shows up in the area",
          body: md`The rectangle's base is half the circumference, and that is where $\pi$ comes from. The area formula isn't a new mystery number: it is the circumference formula in disguise, $A = \frac{1}{2} C r$. Compare a regular polygon, $A = \frac{1}{2}aP$: the apothem becomes the radius and the perimeter becomes the circumference.`,
        },
        { kind: "diagram", ...sectorFigure() },
        {
          kind: "key",
          title: "Sectors",
          body: md`A **sector** is the region between two radii and their arc. A sector with central angle $\theta$ is $\frac{\theta}{360}$ of the whole circle, the same fraction that gave arc length in Unit 7, so

$$\text{Area of sector} = \frac{\theta}{360} \cdot \pi r^2.$$

This works because equal central angles cut off congruent sectors: twelve $30^\circ$ sectors are congruent and fill the circle, so each has $\frac{1}{12}$ of the area.`,
        },
        {
          kind: "example",
          title: "From circumference to area",
          problem: md`A circle has circumference $14\pi$. Find its area, and the area of a $90^\circ$ sector of it.`,
          steps: [
            { math: md`2\pi r = 14\pi \;\Rightarrow\; r = 7`, note: md`Divide both sides by $2\pi$.` },
            { math: md`A = \pi(7)^2 = 49\pi`, note: "Square the radius." },
            { math: md`\frac{90}{360} \cdot 49\pi = \frac{49\pi}{4}`, note: md`A $90^\circ$ sector is a quarter of the circle.` },
          ],
        },
        {
          kind: "check",
          prompt: md`A circle has diameter 18. Find its area. Give an exact answer in terms of $\pi$.`,
          answer: "81pi",
          explain: md`The radius is 9, so $A = \pi(9)^2 = 81\pi$. Squaring the diameter would give $324\pi$, four times too much.`,
        },
        {
          kind: "check",
          prompt: md`Find the area of a $60^\circ$ sector of a circle with radius 6. Give an exact answer in terms of $\pi$.`,
          answer: "6pi",
          explain: md`$\frac{60}{360} = \frac{1}{6}$ of the circle, and $\frac{1}{6} \cdot 36\pi = 6\pi$.`,
        },
      ],
      practice: [circleBasics, circleBackwards, sectorsAndRegions],
    },
    {
      id: "surface-area",
      title: "Surface area",
      summary: "Unfold solids into nets: prisms and cylinders, pyramids and cones (the sector argument for pi r l), and Archimedes' sphere.",
      blocks: [
        {
          kind: "text",
          body: md`The **surface area** of a solid is the total area of its outside: how much paper it would take to wrap it exactly. Cut along some edges and flatten the surface, and you get a **net**, a flat figure with the same area. So surface area is just area, and the last two lessons already have every tool we need.`,
        },
        {
          kind: "key",
          title: "Prisms and their parts",
          body: md`A **prism** has two congruent, parallel **bases**, joined by **lateral faces** that are parallelograms. In a **right prism** the lateral faces are rectangles, standing straight up. A **cylinder** is the same idea with circular bases.

- **Lateral area** $L$: the area of the sides only.
- **Surface area** $S = L + 2B$, where $B$ is the area of one base.`,
        },
        { kind: "diagram", ...boxNet() },
        {
          kind: "proof",
          title: "Lateral area of a right prism",
          given: md`A right prism with height $h$ whose base has sides $e_1, e_2, \ldots, e_n$ and perimeter $P$.`,
          prove: md`$L = Ph$`,
          steps: [
            { statement: md`Each lateral face is a rectangle with sides $e_k$ and $h$.`, reason: "In a right prism the lateral edges are perpendicular to the bases and have length $h$" },
            { statement: md`$\text{Area of face } k = e_k h$`, reason: "Rectangle postulate" },
            { statement: md`$L = e_1 h + e_2 h + \cdots + e_n h$`, reason: "Area addition" },
            { statement: md`$L = (e_1 + e_2 + \cdots + e_n)h = Ph$`, reason: "Distributive Property; definition of perimeter" },
          ],
        },
        {
          kind: "why",
          title: "Why a box has S = 2(lw + lh + wh)",
          body: md`The net shows six rectangles in three pairs: top and bottom ($lw$ each), front and back ($lh$ each), and the two sides ($wh$ each). Opposite faces are congruent, so $S = 2lw + 2lh + 2wh$.

The same answer comes from $S = Ph + 2B$: the base has $P = 2l + 2w$ and $B = lw$, so $S = (2l + 2w)h + 2lw$. Two routes, one answer.`,
        },
        { kind: "diagram", ...cylinderNet() },
        {
          kind: "why",
          title: md`Why the curved side of a cylinder is $2\pi r h$`,
          body: md`Peel the label off a can and lay it flat: it's a rectangle. Its height is the can's height $h$. Its width is the distance once around the can, the circumference $2\pi r$. So

$$L = 2\pi r h, \qquad S = 2\pi r h + 2\pi r^2.$$

This is $L = Ph$ again, with the circumference playing the part of the perimeter.`,
        },
        {
          kind: "example",
          title: "A triangular prism and a cylinder",
          problem: md`(a) A right prism's bases are right triangles with legs 6 and 8 and hypotenuse 10; the bases are 5 apart. Find its surface area. (b) Find the surface area of a cylinder with radius 3 and height 7.`,
          steps: [
            { math: md`2 \cdot \frac{1}{2}(6)(8) = 48`, note: "(a) The two triangular bases." },
            { math: md`(6 + 8 + 10)(5) = 120`, note: md`Lateral area $Ph$.` },
            { math: md`48 + 120 = 168`, note: "" },
            { math: md`2\pi(3)(7) + 2\pi(3)^2 = 42\pi + 18\pi = 60\pi`, note: "(b) Curved side plus two circles." },
          ],
        },
        {
          kind: "text",
          body: md`A **pyramid** has one base and triangular faces that meet at a point, the **apex**. In a **regular pyramid** the base is a regular polygon and the apex sits directly above its center, so the lateral faces are congruent isosceles triangles. The height of one of those triangles is the **slant height** $\ell$. Each face has area $\frac{1}{2}s\ell$, so the lateral area is $\frac{1}{2}P\ell$.`,
        },
        { kind: "diagram", ...pyramidNet() },
        {
          kind: "text",
          body: md`A **cone** is the circular version: a circular base and an apex. In a **right cone** the apex is directly above the center. Its slant height $\ell$ is the distance from the apex to any point on the rim.`,
        },
        { kind: "diagram", ...coneSide() },
        { kind: "diagram", ...coneNet() },
        {
          kind: "proof",
          title: "Lateral area of a cone",
          given: md`A right cone with radius $r$ and slant height $\ell$.`,
          prove: md`$L = \pi r \ell$`,
          steps: [
            { statement: md`Slit the curved surface along a slant line and flatten it. It becomes a sector of a circle with radius $\ell$.`, reason: md`Every point of the rim is $\ell$ from the apex` },
            { statement: md`The sector's arc has length $2\pi r$.`, reason: "The arc was the rim of the base, a circle of radius $r$" },
            { statement: md`The sector is the fraction $\frac{2\pi r}{2\pi \ell} = \frac{r}{\ell}$ of the full circle of radius $\ell$.`, reason: "Arc length and sector area are both proportional to the central angle" },
            { statement: md`$L = \frac{r}{\ell} \cdot \pi \ell^2$`, reason: "Area of a circle; area of a sector" },
            { statement: md`$L = \pi r \ell$`, reason: md`Simplify: one $\ell$ cancels` },
          ],
        },
        {
          kind: "example",
          title: "A cone from its height",
          problem: md`A cone has radius 5 and height 12. Find its total surface area.`,
          steps: [
            { math: md`\ell = \sqrt{5^2 + 12^2} = \sqrt{169} = 13`, note: "Radius, height and slant height form a right triangle." },
            { math: md`\pi r \ell = \pi(5)(13) = 65\pi`, note: "Lateral area." },
            { math: md`65\pi + \pi(5)^2 = 65\pi + 25\pi = 90\pi`, note: "Add the base." },
          ],
        },
        { kind: "diagram", ...sphereInCylinder() },
        {
          kind: "key",
          title: "Surface area of a sphere",
          body: md`A sphere of radius $r$ has surface area

$$S = 4\pi r^2,$$

exactly four times the area of a circle with the same radius (the cross-section through the center). Archimedes proved it around 225 BC, by showing the sphere has the same area as the curved side of the cylinder that just contains it.`,
        },
        {
          kind: "why",
          title: "Why the sphere matches the cylinder",
          body: md`We state $4\pi r^2$ rather than prove it: a sphere can't be flattened into a net without stretching, and a full proof needs calculus or Archimedes' long argument. Here is his key idea. Slice the sphere and its cylinder with two parallel planes close together. Near the equator the sphere's band goes far around and stands nearly upright, like the cylinder's. Near the poles it goes a shorter way around, but it slants steeply, so it is wider measured along the surface. Those two effects cancel exactly: every band of the sphere has the same area as the band of the cylinder between the same planes. Add up the bands: $S = 2\pi r \cdot 2r = 4\pi r^2$.`,
        },
        {
          kind: "check",
          prompt: md`Find the total surface area of a cylinder with radius 4 and height 6. Give an exact answer in terms of $\pi$.`,
          answer: "80pi",
          explain: md`Curved side $2\pi(4)(6) = 48\pi$, plus two circles $2\pi(4)^2 = 32\pi$: $80\pi$.`,
        },
        {
          kind: "check",
          prompt: md`A square pyramid has base edge 10 and slant height 12. Find its total surface area.`,
          answer: "340",
          explain: md`Base $10^2 = 100$. Four triangles: $4 \cdot \frac{1}{2}(10)(12) = 240$. Total 340.`,
        },
      ],
      practice: [prismCylinderSA, pyramidConeSphereSA, saMissingDimension],
    },
    {
      id: "volume-and-cavalieris-principle",
      title: "Volume and Cavalieri's Principle",
      summary: "Volume postulates and Cavalieri's Principle, then prisms and cylinders (Bh), pyramids and cones (Bh/3), and the sphere from a hemisphere.",
      blocks: [
        {
          kind: "text",
          body: md`**Volume** measures how much space a solid fills, counted in unit cubes. The plan is the same as for area: a few assumptions, then derive everything. One new tool does most of the work. It compares two solids slice by slice.`,
        },
        {
          kind: "key",
          title: "Volume postulates",
          body: md`- **Unit cube:** a cube with edge 1 has volume 1.
- **Congruence:** congruent solids have equal volumes.
- **Volume addition:** the volume of a solid is the sum of the volumes of non-overlapping pieces.
- **Box:** a rectangular box with base area $B$ and height $h$ has volume $Bh$, that is, $V = lwh$.`,
        },
        {
          kind: "why",
          title: "Why a box is base times height",
          body: md`A 4 by 3 by 5 box: the bottom layer holds $4 \cdot 3 = 12$ unit cubes, one for each unit square of the base. There are 5 such layers. So the volume is $12 \cdot 5 = 60$: base area times height. As with rectangles, fractional edges work by cutting the unit cube into small cubes, and we take the formula as a postulate for all lengths.`,
        },
        {
          kind: "key",
          title: "Cavalieri's Principle",
          body: md`Suppose two solids have the same height, and every plane parallel to their bases cuts them in cross-sections of **equal area**. Then the two solids have **equal volume**.

Why believe it? Think of each solid as a stack of very thin cards. If the cards at every height have the same area, the two stacks hold the same amount of material, card for card. Sliding the cards sideways changes the shape of the stack, not how much is in it. We take the principle as a postulate; it can be proved with calculus.`,
        },
        { kind: "diagram", ...coinStacks() },
        {
          kind: "proof",
          title: "Volume of a prism or cylinder",
          given: md`A prism or cylinder, right or oblique, with base area $B$ and height $h$ (the perpendicular distance between the bases).`,
          prove: md`$V = Bh$`,
          steps: [
            { statement: md`Set a box with base $1$ by $B$ and height $h$ on the same plane.`, reason: md`Its base has area $B$` },
            { statement: md`Every cross-section of the prism parallel to the base has area $B$.`, reason: "Each cross-section is the base slid along the lateral edges, a congruent copy" },
            { statement: md`Every cross-section of the box has area $B$.`, reason: md`Each is a 1 by $B$ rectangle` },
            { statement: md`$V_{\text{prism}} = V_{\text{box}}$`, reason: "Cavalieri's Principle (same height, equal cross-sections)" },
            { statement: md`$V_{\text{prism}} = 1 \cdot B \cdot h = Bh$`, reason: "Box postulate; substitution" },
          ],
        },
        {
          kind: "example",
          title: "An oblique cylinder",
          problem: md`A cylinder of radius 3 leans so its side is 10 long, but its top is 8 above its base. Find its volume.`,
          steps: [
            { math: md`B = \pi(3)^2 = 9\pi`, note: "Every horizontal slice is a circle of radius 3." },
            { math: md`V = Bh = 9\pi \cdot 8 = 72\pi`, note: "The height is the perpendicular distance, 8. The slanted length 10 is not used." },
          ],
        },
        {
          kind: "why",
          title: md`Why slices of a pyramid shrink like $k^2$`,
          body: md`First, scaling a flat figure by $k$ multiplies its area by $k^2$. Cut it into triangles: each triangle's base and height are multiplied by $k$, so its area $\frac{1}{2}bh$ becomes $\frac{1}{2}(kb)(kh) = k^2 \cdot \frac{1}{2}bh$. Add up the triangles.

Now slice a pyramid of height $h$ parallel to its base, at distance $d$ below the apex. Drop the altitude $\overline{VO}$ from the apex $V$ to the base, and pick a base vertex $A$. The plane meets $\overline{VO}$ at distance $d$ from $V$ and meets $\overline{VA}$ at $A'$. In $\triangle VOA$ the cut is parallel to $\overline{OA}$, so by the Triangle Proportionality Theorem $\frac{VA'}{VA} = \frac{d}{h}$. This holds for every lateral edge. In each face the cut $\overline{A'B'}$ is parallel to $\overline{AB}$, so $\triangle VA'B' \sim \triangle VAB$ (AA) and $A'B' = \frac{d}{h}AB$. Every side of the slice is $\frac{d}{h}$ times the matching side of the base, and the angles match because the sides are parallel, so the slice is similar to the base with scale factor $\frac{d}{h}$. Its area is $\left(\frac{d}{h}\right)^2 B$.

That depends only on $B$ and $h$. So **two pyramids with the same base area and the same height have equal cross-sections at every level, and therefore equal volumes** by Cavalieri's Principle. The same goes for a cone and a pyramid.`,
        },
        { kind: "diagram", ...prismIntoPyramids() },
        {
          kind: "proof",
          title: "Volume of a pyramid",
          given: md`A triangular prism $ABC$-$DEF$ with base area $B$ and height $h$, cut into pyramids $T_1 = ABCD$, $T_2 = BDEF$ and $T_3 = BCDF$.`,
          prove: md`Each pyramid has volume $\frac{1}{3}Bh$.`,
          steps: [
            { statement: md`$V_1 + V_2 + V_3 = Bh$`, reason: "Volume addition; volume of a prism" },
            { statement: md`$T_1$ has base $\triangle ABC$ and apex $D$; $T_2$ has base $\triangle DEF$ and apex $B$. Both bases have area $B$ and both heights are $h$.`, reason: "The bases of a prism are congruent; each apex lies in the opposite base's plane" },
            { statement: md`$V_1 = V_2$`, reason: "Equal base areas and equal heights (the slice argument above)" },
            { statement: md`View $T_2$ as base $\triangle BEF$ with apex $D$, and $T_3$ as base $\triangle BCF$ with apex $D$.`, reason: "Any face of a triangular pyramid can serve as its base" },
            { statement: md`$\triangle BEF \cong \triangle FCB$`, reason: md`The diagonal $\overline{BF}$ splits parallelogram $BCFE$ into two congruent triangles` },
            { statement: md`$V_2 = V_3$`, reason: md`Equal base areas, and the same height: both bases lie in the plane of $BCFE$ and share apex $D$` },
            { statement: md`$3V_1 = Bh$, so $V_1 = V_2 = V_3 = \frac{1}{3}Bh$`, reason: "Substitution; Division Property of Equality" },
            { statement: md`Any pyramid or cone with base area $B$ and height $h$ has volume $\frac{1}{3}Bh$.`, reason: "It has the same base area and height as a triangular pyramid like $T_1$ (the slice argument above)" },
          ],
        },
        {
          kind: "key",
          title: "Volume formulas",
          body: md`- Prism or cylinder: $V = Bh$. Cylinder: $V = \pi r^2 h$.
- Pyramid or cone: $V = \frac{1}{3}Bh$. Cone: $V = \frac{1}{3}\pi r^2 h$.
- Sphere: $V = \frac{4}{3}\pi r^3$, proved next.

Always use the perpendicular height, never a slant height.`,
        },
        { kind: "diagram", ...hemisphereVsCylinder() },
        {
          kind: "proof",
          title: "Volume of a sphere",
          given: md`A hemisphere of radius $r$. Beside it, a cylinder of radius $r$ and height $r$, with a cone removed whose apex is the center of the cylinder's bottom and whose base is the cylinder's top.`,
          prove: md`$V_{\text{sphere}} = \frac{4}{3}\pi r^3$`,
          steps: [
            { statement: md`At height $y$, the hemisphere's slice is a disk whose radius $\rho$ satisfies $\rho^2 + y^2 = r^2$.`, reason: md`Pythagorean Theorem: a point on the slice's edge is $r$ from the center $O$, $y$ up and $\rho$ across` },
            { statement: md`Hemisphere slice area $= \pi \rho^2 = \pi(r^2 - y^2)$`, reason: "Area of a circle; substitution" },
            { statement: md`At height $y$, the removed cone's slice is a disk of radius $y$.`, reason: "The cone's radius grows from 0 to $r$ over height $r$, so its radius equals its height (similar triangles)" },
            { statement: md`Cylinder-minus-cone slice area $= \pi r^2 - \pi y^2 = \pi(r^2 - y^2)$`, reason: "Area addition: the ring is the big disk minus the small one" },
            { statement: md`$V_{\text{hemisphere}} = V_{\text{cylinder}} - V_{\text{cone}}$`, reason: "Cavalieri's Principle: same height r, equal slices at every height" },
            { statement: md`$V_{\text{hemisphere}} = \pi r^2 \cdot r - \frac{1}{3}\pi r^2 \cdot r = \frac{2}{3}\pi r^3$`, reason: "Volumes of a cylinder and a cone" },
            { statement: md`$V_{\text{sphere}} = 2 \cdot \frac{2}{3}\pi r^3 = \frac{4}{3}\pi r^3$`, reason: "Volume addition: two congruent hemispheres" },
          ],
        },
        {
          kind: "example",
          title: "A cone and a sphere",
          problem: md`(a) Find the volume of a cone with radius 6 and slant height 10. (b) Find the volume of a sphere with radius 3.`,
          steps: [
            { math: md`h = \sqrt{10^2 - 6^2} = \sqrt{64} = 8`, note: "(a) Volume needs the height. Pythagorean Theorem." },
            { math: md`V = \frac{1}{3}\pi(6)^2(8) = \frac{1}{3}(288\pi) = 96\pi`, note: "" },
            { math: md`V = \frac{4}{3}\pi(3)^3 = \frac{4}{3}(27\pi) = 36\pi`, note: "(b) Cube the radius first." },
          ],
        },
        {
          kind: "check",
          prompt: md`Find the volume of a cone with radius 3 and height 4. Give an exact answer in terms of $\pi$.`,
          answer: "12pi",
          explain: md`$\frac{1}{3}\pi(3)^2(4) = \frac{1}{3}(36\pi) = 12\pi$.`,
        },
        {
          kind: "check",
          prompt: md`A pyramid and a prism have the same base area and the same height. The prism's volume is 90. What is the pyramid's volume?`,
          answer: "30",
          explain: md`A pyramid is $\frac{1}{3}$ of the prism with the same base and height: $\frac{1}{3} \cdot 90 = 30$.`,
        },
      ],
      practice: [prismCylinderVolume, pyramidConeSphereVolume, volumeMissingDimension],
    },
  ],
};
