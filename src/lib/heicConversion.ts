import heic2any from 'heic2any';

/**
 * Check if a file is a HEIC/HEIF format
 */
export const isHeicFile = (file: File): boolean => {
  const heicTypes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
  const heicExtensions = ['.heic', '.heif'];
  
  // Check MIME type
  if (heicTypes.includes(file.type.toLowerCase())) {
    return true;
  }
  
  // Check file extension (some browsers don't set correct MIME type)
  const fileName = file.name.toLowerCase();
  return heicExtensions.some(ext => fileName.endsWith(ext));
};

/**
 * Convert HEIC file to JPEG
 * Returns original file if not HEIC or conversion fails
 */
export const convertHeicToJpeg = async (file: File): Promise<File> => {
  if (!isHeicFile(file)) {
    return file;
  }

  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });

    // heic2any can return a single blob or array of blobs
    const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    // Create new file with .jpg extension
    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    
    return new File([resultBlob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('Could not convert HEIC image. Please convert to JPEG before uploading.');
  }
};

/**
 * Process a file - converts HEIC to JPEG if needed
 */
export const processImageFile = async (file: File): Promise<File> => {
  // Convert HEIC to JPEG first
  const processedFile = await convertHeicToJpeg(file);
  return processedFile;
};
