# PolyMath

Mathematics from first principles, from Algebra 1 to ordinary differential
equations. Every rule is derived before it's used ("Why?" boxes, worked
examples revealed step by step, interactive visuals), and every lesson ends
in practice: freshly generated problems checked by a real math parser, so
any equivalent form of an answer is accepted. Four correct in a row masters
a lesson.

## Running

```sh
imlazy setup   # install dependencies
imlazy run     # http://localhost:4747
imlazy dev     # same, with hot reloading
imlazy check   # type check + tests
```

Progress is stored in SQLite at `$XDG_DATA_HOME/polymath/progress.db`
(default `~/.local/share/polymath/progress.db`); set `POLYMATH_DB` to use
another file.

## Layout

- `src/math/`: the expression parser/evaluator (`expr.ts`), answer checker
  (`check.ts`), and seeded randomness and formatting for generators (`random.ts`).
- `src/curriculum/`: the course catalog (`courses.ts`) and lesson content.
  Lessons without `blocks` are planned and shown as "coming soon".
- `src/components/`: lesson rendering, practice, widgets.
- `src/server/`: the progress store. `src/index.ts` is the Bun server.

## Writing a lesson

Lessons are data: a list of blocks (`text`, `key`, `why`, `example`,
`check`, `widget`) plus practice generators, which are functions
`(rng) => Problem`. Write text with the `md` tag (`String.raw`), using
`$inline$` and `$$display$$` LaTeX, `**bold**` and `- ` lists. See
`src/curriculum/algebra1/unit1.ts`.

`bun test` runs every generator across 400 seeds and re-derives each answer
from the problem itself (substituting into the equation, re-evaluating the
expression), so a wrong answer key fails the suite.
