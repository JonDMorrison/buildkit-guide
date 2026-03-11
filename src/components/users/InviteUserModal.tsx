import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail } from "lucide-react";

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  projectId?: string; // Optional: pre-select a project
}

interface Project {
  id: string;
  name: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator', description: 'Full access to manage the organization' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'internal_worker', label: 'Internal Worker' },
  { value: 'external_trade', label: 'External Trade' },
];

export const InviteUserModal = ({
  open,
  onOpenChange,
  onSuccess,
  projectId: initialProjectId,
}: InviteUserModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('internal_worker');
  const [projectId, setProjectId] = useState(initialProjectId || 'none');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProjects();
      if (initialProjectId) {
        setProjectId(initialProjectId);
      }
    }
  }, [open, initialProjectId]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id,name')
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call edge function to create invitation
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: { 
          email: email.toLowerCase().trim(),
          fullName: fullName || null,
          projectId: projectId === 'none' ? null : projectId,
          role: role,
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Check if email was actually sent
      if (data.emailSent) {
        toast({
          title: 'Invitation sent',
          description: `An invitation email has been sent to ${email}`,
        });
      } else if (data.emailError) {
        // Invitation created but email failed - show warning with invite link
        toast({
          title: 'Invitation created',
          description: data.emailError.includes('domain') 
            ? 'Email could not be sent. Please share this link manually or verify your domain at resend.com/domains'
            : `Email delivery failed: ${data.emailError}. You can share the invite link manually.`,
          variant: 'destructive',
          duration: 10000,
        });
        
        // If we got an invite link back, copy it to clipboard
        if (data.inviteLink) {
          try {
            await navigator.clipboard.writeText(data.inviteLink);
            toast({
              title: 'Invite link copied',
              description: 'The invite link has been copied to your clipboard. Share it manually with the user.',
            });
          } catch {
            console.log('Could not copy to clipboard');
          }
        }
      } else {
        toast({
          title: 'Invitation created',
          description: `Invitation created for ${email}`,
        });
      }

      // Reset form
      setEmail('');
      setFullName('');
      setRole('internal_worker');
      setProjectId(initialProjectId || 'none');
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error sending invitation',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite New User
          </DialogTitle>
          <DialogDescription>
            Invite a new team member to your company. They'll automatically join the organization and can be added to projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Initial Project Assignment (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProjects ? "Loading..." : "Select a project"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project assignment yet</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can always add them to more projects later from User Management.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
