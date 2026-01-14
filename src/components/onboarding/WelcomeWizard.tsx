import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Rocket, 
  HardHat, 
  Users, 
  ClipboardCheck, 
  Shield, 
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Building2,
  Loader2,
  PartyPopper,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import projectPulseLogo from '@/assets/project-pulse-logo.png';

interface WelcomeWizardProps {
  onComplete: () => void;
}

type Role = 'project_manager' | 'foreman' | 'worker' | 'admin';

const roles: { value: Role; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'project_manager', 
    label: 'Project Manager', 
    icon: <ClipboardCheck className="h-6 w-6" />,
    description: 'Oversee multiple projects and teams'
  },
  { 
    value: 'foreman', 
    label: 'Foreman / Superintendent', 
    icon: <HardHat className="h-6 w-6" />,
    description: 'Lead crews and manage daily operations'
  },
  { 
    value: 'worker', 
    label: 'Field Worker / Tradesperson', 
    icon: <Users className="h-6 w-6" />,
    description: 'Execute tasks and report progress'
  },
  { 
    value: 'admin', 
    label: 'Owner / Administrator', 
    icon: <Shield className="h-6 w-6" />,
    description: 'Full access to all features and settings'
  },
];

const features = [
  {
    icon: <ClipboardCheck className="h-8 w-8 text-primary" />,
    title: 'Task Management',
    description: 'Track tasks, blockers, and progress in real-time',
  },
  {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: 'Safety Forms',
    description: 'Digital safety logs, hazard IDs, and compliance tracking',
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: 'Team Coordination',
    description: 'Keep every trade aligned and accountable',
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: 'AI Assistant',
    description: 'Get instant answers from your project documents',
  },
];

export default function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [orgName, setOrgName] = useState('');
  const [createSample, setCreateSample] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [orgCreated, setOrgCreated] = useState<{ id: string; name: string } | null>(null);

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleRetrySample = async () => {
    if (!orgCreated) return;
    
    setSampleError(null);
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-sample-project', {
        body: { organizationId: orgCreated.id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: 'Sample project created',
        description: 'A sample project has been added to your organization.',
      });
      setSampleError(null);
      onComplete();
    } catch (error: any) {
      console.error('Retry sample project error:', error);
      setSampleError(error.message || 'Failed to create sample project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipSample = () => {
    setSampleError(null);
    onComplete();
  };

  const handleFinish = async () => {
    setIsLoading(true);
    setSampleError(null);
    
    try {
      // Create organization if name provided
      if (orgName.trim()) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({ 
            name: orgName.trim(),
            slug: orgName.trim().toLowerCase().replace(/\s+/g, '-')
          })
          .select()
          .single();

        if (orgError) throw orgError;

        // Add user as admin of the organization
        if (org) {
          await supabase
            .from('organization_memberships')
            .insert({
              organization_id: org.id,
              user_id: user!.id,
              role: 'admin',
              is_active: true,
            });

          setOrgCreated({ id: org.id, name: org.name });

          // Create sample project if requested
          if (createSample) {
            try {
              const { data, error } = await supabase.functions.invoke('create-sample-project', {
                body: { organizationId: org.id }
              });
              
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              
              // Success - complete onboarding
              onComplete();
            } catch (sampleError: any) {
              console.error('Sample project creation failed:', sampleError);
              // Show error with retry option instead of silently failing
              setSampleError(sampleError.message || 'Failed to create sample project');
              setIsLoading(false);
              return; // Don't complete - show error state
            }
          } else {
            onComplete();
          }
        }
      } else {
        onComplete();
      }
    } catch (error: any) {
      console.error('Error during onboarding:', error);
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong. You can set up your organization later.',
        variant: 'destructive',
      });
      onComplete();
    } finally {
      setIsLoading(false);
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';

  // Show error state with recovery options
  if (sampleError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg shadow-2xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Sample Project Failed
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Your organization "{orgCreated?.name}" was created, but we couldn't create the sample project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sampleError}</AlertDescription>
            </Alert>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleRetrySample} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSkipSample}
                disabled={isLoading}
              >
                Skip Sample Project
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              You can always create projects manually from the dashboard.
            </p>
          </CardContent>
        </Card>
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

        {/* Step 1: Welcome */}
        {step === 1 && (
          <>
            <CardHeader className="text-center pt-8 pb-4">
              <div className="mx-auto mb-4 relative">
                <img src={projectPulseLogo} alt="Project Path" className="h-20 w-auto mx-auto" />
                <div className="absolute -right-2 -bottom-2 bg-primary text-primary-foreground rounded-full p-2">
                  <PartyPopper className="h-5 w-5" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">
                Welcome, {userName}! 🎉
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                Let's get you set up in just a few quick steps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8">
              <div className="bg-muted/50 rounded-xl p-6 text-center">
                <Rocket className="h-12 w-12 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Project Path helps you keep every trade accountable and your construction projects on track. 
                  No more chasing updates or buried spreadsheets.
                </p>
              </div>
              
              <Button onClick={handleNext} size="lg" className="w-full h-14 text-lg">
                Let's Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 2: Role Selection */}
        {step === 2 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">What's your role?</CardTitle>
              <CardDescription>
                This helps us customize your experience
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
              
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleNext} 
                  className="flex-1"
                  disabled={!selectedRole}
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Organization Setup */}
        {step === 3 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Set up your company</CardTitle>
              <CardDescription>
                Create your organization to start adding projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Company / Organization Name</Label>
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

                <button
                  onClick={() => setCreateSample(!createSample)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    createSample
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${createSample ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Create a sample project</p>
                    <p className="text-sm text-muted-foreground">
                      Explore the app with realistic demo data
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    createSample ? 'bg-primary border-primary' : 'border-muted-foreground'
                  }`}>
                    {createSample && <CheckCircle className="h-4 w-4 text-primary-foreground" />}
                  </div>
                </button>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleNext} className="flex-1">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: Quick Tour */}
        {step === 4 && (
          <>
            <CardHeader className="text-center pt-6 pb-2">
              <CardTitle className="text-2xl font-bold">Here's what you can do</CardTitle>
              <CardDescription>
                A quick look at your new superpowers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-6">
              <div className="grid sm:grid-cols-2 gap-4">
                {features.map((feature, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="mb-3">{feature.icon}</div>
                    <h4 className="font-semibold mb-1">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button 
                  onClick={handleFinish} 
                  className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Go to Dashboard
                      <Rocket className="ml-2 h-4 w-4" />
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