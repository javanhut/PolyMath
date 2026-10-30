import { unit1 } from "./algebra1/unit1";
import { unit2 } from "./algebra1/unit2";
import { unit3 } from "./algebra1/unit3";
import { unit4 } from "./algebra1/unit4";
import { unit5 } from "./algebra1/unit5";
import { unit6 } from "./algebra1/unit6";
import { unit7 } from "./algebra1/unit7";
import { unit8 } from "./algebra1/unit8";
import { unit9 } from "./algebra1/unit9";
import { unit1 as geometryUnit1 } from "./geometry/unit1";
import { unit2 as geometryUnit2 } from "./geometry/unit2";
import { unit3 as geometryUnit3 } from "./geometry/unit3";
import { unit4 as geometryUnit4 } from "./geometry/unit4";
import { unit5 as geometryUnit5 } from "./geometry/unit5";
import { unit6 as geometryUnit6 } from "./geometry/unit6";
import { unit7 as geometryUnit7 } from "./geometry/unit7";
import { unit8 as geometryUnit8 } from "./geometry/unit8";
import { unit9 as geometryUnit9 } from "./geometry/unit9";
import { unit1 as algebra2Unit1 } from "./algebra2/unit1";
import { unit2 as algebra2Unit2 } from "./algebra2/unit2";
import { unit3 as algebra2Unit3 } from "./algebra2/unit3";
import { unit4 as algebra2Unit4 } from "./algebra2/unit4";
import { unit5 as algebra2Unit5 } from "./algebra2/unit5";
import { unit6 as algebra2Unit6 } from "./algebra2/unit6";
import { unit7 as algebra2Unit7 } from "./algebra2/unit7";
import { unit8 as algebra2Unit8 } from "./algebra2/unit8";
import { isWritten, plannedUnit, type Course, type Lesson } from "./types";

// The full path, in the order it should be taken. Lessons without content
// are listed so the whole road is visible; they become available as they
// are written.
export const COURSES: Course[] = [
  {
    id: "algebra-1",
    title: "Algebra 1",
    tagline: "Variables, equations, functions and the first look at quadratics.",
    prereqs: [],
    units: [
      unit1,
      unit2,
      unit3,
      unit4,
      unit5,
      unit6,
      unit7,
      unit8,
      unit9,
    ],
  },
  {
    id: "geometry",
    title: "Geometry",
    tagline: "Logic and proof, shapes and space, from axioms to coordinates.",
    prereqs: ["algebra-1"],
    units: [
      geometryUnit1,
      geometryUnit2,
      geometryUnit3,
      geometryUnit4,
      geometryUnit5,
      geometryUnit6,
      geometryUnit7,
      geometryUnit8,
      geometryUnit9,
    ],
  },
  {
    id: "algebra-2",
    title: "Algebra 2",
    tagline: "Functions in depth, polynomials, complex numbers, exponentials and logarithms.",
    prereqs: ["algebra-1", "geometry"],
    units: [
      algebra2Unit1,
      algebra2Unit2,
      algebra2Unit3,
      algebra2Unit4,
      algebra2Unit5,
      algebra2Unit6,
      algebra2Unit7,
      algebra2Unit8,
    ],
  },
  {
    id: "trigonometry",
    title: "Trigonometry",
    tagline: "Angles, circles and waves: the functions that describe rotation.",
    prereqs: ["algebra-2", "geometry"],
    units: [
      plannedUnit("Angles", ["Degrees and radians", "Arc length and sector area", "Angular speed"]),
      plannedUnit("Right-Triangle Trigonometry", ["Sine, cosine and tangent as ratios", "Solving right triangles", "Reciprocal functions"]),
      plannedUnit("The Unit Circle", ["Trig functions of any angle", "Reference angles", "Exact values"]),
      plannedUnit("Graphs of Trig Functions", ["Graphing sine and cosine", "Amplitude, period and phase", "Graphs of tangent and the others"]),
      plannedUnit("Identities", [
        "The Pythagorean identities",
        "Sum and difference formulas",
        "Double- and half-angle formulas",
        "Proving identities",
      ]),
      plannedUnit("Inverse Functions and Equations", ["Inverse trig functions", "Solving trig equations"]),
      plannedUnit("Oblique Triangles", ["The law of sines", "The law of cosines", "Area of a triangle"]),
      plannedUnit("Polar Coordinates and Vectors", ["Polar coordinates", "Vectors in the plane", "Complex numbers in polar form", "De Moivre's theorem"]),
    ],
  },
  {
    id: "algebra-3",
    title: "Algebra 3 / Precalculus",
    tagline: "College algebra: functions as objects, matrices, conics and the bridge to calculus.",
    prereqs: ["trigonometry"],
    units: [
      plannedUnit("The Function Toolkit", ["Parent functions", "Combining functions", "Piecewise functions", "Rates of change"]),
      plannedUnit("Polynomial and Rational Analysis", ["Zeros and multiplicity", "Polynomial inequalities", "Rational functions in full"]),
      plannedUnit("Exponential and Logarithmic Models", ["Compound and continuous interest", "Logistic growth", "Fitting models to data"]),
      plannedUnit("Systems and Matrices", ["Systems in three variables", "Matrices and row operations", "Determinants and Cramer's rule", "Partial fractions"]),
      plannedUnit("Conic Sections", ["Parabolas", "Ellipses", "Hyperbolas", "Rotation of axes"]),
      plannedUnit("Parametric Equations", ["Parametric curves", "Eliminating the parameter"]),
      plannedUnit("Sequences, Series and Induction", ["Mathematical induction", "Convergence intuition"]),
      plannedUnit("A Preview of Calculus", ["Limits by tables and graphs", "The tangent line problem", "The area problem"]),
    ],
  },
  {
    id: "calculus-1",
    title: "Calculus 1",
    tagline: "Limits, derivatives and the first integrals.",
    prereqs: ["algebra-3"],
    units: [
      plannedUnit("Limits", ["The idea of a limit", "Limit laws", "The formal epsilon-delta definition", "Continuity", "Limits at infinity"]),
      plannedUnit("The Derivative", ["Instantaneous rate of change", "The derivative as a limit", "The derivative as a function", "Differentiability"]),
      plannedUnit("Differentiation Rules", [
        "Power rule, derived",
        "Product and quotient rules",
        "Derivatives of trig functions",
        "The chain rule",
        "Exponential and logarithmic derivatives",
      ]),
      plannedUnit("Implicit Differentiation", ["Implicit differentiation", "Derivatives of inverse functions", "Related rates"]),
      plannedUnit("Applications of Derivatives", [
        "Extreme values",
        "The mean value theorem",
        "Curve sketching",
        "Optimization",
        "Linear approximation and Newton's method",
        "L'Hôpital's rule",
      ]),
      plannedUnit("Integrals", [
        "Antiderivatives",
        "Area and Riemann sums",
        "The definite integral",
        "The fundamental theorem of calculus",
        "Substitution",
      ]),
    ],
  },
  {
    id: "calculus-2",
    title: "Calculus 2",
    tagline: "Integration techniques, applications and infinite series.",
    prereqs: ["calculus-1"],
    units: [
      plannedUnit("Applications of Integration", ["Area between curves", "Volumes by slicing", "Volumes by shells", "Arc length", "Work and other physics"]),
      plannedUnit("Techniques of Integration", [
        "Integration by parts",
        "Trigonometric integrals",
        "Trigonometric substitution",
        "Partial fractions",
        "Numerical integration",
        "Improper integrals",
      ]),
      plannedUnit("Sequences and Series", [
        "Sequences and their limits",
        "Series and partial sums",
        "The integral test",
        "Comparison tests",
        "Alternating series",
        "Ratio and root tests",
      ]),
      plannedUnit("Power Series", ["Power series and convergence", "Taylor and Maclaurin series", "Taylor's remainder"]),
      plannedUnit("Parametric and Polar Calculus", ["Calculus with parametric curves", "Areas and lengths in polar coordinates"]),
    ],
  },
  {
    id: "calculus-3",
    title: "Calculus 3",
    tagline: "Multivariable and vector calculus in three dimensions.",
    prereqs: ["calculus-2"],
    units: [
      plannedUnit("Vectors and 3D Space", ["Coordinates in space", "Vectors and the dot product", "The cross product", "Lines and planes", "Surfaces"]),
      plannedUnit("Vector-Valued Functions", ["Space curves", "Derivatives and integrals of curves", "Arc length and curvature", "Motion in space"]),
      plannedUnit("Partial Derivatives", [
        "Functions of several variables",
        "Limits and continuity",
        "Partial derivatives",
        "Tangent planes",
        "The multivariable chain rule",
        "Gradient and directional derivatives",
        "Maxima and minima",
        "Lagrange multipliers",
      ]),
      plannedUnit("Multiple Integrals", [
        "Double integrals",
        "Double integrals in polar coordinates",
        "Triple integrals",
        "Cylindrical and spherical coordinates",
        "Change of variables and the Jacobian",
      ]),
      plannedUnit("Vector Calculus", [
        "Vector fields",
        "Line integrals",
        "Conservative fields",
        "Green's theorem",
        "Curl and divergence",
        "Surface integrals",
        "Stokes' theorem",
        "The divergence theorem",
      ]),
    ],
  },
  {
    id: "linear-algebra",
    title: "Linear Algebra",
    tagline: "Vectors, matrices and linear maps: the geometry of many dimensions.",
    prereqs: ["algebra-3"],
    units: [
      plannedUnit("Linear Systems", ["Systems as rows and as columns", "Gaussian elimination", "Row echelon form", "Solution sets"]),
      plannedUnit("Vectors", ["Vectors and linear combinations", "Span", "Linear independence"]),
      plannedUnit("Matrices", ["Matrix operations", "Matrices as linear transformations", "Composition and matrix multiplication", "The inverse of a matrix"]),
      plannedUnit("Determinants", ["Determinants as signed volume", "Computing determinants", "Cramer's rule"]),
      plannedUnit("Vector Spaces", ["Vector spaces and subspaces", "Null space and column space", "Basis and dimension", "Rank", "Change of basis"]),
      plannedUnit("Orthogonality", ["Inner products and length", "Orthogonal projections", "Gram–Schmidt", "Least squares"]),
      plannedUnit("Eigenvalues", ["Eigenvalues and eigenvectors", "The characteristic polynomial", "Diagonalization", "Symmetric matrices"]),
      plannedUnit("Singular Value Decomposition", ["The SVD", "Low-rank approximation"]),
    ],
  },
  {
    id: "ode",
    title: "Ordinary Differential Equations",
    tagline: "Equations of change: modeling with derivatives and solving them.",
    prereqs: ["calculus-2", "linear-algebra"],
    units: [
      plannedUnit("First-Order Equations", [
        "What a differential equation is",
        "Direction fields",
        "Separable equations",
        "Linear equations and integrating factors",
        "Exact equations",
        "Existence and uniqueness",
      ]),
      plannedUnit("Modeling", ["Growth and decay", "Newton's law of cooling", "Mixing problems", "Euler's method"]),
      plannedUnit("Second-Order Linear Equations", [
        "Homogeneous equations with constant coefficients",
        "Complex and repeated roots",
        "Undetermined coefficients",
        "Variation of parameters",
        "Springs, oscillation and resonance",
      ]),
      plannedUnit("Laplace Transforms", ["The Laplace transform", "Solving initial value problems", "Step functions and impulses"]),
      plannedUnit("Systems of Equations", ["Systems as matrices", "The eigenvalue method", "Phase portraits", "Nonlinear systems and stability"]),
      plannedUnit("Series Solutions", ["Power series solutions", "Ordinary and singular points"]),
    ],
  },
];

export function findCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export function courseLessons(course: Course): Lesson[] {
  return course.units.flatMap((u) => u.lessons);
}

export function writtenLessons(course: Course): Lesson[] {
  return courseLessons(course).filter(isWritten);
}

/** Lesson ids are only unique within a course, so progress is keyed "course/lesson". */
export function lessonKey(courseId: string, lessonId: string): string {
  return `${courseId}/${lessonId}`;
}
