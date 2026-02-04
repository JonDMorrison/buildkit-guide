import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';
import projectPathLogo from '@/assets/project-path-logo.png';
import { cn } from '@/lib/utils';

const signInSchema = z.object({
  email: z.string().trim().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, { message: 'Full name must be at least 2 characters' }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

// InputWrapper defined outside component to prevent re-creation on each render
const InputWrapper = ({ 
  icon: Icon, 
  error, 
  children 
}: { 
  icon: React.ElementType; 
  error?: string; 
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <div className={cn(
      "relative flex items-center rounded-xl border bg-background/50 backdrop-blur-sm transition-all duration-200",
      "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
      error ? "border-destructive" : "border-border/50 hover:border-border"
    )}>
      <Icon className="absolute left-4 h-5 w-5 text-muted-foreground pointer-events-none" />
      {children}
    </div>
    {error && (
      <p className="text-xs text-destructive pl-1 animate-fade-in">{error}</p>
    )}
  </div>
);

const features = [
  "Real-time project coordination",
  "AI-powered task management",
  "Safety compliance tracking",
  "Team collaboration tools",
];

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [signInForm, setSignInForm] = useState<SignInForm>({
    email: '',
    password: '',
  });

  const [signUpForm, setSignUpForm] = useState<SignUpForm>({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: '',
  });

  const [signInErrors, setSignInErrors] = useState<Partial<Record<keyof SignInForm, string>>>({});
  const [signUpErrors, setSignUpErrors] = useState<Partial<Record<keyof SignUpForm, string>>>({});

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErrors({});
    
    try {
      const validatedData = signInSchema.parse(signInForm);
      setLoading(true);
      
      const { error } = await signIn(validatedData.email, validatedData.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Login failed',
            description: 'Invalid email or password. Please try again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Login failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof SignInForm, string>> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof SignInForm] = err.message;
          }
        });
        setSignInErrors(errors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});
    
    try {
      const validatedData = signUpSchema.parse(signUpForm);
      setLoading(true);
      
      const { error } = await signUp(
        validatedData.email,
        validatedData.password,
        validatedData.fullName
      );
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: 'Registration failed',
            description: 'This email is already registered. Please sign in instead.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Registration failed',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Account created!',
          description: 'You have been signed in successfully.',
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof SignUpForm, string>> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof SignUpForm] = err.message;
          }
        });
        setSignUpErrors(errors);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="space-y-8">
            <div>
              <img 
                src={projectPathLogo} 
                alt="Project Path" 
                className="h-32 w-auto mb-6"
              />
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Build smarter,<br />
                <span className="text-primary">together.</span>
              </h1>
              <p className="mt-4 text-lg text-zinc-400 max-w-md">
                The construction coordination platform that keeps your field teams aligned and projects on track.
              </p>
            </div>
            
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div 
                  key={feature}
                  className="flex items-center gap-3 text-zinc-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            
            <div className="pt-8 border-t border-zinc-700/50">
              <p className="text-sm text-zinc-500">
                Trusted by construction teams across North America
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 p-4 sm:p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <img 
              src={projectPathLogo} 
              alt="Project Path" 
              className="h-28 w-auto mx-auto mb-2"
            />
            <p className="text-sm text-muted-foreground">Field coordination made simple</p>
          </div>

          <Card className="p-6 sm:p-8 shadow-2xl border-border/50 bg-card/80 backdrop-blur-xl">
            <div className="hidden lg:block text-center mb-6">
              <h2 className="text-2xl font-semibold">
                {activeTab === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === 'signin' 
                  ? 'Sign in to continue to your projects' 
                  : 'Start coordinating your field teams today'}
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 mb-6 h-12 p-1 bg-secondary/50">
                <TabsTrigger 
                  value="signin" 
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <InputWrapper icon={Mail} error={signInErrors.email}>
                    <Input
                      type="email"
                      value={signInForm.email}
                      onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                      placeholder="Email address"
                      className="pl-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </InputWrapper>

                  <InputWrapper icon={Lock} error={signInErrors.password}>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={signInForm.password}
                      onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                      placeholder="Password"
                      className="pl-12 pr-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </InputWrapper>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium group"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <InputWrapper icon={User} error={signUpErrors.fullName}>
                    <Input
                      type="text"
                      value={signUpForm.fullName}
                      onChange={(e) => setSignUpForm({ ...signUpForm, fullName: e.target.value })}
                      placeholder="Full name"
                      className="pl-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </InputWrapper>

                  <InputWrapper icon={Mail} error={signUpErrors.email}>
                    <Input
                      type="email"
                      value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                      placeholder="Email address"
                      className="pl-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </InputWrapper>

                  <div className="space-y-1.5">
                    <InputWrapper icon={Lock} error={signUpErrors.password}>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={signUpForm.password}
                        onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                        placeholder="Password"
                        className="pl-12 pr-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </InputWrapper>
                    <p className="text-xs text-muted-foreground pl-1">At least 6 characters</p>
                  </div>

                  <InputWrapper icon={Lock} error={signUpErrors.confirmPassword}>
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={signUpForm.confirmPassword}
                      onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                      placeholder="Confirm password"
                      className="pl-12 pr-12 h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </InputWrapper>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium group"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
