import {type ClassValue, clsx} from 'clsx';
import {twMerge} from 'tailwind-merge';

/**
 * Joins class names, resolving Tailwind conflicts in favour of the last one.
 *
 * Without the merge step, `cn('p-2', 'p-4')` would emit both classes and let
 * CSS source order decide the winner, which makes component overrides
 * unpredictable.
 *
 * @param inputs Class names, arrays or conditional objects.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
