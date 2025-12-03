import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";

interface SafetyWidgetProps {
  formsToday: number;
  formsThisWeek: number;
  incidents: number;
}

export const SafetyWidget = ({ formsToday, formsThisWeek, incidents }: SafetyWidgetProps) => {
  const navigate = useNavigate();

  return (
    <Card className="bg-secondary/5 border-secondary/30 shadow-md h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
          <Shield className="h-5 w-5 text-secondary" />
          Safety & Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between min-h-0 overflow-hidden p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Forms Today</span>
            <span className="text-xl font-bold text-primary">{formsToday}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">This Week</span>
            <span className="text-xl font-bold text-secondary">{formsThisWeek}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Incidents</span>
            <span className="text-xl font-bold text-accent">{incidents}</span>
          </div>
        </div>

        <Button
          onClick={() => navigate("/safety")}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-4"
          size="sm"
        >
          Safety Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};
