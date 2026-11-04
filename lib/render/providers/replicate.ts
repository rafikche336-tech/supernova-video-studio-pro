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
 * Replicate — the pay-as-you-go alternative.
 *
 * No signup credit, but no minimum spend either, and the prediction API is the
 * nicest async contract in the field. Useful as a second backend when fal is
 * rate limited, when you already have a Replicate account, or when you want a
 * specific community model by version id.
 *
 * Two accepted model formats:
 *   `owner/name`             → POST /v1/models/{owner}/{name}/predictions
 *   `owner/name:version_id`  → POST /v1/predictions  { version, input }
 *
 * Output can be a string, an array of strings, or an object — `extractVideoUrl`
 * handles all three because models differ.
 */
export interface ReplicateProviderConfig {
  readonly apiToken: string;
  /** e.g. `lightricks/ltx-video` or `owner/name:abc123…` */
  readonly model: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

interface ReplicatePrediction {
  readonly id?: string;
  readonly status?: string;
  readonly output?: unknown;
  readonly error?: string | null;
  readonly detail?: string;
}

const DEFAULT_BASE_URL = 'https://api.replicate.com';

export class ReplicateVideoProvider implements RenderProvider {
  readonly id = 'replicate';
  readonly mode = 'live' as const;
  readonly model: string;

  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ReplicateProviderConfig) {
    this.token = config.apiToken;
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private get headers(): Record<string, string> {
    return { authorization: `Bearer ${this.token}` };
  }

  async submit(input: RenderInput): Promise<ProviderJob> {
    const payload: Record<string, unknown> = { input: { prompt: input.prompt } };
    const endpoint = this.model.includes(':')
      ? `${this.baseUrl}/v1/predictions`
      : `${this.baseUrl}/v1/models/${this.model}/predictions`;

    if (this.model.includes(':')) {
      payload.version = this.model;
    }

    const prediction = await requestJson<ReplicatePrediction>(endpoint, {
      method: 'POST',
      headers: this.headers,
      body: payload,
      timeoutMs: this.timeoutMs,
      secret: this.token,
    });

    if (!prediction.id) {
      throw new RenderProviderError(
        'provider-failed',
        `Replicate did not return a prediction id${prediction.detail ? `: ${prediction.detail}` : ''}.`,
        502,
      );
    }

    return {
      providerJobId: makeProviderJobId('replicate', prediction.id),
      status: 'queued',
      progress: 5,
    };
  }

  async status(providerJobId: string, context: PollContext): Promise<ProviderJob | null> {
    const predictionId = stripProviderPrefix('replicate', providerJobId);
    const out = makeProviderJobId('replicate', predictionId);

    const prediction = await requestJson<ReplicatePrediction>(
      `${this.baseUrl}/v1/predictions/${encodeURIComponent(predictionId)}`,
      { headers: this.headers, timeoutMs: this.timeoutMs, secret: this.token },
    );

    switch (prediction.status) {
      case 'succeeded': {
        const videoUrl = extractVideoUrl(prediction.output);
        if (!videoUrl) {
          return {
            providerJobId: out,
            status: 'failed',
            progress: 100,
            error: 'Replicate finished the prediction but returned no video file.',
          };
        }
        return { providerJobId: out, status: 'succeeded', progress: 100, videoUrl };
      }

      case 'failed':
        return {
          providerJobId: out,
          status: 'failed',
          progress: 100,
          error:
            prediction.error?.slice(0, 300) ?? 'Replicate reported that the prediction failed.',
        };

      case 'canceled':
        return {
          providerJobId: out,
          status: 'failed',
          progress: 100,
          error: 'The prediction was cancelled.',
        };

      case 'processing':
        return {
          providerJobId: out,
          status: 'running',
          progress: rampProgress(Date.now() - context.submittedAt, 60_000),
        };

      default:
        // 'starting' or anything new the API introduces.
        return { providerJobId: out, status: 'queued', progress: 8 };
    }
  }
}
