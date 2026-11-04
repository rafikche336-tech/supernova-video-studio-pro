import { RenderProviderError } from './types';

/**
 * Minimal fetch wrapper for talking to inference providers.
 *
 * Every failure mode a provider can throw at us — timeout, 401, 402 (no
 * credit), 429, 5xx, non-JSON body — is normalised into a `RenderProviderError`
 * with a message an operator can act on. The UI shows that message verbatim, so
 * it has to be written for a human.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

export interface JsonRequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
  /** Rotate the API key out of error messages (never echo secrets). */
  readonly secret?: string;
}

function redact(message: string, secret?: string): string {
  if (!secret) return message;
  return message.split(secret).join('[redacted]');
}

export async function requestJson<T>(url: string, options: JsonRequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, secret } = options;

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new RenderProviderError(
      'provider-failed',
      `Could not reach the video provider (${reason}).`,
      502,
    );
  }

  const raw = await response.text();

  if (!response.ok) {
    throw mapHttpError(response.status, raw, secret);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new RenderProviderError(
      'provider-failed',
      'The video provider returned a response that was not JSON.',
      502,
    );
  }
}

function mapHttpError(status: number, raw: string, secret?: string): RenderProviderError {
  const detail = redact(extractDetail(raw), secret);

  if (status === 401 || status === 403) {
    return new RenderProviderError(
      'provider-auth',
      `The video provider rejected the API key${detail ? ` (${detail})` : ''}. Check FAL_KEY / REPLICATE_API_TOKEN.`,
      502,
    );
  }

  if (status === 402) {
    return new RenderProviderError(
      'provider-rate-limited',
      `The video provider account is out of credit${detail ? ` (${detail})` : ''}. Top up, or unset the API key to stay in demo mode.`,
      502,
    );
  }

  if (status === 429) {
    return new RenderProviderError(
      'provider-rate-limited',
      'The video provider is rate limiting this account. Try again in a moment.',
      429,
    );
  }

  if (status >= 500) {
    return new RenderProviderError(
      'provider-failed',
      `The video provider is having trouble (HTTP ${status}).`,
      502,
    );
  }

  return new RenderProviderError(
    'provider-failed',
    `The video provider rejected the request (HTTP ${status})${detail ? `: ${detail}` : ''}.`,
    502,
  );
}

/** Pulls a short human-readable message out of an error body. */
function extractDetail(raw: string): string {
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidates = [parsed.detail, parsed.error, parsed.message, parsed.title];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 200);
      if (candidate && typeof candidate === 'object') {
        const nested = (candidate as Record<string, unknown>).message;
        if (typeof nested === 'string' && nested.trim()) return nested.trim().slice(0, 200);
      }
    }
  } catch {
    // Not JSON — fall through to the raw snippet.
  }

  return raw.replace(/\s+/g, ' ').trim().slice(0, 200);
}
