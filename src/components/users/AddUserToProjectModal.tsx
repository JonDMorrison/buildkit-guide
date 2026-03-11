import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AddUserToProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
}

interface Trade {
  id: string;
  name: string;
}

export const AddUserToProjectModal = ({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: AddUserToProjectModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('internal_worker');
  const [selectedTrade, setSelectedTrade] = useState<string>('');

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchTrades();
    }
  }, [open, projectId]);

  const fetchUsers = async () => {
    try {
      // Get all users not already on this project
      const { data: existingMembers } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);

      const existingUserIds = existingMembers?.map(m => m.user_id) || [];

      let query = supabase
        .from('profiles')
        .select('id,email,full_name')
        .order('email');

      // Only filter if there are existing members
      if (existingUserIds.length > 0) {
        query = query.not('id', 'in', `(${existingUserIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading users',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('id,name')
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

    if (!selectedUser || !selectedRole) {
      toast({
        title: 'Missing information',
        description: 'Please select a user and role',
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
      const { error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_id: selectedUser,
        role: selectedRole as any,
        trade_id: selectedRole === 'external_trade' ? selectedTrade : null,
      });

      if (error) throw error;

      toast({
        title: 'User added',
        description: 'User has been added to the project successfully.',
      });

      // Reset form
      setSelectedUser('');
      setSelectedRole('internal_worker');
      setSelectedTrade('');
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error adding user',
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
          <DialogTitle>Add User to Project</DialogTitle>
          <DialogDescription>
            Assign an existing user to this project with a specific role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user">Select User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="user">
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {users.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No available users
                  </div>
                ) : (
                  users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

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
                  Adding...
                </>
              ) : (
                'Add User'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
