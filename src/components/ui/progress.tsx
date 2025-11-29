import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  showLabel?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, showLabel = false, ...props }, ref) => {
  const percentage = Math.round(value);
  
  // Determine color based on progress
  const getColorClass = () => {
    if (percentage < 25) return "bg-status-issue";
    if (percentage < 75) return "bg-status-progress";
    return "bg-status-complete";
  };

  return (
    <div className="space-y-1">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn("h-full w-full flex-1 transition-all", getColorClass())}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </ProgressPrimitive.Root>
      {showLabel && (
        <p className="text-xs text-muted-foreground text-right">{percentage}%</p>
      )}
    </div>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
