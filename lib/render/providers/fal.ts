import { requestJson } from '../http';
import {
  RenderProviderError,
  makeProviderJobId,
  type PollContext,
  type ProviderJob,
  type RenderInput,
  type RenderProvider,
} from '../types';
import { extractVideoUrl, rampProgress, stripProviderPrefix } from './media';

/**
 * fal.ai — the default live backend.
 *
 * Why fal first: it hands every new account **$10 of free credit** (enough for
 * roughly 20–100 short clips depending on model), has no monthly minimum, and
 * runs the cheapest per-second routes available in 2026 (LTX-2 Fast, Wan 2.5
 * from ~$0.05/s, Kling from ~$0.029/s). The queue API is a simple
 * submit → poll → fetch-result loop that needs no SDK.
 *
 * API shape (https://fal.ai/docs/documentation/model-apis/inference/queue):
 *   POST {base}/{model}                     → { request_id, status_url, response_url }
 *   GET  {base}/{model}/requests/{id}/status → { status: IN_QUEUE|IN_PROGRESS|COMPLETED }
 *   GET  {base}/{model}/requests/{id}        → model output ({ video: { url } } …)
 */
export interface FalProviderConfig {
  readonly apiKey: string;
  /** e.g. `fal-ai/ltx-2/text-to-video/fast` */
  readonly model: string;
  /** Overridable so tests can point at a local stub. */
  readonly baseUrl?: string;
  readonly durationSeconds?: number;
  readonly aspectRatio?: string;
  readonly timeoutMs?: number;
}

interface FalSubmitResponse {
  readonly request_id?: string;
  readonly status?: string;
  readonly detail?: string;
  readonly error?: string;
}

interface FalStatusResponse {
  readonly status?: string;
  readonly error?: unknown;
}

const DEFAULT_BASE_URL = 'https://queue.fal.run';

export class FalVideoProvider implements RenderProvider {
  readonly id = 'fal';
  readonly mode = 'live' as const;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly durationSeconds: number | undefined;
  private readonly aspectRatio: string | undefined;
  private readonly timeoutMs: number;

  constructor(config: FalProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.durationSeconds = config.durationSeconds;
    this.aspectRatio = config.aspectRatio;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private get headers(): Record<string, string> {
    return { authorization: `Key ${this.apiKey}` };
  }

  private url(suffix = ''): string {
    return `${this.baseUrl}/${this.model}${suffix}`;
  }

  async submit(input: RenderInput): Promise<ProviderJob> {
    const body: Record<string, unknown> = { prompt: input.prompt };

    // Only send the knobs the model understands; unknown fields are a 422 on fal.
    if (this.durationSeconds !== undefined) body.duration = this.durationSeconds;
    if (this.aspectRatio) body.aspect_ratio = this.aspectRatio;

    const response = await requestJson<FalSubmitResponse>(this.url(), {
      method: 'POST',
      headers: this.headers,
      body,
      timeoutMs: this.timeoutMs,
      secret: this.apiKey,
    });

    if (!response.request_id) {
      throw new RenderProviderError(
        'provider-failed',
        `fal.ai did not return a request id${response.detail ? `: ${response.detail}` : ''}.`,
        502,
      );
    }

    return {
      providerJobId: makeProviderJobId('fal', response.request_id),
      status: 'queued',
      progress: 5,
    };
  }

  async status(providerJobId: string, context: PollContext): Promise<ProviderJob | null> {
    const requestId = stripProviderPrefix('fal', providerJobId);
    const providerJobIdOut = makeProviderJobId('fal', requestId);

    const status = await requestJson<FalStatusResponse>(
      this.url(`/requests/${encodeURIComponent(requestId)}/status`),
      { headers: this.headers, timeoutMs: this.timeoutMs, secret: this.apiKey },
    );

    const state = (status.status ?? '').toUpperCase();

    if (state === 'COMPLETED') {
      const result = await requestJson<unknown>(
        this.url(`/requests/${encodeURIComponent(requestId)}`),
        {
          headers: this.headers,
          timeoutMs: this.timeoutMs,
          secret: this.apiKey,
        },
      );

      const videoUrl = extractVideoUrl(result);

      if (!videoUrl) {
        return {
          providerJobId: providerJobIdOut,
          status: 'failed',
          progress: 100,
          error: 'fal.ai finished the job but returned no video file.',
        };
      }

      return { providerJobId: providerJobIdOut, status: 'succeeded', progress: 100, videoUrl };
    }

    if (state === 'FAILED' || state === 'ERROR' || state === 'CANCELLED') {
      return {
        providerJobId: providerJobIdOut,
        status: 'failed',
        progress: 100,
        error: readError(status.error) ?? 'fal.ai reported that the generation failed.',
      };
    }

    if (state === 'IN_PROGRESS') {
      return {
        providerJobId: providerJobIdOut,
        status: 'running',
        progress: rampProgress(Date.now() - context.submittedAt, 45_000),
      };
    }

    // IN_QUEUE (or an unknown transitional state).
    return { providerJobId: providerJobIdOut, status: 'queued', progress: 8 };
  }
}

function readError(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 300);
  if (value && typeof value === 'object') {
    const message = (value as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
  }
  return null;
}
