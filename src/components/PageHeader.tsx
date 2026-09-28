import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  step,
  title,
  description,
  badges,
  actions,
  className,
}: {
  step?: string;
  title: string;
  description?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 pb-6", className)}>
      <div className="max-w-3xl min-w-0">
        {step && <div className="mb-1.5 text-[12px] font-medium text-brand-700">{step}</div>}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[26px] font-semibold tracking-tight text-ink leading-tight">{title}</h1>
          {badges}
        </div>
        {description && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StageFooter({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-5">
      <div className="text-[13px] text-ink-muted">{note}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
