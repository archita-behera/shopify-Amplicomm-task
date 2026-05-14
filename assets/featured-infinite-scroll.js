/**
 * Featured Collection Infinite Scroll
 * ─────────────────────────────────────────────────────────────
 * FEATURED MODE (no sort/filter):
 *   1. Fetch ALL tagged-"featured" products → render at top
 *   2. Infinite scroll loads non-featured in batches of 20
 *   3. De-dup via Set — featured never appear again
 *
 * NORMAL MODE (sort or filter active):
 *   - Standard paginated infinite scroll, no pinning
 * ─────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── Read globals set by Liquid ── */
  const HANDLE   = window.COLLECTION_HANDLE || '';
  const MODE     = window.COLLECTION_MODE   || 'featured';
  const SORT     = window.CURRENT_SORT      || '';
  const TAG      = 'featured';
  const PER_PAGE = 20;

  /* ── State ── */
  const seen   = new Set();   // product IDs already in DOM
  let nfPage   = 1;           // next non-featured page to fetch
  let loading  = false;
  let done     = false;

  // Normal mode pagination
  let normalPage = (window.FC_CURRENT_PAGE || 1);

  /* ── DOM ── */
  const grid    = document.getElementById('fc-product-grid');
  const featSec = document.getElementById('fc-featured-section');
  const regSec  = document.getElementById('fc-regular-section');
  const spinner = document.getElementById('fc-spinner');
  const noMore  = document.getElementById('fc-no-more');
  const trigger = document.getElementById('fc-trigger');

  /* ── Boot ── */
  if (MODE === 'featured') {
    bootFeatured();
  } else {
    bootNormal();
  }

  /* ════════════════════════════════════════════════════════════
     FEATURED MODE
  ════════════════════════════════════════════════════════════ */

  async function bootFeatured() {
    show(spinner);

    /* 1 — Grab every featured product (handles >250 via looping) */
    const featured = await fetchAllByTag(TAG);

    /* 2 — Render featured section label + cards */
    if (featured.length > 0) {
      appendLabel('⭐ Featured Products', featSec);
      renderCards(featured, featSec, true);
    }

    /* 3 — Fill remainder of first "page" with non-featured */
    const need = Math.max(0, PER_PAGE - featured.length);
    if (need > 0) {
      await loadNonFeatured(need);
    }

    hide(spinner);
    observeTrigger();
  }

  /* Fetch ALL products with a specific tag (paginates if >250) */
  async function fetchAllByTag(tag) {
    const all = [];
    let page = 1;

    while (true) {
      const url =
        `/collections/${HANDLE}/products.json` +
        `?tag=${encodeURIComponent(tag)}&limit=250&page=${page}`;
      const { products = [] } = await getJSON(url);

      products.forEach(p => { seen.add(p.id); });
      all.push(...products);

      if (products.length < 250) break;
      page++;
    }
    return all;
  }

  /* Load `limit` non-featured products, skipping anything in `seen` */
  async function loadNonFeatured(limit = PER_PAGE) {
    if (loading || done) return;
    loading = true;
    show(spinner);

    const batch = [];

    while (batch.length < limit) {
      const url =
        `/collections/${HANDLE}/products.json` +
        `?limit=${PER_PAGE}&page=${nfPage}` +
        (SORT ? `&sort_by=${SORT}` : '');

      const { products = [] } = await getJSON(url);

      if (products.length === 0) { done = true; break; }

      for (const p of products) {
        if (!seen.has(p.id)) {
          /* extra safety: skip if tagged featured (already at top) */
          const tags = Array.isArray(p.tags)
            ? p.tags
            : (p.tags || '').split(',').map(t => t.trim());
          if (tags.includes(TAG)) {
            seen.add(p.id); // mark seen, don't render again
          } else {
            batch.push(p);
          }
        }
      }

      nfPage++;
      if (products.length < PER_PAGE) { done = true; break; }
      if (nfPage > 1000) { done = true; break; } // hard safety cap
    }

    /* Add "Regular Products" label once, before first batch */
    if (batch.length > 0 && regSec && !regSec.dataset.labeled) {
      appendLabel('All Products', regSec);
      regSec.dataset.labeled = '1';
    }

    renderCards(batch.slice(0, limit), regSec, false);

    hide(spinner);
    loading = false;

    if (done) showNoMore();
  }

  /* ════════════════════════════════════════════════════════════
     NORMAL MODE  (sort / filter active — no pinning)
  ════════════════════════════════════════════════════════════ */

  function bootNormal() {
    /* Mark already-rendered cards as seen */
    document.querySelectorAll('#fc-product-grid .fc-card').forEach(el => {
      if (el.dataset.id) seen.add(Number(el.dataset.id));
    });
    observeTrigger();
  }

  async function loadNormalPage() {
    if (loading || done) return;
    loading = true;
    show(spinner);

    normalPage++;

    /* Build URL preserving current filters & sort */
    const base = new URL(window.location.href);
    base.searchParams.set('page', normalPage);
    base.searchParams.set('section_id', 'custom-featured-collection');

    try {
      const html = await fetch(base.toString()).then(r => r.text());
      const doc  = new DOMParser().parseFromString(html, 'text/html');
      const cards = doc.querySelectorAll('#fc-product-grid .fc-card');

      if (cards.length === 0) {
        done = true;
        showNoMore();
      } else {
        cards.forEach(card => {
          const id = Number(card.dataset.id);
          if (!seen.has(id)) {
            seen.add(id);
            grid.appendChild(card);
          }
        });
      }
    } catch (e) {
      console.error('[FC] Normal page load error:', e);
      normalPage--; // allow retry
    }

    hide(spinner);
    loading = false;
  }

  /* ════════════════════════════════════════════════════════════
     RENDER HELPERS
  ════════════════════════════════════════════════════════════ */

  function renderCards(products, container, isFeatured) {
    if (!products.length) return;
    const frag = document.createDocumentFragment();

    products.forEach(p => {
      if (seen.has(p.id)) return;
      seen.add(p.id);
      frag.appendChild(buildCard(p, isFeatured));
    });

    (container || grid).appendChild(frag);
  }

  function buildCard(p, isFeatured) {
    const div  = document.createElement('div');
    div.className  = 'fc-card';
    div.dataset.id = p.id;

    /* Best quality image at 400px wide */
    const rawSrc = p.images?.[0]?.src || '';
    const imgSrc = rawSrc
      ? rawSrc.replace(/(\.[a-z]+)(\?|$)/i, '_400x$1$2')
      : '';

    /* Price: Shopify returns cents as string */
    const cents = p.variants?.[0]?.price || '0';
    const price = '₹' + (parseFloat(cents)).toFixed(2);

    div.innerHTML = `
      <a href="/products/${esc(p.handle)}" class="fc-card-img-wrap">
        ${imgSrc
          ? `<img src="${esc(imgSrc)}" alt="${esc(p.title)}" loading="lazy">`
          : `<div class="fc-no-img">No Image</div>`}
      </a>
      <div class="fc-card-body">
        ${isFeatured ? '<span class="fc-badge">⭐ Featured</span>' : ''}
        <div class="fc-card-title">
          <a href="/products/${esc(p.handle)}">${esc(p.title)}</a>
        </div>
        <div class="fc-card-price">${price}</div>
      </div>`;

    return div;
  }

  function appendLabel(text, container) {
    const el = document.createElement('div');
    el.className = 'fc-section-label';
    el.textContent = text;
    (container || grid).appendChild(el);
  }

  /* ════════════════════════════════════════════════════════════
     INTERSECTION OBSERVER
  ════════════════════════════════════════════════════════════ */

  function observeTrigger() {
    if (!trigger) return;

    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && !done) {
        MODE === 'featured' ? loadNonFeatured(PER_PAGE) : loadNormalPage();
      }
    }, { rootMargin: '300px' }).observe(trigger);
  }

  /* ════════════════════════════════════════════════════════════
     SORT & FILTER  (page-reload approach — simplest & correct)
  ════════════════════════════════════════════════════════════ */

  window.fcHandleSortChange = function (val) {
    const u = new URL(window.location.href);
    if (val === 'manual' || val === '') {
      u.searchParams.delete('sort_by');
    } else {
      u.searchParams.set('sort_by', val);
    }
    u.searchParams.delete('page');
    window.location.href = u.toString();
  };

  window.fcHandleFilterChange = function () {
    const u = new URL(window.location.href);
    const inputs = document.querySelectorAll('.fc-filter-options input[type=checkbox]');
    const groups = {};

    inputs.forEach(i => {
      if (!groups[i.name]) groups[i.name] = [];
      if (i.checked) groups[i.name].push(i.value);
    });

    inputs.forEach(i => u.searchParams.delete(i.name));
    Object.entries(groups).forEach(([k, vals]) =>
      vals.forEach(v => u.searchParams.append(k, v))
    );

    u.searchParams.delete('page');
    window.location.href = u.toString();
  };

  /* ════════════════════════════════════════════════════════════
     UTILS
  ════════════════════════════════════════════════════════════ */

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function show(el) { if (el) el.style.display = 'block'; }
  function hide(el) { if (el) el.style.display = 'none';  }
  function showNoMore() { if (noMore) noMore.style.display = 'block'; }

})();