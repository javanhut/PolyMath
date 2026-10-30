// LaTeX for whatever the learner has typed so far, across every answer form:
// expressions, "x = 3", "(2, -3)", "2, -3", "x < 0 or x > 4", "[4, inf)".
// Returns null when the input can't be read yet (including anything with ±).

import { splitTopLevel } from "./check";
import { parse, toLatex } from "./expr";

const COMPARATORS: Record<string, string> = { "<=": "\\le", "=<": "\\le", "≤": "\\le", ">=": "\\ge", "=>": "\\ge", "≥": "\\ge", "<": "<", ">": ">", "=": "=" };

function piece(text: string): string {
  const t = text.trim();
  if (/^\+?(inf|infinity|∞|oo)$/i.test(t)) return "\\infty";
  if (/^-(inf|infinity|∞|oo)$/i.test(t)) return "-\\infty";
  return toLatex(parse(t));
}

function render(text: string): string {
  const t = text.trim();
  const unions = t.split(/\s+or\s+|∪|\s+U\s+/i);
  if (unions.length > 1) return unions.map(render).join(/\bor\b/i.test(t) ? "\\text{ or }" : " \\cup ");

  const items = splitTopLevel(t);
  if (items.length > 1) return items.map(render).join(",\\ ");

  const wrapped = /^([([{])([\s\S]*)([)\]}])$/.exec(t);
  if (wrapped && splitTopLevel(wrapped[2]!).length > 1) {
    const open = wrapped[1] === "{" ? "\\{" : wrapped[1];
    const close = wrapped[3] === "}" ? "\\}" : wrapped[3];
    return `\\left${open}${render(wrapped[2]!)}\\right${close}`;
  }

  const parts = t.split(/(<=|>=|=<|=>|≤|≥|<|>|=)/);
  return parts.map((p, i) => (i % 2 ? ` ${COMPARATORS[p]} ` : piece(p))).join("");
}

export function previewLatex(input: string): string | null {
  const text = input.trim();
  if (!text || /^[a-zA-Z]+(\s+[a-zA-Z]+)+$/.test(text)) return null;
  try {
    return render(text);
  } catch {
    return null;
  }
}
