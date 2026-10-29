import { CourseView, Home, LessonView } from "./components/Pages";
import "./index.css";
import logo from "./logo.svg";
import { ProgressProvider, useProgress } from "./progress";
import { useRoute } from "./router";

function ErrorBanner() {
  const { error } = useProgress();
  if (!error) return null;
  return <div className="bg-bad-soft px-4 py-2 text-center text-sm text-bad">{error}</div>;
}

export function App() {
  const route = useRoute();
  return (
    <ProgressProvider>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="#/" className="flex items-center gap-2 font-serif text-lg font-semibold">
            <img src={logo} alt="" className="h-7 w-7" />
            PolyMath
          </a>
          <a href="#/" className="text-sm text-muted hover:text-ink">
            Course map
          </a>
        </div>
      </header>
      <ErrorBanner />
      <main>
        {route.page === "home" && <Home />}
        {route.page === "course" && <CourseView courseId={route.course} />}
        {route.page === "lesson" && <LessonView key={`${route.course}/${route.lesson}`} courseId={route.course} lessonId={route.lesson} />}
      </main>
    </ProgressProvider>
  );
}

export default App;
