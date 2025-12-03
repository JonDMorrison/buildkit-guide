import { Card, CardContent } from "@/components/ui/card";
import { CloudRain, HardHat, Wrench, PlayCircle, CheckSquare, AlertTriangle, Sun, Cloud, CloudSnow } from "lucide-react";

interface DailySnapshotStripProps {
  weather: string | null;
  crewCount: number;
  activeTrades: number;
  tasksStarting: number;
  tasksFinishing: number;
  blockedCount: number;
}

const getWeatherIcon = (weather: string | null) => {
  if (!weather) return <Sun className="h-5 w-5 text-primary" />;
  const w = weather.toLowerCase();
  if (w.includes("rain") || w.includes("storm")) return <CloudRain className="h-5 w-5 text-primary" />;
  if (w.includes("snow")) return <CloudSnow className="h-5 w-5 text-primary" />;
  if (w.includes("cloud") || w.includes("overcast")) return <Cloud className="h-5 w-5 text-primary" />;
  return <Sun className="h-5 w-5 text-primary" />;
};

export const DailySnapshotStrip = ({
  weather,
  crewCount,
  activeTrades,
  tasksStarting,
  tasksFinishing,
  blockedCount,
}: DailySnapshotStripProps) => {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              {getWeatherIcon(weather)}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Weather</p>
              <p className="text-sm font-bold text-primary">{weather || "Clear"}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <HardHat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Crew</p>
              <p className="text-sm font-bold text-primary">{crewCount}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Trades</p>
              <p className="text-sm font-bold text-primary">{activeTrades} Active</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <PlayCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Starting</p>
              <p className="text-sm font-bold text-primary">{tasksStarting}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Finishing</p>
              <p className="text-sm font-bold text-primary">{tasksFinishing}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <AlertTriangle className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Blockers</p>
              <p className="text-sm font-bold text-accent">{blockedCount}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
