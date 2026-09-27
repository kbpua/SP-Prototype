import { NavLink } from "react-router-dom";
import { Check, LayoutDashboard, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReview } from "@/state/ReviewContext";
import { ANALYST } from "@/data/mockData";
import { MODE_LABEL, STAGES } from "./stages";

export function Sidebar() {
  const { stageProgress } = useReview();

  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-r border-line bg-white/70 backdrop-blur">
      <div className="flex items-center gap-3 px-5 pt-5 pb-6">
        <div className="grid size-9 place-items-center rounded-lg bg-brand-700 text-white shadow-sm">
          <svg viewBox="0 0 32 32" className="size-6">
            <path
              d="M6 17h5l2.5-7 3.5 13 2.5-6H26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-ink">HTA Evidence Synthesis</div>
          <div className="text-[11.5px] text-ink-muted">Philippine HTA Methods Guide</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "mb-5 flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              isActive ? "bg-brand-50 text-brand-800" : "text-ink-soft hover:bg-cream-dark/60 hover:text-ink",
            )
          }
        >
          <LayoutDashboard className="size-4" />
          Dashboard
        </NavLink>

        <div className="mb-2 px-3 text-[11px] font-medium tracking-wide text-ink-muted">Review pipeline</div>

        <ol className="relative">
          {STAGES.map((s, i) => {
            const pct = stageProgress[s.key];
            const done = pct >= 100;
            const Icon = s.icon;
            return (
              <li key={s.key} className="relative">
                {i < STAGES.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[27px] top-[38px] h-[calc(100%-26px)] w-px transition-colors duration-500",
                      done ? "bg-brand-400" : "bg-line",
                    )}
                  />
                )}
                <NavLink
                  to={s.path}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                      isActive ? "bg-brand-50" : "hover:bg-cream-dark/60",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "relative z-10 mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-all duration-300",
                          done
                            ? "border-brand-600 bg-brand-600 text-white"
                            : isActive
                              ? "border-brand-600 bg-white text-brand-700 animate-pulse-ring"
                              : "border-line bg-white text-ink-muted",
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-[13.5px] font-medium leading-5",
                            isActive ? "text-brand-800" : "text-ink",
                          )}
                        >
                          {s.label}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-muted">
                          <span
                            className={cn(
                              s.mode === "human" && "text-[#9a5410] font-medium",
                              s.mode === "hybrid" && "text-brand-700",
                            )}
                          >
                            {MODE_LABEL[s.mode]}
                          </span>
                          {pct > 0 && pct < 100 && <span className="tabular">· {pct}%</span>}
                        </span>
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="m-3 rounded-lg border border-line bg-cream px-3 py-3">
        <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-muted">
          <BookOpen className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
          <span>
            Aligned to the DOH-HTAC Philippine HTA Methods Guide under RA 11223 (UHC Act).
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line px-5 py-4">
        <div className="grid size-8 place-items-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800">
          {ANALYST.initials}
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-medium text-ink">{ANALYST.name}</div>
          <div className="text-[11.5px] text-ink-muted">{ANALYST.role}</div>
        </div>
      </div>
    </aside>
  );
}
