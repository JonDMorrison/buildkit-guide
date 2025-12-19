import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSafetyLogAutoFill, type HazardSuggestion } from "@/hooks/useSafetyLogAutoFill";
import { WizardStepOne } from "./WizardStepOne";
import { WizardStepTwo } from "./WizardStepTwo";
import { WizardStepThree } from "./WizardStepThree";
import type { SelectedAttendee, Attendee } from "./AttendeeSelector";
import { ChevronLeft, ChevronRight, Loader2, Check, AlertTriangle } from "lucide-react";
import { computePPECompliance } from "./PPEChecklistSection";
import { format } from "date-fns";

interface HazardWithControls extends HazardSuggestion {
  controls: string[];
}

interface DailySafetyWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProjectId?: string;
}

export const DailySafetyWizard = ({
  isOpen,
  onClose,
  onSuccess,
  initialProjectId,
}: DailySafetyWizardProps) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState(initialProjectId || "");
  const { toast } = useToast();

  // Step 1 state
  const [weather, setWeather] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);

  // Step 2 state
  const [selectedHazards, setSelectedHazards] = useState<HazardWithControls[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [ppeCheckedItems, setPPECheckedItems] = useState<Record<string, boolean>>({});

  // Step 3 state
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);
  const [presentTodayIds, setPresentTodayIds] = useState<string[]>([]);
  const [foremanSignature, setForemanSignature] = useState<string | null>(null);
  const [workerRepSignature, setWorkerRepSignature] = useState<string | null>(null);
  const [workerAcknowledgments, setWorkerAcknowledgments] = useState<Array<{ user_id: string; acknowledged: boolean; signature_url?: string | null }>>([]);

  const {
    weather: autoWeather,
    crewCount: autoCrewCount,
    hazardSuggestions,
    ppeRequirements,
    tradesOnSite,
    loading: autoFillLoading,
    hazardsLoading,
    fetchAll,
    fetchHazardSuggestions,
  } = useSafetyLogAutoFill(projectId || null);

  // Fetch projects on mount
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setStep(1);
    }
  }, [isOpen]);

  // Auto-fill when project changes
  useEffect(() => {
    if (projectId && isOpen) {
      fetchAll();
      fetchAttendees();
    }
  }, [projectId, isOpen]);

  // Apply auto-fill values
  useEffect(() => {
    if (autoWeather?.description && !weather) {
      setWeather(autoWeather.description);
    }
  }, [autoWeather]);

  useEffect(() => {
    if (autoCrewCount !== null && !crewCount) {
      setCrewCount(autoCrewCount.toString());
    }
  }, [autoCrewCount]);

  useEffect(() => {
    if (tradesOnSite.length > 0 && selectedTrades.length === 0) {
      setSelectedTrades(tradesOnSite);
    }
  }, [tradesOnSite]);

  // Auto-select mandatory PPE items based on trades on site
  useEffect(() => {
    if (ppeRequirements.length > 0 && Object.keys(ppeCheckedItems).length === 0 && selectedTrades.length > 0) {
      const relevantTrades = ["general", ...selectedTrades.map((t) => t.toLowerCase())];
      const mandatoryItems: Record<string, boolean> = {};
      
      ppeRequirements.forEach((ppe) => {
        const tradeMatch = relevantTrades.some((trade) => 
          ppe.trade_type.toLowerCase().includes(trade)
        );
        if (tradeMatch && ppe.is_mandatory) {
          mandatoryItems[ppe.id] = true;
        }
      });
      
      if (Object.keys(mandatoryItems).length > 0) {
        setPPECheckedItems(mandatoryItems);
      }
    }
  }, [ppeRequirements, selectedTrades]);

  const fetchProjects = async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("is_deleted", false)
      .order("name");
    setProjects(data || []);
  };

  const fetchAttendees = async () => {
    if (!projectId) return;
    const today = format(new Date(), "yyyy-MM-dd");

    // Get project members
    const { data: members } = await supabase
      .from("project_members")
      .select("id, user_id, trade_id, trades(name), profiles(full_name, avatar_url, email)")
      .eq("project_id", projectId);

    // Get today's check-ins
    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select("user_id")
      .eq("project_id", projectId)
      .gte("check_in_at", `${today}T00:00:00`)
      .lte("check_in_at", `${today}T23:59:59`);

    const presentIds = [...new Set(timeEntries?.map((e) => e.user_id) || [])];
    setPresentTodayIds(presentIds);

    const attendeeList: Attendee[] = (members || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      full_name: m.profiles?.full_name,
      email: m.profiles?.email,
      avatar_url: m.profiles?.avatar_url,
      trade_name: m.trades?.name,
      is_present_today: presentIds.includes(m.user_id),
    }));

    setAttendees(attendeeList);
  };

  const handlePPEToggle = useCallback((id: string) => {
    setPPECheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handlePPESelectAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    ppeRequirements.forEach((p) => (all[p.id] = true));
    setPPECheckedItems(all);
  }, [ppeRequirements]);

  const handlePPESelectMandatory = useCallback(() => {
    const mandatory: Record<string, boolean> = {};
    ppeRequirements.filter((p) => p.is_mandatory).forEach((p) => (mandatory[p.id] = true));
    setPPECheckedItems(mandatory);
  }, [ppeRequirements]);

  const handleRequestAI = useCallback(async () => {
    try {
      await fetchHazardSuggestions(weather);
    } catch {
      toast({ title: "AI unavailable", description: "Using common hazards instead", variant: "destructive" });
    }
  }, [fetchHazardSuggestions, weather, toast]);

  // Compute PPE compliance for warnings
  const ppeCompliance = computePPECompliance(ppeRequirements, selectedTrades, ppeCheckedItems);
  const hasPPEWarning = ppeCompliance.percentage < 100;

  const canProceed = () => {
    if (step === 1) return !!projectId;
    if (step === 2) return true; // Allow proceeding with warning
    if (step === 3) return selectedAttendees.some((a) => a.is_foreman) && foremanSignature;
    return false;
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;
    setSubmitting(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      // Create safety form
      const { data: form, error: formError } = await supabase
        .from("safety_forms")
        .insert({
          project_id: projectId,
          form_type: "daily_safety_log",
          title: "Daily Safety Log",
          status: "submitted",
          inspection_date: format(new Date(), "yyyy-MM-dd"),
          created_by: user.user.id,
          device_info: { userAgent: navigator.userAgent, platform: navigator.platform },
        })
        .select()
        .single();

      if (formError) throw formError;

      // Build PPE items list with names for better readability
      const checkedPPEItems = ppeRequirements
        .filter((ppe) => ppeCheckedItems[ppe.id])
        .map((ppe) => ({ id: ppe.id, item: ppe.ppe_item, is_mandatory: ppe.is_mandatory }));
      
      const missingMandatoryPPE = ppeRequirements
        .filter((ppe) => {
          const relevantTrades = ["general", ...selectedTrades.map((t) => t.toLowerCase())];
          const isRelevant = relevantTrades.some((trade) => ppe.trade_type.toLowerCase().includes(trade));
          return isRelevant && ppe.is_mandatory && !ppeCheckedItems[ppe.id];
        })
        .map((ppe) => ppe.ppe_item);

      // Create entries
      const entries = [
        { safety_form_id: form.id, field_name: "weather", field_value: weather },
        { safety_form_id: form.id, field_name: "crew_count", field_value: crewCount },
        { safety_form_id: form.id, field_name: "trades_on_site", field_value: selectedTrades.join(", ") },
        { safety_form_id: form.id, field_name: "hazards_identified", field_value: JSON.stringify(selectedHazards) },
        { safety_form_id: form.id, field_name: "additional_notes", field_value: additionalNotes },
        { safety_form_id: form.id, field_name: "ppe_compliance", field_value: JSON.stringify({
          checked_items: checkedPPEItems,
          missing_mandatory: missingMandatoryPPE,
          compliance_percentage: ppeCompliance.percentage,
          status: ppeCompliance.status,
        }) },
        { safety_form_id: form.id, field_name: "foreman_signature", field_value: foremanSignature },
        { safety_form_id: form.id, field_name: "worker_rep_signature", field_value: workerRepSignature || "" },
      ];

      await supabase.from("safety_entries").insert(entries);

      // Create attendees
      if (selectedAttendees.length > 0) {
        const attendeeRecords = selectedAttendees.map((a) => ({
          safety_form_id: form.id,
          user_id: a.user_id,
          is_foreman: a.is_foreman,
          signed_at: a.is_foreman && foremanSignature ? new Date().toISOString() : null,
          signature_url: a.is_foreman ? foremanSignature : null,
        }));
        await supabase.from("safety_form_attendees").insert(attendeeRecords);
      }

      // Create worker acknowledgments (BC compliance requirement)
      if (workerAcknowledgments.length > 0) {
        const ackRecords = workerAcknowledgments
          .filter((a) => a.acknowledged)
          .map((a) => ({
            safety_form_id: form.id,
            user_id: a.user_id,
            signature_url: a.signature_url || null,
            acknowledged_at: new Date().toISOString(),
          }));
        if (ackRecords.length > 0) {
          await supabase.from("safety_form_acknowledgments").insert(ackRecords);
        }
      }

      toast({ title: "Success", description: "Daily Safety Log submitted" });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="text-xl">Daily Safety Log</DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={(step / 3) * 100} className="h-2 flex-1" />
            <span className="text-sm text-muted-foreground">Step {step}/3</span>
          </div>
        </DialogHeader>

        <div className="p-6">
          {step === 1 && (
            <WizardStepOne
              projectId={projectId}
              projects={projects}
              onProjectChange={setProjectId}
              weather={weather}
              onWeatherChange={setWeather}
              crewCount={crewCount}
              onCrewCountChange={setCrewCount}
              tradesOnSite={tradesOnSite}
              selectedTrades={selectedTrades}
              onTradesChange={setSelectedTrades}
              loading={autoFillLoading}
              onRefresh={fetchAll}
            />
          )}

          {step === 2 && (
            <WizardStepTwo
              hazardSuggestions={hazardSuggestions}
              selectedHazards={selectedHazards}
              onHazardsChange={setSelectedHazards}
              additionalNotes={additionalNotes}
              onNotesChange={setAdditionalNotes}
              ppeRequirements={ppeRequirements}
              ppeCheckedItems={ppeCheckedItems}
              onPPEToggle={handlePPEToggle}
              onPPESelectAll={handlePPESelectAll}
              onPPESelectMandatory={handlePPESelectMandatory}
              tradesOnSite={selectedTrades}
              hazardsLoading={hazardsLoading}
              onRequestAISuggestions={handleRequestAI}
            />
          )}

          {step === 3 && (
            <WizardStepThree
              attendees={attendees}
              selectedAttendees={selectedAttendees}
              onAttendeesChange={setSelectedAttendees}
              presentTodayIds={presentTodayIds}
              foremanSignature={foremanSignature}
              onForemanSignatureChange={setForemanSignature}
              workerRepSignature={workerRepSignature}
              onWorkerRepSignatureChange={setWorkerRepSignature}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="p-6 pt-4 border-t sticky bottom-0 bg-background flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="h-12">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <div className="flex items-center gap-2">
              {step === 2 && hasPPEWarning && (
                <div className="flex items-center gap-1 text-amber-500 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="hidden sm:inline">PPE incomplete</span>
                </div>
              )}
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="h-12 px-6">
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || submitting} className="h-12 px-6">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
