/* ============================================================
   Go Hear Live — Story Engine
   Single source of truth: stories.json
   Handles: homepage cards, drawer nav, recommendations, index
   ============================================================ */

const GHL = {

  stories: null,
  venues: null,
  stickers: null,

  // Load stories from JSON — call once on page load
  async load() {
    if (this.stories) return this.stories;
    // Detect path depth for correct relative URL
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const base = depth > 1 ? '../' : '';
    try {
      const res = await fetch(`${base}stories.json`);
      const data = await res.json();
      // stories.json is a flat array of story objects
      this.stories = Array.isArray(data) ? data : (data.stories || []);
    } catch(e) {
      console.warn('GHL: could not load stories.json', e);
      this.stories = [];
    }
    return this.stories;
  },

  // Load venue metadata from venues.json — optional, fails gracefully
  async loadVenues() {
    if (this.venues) return this.venues;
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const base = depth > 1 ? '../' : '';
    try {
      const res = await fetch(`${base}venues.json`);
      this.venues = await res.json();
    } catch(e) {
      console.warn('GHL: could not load venues.json', e);
      this.venues = {};
    }
    return this.venues;
  },

  // Get the current story based on the page filename
  current() {
    const file = window.location.pathname.split('/').pop();
    return this.stories ? this.stories.find(s => s.file.endsWith(file)) : null;
  },

  // Score story relevance against a source story (0–10)
  score(source, candidate) {
    if (source.id === candidate.id) return -1;
    let score = 0;
    // Shared genre tags
    const sharedGenre = source.genre.filter(g => candidate.genre.includes(g)).length;
    score += sharedGenre * 2;
    // Shared mood tags
    const sharedMood = source.mood.filter(m => candidate.mood.includes(m)).length;
    score += sharedMood * 2;
    // Same city
    if (source.city === candidate.city) score += 2;
    // Same decade
    if (source.decade === candidate.decade) score += 1;
    return score;
  },

  // Get N recommended stories for a given source story
  recommend(sourceId, n = 3) {
    const source = this.stories.find(s => s.id === sourceId);
    if (!source) return [];
    return this.stories
      .map(s => ({ story: s, score: this.score(source, s) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score || Math.random() - 0.5)
      .slice(0, n)
      .map(x => x.story);
  },

  // Thumb URL for a story
  thumb(story) {
    return story.youtube
      ? `https://img.youtube.com/vi/${story.youtube}/hqdefault.jpg`
      : null;
  },

  // Path prefix depending on whether we're in /stories/ or root
  pathTo(story) {
    const inStories = window.location.pathname.includes('/stories/');
    return inStories ? `../${story.file}` : story.file;
  },

  /* ── Renderers ── */

  // Render the hamburger drawer list
  renderDrawer(containerId) {
    const el = document.getElementById(containerId);
    if (!el || !this.stories) return;
    const current = this.current();
    el.innerHTML = this.stories.map(s => {
      const active = current && current.id === s.id ? ' active' : '';
      const href = this.pathTo(s);
      return `<a href="${href}" class="drawer-item${active}">
        <span class="drawer-num">${String(s.id).padStart(2,'0')}</span>
        <span class="drawer-info">
          <span class="drawer-title">${s.title}</span>
          <span class="drawer-band">${s.band} · ${s.venue} · ${s.year}</span>
        </span>
      </a>`;
    }).join('');
  },

  // Render recommendation cards
  renderRecommendations(containerId, sourceId) {
    const el = document.getElementById(containerId);
    if (!el || !this.stories) return;
    const recs = this.recommend(sourceId, 3);
    el.innerHTML = recs.map(s => {
      const thumb = this.thumb(s);
      const thumbHtml = thumb
        ? `<img src="${thumb}" alt="${s.title}">`
        : `<div class="sc-no-thumb">${s.band}</div>`;
      const href = this.pathTo(s);
      return `<a href="${href}" class="sc-card">
        <div class="sc-thumb">${thumbHtml}</div>
        <div class="sc-body">
          <div class="sc-num">${String(s.id).padStart(2,'0')}</div>
          <div class="sc-title">${s.title}</div>
          <div class="sc-band">${s.band}</div>
          <div class="sc-venue">${s.venue} · ${s.year}</div>
        </div>
      </a>`;
    }).join('');
  },

  // Render prev/next navigation
  renderPrevNext(containerId, sourceId) {
    const el = document.getElementById(containerId);
    if (!el || !this.stories) return;
    const idx = this.stories.findIndex(s => s.id === sourceId);
    const prev = this.stories[(idx - 1 + this.stories.length) % this.stories.length];
    const next = this.stories[(idx + 1) % this.stories.length];
    el.innerHTML = `
      <div class="pn-wrap">
        <a href="${this.pathTo(prev)}" class="pn-btn pn-prev">
          <span class="pn-arrow">←</span>
          <span class="pn-info">
            <span class="pn-label">Previous</span>
            <span class="pn-title">${prev.title}</span>
            <span class="pn-band">${prev.band}</span>
          </span>
        </a>
        <a href="${this.pathTo(next)}" class="pn-btn pn-next">
          <span class="pn-info" style="text-align:right">
            <span class="pn-label">Next</span>
            <span class="pn-title">${next.title}</span>
            <span class="pn-band">${next.band}</span>
          </span>
          <span class="pn-arrow">→</span>
        </a>
      </div>`;
  },

  // Render homepage story cards grid (all non-featured stories)
  // Optional opts: { excludeId: number (default 1), city: string (filter), emptyLabel: string }
  renderHomepageCards(containerId, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el || !this.stories) return;
    // Back-compat: if opts is a number, treat it as excludeId (old signature)
    if (typeof opts === 'number') opts = { excludeId: opts };
    const excludeId = opts.excludeId ?? 1;
    const city = opts.city || '';

    let cards = this.stories.filter(s => s.id !== excludeId);
    if (city) cards = cards.filter(s => s.city === city);

    if (!cards.length) {
      const label = opts.emptyLabel || (city ? `No stories from ${city} yet.` : 'No stories yet.');
      el.innerHTML = `<div style="padding:40px;color:var(--fog);font-family:'Cabin Condensed',sans-serif;font-size:12px;letter-spacing:.1em;">${label}</div>`;
      return;
    }

    el.innerHTML = cards.map(s => {
      const thumb = this.thumb(s);
      const thumbHtml = thumb
        ? `<img src="${thumb}" alt="${s.title}" onerror="this.parentElement.innerHTML='<div class=\\'card-novid-inner\\'><span class=\\'card-novid-label\\'>${s.city} · ${s.year}</span></div>'">`
        : '';
      const thumbClass = thumb ? 'card-thumb' : 'card-thumb card-thumb-novid';
      const clickAttr = thumb ? ` onclick="openModal('${s.youtube}')"` : '';
      return `<div class="card">
        <div class="${thumbClass}"${clickAttr}>
          ${thumbHtml}
          ${thumb ? `<div class="thumb-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>` : `<div class="card-novid-inner"><span class="card-novid-label">${s.city} · ${s.year}</span></div>`}
        </div>
        <div class="card-kicker">${s.band} <span class="vt">· ${s.venue} · ${s.year}</span></div>
        <h2 class="card-hl">${s.title}</h2>
        <p class="card-ex">${s.excerpt}</p>
        <a href="${s.file}" class="card-lnk">Read the full story →</a>
      </div>`;
    }).join('');
  },

  // Pick a venue for "Venue Spotlight" — deterministic by date so the page
  // feels intentional within a day, and rotates tomorrow. Only picks venues
  // that currently have at least one story.
  pickVenueOfDay() {
    if (!this.stories || !this.stories.length) return null;
    const venueNames = [...new Set(this.stories.map(s => s.venue))].sort();
    // Day-of-year index, wraps around the list
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    return venueNames[dayOfYear % venueNames.length];
  },

  // Pick a featured story for the homepage hero — same day-of-year approach
  // as pickVenueOfDay but offset by a prime so the hero and spotlight don't
  // cycle in lockstep. Returns the story object.
  pickFeaturedOfDay() {
    if (!this.stories || !this.stories.length) return null;
    const sorted = [...this.stories].sort((a, b) => a.id - b.id);
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    return sorted[(dayOfYear + 7) % sorted.length];
  },

  // Render the homepage hero from a story. The index.html hero block is
  // expected to have these IDs: heroMedia, heroMediaImg, heroCap, heroKicker,
  // heroTitle, heroDeck, heroReadLink. Video click uses openModal().
  renderFeatured(story) {
    if (!story) return;
    const mediaEl  = document.getElementById('heroMedia');
    const imgEl    = document.getElementById('heroMediaImg');
    const capEl    = document.getElementById('heroCap');
    const kickerEl = document.getElementById('heroKicker');
    const titleEl  = document.getElementById('heroTitle');
    const deckEl   = document.getElementById('heroDeck');
    const linkEl   = document.getElementById('heroReadLink');

    const thumb = this.thumb(story);

    if (imgEl) {
      if (thumb) { imgEl.src = thumb; imgEl.alt = `${story.band} at ${story.venue}`; imgEl.style.display = ''; }
      else       { imgEl.removeAttribute('src'); imgEl.style.display = 'none'; }
    }
    if (mediaEl) {
      if (thumb) mediaEl.setAttribute('onclick', `openModal('${story.youtube}')`);
      else       mediaEl.removeAttribute('onclick');
      mediaEl.style.cursor = thumb ? 'pointer' : 'default';
      // Hide the play ring if there's no video
      const playRing = mediaEl.querySelector('.hero-play');
      if (playRing) playRing.style.display = thumb ? '' : 'none';
    }
    if (capEl)    capEl.textContent    = `${story.date} · ${story.venue} · ${story.city}`;
    if (kickerEl) kickerEl.innerHTML   = `${story.band} <span>·</span> ${story.venue} <span>·</span> ${story.city}`;
    if (titleEl)  titleEl.textContent  = story.title;
    if (deckEl)   deckEl.textContent   = story.excerpt;
    if (linkEl)   linkEl.setAttribute('href', story.file);
  },

  // Render the rotating venue spotlight. Expects a container with the layout
  // from index.html (.venue-plate on one side, story list on the other).
  // Element IDs it writes to:
  //   venueEye, venueName, venueLoc, venueRows, venueStoryList, venueStoryTitle
  renderVenueSpotlight(containerId, venueName) {
    const container = document.getElementById(containerId);
    if (!container || !this.stories) return;

    const name = venueName || this.pickVenueOfDay();
    if (!name) return;

    const meta = (this.venues && this.venues[name]) || {};
    const city = meta.city || (this.stories.find(s => s.venue === name) || {}).city || '';

    // Populate venue plate
    const eye = document.getElementById('venueEye');
    const nameEl = document.getElementById('venueName');
    const locEl = document.getElementById('venueLoc');
    const rowsEl = document.getElementById('venueRows');

    if (eye) eye.textContent = `Venue Spotlight · ${city}${meta.neighbourhood ? ', ' + meta.neighbourhood : ''}`;
    if (nameEl) nameEl.textContent = name;
    if (locEl) {
      const parts = [];
      if (meta.address) parts.push(meta.address);
      if (meta.opened) parts.push(`Est. ${meta.opened}`);
      locEl.textContent = parts.join(' · ');
    }
    if (rowsEl) {
      const rowHtml = (label, value) => value
        ? `<div class="vp-row"><span>${label}</span><span class="v">${value}</span></div>`
        : '';
      rowsEl.innerHTML = [
        rowHtml('Capacity', meta.capacity),
        rowHtml('Opened', meta.opened),
        rowHtml('Architect', meta.architect),
        rowHtml('Built by', meta.builtBy),
        rowHtml('Status', meta.status)
      ].filter(Boolean).join('');
    }

    // Story list — every story from this venue
    const venueStories = this.stories.filter(s => s.venue === name);
    const listEl = document.getElementById('venueStoryList');
    const titleEl = document.getElementById('venueStoryTitle');
    const subEl = document.getElementById('venueStorySub');
    if (titleEl) titleEl.textContent = venueStories.length > 1
      ? 'Stories from this venue'
      : 'From this venue';
    if (subEl) subEl.textContent = `${name} · ${city}`;
    if (listEl) {
      listEl.innerHTML = venueStories.map((s, i) => `
        <li class="vl-item" onclick="location.href='${this.pathTo(s)}'">
          <div class="vl-num">${String(i + 1).padStart(2, '0')}</div>
          <div class="vl-txt">
            <div class="vl-band">${s.band}</div>
            <div class="vl-date">${s.date} · ${s.title}</div>
          </div>
          <div class="vl-arr">→</div>
        </li>
      `).join('');
    }
  },

  // Render the full story index page
  renderIndex(containerId, filters = {}) {
    const el = document.getElementById(containerId);
    if (!el || !this.stories) return;
    let stories = this.stories;
    if (filters.city) stories = stories.filter(s => s.city === filters.city);
    if (filters.decade) stories = stories.filter(s => s.decade === filters.decade);
    if (filters.genre) stories = stories.filter(s => s.genre.includes(filters.genre));
    if (filters.mood) stories = stories.filter(s => s.mood.includes(filters.mood));
    el.innerHTML = stories.map(s => {
      const thumb = this.thumb(s);
      const thumbHtml = thumb
        ? `<img src="${thumb}" alt="${s.title}">`
        : `<div class="idx-no-thumb">${s.city} · ${s.year}</div>`;
      return `<a href="${s.file}" class="idx-card">
        <div class="idx-thumb">${thumbHtml}</div>
        <div class="idx-body">
          <div class="idx-meta">${s.city} · ${s.decade}</div>
          <div class="idx-title">${s.title}</div>
          <div class="idx-band">${s.band}</div>
          <div class="idx-tags">
            ${s.mood.map(m => `<span class="idx-tag">${m}</span>`).join('')}
          </div>
        </div>
      </a>`;
    }).join('');
  },

  // ─── Sticker engine ──────────────────────────────────────────────────

  // Palette presets — bg (fill), accent (inner stroke/sub), text (label color)
  stickerPalettes: {
    'nirvana':     { bg:'#1a1a2e', accent:'#4444aa', text:'#e8e0c0' },
    'pearl-jam':   { bg:'#1a0a00', accent:'#c84400', text:'#f0d080' },
    'aic':         { bg:'#0a1a0a', accent:'#448844', text:'#d0e0d0' },
    'soundgarden': { bg:'#180808', accent:'#aa2222', text:'#e0c8a0' },
    'mad-season':  { bg:'#0a0a1a', accent:'#446688', text:'#c8d0e0' },
    'neil-young':  { bg:'#140c00', accent:'#c87020', text:'#f0d4a0' },
    'dead':        { bg:'#0a0a18', accent:'#cc2222', text:'#f0e0a0' },
    'dylan':       { bg:'#18140a', accent:'#aa7722', text:'#e8dcb0' },
    'bowie':       { bg:'#0a0a12', accent:'#cc3344', text:'#d4dceb' },
    'stooges':     { bg:'#100a08', accent:'#aa2200', text:'#e8d8c0' },
    'maiden':      { bg:'#0a0a0a', accent:'#cc0000', text:'#e8e8e8' },
    'sub-pop':     { bg:'#cc0000', accent:'#ffffff', text:'#ffffff' },
    'marquee':     { bg:'#0a0808', accent:'#d4aa50', text:'#d4aa50' },
    'punk':        { bg:'#080808', accent:'#cccccc', text:'#ffffff' },
    'blues':       { bg:'#080818', accent:'#4466aa', text:'#c8d0e8' },
    'troubadour':  { bg:'#1a1408', accent:'#c89020', text:'#f0e0a0' },
    'kurt':        { bg:'#08101a', accent:'#4466aa', text:'#e0e8f0' },
    'universal':   { bg:'#080e08', accent:'#448844', text:'#d0e8d0' },
    'default':     { bg:'#141008', accent:'#c45a10', text:'#e8d9b8' }
  },

  // Map size keyword to radius / dimensions
  stickerSize(shape, size) {
    const s = size || 'md';
    if (shape === 'circle') {
      return { r: s === 'sm' ? 40 : s === 'lg' ? 54 : 46 };
    }
    if (shape === 'rect') {
      const w = s === 'sm' ? 100 : s === 'lg' ? 140 : 120;
      const h = s === 'sm' ? 42   : s === 'lg' ? 52  : 46;
      return { w, h };
    }
    if (shape === 'oval') {
      const rx = s === 'sm' ? 66 : s === 'lg' ? 80 : 72;
      const ry = s === 'sm' ? 32 : s === 'lg' ? 40 : 36;
      return { rx, ry };
    }
    if (shape === 'shield') {
      const w = s === 'sm' ? 68 : s === 'lg' ? 90 : 78;
      const h = s === 'sm' ? 84 : s === 'lg' ? 106 : 94;
      return { w, h };
    }
    return {};
  },

  // HTML/SVG-escape helper — every user-visible string passes through this
  stickerEscape(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Build a sticker SVG from a sticker record
  makeStickerSVG(sticker) {
    const palette = this.stickerPalettes[sticker.palette] || this.stickerPalettes.default;
    const bg     = palette.bg;
    const accent = palette.accent;
    const text   = palette.text;
    const label  = this.stickerEscape(sticker.label || '');
    const sub    = this.stickerEscape(sticker.sub || '');
    const dims   = this.stickerSize(sticker.shape, sticker.size);

    // Typography sizing tuned to label length
    const labelLen = String(sticker.label || '').length;

    if (sticker.shape === 'circle') {
      const r = dims.r;
      const labelSize = labelLen > 14 ? 7.5 : (r > 48 ? 9 : 8);
      return `<svg width="${r*2}" height="${r*2}" viewBox="0 0 ${r*2} ${r*2}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${r}" cy="${r}" r="${r-1}" fill="${bg}" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="${r}" cy="${r}" r="${r-6}" fill="none" stroke="${accent}" stroke-width="0.8" stroke-dasharray="3,3"/>
        <text x="${r}" y="${r+1}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black,sans-serif" font-size="${labelSize}" font-weight="900" letter-spacing="1.4" fill="${text}">${label}</text>
        <text x="${r}" y="${r+13}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Narrow,sans-serif" font-size="6.5" font-weight="700" letter-spacing="1.8" fill="${accent}">${sub}</text>
      </svg>`;
    }
    if (sticker.shape === 'rect') {
      const w = dims.w, h = dims.h;
      const labelSize = labelLen > 18 ? 7.5 : 10;
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="${w-2}" height="${h-2}" rx="3" fill="${bg}" stroke="${accent}" stroke-width="2"/>
        <rect x="4" y="4" width="${w-8}" height="${h-8}" rx="1" fill="none" stroke="${accent}" stroke-width="0.6" opacity="0.35"/>
        <text x="${w/2}" y="${h/2-4}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black,sans-serif" font-size="${labelSize}" font-weight="900" letter-spacing="1.4" fill="${text}">${label}</text>
        <text x="${w/2}" y="${h/2+9}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Narrow,sans-serif" font-size="7" font-weight="700" letter-spacing="1.5" fill="${text}" opacity="0.6">${sub}</text>
      </svg>`;
    }
    if (sticker.shape === 'oval') {
      const rx = dims.rx, ry = dims.ry;
      const labelSize = labelLen > 14 ? 7.5 : 9;
      return `<svg width="${rx*2}" height="${ry*2}" viewBox="0 0 ${rx*2} ${ry*2}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="${rx}" cy="${ry}" rx="${rx-2}" ry="${ry-2}" fill="${bg}" stroke="${accent}" stroke-width="2"/>
        <ellipse cx="${rx}" cy="${ry}" rx="${rx-7}" ry="${ry-7}" fill="none" stroke="${accent}" stroke-width="0.7" stroke-dasharray="2,3"/>
        <text x="${rx}" y="${ry-3}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black,sans-serif" font-size="${labelSize}" font-weight="900" letter-spacing="1.2" fill="${text}">${label}</text>
        <text x="${rx}" y="${ry+10}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Narrow,sans-serif" font-size="7" font-weight="700" letter-spacing="1.8" fill="${accent}">${sub}</text>
      </svg>`;
    }
    if (sticker.shape === 'shield') {
      const w = dims.w, h = dims.h;
      const p = `M${w/2},${h-4} L4,${h*0.45} L4,8 Q${w/2},4 ${w-4},8 L${w-4},${h*0.45} Z`;
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <path d="${p}" fill="${bg}" stroke="${accent}" stroke-width="2.5"/>
        <text x="${w/2}" y="${h*0.38}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Black,sans-serif" font-size="10" font-weight="900" letter-spacing="1.2" fill="${text}">${label}</text>
        <text x="${w/2}" y="${h*0.56}" text-anchor="middle" dominant-baseline="middle" font-family="Arial Narrow,sans-serif" font-size="7" font-weight="700" letter-spacing="1.5" fill="${accent}">${sub}</text>
      </svg>`;
    }
    return '';
  },

  // Load stickers.json — fails gracefully if absent
  async loadStickers() {
    if (this.stickers) return this.stickers;
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const base = depth > 1 ? '../' : '';
    try {
      const res = await fetch(`${base}stickers.json`);
      const data = await res.json();
      this.stickers = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('GHL: could not load stickers.json', e);
      this.stickers = [];
    }
    return this.stickers;
  },

  // Filter stickers matching any of the given context tags (e.g. ["homepage"],
  // or ["story:4", "venue:The Central Saloon", "city:Seattle"]). Returns []
  // if stickers haven't loaded or nothing matches.
  stickersForContext(context) {
    if (!this.stickers || !this.stickers.length) return [];
    const ctx = Array.isArray(context) ? context : [context];
    return this.stickers.filter(st => {
      const sctx = Array.isArray(st.context) ? st.context : [];
      return sctx.some(tag => ctx.includes(tag));
    });
  },

  // Render a sticker wall into the given container. Context is either a
  // string ("homepage") or array of tags ("story:4", "city:Seattle", etc.).
  // Options: { count: total sticker instances to scatter (default 80),
  //            tapeMarks: decorative tape pieces (default 18),
  //            topGutter: pixels from top to keep sticker-free (default 0) }
  renderStickerWall(containerId, context, options) {
    const wall = document.getElementById(containerId);
    if (!wall) return;
    const opts = options || {};
    const count = opts.count || 80;
    const tapeMarks = opts.tapeMarks || 18;
    const topGutter = opts.topGutter || 0;

    // Clear any existing
    wall.innerHTML = '';

    const pool = this.stickersForContext(context);
    if (!pool.length) return;  // no stickers match — leave wall empty

    const W = window.innerWidth;
    const H = Math.max(window.innerHeight, document.body.scrollHeight, 3000);
    wall.style.height = H + 'px';

    // Usable vertical range excludes the top gutter (typically the hero zone)
    const yMin = topGutter;
    const yMax = Math.max(yMin + 300, H - 100);  // guarantee at least some space

    for (let i = 0; i < count; i++) {
      const sticker = pool[Math.floor(Math.random() * pool.length)];
      const rot = (Math.random() - 0.5) * 56;
      const opacity = 0.22 + Math.random() * 0.45;
      const worn = Math.random() > 0.5;
      const scale = 0.6 + Math.random() * 0.7;
      const x = Math.random() * (W - 180);
      const y = yMin + Math.random() * (yMax - yMin);

      const el = document.createElement('div');
      el.className = 'sticker';
      el.style.cssText = `position:absolute; left:${x}px; top:${y}px; transform:rotate(${rot}deg) scale(${scale}); opacity:${opacity}; line-height:1; user-select:none; filter:drop-shadow(1px 2px 5px rgba(0,0,0,0.8))${worn ? ' saturate(0.5) contrast(0.82) blur(0.25px)' : ''};`;
      el.innerHTML = this.makeStickerSVG(sticker);
      wall.appendChild(el);
    }

    // Decorative tape marks for texture — also respect the top gutter
    for (let i = 0; i < tapeMarks; i++) {
      const t = document.createElement('div');
      const w = 40 + Math.random() * 80;
      const tapeY = yMin + Math.random() * (yMax - yMin);
      t.style.cssText = `position:absolute; left:${Math.random()*W}px; top:${tapeY}px; width:${w}px; height:${5+Math.random()*8}px; background:rgba(220,200,150,.05); transform:rotate(${(Math.random()-.5)*90}deg); border-radius:1px;`;
      wall.appendChild(t);
    }
  }

};
