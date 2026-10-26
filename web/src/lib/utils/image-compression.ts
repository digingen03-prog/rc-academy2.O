/**
 * RCA Academy 2.0 - Adaptive Payment Proof Compression Utility
 * 
 * Safely compresses receipts, payment screenshots, and bank deposit slips targeting <= 150 KB
 * while strictly preserving textual legibility (UTR, dates, amounts, bank stamps).
 * 
 * Approved formats:
 * - Images: image/jpeg, image/png, image/webp
 * - Documents: application/pdf (Preserved as-is with transparent non-compression disclosure)
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  isCompressed: boolean;
  mimeType: string;
  previewUrl: string | null;
  compressionRatioPercent: number;
  note: string;
}

export const TARGET_IMAGE_SIZE_BYTES = 150 * 1024; // 150 KB target
export const MAX_RAW_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB strict cutoff
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/**
 * Format raw byte count into human-readable string (e.g. 142.5 KB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Validates file format and size before processing
 */
export function validateProofFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  if (file.size > MAX_RAW_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${formatBytes(file.size)}) exceeds maximum limit of 10 MB`,
    };
  }

  const normalizedType = file.type.toLowerCase();
  const fileExt = file.name.split('.').pop()?.toLowerCase();

  const isApprovedMime = ALLOWED_MIME_TYPES.includes(normalizedType);
  const isApprovedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fileExt || '');

  if (!isApprovedMime && !isApprovedExt) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG, PNG, WebP, and PDF documents are supported.',
    };
  }

  return { valid: true };
}

/**
 * Adaptively compresses image files targeting 150 KB while preserving crisp text readability.
 * If file is a PDF, it is verified and passed through as-is without false compression claims.
 */
export async function processPaymentProofFile(file: File): Promise<CompressionResult> {
  const validation = validateProofFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 1. Transparent handling for PDF documents
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      isCompressed: false,
      mimeType: 'application/pdf',
      previewUrl: null, // PDFs display icon/badge instead of canvas thumbnail
      compressionRatioPercent: 0,
      note: 'Original PDF Document (Uncompressed)',
    };
  }

  // 2. Already within target image size - keep high quality
  if (file.size <= TARGET_IMAGE_SIZE_BYTES) {
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : null;
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      isCompressed: false,
      mimeType: file.type || 'image/jpeg',
      previewUrl,
      compressionRatioPercent: 0,
      note: `Original Image (${formatBytes(file.size)} - already under 150 KB target)`,
    };
  }

  // 3. Compress image using HTML5 Canvas with iterative quality/dimension stepping
  return new Promise<CompressionResult>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data'));
      img.onload = async () => {
        try {
          const originalWidth = img.naturalWidth || img.width;
          const originalHeight = img.naturalHeight || img.height;

          // Limit max dimension to 1600px to maintain high resolution for UTR numbers
          const MAX_DIMENSION = 1600;
          let targetWidth = originalWidth;
          let targetHeight = originalHeight;

          if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
            if (originalWidth > originalHeight) {
              targetWidth = MAX_DIMENSION;
              targetHeight = Math.round((originalHeight * MAX_DIMENSION) / originalWidth);
            } else {
              targetHeight = MAX_DIMENSION;
              targetWidth = Math.round((originalWidth * MAX_DIMENSION) / originalHeight);
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d', { alpha: false });

          if (!ctx) {
            throw new Error('Canvas 2D context unavailable');
          }

          // Fill white background to avoid transparent black artifacts on PNG conversions
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Quality stepping search: aim for <= 150 KB
          const outputMime = 'image/jpeg';
          const qualitySteps = [0.85, 0.75, 0.65, 0.55, 0.45];
          let bestBlob: Blob | null = null;

          for (const quality of qualitySteps) {
            const blob = await new Promise<Blob | null>((resBlob) => {
              canvas.toBlob(resBlob, outputMime, quality);
            });

            if (blob) {
              bestBlob = blob;
              if (blob.size <= TARGET_IMAGE_SIZE_BYTES) {
                break; // Met the 150 KB target while keeping optimal readability
              }
            }
          }

          if (!bestBlob) {
            throw new Error('Failed to create compressed image blob');
          }

          // Construct sanitized filename with .jpg extension
          const originalName = file.name;
          const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
          const compressedFileName = `${baseName}.jpg`;

          const compressedFile = new File([bestBlob], compressedFileName, {
            type: outputMime,
            lastModified: Date.now(),
          });

          const previewUrl =
            typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
              ? URL.createObjectURL(bestBlob)
              : null;
          const ratio = Math.round(((file.size - compressedFile.size) / file.size) * 100);

          resolve({
            file: compressedFile,
            originalSize: file.size,
            compressedSize: compressedFile.size,
            isCompressed: true,
            mimeType: outputMime,
            previewUrl,
            compressionRatioPercent: Math.max(0, ratio),
            note: `Compressed from ${formatBytes(file.size)} to ${formatBytes(compressedFile.size)} (${ratio}% reduction)`,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
