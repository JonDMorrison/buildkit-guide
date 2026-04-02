import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Rocket,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Building2,
  Loader2,
  MapPin,
  Globe,
  Plus,
  X,
  Wrench,
  Ruler,
  Home,
  Sparkles,
  Sun,
  BookOpen,
  Target,
} from 'lucide-react';
import projectPathLogo from '@/assets/project-path-logo.png';

interface WelcomeWizardProps {
  onComplete: () => void;
}

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

/** Derive timezone default from browser; leave empty string if unrecognized so user must choose */
function detectTimezoneDefault(): string {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.some(tz => tz.value === browserTz)) return browserTz;
  } catch { /* ignore */ }
  return ''; // No assumption — user must select
}

const JOB_TYPES = [
  'Residential New Build',
  'Commercial Tenant Improvement',
  'Commercial New Build',
  'Industrial',
  'Renovation / Retrofit',
  'Infrastructure',
  'Other',
];

/**
 * Maps old onboarding_step values to new 3-step values.
 * New: 1=Org, 2=Trades, 3=First Project
 */
function migrateStepNumber(oldStep: number): number {
  if (oldStep <= 1) return 1;
  if (oldStep === 2) return 2;
  return 3;
}

export default function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const { user } = useAuth();
  const { organizations } = useOrganization();
  const { state: onboardingState, isLoading: stateLoading, updateState } = useOnboardingState();
  const { toast } = useToast();

  // Step state: 1=Org+Timezone, 2=Trades, 3=First Project
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rehydrated = useRef(false);

  // Step 1 (Org)
  const [orgName, setOrgName] = useState('');
  const detectedTz = detectTimezoneDefault();
  const [timezone, setTimezone] = useState(detectedTz);
  const [province, setProvince] = useState('');
  const [orgCreated, setOrgCreated] = useState<{ id: string } | null>(null);

  // Step 2 (Trades)
  const [tradeInputValue, setTradeInputValue] = useState('');
  const [tradesEntered, setTradesEntered] = useState<string[]>([]);

  // Step 3 (Project)
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [projectJobType, setProjectJobType] = useState('');
  const [projectCreatedId, setProjectCreatedId] = useState<string | null>(null);

  // Step 4 (Company Identity)
  const [businessType, setBusinessType] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [projectSize, setProjectSize] = useState('');
  const [serviceArea, setServiceArea] = useState('');

  // Step 5 (AI Calibration)
  const [marginTarget, setMarginTarget] = useState('');
  const [commonJobTypes, setCommonJobTypes] = useState<string[]>([]);
  const [painPoint, setPainPoint] = useState('');
  const [workModel, setWorkModel] = useState('');
  const [calQuestion, setCalQuestion] = useState(1);

  // Step 6 (Playbook Generation)
  const [playbookJobType, setPlaybookJobType] = useState('');
  const [playbookGenerating, setPlaybookGenerating] = useState(false);
  const [playbookResult, setPlaybookResult] = useState<any>(null);
  const [playbookSaving, setPlaybookSaving] = useState(false);

  // Celebration
  const [showCelebration, setShowCelebration] = useState(false);

  const totalSteps = 6;
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
    if (savedStep && savedStep >= 1) {
      const mappedStep = migrateStepNumber(savedStep);
      setStep(Math.min(mappedStep, totalSteps));
    } else if (onboardingState.onboarding_project_id) {
      setStep(3);
    } else if (effectiveOrgId) {
      setStep(2);
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
      throw err;
    }
  };

  const handleOrgCreate = async () => {
    if (!orgName.trim()) {
      toast({ title: 'Company name required', variant: 'destructive' });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsLoading(true);

    try {
      // If org was already created (back-button or rehydrated), skip creation
      if (orgCreated) {
        await persistStep({ onboarding_step: 2, onboarding_org_id: orgCreated.id });
        setStep(2);
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

      await persistStep({ onboarding_step: 2, onboarding_org_id: newOrgId });

      if (result.already_existed) {
        toast({ title: 'Using your existing organization' });
      }

      setStep(2);
    } catch (error: any) {
      console.error('Error creating org:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleTradesSave = async () => {
    if (isSubmitting) return;
    setIsLoading(true);
    try {
      if (tradesEntered.length > 0 && orgCreated) {
        const tradeInserts = tradesEntered.map(tradeName => ({
          name: tradeName,
          trade_type: tradeName.toLowerCase(),
          company_name: orgName || tradeName,
          is_active: true,
          organization_id: orgCreated.id,
        }));
        const { error: tradesError } = await supabase.from('trades').insert(tradeInserts);
        if (tradesError) console.warn('Trades insert failed:', tradesError.message);
      }
      await persistStep({ onboarding_step: 3 });
      setStep(3);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsLoading(true);
    try {
      // Mark onboarding complete
      await persistStep({ has_onboarded: true, onboarding_step: totalSteps });

      // Set sensible AI defaults automatically
      if (orgCreated) {
        await supabase.rpc('rpc_upsert_operational_profile', {
          p_organization_id: orgCreated.id,
          p_data: {
            ai_risk_mode: 'balanced',
            ai_flag_profit_risk: true,
            ai_auto_change_orders: false,
            ai_recommend_pricing: false,
            wizard_phase_completed: 2,
            ...(businessType ? { business_type: businessType } : {}),
            ...(yearsInBusiness ? { years_in_business: yearsInBusiness } : {}),
            ...(projectSize ? { typical_project_size: projectSize } : {}),
            ...(serviceArea ? { service_area: serviceArea } : {}),
          } as any,
        });
      }

      // Save AI calibration to intelligence profile
      if (orgCreated && (marginTarget || commonJobTypes.length > 0 || painPoint || workModel)) {
        await supabase
          .from('organization_intelligence_profile' as any)
          .upsert({
            organization_id: orgCreated.id,
            ...(marginTarget ? { margin_target: marginTarget } : {}),
            ...(commonJobTypes.length > 0 ? { common_job_types: commonJobTypes } : {}),
            ...(painPoint ? { biggest_pain_point: painPoint } : {}),
            ...(workModel ? { work_model: workModel } : {}),
          } as any, { onConflict: 'organization_id' });
      }

      // Mark new checklist steps complete
      if (orgCreated) {
        await supabase.from('setup_checklist_progress').upsert({
          organization_id: orgCreated.id,
          ...(businessType ? { step_company_profile: true } : {}),
          ...(marginTarget ? { step_ai_calibrated: true } : {}),
          ...(playbookResult ? { step_playbook_generated: true } : {}),
        } as any, { onConflict: 'organization_id' });
      }

      // Update localStorage cache for ProtectedRoute
      if (user) {
        try {
          localStorage.setItem(`pp_onboarded_${user.id}`, 'true');
        } catch { /* ignore */ }
      }

      // Show celebration screen
      setShowCelebration(true);
    } catch (error: any) {
      console.error('Error finishing onboarding:', error);
      toast({ title: 'Save failed', description: 'Could not save preferences. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleProjectCreate = async () => {
    if (isSubmitting) return;
    if (!orgCreated) {
      await handleFinish();
      return;
    }

    if (!projectName.trim()) {
      // Allow skipping — advance to step 4
      await persistStep({ onboarding_step: 4 });
      setStep(4);
      return;
    }

    // If project already created (rehydrated), advance to step 4
    if (projectCreatedId) {
      await persistStep({ onboarding_step: 4 });
      setStep(4);
      return;
    }

    setIsLoading(true);
    try {
      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          location: projectAddress.trim() || null,
          job_type: projectJobType || null,
          organization_id: orgCreated.id,
          status: 'in_progress',
          created_by: user!.id,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;

      // Add creator as project_manager so they have full project access
      if (project) {
        const { error: memberError } = await supabase.from('project_members').insert({
          project_id: project.id,
          user_id: user!.id,
          role: 'project_manager',
        });
        if (memberError) {
          console.warn('project_members insert failed:', memberError.message);
        }
      }

      // Auto-create a job site from the address if provided
      if (projectAddress.trim() && project) {
        const { error: jobSiteError } = await supabase.from('job_sites').insert({
          name: projectName.trim(),
          address: projectAddress.trim(),
          project_id: project.id,
          organization_id: orgCreated.id,
          is_active: true,
        });
        if (jobSiteError) {
          console.warn('Job site creation failed:', jobSiteError.message);
          toast({ title: 'Note', description: 'Project created but job site could not be saved. You can add it later.', variant: 'default' });
        }
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

  const handleCompanyIdentitySave = async () => {
    await persistStep({ onboarding_step: 5 });
    setStep(5);
  };

  const handleAICalibrationSave = async () => {
    await persistStep({ onboarding_step: 6 });
    setPlaybookJobType(projectJobType || (commonJobTypes.length > 0 ? commonJobTypes[0] : ''));
    setStep(6);
  };

  const handleGeneratePlaybook = async () => {
    if (!playbookJobType.trim()) return;
    setPlaybookGenerating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-playbook', {
        body: { job_type: playbookJobType.trim(), audience: 'office' },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setPlaybookResult(data);
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setPlaybookGenerating(false);
    }
  };

  const handleSavePlaybook = async () => {
    if (!playbookResult || !orgCreated) return;
    setPlaybookSaving(true);
    try {
      const phases = (playbookResult.phases ?? []).map((p: any, idx: number) => ({
        name: p.name,
        description: p.description ?? '',
        sequence_order: p.sequence_order ?? idx + 1,
        tasks: (p.tasks ?? []).map((t: any, ti: number) => ({
          title: t.title,
          description: t.description ?? '',
          role_type: t.role_type ?? 'laborer',
          expected_hours_low: t.expected_hours_low ?? 0,
          expected_hours_high: t.expected_hours_high ?? 0,
          required_flag: t.required ?? true,
          allow_skip: !(t.required ?? true),
          density_weight: 1,
          sequence_order: ti + 1,
        })),
      }));

      await supabase.rpc('rpc_create_playbook', {
        p_organization_id: orgCreated.id,
        p_name: playbookResult.name || `${playbookJobType} Playbook`,
        p_job_type: playbookResult.job_type || playbookJobType,
        p_description: playbookResult.description || '',
        p_phases: phases as any,
        p_audience: 'office',
        p_trade_id: null,
      });

      toast({ title: 'Playbook saved!' });
      await handleFinish();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setPlaybookSaving(false);
    }
  };

  const toggleJobType = (jt: string) => {
    setCommonJobTypes(prev =>
      prev.includes(jt) ? prev.filter(x => x !== jt) : [...prev, jt]
    );
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

        {/* Step 1: Organization + Timezone + Province */}
        {step === 1 && (
          <>
            <CardHeader className="text-center pt-6 pb-4">
              <div className="mx-auto mb-4 relative">
                <img src={projectPathLogo} alt="Project Path" className="h-28 w-auto mx-auto" />
              </div>
              <CardTitle className="text-2xl font-bold">
                Welcome, {userName}! 🎉
              </CardTitle>
              <CardDescription className="text-base mt-1">
                Let's set up your company to get started
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
                      <SelectValue placeholder="Select timezone" />
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
                      <SelectValue placeholder="Select province / region" />
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

              <Button
                onClick={handleOrgCreate}
                size="lg"
                className="w-full h-14 text-lg"
                disabled={isLoading || isSubmitting || !orgName.trim() || !timezone || !province}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 2: Trades */}
        {step === 2 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">What trades do you work in?</CardTitle>
              <CardDescription>
                Add as many as you need. You can always update this in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <div className="space-y-2">
                <Label>Trades or divisions</Label>
                <div className="flex gap-2">
                  <Input
                    value={tradeInputValue}
                    onChange={e => setTradeInputValue(e.target.value)}
                    placeholder="e.g. Framing, Electrical, Drywall"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (tradeInputValue.trim() && !tradesEntered.includes(tradeInputValue.trim())) {
                          setTradesEntered(prev => [...prev, tradeInputValue.trim()]);
                          setTradeInputValue('');
                        }
                      }
                    }}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (tradeInputValue.trim() && !tradesEntered.includes(tradeInputValue.trim())) {
                        setTradesEntered(prev => [...prev, tradeInputValue.trim()]);
                        setTradeInputValue('');
                      }
                    }}
                    variant="outline"
                    className="h-11 px-4"
                    disabled={!tradeInputValue.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
                {tradesEntered.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tradesEntered.map(trade => (
                      <Badge key={trade} variant="secondary" className="gap-1.5 pr-1.5">
                        {trade}
                        <button
                          type="button"
                          onClick={() => setTradesEntered(prev => prev.filter(t => t !== trade))}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleTradesSave} className="flex-1" disabled={isLoading || isSubmitting}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  ) : tradesEntered.length > 0 ? (
                    <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Skip for now <ArrowRight className="ml-2 h-4 w-4" /></>
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
                <Button onClick={handleProjectCreate} className="flex-1" disabled={isLoading || isSubmitting}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finishing...
                    </>
                  ) : projectName.trim() ? (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Create & Finish Setup
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Finish Setup
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}
        {/* Step 4: Company Identity */}
        {step === 4 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Tell us about your business</CardTitle>
              <CardDescription>This helps the AI speak your language</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              <div className="space-y-2">
                <Label>Business Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'general_contractor', label: 'General Contractor', icon: Building2 },
                    { value: 'specialty_trade', label: 'Specialty Trade', icon: Wrench },
                    { value: 'design_build', label: 'Design-Build', icon: Ruler },
                    { value: 'owner_builder', label: 'Owner-Builder', icon: Home },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setBusinessType(opt.value)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-sm font-medium transition-all ${
                        businessType === opt.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      <opt.icon className="h-5 w-5 shrink-0" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Years in Business</Label>
                  <Select value={yearsInBusiness} onValueChange={setYearsInBusiness}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {['Under 2', '2-5', '5-10', '10-20', '20+'].map(y => (
                        <SelectItem key={y} value={y}>{y} years</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Typical Project Size</Label>
                  <Select value={projectSize} onValueChange={setProjectSize}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {[
                        { value: 'small', label: 'Small (under $100K)' },
                        { value: 'medium', label: 'Medium ($100K–$500K)' },
                        { value: 'large', label: 'Large ($500K–$2M)' },
                        { value: 'enterprise', label: 'Enterprise ($2M+)' },
                      ].map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Primary Service Area</Label>
                <Input
                  value={serviceArea}
                  onChange={e => setServiceArea(e.target.value)}
                  placeholder="e.g. Greater Vancouver, BC"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />Back
                </Button>
                <Button onClick={handleCompanyIdentitySave} className="flex-1">
                  {businessType ? 'Continue' : 'Skip for now'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 5: AI Calibration */}
        {step === 5 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Calibrate your AI</CardTitle>
              <CardDescription>Answer {4 - calQuestion + 1} more question{calQuestion < 4 ? 's' : ''} so your AI starts smarter</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              {/* Progress dots */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4].map(q => (
                  <div key={q} className={`h-2 w-2 rounded-full ${q <= calQuestion ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>

              {calQuestion === 1 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">What's your typical gross margin target?</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {['Under 10%', '10-15%', '15-20%', '20-25%', 'Over 25%'].map(opt => (
                      <button key={opt} type="button" onClick={() => { setMarginTarget(opt); setCalQuestion(2); }}
                        className={`p-3 rounded-lg border text-sm text-left transition-all ${marginTarget === opt ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {calQuestion === 2 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">Which job types do you run most often?</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Residential Renovation', 'Commercial Fit-Out', 'New Construction', 'Tenant Improvement', 'Infrastructure', 'Industrial', 'Mixed-Use'].map(jt => (
                      <button key={jt} type="button" onClick={() => toggleJobType(jt)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${commonJobTypes.includes(jt) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-border/80'}`}>
                        {jt}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" onClick={() => setCalQuestion(3)} disabled={commonJobTypes.length === 0}>
                    Next <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              )}

              {calQuestion === 3 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">What's your biggest operational pain point?</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: 'schedule', label: 'Schedule slippage', desc: 'Jobs run longer than planned' },
                      { value: 'budget', label: 'Budget overruns', desc: 'Costs exceed estimates too often' },
                      { value: 'quality', label: 'Quality & deficiencies', desc: 'Too many punch list items' },
                      { value: 'communication', label: 'Communication', desc: 'Team coordination breaks down' },
                      { value: 'cashflow', label: 'Cash flow', desc: 'Invoicing and payments are delayed' },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => { setPainPoint(opt.value); setCalQuestion(4); }}
                        className={`p-3 rounded-lg border text-left transition-all ${painPoint === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {calQuestion === 4 && (
                <div className="space-y-3">
                  <Label className="text-base font-medium">How do you primarily work?</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: 'self_perform', label: 'We self-perform most trades' },
                      { value: 'subcontract', label: 'We subcontract most trades' },
                      { value: 'mixed', label: '50/50 mix' },
                    ].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setWorkModel(opt.value)}
                        className={`p-3 rounded-lg border text-sm text-left transition-all ${workModel === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => calQuestion > 1 ? setCalQuestion(calQuestion - 1) : setStep(4)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />Back
                </Button>
                {calQuestion === 4 && (
                  <Button onClick={handleAICalibrationSave} className="flex-1" disabled={!workModel}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {calQuestion < 4 && (
                  <Button variant="ghost" onClick={handleAICalibrationSave} className="text-xs">
                    Skip calibration
                  </Button>
                )}
              </div>
            </CardContent>
          </>
        )}

        {/* Step 6: Generate Playbook */}
        {step === 6 && !showCelebration && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Generate your first playbook</CardTitle>
              <CardDescription>Watch the AI build a complete job template in 15 seconds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6">
              {!playbookResult && !playbookGenerating && (
                <>
                  <div className="space-y-2">
                    <Label>Job Type</Label>
                    <Input
                      value={playbookJobType}
                      onChange={e => setPlaybookJobType(e.target.value)}
                      placeholder="e.g. Kitchen Remodel, Commercial Fit-Out"
                      className="h-12"
                    />
                  </div>
                  <Button
                    onClick={handleGeneratePlaybook}
                    size="lg"
                    className="w-full h-14 text-lg gap-2 animate-pulse hover:animate-none"
                    disabled={!playbookJobType.trim()}
                  >
                    <Sparkles className="h-5 w-5" />
                    Generate Playbook
                  </Button>
                </>
              )}

              {playbookGenerating && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium animate-pulse">Building phases and tasks...</p>
                </div>
              )}

              {playbookResult && !playbookGenerating && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold">{playbookResult.name}</p>
                  <div className="space-y-1.5">
                    {(playbookResult.phases ?? []).map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{p.name}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{(p.tasks ?? []).length} tasks</Badge>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleSavePlaybook} className="w-full gap-2" disabled={playbookSaving}>
                    {playbookSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Looks good — save it
                  </Button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(5)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />Back
                </Button>
                {!playbookResult && (
                  <Button variant="ghost" onClick={handleFinish} className="text-xs">
                    Skip for now
                  </Button>
                )}
              </div>
            </CardContent>
          </>
        )}

        {/* Celebration Screen */}
        {showCelebration && (
          <>
            <CardContent className="py-12 text-center space-y-6">
              {/* CSS Confetti */}
              <div className="relative">
                <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
                {/* Confetti dots */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full animate-[confetti_1.5s_ease-out_forwards]"
                    style={{
                      left: '50%',
                      top: '50%',
                      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
                      animationDelay: `${i * 0.1}s`,
                      transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-${40 + (i % 3) * 20}px)`,
                      opacity: 0,
                    }}
                  />
                ))}
              </div>

              <div>
                <h2 className="text-2xl font-bold">You're all set!</h2>
                <p className="text-muted-foreground mt-1">Your command center is ready. Here's what's waiting for you:</p>
              </div>

              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <Sun className="h-5 w-5 text-amber-500 shrink-0" />
                  <span>Morning Briefing ready</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  <span>AI Assist calibrated</span>
                </div>
                {playbookResult && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                    <BookOpen className="h-5 w-5 text-green-500 shrink-0" />
                    <span>Playbook generated</span>
                  </div>
                )}
              </div>

              <Button size="lg" className="w-full h-14 text-lg" onClick={onComplete}>
                <Rocket className="mr-2 h-5 w-5" />
                Launch ProjectPath
              </Button>
            </CardContent>
          </>
        )}
      </Card>

      <style>{`
        @keyframes scale-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes confetti {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(0); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) translateY(-80px) scale(1); }
        }
      `}</style>
    </div>
  );
}
