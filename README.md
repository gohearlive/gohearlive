# Go Hear Live — Website Files

Complete site deployable to GitHub Pages or any static host.

## Structure

```
/
├── index.html            Homepage (dynamic: rotating hero, rotating venue, pill filters)
├── about.html            About page + CC image credits
├── all-stories.html      Filterable story index
├── 404.html              Custom "Lost in the Crowd" error page
├── gohearlive.js         Engine (loads JSON, renders stories/venues/stickers)
├── stories.json          15 stories (the catalogue)
├── venues.json           15 venue metadata records
├── stickers.json         18 curated sticker records (edit this to add stickers)
├── favicon.svg           Stage-light favicon
├── sitemap.xml           For search engines
├── robots.txt            Points crawlers at sitemap
└── stories/              15 full story pages
    ├── alanis-zaphod-1995.html
    ├── alice-in-chains-central-saloon-1990.html
    ├── arc-angels-antones-1990.html
    ├── bowie-earls-court-1978.html
    ├── dylan-lesh-chicago-1999.html
    ├── further-festival-oob-1996.html
    ├── iggy-pop-olympia-1991.html
    ├── iron-maiden-ottawa-1992.html
    ├── mad-season-moore-1995.html
    ├── neil-young-pearl-jam-moes-1995.html
    ├── nirvana-foufounes-1991.html
    ├── nirvana-paramount-1991.html
    ├── urge-overkill-underworld-2004.html
    ├── van-morrison-bb-king-nola-2001.html
    └── walkmen-troubadour-2008.html
```

## Deploying

1. Commit everything to the gohearlive repo at the root level, matching the structure above
2. Push — GitHub Pages auto-deploys
3. Visit your site; use the browser console if anything looks wrong

## Adding content

**New story:**
- Drop the new story HTML into `stories/`
- Add its record to `stories.json` (band, year, venue, city, date, youtube, excerpt, genre, mood, decade, file)
- Add the venue to `venues.json` if it's not already there
- Regenerate `sitemap.xml` (or paste a new URL block manually — the pattern is obvious)

**New sticker:**
- Add a record to `stickers.json` with { label, sub, shape, palette, size, context }
- Shape: circle | rect | oval | shield
- Palette: use one of the 19 named presets in `gohearlive.js` (stickerPalettes)
- Context tags control where the sticker appears:
  - `"homepage"` → homepage wall
  - `"all-stories"` → every story page (universal decoration)
  - `"story:N"` → specific story by id
  - `"venue:Exact Venue Name"` → any page referencing that venue
  - `"city:Exact City"` → any page set in that city

## Known placeholders

- `/images/og-default.jpg` — referenced by the 3 story pages without YouTube videos
  (Alanis, Iron Maiden, Van Morrison). Create a 1200×630 image to replace the
  placeholder. Until then, those 3 stories will show a broken image in social shares.

## Notes on daily rotation

The homepage rotates two things deterministically by day-of-year:
- Featured story (hero)
- Venue Spotlight

Same date always produces the same pair — safe to share URLs within a day.
Rotation cycles through all 15 stories and all 15 venues over 15 days.
