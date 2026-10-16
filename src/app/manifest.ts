import type { MetadataRoute } from 'next';
import { APP_NAME, SITE_NAME } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${SITE_NAME}`,
    short_name: APP_NAME,
    description: 'Site access and vehicle movements, recorded in thirty seconds.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e9ecef',
    theme_color: '#e9ecef',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
