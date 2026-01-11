import { format, parseISO } from 'date-fns';
import { Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TimeAdjustmentRequest, useMyTimeRequests } from '@/hooks/usePendingTimeRequests';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const REQUEST_TYPE_LABELS: Record<string, string> = {
  missed_check_in: 'Missed Check-In',
  missed_check_out: 'Missed Check-Out',
  change_times: 'Time Change',
  change_job_site: 'Job Site Change',
  add_note: 'Add Note',
  add_manual_entry: 'Manual Entry',
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-warning/20 text-warning border-warning/30">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'approved':
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case 'denied':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Denied
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function MyRequestsList() {
  const { data: requests = [], isLoading, refetch } = useMyTimeRequests();
  const { toast } = useToast();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCancel = async (requestId: string) => {
    setCancellingId(requestId);
    try {
      const { data, error } = await supabase.functions.invoke('time-request-cancel', {
        body: { request_id: requestId },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Request Cancelled',
        description: 'Your adjustment request has been cancelled.',
      });

      refetch();
    } catch (error) {
      console.error('Cancel error:', error);
      toast({
        title: 'Cancel Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel request',
        variant: 'destructive',
      });
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
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
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            My Adjustment Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No pending adjustment requests</p>
            <p className="text-xs mt-1">Requests you submit will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          My Adjustment Requests
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
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <p className="font-medium text-sm">
                        {REQUEST_TYPE_LABELS[request.request_type] || request.request_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(request.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(request.status)}
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        expandedId === request.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t px-3 py-3 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="text-sm">{request.reason}</p>
                  </div>

                  {request.proposed_check_in_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Proposed Check-In</p>
                      <p className="text-sm">
                        {format(parseISO(request.proposed_check_in_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  )}

                  {request.proposed_check_out_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Proposed Check-Out</p>
                      <p className="text-sm">
                        {format(parseISO(request.proposed_check_out_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  )}

                  {request.proposed_job_site_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Proposed Job Site</p>
                      <p className="text-sm">{request.proposed_job_site_name}</p>
                    </div>
                  )}

                  {request.review_note && (
                    <div className="bg-muted/50 rounded p-2">
                      <p className="text-xs text-muted-foreground">Reviewer Note</p>
                      <p className="text-sm">{request.review_note}</p>
                    </div>
                  )}

                  {request.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCancel(request.id)}
                      disabled={cancellingId === request.id}
                    >
                      {cancellingId === request.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Request'
                      )}
                    </Button>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
