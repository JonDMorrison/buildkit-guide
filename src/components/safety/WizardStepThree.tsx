import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendeeSelector, type Attendee, type SelectedAttendee } from "./AttendeeSelector";
import { SignatureCapture } from "./SignatureCapture";
import { Check, Users, PenLine, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepThreeProps {
  attendees: Attendee[];
  selectedAttendees: SelectedAttendee[];
  onAttendeesChange: (attendees: SelectedAttendee[]) => void;
  presentTodayIds: string[];
  foremanSignature: string | null;
  onForemanSignatureChange: (signature: string | null) => void;
  workerRepSignature: string | null;
  onWorkerRepSignatureChange: (signature: string | null) => void;
  loading?: boolean;
}

export const WizardStepThree = ({
  attendees,
  selectedAttendees,
  onAttendeesChange,
  presentTodayIds,
  foremanSignature,
  onForemanSignatureChange,
  workerRepSignature,
  onWorkerRepSignatureChange,
  loading = false,
}: WizardStepThreeProps) => {
  const [showSignatures, setShowSignatures] = useState(false);

  // Find foreman from selected attendees
  const foremanAttendee = useMemo(() => {
    const foremanSelection = selectedAttendees.find((a) => a.is_foreman);
    if (!foremanSelection) return null;
    return attendees.find((a) => a.user_id === foremanSelection.user_id);
  }, [selectedAttendees, attendees]);

  // Validation
  const hasForeman = selectedAttendees.some((a) => a.is_foreman);
  const hasAttendees = selectedAttendees.length > 0;
  const canProceedToSignatures = hasForeman && hasAttendees;

  if (loading) {
    return <StepThreeSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Attendees Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Attendees</h3>
        </div>

        <AttendeeSelector
          attendees={attendees}
          selectedAttendees={selectedAttendees}
          onSelectionChange={onAttendeesChange}
          presentTodayIds={presentTodayIds}
        />

        {/* Validation messages */}
        {!hasAttendees && (
          <div className="flex items-center gap-2 mt-3 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Select at least one attendee</span>
          </div>
        )}
        {hasAttendees && !hasForeman && (
          <div className="flex items-center gap-2 mt-3 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Assign a foreman to proceed with signatures</span>
          </div>
        )}
      </div>

      {/* Proceed to Signatures Button */}
      {!showSignatures && (
        <Button
          type="button"
          onClick={() => setShowSignatures(true)}
          disabled={!canProceedToSignatures}
          className="w-full h-14 text-base gap-2"
        >
          <PenLine className="h-5 w-5" />
          Continue to Signatures
        </Button>
      )}

      {/* Signatures Section */}
      {showSignatures && (
        <div className="space-y-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-4">
            <PenLine className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Signatures</h3>
          </div>

          {/* Foreman Signature (Required) */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-base font-medium flex items-center gap-2">
                  Foreman Signature
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                </Label>
                {foremanAttendee && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {foremanAttendee.full_name || foremanAttendee.email}
                  </p>
                )}
              </div>
              {foremanSignature && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
                  <Check className="h-3 w-3" />
                  Signed
                </Badge>
              )}
            </div>
            <SignatureCapture
              label=""
              signature={foremanSignature}
              onSignatureChange={onForemanSignatureChange}
            />
          </Card>

          {/* Worker Rep Signature (Optional) */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-base font-medium flex items-center gap-2">
                  Worker Representative
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Safety committee or worker representative
                </p>
              </div>
              {workerRepSignature && (
                <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
                  <Check className="h-3 w-3" />
                  Signed
                </Badge>
              )}
            </div>
            <SignatureCapture
              label=""
              signature={workerRepSignature}
              onSignatureChange={onWorkerRepSignatureChange}
            />
          </Card>

          {/* Summary */}
          <Card className="p-4 bg-muted/50">
            <h4 className="font-medium mb-3">Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attendees</span>
                <span>{selectedAttendees.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Foreman</span>
                <span>{foremanAttendee?.full_name || "Assigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Foreman Signature</span>
                <span className={foremanSignature ? "text-green-600" : "text-amber-600"}>
                  {foremanSignature ? "Complete" : "Pending"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Worker Rep</span>
                <span>{workerRepSignature ? "Signed" : "Not provided"}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const StepThreeSkeleton = () => (
  <div className="space-y-6">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-12 w-full" />
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  </div>
);
