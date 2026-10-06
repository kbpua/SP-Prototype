import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROB2_DOMAINS, type CandidateStudy } from "@/data/mockData";
import type { DomainAssessment, RobJudgement } from "@/state/ReviewContext";
import { robOverall } from "@/lib/review";
import { cn } from "@/lib/utils";

export const ROB_OPTS: { value: RobJudgement; label: string; cls: string; dot: string }[] = [
  { value: "low", label: "Low risk", cls: "bg-brand-600 border-brand-600 text-white", dot: "bg-brand-500" },
  { value: "some", label: "Some concerns", cls: "bg-[#b45309] border-[#b45309] text-white", dot: "bg-[#b45309]" },
  { value: "high", label: "High risk", cls: "bg-coral border-coral text-white", dot: "bg-coral" },
];

const symbol = (j?: string) => (j === "low" ? "+" : j === "some" ? "−" : j === "high" ? "×" : "?");

function RobCell({ j, size = "md" }: { j?: string; size?: "sm" | "md" }) {
  const opt = ROB_OPTS.find((o) => o.value === j);
  return (
    <span
      title={opt?.label ?? "Not assessed"}
      className={cn(
        "grid place-items-center rounded-full font-bold transition-colors duration-300",
        size === "sm" ? "size-4 text-[9px]" : "mx-auto size-6 text-[11px]",
        opt ? cn(opt.dot, "text-white") : "border border-dashed border-line text-ink-muted/50",
      )}
    >
      {symbol(j)}
    </span>
  );
}

/** Mini D1–D5 dot row for compact tables. */
export function RobDots({ assessment }: { assessment?: Record<string, DomainAssessment> }) {
  return (
    <span className="inline-flex items-center gap-1">
      {ROB2_DOMAINS.map((d) => (
        <span key={d.id} title={`${d.title}`}>
          <RobCell j={assessment?.[d.id]?.judgement} size="sm" />
        </span>
      ))}
    </span>
  );
}

export function RobTrafficLight({
  studies,
  appraisal,
  onSelect,
  title = "Risk-of-bias summary",
  description = "Traffic-light plot across RoB 2 domains for included trials",
  footer,
  className,
}: {
  studies: CandidateStudy[];
  appraisal: Record<string, Record<string, DomainAssessment>>;
  onSelect?: (id: string) => void;
  title?: string;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  if (studies.length === 0) return null;
  return (
    <Card className={cn("mt-6", className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-ink-muted">
          {ROB_OPTS.map((o) => (
            <span key={o.value} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", o.dot)} /> {o.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-[12px] text-ink-muted">
              <th className="py-2 text-left font-medium">Study</th>
              {ROB2_DOMAINS.map((d) => (
                <th key={d.id} className="w-20 py-2 font-medium" title={d.title}>
                  {d.id.toUpperCase()}
                </th>
              ))}
              <th className="w-36 py-2 font-medium">Overall</th>
            </tr>
          </thead>
          <tbody>
            {studies.map((s) => {
              const a = appraisal[s.id];
              const overall = robOverall(a);
              return (
                <tr
                  key={s.id}
                  className={cn("border-b border-line/60 last:border-0", onSelect && "cursor-pointer hover:bg-cream/60")}
                  onClick={() => onSelect?.(s.id)}
                >
                  <td className="py-2.5 font-medium text-ink">
                    {s.trial?.acronym ?? s.authors.split(",")[0]} <span className="font-normal text-ink-muted">{s.year}</span>
                  </td>
                  {ROB2_DOMAINS.map((d) => (
                    <td key={d.id} className="py-2.5 text-center">
                      <RobCell j={a?.[d.id]?.judgement} />
                    </td>
                  ))}
                  <td className="py-2.5 text-center">
                    <Badge variant={overall.tone}>{overall.label === "Not assessed" ? "In progress" : overall.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {footer}
      </CardContent>
    </Card>
  );
}
