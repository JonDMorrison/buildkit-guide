import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  ChevronDown,
  ArrowRightLeft,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePendingTimeRequests, TimeAdjustmentRequest } from '@/hooks/usePendingTimeRequests';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { NoAccess } from '@/components/NoAccess';
import { useCurrentProject } from '@/hooks/useCurrentProject';

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missed_check_in: 'Missed Check-In',
  missed_check_out: 'Missed Check-Out',
  change_times: 'Time Change',
  change_job_site: 'Job Site Change',
  add_note: 'Add Note',
  add_manual_entry: 'Manual Entry',
};

function getWarningBadges(request: TimeAdjustmentRequest) {
  const badges: React.ReactNode[] = [];

  // Manual entry warning
  if (request.request_type === 'add_manual_entry') {
    badges.push(
      <Badge key="manual" variant="outline" className="text-xs">
        Manual Entry
      </Badge>
    );
  }

  return badges;
}

export default function TimeRequestsReview() {
  const { currentProjectId } = useCurrentProject();
  const { data: requests = [], isLoading, refetch } = usePendingTimeRequests(currentProjectId || undefined);
  const { canReviewRequests, isLoading: roleLoading } = useOrganizationRole();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<TimeAdjustmentRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'denied' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReview = async () => {
    if (!reviewingRequest || !reviewDecision) return;

    if (reviewDecision === 'denied' && !reviewNote.trim()) {
      toast({
        title: 'Note Required',
        description: 'Please provide a reason for denying this request.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('time-request-review', {
        body: {
          request_id: reviewingRequest.id,
          decision: reviewDecision,
          review_note: reviewNote.trim() || null,
        },
      });

      if (error) throw error;

      if (!data?.ok) {
        throw new Error(data?.error?.message || 'Failed to review request');
      }

      toast({
        title: reviewDecision === 'approved' ? 'Request Approved' : 'Request Denied',
        description: reviewDecision === 'approved'
          ? 'The time adjustment has been applied.'
          : 'The request has been denied.',
      });

      setReviewingRequest(null);
      setReviewDecision(null);
      setReviewNote('');
      refetch();
    } catch (error) {
      console.error('Review error:', error);
      toast({
        title: 'Review Failed',
        description: error instanceof Error ? error.message : 'Failed to review request',
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

  if (!canReviewRequests) {
    return <NoAccess />;
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Time Requests</h1>
          <p className="text-muted-foreground">
            Review and approve time adjustment requests from your team
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <CheckCircle className="h-12 w-12 text-primary/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Pending Requests</h3>
                <p className="text-muted-foreground text-sm">
                  All time adjustment requests have been reviewed.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pending Requests</span>
                <Badge variant="secondary">{requests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.map((request) => (
                <Collapsible
                  key={request.id}
                  open={expandedId === request.id}
                  onOpenChange={(open) => setExpandedId(open ? request.id : null)}
                >
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4 text-left">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{request.target_user_name || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">
                              {REQUEST_TYPE_LABELS[request.request_type] || request.request_type}
                              {request.project_name && ` • ${request.project_name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-warning/20 text-warning border-warning/30">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              expandedId === request.id ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t px-4 py-4 space-y-4">
                        {/* Warning Badges */}
                        <div className="flex flex-wrap gap-2">
                          {getWarningBadges(request)}
                        </div>

                        {/* Request Details */}
                        <div className="grid gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Reason</p>
                            <p className="text-sm">{request.reason}</p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">Requested</p>
                            <p className="text-sm">
                              {format(parseISO(request.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>

                          {/* Before/After Preview */}
                          {(request.proposed_check_in_at || request.proposed_check_out_at) && (
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <ArrowRightLeft className="h-3 w-3" />
                                Proposed Changes
                              </p>
                              {request.proposed_check_in_at && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Check-In:</span>
                                  <span className="font-medium">
                                    {format(parseISO(request.proposed_check_in_at), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                              )}
                              {request.proposed_check_out_at && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Check-Out:</span>
                                  <span className="font-medium">
                                    {format(parseISO(request.proposed_check_out_at), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                              )}
                              {request.proposed_job_site_name && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Job Site:</span>
                                  <span className="font-medium">{request.proposed_job_site_name}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-destructive hover:text-destructive"
                            onClick={() => {
                              setReviewingRequest(request);
                              setReviewDecision('denied');
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setReviewingRequest(request);
                              setReviewDecision('approved');
                            }}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Review Confirmation Dialog */}
        <Dialog
          open={!!reviewingRequest && !!reviewDecision}
          onOpenChange={(open) => {
            if (!open) {
              setReviewingRequest(null);
              setReviewDecision(null);
              setReviewNote('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {reviewDecision === 'approved' ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                {reviewDecision === 'approved' ? 'Approve Request' : 'Deny Request'}
              </DialogTitle>
              <DialogDescription>
                {reviewDecision === 'approved'
                  ? 'This will apply the requested time adjustment.'
                  : 'Please provide a reason for denying this request.'}
              </DialogDescription>
            </DialogHeader>

            {reviewDecision === 'denied' && (
              <Alert variant="destructive" className="my-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  A note is required when denying a request.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="review-note">
                  Note {reviewDecision === 'denied' && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewDecision === 'approved'
                      ? 'Optional note for the worker...'
                      : 'Explain why this request is being denied...'
                  }
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReviewingRequest(null);
                  setReviewDecision(null);
                  setReviewNote('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                disabled={isSubmitting || (reviewDecision === 'denied' && !reviewNote.trim())}
                variant={reviewDecision === 'denied' ? 'destructive' : 'default'}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : reviewDecision === 'approved' ? (
                  'Confirm Approval'
                ) : (
                  'Confirm Denial'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
