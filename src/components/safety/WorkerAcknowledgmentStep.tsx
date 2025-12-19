import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignatureCapture } from "./SignatureCapture";
import { Check, UserCheck, AlertCircle, PenLine, CheckCircle2 } from "lucide-react";
import type { Attendee, SelectedAttendee } from "./AttendeeSelector";
import { cn } from "@/lib/utils";

interface WorkerAcknowledgment {
  user_id: string;
  acknowledged: boolean;
  signature_url?: string | null;
}

interface WorkerAcknowledgmentStepProps {
  attendees: Attendee[];
  selectedAttendees: SelectedAttendee[];
  acknowledgments: WorkerAcknowledgment[];
  onAcknowledgmentsChange: (acks: WorkerAcknowledgment[]) => void;
  attestationText?: string;
}

const DEFAULT_ATTESTATION = 
  "I acknowledge that I have been informed of the hazards, controls, and required PPE for today's work.";

export const WorkerAcknowledgmentStep = ({
  attendees,
  selectedAttendees,
  acknowledgments,
  onAcknowledgmentsChange,
  attestationText = DEFAULT_ATTESTATION,
}: WorkerAcknowledgmentStepProps) => {
  const [collectingSignatureFor, setCollectingSignatureFor] = useState<string | null>(null);

  // Get attendee details for selected attendees
  const selectedWithDetails = useMemo(() => {
    return selectedAttendees
      .map((sel) => {
        const attendee = attendees.find((a) => a.user_id === sel.user_id);
        const ack = acknowledgments.find((a) => a.user_id === sel.user_id);
        return {
          ...sel,
          ...attendee,
          acknowledged: ack?.acknowledged || false,
          signature_url: ack?.signature_url,
        };
      })
      .filter((a) => !a.is_foreman); // Exclude foreman (they sign separately)
  }, [selectedAttendees, attendees, acknowledgments]);

  const acknowledgedCount = acknowledgments.filter((a) => a.acknowledged).length;
  const totalWorkers = selectedWithDetails.length;
  const allAcknowledged = acknowledgedCount >= totalWorkers;

  const handleQuickAcknowledge = (userId: string) => {
    const existing = acknowledgments.find((a) => a.user_id === userId);
    if (existing) {
      // Toggle off
      onAcknowledgmentsChange(acknowledgments.filter((a) => a.user_id !== userId));
    } else {
      // Toggle on (tap-to-acknowledge without signature)
      onAcknowledgmentsChange([
        ...acknowledgments,
        { user_id: userId, acknowledged: true, signature_url: null },
      ]);
    }
  };

  const handleSignatureComplete = (signature: string | null) => {
    if (!collectingSignatureFor || !signature) {
      setCollectingSignatureFor(null);
      return;
    }

    const updated = acknowledgments.filter((a) => a.user_id !== collectingSignatureFor);
    onAcknowledgmentsChange([
      ...updated,
      { user_id: collectingSignatureFor, acknowledged: true, signature_url: signature },
    ]);
    setCollectingSignatureFor(null);
  };

  const handleAcknowledgeAll = () => {
    const allAcks = selectedWithDetails.map((a) => ({
      user_id: a.user_id,
      acknowledged: true,
      signature_url: null,
    }));
    onAcknowledgmentsChange(allAcks);
  };

  if (selectedWithDetails.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No workers to acknowledge</p>
        <p className="text-sm">Select attendees in the previous step</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Attestation Statement */}
      <Card className="p-4 bg-muted/50 border-primary/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h4 className="font-medium text-sm mb-1">Worker Attestation</h4>
            <p className="text-sm text-muted-foreground">{attestationText}</p>
          </div>
        </div>
      </Card>

      {/* Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Acknowledgments</span>
          <Badge 
            variant={allAcknowledged ? "default" : "outline"}
            className={cn(allAcknowledged && "bg-green-600")}
          >
            {acknowledgedCount}/{totalWorkers}
          </Badge>
        </div>
        {!allAcknowledged && (
          <Button size="sm" variant="outline" onClick={handleAcknowledgeAll}>
            <Check className="h-4 w-4 mr-1" />
            Acknowledge All
          </Button>
        )}
      </div>

      {/* Worker List */}
      <div className="space-y-2">
        {selectedWithDetails.map((worker) => (
          <Card
            key={worker.user_id}
            className={cn(
              "p-3 transition-colors",
              worker.acknowledged && "bg-green-500/5 border-green-500/20"
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuickAcknowledge(worker.user_id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={worker.avatar_url || undefined} />
                    <AvatarFallback className="text-sm">
                      {(worker.full_name || worker.email)?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {worker.acknowledged && (
                    <div className="absolute -bottom-1 -right-1 bg-green-600 rounded-full p-0.5">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {worker.full_name || worker.email || "Unknown"}
                  </div>
                  {worker.trade_name && (
                    <div className="text-xs text-muted-foreground">{worker.trade_name}</div>
                  )}
                </div>

                {worker.acknowledged ? (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3" />
                    {worker.signature_url ? "Signed" : "Acknowledged"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Tap to acknowledge
                  </Badge>
                )}
              </button>

              {/* Optional signature button */}
              {worker.acknowledged && !worker.signature_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCollectingSignatureFor(worker.user_id)}
                  className="h-8 px-2"
                >
                  <PenLine className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Signature Collection Modal-like section */}
      {collectingSignatureFor && (
        <Card className="p-4 border-primary/30">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">
                Signature for{" "}
                {selectedWithDetails.find((w) => w.user_id === collectingSignatureFor)?.full_name || "Worker"}
              </Label>
              <Button size="sm" variant="ghost" onClick={() => setCollectingSignatureFor(null)}>
                Cancel
              </Button>
            </div>
            <SignatureCapture
              label=""
              signature={null}
              onSignatureChange={handleSignatureComplete}
            />
          </div>
        </Card>
      )}

      {/* Summary */}
      {allAcknowledged && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-600">
            All workers have acknowledged the safety briefing
          </span>
        </div>
      )}
    </div>
  );
};
