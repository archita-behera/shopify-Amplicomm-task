/**
 * Featured Collection - Infinite Scroll
 * 
 * Logic:
 * 1. If no filters/sort active → FEATURED MODE
 *    - Fetch all featured products first (tag:featured)
 *    - Then lazy-load non-featured in pages of 20
 * 2. If filters/sort active → NORMAL MODE
 *    - Standard infinite scroll, no pinning
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const COLLECTION_HANDLE = window.COLLECTION_HANDLE || '';
  const COLLECTION_MODE   = window.COLLECTION_MODE   || 'normal';
  const CURRENT_SORT      = window.CURRENT_SORT      || '';
  const PAGE_SIZE         = 20;
  const FEATURED_TAG      = 'featured';

  // ─── State ────────────────────────────────────────────────────────────────
  const shownProductIds = new Set();  // All IDs already rendered (dedup guard)
  let nonFeaturedPage   = 1;          // Current page for non-featured products
  let isLoading         = false;
  let allLoaded         = false;
  let featuredLoaded    = false;

  // ─── DOM refs ─────────────────────────────────────────────────────────────
  const productGrid      = document.getElementById('product-grid');
  const featuredSection  = document.getElementById('featured-section');
  const regularSection   = document.getElementById('regular-section');
  const spinner          = document.getElementById('loading-spinner');
  const noMore           = document.getElementById('no-more-products');
  const trigger          = document.getElementById('load-more-trigger');

  // ─── Init ─────────────────────────────────────────────────────────────────
  if (COLLECTION_MODE === 'featured') {
    initFeaturedMode();
  } else {
    initNormalMode();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FEATURED MODE
  // ══════════════════════════════════════════════════════════════════════════

  async function initFeaturedMode() {
    showSpinner();

    // Step 1: Fetch ALL featured products (all pages, tag: featured)
    const featuredProducts = await fetchAllFeaturedProducts();
    renderProducts(featuredProducts, featuredSection, true);
    featuredLoaded = true;

    // Step 2: Calculate how many non-featured to show initially
    // Total initial = 20, featured already shown = featuredProducts.length
    // If featured >= 20, show 0 non-featured initially (load on scroll)
    const initialNonFeaturedCount = Math.max(0, PAGE_SIZE - featuredProducts.length);

    if (initialNonFeaturedCount > 0) {
      // We need to load enough non-featured to fill 20 slots
      await loadNonFeaturedBatch(initialNonFeaturedCount);
    }

    hideSpinner();
    setupIntersectionObserver();
  }

  /**
   * Fetch ALL products tagged 'featured' across all pages
   * Uses /collections/{handle}/products.json?tag=featured
   * Shopify returns max 250 per page
   */
  async function fetchAllFeaturedProducts() {
    const allFeatured = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `/collections/${COLLECTION_HANDLE}/products.json?tag=${FEATURED_TAG}&limit=250&page=${page}`;
      const data = await fetchJSON(url);
      const products = data.products || [];

      allFeatured.push(...products);

      if (products.length < 250) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allFeatured;
  }

  /**
   * Load a batch of non-featured products
   * Skips any product IDs already shown (dedup)
   */
  async function loadNonFeaturedBatch(limit = PAGE_SIZE) {
    if (isLoading || allLoaded) return;
    isLoading = true;
    showSpinner();

    // We may need to fetch extra pages to get enough non-featured
    // because some products on a page might already be in shownProductIds
    const batch = [];
    let localPage = nonFeaturedPage;

    while (batch.length < limit) {
      const url = buildCollectionUrl(localPage);
      const data = await fetchJSON(url);
      const products = data.products || [];

      if (products.length === 0) {
        allLoaded = true;
        break;
      }

      for (const product of products) {
        // Skip if already shown (featured product appearing again, or duplicate)
        if (!shownProductIds.has(product.id)) {
          // Also skip if it's a featured product (already at top)
          if (!product.tags || !product.tags.includes(FEATURED_TAG)) {
            batch.push(product);
          } else {
            // It's featured but appearing in normal pages — mark as seen, skip
            shownProductIds.add(product.id);
          }
        }
      }

      localPage++;

      // If Shopify returned fewer than limit, we've reached the end
      if (products.length < PAGE_SIZE) {
        allLoaded = true;
        break;
      }

      // Safety: don't over-fetch
      if (localPage > 500) break;
    }

    nonFeaturedPage = localPage;

    // Render only what we need (in case we fetched extra)
    const toRender = batch.slice(0, limit);
    renderProducts(toRender, regularSection, false);

    hideSpinner();
    isLoading = false;

    if (allLoaded && noMore) {
      noMore.style.display = 'block';
    }
  }

  function buildCollectionUrl(page) {
    let url = `/collections/${COLLECTION_HANDLE}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    if (CURRENT_SORT) {
      url += `&sort_by=${CURRENT_SORT}`;
    }
    return url;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NORMAL MODE (filters/sort active)
  // ══════════════════════════════════════════════════════════════════════════

  function initNormalMode() {
    // Products already rendered by Liquid
    // Just set up infinite scroll for subsequent pages
    document.querySelectorAll('.product-card[data-id]').forEach(el => {
      shownProductIds.add(el.dataset.id);
    });

    setupIntersectionObserver();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ══════════════════════════════════════════════════════════════════════════

  function renderProducts(products, container, isFeatured) {
    if (!products || products.length === 0) return;

    const fragment = document.createDocumentFragment();

    products.forEach(product => {
      if (shownProductIds.has(product.id)) return; // Dedup guard
      shownProductIds.add(product.id);

      const card = buildProductCard(product, isFeatured);
      fragment.appendChild(card);
    });

    (container || productGrid).appendChild(fragment);
  }

  function buildProductCard(product, isFeatured) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = product.id;

    const imageUrl = product.images && product.images[0]
      ? product.images[0].src.replace(/(\.\w+)$/, '_400x$1')
      : null;

    const price = formatMoney(product.variants[0]?.price || 0);
    const productUrl = `/products/${product.handle}`;

    card.innerHTML = `
      <a href="${productUrl}">
        ${imageUrl
          ? `<img src="${imageUrl}" alt="${escapeHtml(product.title)}" loading="lazy">`
          : `<div style="height:220px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#999;">No Image</div>`
        }
      </a>
      <div class="product-card-info">
        ${isFeatured ? '<span class="featured-badge">⭐ Featured</span>' : ''}
        <div class="product-card-title">
          <a href="${productUrl}" style="color:inherit;text-decoration:none;">${escapeHtml(product.title)}</a>
        </div>
        <div class="product-card-price">${price}</div>
      </div>
    `;

    return card;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERSECTION OBSERVER (Infinite Scroll)
  // ══════════════════════════════════════════════════════════════════════════

  function setupIntersectionObserver() {
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !isLoading && !allLoaded) {
            if (COLLECTION_MODE === 'featured') {
              loadNonFeaturedBatch(PAGE_SIZE);
            } else {
              loadNormalNextPage();
            }
          }
        });
      },
      { rootMargin: '200px' } // Trigger 200px before reaching bottom
    );

    observer.observe(trigger);
  }

  // Normal mode: load next page using section rendering
  async function loadNormalNextPage() {
    if (isLoading || allLoaded) return;
    isLoading = true;
    showSpinner();

    const url = new URL(window.location.href);
    const currentPage = parseInt(url.searchParams.get('page') || '1');
    url.searchParams.set('page', currentPage + 1);
    url.searchParams.set('section_id', 'featured-collection');

    try {
      const html = await fetch(url.toString()).then(r => r.text());
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newCards = doc.querySelectorAll('.product-card');

      if (newCards.length === 0) {
        allLoaded = true;
        if (noMore) noMore.style.display = 'block';
      } else {
        newCards.forEach(card => {
          if (!shownProductIds.has(card.dataset.id)) {
            shownProductIds.add(card.dataset.id);
            productGrid.appendChild(card);
          }
        });
        history.replaceState(null, '', url.toString());
      }
    } catch (err) {
      console.error('Failed to load next page:', err);
    }

    hideSpinner();
    isLoading = false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SORT & FILTER HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  window.handleSortChange = function (value) {
    const url = new URL(window.location.href);
    url.searchParams.set('sort_by', value);
    url.searchParams.delete('page');
    window.location.href = url.toString();
  };

  window.handleFilterChange = function () {
    // Collect all active checkboxes
    const url = new URL(window.location.href);
    // Clear old filter params
    const filterInputs = document.querySelectorAll('.filter-options input[type="checkbox"]');
    const paramGroups = {};

    filterInputs.forEach(input => {
      if (!paramGroups[input.name]) paramGroups[input.name] = [];
      if (input.checked) paramGroups[input.name].push(input.value);
    });

    // Rebuild URL params
    filterInputs.forEach(input => url.searchParams.delete(input.name));
    Object.entries(paramGroups).forEach(([name, values]) => {
      values.forEach(v => url.searchParams.append(name, v));
    });

    url.searchParams.delete('page');
    window.location.href = url.toString();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  async function fetchJSON(url) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  }

  function formatMoney(cents) {
    return '₹' + (parseFloat(cents) / 100).toFixed(2);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function showSpinner() {
    if (spinner) spinner.style.display = 'block';
  }

  function hideSpinner() {
    if (spinner) spinner.style.display = 'none';
  }

})();