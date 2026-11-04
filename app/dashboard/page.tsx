import type { Metadata } from 'next';
import Link from 'next/link';
import { DailyBars, EngineBars, Meter } from '@/components/Charts';
import { SiteHeader } from '@/components/SiteHeader';
import { getAnalytics } from '@/lib/analytics';
import { formatCount, formatDuration } from '@/lib/format';
import { requireUser } from '@/lib/session';
import styles from './dashboard.module.css';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Your render volume, engine mix, success rate and share activity.',
  robots: { index: false, follow: false },
};

interface TileProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly index: number;
}

function Tile({ label, value, hint, index }: TileProps) {
  return (
    <li className={`${styles.tile} stagger`} style={{ ['--i' as string]: index }}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {hint ? <span className={styles.tileHint}>{hint}</span> : null}
    </li>
  );
}

/**
 * Analytics dashboard. Every number is aggregated in SQL from `renders` and
 * `events` — nothing here is decorative.
 */
export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  const data = getAnalytics(user.id);
  const { personal, platform, daily, engines } = data;

  const windowTotal = daily.reduce((sum, point) => sum + point.total, 0);
  const busiest = daily.reduce<(typeof daily)[number] | null>(
    (best, point) => (best === null || point.total > best.total ? point : best),
    null,
  );

  return (
    <>
      <SiteHeader active="dashboard" />
      <main className={`pageShell withDock ${styles.page}`}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.lead}>
              Last {data.windowDays} days, live from the database. Personal numbers are scoped to
              your account; platform numbers cover this deployment.
            </p>
          </div>
          <Link href="/studio" className="btn btnPrimary btnSmall">
            New render
          </Link>
        </header>

        <ul className={styles.tiles}>
          <Tile
            index={0}
            label="Renders"
            value={formatCount(personal.renders)}
            hint={`${formatCount(windowTotal)} in the last ${data.windowDays} days`}
          />
          <Tile
            index={1}
            label="Success rate"
            value={`${personal.successRate}%`}
            hint={`${formatCount(personal.succeeded)} succeeded · ${formatCount(personal.failed)} failed`}
          />
          <Tile
            index={2}
            label="Avg render time"
            value={formatDuration(personal.avgDurationMs)}
            hint="From job creation to finished clip"
          />
          <Tile
            index={3}
            label="Downloads"
            value={formatCount(personal.downloads)}
            hint={`${formatCount(personal.shares)} share links created`}
          />
        </ul>

        <div className={styles.panels}>
          <section className={`${styles.panel} ${styles.panelWide}`} aria-labelledby="volume-title">
            <div className={styles.panelHead}>
              <h2 id="volume-title" className={styles.panelTitle}>
                Render volume
              </h2>
              <span className={styles.panelMeta}>
                {busiest && busiest.total > 0
                  ? `Busiest day: ${busiest.total} renders`
                  : 'No renders yet'}
              </span>
            </div>
            <DailyBars
              points={daily}
              caption={`Renders per day over the last ${data.windowDays} days`}
            />
          </section>

          <section className={styles.panel} aria-labelledby="mix-title">
            <div className={styles.panelHead}>
              <h2 id="mix-title" className={styles.panelTitle}>
                Engine mix
              </h2>
            </div>
            <EngineBars slices={engines} />
          </section>

          <section className={styles.panel} aria-labelledby="quality-title">
            <div className={styles.panelHead}>
              <h2 id="quality-title" className={styles.panelTitle}>
                Render quality
              </h2>
            </div>
            <p className={styles.bigNumber}>{personal.successRate}%</p>
            <Meter value={personal.successRate} label="Successful renders" />
            <p className={styles.panelNote}>
              {personal.renders === 0
                ? 'Generate a clip to start collecting data.'
                : `${formatCount(personal.succeeded)} finished, ${formatCount(personal.failed)} failed.`}
            </p>
          </section>

          <section className={styles.panel} aria-labelledby="platform-title">
            <div className={styles.panelHead}>
              <h2 id="platform-title" className={styles.panelTitle}>
                This deployment
              </h2>
            </div>
            <dl className={styles.stats}>
              <div>
                <dt>Total renders</dt>
                <dd>{formatCount(platform.renders)}</dd>
              </div>
              <div>
                <dt>Accounts</dt>
                <dd>{formatCount(platform.users)}</dd>
              </div>
              <div>
                <dt>Renders today</dt>
                <dd>{formatCount(platform.rendersToday)}</dd>
              </div>
              <div>
                <dt>Clips in library</dt>
                <dd>{formatCount(platform.clips)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}
