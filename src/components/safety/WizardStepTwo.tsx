import { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { HazardCard } from "./HazardCard";
import { ControlChips, CONTROL_OPTIONS } from "./ControlChips";
import { VoiceInputButton } from "./VoiceInputButton";
import { PPEChecklistSection, computePPECompliance } from "./PPEChecklistSection";
import type { HazardSuggestion, PPERequirement } from "@/hooks/useSafetyLogAutoFill";
import { cn } from "@/lib/utils";

interface HazardWithControls extends HazardSuggestion {
  controls: string[];
}

interface WizardStepTwoProps {
  hazardSuggestions: HazardSuggestion[];
  selectedHazards: HazardWithControls[];
  onHazardsChange: (hazards: HazardWithControls[]) => void;
  additionalNotes: string;
  onNotesChange: (notes: string) => void;
  ppeRequirements: PPERequirement[];
  ppeCheckedItems: Record<string, boolean>;
  onPPEToggle: (id: string) => void;
  onPPESelectAll: () => void;
  onPPESelectMandatory: () => void;
  tradesOnSite: string[];
  hazardsLoading: boolean;
  onRequestAISuggestions: () => void;
}

// Common fallback hazards when AI is not available
const FALLBACK_HAZARDS: HazardSuggestion[] = [
  {
    id: "fall-1",
    category: "fall",
    title: "Working at Heights",
    description: "Risk of falls from ladders, scaffolds, or elevated work areas.",
    severity: "high",
    source: "general",
  },
  {
    id: "electrical-1",
    category: "electrical",
    title: "Electrical Hazards",
    description: "Exposed wiring, temporary power, or work near electrical equipment.",
    severity: "high",
    source: "general",
  },
  {
    id: "ppe-1",
    category: "ppe",
    title: "PPE Requirements",
    description: "Ensure all workers have required personal protective equipment.",
    severity: "medium",
    source: "general",
  },
  {
    id: "housekeeping-1",
    category: "tools",
    title: "Housekeeping",
    description: "Keep work areas clean and free of debris to prevent trips and falls.",
    severity: "low",
    source: "general",
  },
  {
    id: "equipment-1",
    category: "equipment",
    title: "Heavy Equipment",
    description: "Operating machinery, cranes, or powered equipment on site.",
    severity: "high",
    source: "general",
  },
];

export const WizardStepTwo = ({
  hazardSuggestions,
  selectedHazards,
  onHazardsChange,
  additionalNotes,
  onNotesChange,
  ppeRequirements,
  ppeCheckedItems,
  onPPEToggle,
  onPPESelectAll,
  onPPESelectMandatory,
  tradesOnSite,
  hazardsLoading,
  onRequestAISuggestions,
}: WizardStepTwoProps) => {
  const [showAllHazards, setShowAllHazards] = useState(false);
  const [expandedHazardId, setExpandedHazardId] = useState<string | null>(null);

  // Combine AI suggestions with fallback, prioritizing AI
  const displayHazards = useMemo(() => {
    if (hazardSuggestions.length > 0) return hazardSuggestions;
    return FALLBACK_HAZARDS;
  }, [hazardSuggestions]);

  // Show only first 4 unless expanded
  const visibleHazards = showAllHazards ? displayHazards : displayHazards.slice(0, 4);

  const toggleHazard = useCallback(
    (hazard: HazardSuggestion) => {
      const existing = selectedHazards.find((h) => h.id === hazard.id);
      if (existing) {
        onHazardsChange(selectedHazards.filter((h) => h.id !== hazard.id));
      } else {
        onHazardsChange([...selectedHazards, { ...hazard, controls: [] }]);
      }
    },
    [selectedHazards, onHazardsChange]
  );

  const updateHazardControls = useCallback(
    (hazardId: string, controlId: string) => {
      onHazardsChange(
        selectedHazards.map((h) => {
          if (h.id !== hazardId) return h;
          const hasControl = h.controls.includes(controlId);
          return {
            ...h,
            controls: hasControl
              ? h.controls.filter((c) => c !== controlId)
              : [...h.controls, controlId],
          };
        })
      );
    },
    [selectedHazards, onHazardsChange]
  );

  const selectHighSeverityHazards = useCallback(() => {
    const highSeverity = displayHazards
      .filter((h) => h.severity === "critical" || h.severity === "high")
      .map((h) => ({ ...h, controls: [] as string[] }));
    onHazardsChange(highSeverity);
  }, [displayHazards, onHazardsChange]);

  // Compute PPE compliance
  const ppeCompliance = useMemo(
    () => computePPECompliance(ppeRequirements, tradesOnSite, ppeCheckedItems),
    [ppeRequirements, tradesOnSite, ppeCheckedItems]
  );

  const handleVoiceInput = useCallback(
    (text: string) => {
      onNotesChange(additionalNotes ? `${additionalNotes}\n${text}` : text);
    },
    [additionalNotes, onNotesChange]
  );

  return (
    <div className="space-y-6">
      {/* Hazard Suggestions Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Hazards Identified
          </h3>
          <p className="text-sm text-muted-foreground">
            Select hazards present on site today
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRequestAISuggestions}
          disabled={hazardsLoading}
          className="gap-2"
        >
          {hazardsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          AI Suggest
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={selectHighSeverityHazards}
          className="flex-1 h-12"
        >
          Select High/Critical
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onHazardsChange([])}
          className="h-12"
        >
          Clear
        </Button>
      </div>

      {/* Hazard Cards */}
      {hazardsLoading ? (
        <HazardsSkeleton />
      ) : (
        <div className="space-y-3">
          {visibleHazards.map((hazard) => {
            const selected = selectedHazards.find((h) => h.id === hazard.id);
            const isExpanded = expandedHazardId === hazard.id;

            return (
              <div key={hazard.id}>
                <HazardCard
                  hazard={hazard}
                  selected={!!selected}
                  onToggle={() => toggleHazard(hazard)}
                />

                {/* Controls for selected hazard */}
                {selected && (
                  <Card className="mt-2 p-4 ml-4 border-l-4 border-l-primary">
                    <Label className="text-sm font-medium mb-3 block">
                      Controls for: {hazard.title}
                    </Label>
                    <ControlChips
                      selectedControls={selected.controls}
                      onToggle={(controlId) => updateHazardControls(hazard.id, controlId)}
                    />
                  </Card>
                )}
              </div>
            );
          })}

          {/* Show more/less button */}
          {displayHazards.length > 4 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAllHazards(!showAllHazards)}
              className="w-full gap-2"
            >
              {showAllHazards ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show {displayHazards.length - 4} More
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Additional Notes with Voice */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-base font-medium">
          Additional Notes
        </Label>
        <div className="flex gap-2">
          <Textarea
            id="notes"
            value={additionalNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Any other safety observations or notes..."
            className="min-h-[100px] flex-1"
          />
          <VoiceInputButton onTranscription={handleVoiceInput} />
        </div>
      </div>

      {/* PPE Checklist */}
      <Card className="p-4">
        <PPEChecklistSection
          ppeRequirements={ppeRequirements}
          tradesOnSite={tradesOnSite}
          checkedItems={ppeCheckedItems}
          onToggleItem={onPPEToggle}
          onSelectAll={onPPESelectAll}
          onSelectMandatory={onPPESelectMandatory}
        />
      </Card>
    </div>
  );
};

const HazardsSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="h-24 w-full" />
    ))}
  </div>
);
