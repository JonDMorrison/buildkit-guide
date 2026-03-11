import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Clock, X, RefreshCw, Loader2, Users } from "lucide-react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { useOrganization } from "@/hooks/useOrganization";

interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  project_id: string | null;
  projects: {
    name: string;
  } | null;
}

export const InvitesList = () => {
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrganizationId) {
      fetchInvitations();
    }
  }, [activeOrganizationId]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select(`id,email,full_name,role,status,created_at,expires_at,project_id,projects:project_id (name)`)
        .eq('organization_id', activeOrganizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data as unknown as Invitation[] || []);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error loading invitations',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (inviteId: string, email: string) => {
    if (!confirm(`Cancel invitation to ${email}?`)) return;

    setActionLoading(inviteId);
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: 'Invitation cancelled',
        description: `The invitation to ${email} has been cancelled.`,
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Error cancelling invitation',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (invite: Invitation) => {
    setActionLoading(invite.id);
    try {
      // Cancel old invite and send new one
      await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invite.id);

      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: {
          email: invite.email,
          fullName: invite.full_name,
          projectId: invite.project_id,
          role: invite.role,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Invitation resent',
        description: `A new invitation has been sent to ${invite.email}.`,
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: 'Error resending invitation',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'project_manager':
        return 'Project Manager';
      case 'foreman':
        return 'Foreman';
      case 'internal_worker':
        return 'Internal Worker';
      case 'external_trade':
        return 'External Trade';
      default:
        return role || 'Not set';
    }
  };

  const isExpired = (expiresAt: string) => isPast(parseISO(expiresAt));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          {invitations.length} pending {invitations.length === 1 ? 'invitation' : 'invitations'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No pending invitations. Invite new team members to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invite) => {
              const expired = isExpired(invite.expires_at);
              
              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-foreground truncate">
                        {invite.full_name || invite.email}
                      </p>
                      <Badge variant={expired ? 'destructive' : 'secondary'}>
                        {expired ? 'Expired' : 'Pending'}
                      </Badge>
                      <Badge variant="outline">
                        {getRoleLabel(invite.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {invite.email}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Sent {formatDistanceToNow(parseISO(invite.created_at), { addSuffix: true })}
                      </span>
                      {invite.projects && (
                        <span>Project: {invite.projects.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResend(invite)}
                      disabled={actionLoading === invite.id}
                    >
                      {actionLoading === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Resend</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(invite.id, invite.email)}
                      disabled={actionLoading === invite.id}
                    >
                      <X className="h-4 w-4 text-destructive" />
                      <span className="ml-1 hidden sm:inline">Cancel</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
