import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  AlertTriangle,
  User,
  Calendar,
  Filter,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useOrganizationTimesheetPeriods,
  TimesheetPeriod,
} from '@/hooks/useTimesheetPeriods';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NoAccess } from '@/components/NoAccess';

function getStatusBadge(status: string) {
  switch (status) {
    case 'open':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Open
        </Badge>
      );
    case 'submitted':
      return (
        <Badge className="bg-warning/20 text-warning border-warning/30">
          <FileText className="h-3 w-3 mr-1" />
          Submitted
        </Badge>
      );
    case 'approved':
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case 'locked':
      return (
        <Badge className="bg-muted text-muted-foreground">
          <Lock className="h-3 w-3 mr-1" />
          Locked
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function TimesheetPeriods() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: periods = [], isLoading, refetch } = useOrganizationTimesheetPeriods(
    statusFilter === 'all' ? undefined : statusFilter
  );
  const { canLockPeriods, canApproveTimesheets, isLoading: roleLoading } = useOrganizationRole();
  const { toast } = useToast();
  const [actionPeriod, setActionPeriod] = useState<TimesheetPeriod | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'lock' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async () => {
    if (!actionPeriod || !actionType) return;

    setIsSubmitting(true);

    try {
      const endpoint = actionType === 'approve' ? 'time-period-approve' : 'time-period-lock';
      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: { period_id: actionPeriod.id },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: actionType === 'approve' ? 'Period Approved' : 'Period Locked',
        description:
          actionType === 'approve'
            ? 'The timesheet period has been approved.'
            : 'The timesheet period has been locked for payroll.',
      });

      setActionPeriod(null);
      setActionType(null);
      refetch();
    } catch (error) {
      console.error('Action error:', error);
      toast({
        title: 'Action Failed',
        description: error instanceof Error ? error.message : 'Failed to process action',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!canApproveTimesheets && !canLockPeriods) {
    return <NoAccess />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Timesheet Periods</h1>
            <p className="text-muted-foreground">
              {canLockPeriods
                ? 'Review, approve, and lock timesheet periods for payroll'
                : 'Review and approve team timesheet submissions'}
            </p>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : periods.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Timesheet Periods</h3>
                <p className="text-muted-foreground text-sm">
                  {statusFilter !== 'all'
                    ? `No periods with status "${statusFilter}" found.`
                    : 'No timesheet periods have been created yet.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {periods.map((period) => (
              <Card key={period.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{period.user_name || 'Unknown User'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(period.period_start), 'MMM d')} –{' '}
                          {format(parseISO(period.period_end), 'MMM d, yyyy')}
                        </p>
                        {period.submitted_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted {format(parseISO(period.submitted_at), 'MMM d, h:mm a')}
                          </p>
                        )}
                        {period.approved_at && period.approver_name && (
                          <p className="text-xs text-muted-foreground">
                            Approved by {period.approver_name}
                          </p>
                        )}
                        {period.locked_at && period.locker_name && (
                          <p className="text-xs text-muted-foreground">
                            Locked by {period.locker_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(period.status)}

                      <div className="flex gap-2">
                        {period.status === 'submitted' && canApproveTimesheets && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActionPeriod(period);
                              setActionType('approve');
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}

                        {period.status === 'approved' && canLockPeriods && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setActionPeriod(period);
                              setActionType('lock');
                            }}
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Lock
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Confirmation Dialog */}
        <Dialog
          open={!!actionPeriod && !!actionType}
          onOpenChange={(open) => {
            if (!open) {
              setActionPeriod(null);
              setActionType(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionType === 'approve' ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <Lock className="h-5 w-5" />
                )}
                {actionType === 'approve' ? 'Approve Timesheet Period' : 'Lock Timesheet Period'}
              </DialogTitle>
              <DialogDescription>
                {actionPeriod && (
                  <>
                    {actionPeriod.user_name}'s timesheet for{' '}
                    {format(parseISO(actionPeriod.period_start), 'MMM d')} –{' '}
                    {format(parseISO(actionPeriod.period_end), 'MMM d, yyyy')}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {actionType === 'lock' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Locked periods cannot be edited by supervisors. Only
                  HR/Admin can make adjustments after locking.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActionPeriod(null);
                  setActionType(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={isSubmitting}
                variant={actionType === 'lock' ? 'secondary' : 'default'}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : actionType === 'approve' ? (
                  'Confirm Approval'
                ) : (
                  'Confirm Lock'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
