import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeficiencyFiltersProps {
  trades: Array<{ id: string; company_name: string }>;
  selectedTrade: string;
  selectedStatus: string;
  onTradeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "fixed", label: "Fixed" },
  { value: "verified", label: "Verified" },
];

export const DeficiencyFilters = ({
  trades,
  selectedTrade,
  selectedStatus,
  onTradeChange,
  onStatusChange,
}: DeficiencyFiltersProps) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Trade</Label>
        <Select value={selectedTrade} onValueChange={onTradeChange}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="All trades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {trades.map((trade) => (
              <SelectItem key={trade.id} value={trade.id}>
                {trade.company_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Status</Label>
        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
