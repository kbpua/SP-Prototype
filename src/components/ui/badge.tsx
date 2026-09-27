import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-brand-200 bg-brand-50 text-brand-800",
        solid: "border-transparent bg-brand-700 text-white",
        neutral: "border-line bg-cream text-ink-soft",
        amber: "border-flag/30 bg-flag-soft text-[#9a5410]",
        coral: "border-coral/30 bg-coral-soft text-[#a33a2f]",
        slate: "border-slate-200 bg-slate-50 text-slate-600",
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
