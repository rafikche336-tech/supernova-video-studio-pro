import type { Metadata } from 'next';
import Link from 'next/link';
import { RenderCard } from '@/components/RenderCard';
import { SiteHeader } from '@/components/SiteHeader';
import { listRenders } from '@/db/renders';
import { ENGINES, isEngineId, type EngineId } from '@/lib/engines/registry';
import { formatCount } from '@/lib/format';
import { requireUser } from '@/lib/session';
import styles from './history.module.css';

export const metadata: Metadata = {
  title: 'History',
  description: 'Every clip you have rendered, with downloads and share links.',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 9;

function buildQuery(params: { q?: string; engine?: string; page?: number }): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.engine) search.set('engine', params.engine);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * The library. Filtering and paging happen in SQL and live in the URL, so a
 * filtered view is shareable and the back button behaves.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; engine?: string; page?: string }>;
}) {
  const user = await requireUser('/history');
  const params = await searchParams;

  const query = typeof params.q === 'string' ? params.q.slice(0, 120) : '';
  const engine: EngineId | undefined = isEngineId(params.engine) ? params.engine : undefined;
  const requestedPage = Number(params.page ?? '1');
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;

  const { items, total } = listRenders({
    userId: user.id,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    engine,
    search: query || undefined,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered = Boolean(query || engine);

  return (
    <>
      <SiteHeader active="history" />
      <main className={`pageShell withDock ${styles.page}`}>
        <header className={styles.head}>
          <div>
            <h1 className={styles.title}>History</h1>
            <p className={styles.lead}>
              {formatCount(total)} render{total === 1 ? '' : 's'}
              {isFiltered ? ' match your filters' : ' in your library'}. Downloads and share links
              stay available for as long as the deployment keeps its database.
            </p>
          </div>
        </header>

        <form className={styles.filters} method="get" role="search">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="q">
              Search prompts
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="e.g. neon city at night"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="engine">
              Engine
            </label>
            <select id="engine" name="engine" defaultValue={engine ?? ''} className={styles.input}>
              <option value="">All engines</option>
              {ENGINES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterActions}>
            <button type="submit" className="btn btnSmall">
              Apply
            </button>
            {isFiltered ? (
              <Link href="/history" className={styles.clear}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {isFiltered ? 'No renders match those filters.' : 'Your library is empty.'}
            </p>
            <p className={styles.emptyLead}>
              {isFiltered
                ? 'Try a broader search or clear the engine filter.'
                : 'Generate your first clip and it will show up here.'}
            </p>
            <Link href="/studio" className="btn btnPrimary btnSmall">
              Open the studio
            </Link>
          </div>
        ) : (
          <>
            <ul className={styles.grid}>
              {items.map((render, index) => (
                <li key={render.id}>
                  <RenderCard render={render} index={index} />
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <nav className={styles.pager} aria-label="Pagination">
                {page > 1 ? (
                  <Link
                    className="btn btnSmall"
                    href={`/history${buildQuery({ q: query, engine, page: page - 1 })}`}
                    rel="prev"
                  >
                    ← Newer
                  </Link>
                ) : (
                  <span className={styles.disabled}>← Newer</span>
                )}
                <span className={styles.pageCount}>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    className="btn btnSmall"
                    href={`/history${buildQuery({ q: query, engine, page: page + 1 })}`}
                    rel="next"
                  >
                    Older →
                  </Link>
                ) : (
                  <span className={styles.disabled}>Older →</span>
                )}
              </nav>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
