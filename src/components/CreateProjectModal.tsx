import { useState } from 'react';
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
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { FormField } from './FormField';
import { Loader2 } from 'lucide-react';

const projectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters'),
  location: z.string().trim().min(5, 'Location must be at least 5 characters'),
  description: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateProjectModal = ({ open, onOpenChange, onSuccess }: CreateProjectModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    location: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validatedData = projectSchema.parse(form);
      setLoading(true);

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: validatedData.name,
          location: validatedData.location,
          description: validatedData.description,
          start_date: validatedData.startDate || null,
          end_date: validatedData.endDate || null,
          status: 'planning',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as a project member with project_manager role
      if (data) {
        await supabase.from('project_members').insert({
          project_id: data.id,
          user_id: user?.id,
          role: 'project_manager',
        });
      }

      toast({
        title: 'Project created',
        description: `${validatedData.name} has been created successfully.`,
      });

      // Reset form
      setForm({
        name: '',
        location: '',
        description: '',
        startDate: '',
        endDate: '',
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
          title: 'Error creating project',
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
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new construction project to coordinate work across trades.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            label="Location"
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
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};