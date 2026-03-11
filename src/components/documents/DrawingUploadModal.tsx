import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Upload, FileText, Loader2, X, Image, Layers, Zap, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  compressDrawing, 
  shouldCompressDrawing, 
  formatFileSize, 
  estimateCompressedSize 
} from "@/lib/imageCompression";
import { Progress } from "@/components/ui/progress";

export interface Drawing {
  id: string;
  file_name: string;
  sheet_number?: string | null;
  revision_number?: string | null;
  document_type?: string | null;
  project_id: string;
}

interface DrawingUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onUploadComplete?: () => void;
  existingDrawing?: Drawing; // For revision uploads
}

export const DrawingUploadModal = ({ 
  open, 
  onOpenChange, 
  projectId,
  onUploadComplete,
  existingDrawing
}: DrawingUploadModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<Blob | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    willCompress: boolean;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [sheetNumber, setSheetNumber] = useState("");
  const [revisionNumber, setRevisionNumber] = useState("A");
  const [drawingType, setDrawingType] = useState<string>("plan");
  const [dragActive, setDragActive] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || "");

  interface Project {
    id: string;
    name: string;
  }

  const [projects, setProjects] = useState<Project[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id,name')
        .eq('is_deleted', false)
        .order('name');
      setProjects(data || []);
      if (!projectId && data && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    };
    fetchProjects();
  }, [projectId]);

  useEffect(() => {
    if (existingDrawing) {
      setTitle(existingDrawing.file_name);
      setSheetNumber(existingDrawing.sheet_number || "");
      // Increment revision letter
      const currentRev = existingDrawing.revision_number || "A";
      const nextRev = String.fromCharCode(currentRev.charCodeAt(0) + 1);
      setRevisionNumber(nextRev);
      setDrawingType(existingDrawing.document_type || "plan");
      setSelectedProjectId(existingDrawing.project_id);
    }
  }, [existingDrawing]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    const maxSize = 50 * 1024 * 1024; // 50MB for drawings

    if (selectedFile.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/tiff",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, image (JPG, PNG, WEBP, TIFF).",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setCompressedFile(null);
    setCompressionInfo(null);
    
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }

    // Check if compression is needed
    if (shouldCompressDrawing(selectedFile, 10)) {
      const estimatedSize = estimateCompressedSize(selectedFile.size);
      setCompressionInfo({
        originalSize: selectedFile.size,
        compressedSize: estimatedSize,
        willCompress: true,
      });
      
      // Auto-compress in background
      setCompressing(true);
      setCompressionProgress('Loading image...');
      
      try {
        const compressed = await compressDrawing(selectedFile, {
          onProgress: (stage) => {
            if (stage === 'loading') setCompressionProgress('Loading image...');
            if (stage === 'compressing') setCompressionProgress('Optimizing...');
            if (stage === 'done') setCompressionProgress('Done!');
          }
        });
        
        setCompressedFile(compressed);
        setCompressionInfo({
          originalSize: selectedFile.size,
          compressedSize: compressed.size,
          willCompress: true,
        });
        
        toast({
          title: "Image optimized",
          description: `Reduced from ${formatFileSize(selectedFile.size)} to ${formatFileSize(compressed.size)}`,
        });
      } catch (error) {
        console.error('Compression failed:', error);
        // Fall back to original file
        setCompressionInfo(null);
        toast({
          title: "Optimization skipped",
          description: "Uploading original file instead.",
        });
      } finally {
        setCompressing(false);
        setCompressionProgress('');
      }
    } else if (selectedFile.type === 'application/pdf' && selectedFile.size > 20 * 1024 * 1024) {
      // Show hint for large PDFs
      setCompressionInfo({
        originalSize: selectedFile.size,
        compressedSize: selectedFile.size,
        willCompress: false,
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedProjectId) {
      toast({
        title: "Missing information",
        description: "Please select a file and project.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to upload drawings.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Use compressed file if available, otherwise use original
      const fileToUpload = compressedFile || file;
      const uploadSize = fileToUpload.size;
      
      // For compressed files, use .jpg extension since we convert to JPEG
      const fileExt = compressedFile ? 'jpg' : file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${selectedProjectId}/drawings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(filePath, fileToUpload, {
          contentType: compressedFile ? 'image/jpeg' : file.type,
        });

      if (uploadError) throw uploadError;

      // Store just the file path - we'll generate signed URLs when viewing

      const { error: dbError } = await supabase
        .from('attachments')
        .insert({
          project_id: selectedProjectId,
          file_name: title || file.name,
          file_type: compressedFile ? 'image/jpeg' : file.type,
          file_url: filePath,
          file_size: uploadSize,
          document_type: drawingType,
          uploaded_by: user.id,
          sheet_number: sheetNumber || null,
          revision_number: revisionNumber,
          revision_date: new Date().toISOString(),
          previous_revision_id: existingDrawing?.id || null,
        });

      if (dbError) throw dbError;

      const savedMessage = compressionInfo?.willCompress 
        ? ` (optimized from ${formatFileSize(compressionInfo.originalSize)})`
        : '';
      
      toast({
        title: "Drawing uploaded",
        description: `${title || file.name} (Rev ${revisionNumber}) has been uploaded${savedMessage}.`,
      });

      // Reset form
      setFile(null);
      setCompressedFile(null);
      setCompressionInfo(null);
      setTitle("");
      setSheetNumber("");
      setRevisionNumber("A");
      setDrawingType("plan");
      if (fileInputRef.current) fileInputRef.current.value = "";

      onOpenChange(false);
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: unknown) {
      console.error("Error uploading drawing:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload drawing. Please try again.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {existingDrawing ? "Upload New Revision" : "Upload Drawing"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Selector */}
          {!projectId && !existingDrawing && (
            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragActive ? "border-primary bg-accent" : "border-border",
              uploading && "opacity-50 pointer-events-none"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,.tif"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
            
            {file ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3">
                  {file.type.startsWith('image/') ? (
                    <Image className="h-8 w-8 text-primary" />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                  <div className="text-left flex-1">
                    <p className="font-medium truncate max-w-[280px]">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                      {compressionInfo?.willCompress && compressedFile && (
                        <span className="text-green-600 ml-2">
                          → {formatFileSize(compressionInfo.compressedSize)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setCompressedFile(null);
                      setCompressionInfo(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Compression status */}
                {compressing && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 animate-pulse text-amber-500" />
                      <span>{compressionProgress}</span>
                    </div>
                    <Progress value={compressionProgress === 'Done!' ? 100 : 50} className="h-1" />
                  </div>
                )}
                
                {/* Compression result */}
                {compressionInfo?.willCompress && compressedFile && !compressing && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-3 py-2">
                    <Zap className="h-4 w-4" />
                    <span>
                      Optimized: {formatFileSize(compressionInfo.originalSize)} → {formatFileSize(compressionInfo.compressedSize)}
                      {' '}({Math.round((1 - compressionInfo.compressedSize / compressionInfo.originalSize) * 100)}% smaller)
                    </span>
                  </div>
                )}
                
                {/* Large PDF warning */}
                {compressionInfo && !compressionInfo.willCompress && file.type === 'application/pdf' && file.size > 20 * 1024 * 1024 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      Large PDF ({formatFileSize(file.size)}). Consider using a PDF optimizer tool for faster uploads.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  Drag & drop your drawing here
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF or images (JPG, PNG, TIFF) • Max 50MB
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Sheet Number */}
            <div>
              <Label htmlFor="sheet-number">Sheet Number</Label>
              <Input
                id="sheet-number"
                value={sheetNumber}
                onChange={(e) => setSheetNumber(e.target.value)}
                placeholder="e.g. A-101"
                disabled={uploading}
              />
            </div>

            {/* Revision */}
            <div>
              <Label htmlFor="revision">Revision</Label>
              <Input
                id="revision"
                value={revisionNumber}
                onChange={(e) => setRevisionNumber(e.target.value.toUpperCase())}
                placeholder="A"
                maxLength={3}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Title Field */}
          <div>
            <Label htmlFor="title">Drawing Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter drawing title"
              disabled={uploading}
            />
          </div>

          {/* Drawing Type */}
          <div>
            <Label htmlFor="drawing-type">Drawing Type</Label>
            <Select value={drawingType} onValueChange={setDrawingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plan">Floor Plan</SelectItem>
                <SelectItem value="drawing">General Drawing</SelectItem>
                <SelectItem value="blueprint">Blueprint</SelectItem>
                <SelectItem value="specification">Specification</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !selectedProjectId || uploading || compressing}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : compressing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Drawing
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
