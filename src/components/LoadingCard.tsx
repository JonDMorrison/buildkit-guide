import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingCardProps {
  className?: string;
}

export const LoadingCard = ({ className }: LoadingCardProps) => {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-5 w-5" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-32" />
      </div>
    </Card>
  );
};
