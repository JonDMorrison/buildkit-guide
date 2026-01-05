import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";

interface DocumentUploadProps {
  projectId: string;
  onUploadComplete?: () => void;
}

export const DocumentUpload = ({ projectId, onUploadComplete }: DocumentUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("other");
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const maxSize = 20 * 1024 * 1024; // 20MB

      if (selectedFile.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 20MB.",
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
      ];

      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or image file (JPG, PNG, WEBP).",
          variant: "destructive",
        });
        return;
      }

      // Warn about PDF limitations
      if (selectedFile.type === "application/pdf") {
        setUploadError("PDF text extraction is not yet supported. For best results, please upload images (JPG, PNG) of your document pages instead.");
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress("Uploading file...");
    setUploadError(null);

    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("project-documents")
        .getPublicUrl(filePath);

      setUploadProgress("Processing document...");

      // Call edge function to process the document
      const { data, error: processError } = await supabase.functions.invoke(
        "process-document",
        {
          body: {
            fileUrl: urlData.publicUrl,
            fileName: file.name,
            projectId,
            documentType,
          },
        }
      );

      // Check for specific error types
      if (processError) {
        throw processError;
      }
      
      if (data && !data.success) {
        // Handle specific error types from the edge function
        if (data.unsupported_format) {
          setUploadError(data.error);
          setUploadProgress("");
          toast({
            title: "Format not supported",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        
        if (data.requires_configuration) {
          setUploadError(data.error);
          setUploadProgress("");
          toast({
            title: "Configuration required",
            description: data.error,
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(data.error || "Processing failed");
      }

      setUploadProgress("Complete!");
      toast({
        title: "Document uploaded",
        description: `${file.name} has been uploaded and processed successfully.`,
      });

      // Reset form
      setFile(null);
      setDocumentType("other");
      setUploadProgress("");
      
      // Clear file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      console.error("Error uploading document:", error);
      
      // Parse error message from edge function response
      let errorMessage = error.message || "Failed to upload document. Please try again.";
      
      // Try to extract error from function response
      if (error.context?.body) {
        try {
          const body = JSON.parse(error.context.body);
          if (body.error) {
            errorMessage = body.error;
          }
        } catch {
          // Use original error message
        }
      }
      
      setUploadError(errorMessage);
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  const isPdf = file?.type === "application/pdf";

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload Document</h3>
          <p className="text-sm text-muted-foreground">
            Upload images for AI text extraction. PDF support coming soon.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="document-type">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plan">Plan / Drawing</SelectItem>
                <SelectItem value="rfi">RFI</SelectItem>
                <SelectItem value="permit">Permit</SelectItem>
                <SelectItem value="safety">Safety Document</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="specification">Specification</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file-upload">Select File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {file && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
                <span>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
          </div>

          {/* PDF Warning */}
          {isPdf && !uploading && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                PDF text extraction is not yet available. For best results, convert your PDF pages to images (JPG, PNG) before uploading.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {uploadError && !isPdf && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {uploadProgress && (
            <div className="flex items-center gap-2 text-sm">
              {uploadProgress === "Complete!" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>{uploadProgress}</span>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || uploading || isPdf}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : isPdf ? (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                PDF Not Supported Yet
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Process
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};