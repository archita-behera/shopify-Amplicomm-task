# shopify-Amplicomm-task

# Shopify Featured Products Assignment

## Objective

Implemented a Shopify collection page with:
- Featured products pinned at top
- Infinite scroll loading
- Sorting & filtering support
- No duplicate products
- Scalable product handling

---

## Features

- 100 sample products
- 15 tagged featured products
- Infinite scroll (20 products per load)
- Featured products always displayed first
- Duplicate prevention
- Sorting support
- Filtering support
- Shopify compatible solution

---

## Approach & Logic

### 1. Featured vs Non Featured Products

Used Shopify Liquid to:
- Separate products tagged with `featured`
- Store normal products separately
- Render featured products first

### 2. Infinite Scroll

Implemented JavaScript-based infinite scrolling:
- Initial load:
  - 15 featured products
  - 5 normal products
- Next loads:
  - Only non-featured products

### 3. Duplicate Prevention

Used product IDs and frontend filtering logic to ensure:
- Featured products never repeated
- Pagination remains clean

### 4. Scalability

Optimized for large collections by:
- Loading products incrementally
- Avoiding full collection rendering repeatedly
- Using lazy loading concepts

### 5. Sorting & Filtering

When filters or sorting are applied:
- Default Shopify behavior takes over
- Featured pinning disabled intentionally

### 6. Liquid Limitations

Shopify Liquid alone cannot globally reorder paginated collections dynamically.

Solution:
- Combined Liquid rendering with JavaScript logic.

---

## Technologies Used

- Shopify Liquid
- JavaScript
- CSS
- Shopify Section Rendering

---

## Setup

```bash
shopify theme dev

## preview link here
https://amplicomm-solutions.myshopify.com/collections/all-products?preview_theme_id=161578483931


## GitHub repository link here
https://github.com/archita-behera/shopify-Amplicomm-task