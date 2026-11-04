import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { StudioWorkbench } from '@/components/StudioWorkbench';
import { listRecentForUser } from '@/db/renders';
import { isDemoMode } from '@/lib/env';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { toRenderJob } from '@/lib/render/serialize';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Generate a clip with any of the eight engine profiles and keep it in your history.',
};

/**
 * The workbench. Server-rendered shell + recent history; only the engine grid is
 * a client island. Signing out and back in returns you to the same place.
 */
export default async function StudioPage() {
  const user = await requireUser('/studio');
  const recent = listRecentForUser(user.id, 6).map(toRenderJob);

  return (
    <>
      <SiteHeader active="studio" />
      <main id="studio" className="withDock">
        <StudioWorkbench initialLocale={DEFAULT_LOCALE} demoMode={isDemoMode()} recent={recent} />
      </main>
    </>
  );
}
