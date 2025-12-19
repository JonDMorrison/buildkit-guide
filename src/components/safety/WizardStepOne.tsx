import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cloud, Users, Wrench, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepOneProps {
  projectId: string;
  projects: Array<{ id: string; name: string }>;
  onProjectChange: (id: string) => void;
  weather: string;
  onWeatherChange: (value: string) => void;
  crewCount: string;
  onCrewCountChange: (value: string) => void;
  tradesOnSite: string[];
  selectedTrades: string[];
  onTradesChange: (trades: string[]) => void;
  loading: boolean;
  onRefresh: () => void;
}

const COMMON_TRADES = [
  "Electrical",
  "Plumbing",
  "HVAC",
  "Carpentry",
  "Concrete",
  "Roofing",
  "Drywall",
  "Painting",
  "Steel",
  "Masonry",
];

export const WizardStepOne = ({
  projectId,
  projects,
  onProjectChange,
  weather,
  onWeatherChange,
  crewCount,
  onCrewCountChange,
  tradesOnSite,
  selectedTrades,
  onTradesChange,
  loading,
  onRefresh,
}: WizardStepOneProps) => {
  // Combine detected trades with common trades for fallback
  const availableTrades = useMemo(() => {
    const detected = new Set(tradesOnSite);
    const all = [...tradesOnSite];
    COMMON_TRADES.forEach((t) => {
      if (!detected.has(t)) all.push(t);
    });
    return all;
  }, [tradesOnSite]);

  const toggleTrade = (trade: string) => {
    if (selectedTrades.includes(trade)) {
      onTradesChange(selectedTrades.filter((t) => t !== trade));
    } else {
      onTradesChange([...selectedTrades, trade]);
    }
  };

  if (loading) {
    return <StepOneSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      <div className="space-y-2">
        <Label htmlFor="project" className="text-base font-medium">
          Project
        </Label>
        <Select value={projectId} onValueChange={onProjectChange}>
          <SelectTrigger className="h-14 text-base">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id} className="h-12">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Weather */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Cloud className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <Label htmlFor="weather" className="text-base font-medium">
              Weather Conditions
            </Label>
            <p className="text-sm text-muted-foreground">Auto-filled from location</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-10 w-10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Input
          id="weather"
          value={weather}
          onChange={(e) => onWeatherChange(e.target.value)}
          placeholder="e.g. 15°C, Partly Cloudy"
          className="h-12 text-base"
        />
      </Card>

      {/* Crew Count */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Users className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1">
            <Label htmlFor="crewCount" className="text-base font-medium">
              Crew Count
            </Label>
            <p className="text-sm text-muted-foreground">Workers on site today</p>
          </div>
        </div>
        <Input
          id="crewCount"
          type="number"
          min="0"
          value={crewCount}
          onChange={(e) => onCrewCountChange(e.target.value)}
          placeholder="Enter crew count"
          className="h-12 text-base"
        />
      </Card>

      {/* Trades on Site */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Wrench className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <Label className="text-base font-medium">Trades on Site</Label>
            <p className="text-sm text-muted-foreground">
              {tradesOnSite.length > 0
                ? `${tradesOnSite.length} detected from check-ins`
                : "Select trades working today"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableTrades.map((trade) => {
            const isSelected = selectedTrades.includes(trade);
            const isDetected = tradesOnSite.includes(trade);
            return (
              <Badge
                key={trade}
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "cursor-pointer px-3 py-2 h-10 text-sm transition-all",
                  "active:scale-95 touch-manipulation select-none",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isDetected
                    ? "border-green-500/50 bg-green-500/10 hover:bg-green-500/20"
                    : "hover:bg-accent"
                )}
                onClick={() => toggleTrade(trade)}
              >
                {trade}
                {isDetected && !isSelected && (
                  <span className="ml-1 text-green-600">•</span>
                )}
              </Badge>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

const StepOneSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-14 w-full" />
    </div>
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-40 w-full" />
  </div>
);
