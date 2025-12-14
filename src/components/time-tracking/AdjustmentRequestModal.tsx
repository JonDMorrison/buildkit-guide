import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Loader2, Clock, MapPin, FileText, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TimeEntry } from '@/hooks/useRecentTimeEntries';
import { JobSite } from '@/hooks/useJobSites';

type RequestType =
  | 'missed_check_in'
  | 'missed_check_out'
  | 'change_times'
  | 'change_job_site'
  | 'add_note'
  | 'add_manual_entry';

interface AdjustmentRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null; // Existing entry to adjust (optional for manual entry)
  projectId: string;
  jobSites: JobSite[];
  onSuccess: () => void;
}

const REQUEST_TYPE_LABELS: Record<RequestType, { label: string; description: string }> = {
  missed_check_in: {
    label: 'Missed Check-In',
    description: 'I forgot to check in when I arrived',
  },
  missed_check_out: {
    label: 'Missed Check-Out',
    description: 'I forgot to check out when I left',
  },
  change_times: {
    label: 'Change Times',
    description: 'The check-in or check-out time is wrong',
  },
  change_job_site: {
    label: 'Change Job Site',
    description: 'I selected the wrong job site',
  },
  add_note: {
    label: 'Add Note',
    description: 'I need to add notes to this entry',
  },
  add_manual_entry: {
    label: 'Add Manual Entry',
    description: 'I need to add a time entry that was never recorded',
  },
};

export function AdjustmentRequestModal({
  open,
  onOpenChange,
  entry,
  projectId,
  jobSites,
  onSuccess,
}: AdjustmentRequestModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [reason, setReason] = useState('');
  const [proposedCheckIn, setProposedCheckIn] = useState('');
  const [proposedCheckOut, setProposedCheckOut] = useState('');
  const [proposedJobSiteId, setProposedJobSiteId] = useState('');
  const [proposedNotes, setProposedNotes] = useState('');

  const resetForm = () => {
    setRequestType(null);
    setReason('');
    setProposedCheckIn('');
    setProposedCheckOut('');
    setProposedJobSiteId('');
    setProposedNotes('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!requestType || !reason.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a request type and provide a reason.',
        variant: 'destructive',
      });
      return;
    }

    // Validate required fields per request type
    if (requestType === 'missed_check_out' && !entry) {
      toast({
        title: 'Entry Required',
        description: 'Missed check-out requires an existing time entry.',
        variant: 'destructive',
      });
      return;
    }

    if (requestType === 'add_manual_entry' && (!proposedCheckIn || !proposedCheckOut)) {
      toast({
        title: 'Times Required',
        description: 'Manual entry requires both check-in and check-out times.',
        variant: 'destructive',
      });
      return;
    }

    if (requestType === 'change_times' && !proposedCheckIn && !proposedCheckOut) {
      toast({
        title: 'Times Required',
        description: 'Please provide at least one time to change.',
        variant: 'destructive',
      });
      return;
    }

    if (requestType === 'change_job_site' && !proposedJobSiteId) {
      toast({
        title: 'Job Site Required',
        description: 'Please select a job site.',
        variant: 'destructive',
      });
      return;
    }

    if (requestType === 'add_note' && !proposedNotes.trim()) {
      toast({
        title: 'Note Required',
        description: 'Please enter the note to add.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build request body
      const body: Record<string, any> = {
        project_id: projectId,
        request_type: requestType,
        reason: reason.trim(),
      };

      if (entry?.id) {
        body.time_entry_id = entry.id;
      }

      if (proposedCheckIn) {
        body.proposed_check_in_at = new Date(proposedCheckIn).toISOString();
      }

      if (proposedCheckOut) {
        body.proposed_check_out_at = new Date(proposedCheckOut).toISOString();
      }

      if (proposedJobSiteId) {
        body.proposed_job_site_id = proposedJobSiteId;
      }

      if (proposedNotes.trim()) {
        body.proposed_notes = proposedNotes.trim();
      }

      const { data, error } = await supabase.functions.invoke('time-request-create', {
        body,
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Request Submitted',
        description: 'Your adjustment request is pending approval.',
      });

      handleClose();
      onSuccess();
    } catch (error) {
      console.error('Adjustment request error:', error);
      toast({
        title: 'Request Failed',
        description: error instanceof Error ? error.message : 'Failed to submit request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available request types depend on whether we have an existing entry
  const availableTypes: RequestType[] = entry
    ? ['missed_check_out', 'change_times', 'change_job_site', 'add_note']
    : ['missed_check_in', 'add_manual_entry'];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Request Time Adjustment
          </DialogTitle>
          <DialogDescription>
            {entry
              ? `Adjust entry from ${format(parseISO(entry.check_in_at), 'MMM d, h:mm a')}`
              : 'Request a correction to your time records'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warnings */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <ul className="list-disc list-inside space-y-1">
                <li>Overlapping time entries will be rejected</li>
                <li>Approved timesheets may be locked and unchangeable</li>
                <li>Your supervisor will review this request</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Request Type Selection */}
          <div className="space-y-3">
            <Label>What needs to be corrected?</Label>
            <RadioGroup
              value={requestType || ''}
              onValueChange={(value) => setRequestType(value as RequestType)}
              className="space-y-2"
            >
              {availableTypes.map((type) => (
                <div
                  key={type}
                  className="flex items-start space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setRequestType(type)}
                >
                  <RadioGroupItem value={type} id={type} className="mt-1" />
                  <Label htmlFor={type} className="flex-1 cursor-pointer">
                    <span className="font-medium">{REQUEST_TYPE_LABELS[type].label}</span>
                    <p className="text-sm text-muted-foreground">
                      {REQUEST_TYPE_LABELS[type].description}
                    </p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Dynamic Fields Based on Request Type */}
          {requestType && (
            <div className="space-y-4">
              {/* Check-In Time */}
              {(requestType === 'missed_check_in' ||
                requestType === 'change_times' ||
                requestType === 'add_manual_entry') && (
                <div className="space-y-2">
                  <Label htmlFor="check-in" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {requestType === 'change_times' ? 'New Check-In Time' : 'Check-In Time'}
                    {requestType !== 'change_times' && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id="check-in"
                    type="datetime-local"
                    value={proposedCheckIn}
                    onChange={(e) => setProposedCheckIn(e.target.value)}
                  />
                </div>
              )}

              {/* Check-Out Time */}
              {(requestType === 'missed_check_out' ||
                requestType === 'change_times' ||
                requestType === 'add_manual_entry') && (
                <div className="space-y-2">
                  <Label htmlFor="check-out" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {requestType === 'change_times' ? 'New Check-Out Time' : 'Check-Out Time'}
                    {requestType !== 'change_times' && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id="check-out"
                    type="datetime-local"
                    value={proposedCheckOut}
                    onChange={(e) => setProposedCheckOut(e.target.value)}
                  />
                </div>
              )}

              {/* Job Site Selection */}
              {(requestType === 'change_job_site' || requestType === 'add_manual_entry') && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Job Site
                    {requestType === 'change_job_site' && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <Select value={proposedJobSiteId} onValueChange={setProposedJobSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job site" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobSites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              {requestType === 'add_note' && (
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Note <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="notes"
                    value={proposedNotes}
                    onChange={(e) => setProposedNotes(e.target.value)}
                    placeholder="Enter the note to add..."
                    rows={3}
                  />
                </div>
              )}

              {/* Reason (always required) */}
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason for Request <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this adjustment is needed..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !requestType}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
