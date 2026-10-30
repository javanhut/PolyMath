import { useMemo, type KeyboardEvent, type Ref } from "react";
import { previewLatex } from "../math/preview";
import { Tex } from "./RichText";

/** A text box for typed math, with a live rendering of how it was read. */
export function MathInput({
  value,
  onChange,
  onSubmit,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const latex = useMemo(() => previewLatex(value), [value]);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="flex-1 min-w-0">
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder="Your answer, e.g. 2x + 3, -7/4, x^2"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[15px] outline-none focus:border-accent disabled:opacity-70"
      />
      <div className="mt-1 min-h-7 px-1 text-muted text-sm">{latex && <>Reads as <Tex math={latex} /></>}</div>
    </div>
  );
}
