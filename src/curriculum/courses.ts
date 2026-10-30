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
import { unit1 as trigonometryUnit1 } from "./trigonometry/unit1";
import { unit2 as trigonometryUnit2 } from "./trigonometry/unit2";
import { unit3 as trigonometryUnit3 } from "./trigonometry/unit3";
import { unit4 as trigonometryUnit4 } from "./trigonometry/unit4";
import { unit5 as trigonometryUnit5 } from "./trigonometry/unit5";
import { unit6 as trigonometryUnit6 } from "./trigonometry/unit6";
import { unit7 as trigonometryUnit7 } from "./trigonometry/unit7";
import { unit8 as trigonometryUnit8 } from "./trigonometry/unit8";
import { unit1 as algebra3Unit1 } from "./algebra3/unit1";
import { unit2 as algebra3Unit2 } from "./algebra3/unit2";
import { unit3 as algebra3Unit3 } from "./algebra3/unit3";
import { unit4 as algebra3Unit4 } from "./algebra3/unit4";
import { unit5 as algebra3Unit5 } from "./algebra3/unit5";
import { unit6 as algebra3Unit6 } from "./algebra3/unit6";
import { unit7 as algebra3Unit7 } from "./algebra3/unit7";
import { unit8 as algebra3Unit8 } from "./algebra3/unit8";
import { unit1 as calculus1Unit1 } from "./calculus1/unit1";
import { unit2 as calculus1Unit2 } from "./calculus1/unit2";
import { unit3 as calculus1Unit3 } from "./calculus1/unit3";
import { unit4 as calculus1Unit4 } from "./calculus1/unit4";
import { unit5 as calculus1Unit5 } from "./calculus1/unit5";
import { unit6 as calculus1Unit6 } from "./calculus1/unit6";
import { unit1 as calculus2Unit1 } from "./calculus2/unit1";
import { unit2 as calculus2Unit2 } from "./calculus2/unit2";
import { unit3 as calculus2Unit3 } from "./calculus2/unit3";
import { unit4 as calculus2Unit4 } from "./calculus2/unit4";
import { unit5 as calculus2Unit5 } from "./calculus2/unit5";
import { unit1 as calculus3Unit1 } from "./calculus3/unit1";
import { unit2 as calculus3Unit2 } from "./calculus3/unit2";
import { unit3 as calculus3Unit3 } from "./calculus3/unit3";
import { unit4 as calculus3Unit4 } from "./calculus3/unit4";
import { unit5 as calculus3Unit5 } from "./calculus3/unit5";
import { unit1 as linearAlgebraUnit1 } from "./linearalgebra/unit1";
import { unit2 as linearAlgebraUnit2 } from "./linearalgebra/unit2";
import { unit3 as linearAlgebraUnit3 } from "./linearalgebra/unit3";
import { unit4 as linearAlgebraUnit4 } from "./linearalgebra/unit4";
import { unit5 as linearAlgebraUnit5 } from "./linearalgebra/unit5";
import { unit6 as linearAlgebraUnit6 } from "./linearalgebra/unit6";
import { unit7 as linearAlgebraUnit7 } from "./linearalgebra/unit7";
import { unit8 as linearAlgebraUnit8 } from "./linearalgebra/unit8";
import { unit1 as odeUnit1 } from "./ode/unit1";
import { unit2 as odeUnit2 } from "./ode/unit2";
import { unit3 as odeUnit3 } from "./ode/unit3";
import { unit4 as odeUnit4 } from "./ode/unit4";
import { unit5 as odeUnit5 } from "./ode/unit5";
import { unit6 as odeUnit6 } from "./ode/unit6";
import { isWritten, type Course, type Lesson } from "./types";

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
      trigonometryUnit1,
      trigonometryUnit2,
      trigonometryUnit3,
      trigonometryUnit4,
      trigonometryUnit5,
      trigonometryUnit6,
      trigonometryUnit7,
      trigonometryUnit8,
    ],
  },
  {
    id: "algebra-3",
    title: "Algebra 3 / Precalculus",
    tagline: "College algebra: functions as objects, matrices, conics and the bridge to calculus.",
    prereqs: ["trigonometry"],
    units: [
      algebra3Unit1,
      algebra3Unit2,
      algebra3Unit3,
      algebra3Unit4,
      algebra3Unit5,
      algebra3Unit6,
      algebra3Unit7,
      algebra3Unit8,
    ],
  },
  {
    id: "calculus-1",
    title: "Calculus 1",
    tagline: "Limits, derivatives and the first integrals.",
    prereqs: ["algebra-3"],
    units: [
      calculus1Unit1,
      calculus1Unit2,
      calculus1Unit3,
      calculus1Unit4,
      calculus1Unit5,
      calculus1Unit6,
    ],
  },
  {
    id: "calculus-2",
    title: "Calculus 2",
    tagline: "Integration techniques, applications and infinite series.",
    prereqs: ["calculus-1"],
    units: [
      calculus2Unit1,
      calculus2Unit2,
      calculus2Unit3,
      calculus2Unit4,
      calculus2Unit5,
    ],
  },
  {
    id: "calculus-3",
    title: "Calculus 3",
    tagline: "Multivariable and vector calculus in three dimensions.",
    prereqs: ["calculus-2"],
    units: [
      calculus3Unit1,
      calculus3Unit2,
      calculus3Unit3,
      calculus3Unit4,
      calculus3Unit5,
    ],
  },
  {
    id: "linear-algebra",
    title: "Linear Algebra",
    tagline: "Vectors, matrices and linear maps: the geometry of many dimensions.",
    prereqs: ["algebra-3"],
    units: [
      linearAlgebraUnit1,
      linearAlgebraUnit2,
      linearAlgebraUnit3,
      linearAlgebraUnit4,
      linearAlgebraUnit5,
      linearAlgebraUnit6,
      linearAlgebraUnit7,
      linearAlgebraUnit8,
    ],
  },
  {
    id: "ode",
    title: "Ordinary Differential Equations",
    tagline: "Equations of change: modeling with derivatives and solving them.",
    prereqs: ["calculus-2", "linear-algebra"],
    units: [
      odeUnit1,
      odeUnit2,
      odeUnit3,
      odeUnit4,
      odeUnit5,
      odeUnit6,
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
