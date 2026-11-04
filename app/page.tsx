import Link from 'next/link';
import { ClipShowcase } from '@/components/ClipShowcase';
import { SiteHeader } from '@/components/SiteHeader';
import { StarfieldCanvas } from '@/components/StarfieldCanvas';
import { isDemoMode } from '@/lib/env';
import { CLIPS, ENGINES, type ClipName } from '@/lib/engines/registry';
import { getDictionary } from '@/lib/i18n';
import styles from './page.module.css';

const SHOWCASE: readonly ClipName[] = (Object.keys(CLIPS) as ClipName[]).slice(0, 12);

const FEATURES = [
  {
    title: 'Real accounts, real history',
    body: 'Sign in with GitHub or as a guest. Every render is written to a database and comes back after a reload, a deploy or a new device.',
    tag: 'Auth.js + SQLite',
  },
  {
    title: 'Downloads and share links',
    body: 'Clips stream from the server with a proper filename. Sharing creates an unguessable link with its own preview card.',
    tag: 'Streaming + Open Graph',
  },
  {
    title: 'Analytics you can audit',
    body: 'Volume, engine mix, success rate and download counts are aggregated in SQL — the same numbers the API sees.',
    tag: 'SQL aggregation',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Pick a profile',
    body: 'Eight engine profiles, from cinematic long takes to short-form verticals.',
  },
  {
    step: '02',
    title: 'Describe the shot',
    body: 'Write a prompt in any of six languages; keywords choose the clip.',
  },
  {
    step: '03',
    title: 'Keep the result',
    body: 'Download the MP4, share a preview link, or find it later in your history.',
  },
];

/**
 * Public landing page.
 *
 * The studio itself lives at /studio behind auth; this page is the shop window
 * and stays useful for search engines and link previews.
 */
export default function HomePage() {
  const dictionary = getDictionary('en');

  return (
    <div className={styles.page}>
      <a className="skipLink" href="#main">
        {dictionary.skipToContent}
      </a>

      <div className={styles.backdrop} aria-hidden="true">
        <StarfieldCanvas />
      </div>

      <SiteHeader />

      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>
              <span className={styles.dot} aria-hidden="true" />
              {ENGINES.length} engine profiles · {Object.keys(CLIPS).length} clips · 6 languages
            </p>

            <h1 className={styles.title}>
              {dictionary.brand} <span className={styles.accent}>{dictionary.brandAccent}</span>
            </h1>

            <p className={styles.tagline}>{dictionary.tagline}</p>

            <div className={styles.ctaRow}>
              <Link href="/studio" className="btn btnPrimary">
                Open the studio
              </Link>
              <Link href="/login" className="btn">
                {dictionary.signIn}
              </Link>
            </div>

            {isDemoMode() ? (
              <p className={styles.demoNotice} role="note">
                {dictionary.demoNotice}
              </p>
            ) : null}
          </div>
        </section>

        <section className={`${styles.section} pageShell`} aria-labelledby="showcase-title">
          <div className={styles.sectionHead}>
            <h2 id="showcase-title" className={styles.sectionTitle}>
              A library, not a loop
            </h2>
            <p className={styles.sectionLead}>
              Demo renders route a prompt to one of {Object.keys(CLIPS).length} procedurally
              generated clips — desert light, neon rain, molten rock, storms, blossoms. All
              self-hosted, CC0, no third-party requests. Add a provider key and the same prompts go
              to a real text-to-video model instead.
            </p>
          </div>
          <ClipShowcase clips={SHOWCASE} />
        </section>

        <section className={`${styles.section} pageShell`} aria-labelledby="features-title">
          <div className={styles.sectionHead}>
            <h2 id="features-title" className={styles.sectionTitle}>
              The model is a setting, not the product
            </h2>
            <p className={styles.sectionLead}>
              Point the studio at fal.ai or Replicate with one environment variable and prompts
              become real generated video; with no key it renders bundled demo clips and labels them
              as such. Identity, persistence and delivery are always real.
            </p>
          </div>

          <ul className={styles.features}>
            {FEATURES.map((feature, index) => (
              <li
                key={feature.title}
                className={`${styles.feature} stagger`}
                style={{ ['--i' as string]: index }}
              >
                <span className={styles.featureTag}>{feature.tag}</span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureBody}>{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${styles.section} pageShell`} aria-labelledby="steps-title">
          <div className={styles.sectionHead}>
            <h2 id="steps-title" className={styles.sectionTitle}>
              Three steps
            </h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((item, index) => (
              <li
                key={item.step}
                className={`${styles.step} stagger`}
                style={{ ['--i' as string]: index }}
              >
                <span className={styles.stepNumber}>{item.step}</span>
                <div>
                  <h3 className={styles.stepTitle}>{item.title}</h3>
                  <p className={styles.stepBody}>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.band} pageShell`}>
          <div>
            <h2 className={styles.bandTitle}>Ready when you are</h2>
            <p className={styles.bandLead}>
              Guest access needs no account details. GitHub sign-in keeps your library.
            </p>
          </div>
          <Link href="/studio" className="btn btnPrimary">
            Start rendering
          </Link>
        </section>
      </main>

      <footer className={`${styles.footer} pageShell`}>
        <p>{dictionary.footer}</p>
        <nav className={styles.footerLinks} aria-label="Footer">
          <Link href="/studio">Studio</Link>
          <Link href="/history">History</Link>
          <Link href="/dashboard">Analytics</Link>
        </nav>
      </footer>

      <noscript>
        <p className={styles.noscript}>{dictionary.requiresJavaScript}</p>
      </noscript>
    </div>
  );
}
