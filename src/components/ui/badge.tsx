import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-brand-200 bg-brand-50 text-brand-800",
        solid: "border-transparent bg-brand-700 text-white",
        neutral: "border-line bg-cream text-ink-soft",
        amber: "border-flag/35 bg-flag-soft text-[#854408]",
        coral: "border-coral/35 bg-coral-soft text-[#991b1b]",
        slate: "border-line bg-cream-dark/50 text-ink-muted",
        outline: "border-line bg-white text-ink-soft",
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
    <Badge variant={config.variant} className={cn("gap-1.5 tabular", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", config.dot)} />
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
        "inline-flex items-center gap-1 rounded-md border border-line bg-cream-dark/50 px-1.5 py-0.5 text-[11px] font-medium text-ink-soft",
        className,
      )}
    >
      <MapPin className="size-3 shrink-0 text-ink-muted" />
      <span>{source}</span>
    </span>
  );
}

