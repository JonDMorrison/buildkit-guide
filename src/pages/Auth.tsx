import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2 } from 'lucide-react';

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

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
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
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Horizon Coordination</h1>
          <p className="text-sm text-muted-foreground mt-1">Field coordination made simple</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <FormField
                label="Email"
                required
                error={signInErrors.email}
              >
                <Input
                  type="email"
                  value={signInForm.email}
                  onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                  placeholder="your.email@company.com"
                  className="min-h-[52px]"
                />
              </FormField>

              <FormField
                label="Password"
                required
                error={signInErrors.password}
              >
                <Input
                  type="password"
                  value={signInForm.password}
                  onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="min-h-[52px]"
                />
              </FormField>

              <Button
                type="submit"
                className="w-full min-h-[52px]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <FormField
                label="Full Name"
                required
                error={signUpErrors.fullName}
              >
                <Input
                  type="text"
                  value={signUpForm.fullName}
                  onChange={(e) => setSignUpForm({ ...signUpForm, fullName: e.target.value })}
                  placeholder="John Doe"
                  className="min-h-[52px]"
                />
              </FormField>

              <FormField
                label="Email"
                required
                error={signUpErrors.email}
              >
                <Input
                  type="email"
                  value={signUpForm.email}
                  onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                  placeholder="your.email@company.com"
                  className="min-h-[52px]"
                />
              </FormField>

              <FormField
                label="Password"
                required
                helper="At least 6 characters"
                error={signUpErrors.password}
              >
                <Input
                  type="password"
                  value={signUpForm.password}
                  onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="min-h-[52px]"
                />
              </FormField>

              <FormField
                label="Confirm Password"
                required
                error={signUpErrors.confirmPassword}
              >
                <Input
                  type="password"
                  value={signUpForm.confirmPassword}
                  onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="min-h-[52px]"
                />
              </FormField>

              <Button
                type="submit"
                className="w-full min-h-[52px]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;