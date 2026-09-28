import { Link, useLocation } from "react-router-dom";
import { BookOpen, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReview } from "@/state/ReviewContext";
import { ACTIVE_REVIEW_ID } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAGES } from "./stages";

export function TopBar() {
  const { pathname } = useLocation();
  const { config, stageProgress, reset } = useReview();
  const currentIndex = STAGES.findIndex((s) => pathname.startsWith(s.path));
  const inReview = currentIndex >= 0;
  const overall = Math.round(
    Object.values(stageProgress).reduce((a, b) => a + b, 0) / STAGES.length,
  );
  const gatePassed = STAGES.map((_, i) => STAGES.slice(0, i + 1).every((st) => stageProgress[st.key] >= 100));

  return (
    <header className="relative shrink-0 border-b border-line bg-white/80 backdrop-blur">
      <div
        className="absolute inset-x-0 top-0 h-[3px] origin-left bg-brand-500 transition-transform duration-700 ease-out"
        style={{ transform: `scaleX(${inReview ? (currentIndex + 1) / STAGES.length : 0})` }}
      />
      <div className="flex flex-col gap-1.5 px-4 sm:px-6 lg:px-8 py-2.5">
        {/* Row 1: Breadcrumb, review ID, status pill, guideline badge, Reset demo button */}
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-ink-muted">
            {inReview ? (
              <>
                <Link to="/" className="whitespace-nowrap hover:text-brand-700">
                  Reviews
                </Link>
                <span>/</span>
                <span className="font-mono whitespace-nowrap">{ACTIVE_REVIEW_ID}</span>
                <Badge variant="default" className="ml-1 tabular whitespace-nowrap">
                  In progress · {overall}%
                </Badge>
                <PrototypeBadge />
                {/* Guideline badge: icon + tooltip below xl, full text at xl and above */}
                <span
                  className="hidden xl:inline-flex items-center rounded-full border border-brand-200/60 bg-brand-50/60 px-2 py-0.5 text-[10.5px] font-medium text-brand-800 whitespace-nowrap"
                  title="Aligned to the DOH-HTAC Philippine HTA Methods Guide under RA 11223 (UHC Act)"
                >
                  RA 11223 Aligned
                </span>
                <span
                  className="inline-flex xl:hidden items-center justify-center rounded-full border border-brand-200/60 bg-brand-50/60 p-1 text-[10.5px] font-medium text-brand-800 whitespace-nowrap"
                  title="RA 11223 Aligned"
                >
                  <BookOpen className="size-3 text-brand-700" />
                  <span className="sr-only">RA 11223 Aligned</span>
                </span>
              </>
            ) : (
              <div className="truncate text-[11.5px] text-ink-muted whitespace-nowrap">
                Health Technology Assessment Council · Secretariat
              </div>
            )}
            {!inReview && <PrototypeBadge />}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 whitespace-nowrap px-2.5 text-xs text-ink-muted hover:text-ink"
            onClick={() => {
              if (confirm("Reset all demo progress? Screening, appraisal and verification decisions will be cleared.")) reset();
            }}
            title="Reset demo state"
          >
            <RotateCcw className="size-3.5" />
            Reset demo
          </Button>
        </div>

        {/* Row 2: Review title alongside stage stepper */}
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="min-w-0 flex-1">
            {inReview ? (
              <div
                className="truncate text-[15px] font-semibold text-ink leading-tight"
                title={config.title}
              >
                {config.title}
              </div>
            ) : (
              <div className="truncate text-[15px] font-semibold text-ink leading-tight">
                Evidence synthesis workspace
              </div>
            )}
          </div>

          {inReview && (
            <ol className="flex items-center shrink-0">
              {STAGES.map((s, i) => {
                const done = gatePassed[i];
                const active = i === currentIndex;
                return (
                  <li key={s.key} className="flex items-center">
                    <Link
                      to={s.path}
                      title={`${s.label} (${s.short})`}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2 py-0.5 xl:px-2.5 xl:py-1 text-[11.5px] xl:text-[12px] font-medium transition-all duration-300",
                        active
                          ? "bg-brand-700 text-white shadow-sm"
                          : done
                            ? "text-brand-700 hover:bg-brand-50"
                            : "text-ink-muted hover:bg-cream-dark/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-full text-[10px] tabular",
                          active ? "bg-white/20" : done ? "bg-brand-100" : "bg-cream-dark",
                        )}
                      >
                        {done && !active ? <Check className="size-2.5" strokeWidth={3.5} /> : i + 1}
                      </span>
                      {/* Below xl: show only current step label. At xl and above: show all labels */}
                      <span className={cn("whitespace-nowrap", active ? "inline" : "hidden xl:inline")}>
                        {s.short}
                      </span>
                    </Link>
                    {i < STAGES.length - 1 && (
                      <span
                        className={cn(
                          "mx-0.5 sm:mx-1 h-px w-2 sm:w-3 xl:w-4 shrink-0 transition-colors duration-500",
                          i < currentIndex || done ? "bg-brand-400" : "bg-line",
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </header>
  );
}

function PrototypeBadge() {
  return (
    <span className="shrink-0 whitespace-nowrap rounded border border-line bg-cream px-1.5 py-px text-[10.5px] font-medium text-ink-muted">
      Prototype · simulated data
    </span>
  );
}
