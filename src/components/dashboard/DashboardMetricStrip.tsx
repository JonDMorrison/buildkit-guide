import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Snowflake, 
  Users, 
  HardHat, 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { cn } from "@/lib/utils";

interface DashboardMetricStripProps {
  weather: string | null;
  crewCount: number;
  activeTrades: number;
  tasksStarting: number;
  tasksFinishing: number;
  blockedCount: number;
  onWeatherClick?: () => void;
  onCrewClick?: () => void;
  onTradesClick?: () => void;
  onStartingClick?: () => void;
  onFinishingClick?: () => void;
  onBlockersClick?: () => void;
  isLoading?: boolean;
}

const getWeatherIcon = (weather: string | null) => {
  if (!weather) return Cloud;
  const w = weather.toLowerCase();
  if (w.includes("sun") || w.includes("clear")) return Sun;
  if (w.includes("rain")) return CloudRain;
  if (w.includes("snow")) return Snowflake;
  return Cloud;
};

const getWeatherDisplay = (weather: string | null): string => {
  if (!weather) return "No data";
  // Truncate long weather strings
  return weather.length > 12 ? weather.slice(0, 12) + "…" : weather;
};

export const DashboardMetricStrip = ({
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
  isLoading = false,
}: DashboardMetricStripProps) => {
  const WeatherIcon = getWeatherIcon(weather);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <DashboardMetricCard
        icon={WeatherIcon}
        label="Weather"
        value={getWeatherDisplay(weather)}
        onClick={onWeatherClick}
        variant="info"
        isLoading={isLoading}
      />
      <DashboardMetricCard
        icon={Users}
        label="Crew on Site"
        value={crewCount}
        onClick={onCrewClick}
        variant="default"
        isLoading={isLoading}
      />
      <DashboardMetricCard
        icon={HardHat}
        label="Active Trades"
        value={activeTrades}
        onClick={onTradesClick}
        variant="default"
        isLoading={isLoading}
      />
      <DashboardMetricCard
        icon={PlayCircle}
        label="Starting Today"
        value={tasksStarting}
        onClick={onStartingClick}
        variant="success"
        isLoading={isLoading}
      />
      <DashboardMetricCard
        icon={CheckCircle2}
        label="Finishing Today"
        value={tasksFinishing}
        onClick={onFinishingClick}
        variant="success"
        isLoading={isLoading}
      />
      <DashboardMetricCard
        icon={AlertTriangle}
        label="Blockers"
        value={blockedCount}
        onClick={onBlockersClick}
        variant={blockedCount > 0 ? "warning" : "default"}
        isLoading={isLoading}
      />
    </div>
  );
};