import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind classes merged without duplicates: the helper every shadcn/ui component expects. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
