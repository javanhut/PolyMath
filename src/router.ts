import { useEffect, useState } from "react";

// Hash routes: #/            course map
//              #/c/:course   one course
//              #/c/:course/:lesson
export type Route = { page: "home" } | { page: "course"; course: string } | { page: "lesson"; course: string; lesson: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "c" && parts[1]) {
    return parts[2] ? { page: "lesson", course: parts[1], lesson: parts[2] } : { page: "course", course: parts[1] };
  }
  return { page: "home" };
}

export function href(route: Route): string {
  if (route.page === "course") return `#/c/${route.course}`;
  if (route.page === "lesson") return `#/c/${route.course}/${route.lesson}`;
  return "#/";
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
