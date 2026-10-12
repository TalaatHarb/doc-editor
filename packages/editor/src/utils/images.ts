const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Reads an image file as a data URL; returns null for non-images or files over 5 MB. */
export function readImageFile(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_BYTES) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
