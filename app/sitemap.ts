import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://humanidfi.com'
  const now = new Date().toISOString()

  const routes = [
    { path: '',                          priority: 1.0,  frequency: 'daily'   },
    { path: '/about',                    priority: 0.95, frequency: 'weekly'  },
    { path: '/ledger-chat',              priority: 0.95, frequency: 'daily'   },
    { path: '/sovereign-identity',       priority: 0.92, frequency: 'weekly'  },
    { path: '/qd-token',                 priority: 0.92, frequency: 'weekly'  },
    { path: '/studio-provenance',        priority: 0.90, frequency: 'weekly'  },
    { path: '/aztec-sequencer',          priority: 0.90, frequency: 'weekly'  },
    { path: '/status',                   priority: 0.88, frequency: 'always'  },
    { path: '/network',                  priority: 0.85, frequency: 'daily'   },
    { path: '/developers/api-docs',      priority: 0.85, frequency: 'weekly'  },
    { path: '/developers/sdk',           priority: 0.82, frequency: 'weekly'  },
    { path: '/developers/contracts',     priority: 0.80, frequency: 'monthly' },
    { path: '/legal/privacy',            priority: 0.75, frequency: 'monthly' },
    { path: '/legal/terms',              priority: 0.75, frequency: 'monthly' },
    { path: '/legal/security',           priority: 0.75, frequency: 'monthly' },
    { path: '/legal/ownership',          priority: 0.82, frequency: 'monthly' },
    { path: '/legal/dmca',               priority: 0.80, frequency: 'monthly' },
    { path: '/community',                priority: 0.70, frequency: 'weekly'  },
    { path: '/registry',                 priority: 0.65, frequency: 'weekly'  },
  ] as const;

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.frequency as MetadataRoute.Sitemap[number]['changeFrequency'],
    priority: route.priority,
  }))
}
