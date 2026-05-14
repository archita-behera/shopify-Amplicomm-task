document.addEventListener('DOMContentLoaded', async () => {

  const grid = document.getElementById('product-grid');

  if (!grid) return;

  
  grid.style.opacity = '0';

  const pagination =
    document.getElementById('collection-pagination');

  const hasSortOrFilter =
    window.location.search.includes('sort_by') ||
    window.location.search.includes('filter');

  if (hasSortOrFilter) {

    grid.style.opacity = '1';

    if (pagination) {
      pagination.style.display = 'block';
    }

    return;
  }

  
  if (pagination) {
    pagination.style.display = 'none';
  }

  const collectionHandle =
    grid.dataset.collectionHandle;

  const renderedProducts = new Set();

  let featuredProducts = [];
  let normalProducts = [];

  let loading = false;

  async function fetchProducts(page) {

    const response = await fetch(
      `/collections/${collectionHandle}/products.json?limit=20&page=${page}`
    );

    const data = await response.json();

    return data.products;
  }

  function createProductCard(product) {

    return `
      <li class="grid__item">

        <div class="card-wrapper">

          <div class="card card--standard">

            <div class="card__inner">

              <img
                src="${product.images[0]?.src || ''}"
                alt="${product.title}"
                style="width:100%;"
              >

            </div>

            <div class="card__content">

              <h3 style="margin-top:10px;">

                ${product.title}

                ${
                  product.tags.includes('featured')
                    ? '<span style="color:red;font-size:12px;"> FEATURED</span>'
                    : ''
                }

              </h3>

              <p>
                Rs. ${product.variants[0].price} INR
              </p>

            </div>

          </div>

        </div>

      </li>
    `;
  }


  function renderProducts(products) {

    products.forEach(product => {

   
      if (renderedProducts.has(product.id)) {
        return;
      }

      renderedProducts.add(product.id);

      grid.innerHTML += createProductCard(product);

    });

  }

  let page = 1;

  while (true) {

    const products = await fetchProducts(page);

    if (!products.length) {
      break;
    }

    products.forEach(product => {

      const isFeatured =
        product.tags.includes('featured');

      if (isFeatured) {

        const alreadyExists =
          featuredProducts.some(
            item => item.id === product.id
          );

        if (
          !alreadyExists &&
          featuredProducts.length < 15
        ) {

          featuredProducts.push(product);

        }

      } else {

        const alreadyExists =
          normalProducts.some(
            item => item.id === product.id
          );

        if (!alreadyExists) {

          normalProducts.push(product);

        }

      }

    });

    page++;

  }


  const initialNormal =
    normalProducts.slice(0, 5);

  let remainingNormalProducts =
    normalProducts.slice(5);

  grid.innerHTML = '';

 
  renderProducts(featuredProducts);

  renderProducts(initialNormal);

  
  grid.style.opacity = '1';


  function loadMoreProducts() {

    if (loading) return;

    loading = true;

  
    const nextProducts =
      remainingNormalProducts.slice(0, 20);

  
    remainingNormalProducts =
      remainingNormalProducts.slice(20);

    setTimeout(() => {

      if (nextProducts.length > 0) {

        renderProducts(nextProducts);

      }

      loading = false;

    }, 1200);

  }



  const trigger =
    document.getElementById('load-more-trigger');

  const observer =
    new IntersectionObserver(

      (entries) => {

        if (entries[0].isIntersecting) {

          loadMoreProducts();

        }

      },

      {
        rootMargin: '100px'
      }

    );

 
  setTimeout(() => {

    observer.observe(trigger);

  }, 1000);

});