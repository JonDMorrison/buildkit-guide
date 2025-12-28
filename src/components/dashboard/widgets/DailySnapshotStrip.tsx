import { memo } from "react";
import { CloudRain, HardHat, Wrench, PlayCircle, CheckSquare, AlertTriangle, Sun, Cloud, CloudSnow, ChevronRight } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  start_date: string | null;
  location: string | null;
  assigned_trade?: {
    name: string;
    trade_type?: string;
  } | null;
}

interface Trade {
  id: string;
  name: string;
  trade_type: string;
  taskCount: number;
}

interface DailySnapshotStripProps {
  weather: string | null;
  crewCount: number;
  activeTrades: number;
  tasksStarting: number;
  tasksFinishing: number;
  blockedCount: number;
  // Click handlers
  onWeatherClick?: () => void;
  onCrewClick?: () => void;
  onTradesClick?: () => void;
  onStartingClick?: () => void;
  onFinishingClick?: () => void;
  onBlockersClick?: () => void;
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
  onClick?: () => void;
  clickable?: boolean;
}

const MetricTile = ({ icon: Icon, label, value, variant = "default", onClick, clickable = true }: MetricTileProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!clickable || !onClick}
    className={`metric-tile w-full text-left ${clickable && onClick ? "cursor-pointer hover:bg-accent/5 hover:border-primary/30 active:scale-[0.98]" : ""} transition-all`}
    role={clickable && onClick ? "button" : undefined}
    tabIndex={clickable && onClick ? 0 : -1}
  >
    <div className={`metric-icon ${variant === "warning" ? "bg-accent/20" : "bg-primary/10"}`}>
      <Icon className={`h-4 w-4 ${variant === "warning" ? "text-accent" : "text-primary"}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="metric-label truncate">{label}</p>
      <p className={`metric-value ${variant === "warning" ? "text-accent" : ""}`}>{value}</p>
    </div>
    {clickable && onClick && (
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
    )}
  </button>
);

export const DailySnapshotStrip = memo(function DailySnapshotStrip({
  weather,
  crewCount,
  activeTrades,
  tasksStarting,
  tasksFinishing,
  blockedCount,
  onWeatherClick,
  onCrewClick,
  onTradesClick,
  onStartingClick,
  onFinishingClick,
  onBlockersClick,
}: DailySnapshotStripProps) {
  const WeatherIcon = getWeatherIcon(weather);
  
  return (
    <div className="widget-card !p-3 md:!p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile icon={WeatherIcon} label="Weather" value={weather || "Clear"} onClick={onWeatherClick} />
        <MetricTile icon={HardHat} label="Crew" value={crewCount} onClick={onCrewClick} />
        <MetricTile icon={Wrench} label="Active Trades" value={activeTrades} onClick={onTradesClick} />
        <MetricTile icon={PlayCircle} label="Starting" value={tasksStarting} onClick={onStartingClick} />
        <MetricTile icon={CheckSquare} label="Finishing" value={tasksFinishing} onClick={onFinishingClick} />
        <MetricTile icon={AlertTriangle} label="Blockers" value={blockedCount} variant="warning" onClick={onBlockersClick} />
      </div>
    </div>
  );
});

export type { Task as SnapshotTask, Trade as SnapshotTrade };
