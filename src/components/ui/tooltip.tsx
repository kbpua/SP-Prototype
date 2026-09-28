import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-sm rounded-lg border border-line bg-white/95 px-3.5 py-2.5 text-[12px] leading-relaxed text-ink shadow-lg backdrop-blur animate-in fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export function AboutAutomation({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-line bg-white/90 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-800"
            title={text}
          >
            <Info className="size-3.5 text-brand-600 shrink-0" />
            <span className="font-medium">About the automation</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-[340px]">
          <div className="font-semibold text-brand-800 mb-1 flex items-center gap-1.5">
            <Info className="size-3.5 text-brand-600 shrink-0" />
            About the automation
          </div>
          <p className="text-ink-soft leading-normal">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
