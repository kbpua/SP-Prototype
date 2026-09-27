import { Link, useLocation } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";
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

  return (
    <header className="relative shrink-0 border-b border-line bg-white/80 backdrop-blur">
      <div
        className="absolute inset-x-0 top-0 h-[3px] origin-left bg-brand-500 transition-transform duration-700 ease-out"
        style={{ transform: `scaleX(${inReview ? (currentIndex + 1) / STAGES.length : 0})` }}
      />
      <div className="flex items-center gap-6 px-8 py-3.5">
        <div className="min-w-0 flex-1">
          {inReview ? (
            <>
              <div className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                <Link to="/" className="hover:text-brand-700">
                  Reviews
                </Link>
                <span>/</span>
                <span className="font-mono">{ACTIVE_REVIEW_ID}</span>
                <Badge variant="default" className="ml-1">
                  In progress · {overall}%
                </Badge>
              </div>
              <h1 className="mt-0.5 truncate text-[15px] font-semibold text-ink" title={config.title}>
                {config.title}
              </h1>
            </>
          ) : (
            <>
              <div className="text-[11.5px] text-ink-muted">Health Technology Assessment Council · Secretariat</div>
              <h1 className="mt-0.5 text-[15px] font-semibold text-ink">Evidence synthesis workspace</h1>
            </>
          )}
        </div>

        {inReview && (
          <ol className="hidden items-center xl:flex">
            {STAGES.map((s, i) => {
              const done = stageProgress[s.key] >= 100;
              const active = i === currentIndex;
              return (
                <li key={s.key} className="flex items-center">
                  <Link
                    to={s.path}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-all duration-300",
                      active
                        ? "bg-brand-700 text-white shadow-sm"
                        : done
                          ? "text-brand-700 hover:bg-brand-50"
                          : "text-ink-muted hover:bg-cream-dark/60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded-full text-[10px] tabular",
                        active ? "bg-white/20" : done ? "bg-brand-100" : "bg-cream-dark",
                      )}
                    >
                      {done && !active ? <Check className="size-2.5" strokeWidth={3.5} /> : i + 1}
                    </span>
                    {s.short}
                  </Link>
                  {i < STAGES.length - 1 && (
                    <span
                      className={cn(
                        "mx-0.5 h-px w-4 transition-colors duration-500",
                        i < currentIndex || done ? "bg-brand-400" : "bg-line",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Reset all demo progress? Screening, appraisal and verification decisions will be cleared.")) reset();
          }}
          title="Reset demo state"
        >
          <RotateCcw />
          Reset demo
        </Button>
      </div>
    </header>
  );
}
