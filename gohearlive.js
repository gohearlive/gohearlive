/* ============================================================
   Go Hear Live — Story Engine
   Single source of truth: stories.json
   Handles: homepage cards, drawer nav, recommendations, index
   ============================================================ */

const GHL = {

  stories: null,

  // Load stories from JSON — call once on page load
  async load() {
    if (this.stories) return this.stories;
    // Detect path depth for correct relative URL
    const depth = (window.location.pathname.match(/\//g) || []).length - 1;
    const base = depth > 1 ? '../' : '';
    try {
      const res = await fetch(`${base}stories.json`);
      const data = await res.json();
      this.stories = data.stories;
    } catch(e) {
      console.warn('GHL: could not load stories.json', e);
      this.stories = [];
    }
    return this.stories;
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
    // Same country
    if (source.country === candidate.country) score += 1;
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
  renderHomepageCards(containerId, excludeId = 1) {
    const el = document.getElementById(containerId);
    if (!el || !this.stories) return;
    const cards = this.stories.filter(s => s.id !== excludeId);
    el.innerHTML = cards.map(s => {
      const thumb = this.thumb(s);
      const thumbHtml = thumb
        ? `<img src="${thumb}" alt="${s.title}" onerror="this.parentElement.innerHTML='<div class=\\'card-novid-inner\\'><span class=\\'card-novid-label\\'>${s.city} · ${s.year}</span></div>'">`
        : '';
      const thumbClass = thumb ? 'card-thumb' : 'card-thumb card-thumb-novid';
      return `<div class="card">
        <div class="${thumbClass}">
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
  }

};
