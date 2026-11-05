import { NavLink } from "react-router-dom";
import { Check, LayoutDashboard, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReview } from "@/state/ReviewContext";
import { ANALYST } from "@/data/mockData";
import { MODE_LABEL, STAGES } from "./stages";

export function Sidebar() {
  const { stageProgress } = useReview();
  const gatePassed = STAGES.map((_, i) => STAGES.slice(0, i + 1).every((st) => stageProgress[st.key] >= 100));

  return (
    <aside className="flex w-16 lg:w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur-md transition-[width] duration-200">
      <div className="flex items-center justify-center gap-3 px-3 pt-4 pb-4 lg:justify-start lg:px-5">
        <img
          src="/sinag-logo.png"
          alt="SINAG"
          className="h-14 w-14 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-slate-200"
        />
        <div className="hidden min-w-0 leading-tight lg:block">
          <div className="font-bold text-slate-900">SINAG-HTA</div>
          <div className="text-xs text-slate-500 whitespace-normal break-words">
            Philippine HTA Evidence Platform
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 lg:px-3 scrollbar-none">
        <NavLink
          to="/"
          end
          title="Dashboard"
          className={({ isActive }) =>
            cn(
              "mb-3 flex items-center justify-center lg:justify-start gap-3 rounded-lg px-2 lg:px-3 py-2 text-[13.5px] font-medium transition-colors",
              isActive ? "bg-brand-50 text-brand-700" : "text-slate-800 hover:bg-cream-dark/60",
            )
          }
        >
          <LayoutDashboard className="size-4 shrink-0 text-brand-600" />
          <span className="hidden lg:inline truncate">Dashboard</span>
        </NavLink>

        <div className="mb-2 hidden lg:block px-3 text-[11px] font-medium tracking-wide text-ink-muted">Review pipeline</div>

        <ol className="relative">
          {STAGES.map((s, i) => {
            const pct = stageProgress[s.key];
            const done = gatePassed[i];
            const Icon = s.icon;
            return (
              <li key={s.key} className="relative">
                {i < STAGES.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[31px] lg:left-[27px] top-[34px] h-[calc(100%-26px)] w-px transition-colors duration-500",
                      done ? "bg-brand-400" : "bg-line",
                    )}
                  />
                )}
                <NavLink
                  to={s.path}
                  title={`${s.label} (${MODE_LABEL[s.mode]})`}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center lg:items-start justify-center lg:justify-start gap-3 rounded-lg px-2 lg:px-3 py-1.5 transition-colors",
                      isActive ? "bg-brand-50 text-brand-700" : "hover:bg-cream-dark/60",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "relative z-10 lg:mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-all duration-300",
                          done
                            ? "border-brand-600 bg-brand-600 text-white"
                            : isActive
                              ? "border-brand-600 bg-white text-brand-600 animate-pulse-ring"
                              : "border-line bg-white text-ink-muted",
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 hidden lg:block">
                        <span
                          className={cn(
                            "block truncate text-[13.5px] font-medium leading-5 text-slate-800",
                            isActive && "text-brand-700",
                          )}
                        >
                          {s.label}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 truncate text-xs text-slate-500">
                          <span>{MODE_LABEL[s.mode]}</span>
                          {pct > 0 && pct < 100 && <span className="tabular-nums">· {pct}%</span>}
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

      <div className="mx-3 my-2 hidden lg:block rounded-lg border border-line bg-cream px-3 py-2">
        <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-muted">
          <BookOpen className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
          <span>
            Aligned to the DOH-HTAC Philippine HTA Methods Guide under RA 11223 (UHC Act).
          </span>
        </div>
      </div>
      <div
        className="m-2 flex lg:hidden items-center justify-center rounded-lg border border-line bg-cream p-2"
        title="Aligned to the DOH-HTAC Philippine HTA Methods Guide under RA 11223 (UHC Act)"
      >
        <BookOpen className="size-4 text-brand-700" />
      </div>

      <div className="flex items-center justify-center lg:justify-start gap-3 border-t border-line px-2 lg:px-5 py-3">
        <div
          className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800"
          title={`${ANALYST.name} · ${ANALYST.role}`}
        >
          {ANALYST.initials}
        </div>
        <div className="leading-tight hidden lg:block min-w-0">
          <div className="text-[13px] font-medium text-ink truncate">{ANALYST.name}</div>
          <div className="text-[11.5px] text-ink-muted truncate">{ANALYST.role}</div>
        </div>
      </div>
    </aside>
  );
}
