import { useState } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
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
import { DatePicker } from './ui/date-picker';
import { Loader2 } from 'lucide-react';

const projectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters'),
  jobNumber: z.string().trim().optional(),
  location: z.string().trim().min(5, 'Address must be at least 5 characters'),
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
  const { activeOrganizationId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    jobNumber: '',
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

      let orgId = activeOrganizationId;

      // If user has no organization, create one for them
      // The database trigger will automatically add them as admin
      if (!orgId && user?.id) {
        const orgName = user.email?.split('@')[0] 
          ? `${user.email.split('@')[0]}'s Organization`
          : 'My Organization';
        
        const { data: newOrg, error: orgError } = await supabase
          .from('organizations')
          .insert({ name: orgName })
          .select()
          .single();

        if (orgError) throw new Error(`Failed to create organization: ${orgError.message}`);
        
        orgId = newOrg.id;
      }

      if (!orgId) {
        throw new Error('Unable to determine organization for project');
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: validatedData.name,
          job_number: validatedData.jobNumber || null,
          location: validatedData.location,
          description: validatedData.description,
          start_date: validatedData.startDate || null,
          end_date: validatedData.endDate || null,
          status: 'planning',
          created_by: user?.id,
          organization_id: orgId,
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

      // Invalidate organization queries so the new org shows up
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-memberships'] });

      toast({
        title: 'Project created',
        description: `${validatedData.name} has been created successfully.`,
      });

      // Invalidate project queries so lists update instantly
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setForm({
        name: '',
        jobNumber: '',
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
        // Extract error message from various error formats (Supabase, PostgREST, Error objects)
        let errorMessage = 'An unexpected error occurred';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object') {
          const err = error as { message?: string; error_description?: string; details?: string; hint?: string };
          errorMessage = err.message || err.error_description || err.details || err.hint || 'An unexpected error occurred';
        }
        
        toast({
          title: 'Error creating project',
          description: errorMessage,
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
              <DatePicker
                value={form.startDate}
                onChange={(v) => setForm({ ...form, startDate: v })}
                placeholder="Select start date"
              />
            </FormField>

            <FormField
              label="End Date"
              error={errors.endDate}
            >
              <DatePicker
                value={form.endDate}
                onChange={(v) => setForm({ ...form, endDate: v })}
                placeholder="Select end date"
                minDate={form.startDate}
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