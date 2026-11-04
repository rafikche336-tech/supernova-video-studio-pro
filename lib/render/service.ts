import { LOST_JOB_GRACE_MS } from '@/lib/config';
import { recordEvent } from '@/db/events';
import { createRender, getRenderForUser, updateRender, type RenderRecord } from '@/db/renders';
import type { EngineId } from '@/lib/engines/registry';
import { logger } from '@/lib/logger';
import { downloadVideo, hasVideo } from '@/lib/media/store';
import { getRenderProvider } from './index';
import { splitProviderJobId, type ProviderId, type ProviderJob } from './types';

/**
 * Bridges the render provider (which owns job progress) and the database
 * (which owns history, ownership and analytics).
 *
 * Job state is keyed by a composite `providerJobId` (`fal:abc123`) stored on the
 * row, so polling works after a restart and a database can hold a mix of live
 * and demo renders without ambiguity.
 *
 * When a live job succeeds, its temporary provider URL is downloaded to local
 * storage and the row points at `/api/media/:id`. If the download fails, the row
 * keeps the provider URL as `sourceUrl` and the media route proxies it instead —
 * the render is never lost to a storage hiccup.
 */

export interface StartRenderInput {
  readonly userId: string;
  readonly prompt: string;
  readonly engine: EngineId;
}

export async function startRender(input: StartRenderInput): Promise<RenderRecord> {
  const provider = getRenderProvider();
  const job = await provider.submit({ prompt: input.prompt, engine: input.engine });

  const { provider: providerId } = splitProviderJobId(job.providerJobId);

  const record = createRender({
    id: globalThis.crypto.randomUUID(),
    userId: input.userId,
    engine: input.engine,
    prompt: input.prompt,
    status: 'queued',
    provider: providerId as ProviderId,
    providerJobId: job.providerJobId,
  });

  recordEvent({
    type: 'render_started',
    userId: input.userId,
    renderId: record.id,
    metadata: { engine: input.engine, provider: providerId },
  });

  return mirror(record, job);
}

export async function pollRender(userId: string, renderId: string): Promise<RenderRecord | null> {
  const record = getRenderForUser(renderId, userId);
  if (!record) return null;

  if (record.status === 'succeeded' || record.status === 'failed') {
    return record;
  }

  if (!record.providerJobId) {
    return fail(record, 'This render has no provider job attached.');
  }

  let job: ProviderJob | null;

  try {
    job = await getRenderProvider().status(record.providerJobId, {
      submittedAt: record.createdAt,
    });
  } catch (error) {
    // A transient provider error should not kill a job that may still be running;
    // give it the grace window, then report the failure with the provider message.
    const message = error instanceof Error ? error.message : String(error);

    if (Date.now() - record.createdAt > LOST_JOB_GRACE_MS) {
      return fail(record, message);
    }

    logger.warn('provider status check failed', { renderId, message });
    return record;
  }

  if (!job) {
    // The provider forgot the job (restart at their end, or an expired request).
    if (Date.now() - record.createdAt > LOST_JOB_GRACE_MS) {
      return fail(record, 'This render expired before it finished. Please try again.');
    }
    return record;
  }

  return mirror(record, job);
}

/** Records a terminal failure exactly once. */
function fail(record: RenderRecord, message: string): RenderRecord {
  const updated = updateRender(record.id, { status: 'failed', error: message });

  if (record.status !== 'failed') {
    recordEvent({
      type: 'render_failed',
      userId: record.userId,
      renderId: record.id,
      metadata: { provider: record.provider, error: message },
    });
  }

  return updated ?? record;
}

async function mirror(record: RenderRecord, job: ProviderJob): Promise<RenderRecord> {
  const terminal = job.status === 'succeeded' || job.status === 'failed';
  let videoUrl = job.videoUrl ?? null;
  let sourceUrl = record.sourceUrl;
  let posterUrl = job.posterUrl ?? null;

  if (job.status === 'succeeded' && job.videoUrl && isRemote(job.videoUrl)) {
    sourceUrl = job.videoUrl;

    if (!(await hasVideo(record.id))) {
      try {
        const stored = await downloadVideo(record.id, job.videoUrl);
        logger.info('stored generated video', { renderId: record.id, bytes: stored.bytes });
      } catch (error) {
        // Keep proxying the provider URL rather than failing a paid render.
        logger.warn('could not store generated video; falling back to proxying', {
          renderId: record.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    videoUrl = `/api/media/${record.id}`;
    posterUrl = null;
  }

  const updated = updateRender(record.id, {
    status: job.status,
    progress: job.progress,
    clip: job.clip ?? null,
    videoUrl,
    posterUrl,
    sourceUrl,
    error: job.error ?? null,
    durationMs: job.status === 'succeeded' ? Date.now() - record.createdAt : null,
  });

  if (job.status === 'succeeded' && record.status !== 'succeeded') {
    recordEvent({
      type: 'render_succeeded',
      userId: record.userId,
      renderId: record.id,
      metadata: { engine: record.engine, provider: record.provider, clip: job.clip ?? null },
    });
  }

  if (job.status === 'failed' && record.status !== 'failed') {
    recordEvent({
      type: 'render_failed',
      userId: record.userId,
      renderId: record.id,
      metadata: { engine: record.engine, provider: record.provider, error: job.error ?? null },
    });
  }

  void terminal;
  return updated ?? record;
}

function isRemote(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}
