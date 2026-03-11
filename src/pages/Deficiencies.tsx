import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/shared/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/shared/DashboardHeader";
import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeficiencyFilters } from "@/components/deficiencies/DeficiencyFilters";
import { DeficiencyListView } from "@/components/deficiencies/DeficiencyListView";
import { DeficiencyDetailModal } from "@/components/deficiencies/DeficiencyDetailModal";
import { CreateDeficiencyModal } from "@/components/deficiencies/CreateDeficiencyModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuthRole } from "@/hooks/useAuthRole";
import { NoAccess } from "@/components/NoAccess";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { AlertCircle, Plus, Upload } from "lucide-react";

const Deficiencies = () => {
  const navigate = useNavigate();
  const { currentProjectId } = useCurrentProject();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);
  const { can, isPM, isForeman, isAdmin, loading: roleLoading } = useAuthRole(selectedProjectId || undefined);
  const [deficiencies, setDeficiencies] = useState<any[]>([]);
  const [filteredDeficiencies, setFilteredDeficiencies] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDeficiencyId, setSelectedDeficiencyId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sync selectedProjectId with currentProjectId from URL
  useEffect(() => {
    if (currentProjectId && currentProjectId !== selectedProjectId) {
      setSelectedProjectId(currentProjectId);
    }
  }, [currentProjectId]);

  // Fetch projects for selector
  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id,name')
        .eq('is_deleted', false)
        .order('name');
      
      setProjects(data || []);
      // Only set default if no project selected
      if (!selectedProjectId && data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    };
    fetchProjects();
  }, []);

  // Permission checks
  const canCreateDeficiencies = selectedProjectId ? can('create_deficiencies', selectedProjectId) : false;

  useEffect(() => {
    if (selectedProjectId) {
      fetchDeficiencies();
      fetchTrades();
    }

    const channel = supabase
      .channel("deficiencies-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deficiencies",
        },
        () => {
          if (selectedProjectId) {
            fetchDeficiencies();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProjectId]);

  useEffect(() => {
    filterDeficiencies();
  }, [deficiencies, selectedTrade, selectedStatus]);

  const fetchDeficiencies = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deficiencies")
        .select(`*,trades:assigned_trade_id (
            id,company_name,trade_type
          )`)
        .eq("project_id", selectedProjectId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch attachments for each deficiency
      const deficienciesWithAttachments = await Promise.all(
        (data || []).map(async (deficiency) => {
          const { data: attachments } = await supabase
            .from("attachments")
            .select("id,file_url,file_type")
            .eq("deficiency_id", deficiency.id)
            .limit(4);

          return {
            ...deficiency,
            attachments: attachments || [],
          };
        })
      );

      setDeficiencies(deficienciesWithAttachments);
    } catch (error) {
      console.error("Error fetching deficiencies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async () => {
    const { data, error } = await supabase
      .from("trades")
      .select("id,company_name")
      .eq("is_active", true)
      .order("company_name");

    if (error) {
      console.error("Error fetching trades:", error);
      return;
    }
    setTrades(data || []);
  };

  const filterDeficiencies = () => {
    let filtered = [...deficiencies];

    if (selectedTrade !== "all") {
      filtered = filtered.filter((d) => d.assigned_trade_id === selectedTrade);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((d) => d.status === selectedStatus);
    }

    setFilteredDeficiencies(filtered);
  };

  const handleDeficiencyClick = (id: string) => {
    setSelectedDeficiencyId(id);
    setIsDetailModalOpen(true);
  };

  const handleCreateDeficiency = () => {
    setIsCreateModalOpen(true);
  };

  // Access guard: only Tier 1 roles (Admin, PM, Foreman)
  const hasAccess = isAdmin || (selectedProjectId ? isPM(selectedProjectId) : false) || (selectedProjectId ? isForeman(selectedProjectId) : false);

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <NoAccess message="Deficiency management is only available to project managers and above." />
      </Layout>
    );
  }

  if (loading) {
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

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Deficiencies"
        subtitle={`${filteredDeficiencies.length} items`}
        actions={canCreateDeficiencies ? (
          <Button onClick={handleCreateDeficiency}>
            <Plus className="h-4 w-4 mr-2" />
            Add Deficiency
          </Button>
        ) : undefined}
      />

        {/* Project Selector */}
        <div className="mb-4 p-4 bg-card rounded-lg border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={selectedProjectId || undefined} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full sm:w-[280px] font-semibold">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Import from GC button - only visible to PM/Admin */}
            {(isPM || isAdmin) && selectedProjectId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projects/${selectedProjectId}/deficiency-import`)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import from GC
              </Button>
            )}
          </div>
        </div>

        {deficiencies.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="h-8 w-8" />}
            title="No deficiencies"
            description="Track quality issues, punch list items, and work that needs correction."
            action={canCreateDeficiencies ? {
              label: "Create Deficiency",
              onClick: handleCreateDeficiency,
            } : undefined}
          />
        ) : (
          <>
            <DeficiencyFilters
              trades={trades}
              selectedTrade={selectedTrade}
              selectedStatus={selectedStatus}
              onTradeChange={setSelectedTrade}
              onStatusChange={setSelectedStatus}
            />

            {filteredDeficiencies.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No deficiencies match your filters</p>
              </div>
            ) : (
              <DeficiencyListView
                deficiencies={filteredDeficiencies}
                onDeficiencyClick={handleDeficiencyClick}
              />
            )}
          </>
        )}

        <DeficiencyDetailModal
          deficiencyId={selectedDeficiencyId}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedDeficiencyId(null);
          }}
          onUpdate={fetchDeficiencies}
        />

        <CreateDeficiencyModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={fetchDeficiencies}
          projectId={selectedProjectId || undefined}
        />
    </DashboardLayout>
  );
};

export default Deficiencies;
