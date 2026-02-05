import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { DatePicker } from '../ui/date-picker';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface RequestManpowerModalProps {
  taskId: string;
  projectId: string;
  tradeId: string;
  taskTitle: string;
  taskStatus: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const RequestManpowerModal = ({
  taskId,
  projectId,
  tradeId,
  taskTitle,
  taskStatus,
  open,
  onOpenChange,
  onSuccess,
}: RequestManpowerModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requested_count: '',
    required_date: '',
    duration_days: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.requested_count || parseInt(form.requested_count) < 1) {
      newErrors.requested_count = 'Workers needed must be at least 1';
    }

    if (!form.required_date) {
      newErrors.required_date = 'Start date is required';
    }

    if (!form.duration_days || parseInt(form.duration_days) < 1) {
      newErrors.duration_days = 'Duration must be at least 1 day';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('manpower_requests').insert({
        task_id: taskId,
        project_id: projectId,
        trade_id: tradeId,
        requested_count: parseInt(form.requested_count),
        required_date: form.required_date,
        duration_days: parseInt(form.duration_days),
        reason: form.reason.trim() || 'Manpower needed for task',
        created_by: user!.id,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Manpower requested',
        description: 'Your request has been submitted for approval',
      });

      setForm({
        requested_count: '',
        required_date: '',
        duration_days: '',
        reason: '',
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error submitting request',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Request Manpower</DialogTitle>
          <DialogDescription>For task: {taskTitle}</DialogDescription>
        </DialogHeader>

        {taskStatus === 'blocked' && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-600">
              This task is currently blocked. The manpower request will still be submitted but may need review.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="requested_count">Workers Needed *</Label>
            <Input
              id="requested_count"
              type="number"
              min="1"
              value={form.requested_count}
              onChange={(e) => setForm({ ...form, requested_count: e.target.value })}
              placeholder="6"
              className={errors.requested_count ? 'border-destructive' : ''}
            />
            {errors.requested_count && (
              <p className="text-xs text-destructive mt-1">{errors.requested_count}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="required_date">Start Date *</Label>
              <DatePicker
                value={form.required_date}
                onChange={(v) => setForm({ ...form, required_date: v })}
                placeholder="Select date"
                className={errors.required_date ? 'border-destructive' : ''}
              />
              {errors.required_date && (
                <p className="text-xs text-destructive mt-1">{errors.required_date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="duration_days">Duration (Days) *</Label>
              <Input
                id="duration_days"
                type="number"
                min="1"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                placeholder="5"
                className={errors.duration_days ? 'border-destructive' : ''}
              />
              {errors.duration_days && (
                <p className="text-xs text-destructive mt-1">{errors.duration_days}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Additional crew needed for panel installation..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
