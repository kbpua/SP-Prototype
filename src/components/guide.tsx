import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check } from "lucide-react";
import { INELIGIBILITY_CODES, type IneligibilityCode } from "@/data/mockData";
import { cn } from "@/lib/utils";

export const GUIDE_REFS = {
  codes: "Guide p. 17 · Ineligibility coding",
  prisma: "Guide p. 21 · PRISMA flow with reasons",
  design: "Guide Table 2, p. 18 · Study design by question type",
  annex8: "Guide Annex 8, p. 75 · Sample data extraction table",
  appraisal: "Guide Annex 7, p. 74 · Critical appraisal tools",
  conformance: "Guide Table 4, pp. 20–21 · Minimum requirements",
  grade: "Guide p. 21 · Quality of evidence",
  search: "Guide p. 16 · Search strategy",
  searchDetail: "Guide p. 16; Table 5, p. 22 · Avoid language restrictions unless justified; search grey literature",
  independent: "Guide Tables 4–5, pp. 20–22 · Independent review",
} as const;

/** Small muted caption pointing to the Methods Guide page a feature is aligned to. */
export function GuideRef({ children, title, className }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title ?? "Guide reference (Philippine HTA Methods Guide, First Edition)"}
      className={cn("inline-flex items-center gap-1 text-[11px] text-ink-muted", className)}
    >
      <BookOpen className="size-3 shrink-0 text-brand-600/70" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function codeLabel(code: IneligibilityCode) {
  return INELIGIBILITY_CODES.find((c) => c.code === code)?.label ?? code;
}

export function CodeBadge({
  code,
  className,
  title,
}: {
  code: IneligibilityCode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? `Ineligibility code ${code}: ${codeLabel(code)}`}
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-coral/35 bg-coral-soft px-1 font-mono text-[10.5px] font-semibold leading-none text-[#991b1b]",
        className,
      )}
    >
      {code}
    </span>
  );
}

/** Clickable code badge that opens a small popover to change the code. */
export function CodeMenu({
  value,
  onChange,
  label,
}: {
  value: IneligibilityCode;
  onChange: (c: IneligibilityCode) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Change ineligibility code for ${label}`}
        title={`Ineligibility code ${value}: ${codeLabel(value)} · click to change`}
        className="cursor-pointer rounded transition-shadow hover:ring-2 hover:ring-coral/25"
      >
        <CodeBadge code={value} title="" />
      </button>
      {open && (
        <span className="absolute top-full left-0 z-30 mt-1 w-56 animate-fade-in rounded-lg border border-line bg-white p-1 shadow-lg">
          <span className="block px-2 pt-1 pb-1.5 text-[10.5px] font-medium text-ink-muted">Ineligibility code</span>
          {INELIGIBILITY_CODES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onChange(c.code);
                setOpen(false);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-ink-soft hover:bg-cream",
                c.code === value && "bg-cream",
              )}
            >
              <CodeBadge code={c.code} title="" />
              <span className="flex-1">{c.label}</span>
              {c.code === value && <Check className="size-3.5 text-brand-600" />}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Segmented P / I / C / O / S / Other picker used in the exclusion flow. */
export function CodeChips({
  value,
  onChange,
}: {
  value?: IneligibilityCode;
  onChange: (c: IneligibilityCode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-cream p-0.5">
      {INELIGIBILITY_CODES.map((c) => (
        <button
          key={c.code}
          type="button"
          title={c.label}
          onClick={() => onChange(c.code)}
          className={cn(
            "cursor-pointer rounded-md px-2.5 py-0.5 font-mono text-[11.5px] font-semibold transition-all",
            value === c.code ? "bg-coral text-white shadow-sm" : "text-ink-muted hover:text-ink",
          )}
        >
          {c.code}
        </button>
      ))}
    </div>
  );
}
