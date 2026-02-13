import { useState, useEffect } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { FormField } from './FormField';
import { DatePicker } from './ui/date-picker';
import { Card, CardContent } from './ui/card';
import { Loader2 } from 'lucide-react';

const projectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters'),
  jobNumber: z.string().trim().optional(),
  location: z.string().trim().min(5, 'Job site address must be at least 5 characters'),
  billingAddress: z.string().trim().optional(),
  description: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string(),
  clientId: z.string().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

interface Project {
  id: string;
  name: string;
  job_number: string | null;
  location: string;
  billing_address: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  client_id?: string | null;
  organization_id?: string;
}

interface EditProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSuccess: () => void;
}

const statusOptions = [
  { value: "planning", label: "Planning" },
  { value: "awarded", label: "Awarded" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "potential", label: "Potential" },
  { value: "didnt_get", label: "Didn't Get" },
];

export const EditProjectModal = ({ open, onOpenChange, project, onSuccess }: EditProjectModalProps) => {
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; parent_client_id: string | null; billing_address: string | null }[]>([]);
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    jobNumber: '',
    location: '',
    billingAddress: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'planning',
    clientId: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({});

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || '',
        jobNumber: project.job_number || '',
        location: project.location || '',
        billingAddress: project.billing_address || '',
        description: project.description || '',
        startDate: project.start_date || '',
        endDate: project.end_date || '',
        status: project.status || 'planning',
        clientId: (project as any).client_id || '',
      });
    }
  }, [project]);

  useEffect(() => {
    if (open && activeOrganizationId) {
      supabase
        .from('clients')
        .select('id, name, parent_client_id, billing_address')
        .eq('organization_id', activeOrganizationId)
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => setClients((data as any[]) || []));
    }
  }, [open, activeOrganizationId]);

  // Derive billing/shipping display
  const selectedClient = clients.find(c => c.id === form.clientId);
  const parentClient = selectedClient?.parent_client_id
    ? clients.find(c => c.id === selectedClient.parent_client_id)
    : null;
  const billingCustomerName = parentClient?.name || selectedClient?.name || null;
  const billingAddress = parentClient?.billing_address || selectedClient?.billing_address || null;

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
          billing_address: validatedData.billingAddress || null,
          description: validatedData.description || null,
          start_date: validatedData.startDate || null,
          end_date: validatedData.endDate || null,
          status: validatedData.status,
          client_id: validatedData.clientId || null,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update project details including Job # and address.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Project Name" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Downtown Office Complex"
                className="min-h-[52px]"
              />
            </FormField>
            <FormField label="Job #" error={errors.jobNumber}>
              <Input
                value={form.jobNumber}
                onChange={(e) => setForm({ ...form, jobNumber: e.target.value })}
                placeholder="2024-001"
                className="min-h-[52px]"
              />
            </FormField>
          </div>

          <FormField label="Client" error={errors.clientId}>
            <Select value={form.clientId || "none"} onValueChange={(v) => setForm({ ...form, clientId: v === "none" ? "" : v })}>
              <SelectTrigger className="min-h-[52px]"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Billing / Shipping derived display */}
          {form.clientId && (
            <Card>
              <CardContent className="py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Customer</span>
                  <span className="font-medium">{billingCustomerName || "—"}</span>
                </div>
                {billingAddress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Address</span>
                    <span>{billingAddress}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Job Site</span>
                  <span>{form.location || "—"}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <FormField label="Job Site Address" required error={errors.location}>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="123 Main St, Seattle, WA"
              className="min-h-[52px]"
            />
          </FormField>

          <FormField label="Billing Address" error={errors.billingAddress}>
            <Input
              value={form.billingAddress}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
              placeholder="Optional — for invoicing purposes"
              className="min-h-[52px]"
            />
          </FormField>

          <FormField label="Description" error={errors.description}>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project description..."
              className="min-h-[80px]"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" error={errors.startDate}>
              <DatePicker
                value={form.startDate}
                onChange={(v) => setForm({ ...form, startDate: v })}
                placeholder="Select start date"
              />
            </FormField>
            <FormField label="End Date" error={errors.endDate}>
              <DatePicker
                value={form.endDate}
                onChange={(v) => setForm({ ...form, endDate: v })}
                placeholder="Select end date"
                minDate={form.startDate}
              />
            </FormField>
          </div>

          <FormField label="Status" error={errors.status}>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="min-h-[52px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
