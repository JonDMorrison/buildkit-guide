import { useState } from 'react';
import { TaskDetailData } from './index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TradeBadge } from '@/components/TradeBadge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Mail, Plus, Loader2, X } from 'lucide-react';
import { EscalationEmailModal } from '@/components/ai-assist/EscalationEmailModal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Blocker {
  id: string;
  reason: string;
  description: string | null;
  created_at: string;
  trades?: { name: string; trade_type: string } | null;
}

interface TaskBlockersProps {
  task: TaskDetailData;
  blockers: Blocker[];
  canEdit: boolean;
  onBlockersChanged: () => void;
}

export const TaskBlockers = ({
  task,
  blockers,
  canEdit,
  onBlockersChanged,
}: TaskBlockersProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [escalationModalOpen, setEscalationModalOpen] = useState(false);
  const [selectedBlockerId, setSelectedBlockerId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newBlockerReason, setNewBlockerReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (blockers.length === 0 && !canEdit) return null;

  const handleEscalate = (blockerId: string) => {
    setSelectedBlockerId(blockerId);
    setEscalationModalOpen(true);
  };

  const handleAddBlocker = async () => {
    if (!newBlockerReason.trim() || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('blockers').insert({
        task_id: task.id,
        reason: newBlockerReason.trim(),
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: 'Blocker added',
        description: 'The blocker has been logged.',
      });

      setNewBlockerReason('');
      setIsAdding(false);
      onBlockersChanged();
    } catch (err: any) {
      toast({
        title: 'Failed to add blocker',
        description: err.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddBlocker();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewBlockerReason('');
    }
  };

  const selectedBlocker = blockers.find(b => b.id === selectedBlockerId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Blockers
          {blockers.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {blockers.length}
            </Badge>
          )}
        </div>
        {canEdit && !isAdding && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Blocker
          </Button>
        )}
      </div>

      {/* Add blocker form */}
      {isAdding && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-destructive/20 bg-destructive/5">
          <Input
            value={newBlockerReason}
            onChange={(e) => setNewBlockerReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the blocker..."
            className="h-8 text-sm"
            autoFocus
            disabled={isSaving}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={handleAddBlocker}
            disabled={isSaving || !newBlockerReason.trim()}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setIsAdding(false);
              setNewBlockerReason('');
            }}
            disabled={isSaving}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {blockers.length === 0 && !isAdding ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-sm text-muted-foreground">No active blockers</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blockers.map((blocker) => (
            <div
              key={blocker.id}
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{blocker.reason}</p>
                  {blocker.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {blocker.description}
                    </p>
                  )}
                  {blocker.trades && (
                    <div className="mt-2">
                      <TradeBadge trade={blocker.trades.trade_type} />
                    </div>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEscalate(blocker.id)}
                    className="h-7 px-2 shrink-0"
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    Escalate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBlocker && (
        <EscalationEmailModal
          open={escalationModalOpen}
          onOpenChange={setEscalationModalOpen}
          projectId={task.project_id}
          blockerId={selectedBlocker.id}
          blockerReason={selectedBlocker.reason}
          taskTitle={task.title}
        />
      )}
    </div>
  );
};
