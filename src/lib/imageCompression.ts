/**
 * Compress an image file to reduce storage usage
 * Max dimension: 1600px, JPEG quality: 0.7
 */
export const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxDimension = 1600;
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > height && width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',
        0.7
      );
    };

    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
};

export interface DrawingCompressionOptions {
  maxDimension?: number;  // default 4000px for drawings
  quality?: number;       // default 0.85 for better detail
  onProgress?: (stage: 'loading' | 'compressing' | 'done') => void;
}

/**
 * Compress a drawing image with higher quality settings
 * Preserves more detail than standard compression
 * Max dimension: 4000px, JPEG quality: 0.85
 */
export const compressDrawing = (
  file: File,
  options?: DrawingCompressionOptions
): Promise<Blob> => {
  const maxDimension = options?.maxDimension ?? 4000;
  const quality = options?.quality ?? 0.85;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    options?.onProgress?.('loading');

    img.onload = () => {
      options?.onProgress?.('compressing');
      
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > height && width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Use high-quality image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src); // Clean up
          if (blob) {
            options?.onProgress?.('done');
            resolve(blob);
          } else {
            reject(new Error('Could not compress drawing'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Could not load image'));
    };
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Estimate compressed file size based on original dimensions and size
 * This is a rough estimate - actual compression varies by image content
 */
export const estimateCompressedSize = (
  originalSize: number,
  originalWidth?: number,
  originalHeight?: number,
  maxDimension: number = 4000,
  quality: number = 0.85
): number => {
  // If we don't have dimensions, estimate based on typical compression ratios
  if (!originalWidth || !originalHeight) {
    // Typical JPEG compression at 0.85 quality gives 3-5x reduction
    return Math.round(originalSize * 0.25);
  }

  // Calculate dimension reduction factor
  const maxOriginalDimension = Math.max(originalWidth, originalHeight);
  const dimensionFactor = maxOriginalDimension > maxDimension 
    ? (maxDimension / maxOriginalDimension) ** 2 
    : 1;

  // Estimate quality-based reduction (rough approximation)
  const qualityFactor = quality * 0.4 + 0.1; // Maps 0.85 quality to ~0.44

  return Math.round(originalSize * dimensionFactor * qualityFactor);
};

/**
 * Check if a file should be compressed based on size
 */
export const shouldCompressDrawing = (file: File, thresholdMB: number = 10): boolean => {
  const isImage = file.type.startsWith('image/') && file.type !== 'image/gif';
  const isOverThreshold = file.size > thresholdMB * 1024 * 1024;
  return isImage && isOverThreshold;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
