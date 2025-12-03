import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

interface Blocker {
  id: string;
  reason: string;
  task?: {
    title: string;
    assigned_trade?: {
      name: string;
    };
  };
}

interface BlockersWidgetProps {
  blockers: Blocker[];
}

export const BlockersWidget = ({ blockers }: BlockersWidgetProps) => {
  return (
    <Card className="bg-accent/5 border-accent/30 shadow-md h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-accent" />
          Active Blockers
        </CardTitle>
        <CardDescription className="text-sm">Issues requiring attention</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto min-h-0">
        {blockers.length > 0 ? (
          <div className="space-y-3">
            {blockers.slice(0, 5).map((blocker) => (
              <div
                key={blocker.id}
                className="p-3 rounded-lg border border-accent/30 bg-background"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {blocker.task?.title || "Unknown Task"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{blocker.reason}</p>
                    {blocker.task?.assigned_trade?.name && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {blocker.task.assigned_trade.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-6">
            <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-secondary" />
            </div>
            <p className="font-semibold text-foreground">No blockers</p>
            <p className="text-sm text-muted-foreground">All clear!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
