import { useState } from 'react';
import { TaskDetailData } from './index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TradeBadge } from '@/components/TradeBadge';
import { AlertTriangle, Mail, Plus } from 'lucide-react';
import { EscalationEmailModal } from '@/components/ai-assist/EscalationEmailModal';

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
  const [escalationModalOpen, setEscalationModalOpen] = useState(false);
  const [selectedBlockerId, setSelectedBlockerId] = useState<string | null>(null);

  if (blockers.length === 0 && !canEdit) return null;

  const handleEscalate = (blockerId: string) => {
    setSelectedBlockerId(blockerId);
    setEscalationModalOpen(true);
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
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Blocker
          </Button>
        )}
      </div>

      {blockers.length === 0 ? (
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
