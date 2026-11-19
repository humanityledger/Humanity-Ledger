# Landing page

## Two trees

`/` serves two trees, decided on the server per request (`lib/landing/device.ts`). Phones (a user agent
that parses as a mobile device, or `Sec-CH-UA-Mobile: ?1`) get the phone tree in
`components/landing/mobile`. Tablets, iPads and desktops get the immersive landing in
`components/landing/immersive`, which the phone tree never imports. Responses for `/` carry
`Vary: User-Agent, Sec-CH-UA-Mobile` and `Accept-CH: Sec-CH-UA-Mobile`, so no cache serves one tree to
the other (`middleware.ts`). On the phone tree the root layout mounts none of the app's fixed layers or
providers, and links into the app are full page loads.

The phone tree keeps these rules, and CI holds them (`test/unit/landing/mobile-tree.test.ts`,
`scripts/ui/landing-webkit.mjs`, `scripts/ui/mobile-budget.mjs`, `lighthouserc.mobile.json`):

- **Scrolling:** native scroll only. No scroll handler, no non-passive touch or wheel listener, no fixed body.
- **Layout:** sections in normal flow, with no pins. The only sticky element is a 56 px header that never
  changes size. Only the hero depends on the viewport (`min-height: 100svh`).
- **Motion:** one 240 ms reveal per section, on opacity and transform only, played once by a single
  IntersectionObserver. There is none with reduced motion.
- **Paint:** no filters, blend modes, large blurred shadows or animated gradients.
- **Media:**
  - The hero image is AVIF or WebP with `fetchpriority="high"`. Every other image is lazy.
  - Videos are short muted loops that play only while on screen. They never seek with the scroll, and
    there are none with Save-Data or reduced motion.
- **Below the fold:** every section uses `content-visibility: auto` with an intrinsic size close to its
  real one.
- **Budgets:**
  - JavaScript: 60 KB gzip, without the framework runtime.
  - CSS: 25 KB.
  - Hero image: 120 KB.
- **Copy:** all text comes from `lib/landing/content.ts`, as on desktop.
