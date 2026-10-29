import katex from "katex";
// Copying rendered math yields its LaTeX ("$4 \cdot 23$") instead of KaTeX's duplicated visual + MathML text.
import "katex/contrib/copy-tex";
import { memo, type ReactNode } from "react";

export const Tex = memo(function Tex({ math, display = false }: { math: string; display?: boolean }) {
  const html = katex.renderToString(math, { displayMode: display, throwOnError: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
});

// $$display$$, $inline$, **bold**, *italic*. Bold and italic may contain math.
const INLINE = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\*\*([\s\S]+?)\*\*|\*([^*\s][^*]*?)\*/g;

export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<Tex key={k++} math={m[1]} display />);
    else if (m[2] !== undefined) out.push(<Tex key={k++} math={m[2]} />);
    else if (m[3] !== undefined) out.push(<strong key={k++} className="font-semibold"><Inline text={m[3]} /></strong>);
    else out.push(<em key={k++}><Inline text={m[4]!} /></em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Paragraphs separated by blank lines; a paragraph of "- " lines is a list. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const paragraphs = text.trim().split(/\n\s*\n/);
  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      {paragraphs.map((p, i) => {
        const lines = p.split("\n");
        if (lines.every((l) => l.trimStart().startsWith("- "))) {
          return (
            <ul key={i} className="list-disc pl-6 space-y-1.5 marker:text-muted">
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.trimStart().slice(2)} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Inline text={p} />
          </p>
        );
      })}
    </div>
  );
}
