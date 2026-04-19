import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// No test file: cn() is a thin composition of clsx + tailwind-merge with no logic of its own.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
