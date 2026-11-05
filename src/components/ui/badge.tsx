import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-brand-200/80 bg-brand-50 text-brand-700",
        solid: "border-transparent bg-brand-600 text-white",
        neutral: "border-transparent bg-slate-100 text-slate-600",
        amber: "border-flag/25 bg-flag-soft text-[#854408]",
        coral: "border-coral/25 bg-coral-soft text-[#991b1b]",
        slate: "border-transparent bg-slate-100 text-slate-600",
        outline: "border-line bg-white text-slate-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function ConfidenceBadge({
  confidence,
  score,
  className,
}: {
  confidence: "high" | "medium" | "low";
  score?: number;
  className?: string;
}) {
  const config = {
    high: {
      variant: "default" as const,
      dot: "bg-brand-500",
      label: "High",
    },
    medium: {
      variant: "amber" as const,
      dot: "bg-[#b45309]",
      label: "Medium",
    },
    low: {
      variant: "coral" as const,
      dot: "bg-coral",
      label: "Low",
    },
  }[confidence];

  return (
    <Badge variant={config.variant} className={cn("gap-1.5 tabular-nums", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full animate-confidence-pulse", config.dot)} />
      <span>{score !== undefined ? `${config.label} · ${Math.round(score * 100)}%` : config.label}</span>
    </Badge>
  );
}

export function ProvenanceBadge({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-transparent bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
        className,
      )}
    >
      <MapPin className="size-3 shrink-0 text-slate-400" />
      <span>{source}</span>
    </span>
  );
}
