import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Users,
  Fingerprint,
  FileText,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SafetyAssurancePanelProps {
  variant?: "full" | "compact" | "inline";
  className?: string;
}

const assurancePoints = [
  {
    icon: Lock,
    title: "Records Cannot Be Quietly Changed",
    description: "Once submitted, safety forms are locked. Any corrections require a formal amendment with approval. Original records are always preserved.",
    whyItMatters: "This protects everyone—workers, supervisors, and the company—by ensuring safety documentation can't be altered without a clear trail.",
  },
  {
    icon: Fingerprint,
    title: "Tamper-Evident Protection",
    description: "Each record has a unique digital fingerprint (hash). If anything changes, the fingerprint no longer matches. This fingerprint is visible on screen and in PDFs.",
    whyItMatters: "Think of it like a seal on a document. If the seal is broken, you know something changed.",
  },
  {
    icon: FileCheck,
    title: "Transparent Corrections",
    description: "All amendments show what changed, why, who approved it, and when. Nothing is overwritten or hidden.",
    whyItMatters: "Inspectors and auditors can see the full history—no surprises.",
  },
  {
    icon: Users,
    title: "Controlled Access",
    description: "Only authorized roles can view or act on safety records. Permissions are enforced at the system level, not just the UI.",
    whyItMatters: "Your data stays protected even if someone tries to bypass the interface.",
  },
  {
    icon: ShieldCheck,
    title: "Worker Acknowledgment Protection",
    description: "Worker acknowledgments and signatures are recorded individually. The system tracks who acknowledged, when, and how.",
    whyItMatters: "Workers' participation is documented clearly, protecting both them and supervisors.",
  },
  {
    icon: FileText,
    title: "Inspection Readiness",
    description: "Records can be exported instantly as inspection-ready PDFs. PDFs include timestamps, signatures, acknowledgments, and fingerprints.",
    whyItMatters: "When an inspector asks for records, you can produce them immediately with full verification.",
  },
];

/**
 * Full panel with all assurance points (for landing page)
 */
const FullPanel = ({ className }: { className?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedPoint, setExpandedPoint] = useState<number | null>(null);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("border-green-500/30 bg-green-500/5", className)}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between text-left hover:bg-green-500/5 transition-colors rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Your Safety Records Are Secure and Protected
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tap to learn how your records are protected
                </p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            {assurancePoints.map((point, index) => {
              const Icon = point.icon;
              const isExpanded = expandedPoint === index;

              return (
                <div
                  key={index}
                  className="border border-border rounded-lg overflow-hidden bg-background"
                >
                  <button
                    className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedPoint(isExpanded ? null : index)}
                  >
                    <div className="p-1.5 rounded bg-muted mt-0.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground">
                        {point.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {point.description}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 mt-1",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="ml-9 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Why this matters:{" "}
                          </span>
                          {point.whyItMatters}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Closing statement */}
            <div className="pt-3 border-t">
              <p className="text-sm text-muted-foreground text-center italic">
                This system is designed to protect workers, supervisors, and the company by creating clear, trustworthy safety records.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

/**
 * Compact panel for modal footers
 */
const CompactPanel = ({ className }: { className?: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("border-t pt-4", className)}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span>Your records are protected</span>
            <Info className="h-3 w-3" />
            {isOpen ? (
              <ChevronUp className="h-3 w-3 ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-auto" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Locked records:</strong> Submitted forms cannot be quietly changed.
            </p>
            <p>
              <strong className="text-foreground">Digital fingerprint:</strong> Each record has a unique hash for verification.
            </p>
            <p>
              <strong className="text-foreground">Full history:</strong> All changes are tracked and visible.
            </p>
            <p className="pt-2 text-xs italic">
              This system protects workers, supervisors, and the company.
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

/**
 * Inline badge for minimal contexts
 */
const InlinePanel = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <ShieldCheck className="h-3 w-3 text-green-600" />
      <span>Tamper-evident record • Protected by digital fingerprint</span>
    </div>
  );
};

/**
 * SafetyAssurancePanel - Trust-building component explaining data protection
 * 
 * Variants:
 * - full: Expandable panel with all 6 assurance points (landing page)
 * - compact: Condensed version for modal footers
 * - inline: Single line for minimal contexts
 */
export const SafetyAssurancePanel = ({
  variant = "full",
  className,
}: SafetyAssurancePanelProps) => {
  switch (variant) {
    case "compact":
      return <CompactPanel className={className} />;
    case "inline":
      return <InlinePanel className={className} />;
    default:
      return <FullPanel className={className} />;
  }
};

/**
 * Short text for PDF footer (2-3 lines)
 */
export const SAFETY_ASSURANCE_PDF_TEXT = 
  "This record is protected by tamper-evident technology. " +
  "The digital fingerprint (hash) verifies the record has not been altered. " +
  "All changes are tracked through the formal amendment process.";

export default SafetyAssurancePanel;