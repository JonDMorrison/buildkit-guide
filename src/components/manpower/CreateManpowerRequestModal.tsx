import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Users } from 'lucide-react';

interface CreateManpowerRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultProjectId?: string;
}

export const CreateManpowerRequestModal = ({
  open,
  onOpenChange,
  onSuccess,
  defaultProjectId,
}: CreateManpowerRequestModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [form, setForm] = useState({
    project_id: defaultProjectId || '',
    trade_id: '',
    task_id: 'none',
    requested_count: '',
    required_date: '',
    duration_days: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchProjects();
      fetchTrades();
      if (defaultProjectId) {
        setForm(prev => ({ ...prev, project_id: defaultProjectId }));
      }
    }
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (form.project_id) {
      fetchTasks(form.project_id);
    } else {
      setTasks([]);
    }
  }, [form.project_id]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('is_deleted', false)
      .order('name');
    setProjects(data || []);
  };

  const fetchTrades = async () => {
    const { data } = await supabase
      .from('trades')
      .select('id, name, trade_type')
      .eq('is_active', true)
      .order('name');
    setTrades(data || []);
  };

  const fetchTasks = async (projectId: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .in('status', ['not_started', 'in_progress'])
      .order('title');
    setTasks(data || []);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.project_id) {
      newErrors.project_id = 'Please select a project';
    }

    if (!form.trade_id) {
      newErrors.trade_id = 'Please select a trade';
    }

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
        project_id: form.project_id,
        trade_id: form.trade_id,
        task_id: form.task_id === 'none' ? null : form.task_id,
        requested_count: parseInt(form.requested_count),
        required_date: form.required_date,
        duration_days: parseInt(form.duration_days),
        reason: form.reason.trim() || 'Manpower needed',
        created_by: user!.id,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Manpower requested',
        description: 'Your request has been submitted for approval',
      });

      setForm({
        project_id: defaultProjectId || '',
        trade_id: '',
        task_id: '',
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Request Manpower
          </DialogTitle>
          <DialogDescription>
            Submit a manpower request for approval by a Project Manager.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="project_id">Project *</Label>
            <Select
              value={form.project_id}
              onValueChange={(v) => setForm({ ...form, project_id: v, task_id: '' })}
            >
              <SelectTrigger className={errors.project_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.project_id && (
              <p className="text-xs text-destructive mt-1">{errors.project_id}</p>
            )}
          </div>

          <div>
            <Label htmlFor="trade_id">Trade *</Label>
            <Select
              value={form.trade_id}
              onValueChange={(v) => setForm({ ...form, trade_id: v })}
            >
              <SelectTrigger className={errors.trade_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select trade" />
              </SelectTrigger>
              <SelectContent>
                {trades.map((trade) => (
                  <SelectItem key={trade.id} value={trade.id}>
                    {trade.name} ({trade.trade_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.trade_id && (
              <p className="text-xs text-destructive mt-1">{errors.trade_id}</p>
            )}
          </div>

          {tasks.length > 0 && (
            <div>
              <Label htmlFor="task_id">Link to Task (Optional)</Label>
              <Select
                value={form.task_id}
                onValueChange={(v) => setForm({ ...form, task_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked task</SelectItem>
                  {tasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
            <div>
              <Label htmlFor="required_date">Start Date *</Label>
              <Input
                id="required_date"
                type="date"
                value={form.required_date}
                onChange={(e) => setForm({ ...form, required_date: e.target.value })}
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
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Why is this manpower needed?"
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
