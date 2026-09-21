import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** The class helper every shadcn/ui component uses, as its documentation has it. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
