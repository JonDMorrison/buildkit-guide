import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { FormField } from './FormField';
import { DatePicker } from './ui/date-picker';
import { Loader2, ArrowRight } from 'lucide-react';
import { PlaybookSuggestionStep, type AppliedPlaybookInfo } from './playbooks/PlaybookSuggestionStep';

const projectSchema = z.object({
  name: z.string().trim().min(3, 'Project name must be at least 3 characters'),
  jobNumber: z.string().trim().optional(),
  location: z.string().trim().min(5, 'Job site address must be at least 5 characters'),
  billingAddress: z.string().trim().optional(),
  description: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  clientId: z.string().optional(),
  jobType: z.string().trim().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = 'details' | 'playbook';

export const CreateProjectModal = ({ open, onOpenChange, onSuccess }: CreateProjectModalProps) => {
  const { user } = useAuth();
  const { activeOrganizationId } = useOrganization();
  const { role: orgRole } = useOrganizationRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [allClients, setAllClients] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [step, setStep] = useState<Step>('details');
  const [defaultPrompt, setDefaultPrompt] = useState<AppliedPlaybookInfo | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  const [form, setForm] = useState<ProjectForm>({
    name: '',
    jobNumber: '',
    location: '',
    billingAddress: '',
    description: '',
    startDate: '',
    endDate: '',
    clientId: '',
    jobType: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectForm, string>>>({});

  // Reset step when modal reopens
  useEffect(() => {
    if (open) {
      setStep('details');
    } else {
      setForm({
        name: '', jobNumber: '', location: '', billingAddress: '',
        description: '', startDate: '', endDate: '', clientId: '', jobType: '',
      });
      setErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (open && activeOrganizationId) {
      supabase
        .from('clients')
        .select('id, name, is_active')
        .eq('organization_id', activeOrganizationId)
        .order('name')
        .then(({ data }) => setAllClients(data || []));
    }
  }, [open, activeOrganizationId]);

  const clients = includeArchived ? allClients : allClients.filter(c => c.is_active);

  const validateDetails = (): boolean => {
    setErrors({});
    try {
      projectSchema.parse(form);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof ProjectForm, string>> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as keyof ProjectForm] = issue.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleNextStep = () => {
    if (validateDetails()) {
      setStep('playbook');
    }
  };

  const createProject = async (playbookId?: string, playbookInfo?: AppliedPlaybookInfo) => {
    setLoading(true);
    try {
      const validatedData = projectSchema.parse(form);

      let orgId = activeOrganizationId;

      // If user has no organization, create one via atomic RPC
      if (!orgId && user?.id) {
        const orgName = user.email?.split('@')[0]
          ? `${user.email.split('@')[0]}'s Organization`
          : 'My Organization';

        const { data: rpcResult, error: orgError } = await supabase.rpc('rpc_onboarding_ensure_org', {
          p_name: orgName,
          p_slug_base: orgName,
          p_user_id: user.id,
        });

        if (orgError) throw new Error(`Failed to create organization: ${orgError.message}`);
        
        type OrgRpcResult = { org_id: string } | null;
        orgId = (rpcResult as OrgRpcResult)?.org_id ?? null;
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
          billing_address: validatedData.billingAddress || null,
          description: validatedData.description,
          start_date: validatedData.startDate || null,
          end_date: validatedData.endDate || null,
          status: 'planning',
          created_by: user?.id,
          organization_id: orgId,
          client_id: validatedData.clientId || null,
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

      // Apply playbook if selected
      if (playbookId && data && user?.id) {
        try {
          await supabase.rpc('rpc_apply_playbook_to_project', {
            p_playbook_id: playbookId,
            p_project_id: data.id,
            p_user_id: user.id,
            p_force_reapply: false,
          });
          toast({
            title: 'Project created with playbook',
            description: `${validatedData.name} has been created and playbook applied.`,
          });
          // Only offer default prompt to admin/pm roles (DB stores 'pm'; has_org_role normalizes to 'project_manager')
          const canSetDefault = orgRole === 'admin' || orgRole === 'pm';
          if (playbookInfo && !playbookInfo.isDefault && canSetDefault) {
            setDefaultPrompt(playbookInfo);
          }
        } catch (pbError: unknown) {
          console.error('Playbook application failed:', pbError);
          const pbMsg = pbError instanceof Error ? pbError.message : 'Unknown error';
          toast({
            title: 'Project created',
            description: `${validatedData.name} created, but playbook could not be applied: ${pbMsg}`,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Project created',
          description: `${validatedData.name} has been created successfully.`,
        });
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // shouldn't happen since we validated before
        setStep('details');
      } else {
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
  const handleSetDefault = async () => {
    if (!defaultPrompt) return;
    setSettingDefault(true);
    try {
      const { error } = await supabase.rpc('rpc_update_playbook', {
        p_playbook_id: defaultPrompt.id,
        p_name: null,
        p_job_type: null,
        p_description: null,
        p_is_default: true,
        p_phases: null,
      });
      if (error) throw error;
      
      toast({ 
        title: 'Default playbook updated', 
        description: `"${defaultPrompt.name}" is now your organization's default playbook.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ['playbooks-list'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-detail'] });
      queryClient.invalidateQueries({ queryKey: ['playbook-performance'] });
      setDefaultPrompt(null); // Close only on success
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      const isPermErr = error?.code === '42501' 
        || error?.message?.toLowerCase().includes('forbidden')
        || error?.message?.toLowerCase().includes('permission');
      const msg = isPermErr
        ? "You don't have permission to set the default playbook. Ask an admin to update this in Playbooks."
        : "Couldn't set default. Try again.";
      toast({ title: 'Could not set default', description: msg, variant: 'destructive' });
      // Dialog stays open on error so user sees it didn't apply
    } finally {
      setSettingDefault(false);
    }
  };

  return (
    <>

    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'details' ? 'Create New Project' : 'Select Playbook'}
          </DialogTitle>
          <DialogDescription>
            {step === 'details'
              ? 'Add a new construction project to coordinate work across trades.'
              : 'Choose a playbook to auto-populate phases and tasks.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'details' ? (
          <div className="space-y-4">
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

            <FormField label="Job Type" error={errors.jobType}>
              <Input
                value={form.jobType}
                onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                placeholder="e.g. Tenant Improvement, Residential"
                className="min-h-[52px]"
              />
            </FormField>

            <FormField label="Client" error={errors.clientId}>
              <Select value={form.clientId || ""} onValueChange={(v) => setForm({ ...form, clientId: v === "none" ? "" : v })}>
                <SelectTrigger className="min-h-[52px]"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{!c.is_active ? " (archived)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-center gap-2">
              <Switch id="include-archived-create" checked={includeArchived} onCheckedChange={setIncludeArchived} />
              <Label htmlFor="include-archived-create" className="text-sm text-muted-foreground cursor-pointer">Include archived clients</Label>
            </div>

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
                type="button"
                onClick={handleNextStep}
                className="flex-1 min-h-[52px] gap-1.5"
                disabled={loading}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
                <span className="text-sm text-muted-foreground">Creating project...</span>
              </div>
            ) : (
              <PlaybookSuggestionStep
                jobType={form.jobType}
                onApply={(playbookId, info) => createProject(playbookId, info)}
                onSkip={() => createProject()}
                onBack={() => setStep('details')}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!defaultPrompt} onOpenChange={(open) => { if (!open && !settingDefault) setDefaultPrompt(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Make this your default workflow?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Set <span className="font-medium text-foreground">&ldquo;{defaultPrompt?.name}&rdquo;</span> as your organization&rsquo;s default playbook for new projects.
                You can change this anytime in Playbooks.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Tip: Defaults are organization-wide. If you run different job types, you can switch defaults anytime.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={settingDefault}>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={handleSetDefault} disabled={settingDefault}>
            {settingDefault ? 'Saving…' : 'Set as default'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
