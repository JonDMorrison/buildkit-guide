import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Upload, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  photos: File[];
  onPhotosChange: (photos: File[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
  projectId?: string;
  onAiDescription?: (data: { title: string; description: string; priority: string; location: string | null }) => void;
}

// Compress image to reduce file size for field use
const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Resize if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const PhotoUpload = ({
  photos,
  onPhotosChange,
  maxPhotos = 10,
  disabled = false,
  projectId,
  onAiDescription,
}: PhotoUploadProps) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (photos.length >= maxPhotos) return;

    setCompressing(true);
    try {
      const newPhotos: File[] = [];
      const newPreviews: string[] = [];

      for (let i = 0; i < files.length && photos.length + newPhotos.length < maxPhotos; i++) {
        const file = files[i];
        
        // Compress the image
        const compressedFile = await compressImage(file);
        newPhotos.push(compressedFile);

        // Create preview
        const preview = URL.createObjectURL(compressedFile);
        newPreviews.push(preview);
      }

      onPhotosChange([...photos, ...newPhotos]);
      setPreviews([...previews, ...newPreviews]);
    } catch (error) {
      console.error("Error processing images:", error);
    } finally {
      setCompressing(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);

    // Clean up preview URL
    URL.revokeObjectURL(previews[index]);
    const newPreviews = [...previews];
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const canAddMore = photos.length < maxPhotos;

  const analyzeWithAI = async () => {
    if (photos.length === 0 || !projectId || !onAiDescription) return;
    
    setAnalyzing(true);
    try {
      // Get the first photo and convert to base64
      const photo = photos[0];
      const reader = new FileReader();
      
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(photo);
      });

      const { data, error } = await supabase.functions.invoke('ai-analyze-photo', {
        body: {
          image_base64: base64,
          project_id: projectId,
        },
      });

      if (error) throw error;

      onAiDescription({
        title: data.suggested_title || '',
        description: data.suggested_description || '',
        priority: data.suggested_priority || '3',
        location: data.suggested_location || null,
      });

      toast({
        title: 'AI description generated',
        description: 'Review and edit before saving',
      });
    } catch (error: any) {
      console.error('Error analyzing photo:', error);
      toast({
        title: 'Error analyzing photo',
        description: error.message || 'Please describe manually',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Photo Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted"
            >
              <img
                src={preview}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                disabled={disabled}
                className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Buttons */}
      {canAddMore && (
        <div className="flex gap-3">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={disabled || compressing}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={disabled || compressing}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || compressing}
            className="flex-1 h-12"
          >
            {compressing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Compressing...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Take Photo
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || compressing}
            className="flex-1 h-12"
          >
            <Upload className="mr-2 h-5 w-5" />
            Choose Photos
          </Button>
        </div>
      )}

      {/* AI Describe Button - show when photos exist */}
      {photos.length > 0 && projectId && onAiDescription && (
        <Button
          type="button"
          variant="secondary"
          onClick={analyzeWithAI}
          disabled={disabled || analyzing}
          className="w-full h-10 gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing photo...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Describe with AI
            </>
          )}
        </Button>
      )}

      {/* Photo Counter */}
      <p className="text-xs text-muted-foreground text-center">
        {photos.length} of {maxPhotos} photos {compressing && "(compressing...)"} {analyzing && "(analyzing...)"}
      </p>
    </div>
  );
};
