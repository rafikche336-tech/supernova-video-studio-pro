'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CLIENT_POLL_TIMEOUT_MS, POLL_INTERVAL_MS } from '@/lib/config';
import type { EngineId } from '@/lib/engines/registry';
import type { RenderJob } from '@/lib/render/types';

export type RenderPhase = 'idle' | 'submitting' | 'rendering' | 'succeeded' | 'failed';

export interface RenderJobController {
  readonly phase: RenderPhase;
  readonly progress: number;
  readonly job: RenderJob | null;
  readonly error: string | null;
  readonly start: (prompt: string, engine: EngineId) => Promise<void>;
  readonly cancel: () => void;
  readonly reset: () => void;
}

interface JobResponse {
  job?: RenderJob;
  mode?: string;
  error?: string;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Drives one render job: POST, poll to completion, and expose a cancellable
 * state machine. The abort controller and run id make cancellation races
 * impossible, and nothing is written after unmount.
 */
export function useRenderJob(): RenderJobController {
  const [phase, setPhase] = useState<RenderPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const settle = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current += 1;
    setPhase('idle');
    setProgress(0);
    setJob(null);
    setError(null);
  }, []);

  const start = useCallback(async (prompt: string, engine: EngineId) => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    runIdRef.current += 1;
    const runId = runIdRef.current;

    const isStale = () => !mountedRef.current || runIdRef.current !== runId;

    setPhase('submitting');
    setProgress(0);
    setJob(null);
    setError(null);

    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ prompt, engine }),
        signal: controller.signal,
      });

      const created = await readJson<JobResponse>(response);

      if (!response.ok) {
        throw new Error(created.error ?? `The server rejected the request (${response.status}).`);
      }
      if (!created.job) {
        throw new Error('The render API returned an unexpected response.');
      }

      if (isStale()) return;

      let current = created.job;
      setJob(current);
      setProgress(current.progress);
      setPhase('rendering');

      const deadline = Date.now() + CLIENT_POLL_TIMEOUT_MS;

      while (current.status !== 'succeeded') {
        if (current.status === 'failed') {
          throw new Error(current.error ?? 'The render failed.');
        }
        if (Date.now() > deadline) {
          throw new Error('The render timed out. Please try again.');
        }

        await delay(POLL_INTERVAL_MS, controller.signal);
        if (isStale()) return;

        const pollResponse = await fetch(`/api/render/${encodeURIComponent(current.id)}`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const polled = await readJson<JobResponse>(pollResponse);

        if (!pollResponse.ok || !polled.job) {
          throw new Error(polled.error ?? `Lost track of the render (${pollResponse.status}).`);
        }

        current = polled.job;
        if (isStale()) return;

        setJob(current);
        setProgress(current.progress);
      }

      if (isStale()) return;
      setProgress(100);
      setPhase('succeeded');
    } catch (thrown) {
      // A cancellation is not a failure — the state was already reset.
      if (controller.signal.aborted || isStale()) return;

      setPhase('failed');
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }, []);

  return { phase, progress, job, error, start, cancel: settle, reset: settle };
}
