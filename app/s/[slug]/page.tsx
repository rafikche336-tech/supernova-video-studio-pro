import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { getRenderBySlug } from '@/db/renders';
import { getEngine } from '@/lib/engines/registry';
import { formatDateTime } from '@/lib/format';
import { renderSourceNote } from '@/lib/render/labels';
import { APP_NAME } from '@/lib/config';
import styles from './share.module.css';

export const dynamic = 'force-dynamic';

interface SharePageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Public share page.
 *
 * The OG/Twitter tags are generated per render, so pasting the link into a chat
 * produces a real preview card with the clip's poster rather than the site logo.
 * Private renders (never shared) are unreachable because there is no slug.
 */
export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = getRenderBySlug(slug);

  if (!record || record.status !== 'succeeded') {
    // Throwing here (rather than in the component) produces a real 404 status:
    // metadata resolves before the response body starts streaming, so the status
    // line is still writable.
    notFound();
  }

  const engine = getEngine(record.engine);
  const title = record.prompt.length > 68 ? `${record.prompt.slice(0, 65)}…` : record.prompt;
  const description = `A ${engine.name} render made with ${APP_NAME}.`;
  const image = record.posterUrl ?? '/og.png';

  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: {
      type: 'video.other',
      title,
      description,
      images: [{ url: image, width: 960, height: 540, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { slug } = await params;
  const record = getRenderBySlug(slug);

  if (!record || record.status !== 'succeeded' || !record.videoUrl) {
    notFound();
  }

  const engine = getEngine(record.engine);

  return (
    <>
      <SiteHeader />
      <main className={`pageShell withDock ${styles.page}`}>
        <article className={styles.card}>
          <div className={styles.media}>
            <video
              className={styles.video}
              src={record.videoUrl}
              poster={record.posterUrl ?? undefined}
              controls
              playsInline
              loop
              preload="metadata"
            >
              Your browser cannot play this clip.
            </video>
          </div>

          <div className={styles.body}>
            <p className={styles.eyebrow}>{engine.name} · shared clip</p>
            <h1 className={styles.prompt}>{record.prompt}</h1>
            <p className={styles.meta}>
              Rendered {formatDateTime(record.createdAt)} · {APP_NAME}
            </p>

            <div className={styles.actions}>
              <a className="btn btnPrimary" href={`/api/download/${record.id}`} download>
                Download MP4
              </a>
              <Link className="btn" href="/studio">
                Make your own
              </Link>
            </div>
          </div>
        </article>

        <p className={styles.note}>
          {renderSourceNote(record.provider) ??
            `${APP_NAME}: this clip was rendered in demo mode from a bundled library.`}{' '}
          This page, its download and its preview card are served from a real database.
        </p>
      </main>
    </>
  );
}
