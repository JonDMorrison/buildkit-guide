import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProjectMember {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  trade_id: string | null;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface Trade {
  id: string;
  name: string;
}

interface EditUserRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ProjectMember;
  onSuccess: () => void;
}

export const EditUserRoleModal = ({
  open,
  onOpenChange,
  member,
  onSuccess,
}: EditUserRoleModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [selectedTrade, setSelectedTrade] = useState(member.trade_id || '');

  useEffect(() => {
    if (open) {
      setSelectedRole(member.role);
      setSelectedTrade(member.trade_id || '');
      fetchTrades();
    }
  }, [open, member]);

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setTrades(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading trades',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRole) {
      toast({
        title: 'Missing information',
        description: 'Please select a role',
        variant: 'destructive',
      });
      return;
    }

    // External trade must have a trade selected
    if (selectedRole === 'external_trade' && !selectedTrade) {
      toast({
        title: 'Missing trade',
        description: 'External trade members must be assigned to a trade',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('project_members')
        .update({
          role: selectedRole as any,
          trade_id: selectedRole === 'external_trade' ? selectedTrade : null,
        })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: 'User role has been updated successfully.',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error updating role',
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
          <DialogTitle>Edit User Role</DialogTitle>
          <DialogDescription>
            Update the role for {member.profiles?.full_name || member.profiles?.email}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Project Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project_manager">Project Manager</SelectItem>
                <SelectItem value="foreman">Foreman</SelectItem>
                <SelectItem value="internal_worker">Internal Worker</SelectItem>
                <SelectItem value="external_trade">External Trade</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedRole === 'project_manager' && 'Can manage all aspects of the project'}
              {selectedRole === 'foreman' && 'Can create tasks, mark blockers, submit safety forms'}
              {selectedRole === 'internal_worker' && 'Can view and update assigned tasks only'}
              {selectedRole === 'external_trade' && 'Can view tasks for their trade and update status'}
            </p>
          </div>

          {selectedRole === 'external_trade' && (
            <div className="space-y-2">
              <Label htmlFor="trade">Trade Assignment</Label>
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger id="trade">
                  <SelectValue placeholder="Select a trade" />
                </SelectTrigger>
                <SelectContent>
                  {trades.map((trade) => (
                    <SelectItem key={trade.id} value={trade.id}>
                      {trade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
                  Updating...
                </>
              ) : (
                'Update Role'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
