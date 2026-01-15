import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DrawingUploadModal } from "@/components/documents/DrawingUploadModal";
import { DrawingViewer } from "@/components/documents/DrawingViewer";
import { DrawingThumbnail } from "@/components/documents/DrawingThumbnail";
import { useAuthRole } from "@/hooks/useAuthRole";
import { useCurrentProject } from "@/hooks/useCurrentProject";
import { Plus, Search, Layers, Grid3x3, List, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { Drawing } from "@/types/drawings";

interface Project {
  id: string;
  name: string;
}

const Drawings = () => {
  const { currentProjectId } = useCurrentProject();
  const { can } = useAuthRole(currentProjectId || undefined);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(null);
  const [revisionDrawing, setRevisionDrawing] = useState<Drawing | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawingToDelete, setDrawingToDelete] = useState<Drawing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fix: Check upload permission for any project when "all" is selected
  const canUpload = (selectedProject !== 'all' && can('upload_documents', selectedProject)) || 
                    (selectedProject === 'all' && projects.length > 0);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_deleted', false)
        .order('name');
      setProjects(data || []);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchDrawings();

    const channel = supabase
      .channel('drawings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attachments',
        },
        () => fetchDrawings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject]);

  const fetchDrawings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('attachments')
        .select('*, profiles(full_name, email), projects(name)')
        .in('document_type', ['plan', 'drawing', 'blueprint', 'specification'])
        .order('sheet_number', { ascending: true, nullsFirst: false })
        .order('revision_date', { ascending: false });

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by sheet number to show only latest revision in list
      const latestBySheet = new Map<string, Drawing>();
      ((data || []) as Drawing[]).forEach(drawing => {
        const key = drawing.sheet_number || drawing.id;
        const existing = latestBySheet.get(key);
        const drawingDate = new Date(drawing.revision_date || drawing.created_at);
        const existingDate = existing ? new Date(existing.revision_date || existing.created_at) : null;
        
        if (!existing || (existingDate && drawingDate > existingDate)) {
          latestBySheet.set(key, drawing);
        }
      });

      setDrawings(Array.from(latestBySheet.values()));
    } catch (error) {
      console.error('Error fetching drawings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDrawings = drawings.filter((drawing: Drawing) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      drawing.file_name?.toLowerCase().includes(query) ||
      drawing.sheet_number?.toLowerCase().includes(query) ||
      drawing.projects?.name?.toLowerCase().includes(query)
    );
  });

  const handleUploadRevision = (drawing: Drawing) => {
    setRevisionDrawing(drawing);
    setSelectedDrawing(null);
  };

  const handleDeleteDrawing = async () => {
    if (!drawingToDelete) return;
    
    setIsDeleting(true);
    try {
      // Delete from storage first
      const filePath = drawingToDelete.file_url.startsWith('http') 
        ? drawingToDelete.file_url.split('/').pop() 
        : drawingToDelete.file_url;
      
      if (filePath) {
        await supabase.storage
          .from('project-documents')
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', drawingToDelete.id);

      if (error) throw error;

      toast.success('Drawing deleted successfully');
      fetchDrawings();
    } catch (error) {
      console.error('Error deleting drawing:', error);
      toast.error('Failed to delete drawing');
    } finally {
      setIsDeleting(false);
      setDrawingToDelete(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, drawing: Drawing) => {
    e.stopPropagation();
    setDrawingToDelete(drawing);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <Skeleton className="h-12 w-64 mb-6" />
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
          title="Drawings"
          count={filteredDrawings.length}
          action={canUpload ? {
            label: "Upload",
            icon: <Plus className="h-6 w-6" />,
            onClick: () => setUploadModalOpen(true),
          } : undefined}
        />

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full md:w-[200px]">
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

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, sheet number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-1 bg-muted p-1 rounded-lg">
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

        {/* Drawings Display */}
        {filteredDrawings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Layers className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No drawings</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Upload floor plans, blueprints, and other construction drawings.
            </p>
            {canUpload && (
              <Button onClick={() => setUploadModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Drawing
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredDrawings.map((drawing) => (
              <Card 
                key={drawing.id} 
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden group relative"
                onClick={() => setSelectedDrawing(drawing)}
              >
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  <DrawingThumbnail 
                    fileUrl={drawing.file_url}
                    fileType={drawing.file_type}
                    fileName={drawing.file_name}
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    {drawing.sheet_number && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {drawing.sheet_number}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs bg-background/80">
                      Rev {drawing.revision_number || 'A'}
                    </Badge>
                  </div>
                  {/* Delete button - appears on hover */}
                  <button
                    onClick={(e) => handleDeleteClick(e, drawing)}
                    className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                    aria-label="Delete drawing"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm truncate">{drawing.file_name}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {drawing.projects?.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Sheet #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="w-20">Rev</TableHead>
                  <TableHead className="w-32">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrawings.map((drawing) => (
                  <TableRow 
                    key={drawing.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedDrawing(drawing)}
                  >
                    <TableCell className="font-mono">
                      {drawing.sheet_number || '-'}
                    </TableCell>
                    <TableCell className="font-medium">{drawing.file_name}</TableCell>
                    <TableCell>{drawing.projects?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {drawing.revision_number || 'A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(drawing.revision_date || drawing.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Upload Modal */}
        <DrawingUploadModal
          open={uploadModalOpen || !!revisionDrawing}
          onOpenChange={(open) => {
            setUploadModalOpen(open);
            if (!open) setRevisionDrawing(null);
          }}
          projectId={selectedProject === 'all' ? undefined : selectedProject}
          existingDrawing={revisionDrawing}
          onUploadComplete={fetchDrawings}
        />

        {/* Drawing Viewer */}
        {selectedDrawing && (
          <DrawingViewer
            drawing={selectedDrawing}
            open={!!selectedDrawing}
            onOpenChange={(open) => !open && setSelectedDrawing(null)}
            onUploadRevision={() => handleUploadRevision(selectedDrawing)}
            onDelete={fetchDrawings}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!drawingToDelete} onOpenChange={(open) => !open && setDrawingToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Drawing</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{drawingToDelete?.file_name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDrawing}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default Drawings;
