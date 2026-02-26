import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Rocket,
  HardHat,
  Users,
  ClipboardCheck,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Building2,
  Loader2,
  PartyPopper,
  Brain,
  MapPin,
  Globe,
} from 'lucide-react';
import projectPathLogo from '@/assets/project-path-logo.png';

interface WelcomeWizardProps {
  onComplete: () => void;
}

type Role = 'project_manager' | 'foreman' | 'worker' | 'admin';

const roles: { value: Role; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'admin',
    label: 'Owner / Administrator',
    icon: <Shield className="h-6 w-6" />,
    description: 'Full access to all features and settings',
  },
  {
    value: 'project_manager',
    label: 'Project Manager',
    icon: <ClipboardCheck className="h-6 w-6" />,
    description: 'Oversee multiple projects and teams',
  },
  {
    value: 'foreman',
    label: 'Foreman / Superintendent',
    icon: <HardHat className="h-6 w-6" />,
    description: 'Lead crews and manage daily operations',
  },
  {
    value: 'worker',
    label: 'Field Worker / Tradesperson',
    icon: <Users className="h-6 w-6" />,
    description: 'Execute tasks and report progress',
  },
];

const TIMEZONES = [
  { value: 'America/St_Johns', label: 'Newfoundland (NST)' },
  { value: 'America/Halifax', label: 'Atlantic (AST)' },
  { value: 'America/Toronto', label: 'Eastern (EST)' },
  { value: 'America/Winnipeg', label: 'Central (CST)' },
  { value: 'America/Edmonton', label: 'Mountain (MST)' },
  { value: 'America/Vancouver', label: 'Pacific (PST)' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Chicago', label: 'US Central' },
  { value: 'America/Denver', label: 'US Mountain' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
];

const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
  { value: 'US-OTHER', label: 'United States (Other)' },
];

const JOB_TYPES = [
  'Residential New Build',
  'Commercial Tenant Improvement',
  'Commercial New Build',
  'Industrial',
  'Renovation / Retrofit',
  'Infrastructure',
  'Other',
];

export default function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const { user } = useAuth();
  const { organizations } = useOrganization();
  const { state: onboardingState, isLoading: stateLoading, updateState } = useOnboardingState();
  const { toast } = useToast();

  // Step state: 1=Welcome+Role, 2=Org+Timezone, 3=First Project, 4=AI Mode
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rehydrated = useRef(false);

  // Step 1
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // Step 2
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('America/Toronto');
  const [province, setProvince] = useState('ON');
  const [orgCreated, setOrgCreated] = useState<{ id: string } | null>(null);

  // Step 3
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [projectJobType, setProjectJobType] = useState('');
  const [projectCreatedId, setProjectCreatedId] = useState<string | null>(null);

  // Step 4
  const [aiRiskMode, setAiRiskMode] = useState('balanced');

  const totalSteps = 4;
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';

  // Rehydrate wizard state from DB on mount (once)
  useEffect(() => {
    if (rehydrated.current || stateLoading || !onboardingState) return;
    rehydrated.current = true;

    // If already onboarded, parent handles redirect — nothing to do
    if (onboardingState.has_onboarded) return;

    // Rehydrate org from DB state or existing membership
    const savedOrgId = onboardingState.onboarding_org_id;
    const existingOrgId = organizations.length > 0 ? organizations[0].id : null;
    const effectiveOrgId = savedOrgId || existingOrgId;

    if (effectiveOrgId) {
      setOrgCreated({ id: effectiveOrgId });
    }

    // Rehydrate project
    if (onboardingState.onboarding_project_id) {
      setProjectCreatedId(onboardingState.onboarding_project_id);
    }

    // Determine resume step from saved state
    const savedStep = onboardingState.onboarding_step;
    if (savedStep && savedStep >= 1 && savedStep <= 4) {
      setStep(savedStep);
    } else if (onboardingState.onboarding_project_id) {
      setStep(4);
    } else if (effectiveOrgId) {
      setStep(3);
    }
  }, [stateLoading, onboardingState, organizations]);

  // Existing-org guard: if user already has an org membership but orgCreated not set
  useEffect(() => {
    if (organizations.length > 0 && !orgCreated) {
      setOrgCreated({ id: organizations[0].id });
    }
  }, [organizations, orgCreated]);

  // Persist step helper — does NOT advance UI, just saves to DB
  const persistStep = async (updates: {
    onboarding_step?: number;
    onboarding_org_id?: string;
    onboarding_project_id?: string;
    has_onboarded?: boolean;
  }) => {
    try {
      await updateState(updates);
    } catch (err: any) {
      console.error('Failed to persist onboarding state:', err);
      toast({ title: 'Save error', description: 'Could not save progress. Please try again.', variant: 'destructive' });
      throw err; // Re-throw so caller knows it failed
    }
  };

  const handleStep1Continue = async () => {
    try {
      await persistStep({ onboarding_step: 2 });
      setStep(2);
    } catch {
      // Error already toasted by persistStep
    }
  };

  const handleOrgCreate = async () => {
    if (!orgName.trim()) {
      toast({ title: 'Company name required', variant: 'destructive' });
      return;
    }

    // Prevent double-submit
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsLoading(true);

    try {
      // If org was already created (back-button or rehydrated), skip creation
      if (orgCreated) {
        await persistStep({ onboarding_step: 3, onboarding_org_id: orgCreated.id });
        setStep(3);
        return;
      }

      const { data: rpcResult, error: rpcError } = await supabase.rpc('rpc_onboarding_ensure_org', {
        p_name: orgName.trim(),
        p_slug_base: orgName.trim(),
        p_user_id: user!.id,
        p_timezone: timezone,
        p_jurisdiction_code: province,
      });

      if (rpcError) throw rpcError;

      const result = rpcResult as any;
      const newOrgId = result.org_id;
      setOrgCreated({ id: newOrgId });

      // Persist org ID + advance step atomically
      await persistStep({ onboarding_step: 3, onboarding_org_id: newOrgId });

      if (result.already_existed) {
        toast({ title: 'Using your existing organization' });
      }

      setStep(3);
    } catch (error: any) {
      console.error('Error creating org:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleProjectCreate = async () => {
    if (!orgCreated) {
      setStep(4);
      return;
    }

    if (!projectName.trim()) {
      // Allow skipping — persist step advance
      try {
        await persistStep({ onboarding_step: 4 });
        setStep(4);
      } catch {
        // Error already toasted
      }
      return;
    }

    // If project already created (rehydrated), just advance
    if (projectCreatedId) {
      try {
        await persistStep({ onboarding_step: 4 });
        setStep(4);
      } catch {
        // Error already toasted
      }
      return;
    }

    setIsLoading(true);
    try {
      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          location: projectAddress.trim() || 'TBD',
          job_type: projectJobType || null,
          organization_id: orgCreated.id,
          status: 'active',
          created_by: user!.id,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Auto-create a job site from the address if provided
      if (projectAddress.trim() && project) {
        await supabase.from('job_sites').insert({
          name: projectName.trim(),
          address: projectAddress.trim(),
          project_id: project.id,
          organization_id: orgCreated.id,
          is_active: true,
        });
      }

      // Mark setup steps complete
      await supabase.from('setup_checklist_progress').upsert({
        organization_id: orgCreated.id,
        step_org_created: true,
        step_timezone_set: true,
        step_first_project: true,
        step_first_job_site: !!projectAddress.trim(),
      }, { onConflict: 'organization_id' });

      setProjectCreatedId(project.id);

      // Persist project ID + advance step
      await persistStep({ onboarding_step: 4, onboarding_project_id: project.id });

      toast({ title: 'Project created', description: `${projectName} is ready to go.` });
      setStep(4);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Save AI risk mode
      if (orgCreated) {
        await supabase.rpc('rpc_upsert_operational_profile', {
          p_organization_id: orgCreated.id,
          p_data: {
            ai_risk_mode: aiRiskMode,
            ai_flag_profit_risk: true,
            ai_auto_change_orders: false,
            ai_recommend_pricing: false,
            wizard_phase_completed: 3,
            wizard_completed_at: new Date().toISOString(),
          } as any,
        });
      }

      // Mark onboarding complete — clear transient fields
      await persistStep({ has_onboarded: true, onboarding_step: 4 });

      // Update localStorage cache for ProtectedRoute
      if (user) {
        try {
          localStorage.setItem(`pp_onboarded_${user.id}`, 'true');
        } catch { /* ignore */ }
      }

      onComplete();
    } catch (error: any) {
      console.error('Error saving AI preferences:', error);
      // Don't block completion on AI save failure
      onComplete();
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while rehydrating
  if (stateLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 flex items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/95 backdrop-blur">
        {/* Progress indicator */}
        <div className="px-6 pt-6">
          <div className="flex justify-between mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 mx-1 rounded-full transition-all duration-300 ${
                  i < step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* Step 1: Welcome + Role */}
        {step === 1 && (
          <>
            <CardHeader className="text-center pt-6 pb-4">
              <div className="mx-auto mb-4 relative">
                <img src={projectPathLogo} alt="Project Path" className="h-32 w-auto mx-auto" />
                <div className="absolute -right-2 -bottom-2 bg-primary text-primary-foreground rounded-full p-2">
                  <PartyPopper className="h-5 w-5" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">
                Welcome, {userName}! 🎉
              </CardTitle>
              <CardDescription className="text-base mt-2">
                What best describes your role?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div className="grid gap-3">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      selectedRole === role.value
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className={`p-3 rounded-lg ${
                      selectedRole === role.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {role.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                    {selectedRole === role.value && (
                      <CheckCircle className="h-6 w-6 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              <Button
                onClick={handleStep1Continue}
                size="lg"
                className="w-full h-14 text-lg"
                disabled={!selectedRole}
              >
                Continue
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 2: Organization + Timezone + Province */}
        {step === 2 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Set up your company</CardTitle>
              <CardDescription>
                Tell us about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">Company / Organization Name *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g., Horizon Construction"
                    className="pl-10 h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Province / Region
                  </Label>
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleOrgCreate} className="flex-1" disabled={isLoading || isSubmitting || !orgName.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: First Project */}
        {step === 3 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Create your first project</CardTitle>
              <CardDescription>
                Set up a project so you can start managing work right away
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., 123 Main St Renovation"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectAddress" className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Job Site Address
                </Label>
                <Input
                  id="projectAddress"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  placeholder="e.g., 123 Main St, Toronto, ON"
                />
              </div>

              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select value={projectJobType} onValueChange={setProjectJobType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((jt) => (
                      <SelectItem key={jt} value={jt}>
                        {jt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleProjectCreate} className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : projectName.trim() ? (
                    <>
                      Create & Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Skip for Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: AI Assistant */}
        {step === 4 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <div className="mx-auto mb-3 p-3 rounded-full bg-primary/10">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Your AI Assistant</CardTitle>
              <CardDescription>
                Project Path's AI Brain monitors your projects, flags risks, and suggests actions. 
                How should it handle risky situations?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <RadioGroup
                value={aiRiskMode}
                onValueChange={setAiRiskMode}
                className="space-y-3"
              >
                {[
                  {
                    value: 'strict',
                    label: 'Strict',
                    desc: 'Block risky actions automatically — best for regulated or high-liability projects',
                    emoji: '🛑',
                  },
                  {
                    value: 'balanced',
                    label: 'Balanced',
                    desc: 'Warn and require confirmation — recommended for most teams',
                    emoji: '⚖️',
                  },
                  {
                    value: 'advisory',
                    label: 'Advisory',
                    desc: 'Suggest improvements but never block — for experienced teams who want full control',
                    emoji: '💡',
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      aiRiskMode === opt.value
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={opt.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="font-semibold">{opt.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                    {aiRiskMode === opt.value && (
                      <CheckCircle className="h-5 w-5 text-primary mt-1" />
                    )}
                  </label>
                ))}
              </RadioGroup>

              <p className="text-xs text-muted-foreground text-center">
                You can change this anytime in Settings. The AI learns from your usage — no further setup needed.
              </p>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleFinish} className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finishing...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Go to Dashboard
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
