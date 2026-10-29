import { COURSES, courseLessons, findCourse, lessonKey, writtenLessons } from "../curriculum/courses";
import { isWritten, type Course, type Lesson } from "../curriculum/types";
import { useProgress } from "../progress";
import { href } from "../router";
import type { ProgressMap } from "../shared";
import { LessonBlock } from "./Blocks";
import { Practice } from "./Practice";

type Status = "mastered" | "started" | "ready" | "planned";

function lessonStatus(progress: ProgressMap, courseId: string, lesson: Lesson): Status {
  if (!isWritten(lesson)) return "planned";
  const p = progress[lessonKey(courseId, lesson.id)];
  if (p?.masteredAt) return "mastered";
  return p?.attempts ? "started" : "ready";
}

function StatusDot({ status }: { status: Status }) {
  const label = { mastered: "Mastered", started: "In progress", ready: "Not started", planned: "Coming soon" }[status];
  const cls = {
    mastered: "bg-good border-good",
    started: "border-accent bg-[linear-gradient(90deg,var(--accent)_50%,transparent_50%)]",
    ready: "border-accent",
    planned: "border-dashed border-muted/60",
  }[status];
  return <span title={label} aria-label={label} className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 ${cls}`} />;
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-good transition-all" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  );
}

function courseStats(progress: ProgressMap, course: Course) {
  const all = courseLessons(course);
  const written = all.filter(isWritten);
  const mastered = written.filter((l) => progress[lessonKey(course.id, l.id)]?.masteredAt).length;
  return { total: all.length, written: written.length, mastered };
}

/** The first written lesson, in path order, that isn't mastered yet. */
function nextLesson(progress: ProgressMap): { course: Course; lesson: Lesson; unit: string } | null {
  for (const course of COURSES) {
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        if (isWritten(lesson) && !progress[lessonKey(course.id, lesson.id)]?.masteredAt) return { course, lesson, unit: unit.title };
      }
    }
  }
  return null;
}

export function Home() {
  const { progress } = useProgress();
  const next = nextLesson(progress);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Mathematics from first principles</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        From Algebra 1 to differential equations. Every rule is derived before you use it, every lesson ends in practice, and you master a lesson by
        getting four problems in a row right.
      </p>

      {next && (
        <a
          href={href({ page: "lesson", course: next.course.id, lesson: next.lesson.id })}
          className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-accent px-6 py-5 text-paper shadow-sm transition hover:brightness-110"
        >
          <div>
            <div className="text-sm opacity-85">
              {next.course.title} · {next.unit}
            </div>
            <div className="mt-0.5 font-serif text-xl font-semibold">{next.lesson.title}</div>
          </div>
          <span className="text-2xl" aria-hidden>
            →
          </span>
        </a>
      )}

      <h2 className="mt-12 mb-4 text-sm font-bold uppercase tracking-wider text-muted">The path</h2>
      <ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-px before:bg-line">
        {COURSES.map((course, i) => {
          const s = courseStats(progress, course);
          const prereqs = course.prereqs.map((id) => findCourse(id)?.title).filter(Boolean);
          return (
            <li key={course.id} className="relative flex gap-4">
              <span className="z-10 mt-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-serif text-sm font-semibold">
                {i + 1}
              </span>
              <a href={href({ page: "course", course: course.id })} className="flex-1 rounded-xl border border-line bg-surface px-5 py-4 transition hover:border-accent">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-serif text-xl font-semibold">{course.title}</h3>
                  <span className="text-sm text-muted">
                    {s.written ? `${s.mastered}/${s.written} mastered · ` : ""}
                    {s.total} lessons
                  </span>
                </div>
                <p className="mt-1 text-[15px] text-muted">{course.tagline}</p>
                {prereqs.length > 0 && <p className="mt-1 text-xs text-muted">After: {prereqs.join(", ")}</p>}
                {s.written > 0 && (
                  <div className="mt-3">
                    <ProgressBar value={s.mastered} total={s.written} />
                  </div>
                )}
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function CourseView({ courseId }: { courseId: string }) {
  const { progress } = useProgress();
  const course = findCourse(courseId);
  if (!course) return <NotFound />;
  const s = courseStats(progress, course);
  let n = 0;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <a href="#/" className="text-sm text-muted hover:text-ink">
        ← All courses
      </a>
      <h1 className="mt-3 font-serif text-4xl font-semibold">{course.title}</h1>
      <p className="mt-2 text-lg text-muted">{course.tagline}</p>
      {course.prereqs.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Take after:{" "}
          {course.prereqs.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <a href={href({ page: "course", course: id })} className="text-accent hover:underline">
                {findCourse(id)?.title}
              </a>
            </span>
          ))}
        </p>
      )}
      <div className="mt-5 max-w-sm">
        <ProgressBar value={s.mastered} total={s.written || s.total} />
        <p className="mt-1.5 text-sm text-muted">
          {s.written === 0
            ? `${s.total} lessons planned. This course's lessons haven't been written yet; its outline is below.`
            : `${s.mastered} of ${s.written} available lessons mastered · ${s.total - s.written} more planned`}
        </p>
      </div>

      <div className="mt-8 space-y-8">
        {course.units.map((unit, u) => (
          <section key={unit.title}>
            <h2 className="mb-2 font-serif text-xl font-semibold">
              <span className="mr-2 text-muted">{u + 1}.</span>
              {unit.title}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {unit.lessons.map((lesson) => {
                n++;
                const status = lessonStatus(progress, course.id, lesson);
                const row = (
                  <>
                    <StatusDot status={status} />
                    <span className="w-8 shrink-0 text-sm text-muted tabular-nums">{n}</span>
                    <span className="flex-1">
                      <span className={status === "planned" ? "text-muted" : "font-medium"}>{lesson.title}</span>
                      {lesson.summary && <span className="block text-sm text-muted">{lesson.summary}</span>}
                    </span>
                    {status === "planned" && <span className="text-xs text-muted">Coming soon</span>}
                  </>
                );
                return (
                  <li key={lesson.id}>
                    {status === "planned" ? (
                      <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                    ) : (
                      <a href={href({ page: "lesson", course: course.id, lesson: lesson.id })} className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent-soft">
                        {row}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function LessonView({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { get } = useProgress();
  const course = findCourse(courseId);
  const unit = course?.units.find((u) => u.lessons.some((l) => l.id === lessonId));
  const lesson = unit?.lessons.find((l) => l.id === lessonId);
  if (!course || !unit || !lesson || !isWritten(lesson)) return <NotFound />;

  const written = writtenLessons(course);
  const i = written.indexOf(lesson);
  const prev = written[i - 1];
  const next = written[i + 1];
  const mastered = !!get(course.id, lesson.id)?.masteredAt;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <nav className="text-sm text-muted">
        <a href={href({ page: "course", course: course.id })} className="hover:text-ink">
          {course.title}
        </a>
        <span className="mx-1.5">›</span>
        {unit.title}
      </nav>
      <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight">{lesson.title}</h1>
      {lesson.summary && <p className="mt-2 text-lg text-muted">{lesson.summary}</p>}

      <div className="mt-8 space-y-6">
        {lesson.blocks!.map((block, k) => (
          <LessonBlock key={k} block={block} />
        ))}
      </div>

      {lesson.practice && lesson.practice.length > 0 && (
        <div className="mt-10">
          <Practice key={lesson.id} courseId={course.id} lesson={{ ...lesson, practice: lesson.practice }} />
        </div>
      )}

      <nav className="mt-10 flex justify-between gap-4 border-t border-line pt-6">
        {prev ? (
          <a href={href({ page: "lesson", course: course.id, lesson: prev.id })} className="text-muted hover:text-ink">
            ← {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a
            href={href({ page: "lesson", course: course.id, lesson: next.id })}
            className={`text-right ${mastered ? "font-medium text-accent" : "text-muted hover:text-ink"}`}
          >
            {next.title} →
          </a>
        )}
      </nav>
    </article>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold">Nothing here yet</h1>
      <p className="mt-2 text-muted">That page doesn't exist, or the lesson hasn't been written.</p>
      <a href="#/" className="mt-6 inline-block text-accent hover:underline">
        Back to the course map
      </a>
    </div>
  );
}
