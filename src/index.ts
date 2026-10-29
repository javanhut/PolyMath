import { serve } from "bun";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { COURSES, findCourse, lessonKey } from "./curriculum/courses";
import { isWritten } from "./curriculum/types";
import index from "./index.html";
import { openProgress } from "./server/progress";

const dataHome = process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
const dbPath = process.env.POLYMATH_DB || join(dataHome, "polymath", "progress.db");
mkdirSync(dirname(dbPath), { recursive: true });
const progress = openProgress(dbPath);

const knownLessons = new Set(
  COURSES.flatMap((c) => c.units.flatMap((u) => u.lessons.filter(isWritten).map((l) => lessonKey(c.id, l.id)))),
);

function lessonFrom(params: { course: string; lesson: string }): string | null {
  const key = lessonKey(params.course, params.lesson);
  return findCourse(params.course) && knownLessons.has(key) ? key : null;
}

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/progress": {
      GET: () => Response.json(progress.all()),
    },

    "/api/progress/:course/:lesson": {
      async POST(req) {
        const key = lessonFrom(req.params);
        if (!key) return Response.json({ error: "unknown lesson" }, { status: 404 });
        const body = (await req.json().catch(() => null)) as { correct?: unknown } | null;
        if (typeof body?.correct !== "boolean") return Response.json({ error: "expected { correct: boolean }" }, { status: 400 });
        return Response.json(progress.record(key, body.correct));
      },
      DELETE(req) {
        const key = lessonFrom(req.params);
        if (!key) return Response.json({ error: "unknown lesson" }, { status: 404 });
        progress.reset(key);
        return new Response(null, { status: 204 });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`PolyMath running at ${server.url}  (progress: ${dbPath})`);
