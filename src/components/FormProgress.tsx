import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface FormProgressProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
  className?: string;
}

export const FormProgress = ({
  steps,
  currentStep,
  completedSteps = [],
  className,
}: FormProgressProps) => {
  return (
    <div className={cn("flex items-center w-full", className)}>
      {steps.map((step, i) => {
        const isCompleted = completedSteps.includes(i);
        const isCurrent = i === currentStep;
        const isUpcoming = !isCompleted && !isCurrent;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 border-2",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary bg-transparent",
                  isUpcoming && "border-muted text-muted-foreground bg-transparent"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-18px]",
                  isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
