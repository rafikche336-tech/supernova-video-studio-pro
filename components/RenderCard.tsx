import Link from 'next/link';
import type { RenderRecord } from '@/db/renders';
import { getDictionary } from '@/lib/i18n';
import { formatDateTime, formatDuration } from '@/lib/format';
import { getEngine } from '@/lib/engines/registry';
import { providerShortLabel } from '@/lib/render/labels';
import { ShareButton } from './ShareButton';
import styles from './RenderCard.module.css';

export interface RenderCardProps {
  readonly render: RenderRecord;
  /** Index for the staggered entrance animation. */
  readonly index?: number;
}

const dictionary = getDictionary('en');

/**
 * One render in the library: poster, prompt, engine, and the real actions
 * (download, share). Server component — only the share button is interactive.
 */
export function RenderCard({ render, index = 0 }: RenderCardProps) {
  const engine = getEngine(render.engine);

  return (
    <article className={`${styles.card} stagger`} style={{ ['--i' as string]: index }}>
      <div className={styles.media}>
        {render.status === 'succeeded' && render.videoUrl ? (
          <video
            className={styles.video}
            src={render.videoUrl}
            poster={render.posterUrl ?? undefined}
            muted
            loop
            playsInline
            preload="none"
            aria-label={`${engine.name} render: ${render.prompt}`}
          />
        ) : (
          <div className={styles.placeholder} data-status={render.status}>
            {render.status === 'failed' ? '!' : '…'}
          </div>
        )}

        <span className={styles.badge} data-status={render.status}>
          {render.status}
        </span>
      </div>

      <div className={styles.body}>
        <p className={`${styles.prompt} truncate2`}>{render.prompt}</p>

        <p className={styles.meta}>
          <span className={styles.engine}>{engine.name}</span>
          {providerShortLabel(render.provider) ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{providerShortLabel(render.provider)}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(render.createdAt).toISOString()}>
            {formatDateTime(render.createdAt)}
          </time>
          {render.durationMs !== null ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatDuration(render.durationMs)}</span>
            </>
          ) : null}
        </p>

        {render.status === 'succeeded' ? (
          <div className={styles.actions}>
            <a
              className={`btn btnSmall ${styles.download}`}
              href={`/api/download/${render.id}`}
              download
            >
              {dictionary.download}
            </a>
            <ShareButton
              renderId={render.id}
              title={render.prompt}
              label={dictionary.share}
              copiedLabel={dictionary.shareCopied}
              compact
            />
            {render.shareSlug ? (
              <Link className={styles.shareLink} href={`/s/${render.shareSlug}`}>
                Public page
              </Link>
            ) : null}
          </div>
        ) : render.status === 'failed' ? (
          <p className={styles.error}>{render.error ?? 'This render failed.'}</p>
        ) : (
          <p className={styles.pending}>Rendering…</p>
        )}
      </div>
    </article>
  );
}
