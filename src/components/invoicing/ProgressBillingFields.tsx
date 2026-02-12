import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface Props {
  contractTotal: number;
  progressPercent: number;
  retainagePercent: number;
  onContractTotalChange: (v: number) => void;
  onProgressPercentChange: (v: number) => void;
  onRetainagePercentChange: (v: number) => void;
  currencySymbol?: string;
}

export const ProgressBillingFields = ({
  contractTotal, progressPercent, retainagePercent,
  onContractTotalChange, onProgressPercentChange, onRetainagePercentChange,
  currencySymbol = "$",
}: Props) => {
  const billedAmount = contractTotal * (progressPercent / 100);
  const retainageAmount = billedAmount * (retainagePercent / 100);
  const netBillable = billedAmount - retainageAmount;

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
      <Label className="text-sm font-semibold">Progress Billing</Label>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Contract Total</Label>
          <Input
            type="number" step="0.01" min="0"
            value={contractTotal || ""}
            onChange={(e) => onContractTotalChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">% Complete</Label>
          <Input
            type="number" step="1" min="0" max="100"
            value={progressPercent || ""}
            onChange={(e) => onProgressPercentChange(Math.min(100, parseFloat(e.target.value) || 0))}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Holdback %</Label>
          <Input
            type="number" step="0.5" min="0" max="100"
            value={retainagePercent || ""}
            onChange={(e) => onRetainagePercentChange(parseFloat(e.target.value) || 0)}
            placeholder="10"
          />
        </div>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Billed: </span>
          <span className="font-medium">{currencySymbol}{billedAmount.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Holdback: </span>
          <span className="font-medium">{currencySymbol}{retainageAmount.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Net: </span>
          <span className="font-bold">{currencySymbol}{netBillable.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
