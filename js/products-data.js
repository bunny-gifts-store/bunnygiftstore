/**
 * PRODUCT DATA TEMPLATE
 * =====================
 * 
 * This file serves as a template for organizing product data.
 * You can use this to import product information from your Excel file.
 * 
 * Format:
 * - id: Unique identifier (number)
 * - code: Product code (string) - e.g., "BGS-001"
 * - name: Product name (string)
 * - price: Price in rupees (number)
 * - image: Path to product image (string) - relative to images folder
 * - description: Product description (string)
 * - category: Category name (optional, for future filtering)
 */

const productsData = [
    // SAMPLE DATA - Replace with your actual product data from Excel
    
    {
        id: 1,
        code: 'BGS-001',
        name: 'Gift Basket Deluxe',
        price: 2499,
        image: '../images/product-1.jpg',
        description: 'Beautiful deluxe gift basket with premium items and elegant packaging.',
        category: 'Baskets'
    },
    {
        id: 2,
        code: 'BGS-002',
        name: 'Teddy Bear Collection',
        price: 1299,
        image: '../images/product-2.jpg',
        description: 'Adorable collection of plush teddy bears, perfect for gift giving.',
        category: 'Soft Toys'
    },
    {
        id: 3,
        code: 'BGS-003',
        name: 'Personalized Gift Box',
        price: 1599,
        image: '../images/product-3.jpg',
        description: 'Customizable gift box with your personal touch and premium wrapping.',
        category: 'Gift Boxes'
    },
    {
        id: 4,
        code: 'BGS-004',
        name: 'Luxury Chocolate Set',
        price: 1899,
        image: '../images/product-4.jpg',
        description: 'Exquisite selection of premium chocolates in an elegant presentation.',
        category: 'Chocolates'
    },
    {
        id: 5,
        code: 'BGS-005',
        name: 'Scented Candle Bundle',
        price: 1699,
        image: '../images/product-5.jpg',
        description: 'Aromatic scented candles in beautiful packaging, perfect for any occasion.',
        category: 'Candles'
    },
    {
        id: 6,
        code: 'BGS-006',
        name: 'Jewelry Gift Box',
        price: 2199,
        image: '../images/product-6.jpg',
        description: 'Premium jewelry gift set with elegant box packaging.',
        category: 'Jewelry'
    },
    {
        id: 7,
        code: 'BGS-007',
        name: 'Perfume Collection',
        price: 2599,
        image: '../images/product-7.jpg',
        description: 'Luxurious perfume collection from premium brands.',
        category: 'Fragrances'
    },
    {
        id: 8,
        code: 'BGS-008',
        name: 'Bath & Spa Set',
        price: 1799,
        image: '../images/product-8.jpg',
        description: 'Relaxing bath and spa products in a beautiful gift set.',
        category: 'Bath & Care'
    },
    
    // ===== INSTRUCTIONS TO ADD MORE PRODUCTS =====
    // 1. Copy the structure above
    // 2. Increment the id number
    // 3. Create a unique product code following the pattern "BGS-XXX"
    // 4. Add product name, price, and description
    // 5. Place the product image in the images/ folder and reference the path
    // 6. Update js/script.js with this new data
    // 7. Refresh your browser to see the changes
    
    // Example of how to add a new product:
    /*
    {
        id: 9,
        code: 'BGS-009',
        name: 'Premium Watch Gift Set',
        price: 3499,
        image: '../images/product-9.jpg',
        description: 'Elegant watch with premium leather strap and gift packaging.',
        category: 'Watches'
    },
    */
];

// ===================== IMPORTING INTO MAIN SCRIPT =====================
// To use this data in your website:
// 
// Option 1: Copy the products array and paste directly into js/script.js
// 
// Option 2: Include this file in your HTML and use the data:
//   <script src="js/products-data.js"></script>
//   Then in js/script.js, replace the products array with:
//   const products = productsData || [];
// 
// Option 3: Create a function to merge data:
//   function loadProducts(externalData) {
//       products.push(...externalData);
//       renderProducts('productsContainer');
//   }

console.log('Product Data Template Loaded');
console.log('Total Products:', productsData.length);
