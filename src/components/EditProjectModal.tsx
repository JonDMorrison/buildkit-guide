import { useState, useEffect } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { FormField } from './FormField';
import { Loader2 } from 'lucide-react';

const projectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters'),
  jobNumber: z.string().trim().optional(),
  location: z.string().trim().min(5, 'Address must be at least 5 characters'),
  description: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string(),
});

type ProjectForm = z.infer<typeof projectSchema>;

interface Project {
  id: string;
  name: string;
  job_number: string | null;
  location: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

interface EditProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSuccess: () => void;
}

export const EditProjectModal = ({ open, onOpenChange, project, onSuccess }: EditProjectModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    jobNumber: '',
    location: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'planning',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({});

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        jobNumber: project.job_number || '',
        location: project.location || '',
        description: project.description || '',
        startDate: project.start_date || '',
        endDate: project.end_date || '',
        status: project.status || 'planning',
      });
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    
    setErrors({});

    try {
      const validatedData = projectSchema.parse(form);
      setLoading(true);

      const { error } = await supabase
        .from('projects')
        .update({
          name: validatedData.name,
          job_number: validatedData.jobNumber || null,
          location: validatedData.location,
          description: validatedData.description || null,
          start_date: validatedData.startDate || null,
          end_date: validatedData.endDate || null,
          status: validatedData.status,
        })
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: 'Project updated',
        description: `${validatedData.name} has been updated successfully.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProjectForm, string>> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as keyof ProjectForm] = issue.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast({
          title: 'Error updating project',
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
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details including Job # and address.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Project Name"
              required
              error={errors.name}
            >
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Downtown Office Complex"
                className="min-h-[52px]"
              />
            </FormField>

            <FormField
              label="Job #"
              error={errors.jobNumber}
            >
              <Input
                value={form.jobNumber}
                onChange={(e) => setForm({ ...form, jobNumber: e.target.value })}
                placeholder="2024-001"
                className="min-h-[52px]"
              />
            </FormField>
          </div>

          <FormField
            label="Address"
            required
            error={errors.location}
          >
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="123 Main St, Seattle, WA"
              className="min-h-[52px]"
            />
          </FormField>

          <FormField
            label="Description"
            error={errors.description}
          >
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project description..."
              className="min-h-[80px]"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Start Date"
              error={errors.startDate}
            >
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="min-h-[52px]"
              />
            </FormField>

            <FormField
              label="End Date"
              error={errors.endDate}
            >
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="min-h-[52px]"
              />
            </FormField>
          </div>

          <FormField
            label="Status"
            error={errors.status}
          >
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="flex h-[52px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </FormField>

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
            <Button
              type="submit"
              className="flex-1 min-h-[52px]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
