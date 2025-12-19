import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { NoAccess } from "@/components/NoAccess";
import { SectionHeader } from "@/components/SectionHeader";
import { SafetyLanding } from "@/components/safety/SafetyLanding";
import { SafetyFormModal } from "@/components/safety/SafetyFormModal";
import { SafetyFormDetailModal } from "@/components/safety/SafetyFormDetailModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";

const Safety = () => {
  const { currentProjectId } = useCurrentProject();
  const { can, loading: roleLoading } = useAuthRole(currentProjectId || undefined);
  const { isAdmin, loading: globalRoleLoading } = useUserRole();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  // Permission checks
  const canViewSafety = isAdmin || (currentProjectId ? can('view_safety', currentProjectId) : false);
  const canCreateSafety = isAdmin || (currentProjectId ? can('create_safety', currentProjectId) : false);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("safety_forms")
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      // Filter by project if one is selected
      if (currentProjectId) {
        query = query.eq("project_id", currentProjectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch attachments count for each form
      const formsWithAttachments = await Promise.all(
        (data || []).map(async (form) => {
          const { count } = await supabase
            .from("attachments")
            .select("id", { count: "exact", head: true })
            .eq("safety_form_id", form.id);

          return {
            ...form,
            attachments: Array(count || 0).fill({ id: '' }),
          };
        })
      );

      setForms(formsWithAttachments);
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

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
  }, [fetchForms]);

  const handleCreateForm = useCallback((type: string) => {
    setSelectedFormType(type);
    setIsFormModalOpen(true);
  }, []);

  const handleFormClick = useCallback((formId: string) => {
    setSelectedFormId(formId);
    setIsDetailModalOpen(true);
  }, []);

  const handleFormCreated = useCallback(() => {
    fetchForms();
  }, [fetchForms]);

  // Show skeleton while checking permissions
  if (roleLoading || globalRoleLoading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-4" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-[140px]" />
              ))}
            </div>
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
        />

        <SafetyLanding
          forms={forms}
          loading={loading}
          onCreateForm={handleCreateForm}
          onFormClick={handleFormClick}
          canCreate={canCreateSafety}
        />

        <SafetyFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onCreate={handleFormCreated}
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