import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface VarianceCardProps {
  label: string;
  planned: number;
  actual: number;
  unit: "$" | "h" | "%";
  icon?: React.ReactNode;
  unavailableMessage?: string;
  /** When true, planned is treated as "not set" — shows "Not set" instead of 0 */
  budgetMissing?: boolean;
  /** Project ID for budget link */
  projectId?: string;
}

const fmt = (value: number, unit: "$" | "h" | "%") => {
  if (unit === "$") return formatCurrency(value);
  if (unit === "h") return `${formatNumber(value)} hrs`;
  return `${value.toFixed(1)}%`;
};

export const VarianceCard = ({
  label,
  planned,
  actual,
  unit,
  icon,
  unavailableMessage,
  budgetMissing,
  projectId,
}: VarianceCardProps) => {
  const navigate = useNavigate();

  if (unavailableMessage) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{unavailableMessage}</p>
        </CardContent>
      </Card>
    );
  }

  // Budget not set — show actual but flag planned as missing
  if (budgetMissing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(actual, unit)}</div>
          <p className="text-xs text-muted-foreground mb-2">
            Planned: <span className="italic">Not set</span>
          </p>
          <Badge
            variant="secondary"
            className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
            onClick={() => projectId && navigate(`/projects/${projectId}?tab=financials`)}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Set up budget →
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // delta = planned - actual (positive means under budget / ahead)
  const delta = planned - actual;
  const pct = planned !== 0 ? (delta / planned) * 100 : 0;
  const isPositive = delta > 0;
  const isZero = Math.abs(delta) < 0.01;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{fmt(actual, unit)}</div>
        <p className="text-xs text-muted-foreground mb-2">
          Planned: {fmt(planned, unit)}
        </p>
        <Badge
          variant={isZero ? "secondary" : isPositive ? "default" : "destructive"}
          className="text-xs"
        >
          {isZero ? (
            <Minus className="h-3 w-3 mr-1" />
          ) : isPositive ? (
            <TrendingDown className="h-3 w-3 mr-1" />
          ) : (
            <TrendingUp className="h-3 w-3 mr-1" />
          )}
          {isZero
            ? "On target"
            : `${fmt(Math.abs(delta), unit)} ${isPositive ? "under" : "over"} (${Math.abs(pct).toFixed(1)}%)`}
        </Badge>
      </CardContent>
    </Card>
  );
};
