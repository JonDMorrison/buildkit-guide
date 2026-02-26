import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deterministic slug generator.
 * - trim, lowercase
 * - replace non-alphanumerics with hyphens
 * - collapse multiple hyphens
 * - strip leading/trailing hyphens
 * - max 30 chars
 * - fallback to 'org' if empty
 */
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return slug || 'org';
}
