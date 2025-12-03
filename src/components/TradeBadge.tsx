import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

type TradeType = 
  | "electrical" 
  | "plumbing" 
  | "hvac" 
  | "framing" 
  | "drywall" 
  | "concrete"
  | "roofing"
  | "flooring"
  | "painting"
  | "glazing"
  | "fire_protection"
  | "masonry"
  | "elevator"
  | "general";

interface TradeBadgeProps {
  trade: string;
  className?: string;
}

const tradeConfig: Record<string, { label: string; className: string }> = {
  electrical: { 
    label: "Electrical", 
    className: "bg-yellow-100 text-yellow-900 border-yellow-300" 
  },
  plumbing: { 
    label: "Plumbing", 
    className: "bg-blue-100 text-blue-900 border-blue-300" 
  },
  hvac: { 
    label: "HVAC", 
    className: "bg-cyan-100 text-cyan-900 border-cyan-300" 
  },
  framing: { 
    label: "Framing", 
    className: "bg-amber-100 text-amber-900 border-amber-300" 
  },
  drywall: { 
    label: "Drywall", 
    className: "bg-slate-100 text-slate-900 border-slate-300" 
  },
  concrete: { 
    label: "Concrete", 
    className: "bg-stone-100 text-stone-900 border-stone-300" 
  },
  roofing: { 
    label: "Roofing", 
    className: "bg-red-100 text-red-900 border-red-300" 
  },
  flooring: { 
    label: "Flooring", 
    className: "bg-orange-100 text-orange-900 border-orange-300" 
  },
  painting: { 
    label: "Painting", 
    className: "bg-purple-100 text-purple-900 border-purple-300" 
  },
  glazing: { 
    label: "Glazing", 
    className: "bg-sky-100 text-sky-900 border-sky-300" 
  },
  fire_protection: { 
    label: "Fire Protection", 
    className: "bg-rose-100 text-rose-900 border-rose-300" 
  },
  masonry: { 
    label: "Masonry", 
    className: "bg-amber-100 text-amber-900 border-amber-300" 
  },
  elevator: { 
    label: "Elevator", 
    className: "bg-indigo-100 text-indigo-900 border-indigo-300" 
  },
  general: { 
    label: "General", 
    className: "bg-gray-100 text-gray-900 border-gray-300" 
  },
};

const defaultConfig = { 
  label: "Trade", 
  className: "bg-gray-100 text-gray-900 border-gray-300" 
};

export const TradeBadge = ({ trade, className }: TradeBadgeProps) => {
  const config = tradeConfig[trade] || defaultConfig;
  const displayLabel = tradeConfig[trade] ? config.label : trade.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, "text-xs font-medium", className)}
    >
      {displayLabel}
    </Badge>
  );
};