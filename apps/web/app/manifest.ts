import type { MetadataRoute } from 'next';

/** 웹앱 매니페스트(D44). 아이콘은 브랜드 폴더 README의 표대로 public/icons/에 둔다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '찾아줘 메디',
    short_name: '찾아줘 메디',
    description: '지금 문 연 병원·약국',
    start_url: '/',
    theme_color: '#12A588',
    background_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
