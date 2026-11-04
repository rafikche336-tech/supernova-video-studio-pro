import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getEnv().NEXT_PUBLIC_SITE_URL;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The render API is not content, and account pages are private.
        disallow: ['/api/', '/history', '/dashboard', '/login', '/studio'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
