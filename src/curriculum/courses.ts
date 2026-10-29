import { unit1 } from "./algebra1/unit1";
import { unit2 } from "./algebra1/unit2";
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
      plannedUnit("Linear Inequalities", [
        "Inequalities and the number line",
        "Solving inequalities (and why the sign flips)",
        "Compound inequalities",
        "Absolute value equations and inequalities",
      ]),
      plannedUnit("Functions and Graphs", [
        "The coordinate plane",
        "What a function is",
        "Slope as a rate of change",
        "Slope-intercept form",
        "Point-slope and standard form",
        "Parallel and perpendicular lines",
      ]),
      plannedUnit("Systems of Linear Equations", [
        "Solving systems by graphing",
        "Substitution",
        "Elimination",
        "Modeling with systems",
      ]),
      plannedUnit("Exponents and Polynomials", [
        "Exponent rules from repeated multiplication",
        "Zero and negative exponents",
        "Scientific notation",
        "Adding and subtracting polynomials",
        "Multiplying polynomials",
        "Special products",
      ]),
      plannedUnit("Factoring", [
        "Greatest common factor",
        "Factoring trinomials",
        "Difference of squares and perfect squares",
        "A factoring strategy",
      ]),
      plannedUnit("Quadratic Equations", [
        "Parabolas and their graphs",
        "Solving by factoring",
        "Square roots and completing the square",
        "Deriving the quadratic formula",
        "The discriminant",
      ]),
      plannedUnit("Radicals", ["Simplifying square roots", "Operations with radicals", "Radical equations"]),
    ],
  },
  {
    id: "geometry",
    title: "Geometry",
    tagline: "Logic and proof, shapes and space, from axioms to coordinates.",
    prereqs: ["algebra-1"],
    units: [
      plannedUnit("Foundations and Logic", [
        "Points, lines and planes",
        "Angles and their measure",
        "Conditional statements",
        "Your first proofs",
      ]),
      plannedUnit("Parallel Lines", ["Angles formed by a transversal", "Proving lines parallel", "The angle sum of a triangle"]),
      plannedUnit("Triangles and Congruence", ["Congruent figures", "SSS, SAS, ASA, AAS", "Isosceles and equilateral triangles", "Triangle inequalities"]),
      plannedUnit("Similarity", ["Ratios and proportions", "Similar triangles", "Proportions in triangles"]),
      plannedUnit("Right Triangles", ["The Pythagorean theorem and its proofs", "Special right triangles", "Distance in the plane"]),
      plannedUnit("Polygons and Quadrilaterals", ["Angles of polygons", "Parallelograms", "Rectangles, rhombuses and squares", "Trapezoids and kites"]),
      plannedUnit("Circles", ["Arcs and central angles", "Inscribed angles", "Tangents and chords", "Equations of circles"]),
      plannedUnit("Area and Volume", ["Area from first principles", "Circumference and area of circles", "Surface area", "Volume and Cavalieri's principle"]),
      plannedUnit("Transformations", ["Translations, reflections and rotations", "Dilations", "Symmetry"]),
    ],
  },
  {
    id: "algebra-2",
    title: "Algebra 2",
    tagline: "Functions in depth, polynomials, complex numbers, exponentials and logarithms.",
    prereqs: ["algebra-1", "geometry"],
    units: [
      plannedUnit("Functions in Depth", ["Domain and range", "Function notation and composition", "Inverse functions", "Transformations of graphs"]),
      plannedUnit("Quadratics and Complex Numbers", ["Vertex form", "Imaginary and complex numbers", "Complex solutions of quadratics"]),
      plannedUnit("Polynomial Functions", [
        "End behavior and degree",
        "Polynomial division",
        "The remainder and factor theorems",
        "Rational root theorem",
        "The fundamental theorem of algebra",
      ]),
      plannedUnit("Rational Expressions", [
        "Simplifying rational expressions",
        "Multiplying and dividing",
        "Adding and subtracting",
        "Rational equations",
        "Graphs and asymptotes",
      ]),
      plannedUnit("Radicals and Rational Exponents", ["Nth roots", "Rational exponents", "Radical functions"]),
      plannedUnit("Exponential and Logarithmic Functions", [
        "Exponential growth and decay",
        "The number e",
        "Logarithms as inverse exponents",
        "Properties of logarithms",
        "Solving exponential equations",
      ]),
      plannedUnit("Sequences and Series", ["Arithmetic sequences", "Geometric sequences", "Sigma notation", "Infinite geometric series"]),
      plannedUnit("Counting and Probability", ["Counting principles", "Permutations and combinations", "The binomial theorem", "Probability basics"]),
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
