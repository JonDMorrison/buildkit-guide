import { useNavigate } from "react-router-dom";
import { Cloud, Sun, CloudRain, Snowflake, Wind, Thermometer, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface DailyLog {
  id: string;
  weather: string | null;
  temperature: string | null;
  crew_count: number | null;
  work_performed: string;
  issues: string | null;
  log_date: string;
}

interface WeatherInfoModalProps {
  todayLog: DailyLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;
}

const getWeatherIcon = (weather: string | null) => {
  if (!weather) return <Cloud className="h-5 w-5 text-muted-foreground" />;
  const w = weather.toLowerCase();
  if (w.includes("sun") || w.includes("clear")) return <Sun className="h-5 w-5 text-yellow-500" />;
  if (w.includes("rain") || w.includes("storm")) return <CloudRain className="h-5 w-5 text-blue-500" />;
  if (w.includes("snow")) return <Snowflake className="h-5 w-5 text-blue-300" />;
  if (w.includes("wind")) return <Wind className="h-5 w-5 text-muted-foreground" />;
  return <Cloud className="h-5 w-5 text-muted-foreground" />;
};

export const WeatherInfoModal = ({ todayLog, open, onOpenChange, projectId }: WeatherInfoModalProps) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    onOpenChange(false);
    navigate(projectId ? `/daily-logs?projectId=${projectId}` : "/daily-logs");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getWeatherIcon(todayLog?.weather)}
            Today's Conditions
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </DialogHeader>

        {todayLog ? (
          <div className="space-y-4">
            {/* Weather & Temperature */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getWeatherIcon(todayLog.weather)}
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {todayLog.weather || "Not recorded"}
                  </p>
                  <p className="text-xs text-muted-foreground">Weather</p>
                </div>
              </div>
              {todayLog.temperature && (
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <p className="font-medium text-foreground">{todayLog.temperature}</p>
                    <p className="text-xs text-muted-foreground">Temperature</p>
                  </div>
                  <Thermometer className="h-4 w-4 text-accent" />
                </div>
              )}
            </div>

            {/* Daily Log Summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Daily Log Summary
              </div>
              {todayLog.work_performed && (
                <p className="text-sm text-foreground line-clamp-2 bg-muted/30 rounded-md p-2">
                  {todayLog.work_performed}
                </p>
              )}
              {todayLog.issues && (
                <div className="bg-accent/10 rounded-md p-2 border border-accent/20">
                  <p className="text-xs font-medium text-accent mb-1">Issues Noted</p>
                  <p className="text-sm text-foreground line-clamp-2">{todayLog.issues}</p>
                </div>
              )}
            </div>

            <Button onClick={handleNavigate} variant="outline" size="sm" className="w-full">
              Edit Daily Log
            </Button>
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No Daily Log Yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create today's log to track weather and site conditions
            </p>
            <Button onClick={handleNavigate} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Daily Log
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
