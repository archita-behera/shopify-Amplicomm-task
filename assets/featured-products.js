// document.addEventListener('DOMContentLoaded', () => {

//   const grid = document.getElementById('product-grid');

//   if (!grid) return;

//   const hasSortOrFilter =
//     window.location.search.includes('sort_by') ||
//     window.location.search.includes('filter');

//   // sorting/filtering pe normal Shopify behavior
//   if (hasSortOrFilter) return;

//   const products = [...grid.querySelectorAll('.grid__item')];

//   const featured = [];
//   const normal = [];

//   const renderedProducts = new Set();

//   products.forEach(product => {

//     const isFeatured =
//       product.dataset.featured === 'true';

//     const productId =
//       product.dataset.productId;

//     if (renderedProducts.has(productId)) {
//       product.remove();
//       return;
//     }

//     renderedProducts.add(productId);

//     if (isFeatured) {
//       featured.push(product);
//     } else {
//       normal.push(product);
//     }

//   });

//   grid.innerHTML = '';

//   // first 15 featured
//   featured.slice(0, 15).forEach(product => {
//     grid.appendChild(product);
//   });

//   // then 5 normal
//   normal.slice(0, 5).forEach(product => {
//     grid.appendChild(product);
//   });

// });