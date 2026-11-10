import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/chat/', '/settings/', '/scan/'],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'Anthropic-ai', 'PerplexityBot', 'CCBot', 'grok', 'Grok'],
        allow: ['/llms.txt', '/'],
        disallow: ['/admin/', '/api/', '/chat/', '/settings/', '/scan/'],
      }
    ],
    sitemap: 'https://ledgerchat.org/sitemap.xml',
  }
}
