import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, TrendingUp, CheckCircle, Lightbulb } from "lucide-react";
import { format } from "date-fns";

interface DelayedTask {
  task_id: string;
  task_title: string;
  original_date?: string;
  new_estimated_date?: string;
  delay_days?: number;
  reason: string;
}

interface ForecastData {
  delayed_tasks: DelayedTask[];
  schedule_slip_days: number;
  critical_path_impact: string;
  mitigation_options: string[];
  summary: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

interface DelayForecastModalProps {
  isOpen: boolean;
  onClose: () => void;
  forecast: ForecastData | null;
  isLoading: boolean;
}

export const DelayForecastModal = ({
  isOpen,
  onClose,
  forecast,
  isLoading,
}: DelayForecastModalProps) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-600';
      case 'medium':
        return 'bg-yellow-600';
      case 'low':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'critical':
        return 'CRITICAL';
      case 'high':
        return 'HIGH RISK';
      case 'medium':
        return 'MEDIUM RISK';
      case 'low':
        return 'LOW RISK';
      default:
        return 'UNKNOWN';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Schedule Delay Forecast
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Analyzing project schedule...</p>
          </div>
        )}

        {!isLoading && forecast && (
          <div className="space-y-6">
            {/* Risk Level Badge */}
            <div className="flex items-center justify-between">
              <Badge className={`${getRiskColor(forecast.risk_level)} text-white px-4 py-2 text-sm`}>
                {getRiskLabel(forecast.risk_level)}
              </Badge>
              {forecast.schedule_slip_days > 0 && (
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <AlertTriangle className="h-5 w-5" />
                  {forecast.schedule_slip_days} Day{forecast.schedule_slip_days !== 1 ? 's' : ''} Slip
                </div>
              )}
            </div>

            {/* Summary */}
            <Card className="p-4 bg-muted/50">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Summary
              </h3>
              <p className="text-sm text-foreground">{forecast.summary}</p>
            </Card>

            {/* Critical Path Impact */}
            {forecast.critical_path_impact && (
              <Card className="p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Critical Path Impact
                </h3>
                <p className="text-sm text-muted-foreground">{forecast.critical_path_impact}</p>
              </Card>
            )}

            {/* Delayed Tasks */}
            {forecast.delayed_tasks.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Tasks at Risk ({forecast.delayed_tasks.length})
                </h3>
                <div className="space-y-3">
                  {forecast.delayed_tasks.map((task) => (
                    <Card key={task.task_id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="font-medium">{task.task_title}</p>
                          {task.delay_days && task.delay_days > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              +{task.delay_days}d
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{task.reason}</p>
                        {task.original_date && task.new_estimated_date && (
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
                            <span>Original: {format(new Date(task.original_date), 'MMM d, yyyy')}</span>
                            <span>→</span>
                            <span>New Est: {format(new Date(task.new_estimated_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Mitigation Options */}
            {forecast.mitigation_options.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                  Recommended Actions
                </h3>
                <div className="space-y-2">
                  {forecast.mitigation_options.map((option, idx) => (
                    <Card key={idx} className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-foreground flex items-start gap-2">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 min-w-[1.5rem]">
                          {idx + 1}.
                        </span>
                        <span>{option}</span>
                      </p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {forecast.delayed_tasks.length === 0 && forecast.schedule_slip_days === 0 && (
              <Card className="p-6 text-center bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
                <p className="text-foreground font-medium">No forecasted delays</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Based on current information, the project schedule appears on track.
                </p>
              </Card>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={onClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !forecast && (
          <div className="py-12 text-center text-muted-foreground">
            <p>No forecast data available.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
