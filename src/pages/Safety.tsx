import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { NoAccess } from "@/components/NoAccess";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { SafetyDashboard } from "@/components/safety/SafetyDashboard";
import { SafetyFormsList } from "@/components/safety/SafetyFormsList";
import { FormTypeSelector } from "@/components/safety/FormTypeSelector";
import { SafetyFormModal } from "@/components/safety/SafetyFormModal";
import { SafetyFormDetailModal } from "@/components/safety/SafetyFormDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useUserRole } from "@/hooks/useUserRole";
import { ShieldCheck, Plus } from "lucide-react";
import { format, subDays } from "date-fns";

const Safety = () => {
  const { currentProjectId } = useCurrentProject();
  const { can, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  const { isAdmin, loading: globalRoleLoading } = useUserRole();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalForms: 0,
    submittedThisWeek: 0,
    draftForms: 0,
    complianceRate: 0,
    missingForms: [] as Array<{ type: string; dueDate: string }>,
  });

  // Permission checks - admins can always view, otherwise need project-specific permission
  const canViewSafety = isAdmin || (currentProjectId ? can('view_safety', currentProjectId) : false);
  const canCreateSafety = isAdmin || (currentProjectId ? can('create_safety', currentProjectId) : false);

  useEffect(() => {
    fetchForms();

    const channel = supabase
      .channel("safety-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "safety_forms",
        },
        () => {
          fetchForms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("safety_forms")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch attachments count for each form
      const formsWithAttachments = await Promise.all(
        (data || []).map(async (form) => {
          const { data: attachments } = await supabase
            .from("attachments")
            .select("id")
            .eq("safety_form_id", form.id);

          return {
            ...form,
            attachments: attachments || [],
          };
        })
      );

      setForms(formsWithAttachments);
      calculateDashboardStats(formsWithAttachments);
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDashboardStats = (formsList: any[]) => {
    const totalForms = formsList.length;
    const draftForms = formsList.filter((f) => f.status === "draft").length;
    
    const sevenDaysAgo = subDays(new Date(), 7);
    const submittedThisWeek = formsList.filter(
      (f) => f.status === "submitted" && new Date(f.created_at) >= sevenDaysAgo
    ).length;

    // Calculate compliance (submitted vs total in last 7 days)
    const totalThisWeek = formsList.filter(
      (f) => new Date(f.created_at) >= sevenDaysAgo
    ).length;
    const complianceRate =
      totalThisWeek > 0 ? Math.round((submittedThisWeek / totalThisWeek) * 100) : 100;

    // Check for missing daily logs (simplified - should check actual requirements)
    const today = new Date();
    const hasTodayLog = formsList.some(
      (f) =>
        f.form_type === "daily_safety_log" &&
        f.inspection_date === format(today, "yyyy-MM-dd")
    );

    const missingForms = [];
    if (!hasTodayLog) {
      missingForms.push({
        type: "Daily Safety Log",
        dueDate: format(today, "MMM d"),
      });
    }

    setDashboardStats({
      totalForms,
      submittedThisWeek,
      draftForms,
      complianceRate,
      missingForms,
    });
  };

  const handleCreateForm = () => {
    setIsTypeSelectorOpen(true);
  };

  const handleFormTypeSelected = (type: string) => {
    setSelectedFormType(type);
    setIsFormModalOpen(true);
  };

  const handleFormClick = (formId: string) => {
    setSelectedFormId(formId);
    setIsDetailModalOpen(true);
  };

  if (roleLoading || globalRoleLoading || loading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-4" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Show no access if user cannot view safety
  if (!canViewSafety) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <NoAccess
            title="Safety Access Required"
            message="Only Project Managers and Foremen can access safety forms."
            returnPath="/tasks"
            returnLabel="Back to Tasks"
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <SectionHeader
          title="Safety"
          count={forms.length}
          action={canCreateSafety ? {
            label: "Add Form",
            icon: <Plus className="h-6 w-6" />,
            onClick: handleCreateForm,
          } : undefined}
        />

        {forms.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="No safety forms"
            description="Document safety incidents, inspections, and toolbox talks to maintain compliance."
            action={{
              label: "Create Safety Form",
              onClick: handleCreateForm,
            }}
          />
        ) : (
          <>
            <SafetyDashboard {...dashboardStats} />
            <SafetyFormsList forms={forms} onFormClick={handleFormClick} />
          </>
        )}

        <FormTypeSelector
          isOpen={isTypeSelectorOpen}
          onClose={() => setIsTypeSelectorOpen(false)}
          onSelectType={handleFormTypeSelected}
        />

        <SafetyFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onCreate={fetchForms}
          formType={selectedFormType}
        />

        <SafetyFormDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          formId={selectedFormId}
        />
      </div>
    </Layout>
  );
};

export default Safety;
