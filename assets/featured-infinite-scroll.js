(function () {

let currentPage = 1;
let totalPages = 1;

let loading = false;
let allLoaded = false;

const renderedIds = new Set();

const featuredProducts = [];
const normalProducts = [];

let normalOffset = 0;

const root = document.getElementById('featured-collection-root');

const featuredGrid = document.getElementById('fic-grid');
const normalGrid = document.getElementById('fic-normal-grid');

const loader = document.getElementById('fic-loader');
const endMsg = document.getElementById('fic-end-msg');

const featuredLabel = document.getElementById('fic-featured-label');
const divider = document.getElementById('fic-divider');

const sentinel = document.getElementById('fic-sentinel');

const countEl = document.getElementById('fic-product-count');

function init() {

  if (!root) return;

  currentPage = Number(root.dataset.currentPage);
  totalPages = Number(root.dataset.totalPages);

  const jsonEl = document.getElementById(
    'collection-products-json'
  );

  const products = JSON.parse(
    jsonEl.textContent
  );

  const urlParams = new URLSearchParams(
    window.location.search
  );

  const sortBy = urlParams.get('sort_by');

  const hasFilters =
    window.location.search.includes('filter.');

  const normalMode =
    (sortBy && sortBy !== 'manual') || hasFilters;

  if (normalMode) {

    renderNormalMode(products);

  } else {

    separateProducts(products);

    renderInitialProducts();

  }

  setupInfiniteScroll(normalMode);

}

function separateProducts(products) {

  products.forEach(product => {

    const isFeatured = product.tags.some(
      tag => tag.toLowerCase() === 'featured'
    );

    if (isFeatured) {

      if (!renderedIds.has(product.id)) {

        featuredProducts.push(product);

      }

    } else {

      if (!renderedIds.has(product.id)) {

        normalProducts.push(product);

      }

    }

  });

}

function renderInitialProducts() {

  featuredLabel.style.display = 'block';
  divider.style.display = 'block';

  const featuredToShow =
    featuredProducts.slice(0, 15);

  featuredToShow.forEach(product => {

    renderedIds.add(product.id);

    featuredGrid.appendChild(
      createCard(product, true)
    );

  });

  const normalNeeded =
    20 - featuredToShow.length;

  const firstNormals =
    normalProducts.slice(0, normalNeeded);

  firstNormals.forEach(product => {

    renderedIds.add(product.id);

    normalGrid.appendChild(
      createCard(product, false)
    );

  });

  normalOffset = normalNeeded;

  updateCount();

}

function renderNormalMode(products) {

  const first20 = products.slice(0, 20);

  first20.forEach(product => {

    if (renderedIds.has(product.id)) return;

    renderedIds.add(product.id);

    normalGrid.appendChild(
      createCard(product, false)
    );

  });

  updateCount();

}

function setupInfiniteScroll(normalMode) {

  const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

      if (
        entry.isIntersecting &&
        !loading &&
        !allLoaded
      ) {

        loadMoreProducts(normalMode);

      }

    });

  }, {
    rootMargin: '1000px'
  });

  observer.observe(sentinel);

}

async function loadMoreProducts(normalMode) {

  if (loading || allLoaded) return;

  loading = true;

  loader.style.display = 'block';

  currentPage++;

  try {

    const response = await fetch(
      `${window.location.pathname}?page=${currentPage}&view=featured`
    );

    const html = await response.text();

    const parser = new DOMParser();

    const doc = parser.parseFromString(
      html,
      'text/html'
    );

    const jsonEl = doc.querySelector(
      '#collection-products-json'
    );

    if (!jsonEl) return;

    const products = JSON.parse(
      jsonEl.textContent
    );

    let renderCount = 0;

    products.forEach(product => {

      const isFeatured = product.tags.some(
        tag => tag.toLowerCase() === 'featured'
      );

      if (!normalMode && isFeatured) {

        if (!renderedIds.has(product.id)) {

          renderedIds.add(product.id);

          featuredGrid.appendChild(
            createCard(product, true)
          );

        }

        return;
      }

      if (renderedIds.has(product.id)) return;

      renderedIds.add(product.id);

      if (renderCount < 20) {

        normalGrid.appendChild(
          createCard(product, false)
        );

        renderCount++;

      }

    });

    updateCount();

    if (currentPage >= totalPages) {

      allLoaded = true;

      endMsg.style.display = 'block';

    }

  } catch (error) {

    console.error(error);

  }

  loader.style.display = 'none';

  loading = false;

}

function createCard(product, featured = false) {

  const card = document.createElement('a');

  card.href = product.url;

  card.className = 'fic-card';

  card.innerHTML = `
    <img src="${product.featured_image}" alt="${product.title}">

    <div class="fic-title">

      ${featured
        ? '<div class="fic-badge">Featured</div>'
        : ''
      }

      ${product.title}

    </div>

    <div class="fic-price">

      ${product.price}

    </div>
  `;

  return card;

}

function updateCount() {

  const total =
    featuredGrid.children.length +
    normalGrid.children.length;

  countEl.innerText =
    `${total} products shown`;

}

window.ficHandleSort = function (value) {

  const url = new URL(window.location.href);

  if (value === 'manual') {

    url.searchParams.delete('sort_by');

  } else {

    url.searchParams.set('sort_by', value);

  }

  window.location.href = url.toString();

};

document.addEventListener(
  'DOMContentLoaded',
  init
);

})();