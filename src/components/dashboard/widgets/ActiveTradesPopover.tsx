import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface ActiveTradesPopoverProps {
  trades: Trade[];
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ActiveTradesPopover = ({
  trades,
  children,
  open,
  onOpenChange,
}: ActiveTradesPopoverProps) => {
  const navigate = useNavigate();

  const handleTradeClick = (tradeId: string) => {
    onOpenChange(false);
    navigate(`/tasks?tradeId=${tradeId}`);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Active Trades
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trades.length} trade{trades.length !== 1 ? "s" : ""} with active tasks
          </p>
        </div>

        <div className="max-h-[280px] overflow-y-auto">
          {trades.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No active trades
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {trades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => handleTradeClick(trade.id)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/10 transition-colors text-left"
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

        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => {
              onOpenChange(false);
              navigate("/tasks");
            }}
          >
            View All Tasks <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
