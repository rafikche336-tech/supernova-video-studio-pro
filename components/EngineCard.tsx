'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRenderJob } from '@/hooks/useRenderJob';
import type { EngineDefinition } from '@/lib/engines/registry';
import type { Dictionary, Locale } from '@/lib/i18n';
import { VideoPreview } from './VideoPreview';
import styles from './EngineCard.module.css';

export interface EngineCardProps {
  readonly engine: EngineDefinition;
  readonly dictionary: Dictionary;
  readonly locale: Locale;
}

/**
 * One engine card: prompt form, live job status, result preview and download.
 *
 * Accessibility notes: the header is a real `<button>` with
 * `aria-expanded`/`aria-controls`, the prompt has a real `<label>`, and status
 * changes are announced through a polite live region. v1 used a clickable
 * `<div>` that keyboard users could not open at all.
 */
export function EngineCard({ engine, dictionary, locale }: EngineCardProps) {
  const [prompt, setPrompt] = useState('');
  const [expanded, setExpanded] = useState(false);

  const panelId = useId();
  const promptId = useId();
  const summaryId = useId();

  const job = useRenderJob();

  const trimmedPrompt = prompt.trim();
  const isBusy = job.phase === 'submitting' || job.phase === 'rendering';
  const canSubmit = trimmedPrompt.length > 0 && !isBusy;
  const videoUrl = job.job?.videoUrl;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    void job.start(trimmedPrompt, engine.id);
  };

  return (
    <article className={styles.card} data-expanded={expanded || undefined}>
      <h3 className={styles.heading}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-describedby={summaryId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className={styles.icon} aria-hidden="true">
            {engine.icon}
          </span>
          <span className={styles.titles}>
            <span className={styles.tag}>{engine.tag}</span>
            <span className={styles.name}>{engine.name}</span>
          </span>
          <span className={styles.marker} aria-hidden="true">
            {expanded ? '−' : '+'}
          </span>
        </button>
      </h3>

      <p id={summaryId} className="srOnly">
        {engine.summary}
      </p>

      <div id={panelId} className={styles.panel} hidden={!expanded}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor={promptId}>
            {dictionary.promptLabel}
          </label>
          <textarea
            id={promptId}
            className={styles.textarea}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={dictionary.promptPlaceholder}
            lang={locale}
            maxLength={400}
            rows={3}
            disabled={isBusy}
          />

          <div className={styles.actions}>
            <button type="submit" className={styles.generate} disabled={!canSubmit}>
              {isBusy ? dictionary.generating : dictionary.generate}
            </button>

            {isBusy ? (
              <button type="button" className={styles.secondary} onClick={job.cancel}>
                {dictionary.cancel}
              </button>
            ) : null}
          </div>
        </form>

        <div className={styles.status} role="status" aria-live="polite">
          {job.phase === 'rendering' ? (
            <div
              className={styles.progress}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={job.progress}
              aria-label={dictionary.progress}
            >
              <span className={styles.progressBar} style={{ width: `${job.progress}%` }} />
            </div>
          ) : null}

          {job.phase === 'succeeded' ? <p className={styles.ready}>✓ {dictionary.ready}</p> : null}

          {job.phase === 'failed' ? (
            <div className={styles.failed}>
              <p className={styles.errorText}>{dictionary.failed}</p>
              {job.error ? <p className={styles.errorDetail}>{job.error}</p> : null}
              <button type="button" className={styles.secondary} onClick={job.reset}>
                {dictionary.retry}
              </button>
            </div>
          ) : null}
        </div>

        {job.phase === 'succeeded' && videoUrl ? (
          <div className={styles.result}>
            <VideoPreview
              src={videoUrl}
              poster={job.job?.posterUrl}
              alt={job.job?.videoAlt ?? engine.name}
              fallbackText={dictionary.videoUnsupported}
            />
            <a className={styles.download} href={videoUrl} download={`supernova-${engine.id}.mp4`}>
              {dictionary.download}
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}
