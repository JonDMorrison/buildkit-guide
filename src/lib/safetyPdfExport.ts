import jsPDF from "jspdf";
import { format, formatDistanceStrict } from "date-fns";

interface FormEntry {
  id: string;
  field_name: string;
  field_value: string | null;
  notes: string | null;
}

interface Attendee {
  id: string;
  user_id: string;
  is_foreman: boolean;
  signed_at: string | null;
  signature_url: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface SafetyFormData {
  id: string;
  title: string;
  form_type: string;
  status: string;
  inspection_date: string;
  created_at: string;
  record_hash?: string | null;
  reviewed_at?: string | null;
  project?: {
    name: string;
    location: string;
    job_number?: string | null;
  };
  creator?: {
    full_name: string | null;
    email: string;
  };
  reviewer?: {
    full_name: string | null;
    email: string;
  };
}

interface Acknowledgment {
  id: string;
  user_id: string;
  acknowledged_at: string;
  signature_url: string | null;
  attestation_text?: string | null;
  initiated_by_user_id?: string | null;
  initiation_method?: string | null;
  profiles?: {
    full_name: string | null;
    email: string;
  };
  initiator?: {
    full_name: string | null;
    email: string;
  };
}

interface ExportData {
  form: SafetyFormData;
  entries: FormEntry[];
  attendees: Attendee[];
  acknowledgments?: Acknowledgment[];
}

const FORM_TYPE_LABELS: Record<string, string> = {
  daily_safety_log: "Daily Safety Log",
  toolbox_meeting: "Toolbox Meeting",
  hazard_id: "Hazard Identification",
  incident_report: "Incident Report",
  near_miss: "Near Miss Report",
  right_to_refuse: "Right to Refuse",
  visitor_log: "Visitor Log",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed & Approved",
};

// Group entries by category for better organization
const categorizeEntries = (entries: FormEntry[]) => {
  const categories: Record<string, FormEntry[]> = {
    general: [],
    hazards: [],
    ppe: [],
    signatures: [],
    other: [],
  };

  entries.forEach((entry) => {
    const fieldLower = entry.field_name.toLowerCase();
    if (fieldLower.includes("signature") || entry.field_value?.startsWith("data:image")) {
      categories.signatures.push(entry);
    } else if (fieldLower.includes("hazard") || fieldLower.includes("control")) {
      categories.hazards.push(entry);
    } else if (fieldLower.includes("ppe")) {
      categories.ppe.push(entry);
    } else if (
      fieldLower.includes("weather") ||
      fieldLower.includes("crew") ||
      fieldLower.includes("trade") ||
      fieldLower.includes("project")
    ) {
      categories.general.push(entry);
    } else {
      categories.other.push(entry);
    }
  });

  return categories;
};

export const generateSafetyFormPDF = async (data: ExportData): Promise<Blob> => {
  const { form, entries, attendees, acknowledgments } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(FORM_TYPE_LABELS[form.form_type] || form.form_type, margin, yPos);
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(form.title, margin, yPos);
  yPos += 10;

  // Status badge simulation
  doc.setFontSize(10);
  const statusText = STATUS_LABELS[form.status] || form.status;
  doc.setFillColor(form.status === "reviewed" ? 34 : form.status === "submitted" ? 59 : 156, 
                   form.status === "reviewed" ? 197 : form.status === "submitted" ? 130 : 163, 
                   form.status === "reviewed" ? 94 : form.status === "submitted" ? 246 : 175);
  const statusWidth = doc.getTextWidth(statusText) + 8;
  doc.roundedRect(margin, yPos - 4, statusWidth, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusText, margin + 4, yPos + 1);
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // ===== FORM INFO =====
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Form Information", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const infoItems = [
    { label: "Date", value: format(new Date(form.inspection_date), "MMMM d, yyyy") },
    { label: "Project", value: form.project?.job_number 
      ? `${form.project.job_number} - ${form.project.name}` 
      : form.project?.name || "N/A" },
    { label: "Location", value: form.project?.location || "N/A" },
    { label: "Created By", value: form.creator?.full_name || form.creator?.email || "N/A" },
    { label: "Created At", value: format(new Date(form.created_at), "MMM d, yyyy h:mm a") },
    ...(form.reviewed_at && form.reviewer ? [{
      label: "Reviewed By",
      value: `${form.reviewer.full_name || form.reviewer.email} on ${format(new Date(form.reviewed_at), "MMM d, yyyy h:mm a")}`
    }] : []),
  ];

  infoItems.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${item.label}:`, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(item.value, margin + 35, yPos);
    yPos += 5;
  });

  yPos += 8;

  // ===== CATEGORIZED ENTRIES =====
  const categorized = categorizeEntries(entries);

  // General Information
  if (categorized.general.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Site Conditions", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    categorized.general.forEach((entry) => {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.text(`${entry.field_name}:`, margin, yPos);
      doc.setFont("helvetica", "normal");
      
      const value = entry.field_value || "Not specified";
      const lines = doc.splitTextToSize(value, contentWidth - 40);
      doc.text(lines, margin + 40, yPos);
      yPos += Math.max(lines.length * 4, 5);
      
      if (entry.notes) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        const noteLines = doc.splitTextToSize(`Note: ${entry.notes}`, contentWidth);
        doc.text(noteLines, margin, yPos);
        yPos += noteLines.length * 4;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
      }
      yPos += 2;
    });
    yPos += 6;
  }

  // Hazards & Controls
  const noHazardsEntry = entries.find(e => e.field_name === "no_hazards_confirmed");
  const noHazardsConfirmed = noHazardsEntry?.field_value === "true";

  if (categorized.hazards.length > 0 || noHazardsConfirmed) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Hazards & Controls", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Show explicit no-hazards confirmation if applicable
    if (noHazardsConfirmed && categorized.hazards.length === 0) {
      doc.setDrawColor(34, 197, 94); // green
      doc.setFillColor(240, 253, 244); // light green
      doc.roundedRect(margin, yPos - 2, contentWidth, 14, 2, 2, "FD");
      doc.setTextColor(22, 101, 52); // dark green
      doc.setFont("helvetica", "bold");
      doc.text("✓ No Hazards Identified Today", margin + 4, yPos + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      yPos += 12;
      doc.setTextColor(75, 85, 99); // gray
      const attestation = "Confirmed: Work areas and activities reviewed. No significant hazards requiring documentation were identified.";
      const attestLines = doc.splitTextToSize(attestation, contentWidth);
      doc.text(attestLines, margin, yPos);
      yPos += attestLines.length * 4 + 4;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
    }

    categorized.hazards.forEach((entry) => {
      checkPageBreak(20);
      const value = entry.field_value || "Not specified";
      const lines = doc.splitTextToSize(`• ${entry.field_name}: ${value}`, contentWidth);
      doc.text(lines, margin, yPos);
      yPos += lines.length * 5 + 2;
    });
    yPos += 6;
  }

  // PPE Requirements
  if (categorized.ppe.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PPE Requirements", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    categorized.ppe.forEach((entry) => {
      checkPageBreak(10);
      // Check for ppe_compliance entry with confirmation
      if (entry.field_name === "ppe_compliance") {
        try {
          const ppeData = JSON.parse(entry.field_value || "{}");
          const confirmed = ppeData.ppe_verified_confirmed === true;
          
          if (confirmed) {
            doc.setDrawColor(34, 197, 94); // green
            doc.setFillColor(240, 253, 244); // light green
            doc.roundedRect(margin, yPos - 2, contentWidth, 10, 2, 2, "FD");
            doc.setTextColor(22, 101, 52); // dark green
            doc.setFont("helvetica", "bold");
            doc.text("✓ PPE Verification Confirmed", margin + 4, yPos + 4);
            doc.setFont("helvetica", "normal");
            yPos += 12;
            doc.setTextColor(75, 85, 99); // gray
            doc.setFontSize(9);
            doc.text("All workers verified to be wearing required PPE.", margin, yPos);
            yPos += 6;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
          }
          
          // List checked items
          if (ppeData.checked_items && ppeData.checked_items.length > 0) {
            doc.text("Verified PPE Items:", margin, yPos);
            yPos += 5;
            ppeData.checked_items.forEach((item: { item: string; is_mandatory: boolean }) => {
              doc.text(`• ${item.item}${item.is_mandatory ? " (Required)" : ""}`, margin + 4, yPos);
              yPos += 4;
            });
            yPos += 2;
          }
          
          // List missing mandatory
          if (ppeData.missing_mandatory && ppeData.missing_mandatory.length > 0) {
            doc.setTextColor(220, 38, 38); // red
            doc.text("Missing Mandatory PPE:", margin, yPos);
            yPos += 5;
            ppeData.missing_mandatory.forEach((item: string) => {
              doc.text(`• ${item}`, margin + 4, yPos);
              yPos += 4;
            });
            doc.setTextColor(0, 0, 0);
            yPos += 2;
          }
        } catch {
          const value = entry.field_value || "Not specified";
          doc.text(`• ${entry.field_name}: ${value}`, margin, yPos);
          yPos += 5;
        }
      } else {
        const value = entry.field_value || "Not specified";
        doc.text(`• ${entry.field_name}: ${value}`, margin, yPos);
        yPos += 5;
      }
    });
    yPos += 6;
  }

  // Other entries
  if (categorized.other.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Additional Information", margin, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    categorized.other.forEach((entry) => {
      checkPageBreak(15);
      doc.setFont("helvetica", "bold");
      doc.text(`${entry.field_name}:`, margin, yPos);
      doc.setFont("helvetica", "normal");
      
      const value = entry.field_value || "Not specified";
      const lines = doc.splitTextToSize(value, contentWidth);
      yPos += 5;
      doc.text(lines, margin, yPos);
      yPos += lines.length * 4 + 4;
    });
    yPos += 6;
  }

  // ===== RIGHT TO REFUSE RESOLUTION TIMELINE =====
  if (form.form_type === "right_to_refuse") {
    const submittedAtEntry = entries.find(e => e.field_name === "submitted_at");
    const resolvedAtEntry = entries.find(e => e.field_name === "resolved_at");
    const resolutionStatusEntry = entries.find(e => e.field_name === "resolution_status");

    if (submittedAtEntry?.field_value || resolvedAtEntry?.field_value) {
      checkPageBreak(50);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resolution Timeline", margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const submittedAt = submittedAtEntry?.field_value;
      const resolvedAt = resolvedAtEntry?.field_value;
      const resolutionStatus = resolutionStatusEntry?.field_value || "pending_investigation";

      const RESOLUTION_LABELS: Record<string, string> = {
        pending_investigation: "Pending Investigation",
        under_review: "Under Review",
        resolved_safe: "Resolved - Work Deemed Safe",
        resolved_modified: "Resolved - Work Modified",
        resolved_refused: "Resolved - Refusal Upheld",
        escalated: "Escalated to Safety Committee/Ministry",
      };

      // Submitted timestamp
      if (submittedAt) {
        doc.setFont("helvetica", "bold");
        doc.text("Submitted:", margin, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(format(new Date(submittedAt), "MMM d, yyyy 'at' h:mm a"), margin + 30, yPos);
        yPos += 5;
      }

      // Resolution status
      doc.setFont("helvetica", "bold");
      doc.text("Status:", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(RESOLUTION_LABELS[resolutionStatus] || resolutionStatus, margin + 30, yPos);
      yPos += 5;

      // Resolved timestamp (if resolved)
      if (resolvedAt) {
        doc.setFont("helvetica", "bold");
        doc.text("Resolved:", margin, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(format(new Date(resolvedAt), "MMM d, yyyy 'at' h:mm a"), margin + 30, yPos);
        yPos += 5;

        // Duration
        if (submittedAt) {
          const duration = formatDistanceStrict(new Date(submittedAt), new Date(resolvedAt));
          doc.setFont("helvetica", "bold");
          doc.text("Duration:", margin, yPos);
          doc.setFont("helvetica", "normal");
          doc.text(duration, margin + 30, yPos);
          yPos += 5;
        }
      }

      yPos += 6;
    }
  }

  // ===== ATTENDEES =====
  if (attendees.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Attendees & Sign-Off", margin, yPos);
    yPos += 8;

    // Table header
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos - 4, contentWidth, 8, "F");
    doc.setFontSize(9);
    doc.text("Name", margin + 2, yPos);
    doc.text("Role", margin + 70, yPos);
    doc.text("Signed", margin + 110, yPos);
    doc.text("Time", margin + 140, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    attendees.forEach((attendee) => {
      checkPageBreak(10);
      const name = attendee.profiles?.full_name || attendee.profiles?.email || "Unknown";
      const role = attendee.is_foreman ? "Foreman" : "Worker";
      const signed = attendee.signed_at ? "✓" : "—";
      const signedTime = attendee.signed_at 
        ? format(new Date(attendee.signed_at), "h:mm a") 
        : "—";

      doc.text(name.substring(0, 25), margin + 2, yPos);
      doc.text(role, margin + 70, yPos);
      doc.text(signed, margin + 115, yPos);
      doc.text(signedTime, margin + 140, yPos);
      yPos += 5;
    });
    yPos += 6;
  }

  // ===== WORKER ACKNOWLEDGMENTS =====
  if (acknowledgments && acknowledgments.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Worker Acknowledgments", margin, yPos);
    yPos += 8;

    // Table header
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos - 4, contentWidth, 8, "F");
    doc.setFontSize(9);
    doc.text("Worker", margin + 2, yPos);
    doc.text("Acknowledged At", margin + 60, yPos);
    doc.text("Method", margin + 105, yPos);
    doc.text("Signature", margin + 140, yPos);
    yPos += 6;

    doc.setFont("helvetica", "normal");
    acknowledgments.forEach((ack) => {
      checkPageBreak(10);
      const name = ack.profiles?.full_name || ack.profiles?.email || "Unknown";
      const ackTime = format(new Date(ack.acknowledged_at), "h:mm a");
      const hasSig = ack.signature_url ? "✓" : "—";
      const method = ack.initiation_method === "foreman_proxy" ? "Proxy" : "Self";

      doc.text(name.substring(0, 22), margin + 2, yPos);
      doc.text(ackTime, margin + 60, yPos);
      doc.setFontSize(8);
      if (ack.initiation_method === "foreman_proxy") {
        doc.setTextColor(150, 100, 0); // amber
      }
      doc.text(method, margin + 105, yPos);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text(hasSig, margin + 140, yPos);
      yPos += 5;
    });
    yPos += 6;
  }

  // ===== SIGNATURES (visual) =====
  const signatureEntries = categorized.signatures.filter(
    (e) => e.field_value?.startsWith("data:image")
  );
  
  if (signatureEntries.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Signatures", margin, yPos);
    yPos += 8;

    for (const sig of signatureEntries) {
      checkPageBreak(50);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(sig.field_name, margin, yPos);
      yPos += 4;

      try {
        // Add signature image
        doc.addImage(sig.field_value!, "PNG", margin, yPos, 60, 25);
        yPos += 30;
      } catch (e) {
        doc.text("[Signature on file]", margin, yPos);
        yPos += 8;
      }
      
      // Signature line
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, yPos, margin + 60, yPos);
      yPos += 10;
    }
  }

  // ===== AI DISCLAIMER (only if AI was used) =====
  const aiUsedEntry = entries.find(e => e.field_name === "ai_used");
  const aiUsed = aiUsedEntry?.field_value === "true";
  
  if (aiUsed) {
    checkPageBreak(30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("AI Disclosure", margin, yPos);
    yPos += 5;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, yPos - 2, contentWidth, 16, 2, 2, "FD");
    
    const disclaimer = "Some hazards were AI-suggested. The submitting supervisor confirms hazards and controls were reviewed for site applicability.";
    const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth - 8);
    doc.text(disclaimerLines, margin + 4, yPos + 4);
    yPos += 20;
    doc.setTextColor(0, 0, 0);
  }

  // ===== DATA ASSURANCE NOTICE =====
  checkPageBreak(30);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, "FD");
  
  const assuranceText = "This record is protected by tamper-evident technology. The digital fingerprint (hash) verifies the record has not been altered. All changes are tracked through the formal amendment process.";
  const assuranceLines = doc.splitTextToSize(assuranceText, contentWidth - 8);
  doc.text(assuranceLines, margin + 4, yPos + 4);
  yPos += 18;
  doc.setTextColor(0, 0, 0);

  // ===== FOOTER WITH RECORD HASH =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated on ${format(new Date(), "MMM d, yyyy h:mm a")} | Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
    
    // Show record hash for integrity verification
    const hashInfo = form.record_hash 
      ? `Hash: ${form.record_hash.substring(0, 12)}...` 
      : `ID: ${form.id.substring(0, 8)}`;
    doc.text(
      hashInfo,
      pageWidth - margin - 50,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  return doc.output("blob");
};

export const downloadSafetyFormPDF = async (data: ExportData, filename?: string): Promise<void> => {
  const blob = await generateSafetyFormPDF(data);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `safety-form-${data.form.id.substring(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const shareSafetyFormPDF = async (data: ExportData): Promise<void> => {
  const blob = await generateSafetyFormPDF(data);
  const file = new File([blob], `safety-form-${data.form.id.substring(0, 8)}.pdf`, {
    type: "application/pdf",
  });

  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: data.form.title,
      text: `Safety Form: ${data.form.title}`,
      files: [file],
    });
  } else {
    // Fallback to download
    await downloadSafetyFormPDF(data);
  }
};
