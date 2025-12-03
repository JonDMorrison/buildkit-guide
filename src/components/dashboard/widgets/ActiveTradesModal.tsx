import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TradeBadge } from "@/components/TradeBadge";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Wrench } from "lucide-react";

interface Trade {
  id: string;
  name: string;
  trade_type: string;
  taskCount: number;
}

interface ActiveTradesModalProps {
  trades: Trade[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ActiveTradesModal = ({
  trades,
  open,
  onOpenChange,
}: ActiveTradesModalProps) => {
  const navigate = useNavigate();

  const handleTradeClick = (tradeId: string) => {
    onOpenChange(false);
    navigate(`/tasks?tradeId=${tradeId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Active Trades
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} with active tasks
          </p>
        </DialogHeader>

        <div className="max-h-[280px] overflow-y-auto">
          {trades.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No active trades
            </div>
          ) : (
            <div className="space-y-1">
              {trades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => handleTradeClick(trade.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TradeBadge trade={trade.trade_type as any} />
                    <span className="text-sm font-medium truncate">
                      {trade.name}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {trade.taskCount} task{trade.taskCount !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/tasks");
            }}
          >
            View All Tasks <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
