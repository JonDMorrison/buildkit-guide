import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TradeBadge } from "@/components/TradeBadge";
import { formatDistanceToNow } from "date-fns";

interface Blocker {
  id: string;
  reason: string;
  created_at: string;
  task?: { 
    id: string; 
    title: string; 
    assigned_trade?: { name: string } | null;
  } | null;
}

interface BlockersPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockers: Blocker[];
}

export const BlockersPreviewModal = ({ 
  open, 
  onOpenChange, 
  blockers 
}: BlockersPreviewModalProps) => {
  const navigate = useNavigate();

  const handleViewAll = () => {
    onOpenChange(false);
    navigate("/tasks?status=blocked");
  };

  const handleBlockerClick = (taskId: string) => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${taskId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-accent" />
            Active Blockers
            <Badge variant="destructive" className="ml-2">
              {blockers.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {blockers.length > 0 ? (
              blockers.map((blocker) => (
                <div
                  key={blocker.id}
                  onClick={() => blocker.task && handleBlockerClick(blocker.task.id)}
                  className="p-3 rounded-lg border border-border hover:border-accent/50 bg-card cursor-pointer transition-all group"
                >
                  {/* Blocker reason */}
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium text-foreground line-clamp-2">
                      {blocker.reason}
                    </p>
                  </div>

                  {/* Task info */}
                  {blocker.task && (
                    <div className="ml-6 space-y-1.5">
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        Task: {blocker.task.title}
                      </p>
                      <div className="flex items-center gap-2">
                        {blocker.task.assigned_trade && (
                          <TradeBadge trade={blocker.task.assigned_trade.name} />
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Blocked {formatDistanceToNow(new Date(blocker.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hover indicator */}
                  <div className="mt-2 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-primary flex items-center gap-1">
                      View task <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="h-6 w-6 text-secondary" />
                </div>
                <p className="font-medium text-foreground">No Active Blockers</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All tasks are running smoothly
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {blockers.length > 0 && (
          <div className="pt-4 border-t border-border">
            <Button onClick={handleViewAll} className="w-full">
              View All Blocked Tasks
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
