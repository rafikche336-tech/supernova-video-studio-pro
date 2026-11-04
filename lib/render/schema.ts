import { z } from 'zod';
import { MAX_PROMPT_LENGTH } from '@/lib/config';
import { ENGINE_IDS, type EngineId } from '@/lib/engines/registry';

/**
 * Request validation for `POST /api/render`.
 *
 * This is the trust boundary: everything below it can assume a well-formed,
 * bounded, allow-listed payload. v1 passed the raw body straight into an object
 * lookup, which let `{"engine":"__proto__"}` reach `Object.prototype`.
 */

/** Control characters have no place in a prompt and can corrupt logs/UI. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const engineIdSchema = z.enum(ENGINE_IDS as readonly [EngineId, ...EngineId[]]);

export const renderRequestSchema = z.strictObject({
  prompt: z
    .string({ error: 'Prompt must be a string' })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, 'Prompt required')
        .max(MAX_PROMPT_LENGTH, `Prompt must be at most ${MAX_PROMPT_LENGTH} characters`),
    )
    .refine(
      (value) => !CONTROL_CHARACTERS.test(value),
      'Prompt contains invalid control characters',
    ),
  engine: engineIdSchema,
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

/** Flattens a ZodError into `{ path, message }` pairs for API responses. */
export function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
