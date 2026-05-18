# Bunny Gift Store Website

A beautiful, modern e-commerce website for a premium gift store built with Bootstrap, jQuery, and CSS.

## 📁 Project Structure

```
bunny-gifts-store/
│
├── index.html              # Home page with hero section and products
├── pages/
│   ├── about.html         # About page with company information
│   └── contact.html       # Contact page with form and information
│
├── css/
│   └── style.css          # Main stylesheet with responsive design
│
├── js/
│   └── script.js          # JavaScript for functionality and interactions
│
├── images/                # Directory for product and background images
│   └── (placeholder images to be added)
│
└── README.md              # This file
```

## 🎨 Design Features

- **Color Theme**: Black (#1a1a2e) and Light Purple (#c77dff) with accent pink (#dc81a2)
- **Typography**: Modern Poppins font family for a contemporary look
- **Layout**: Fully responsive grid-based design
- **Animations**: 
  - Smooth page transitions
  - Product card hover effects with scale and shadow
  - Modal popup with fade-in and slide animations
  - Sticky header on scroll
  - Fixed background image on page scroll

## 🚀 Features

### 1. **Home Page (index.html)**
   - Hero section with call-to-action button
   - Product grid display with 8 sample products
   - Product cards with:
     - Product image
     - Product code
     - Product name
     - Price in Indian Rupees (₹)
     - "View Details" button
   - Hover animations on cards
   - Modal popup on product click

### 2. **Product Modal**
   - Beautiful popup display with product details
   - Smooth fade-in and slide animations
   - Product image, code, name, price, and description
   - "Add to Cart" and "Close" buttons
   - Click outside or press Escape to close
   - Minimal design for better user experience

### 3. **About Page (pages/about.html)**
   - Company story and mission
   - Feature cards highlighting key benefits
   - Company values section
   - Link back to product collection

### 4. **Contact Page (pages/contact.html)**
   - Contact information (address, phone, email, hours)
   - Social media links
   - Contact form with validation
   - Responsive two-column layout

### 5. **Header Navigation**
   - Sticky header that stays on top during scroll
   - Modern gradient background
   - Navigation links to Home, About, and Contact pages
   - Beautiful "BunnyGiftStore" logo with emoji

## 📦 Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with Flexbox and Grid
- **Bootstrap 5**: Responsive framework and components
- **jQuery 3.6**: DOM manipulation and interactions
- **Google Fonts**: Poppins typeface

## 🎯 Adding Product Data

The website comes with 8 sample products. To add real product data from your Excel file:

### Option 1: Update JavaScript Array
Edit the `products` array in `js/script.js`:

```javascript
const products = [
    {
        id: 1,
        code: 'BGS-001',
        name: 'Product Name',
        price: 2499,
        image: '../images/product-1.jpg',
        description: 'Product description here'
    },
    // Add more products...
];
```

### Option 2: Load from External Data
Modify the script to fetch product data from a JSON file or backend API.

## 🖼️ Adding Product Images

1. **Add Images**: Place product images in the `images/` directory
   - Recommended format: JPG or PNG
   - Recommended size: 400x300px (will be resized by CSS)
   - Name format: `product-1.jpg`, `product-2.jpg`, etc.

2. **Update Image Paths**: In the products array, update the `image` property with the correct file paths

3. **Background Image**: Add a gifts shop themed background image
   - File name: `gifts-bg.jpg`
   - Place in: `images/` directory
   - The CSS already references this file

## 🎨 Customization

### Change Colors
Edit the CSS variables at the top of `css/style.css`:
```css
:root {
    --primary-color: #1a1a2e;      /* Dark navy blue */
    --secondary-color: #7b4397;    /* Purple */
    --accent-color: #dc81a2;       /* Pink accent */
    --light-purple: #c77dff;       /* Light purple */
}
```

### Change Fonts
Modify the font-family in the body selector:
```css
body {
    font-family: 'Your Font Name', fallback-font;
}
```

### Adjust Grid Layout
Change the products grid in `css/style.css`:
```css
.products-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
}
```

## 📱 Responsive Design

The website is fully responsive with breakpoints at:
- **768px**: Tablet view
- **480px**: Mobile view

All elements adapt beautifully to different screen sizes.

## 🔧 How to Use

1. **Open the Website**: 
   - Double-click `index.html` in your file explorer
   - Or open in a local server for better compatibility

2. **Navigate Pages**:
   - Use the sticky header navigation
   - Click on "BunnyGiftStore" logo to return home
   - Use absolute links (anchor tags) for navigation

3. **View Products**:
   - Scroll through the product grid
   - Hover over cards to see animations
   - Click "View Details" or click the card to open product modal
   - Close modal by clicking close button, outside area, or pressing Escape

4. **Contact Form**:
   - Fill in all required fields
   - Click "Send Message" to submit
   - Form validation prevents empty submissions

## ⚙️ Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📋 To-Do / Future Enhancements

- [ ] Integrate with backend for product management
- [ ] Add shopping cart functionality
- [ ] Implement user authentication
- [ ] Add product filtering and search
- [ ] Setup payment gateway
- [ ] Add customer reviews
- [ ] Newsletter subscription
- [ ] Analytics integration

## 👥 Credits

Developed for Bunny Gift Store | 2026

---

**Ready to customize?** Start by:
1. Adding your product images to the `images/` folder
2. Updating the products array in `js/script.js` with real data
3. Replacing placeholder texts and links with your actual information
4. Adding your gift shop background image

Happy selling! 🎁🐰
