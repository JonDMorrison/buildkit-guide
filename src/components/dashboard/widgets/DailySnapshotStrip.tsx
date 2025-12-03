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
  if (!weather) return Sun;
  const w = weather.toLowerCase();
  if (w.includes("rain") || w.includes("storm")) return CloudRain;
  if (w.includes("snow")) return CloudSnow;
  if (w.includes("cloud") || w.includes("overcast")) return Cloud;
  return Sun;
};

interface MetricTileProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  variant?: "default" | "warning";
}

const MetricTile = ({ icon: Icon, label, value, variant = "default" }: MetricTileProps) => (
  <div className="metric-tile">
    <div className={`metric-icon ${variant === "warning" ? "bg-accent/20" : "bg-primary/10"}`}>
      <Icon className={`h-4 w-4 ${variant === "warning" ? "text-accent" : "text-primary"}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="metric-label truncate">{label}</p>
      <p className={`metric-value ${variant === "warning" ? "text-accent" : ""}`}>{value}</p>
    </div>
  </div>
);

export const DailySnapshotStrip = ({
  weather,
  crewCount,
  activeTrades,
  tasksStarting,
  tasksFinishing,
  blockedCount,
}: DailySnapshotStripProps) => {
  const WeatherIcon = getWeatherIcon(weather);
  
  return (
    <div className="widget-card !p-3 md:!p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile icon={WeatherIcon} label="Weather" value={weather || "Clear"} />
        <MetricTile icon={HardHat} label="Crew" value={crewCount} />
        <MetricTile icon={Wrench} label="Active Trades" value={activeTrades} />
        <MetricTile icon={PlayCircle} label="Starting" value={tasksStarting} />
        <MetricTile icon={CheckSquare} label="Finishing" value={tasksFinishing} />
        <MetricTile icon={AlertTriangle} label="Blockers" value={blockedCount} variant="warning" />
      </div>
    </div>
  );
};
