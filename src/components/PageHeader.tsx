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

/** Shared page edges (matches Screening). Fills the scroll area so a pinned StageFooter sits at the bottom. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1400px] min-h-[calc(100dvh-var(--topbar-h))] flex-col px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StageFooter({
  children,
  note,
  className,
  pinned,
}: {
  children: ReactNode;
  note?: ReactNode;
  className?: string;
  pinned?: boolean;
}) {
  if (pinned) {
    return (
      <>
        <div className="h-6 shrink-0" />
        <div
          className={cn(
            "sticky bottom-0 z-20 mt-auto flex items-center justify-between gap-4 border-t border-line bg-cream/95 py-2.5 backdrop-blur",
            className,
          )}
        >
          <div className="min-w-0 text-[13px] text-ink-muted">{note}</div>
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
      </>
    );
  }
  return (
    <div className={cn("mt-8 flex items-center justify-between gap-4 border-t border-line pt-5", className)}>
      <div className="text-[13px] text-ink-muted">{note}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
