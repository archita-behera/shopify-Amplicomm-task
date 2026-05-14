/**
 * featured-infinite-scroll.js
 * ─────────────────────────────────────────────
 * Assignment: Featured Products on Top + Infinite Scroll
 *
 * Logic:
 *  1. Read ALL products injected by Liquid (up to 250)
 *  2. Separate into featured[] and normal[]
 *  3. Show all 15 featured first, then 5 normal = 20 on initial load
 *  4. Infinite scroll loads next 20 normal products
 *  5. Sort/filter → URL update → normal Shopify behavior (no pinning)
 *  6. Duplicate prevention via Set of seen product IDs
 * ─────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── Config ── */
  const NORMAL_PER_PAGE   = 20;   // how many normal products to load per scroll
  const INITIAL_NORMAL    = 5;    // normal products shown on first load (featured fill rest of 20)

  /* ── State ── */
  let featuredProducts    = [];
  let normalProducts      = [];
  let normalOffset        = 0;     // how many normal products already shown
  let isLoading           = false;
  let allLoaded           = false;
  const seenIds           = new Set();  // duplicate prevention
  let isSortedOrFiltered  = false;

  /* ── DOM refs ── */
  const root          = document.getElementById('featured-collection-root');
  const featuredGrid  = document.getElementById('fic-grid');
  const normalGrid    = document.getElementById('fic-normal-grid');
  const sentinel      = document.getElementById('fic-sentinel');
  const loader        = document.getElementById('fic-loader');
  const endMsg        = document.getElementById('fic-end-msg');
  const countEl       = document.getElementById('fic-product-count');
  const featuredLabel = document.getElementById('fic-featured-label');
  const divider       = document.getElementById('fic-divider');

  /* ════════════════════════════════════════
     STEP 1: Read products injected by Liquid
  ════════════════════════════════════════ */
  function init() {
    const jsonEl = document.getElementById('collection-products-json');
    if (!jsonEl) return;

    let allProducts = [];
    try {
      allProducts = JSON.parse(jsonEl.textContent);
    } catch (e) {
      console.error('[FIC] Failed to parse product JSON', e);
      return;
    }

    /* STEP 2: Separate featured vs normal */
    allProducts.forEach(function (product) {
      if (seenIds.has(product.id)) return;
      seenIds.add(product.id);

      const tags = Array.isArray(product.tags) ? product.tags : [];
      const isFeatured = tags.some(function (t) {
        return t.trim().toLowerCase() === 'featured';
      });

      if (isFeatured) {
        featuredProducts.push(product);
      } else {
        normalProducts.push(product);
      }
    });

    /* Check if sort/filter is active — if yes, skip pinning */
    const urlParams   = new URLSearchParams(window.location.search);
    const sortBy      = urlParams.get('sort_by');
    const hasFilter   = urlParams.has('filter.p.tag') || urlParams.has('filter.v.price.gte') || urlParams.has('filter.v.price.lte');

    isSortedOrFiltered = (sortBy && sortBy !== 'manual') || hasFilter;

    if (isSortedOrFiltered) {
      /* Normal Shopify behavior — show all in original order, no pinning */
      renderNormalMode(allProducts);
    } else {
      /* Featured pinning mode */
      renderFeaturedMode();
    }

    /* Setup infinite scroll observer */
    setupInfiniteScroll();
  }

  /* ════════════════════════════════════════
     STEP 3: Render — Featured pinning mode
  ════════════════════════════════════════ */
  function renderFeaturedMode() {
    /* Show featured label & divider */
    if (featuredProducts.length > 0) {
      featuredLabel.style.display = 'block';
      divider.style.display       = 'block';
    }

    /* Render all featured products */
    featuredProducts.forEach(function (p) {
      featuredGrid.appendChild(createCard(p, true));
    });

    /* Render first batch of normal products */
    const firstBatch = normalProducts.slice(0, INITIAL_NORMAL);
    firstBatch.forEach(function (p) {
      normalGrid.appendChild(createCard(p, false));
    });
    normalOffset = INITIAL_NORMAL;

    /* Update count */
    updateCount();

    /* Check if all normal already loaded */
    if (normalOffset >= normalProducts.length) {
      allLoaded = true;
      showEndMessage();
    }
  }

  /* Normal mode (sort/filter active — no pinning) */
  function renderNormalMode(products) {
    featuredLabel.style.display = 'none';
    divider.style.display       = 'none';

    const firstBatch = products.slice(0, NORMAL_PER_PAGE);
    firstBatch.forEach(function (p) {
      normalGrid.appendChild(createCard(p, false));
    });
    normalOffset = NORMAL_PER_PAGE;

    updateCount();

    if (normalOffset >= products.length) {
      allLoaded = true;
      showEndMessage();
    }
  }

  /* ════════════════════════════════════════
     STEP 4: Infinite Scroll
  ════════════════════════════════════════ */
  function setupInfiniteScroll() {
    if (!sentinel) return;

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !isLoading && !allLoaded) {
          loadMoreProducts();
        }
      });
    }, {
      rootMargin: '200px'  /* trigger 200px before sentinel is visible */
    });

    observer.observe(sentinel);
  }

  function loadMoreProducts() {
    if (isLoading || allLoaded) return;
    isLoading = true;
    showLoader();

    /* Small delay to prevent multiple rapid triggers */
    setTimeout(function () {
      const source = isSortedOrFiltered
        ? Array.from(normalGrid.querySelectorAll('.fic-card')).length
        : normalOffset;

      const nextBatch = normalProducts.slice(normalOffset, normalOffset + NORMAL_PER_PAGE);

      if (nextBatch.length === 0) {
        allLoaded = true;
        hideLoader();
        showEndMessage();
        isLoading = false;
        return;
      }

      nextBatch.forEach(function (p) {
        /* STEP 6: Duplicate prevention */
        if (seenIds.has('rendered_' + p.id)) return;
        seenIds.add('rendered_' + p.id);
        normalGrid.appendChild(createCard(p, false));
      });

      normalOffset += nextBatch.length;
      updateCount();

      if (normalOffset >= normalProducts.length) {
        allLoaded = true;
        showEndMessage();
      }

      hideLoader();
      isLoading = false;
    }, 300);
  }

  /* ════════════════════════════════════════
     Card Builder
  ════════════════════════════════════════ */
  function createCard(product, isFeatured) {
    const card = document.createElement('a');
    card.href  = product.url;
    card.className = 'fic-card' + (product.available ? '' : ' fic-card-unavailable');

    const imgSrc = product.featured_image || 'https://via.placeholder.com/400x400?text=No+Image';

    let badgeHTML = '';
    if (isFeatured) {
      badgeHTML = '<div class="fic-card-badge">⭐ Featured</div>';
    }
    if (!product.available) {
      badgeHTML += '<div class="fic-unavailable-badge">Sold Out</div>';
    }

    let priceHTML = '<span class="fic-card-price-current">' + product.price + '</span>';
    if (product.compare_at_price && product.compare_at_price !== product.price) {
      priceHTML += '<span class="fic-card-compare">' + product.compare_at_price + '</span>';
    }

    card.innerHTML = [
      '<img src="' + imgSrc + '" alt="' + escapeHTML(product.title) + '" loading="lazy">',
      '<div class="fic-card-body">',
        badgeHTML,
        '<div class="fic-card-title">' + escapeHTML(product.title) + '</div>',
        '<div class="fic-card-price">' + priceHTML + '</div>',
      '</div>'
    ].join('');

    return card;
  }

  /* ════════════════════════════════════════
     Sort Handler
  ════════════════════════════════════════ */
  window.ficHandleSort = function (sortValue) {
    const url = new URL(window.location.href);
    if (sortValue === 'manual') {
      url.searchParams.delete('sort_by');
    } else {
      url.searchParams.set('sort_by', sortValue);
    }
    window.location.href = url.toString();
  };

  /* ════════════════════════════════════════
     Helpers
  ════════════════════════════════════════ */
  function updateCount() {
    if (!countEl) return;
    const shown = featuredGrid.children.length + normalGrid.children.length;
    const total = featuredProducts.length + normalProducts.length;
    countEl.textContent = shown + ' of ' + total + ' products';
  }

  function showLoader() {
    if (loader) loader.style.display = 'flex';
  }

  function hideLoader() {
    if (loader) loader.style.display = 'none';
  }

  function showEndMessage() {
    hideLoader();
    if (endMsg) endMsg.style.display = 'block';
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Kick off ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
