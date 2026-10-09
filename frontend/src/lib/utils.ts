import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Strict type-safe utility for conditionally combining Tailwind CSS class names
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
