import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APP_NAME } from '@/lib/config';
import { getEnv } from '@/lib/env';

const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL;

const description =
  'One studio for every engine: describe a shot, pick a profile, get video. Real text-to-video through fal.ai or Replicate, with a bundled demo renderer as the fallback.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — Multi-engine AI video studio`,
    template: `%s · ${APP_NAME}`,
  },
  description,
  applicationName: APP_NAME,
  authors: [{ name: 'SupernovaSolutionsHQ', url: 'https://github.com/rafikche336-tech' }],
  creator: 'SupernovaSolutionsHQ',
  keywords: ['AI video', 'text to video', 'Wan 2.2', 'Mochi 1', 'SVD', 'OpenShorts', 'Next.js'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: APP_NAME,
    title: `${APP_NAME} — Multi-engine AI video studio`,
    description,
    locale: 'en_US',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — gold-on-black studio interface`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Multi-engine AI video studio`,
    description,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#050507',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
