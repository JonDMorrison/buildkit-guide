import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Download, FileArchive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateSafetyFormPDF } from "@/lib/safetyPdfExport";
import JSZip from "jszip";

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string | null;
}

const FORM_TYPES = [
  { value: "all", label: "All Form Types" },
  { value: "daily_safety_log", label: "Daily Safety Log" },
  { value: "toolbox_meeting", label: "Toolbox Meeting" },
  { value: "hazard_id", label: "Hazard Identification" },
  { value: "incident_report", label: "Incident Report" },
  { value: "near_miss", label: "Near Miss Report" },
  { value: "right_to_refuse", label: "Right to Refuse" },
  { value: "visitor_log", label: "Visitor Log" },
];

const DATE_PRESETS = [
  { label: "Last 7 days", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Last 30 days", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "This month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Last month", getValue: () => {
    const lastMonth = subDays(startOfMonth(new Date()), 1);
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
  }},
];

export function BatchExportModal({ isOpen, onClose, currentProjectId }: BatchExportModalProps) {
  const { toast } = useToast();
  const { activeOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<{ id: string; name: string; job_number?: string | null }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(currentProjectId || "all");
  const [selectedFormType, setSelectedFormType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [includeIndex, setIncludeIndex] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");

  // Fetch projects for the dropdown
  useEffect(() => {
    async function fetchProjects() {
      if (!activeOrganizationId) return;
      
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, job_number")
        .eq("organization_id", activeOrganizationId)
        .eq("is_deleted", false)
        .order("name");
      
      if (!error && data) {
        setProjects(data);
      }
    }
    fetchProjects();
  }, [activeOrganizationId]);

  // Update selected project when currentProjectId changes
  useEffect(() => {
    if (currentProjectId) {
      setSelectedProject(currentProjectId);
    }
  }, [currentProjectId]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStatus("Fetching safety forms...");

    try {
      // Build query
      let query = supabase
        .from("safety_forms")
        .select(`
          *,
          project:projects(name, location, job_number),
          creator:profiles!safety_forms_created_by_fkey(full_name, email),
          reviewer:profiles!safety_forms_reviewed_by_fkey(full_name, email)
        `)
        .eq("is_deleted", false)
        .gte("inspection_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("inspection_date", format(dateRange.to, "yyyy-MM-dd"))
        .order("inspection_date", { ascending: false });

      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      if (selectedFormType !== "all") {
        query = query.eq("form_type", selectedFormType);
      }

      const { data: forms, error } = await query;

      if (error) throw error;

      if (!forms || forms.length === 0) {
        toast({
          title: "No forms found",
          description: "No safety forms match the selected criteria.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      setExportStatus(`Found ${forms.length} forms. Generating PDFs...`);

      const zip = new JSZip();
      const indexRows: string[] = [
        "Record #,Form Type,Title,Date,Project,Status,Record Hash,Filename"
      ];

      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        setExportProgress(Math.round(((i + 1) / forms.length) * 90));
        setExportStatus(`Generating PDF ${i + 1} of ${forms.length}...`);

        // Fetch entries for this form
        const { data: entries } = await supabase
          .from("safety_entries")
          .select("*")
          .eq("safety_form_id", form.id);

        // Fetch attendees
        const { data: attendees } = await supabase
          .from("safety_form_attendees")
          .select(`
            *,
            profiles:user_id(full_name, email)
          `)
          .eq("safety_form_id", form.id);

        // Fetch acknowledgments
        const { data: acknowledgments } = await supabase
          .from("safety_form_acknowledgments")
          .select(`
            *,
            profiles!safety_form_acknowledgments_user_id_fkey(full_name, email)
          `)
          .eq("safety_form_id", form.id);

        // Generate PDF
        const pdfBlob = await generateSafetyFormPDF({
          form: form as any,
          entries: entries || [],
          attendees: attendees || [],
          acknowledgments: acknowledgments || [],
        });

        // Create filename
        const safeTitle = form.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
        const dateStr = format(new Date(form.inspection_date), "yyyy-MM-dd");
        const filename = `${dateStr}_${form.form_type}_${safeTitle}.pdf`;

        // Add to ZIP
        zip.file(filename, pdfBlob);

        // Add to index
        const projectName = form.project?.job_number 
          ? `${form.project.job_number} - ${form.project.name}` 
          : form.project?.name || "N/A";
        
        indexRows.push([
          i + 1,
          form.form_type,
          `"${form.title.replace(/"/g, '""')}"`,
          dateStr,
          `"${projectName.replace(/"/g, '""')}"`,
          form.status,
          form.record_hash || "N/A",
          filename
        ].join(","));
      }

      // Add index file
      if (includeIndex) {
        setExportStatus("Creating index file...");
        const indexContent = indexRows.join("\n");
        zip.file("_INDEX.csv", indexContent);

        // Also create a more readable text index
        const textIndex = [
          "SAFETY FORMS EXPORT INDEX",
          "=" .repeat(50),
          "",
          `Export Date: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`,
          `Date Range: ${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`,
          `Total Records: ${forms.length}`,
          `Form Types: ${selectedFormType === "all" ? "All" : selectedFormType}`,
          selectedProject !== "all" ? `Project: ${projects.find(p => p.id === selectedProject)?.name || selectedProject}` : "Projects: All",
          "",
          "-".repeat(50),
          "",
          ...forms.map((form, i) => {
            const projectName = form.project?.job_number 
              ? `${form.project.job_number} - ${form.project.name}` 
              : form.project?.name || "N/A";
            return [
              `${i + 1}. ${form.title}`,
              `   Type: ${form.form_type}`,
              `   Date: ${format(new Date(form.inspection_date), "MMM d, yyyy")}`,
              `   Project: ${projectName}`,
              `   Status: ${form.status}`,
              form.record_hash ? `   Hash: ${form.record_hash}` : "",
              ""
            ].filter(Boolean).join("\n");
          })
        ].join("\n");
        
        zip.file("_INDEX.txt", textIndex);
      }

      setExportProgress(95);
      setExportStatus("Creating ZIP archive...");

      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download
      const dateRangeStr = `${format(dateRange.from, "yyyyMMdd")}-${format(dateRange.to, "yyyyMMdd")}`;
      const zipFilename = `safety_forms_export_${dateRangeStr}.zip`;
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportStatus("Export complete!");

      toast({
        title: "Export successful",
        description: `Exported ${forms.length} safety forms to ${zipFilename}`,
      });

      setTimeout(() => {
        onClose();
        setIsExporting(false);
        setExportProgress(0);
        setExportStatus("");
      }, 1000);

    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "An error occurred while exporting safety forms.",
        variant: "destructive",
      });
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isExporting && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Batch Export Safety Forms
          </DialogTitle>
          <DialogDescription>
            Export multiple safety forms as PDFs in a ZIP archive for inspector handoff.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange(preset.getValue())}
                  disabled={isExporting}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("flex-1 justify-start text-left font-normal")}
                    disabled={isExporting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="flex items-center text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("flex-1 justify-start text-left font-normal")}
                    disabled={isExporting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Project Filter */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isExporting}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.job_number ? `${project.job_number} - ` : ""}{project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Form Type Filter */}
          <div className="space-y-2">
            <Label>Form Type</Label>
            <Select value={selectedFormType} onValueChange={setSelectedFormType} disabled={isExporting}>
              <SelectTrigger>
                <SelectValue placeholder="Select form type" />
              </SelectTrigger>
              <SelectContent>
                {FORM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Include Index */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-index"
              checked={includeIndex}
              onCheckedChange={(checked) => setIncludeIndex(checked as boolean)}
              disabled={isExporting}
            />
            <Label htmlFor="include-index" className="cursor-pointer">
              Include index file listing all records
            </Label>
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <Progress value={exportProgress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">{exportStatus}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export ZIP
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
