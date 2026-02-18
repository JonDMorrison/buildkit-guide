import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { UnratedLaborDetail } from "@/hooks/useUnratedLaborSummary";

const reasonLabels: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
  missing_rate: { label: "Missing rate", variant: "destructive" },
  invalid_rate: { label: "Invalid rate", variant: "destructive" },
  currency_mismatch: { label: "Currency mismatch", variant: "secondary" },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: UnratedLaborDetail[];
}

export function UnratedLaborDetailsDrawer({ open, onOpenChange, details }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Unrated Labor Details</SheetTitle>
          <SheetDescription>
            Time entries that cannot be costed due to missing or misconfigured labor rates.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 overflow-auto max-h-[calc(100vh-10rem)]">
          {details.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No unrated entries found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((d, i) => {
                  const reason = reasonLabels[d.reason] || { label: d.reason, variant: "outline" as const };
                  return (
                    <TableRow key={`${d.user_id}-${d.reason}-${i}`}>
                      <TableCell className="font-medium text-sm">{d.user_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.hours}h</TableCell>
                      <TableCell className="text-right tabular-nums">{d.entries_count}</TableCell>
                      <TableCell>
                        <Badge variant={reason.variant} className="text-xs">
                          {reason.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
