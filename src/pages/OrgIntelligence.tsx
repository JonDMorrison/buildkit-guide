import { Layout } from "@/components/Layout";
import { useUserRole } from "@/hooks/useUserRole";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Loader2,
  Building2,
  Target,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  useOrgIntelligence,
  type TradePerformance,
  type JobTypeRisk,
  type DeficiencyPattern,
  type TopInsight,
} from "@/hooks/useOrgIntelligence";

export default function OrgIntelligence() {
  const { isAdmin, isPM, loading: roleLoading } = useUserRole();

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isPM) {
    return (
      <Layout>
        <NoAccess message="Admin or PM access required." />
      </Layout>
    );
  }

  return (
    <Layout>
      <OrgIntelligenceContent />
    </Layout>
  );
}

function OrgIntelligenceContent() {
  const { data, isLoading, isError, refetch, isFetching } = useOrgIntelligence();

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-20">
          <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Unable to generate intelligence. Check your connection.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data || data.org_health.total_projects === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Header generatedAt={null} onRefresh={refetch} isFetching={false} />
        <div className="text-center py-20">
          <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Not enough data yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Complete more projects to unlock org-level insights. You need at least 2 completed projects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <Header
        generatedAt={data.generated_at}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {/* Org Health Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={data.org_health.total_projects} icon={Building2} />
        <StatCard label="Active Projects" value={data.org_health.active_projects} icon={Target} />
        <StatCard label="Avg Margin" value={`${data.org_health.avg_margin}%`} icon={TrendingUp} />
        <StatCard label="Task Completion" value={`${data.org_health.task_completion_rate}%`} icon={CheckCircle2} />
      </div>

      {/* Top Insights */}
      {data.top_insights.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Key Findings
          </h2>
          <div className="grid gap-3">
            {data.top_insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Trade Performance */}
      {data.trade_performance.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Trade Performance
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Trade</th>
                      <th className="px-4 py-3 font-medium">Projects</th>
                      <th className="px-4 py-3 font-medium">Variance</th>
                      <th className="px-4 py-3 font-medium">Reliability</th>
                      <th className="px-4 py-3 font-medium">Signal</th>
                      <th className="px-4 py-3 font-medium">Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trade_performance.map((tp) => (
                      <TradeRow key={tp.trade} trade={tp} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Job Type Risk Matrix */}
      {data.job_type_risks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Job Type Risk Profiles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.job_type_risks.map((jt) => (
              <JobTypeCard key={jt.job_type} risk={jt} />
            ))}
          </div>
        </section>
      )}

      {/* Deficiency Patterns */}
      {data.deficiency_patterns.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Deficiency Patterns
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Trade</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Projects</th>
                      <th className="px-4 py-3 font-medium">Avg Resolution</th>
                      <th className="px-4 py-3 font-medium">Insight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deficiency_patterns.map((dp) => (
                      <tr key={dp.trade} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{dp.trade}</td>
                        <td className="px-4 py-3">{dp.total_deficiencies}</td>
                        <td className="px-4 py-3">{dp.projects_affected}</td>
                        <td className="px-4 py-3">
                          {dp.avg_resolution_hours != null
                            ? `${dp.avg_resolution_hours}h`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[250px]">
                          {dp.insight}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Data quality note */}
      {data.data_quality_note && (
        <p className="text-xs text-muted-foreground/60 text-center pt-4">
          {data.data_quality_note}
        </p>
      )}
    </div>
  );
}

// --- Subcomponents ---

function Header({
  generatedAt,
  onRefresh,
  isFetching,
}: {
  generatedAt: string | null;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Org Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Patterns across all your projects
        </p>
        {generatedAt && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Last analyzed: {format(new Date(generatedAt), "MMM d, h:mm a")}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        className="gap-1.5"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight }: { insight: TopInsight }) {
  const priorityStyles: Record<string, string> = {
    high: "border-l-4 border-l-red-500 bg-red-950/10",
    medium: "border-l-4 border-l-amber-500",
    low: "border-l-4 border-l-blue-500",
  };

  const categoryColors: Record<string, string> = {
    trade: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    job_type: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    deficiency: "bg-red-500/15 text-red-400 border-red-500/30",
    financial: "bg-green-500/15 text-green-400 border-green-500/30",
  };

  return (
    <Card className={cn("shadow-none", priorityStyles[insight.priority] || "")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge
            variant="outline"
            className={cn("text-[9px] h-4 px-1.5 font-semibold", categoryColors[insight.category] || "")}
          >
            {insight.category.replace("_", " ").toUpperCase()}
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5"
          >
            {insight.priority.toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm font-semibold mb-1">{insight.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
      </CardContent>
    </Card>
  );
}

function TradeRow({ trade }: { trade: TradePerformance }) {
  const signalStyles: Record<string, { color: string; label: string }> = {
    over_budget: { color: "bg-red-500/15 text-red-400 border-red-500/30", label: "Over Budget" },
    on_track: { color: "bg-green-500/15 text-green-400 border-green-500/30", label: "On Track" },
    under_budget: { color: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Under Budget" },
  };

  const signal = signalStyles[trade.signal] || signalStyles.on_track;

  return (
    <tr className="border-b last:border-0">
      <td className="px-4 py-3 font-medium">{trade.trade}</td>
      <td className="px-4 py-3">{trade.projects_worked}</td>
      <td className="px-4 py-3">
        <span className={cn(
          "font-mono text-xs",
          trade.variance_pct > 10 ? "text-red-400" : trade.variance_pct < -10 ? "text-blue-400" : "text-green-400"
        )}>
          {trade.variance_pct >= 0 ? "+" : ""}{trade.variance_pct}%
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Progress value={trade.reliability_score} className="h-1.5 w-16" />
          <span className="text-xs text-muted-foreground tabular-nums">{trade.reliability_score}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", signal.color)}>
          {signal.label}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px]">{trade.insight}</td>
    </tr>
  );
}

function JobTypeCard({ risk }: { risk: JobTypeRisk }) {
  const riskStyles: Record<string, string> = {
    high: "border-amber-500/50",
    medium: "border-border",
    low: "border-border",
  };

  const riskBadgeStyles: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/30",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    low: "bg-green-500/15 text-green-400 border-green-500/30",
  };

  return (
    <Card className={cn("shadow-none border", riskStyles[risk.risk_level] || "")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{risk.job_type}</span>
          <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 font-semibold", riskBadgeStyles[risk.risk_level] || "")}>
            {risk.risk_level.toUpperCase()} RISK
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs mb-2">
          <div>
            <span className="text-muted-foreground">Projects</span>
            <p className="font-semibold">{risk.project_count}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Margin</span>
            <p className="font-semibold">{risk.avg_margin != null ? `${risk.avg_margin}%` : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Def/Project</span>
            <p className="font-semibold">{risk.deficiencies_per_project}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{risk.insight}</p>
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
