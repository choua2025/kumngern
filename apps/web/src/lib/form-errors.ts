import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toApiError } from '../api/errors';

/**
 * Puts server-side field errors (error.details[].path) next to the matching inputs.
 * Returns the message for errors that belong to no field, to show above the form.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  const apiError = toApiError(error);
  let unmatched = apiError.details.length === 0;
  for (const detail of apiError.details) {
    if ((fields as readonly string[]).includes(detail.path)) {
      setError(detail.path as Path<T>, { type: 'server', message: detail.message });
    } else {
      unmatched = true;
    }
  }
  return unmatched ? apiError.message : null;
}
