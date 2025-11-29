import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { FormField } from '../FormField';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2 } from 'lucide-react';

const taskSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  description: z.string().trim().optional(),
  projectId: z.string().min(1, 'Please select a project'),
  tradeId: z.string().min(1, 'Please select a trade'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.number().min(1).max(5),
  requestedCrewSize: z.number().optional(),
  manpowerStartDate: z.string().optional(),
  manpowerEndDate: z.string().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

type TaskForm = z.infer<typeof taskSchema>;

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateTaskModal = ({ open, onOpenChange, onSuccess }: CreateTaskModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [form, setForm] = useState<TaskForm>({
    title: '',
    description: '',
    projectId: '',
    tradeId: '',
    startDate: '',
    endDate: '',
    priority: 3,
    requestedCrewSize: undefined,
    manpowerStartDate: '',
    manpowerEndDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TaskForm, string>>>({});

  useEffect(() => {
    if (open) {
      // Fetch projects
      supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name')
        .then(({ data }) => setProjects(data || []));

      // Fetch trades
      supabase
        .from('trades')
        .select('id, name, trade_type')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => setTrades(data || []));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = taskSchema.parse(form);
      setLoading(true);

      const { data: taskData, error: taskError } = await supabase.from('tasks').insert({
        title: validatedData.title,
        description: validatedData.description,
        project_id: validatedData.projectId,
        assigned_trade_id: validatedData.tradeId,
        start_date: validatedData.startDate || null,
        end_date: validatedData.endDate || null,
        priority: validatedData.priority,
        status: 'not_started',
        created_by: user?.id,
      }).select().single();

      if (taskError) throw taskError;

      // Create manpower request if crew size is specified
      if (validatedData.requestedCrewSize && validatedData.requestedCrewSize > 0 && validatedData.tradeId) {
        const { error: manpowerError } = await supabase
          .from("manpower_requests")
          .insert({
            task_id: taskData.id,
            trade_id: validatedData.tradeId,
            project_id: validatedData.projectId,
            requested_count: validatedData.requestedCrewSize,
            required_date: validatedData.manpowerStartDate || validatedData.startDate || new Date().toISOString().split('T')[0],
            duration_days: validatedData.manpowerStartDate && validatedData.manpowerEndDate 
              ? Math.ceil((new Date(validatedData.manpowerEndDate).getTime() - new Date(validatedData.manpowerStartDate).getTime()) / (1000 * 60 * 60 * 24))
              : 1,
            reason: `Manpower request for task: ${validatedData.title}`,
            created_by: user?.id,
          });

        if (manpowerError) {
          console.error("Error creating manpower request:", manpowerError);
          toast({
            title: "Warning",
            description: "Task created but manpower request failed",
            variant: "destructive",
          });
        }
      }

      toast({
        title: 'Task created',
        description: `${validatedData.title} has been created successfully.`,
      });

      // Reset form
      setForm({
        title: '',
        description: '',
        projectId: '',
        tradeId: '',
        startDate: '',
        endDate: '',
        priority: 3,
        requestedCrewSize: undefined,
        manpowerStartDate: '',
        manpowerEndDate: '',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof TaskForm, string>> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as keyof TaskForm] = issue.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast({
          title: 'Error creating task',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to coordinate work across your project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Task Title" required error={errors.title}>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Install electrical panels"
              className="min-h-[52px]"
            />
          </FormField>

          <FormField label="Description" error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Additional task details..."
              className="min-h-[80px]"
            />
          </FormField>

          <FormField label="Project" required error={errors.projectId}>
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger className="min-h-[52px] bg-card border-border">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Assigned Trade" required error={errors.tradeId}>
            <Select value={form.tradeId} onValueChange={(v) => setForm({ ...form, tradeId: v })}>
              <SelectTrigger className="min-h-[52px] bg-card border-border">
                <SelectValue placeholder="Select trade" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {trades.map((trade) => (
                  <SelectItem key={trade.id} value={trade.id}>
                    {trade.name} ({trade.trade_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" error={errors.startDate}>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="min-h-[52px]"
              />
            </FormField>

            <FormField label="End Date" error={errors.endDate}>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                min={form.startDate}
                className="min-h-[52px]"
              />
            </FormField>
          </div>

          <FormField label="Priority" required error={errors.priority}>
            <Select
              value={form.priority.toString()}
              onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}
            >
              <SelectTrigger className="min-h-[52px] bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                <SelectItem value="1">Urgent</SelectItem>
                <SelectItem value="2">High</SelectItem>
                <SelectItem value="3">Normal</SelectItem>
                <SelectItem value="4">Low</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <Separator className="my-4" />
          
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Manpower Request (Optional)</h3>
            
            <FormField label="Requested Crew Size" helper="Number of workers needed">
              <Input
                type="number"
                min="0"
                value={form.requestedCrewSize || ""}
                onChange={(e) => setForm({ ...form, requestedCrewSize: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="0"
                className="min-h-[52px]"
              />
            </FormField>

            {form.requestedCrewSize && form.requestedCrewSize > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date">
                  <Input
                    type="date"
                    value={form.manpowerStartDate}
                    onChange={(e) => setForm({ ...form, manpowerStartDate: e.target.value })}
                    className="min-h-[52px]"
                  />
                </FormField>

                <FormField label="End Date">
                  <Input
                    type="date"
                    value={form.manpowerEndDate}
                    onChange={(e) => setForm({ ...form, manpowerEndDate: e.target.value })}
                    min={form.manpowerStartDate}
                    className="min-h-[52px]"
                  />
                </FormField>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 min-h-[52px]"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 min-h-[52px]" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};