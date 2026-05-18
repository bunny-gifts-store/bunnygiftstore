# 🚀 QUICK START GUIDE - Bunny Gift Store

## ⚡ Get Started in 5 Minutes

### 1️⃣ **Open the Website**
Simply double-click `index.html` to open the website in your default browser.

### 2️⃣ **Explore the Website**
- **Home Page**: Browse the sample products and explore the design
- **About Page**: Click the "About" link to learn more
- **Contact Page**: Click the "Contact" link to see the contact form
- Use the sticky header to navigate between pages

### 3️⃣ **Test Product Features**
- Hover over product cards to see animations
- Click "View Details" to open the beautiful modal popup
- Try the "Add to Cart" button
- Press "Escape" key to close modal
- Click outside modal to close it

### 4️⃣ **Customize with Your Data** (Important!)
Follow these steps to add your real product data:

**Step A: Add Product Images**
1. Save product images to `images/` folder
2. Name them: `product-1.jpg`, `product-2.jpg`, etc.
3. Add a background image: `gifts-bg.jpg`

**Step B: Update Product Data**
1. Open `js/script.js`
2. Find the `const products = [...]` section
3. Replace with your product information:

```javascript
{
    id: 1,
    code: 'BGS-001',           // Your product code
    name: 'Product Name',      // Your product name
    price: 2499,              // Your price in Rupees
    image: '../images/product-1.jpg',  // Your image path
    description: 'Your description'    // Your description
}
```

### 5️⃣ **Refresh & Enjoy!**
Press `Ctrl+F5` to refresh and see your products!

---

## 📁 **File Structure Overview**

```
bunny-gifts-store/
├── index.html              👈 Open this file to view the website
├── pages/
│   ├── about.html         → About page
│   └── contact.html       → Contact page
├── css/
│   └── style.css          → All styling (black & purple theme)
├── js/
│   ├── script.js          → Main functionality
│   └── products-data.js   → Product data template
├── images/                → Add your images here
│   └── (empty, add your images)
├── README.md              → Full documentation
└── SETUP-INSTRUCTIONS.md  → Detailed setup guide
```

---

## 🎨 **Design Features at a Glance**

✅ **Modern Logo**: "BunnyGiftStore" with bunny emoji 🐰  
✅ **Beautiful Colors**: Black (#1a1a2e) and Light Purple (#c77dff)  
✅ **Sticky Header**: Navigation stays on top while scrolling  
✅ **Smooth Animations**: Hover effects, modal transitions, fade-ins  
✅ **Product Cards**: Image, code, name, price, and hover animation  
✅ **Modal Popup**: Beautiful product details display with minimal animation  
✅ **Responsive Design**: Works on desktop, tablet, and mobile  
✅ **Fixed Background**: Gift shop image scrolls with page  
✅ **Bootstrap & jQuery**: Professional, reliable framework  

---

## 🔧 **Key Features Explained**

### **Header & Navigation**
- Sticky navigation bar that follows you as you scroll
- Links to Home, About, and Contact pages
- Beautiful gradient background with purple and dark colors

### **Product Cards**
- Hover effect: Card lifts up with shadow
- Image scales up slightly on hover
- Shows product code, name, and price
- "View Details" button opens modal

### **Modal Popup**
- Smooth fade-in animation (0.3s)
- Shows complete product details
- "Add to Cart" button for shopping
- Close button, Escape key, or click outside to close
- Beautiful gradient header in modal

### **About Page**
- Company story and mission
- 6 feature cards highlighting benefits
- Company values list
- Call to action to explore collection

### **Contact Page**
- Contact information (address, phone, email, hours)
- Social media links
- Working form with validation
- Responsive two-column layout

---

## 📱 **Responsive Design**

Your website looks beautiful on all devices:
- **Desktop**: Full-width grid with 4+ products per row
- **Tablet**: 2-3 products per row
- **Mobile**: Single product per row, full-width

Test by resizing your browser window!

---

## 🎯 **What to Customize**

### **Must Customize**:
1. ✏️ Add your real product images
2. ✏️ Update product data (names, prices, codes)
3. ✏️ Update About page with your story
4. ✏️ Update Contact page with real contact info
5. ✏️ Add background image (gifts-bg.jpg)

### **Can Customize** (Optional):
- Change colors in `css/style.css`
- Change fonts (currently Poppins)
- Add more products to the grid
- Modify descriptions and content
- Add social media links
- Add more features (cart, search, etc.)

---

## 🎨 **Color Scheme**

Current colors are perfect for a gift store, but you can change them:

| Color | Hex Value | Usage |
|-------|-----------|-------|
| Primary Dark | #1a1a2e | Text, titles, backgrounds |
| Secondary Purple | #7b4397 | Accents, headers |
| Light Purple | #c77dff | Highlights, buttons |
| Accent Pink | #dc81a2 | Call-to-action elements |

All CSS variables are at the top of `css/style.css` - easy to change!

---

## ⚙️ **Browser Support**

Works perfectly in:
- ✅ Google Chrome/Chromium (latest)
- ✅ Mozilla Firefox (latest)
- ✅ Safari (latest)
- ✅ Microsoft Edge (latest)
- ✅ Mobile browsers (iPhone Safari, Chrome Mobile)

---

## 🚨 **Troubleshooting**

### Products Not Showing?
1. Ensure images exist in `images/` folder
2. Check file names in the products array
3. Refresh page with Ctrl+F5
4. Open browser console (F12) and check for errors

### Modal Not Opening?
1. Check jQuery is loaded (view page source)
2. Verify product ID exists
3. Check browser console for errors

### Background Not Showing?
1. Save `gifts-bg.jpg` to `images/` folder
2. Ensure file name is exactly: `gifts-bg.jpg`
3. Refresh with Ctrl+F5

### Images Not Loading?
1. Check file path in products array
2. Ensure file extension is correct (.jpg, .png)
3. Verify files are actually in `images/` folder

---

## 📚 **Additional Resources**

- **Detailed Setup Guide**: See `SETUP-INSTRUCTIONS.md`
- **Full Documentation**: See `README.md`
- **Products Template**: See `js/products-data.js`

---

## 💡 **Pro Tips**

1. **Save Often**: When updating data, save files and refresh browser
2. **Test Responsiveness**: Resize browser to test mobile view
3. **Clear Cache**: Use Ctrl+F5 instead of just F5 or Refresh
4. **Check Console**: Press F12, go to Console tab to see any errors
5. **Use High-Quality Images**: Better images = better website!

---

## 🎉 **What's Next?**

After adding your product data:

1. ✅ Test all pages and features
2. ✅ Check mobile responsiveness
3. ✅ Verify all images load
4. ✅ Test modal popup functionality
5. ✅ Test contact form
6. ✅ Update About & Contact pages with your info
7. 🚀 Deploy to web server (if needed)

---

## 📞 **Need Help?**

1. **Check Files**: `README.md`, `SETUP-INSTRUCTIONS.md`
2. **Check Browser Console**: Press F12 → Console tab
3. **Look for Error Messages**: Usually explains the problem
4. **Verify File Paths**: Make sure images exist where referenced
5. **Try Different Browser**: Rule out browser-specific issues

---

**Your website is ready to shine! 🌟 Add your products and watch it come to life! 🎁**

Made with ❤️ for Bunny Gift Store
