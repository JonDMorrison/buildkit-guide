import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle, PartyPopper } from 'lucide-react';
import projectPulseLogo from '@/assets/project-pulse-logo.png';

type InviteStatus = 'loading' | 'valid' | 'expired' | 'already_used' | 'not_found' | 'error';

interface InviteData {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  expires_at: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const token = searchParams.get('token');
  
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteStatus('not_found');
      return;
    }
    
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, full_name, status, expires_at')
        .eq('token', token)
        .single();

      if (error || !data) {
        setInviteStatus('not_found');
        return;
      }

      if (data.status === 'accepted') {
        setInviteStatus('already_used');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setInviteStatus('expired');
        return;
      }

      setInviteData(data);
      setFullName(data.full_name || '');
      setInviteStatus('valid');
    } catch (error) {
      console.error('Error validating invite:', error);
      setInviteStatus('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match',
        variant: 'destructive',
      });
      return;
    }

    if (!inviteData || !token) return;

    setIsSubmitting(true);

    try {
      // Call edge function to create account and add to org/project
      const { data, error } = await supabase.functions.invoke('accept-invite', {
        body: { 
          token,
          password,
          fullName: fullName || inviteData.full_name,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // If existing user, redirect to login
      if (data.existingUser) {
        toast({
          title: 'Welcome back!',
          description: data.message,
        });
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
        return;
      }

      // Sign in the new user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password,
      });

      if (signInError) {
        console.error('Auto sign-in failed:', signInError);
        // Still show success, they can sign in manually
      }

      setShowSuccess(true);
      
      // Redirect after a moment
      setTimeout(() => {
        navigate('/welcome');
      }, 2000);
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({
        title: 'Error creating account',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
              <PartyPopper className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to the Team! 🎉</CardTitle>
            <CardDescription>
              Your account has been created successfully. Taking you to get started...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (inviteStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (inviteStatus !== 'valid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">
              {inviteStatus === 'not_found' && 'Invitation Not Found'}
              {inviteStatus === 'expired' && 'Invitation Expired'}
              {inviteStatus === 'already_used' && 'Invitation Already Used'}
              {inviteStatus === 'error' && 'Something Went Wrong'}
            </CardTitle>
            <CardDescription>
              {inviteStatus === 'not_found' && 'This invitation link is invalid or has been removed.'}
              {inviteStatus === 'expired' && 'This invitation has expired. Please request a new one.'}
              {inviteStatus === 'already_used' && 'This invitation has already been accepted. Try signing in instead.'}
              {inviteStatus === 'error' && 'We encountered an error. Please try again later.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={projectPulseLogo} alt="Project Pulse" className="h-16 w-auto mx-auto" />
          </div>
          <CardDescription>
            You've been invited to join. Set up your password to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteData?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />
            </div>
            
            <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Create My Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
