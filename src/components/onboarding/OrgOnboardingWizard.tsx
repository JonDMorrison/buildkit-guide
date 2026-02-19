import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useOperationalProfile, OperationalProfileData } from '@/hooks/useOperationalProfile';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Settings2,
  Stethoscope,
  Brain,
  Sparkles,
} from 'lucide-react';

interface OrgOnboardingWizardProps {
  onComplete: () => void;
  startPhase?: number;
}

// Phase 1 config options
const currencyOptions = [
  { value: 'CAD', label: 'CAD', desc: 'Canadian Dollar' },
  { value: 'USD', label: 'USD', desc: 'US Dollar' },
];

const taxModelOptions = [
  { value: 'gst_only', label: 'GST Only', desc: '5% federal goods & services tax' },
  { value: 'gst_pst', label: 'GST + PST', desc: 'Federal + provincial sales tax' },
  { value: 'hst', label: 'HST', desc: 'Harmonized sales tax' },
  { value: 'none', label: 'None', desc: 'No sales tax applied' },
];

const laborCostOptions = [
  { value: 'blended', label: 'Blended Rate', desc: 'Single averaged rate across all trades' },
  { value: 'per_trade', label: 'Per-Trade Rates', desc: 'Different rate for each trade' },
  { value: 'per_worker', label: 'Per-Worker Rates', desc: 'Individual rates per worker' },
];

const rateSourceOptions = [
  { value: 'manual', label: 'Manual Entry', desc: 'Manually enter all rates' },
  { value: 'union_scale', label: 'Union Scale', desc: 'Based on union rate tables' },
  { value: 'market', label: 'Market Average', desc: 'Based on regional averages' },
];

const invoicePermOptions = [
  { value: 'admin_only', label: 'Admin Only', desc: 'Only admins can send invoices' },
  { value: 'pm_and_admin', label: 'PM + Admin', desc: 'PMs and admins can send' },
  { value: 'anyone', label: 'Any Role', desc: 'No restrictions on sending' },
  { value: 'strict', label: 'Strict Approval', desc: 'Requires approval workflow' },
];

const workflowOptions = [
  { value: 'standard', label: 'Standard', desc: 'Basic task and project management' },
  { value: 'ai_optimized', label: 'AI-Optimized Flow', desc: '10-phase guided workflow with gates' },
];

// Phase 2 questions
type DiagnosticQuestion = {
  key: string;
  question: string;
  type?: 'boolean';
  options?: { value: string; label: string }[];
};

const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    key: 'over_estimate_action',
    question: 'When a project exceeds its estimate, what do you typically do?',
    options: [
      { value: 'absorb_loss', label: 'Absorb the loss' },
      { value: 'change_order', label: 'Issue a change order' },
      { value: 'adjust_future', label: 'Adjust future pricing' },
      { value: 'not_tracked', label: 'Not tracked' },
    ],
  },
  {
    key: 'invoice_approver',
    question: 'Who typically approves invoices before they are sent?',
    options: [
      { value: 'owner', label: 'Owner' },
      { value: 'pm', label: 'Project Manager' },
      { value: 'admin', label: 'Admin' },
      { value: 'anyone', label: 'Anyone' },
    ],
  },
  {
    key: 'tasks_before_quote',
    question: 'Do tasks ever begin before quote approval?',
    type: 'boolean',
  },
  {
    key: 'time_audit_frequency',
    question: 'How often are time entries audited?',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'daily', label: 'Daily' },
    ],
  },
  {
    key: 'track_variance_per_trade',
    question: 'Do you track estimate variance per trade?',
    type: 'boolean',
  },
  {
    key: 'profit_leakage_source',
    question: 'What causes the most profit leakage in your projects?',
    options: [
      { value: 'labor', label: 'Labor overruns' },
      { value: 'material', label: 'Material costs' },
      { value: 'scope_creep', label: 'Scope creep' },
      { value: 'unknown', label: "Don't know / Not tracked" },
    ],
  },
  {
    key: 'quote_standardization',
    question: 'Are quotes standardized or custom every time?',
    options: [
      { value: 'standardized', label: 'Standardized templates' },
      { value: 'semi_custom', label: 'Mostly standard with tweaks' },
      { value: 'fully_custom', label: 'Fully custom every time' },
    ],
  },
  {
    key: 'require_safety_before_work',
    question: 'Do you require safety or compliance forms before work begins?',
    type: 'boolean',
  },
];

export default function OrgOnboardingWizard({ onComplete, startPhase }: OrgOnboardingWizardProps) {
  const { toast } = useToast();
  const { profile, saveProfile, isSaving, wizardPhaseCompleted } = useOperationalProfile();

  // Determine starting phase: resume from saved progress or explicit start
  const initialPhase = startPhase ?? Math.min(wizardPhaseCompleted + 1, 3);
  const [phase, setPhase] = useState(initialPhase);
  const [localData, setLocalData] = useState<Partial<OperationalProfileData>>({});

  // Sync from profile when loaded
  useEffect(() => {
    if (profile) {
      setLocalData(prev => ({ ...profile, ...prev }));
    }
  }, [profile]);

  const merged = { ...profile, ...localData };

  const updateField = (key: string, value: any) => {
    setLocalData(prev => ({ ...prev, [key]: value }));
  };

  const savePhase = async (phaseNum: number) => {
    try {
      await saveProfile({
        ...localData,
        wizard_phase_completed: phaseNum,
      });
      toast({ title: `Phase ${phaseNum} saved`, description: 'Your progress has been saved.' });
    } catch (e: any) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
      throw e;
    }
  };

  const handleNextPhase = async () => {
    await savePhase(phase);
    if (phase < 3) {
      setPhase(phase + 1);
    } else {
      onComplete();
    }
  };

  const handleBackPhase = () => {
    if (phase > 1) setPhase(phase - 1);
  };

  const phaseIcons = [
    <Settings2 key="1" className="h-5 w-5" />,
    <Stethoscope key="2" className="h-5 w-5" />,
    <Brain key="3" className="h-5 w-5" />,
  ];
  const phaseLabels = ['Structural Configuration', 'Operational Diagnostics', 'AI Calibration'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/95 backdrop-blur">
        {/* Phase progress */}
        <div className="px-6 pt-6">
          <div className="flex gap-2 mb-3">
            {[1, 2, 3].map(p => (
              <button
                key={p}
                onClick={() => p <= wizardPhaseCompleted + 1 && setPhase(p)}
                disabled={p > wizardPhaseCompleted + 1}
                className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  p === phase
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : p <= wizardPhaseCompleted
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {p <= wizardPhaseCompleted ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  phaseIcons[p - 1]
                )}
                <span className="hidden sm:inline truncate">{phaseLabels[p - 1]}</span>
                <span className="sm:hidden">P{p}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Phase 1: Structural Configuration */}
        {phase === 1 && (
          <>
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Structural Configuration
              </CardTitle>
              <CardDescription>
                Define your organization's financial and operational foundation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pb-6 max-h-[60vh] overflow-y-auto">
              <OptionGroup label="Base Currency" value={merged.base_currency} options={currencyOptions} onChange={v => updateField('base_currency', v)} />
              <OptionGroup label="Tax Model" value={merged.tax_model} options={taxModelOptions} onChange={v => updateField('tax_model', v)} />
              <OptionGroup label="Labor Cost Model" value={merged.labor_cost_model} options={laborCostOptions} onChange={v => updateField('labor_cost_model', v)} />
              <OptionGroup label="Rate Source" value={merged.rate_source} options={rateSourceOptions} onChange={v => updateField('rate_source', v)} />
              <OptionGroup label="Invoice Permission Model" value={merged.invoice_permission_model} options={invoicePermOptions} onChange={v => updateField('invoice_permission_model', v)} />
              <OptionGroup label="Default Workflow Mode" value={merged.workflow_mode_default} options={workflowOptions} onChange={v => updateField('workflow_mode_default', v)} />
            </CardContent>
          </>
        )}

        {/* Phase 2: Operational Diagnostics */}
        {phase === 2 && (
          <>
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Operational Diagnostics
              </CardTitle>
              <CardDescription>
                Help us understand how your business operates day-to-day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-6 max-h-[60vh] overflow-y-auto">
              {diagnosticQuestions.map(q => (
                <div key={q.key} className="space-y-2">
                  <Label className="text-sm font-semibold">{q.question}</Label>
                  {q.type === 'boolean' ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Switch
                        checked={merged[q.key as keyof OperationalProfileData] === true}
                        onCheckedChange={v => updateField(q.key, v)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {merged[q.key as keyof OperationalProfileData] === true ? 'Yes' : 'No'}
                      </span>
                    </div>
                  ) : (
                    <RadioGroup
                      value={(merged[q.key as keyof OperationalProfileData] as string) || ''}
                      onValueChange={v => updateField(q.key, v)}
                      className="grid grid-cols-2 gap-2"
                    >
                      {q.options!.map(opt => (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                            merged[q.key as keyof OperationalProfileData] === opt.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value={opt.value} />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              ))}
            </CardContent>
          </>
        )}

        {/* Phase 3: AI Calibration */}
        {phase === 3 && (
          <>
            <CardHeader className="pt-4 pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Calibration
              </CardTitle>
              <CardDescription>
                Configure how the AI assistant behaves for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Should AI block risky actions automatically?
                </Label>
                <RadioGroup
                  value={merged.ai_risk_mode || 'balanced'}
                  onValueChange={v => updateField('ai_risk_mode', v)}
                  className="space-y-2"
                >
                  {[
                    { value: 'strict', label: 'Strict', desc: 'Block risky actions automatically' },
                    { value: 'balanced', label: 'Balanced', desc: 'Warn but allow override' },
                    { value: 'advisory', label: 'Advisory', desc: 'Suggest only, never block' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                        (merged.ai_risk_mode || 'balanced') === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} className="mt-0.5" />
                      <div>
                        <span className="font-medium text-sm">{opt.label}</span>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <AIToggle
                label="Auto-generate change order suggestions"
                description="AI will suggest change orders when scope deviations are detected"
                checked={merged.ai_auto_change_orders}
                onChange={v => updateField('ai_auto_change_orders', v)}
              />
              <AIToggle
                label="Flag profit risk early"
                description="AI monitors burn rate and warns before margins erode"
                checked={merged.ai_flag_profit_risk}
                onChange={v => updateField('ai_flag_profit_risk', v)}
              />
              <AIToggle
                label="Recommend price adjustments"
                description="AI suggests rate changes based on historical variance data"
                checked={merged.ai_recommend_pricing}
                onChange={v => updateField('ai_recommend_pricing', v)}
              />
            </CardContent>
          </>
        )}

        {/* Navigation */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            {phase > 1 && (
              <Button variant="outline" onClick={handleBackPhase} className="flex-1" disabled={isSaving}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            <Button onClick={handleNextPhase} className="flex-1" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : phase < 3 ? (
                <>
                  Save & Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Complete Setup
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Reusable option group component
function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; desc: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <label
            key={opt.value}
            className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
              value === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value={opt.value} className="mt-0.5" />
            <div>
              <span className="font-medium text-sm">{opt.label}</span>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

// AI toggle component
function AIToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
