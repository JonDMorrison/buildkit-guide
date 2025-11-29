import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { DocumentGrid } from "@/components/documents/DocumentGrid";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { useDocuments } from "@/hooks/useDocuments";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Plus, Grid3x3, List, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export type DocumentType = 'all' | 'plan' | 'rfi' | 'permit' | 'safety' | 'contract' | 'specification' | 'other';

const Documents = () => {
  const { currentProjectId } = useCurrentProject();
  const { can } = useAuthRole(currentProjectId || undefined);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [filterType, setFilterType] = useState<DocumentType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [projects, setProjects] = useState<any[]>([]);

  const { documents, loading, refetch } = useDocuments(
    selectedProject === 'all' ? undefined : selectedProject,
    filterType === 'all' ? undefined : filterType
  );

  const canUploadDocuments = currentProjectId ? can('upload_documents', currentProjectId) : false;

  useState(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      setProjects(data || []);
    };
    fetchProjects();
  });

  const typeFilters: { label: string; value: DocumentType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Plans', value: 'plan' },
    { label: 'RFIs', value: 'rfi' },
    { label: 'Permits', value: 'permit' },
    { label: 'Safety', value: 'safety' },
    { label: 'Contracts', value: 'contract' },
    { label: 'Specs', value: 'specification' },
    { label: 'Other', value: 'other' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <SectionHeader
          title="Documents"
          count={documents.length}
          action={canUploadDocuments ? {
            label: "Upload",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => setUploadModalOpen(true),
          } : undefined}
        />

        {/* Project Selector */}
        <div className="mb-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <Tabs 
            value={filterType} 
            onValueChange={(value) => setFilterType(value as DocumentType)}
            className="flex-1"
          >
            <TabsList className="w-full grid grid-cols-4 md:grid-cols-8 h-auto gap-2">
              {typeFilters.map((filter) => (
                <TabsTrigger 
                  key={filter.value} 
                  value={filter.value}
                  className="text-xs md:text-sm px-2 py-2"
                >
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-1 bg-muted p-1 rounded-lg flex-shrink-0">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Documents Display */}
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No documents</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {filterType !== 'all' 
                ? `No ${typeFilters.find(f => f.value === filterType)?.label.toLowerCase()} documents found.`
                : "Upload drawings, RFIs, photos, and other project files to get started."
              }
            </p>
            {canUploadDocuments && (
              <Button onClick={() => setUploadModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <DocumentGrid 
            documents={documents} 
            onPreview={setPreviewDoc}
          />
        ) : (
          <DocumentList 
            documents={documents} 
            onPreview={setPreviewDoc}
          />
        )}

        {/* Upload Modal */}
        <DocumentUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          projectId={selectedProject === 'all' ? undefined : selectedProject}
          onUploadComplete={refetch}
        />

        {/* Preview Modal */}
        {previewDoc && (
          <DocumentPreviewModal
            document={previewDoc}
            open={!!previewDoc}
            onOpenChange={(open) => !open && setPreviewDoc(null)}
          />
        )}
      </div>
    </Layout>
  );
};

export default Documents;
