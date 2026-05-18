# 📊 SETUP INSTRUCTIONS - Adding Real Data to Your Website

## Step 1: Extract Product Data from Excel File

### What You Need:
- The Excel file "bgs website.xlsx" containing product information
- The PDF file "Copy of B8 Enterprises" containing product images

### How to Extract Data:

1. **Open the Excel File**
   - Open `bgs website.xlsx` in Microsoft Excel or Google Sheets
   - Look for sheets containing:
     - Product names/codes
     - Prices
     - Product images (or links to images)

2. **Identify the Required Columns**
   - Product Code (e.g., BGS-001, BGS-002)
   - Product Name (e.g., "Gift Basket Deluxe")
   - Price (in Rupees)
   - Product Image (image file or filename)

3. **Create a CSV/JSON Export** (if available)
   - If Excel supports it, export the data as CSV
   - This makes it easier to parse and import

### Alternative: Manual Entry
If the Excel data isn't easily extractable:
1. Open `js/products-data.js`
2. Manually update the `productsData` array with information from your Excel file
3. Use the template provided as a guide

---

## Step 2: Add Product Images

### Image Requirements:
- **Format**: JPG or PNG
- **Recommended Size**: 400px × 300px (will be automatically resized by CSS)
- **Quality**: High quality, clear, well-lit images
- **Background**: Preferably white or clean background for consistency

### How to Add Images:

1. **Extract Images from PDF**
   - Open "Copy of B8 Enterprises" PDF in Adobe Reader or similar
   - Right-click on each product image
   - Select "Save Image As"
   - Save to: `images/` folder

2. **Name Images Consistently**
   ```
   images/
   ├── product-1.jpg
   ├── product-2.jpg
   ├── product-3.jpg
   ├── product-4.jpg
   ├── product-5.jpg
   ├── product-6.jpg
   ├── product-7.jpg
   ├── product-8.jpg
   └── gifts-bg.jpg (background image)
   ```

3. **Update Product Paths**
   - In `js/script.js` or `js/products-data.js`
   - Update the `image` property for each product:
   ```javascript
   image: '../images/product-1.jpg'
   ```

### Background Image:
1. Save a high-quality gift shop themed image as `gifts-bg.jpg`
2. Place it in the `images/` folder
3. The CSS will automatically apply it to the background
4. Recommended size: 1920×1080px or higher

---

## Step 3: Update Product Data in JavaScript

### Method A: Direct Update (Simple)

1. Open `js/script.js`
2. Find the `const products = [...]` array
3. Replace the sample products with your data:

```javascript
const products = [
    {
        id: 1,
        code: 'BGS-001',          // From Excel
        name: 'Gift Basket Deluxe',  // From Excel
        price: 2499,              // From Excel (in Rupees)
        image: '../images/product-1.jpg',  // Your saved image
        description: 'Beautiful gift basket...'  // Your description
    },
    // ... Add more products
];
```

### Method B: Using Products Data File (Advanced)

1. Update `js/products-data.js` with your real data
2. Add this line to `index.html` before `script.js`:
   ```html
   <script src="js/products-data.js"></script>
   ```
3. Modify `js/script.js` to use the external data:
   ```javascript
   const products = typeof productsData !== 'undefined' ? productsData : [];
   ```

---

## Step 4: Creating Placeholder Images (If Needed)

### If You Don't Have Images Yet:

1. **Use Online Tools**:
   - [Placeholder.com](https://placeholder.com/) - Generate test images
   - [Lorem Picsum](https://picsum.photos/) - Stock gift images
   - [Unsplash](https://unsplash.com/) - Free high-quality images

2. **Generate Placeholder Links**:
   ```javascript
   image: 'https://picsum.photos/400/300?random=1'
   ```

3. **Save Images Locally** (recommended for production):
   - Download images to `images/` folder
   - Use local paths instead of URLs

---

## Step 5: Testing Your Changes

### After Adding Data:

1. **Refresh Your Browser**
   - Press `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
   - This clears cache and reloads the page

2. **Check Each Section**:
   - [ ] Home page products display correctly
   - [ ] Product prices show in Indian Rupees (₹)
   - [ ] Images load properly
   - [ ] Hover animations work
   - [ ] Modal popup displays product details
   - [ ] All links in navigation work
   - [ ] Background image appears and scrolls correctly
   - [ ] Header stays sticky on scroll

3. **Test Modal Functionality**:
   - Click "View Details" on any product
   - Verify modal content shows correctly
   - Test "Add to Cart" button
   - Test "Close" button
   - Test pressing Escape key to close

4. **Responsive Testing**:
   - Resize browser to tablet size (768px)
   - Resize browser to mobile size (480px)
   - Verify all content displays correctly

---

## Step 6: Common Issues & Solutions

### Issue: Images Not Loading
**Solution**:
1. Check file path in products array
2. Verify image files exist in `images/` folder
3. Check file names match exactly (case-sensitive)
4. Use relative paths: `../images/product-1.jpg`

### Issue: Products Not Displaying
**Solution**:
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify products array syntax is correct
4. Refresh page with Ctrl+F5

### Issue: Prices Not Showing
**Solution**:
1. Ensure price is a number, not a string
2. Check: `price: 2499` not `price: "2499"`

### Issue: Modal Not Opening
**Solution**:
1. Verify jQuery is loaded
2. Check browser console for errors
3. Ensure product ID is correct

---

## Step 7: Sample Data Format

Here's the exact format your data should follow:

```javascript
{
    id: 1,                              // Unique number (1, 2, 3, ...)
    code: 'BGS-001',                    // Product code (string)
    name: 'Product Name',               // Product name (string)
    price: 2499,                        // Price in Rupees (number, no comma)
    image: '../images/product-1.jpg',   // Image path (string, relative)
    description: 'Brief description'    // Description (string)
}
```

---

## 📋 Checklist

- [ ] Extracted product data from Excel file
- [ ] Identified product images in PDF
- [ ] Downloaded/saved product images to `images/` folder
- [ ] Named images consistently (product-1.jpg, etc.)
- [ ] Updated JavaScript product array
- [ ] Added background image (gifts-bg.jpg)
- [ ] Tested all products display correctly
- [ ] Verified hover animations work
- [ ] Tested modal popup functionality
- [ ] Checked responsive design on mobile
- [ ] All navigation links work
- [ ] Header stays sticky on scroll

---

## 🎯 Next Steps After Setup

1. **Customize Content**:
   - Update About page with your company info
   - Update Contact page with real contact details
   - Update footer with your information

2. **Add More Features** (Optional):
   - Shopping cart functionality
   - User reviews
   - Product filtering
   - Search functionality

3. **Hosting**:
   - Deploy website to web server
   - Set up domain name
   - Configure SSL certificate

---

## 📞 Need Help?

Refer to the **README.md** file for:
- Project structure overview
- Feature descriptions
- Customization options
- Technology stack details

---

**Remember**: Always test changes in a browser before deploying to production! 🚀
