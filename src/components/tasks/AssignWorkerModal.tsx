import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { UserPlus, Search } from 'lucide-react';
import { Input } from '../ui/input';

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  trade_id: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  trade?: {
    id: string;
    name: string;
  } | null;
}

interface AssignWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  projectId: string;
  assignedTradeId?: string | null;
  currentAssignments: string[]; // Array of user_ids already assigned
  onAssignmentChanged: () => void;
}

export const AssignWorkerModal = ({
  open,
  onOpenChange,
  taskId,
  projectId,
  assignedTradeId,
  currentAssignments,
  onAssignmentChanged,
}: AssignWorkerModalProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByTrade, setFilterByTrade] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('project_members')
          .select(`
            id,
            user_id,
            role,
            trade_id,
            profile:profiles!project_members_user_id_fkey(id, full_name, email, avatar_url),
            trade:trades(id, name)
          `)
          .eq('project_id', projectId);

        if (error) throw error;

        // Filter out members already assigned
        const availableMembers = (data || []).filter(
          (m: any) => !currentAssignments.includes(m.user_id)
        );

        setMembers(availableMembers as ProjectMember[]);
      } catch (error: any) {
        toast({
          title: 'Error loading team members',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
    setSelectedUserIds([]);
    setSearchQuery('');
  }, [open, projectId, currentAssignments, toast]);

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTrade =
      !filterByTrade ||
      !assignedTradeId ||
      member.trade_id === assignedTradeId;

    return matchesSearch && matchesTrade;
  });

  const toggleSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) return;

    setSaving(true);
    try {
      const assignments = selectedUserIds.map((userId) => ({
        task_id: taskId,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('task_assignments')
        .insert(assignments);

      if (error) throw error;

      toast({
        title: 'Workers assigned',
        description: `${selectedUserIds.length} worker(s) assigned to this task`,
      });

      onAssignmentChanged();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error assigning workers',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.charAt(0).toUpperCase();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'project_manager':
        return 'default';
      case 'foreman':
        return 'secondary';
      case 'internal_worker':
        return 'outline';
      case 'external_trade':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatRole = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Workers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search and filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {assignedTradeId && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-trade"
                  checked={filterByTrade}
                  onCheckedChange={(checked) => setFilterByTrade(checked === true)}
                />
                <label htmlFor="filter-trade" className="text-sm cursor-pointer">
                  Only show workers from assigned trade
                </label>
              </div>
            )}
          </div>

          {/* Member list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {members.length === 0
                  ? 'All team members are already assigned'
                  : 'No members match your search'}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedUserIds.includes(member.user_id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => toggleSelection(member.user_id)}
                >
                  <Checkbox
                    checked={selectedUserIds.includes(member.user_id)}
                    onCheckedChange={() => toggleSelection(member.user_id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {getInitials(member.profile?.full_name, member.profile?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.profile?.full_name || member.profile?.email}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                        {formatRole(member.role)}
                      </Badge>
                      {member.trade && (
                        <span className="text-xs text-muted-foreground">
                          {member.trade.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedUserIds.length === 0 || saving}
          >
            {saving ? 'Assigning...' : `Assign ${selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
