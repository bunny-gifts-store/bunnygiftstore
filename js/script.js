// ==================== PRODUCT DATA ====================
// This will be populated with data from the Excel file
const products = [
    {
        id: 1,
        code: 'LA01',
        name: 'Premium Heart Lamp',
        price: 350,
        description: 'Romantic premium heart lamp with glowing LED lighting.'
    },
    {
        id: 2,
        code: 'CO01',
        name: 'Corporate Gift Combo Set',
        price: 1250,
        description: 'Premium gifting combo ideal for corporate events and clients.'
    },
    {
        id: 3,
        code: 'NB01',
        name: 'New Born Baby T-shirts & Rompers',
        price: 550,
        description: 'Soft newborn baby t-shirts and rompers in cute designs.'
    },
    // {
    //     id: 4,
    //     code: 'TU01',
    //     name: 'Tumblers',
    //     price: 'Varies',
    //     description: 'Stylish tumblers for everyday use, perfect for custom printing.'
    // },
    {
        id: 5,
        code: 'KC01',
        name: 'David Keychain',
        price: 550,
        description: 'Personalized David keychain with elegant design.'
    },
    {
        id: 6,
        code: 'KC02',
        name: 'Eye Pendant',
        price: 650,
        description: 'Beautiful eye-shaped pendant for a unique gift.'
    },
    {
        id: 7,
        code: 'LL01',
        name: 'Vintage Love Letter',
        price: 350,
        description: 'Romantic vintage love letter presentation for special occasions.'
    },
    {
        id: 8,
        code: 'PKC03',
        name: 'Heart Photo Keychain Premium',
        price: 550,
        description: 'Premium heart-shaped photo keychain for keepsake memories.'
    },
    {
        id: 9,
        code: 'CH01',
        name: 'Name Pendant',
        price: 99,
        description: 'Custom name pendant with polished finish.'
    },
    {
        id: 10,
        code: 'BR01',
        name: 'Name Bracelet',
        price: 249,
        description: 'Adjustable name bracelet for a personalized gift.'
    },
    {
        id: 11,
        code: 'CH02',
        name: 'Name Locket',
        price: 249,
        description: 'Classic name locket with elegant detailing.'
    },
    {
        id: 12,
        code: 'CH03',
        name: 'Heart Locket',
        price: 550,
        description: 'Romantic heart-shaped locket with photo space.'
    },
    {
        id: 13,
        code: 'CH04',
        name: 'Hidden Name Locket',
        price: 250,
        description: 'A hidden name locket for subtle personalized gifting.'
    },
    {
        id: 14,
        code: 'PKC04',
        name: 'Box Photo Keychain Premium',
        price: 550,
        description: 'Premium box-shaped photo keychain for cherished moments.'
    },
    {
        id: 15,
        code: 'CO02',
        name: 'Personal and Corporate Gifting',
        price: 360,
        description: 'Versatile gifting options for personal and corporate needs.'
    },
    {
        id: 16,
        code: 'AP01',
        name: 'Cotton T-shirt (Customised) Round Neck',
        price: 550,
        description: 'Comfortable custom cotton round neck t-shirt.'
    },
    {
        id: 17,
        code: 'CL01',
        name: 'Acrylic Clock - Wooden Clock with Photo or Logo Print',
        price: 999,
        description: 'Decorative acrylic clock with custom photo or logo print.'
    },
    {
        id: 18,
        code: 'BG01',
        name: 'Magic Mirror with Photo',
        price: 750,
        description: 'Magic mirror that reveals a photo when exposed to heat.'
    },
    {
        id: 19,
        code: 'BG02',
        name: 'Heart Magic Mirror',
        price: 750,
        description: 'Heart-shaped magic mirror for romantic gifting.'
    },
    {
        id: 20,
        code: 'CO03',
        name: 'Pen Stand Suitable for Office, Home Desk, Desktop',
        price: 750,
        description: 'Elegant pen stand perfect for office and home desks.'
    },
    {
        id: 21,
        code: 'BG03',
        name: 'Plant Mug with Photo Or Logo',
        price: 450,
        description: 'Custom plant mug with photo or logo print.'
    },
    {
        id: 22,
        code: 'BG04',
        name: 'Magic Mug',
        price: 550,
        description: 'Photo appears only when the mug is filled with hot drink.'
    },
    {
        id: 23,
        code: 'BG05',
        name: 'Acrylic Couple Names',
        price: 1250,
        description: 'Personalized acrylic display featuring couple names.'
    },
    {
        id: 24,
        code: 'BG06',
        name: 'Customised Keychains',
        price: 180,
        description: 'Custom keychains for parties, gifts, and keepsakes.'
    },
    {
        id: 25,
        code: 'BG07',
        name: 'Photo Pillow',
        price: 650,
        description: 'Soft pillow printed with your favorite photo.'
    },
    {
        id: 26,
        code: 'BG08',
        name: 'Signature Day T-Shirts',
        price: 350,
        description: 'Signature day t-shirts custom designed for celebrations.'
    },
    {
        id: 27,
        code: 'BG09',
        name: 'Mobile Pop Sockets with your Photo',
        price: 99,
        description: 'Photo pop sockets to personalize your mobile grip.'
    },
    {
        id: 28,
        code: 'BG10',
        name: 'Customised Sashes',
        price: 99,
        description: 'Customised sashes for events, celebrations, and awards.'
    },
    {
        id: 29,
        code: 'BG11',
        name: 'Premium Customised Mobile Case',
        price: 450,
        description: 'Premium mobile case customized with your design.'
    },
    {
        id: 30,
        code: 'BG12',
        name: 'Resin Art',
        price: 3500,
        description: 'Handcrafted resin art pieces for decorative gifting.'
    },
    {
        id: 31,
        code: 'BG13',
        name: 'Polaroid Photos',
        price: 250,
        description: 'Retro polaroid-style printed photo keepsakes.'
    },
    {
        id: 32,
        code: 'BG14',
        name: 'Resin Art',
        price: 3500,
        description: 'Unique resin art masterpiece for premium gifting.'
    },
    {
        id: 33,
        code: 'BG15',
        name: 'Photo Alarm Clock',
        price: 550,
        description: 'Alarm clock customized with a special photo.'
    },
    {
        id: 34,
        code: 'BG16',
        name: 'A4 Certificate Frames',
        price: 500,
        description: 'A4 frames ideal for certificates, awards, and diplomas.'
    },
    {
        id: 35,
        code: 'BG17',
        name: 'College-Events-Wedding-Corporate Keychai',
        price: 80,
        description: 'Keychain gifts suitable for colleges, weddings, and corporate events.'
    },
    {
        id: 36,
        code: 'BG18',
        name: 'Customised Combo Gift Hamper',
        price: 1250,
        description: 'Custom combo gift hamper for special gifting needs.'
    },
    {
        id: 37,
        code: 'BG19',
        name: 'Customised Combo Gift Hamper',
        price: 1599,
        description: 'Larger customised gift hamper with premium items.'
    },
    {
        id: 38,
        code: 'BG20',
        name: 'Customised Tshirt',
        price: 550,
        description: 'Personalized custom t-shirt for every occasion.'
    },
    {
        id: 39,
        code: 'BG21',
        name: 'Customised Combo Gift Hamper',
        price: 2499,
        description: 'Deluxe customised combo gift hamper for premium gifting.'
    },
    {
        id: 40,
        code: 'BG22',
        name: 'ALL SPORTS FULLY CUSTOM',
        price: 650,
        description: 'Fully custom sports-themed gift options.'
    },
    {
        id: 41,
        code: 'BG23',
        name: 'OCCASION BASED FULL CUSTOMISED TSHIRTS FOR MOM-TO-BE. DAD-TO-BE.',
        price: 550,
        description: 'Occasion-based customized tees for expecting parents.'
    },
    {
        id: 42,
        code: 'BG24',
        name: 'Dog Photo Frame',
        price: 350,
        description: 'Photo frame specially designed for pet dog photo displays.'
    }
];

const frameSizePairs = [
    { width: '8', height: '12', label: '8/12 Inch', price: 500 },
    { width: 'A4', height: 'A4', label: 'A4 Size', price: 650 },
    { width: '12', height: '18', label: '12/18 Inch', price: 999 },
    { width: '20', height: '30', label: '20/30 Inch', price: 3500 }
];

const frameProducts = Array.from({ length: 27 }, (_, index) => {
    const code = `F${index + 1}`;
    return {
        id: 100 + index,
        code,
        name: `Photo Frame ${code}`,
        price: 'From ₹500',
        description: 'High-quality photo frame available in multiple sizes.',
        category: 'Photo Frames',
        sizeOptions: frameSizePairs
    };
});

function formatPrice(value) {
    if (typeof value === 'number') {
        return `₹${value.toLocaleString('en-IN')}`;
    }
    return value || 'Price on request';
}

const pngProducts = new Set([
    'AP01','BG01','BG02','BG03','BG04','BG05','BG06','BG07','BG08','BG09','BG10','BG11','BG12','BG13','BG14','BG15','BG16','BG17','BG18','BG19','BG20','BG21','BG22','BG23','BG24',
    'BR01','CH01','CH02','CH03','CH04','CL01','CO01','CO02','CO03','KC01','KC02','LA01','LL01','NB01','PKC04','TU01','PKC03'
]);

const assetBasePath = location.pathname.includes('/pages/') ? '../' : '';
const cartItems = loadCart();
let checkoutData = {};

function assetPath(path) {
    return `${assetBasePath}${path}`;
}

function normalizeImageStoragePath(imagePath) {
    if (!imagePath) return imagePath;
    return imagePath.replace(/^(\.\.\/|\.\/)+/, '');
}

function resolveImagePath(imagePath) {
    if (!imagePath) return imagePath;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/')) {
        return imagePath;
    }
    if (imagePath.startsWith('./') || imagePath.startsWith('../')) {
        return assetPath(imagePath.replace(/^(\.\.\/|\.\/)+/, ''));
    }
    return assetPath(imagePath);
}

function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem('bunnyCart') || '[]');
        return Array.isArray(saved)
            ? saved.map(item => ({ ...item, quantity: item.quantity || 1 }))
            : [];
    } catch {
        return [];
    }
}

function saveCart() {
    localStorage.setItem('bunnyCart', JSON.stringify(cartItems));
    updateCartCount();
}

function updateCartCount() {
    const count = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const badge = document.getElementById('cartCount');
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('d-none', count === 0);
    }
}

function getProductImage(product) {
    if (String(product.code).startsWith('F')) {
        return assetPath(`images/frames/${product.code.slice(1)}.png`);
    }

    return pngProducts.has(product.code)
        ? assetPath(`images/${product.code}.png`)
        : assetPath(`images/${product.code}.svg`);
}

function getPageProducts() {
    const path = location.pathname;
    if (path.includes('photo-frames.html')) {
        return frameProducts;
    }
    if (path.includes('all-gifts.html')) {
        return [...products, ...frameProducts];
    }
    return products;
}

function createCartModalMarkup() {
    if (document.getElementById('cartModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="cartModal" tabindex="-1" aria-labelledby="cartModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="cartModalLabel">Your Cart</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="cartModalBody"></div>
                </div>
            </div>
        </div>
    `);
}

function openCartModal() {
    createCartModalMarkup();
    const modalBody = document.getElementById('cartModalBody');
    if (!modalBody) return;

    modalBody.innerHTML = renderCartPreview();
    const cartModalEl = document.getElementById('cartModal');
    const cartModal = new bootstrap.Modal(cartModalEl);
    cartModal.show();
}

function renderCartPreview() {
    if (cartItems.length === 0) {
        return `
            <div class="text-center py-5">
                <h5>Your cart is empty</h5>
                <p class="text-muted">Add premium products to start your order.</p>
            </div>
        `;
    }

    const totalCost = cartItems.reduce((sum, item) => sum + ((item.pricePerUnit || item.price) * (item.quantity || 1)), 0);
    const itemCards = cartItems.map((item, index) => {
        const quantity = item.quantity || 1;
        const unitPrice = item.pricePerUnit || item.price;
        return `
        <div class="card mb-3">
            <div class="row g-0 align-items-center">
                <div class="col-auto p-3">
                    <img src="${resolveImagePath(item.image || getProductImage(item))}" alt="${item.name}" class="img-fluid cart-item-thumbnail">
                </div>
                <div class="col">
                    <div class="card-body py-3">
                        <h5 class="card-title mb-2">${item.name}</h5>
                        <p class="mb-1"><strong>Code:</strong> ${item.code}</p>
                        ${item.size ? `<p class="mb-1"><strong>Size:</strong> ${item.size}</p>` : ''}
                        <p class="mb-1"><strong>Unit Price:</strong> ${formatPrice(unitPrice)}</p>
                        <p class="mb-1"><strong>Item Total:</strong> ${formatPrice(unitPrice * quantity)}</p>
                        <div class="d-flex align-items-center gap-2 mt-2">
                            <button class="btn btn-outline-secondary btn-sm" onclick="changeCartItemQuantity(${index}, -1)">-</button>
                            <input type="number" class="form-control form-control-sm cart-quantity-input" value="${quantity}" min="1" onchange="setCartItemQuantity(${index}, this.value)">
                            <button class="btn btn-outline-secondary btn-sm" onclick="changeCartItemQuantity(${index}, 1)">+</button>
                        </div>
                    </div>
                </div>
                <div class="col-auto pe-3">
                    <button class="btn btn-outline-danger" onclick="removeCartItem(${index})">Remove</button>
                </div>
            </div>
        </div>
    `;
    }).join('');

    return `
        <div class="mb-4">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3">
                <div>
                    <h5 class="mb-1">Cart Preview</h5>
                    <p class="text-muted mb-0">${cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0)} selected item${cartItems.length > 1 ? 's' : ''}</p>
                </div>
                <div class="text-md-end">
                    <div class="fs-5 fw-semibold">Total: ${formatPrice(totalCost)}</div>
                </div>
            </div>
        </div>
        ${itemCards}
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mt-3">
            <div><strong>Total Items:</strong> ${cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0)}</div>
            <button class="btn btn-primary btn-lg" onclick="openCheckoutForm()">Proceed to Place The Order</button>
        </div>
    `;
}

function removeCartItem(index) {
    cartItems.splice(index, 1);
    saveCart();
    const modalBody = document.getElementById('cartModalBody');
    if (modalBody) {
        modalBody.innerHTML = renderCartPreview();
    }
}

function setCartItemQuantity(index, value) {
    const quantity = parseInt(value, 10);
    if (Number.isNaN(quantity) || quantity < 1) {
        return;
    }
    if (!cartItems[index]) return;
    cartItems[index].quantity = quantity;
    saveCart();
    const modalBody = document.getElementById('cartModalBody');
    if (modalBody) {
        modalBody.innerHTML = renderCartPreview();
    }
}

function changeCartItemQuantity(index, delta) {
    if (!cartItems[index]) return;
    const newQuantity = (cartItems[index].quantity || 1) + delta;
    if (newQuantity < 1) return;
    setCartItemQuantity(index, newQuantity);
}

function getFrameSizeOption(width, height) {
    return frameSizePairs.find(option => option.width === width && option.height === height) || null;
}

function getHeightsForWidth(width) {
    return Array.from(new Set(frameSizePairs.filter(option => option.width === width).map(option => option.height)));
}

function updateFrameModalSize(productId) {
    const product = [...products, ...frameProducts].find(p => p.id == productId);
    if (!product || !product.sizeOptions) return;

    const widthSelect = document.getElementById('modalProductWidth');
    const heightSelect = document.getElementById('modalProductHeight');
    if (!widthSelect || !heightSelect) return;

    const width = widthSelect.value;
    const heightOptions = getHeightsForWidth(width);
    heightSelect.innerHTML = heightOptions.map(height => `
        <option value="${height}">${height}</option>
    `).join('');

    const selectedHeight = heightSelect.value;
    const option = getFrameSizeOption(width, selectedHeight);
    const priceDisplay = document.getElementById('modalPriceDisplay');
    const proceedButton = document.getElementById('productModalProceed');

    if (priceDisplay) {
        priceDisplay.textContent = option ? formatPrice(option.price) : 'Not available';
    }
    if (proceedButton) {
        proceedButton.disabled = !option;
    }
}

function openCheckoutForm() {
    const modalBody = document.getElementById('cartModalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <h5 class="mb-3">Shipping / Delivery Address</h5>
        <form id="checkoutForm">
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Full Name</label>
                    <input type="text" name="name" class="form-control" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-control" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" name="phone" class="form-control" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Pincode</label>
                    <input type="text" name="pincode" class="form-control" required>
                </div>
                <div class="col-12">
                    <label class="form-label">Address</label>
                    <textarea name="address" class="form-control" rows="3" required></textarea>
                </div>
                <div class="col-md-6">
                    <label class="form-label">City</label>
                    <input type="text" name="city" class="form-control" required>
                </div>
                <div class="col-md-6">
                    <label class="form-label">State</label>
                    <input type="text" name="state" class="form-control" required>
                </div>
            </div>
            <div class="mt-4 d-flex justify-content-between flex-column flex-md-row gap-3">
                <button type="button" class="btn btn-secondary" onclick="openCartModal()">Back to Cart</button>
                <button type="button" class="btn btn-primary" onclick="showPaymentQR()">Payment</button>
            </div>
        </form>
    `;
}

function showPaymentQR() {
    const form = document.getElementById('checkoutForm');
    if (!form) return;

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();
    const city = form.city.value.trim();
    const state = form.state.value.trim();
    const pincode = form.pincode.value.trim();

    if (!name || !email || !phone || !address || !city || !state || !pincode) {
        alert('Please complete all shipping details before continuing.');
        return;
    }

    checkoutData = { name, email, phone, address, city, state, pincode };
    const modalBody = document.getElementById('cartModalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <h5 class="mb-3">PhonePe Payment</h5>
        <p class="text-muted">Scan the QR code below using PhonePe and then enter your transaction ID to complete the order.</p>
        <div class="qr-payment-wrapper text-center py-3">
            <div class="qr-image-frame">
                <img src="${assetPath('images/payment-qr.png')}" alt="PhonePe Payment QR Code" class="qr-payment-image">
            </div>
        </div>
        <div class="mt-4">
            <label for="transactionIdInput" class="form-label fw-semibold">Transaction ID</label>
            <input type="text" id="transactionIdInput" class="form-control form-control-lg" placeholder="Enter your PhonePe transaction ID" autocomplete="off" required>
            <small class="text-muted">Please enter the transaction ID shown in your PhonePe app after the payment.</small>
        </div>
        <div class="mt-4 text-center">
            <button type="button" class="btn btn-primary btn-lg" onclick="submitTransactionDetails()">Submit The Transaction Details</button>
        </div>
    `;
}

function submitTransactionDetails() {
    if (!checkoutData.name) {
        alert('Please complete the checkout form first.');
        return;
    }

    if (cartItems.length === 0) {
        alert('Your cart is empty.');
        return;
    }

    const transactionInput = document.getElementById('transactionIdInput');
    const transactionId = transactionInput ? transactionInput.value.trim() : '';
    if (!transactionId) {
        alert('Please enter the Transaction ID from your PhonePe app before submitting.');
        if (transactionInput) transactionInput.focus();
        return;
    }

    const ownerEmail = 'brscustomgifts@gmail.com';
    const totalCost = cartItems.reduce((sum, item) => sum + ((item.pricePerUnit || item.price) * (item.quantity || 1)), 0);
    const totalQty = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const productLines = cartItems.map(item => {
        const quantity = item.quantity || 1;
        const unitPrice = item.pricePerUnit || item.price;
        return `- ${item.name} (Code: ${item.code}${item.size ? `, Size: ${item.size}` : ''}) x ${quantity} = ${formatPrice(unitPrice * quantity)}`;
    }).join('\n');

    const plainBody = [
        'New order from Bunny Gift Store website',
        '',
        'Payment details:',
        `Transaction ID: ${transactionId}`,
        `Total Payment Amount: ${formatPrice(totalCost)}`,
        '',
        'Customer details:',
        `Name: ${checkoutData.name}`,
        `Email: ${checkoutData.email}`,
        `Phone: ${checkoutData.phone}`,
        `Address: ${checkoutData.address}, ${checkoutData.city}, ${checkoutData.state} - ${checkoutData.pincode}`,
        '',
        'Order details:',
        productLines,
        '',
        `Total quantity: ${totalQty}`,
        `Total cost: ${formatPrice(totalCost)}`,
        ''
    ].join('\n');

    const subject = encodeURIComponent('New Order from Bunny Gift Store');
    const body = encodeURIComponent(plainBody);
    window.location.href = `mailto:${ownerEmail}?subject=${subject}&body=${body}`;
}

// ==================== PRODUCT RENDERING ==================== 
function renderProducts(containerId, productsArray = products) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = productsArray.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image-wrapper">
                <img src="${getProductImage(product)}" alt="${product.name}" class="product-image" loading="lazy">
                <span class="product-badge">${product.code}</span>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-short">${product.description}</p>
                <div class="product-meta d-flex flex-wrap gap-3 align-items-center justify-content-between">
                    <div class="product-price">${formatPrice(product.price)}</div>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="openProductModal(${product.id})">View Details</button>
                </div>
            </div>
        </div>
    `).join('');

    // Add click event listeners for product cards
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('button')) {
                return;
            }
            openProductModal(this.dataset.productId);
        });
    });
}

// ==================== MODAL FUNCTIONALITY ====================
function openProductModal(productId) {
    const allProducts = [...products, ...frameProducts];
    const product = allProducts.find(p => p.id == productId);
    if (!product) return;

    const modal = document.getElementById('productModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="modal-product-grid">
            <div>
                <img src="${getProductImage(product)}" alt="${product.name}" class="modal-product-image" loading="lazy">
            </div>
            <div class="modal-product-details">
                <div class="modal-product-code">Code: ${product.code}</div>
                <h3 class="modal-product-title">${product.name}</h3>
                <p class="modal-product-price" id="modalPriceDisplay">${product.sizeOptions ? formatPrice(product.sizeOptions[0].price) : formatPrice(product.price)}</p>
                <p class="modal-description">${product.description}</p>
                ${product.sizeOptions ? `
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label for="modalProductWidth" class="form-label">Width</label>
                            <select id="modalProductWidth" class="form-select" onchange="updateFrameModalSize(${product.id})">
                                ${Array.from(new Set(frameSizePairs.map(option => option.width))).map(width => `
                                    <option value="${width}">${width}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="modalProductHeight" class="form-label">Height</label>
                            <select id="modalProductHeight" class="form-select" onchange="updateFrameModalSize(${product.id})"></select>
                        </div>
                    </div>
                ` : `
                   
                `}
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-primary" onclick="addToCart(${product.id})">Add to Cart</button>
            <button class="btn btn-secondary" onclick="closeProductModal()">Close</button>
        </div>
    `;

    updateFrameModalSize(product.id);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function addToCart(productId) {
    const allProducts = [...products, ...frameProducts];
    const product = allProducts.find(p => p.id == productId);
    if (!product) return;

    let selectedSize = '';
    let pricePerUnit = product.price;
    if (product.sizeOptions) {
        const widthSelect = document.getElementById('modalProductWidth');
        const heightSelect = document.getElementById('modalProductHeight');
        const width = widthSelect ? widthSelect.value : '';
        const height = heightSelect ? heightSelect.value : '';
        const option = getFrameSizeOption(width, height) || product.sizeOptions[0];
        selectedSize = option.label;
        pricePerUnit = option.price;
    }

    const quantityInput = document.getElementById('modalProductQuantity');
    const quantity = quantityInput ? Math.max(1, parseInt(quantityInput.value, 10) || 1) : 1;

    const cartProduct = {
        id: product.id,
        code: product.code,
        name: product.name,
        pricePerUnit,
        price: pricePerUnit,
        size: selectedSize,
        quantity,
        image: normalizeImageStoragePath(getProductImage(product))
    };

    const existingIndex = cartItems.findIndex(item => item.id === cartProduct.id && item.size === cartProduct.size);
    if (existingIndex > -1) {
        cartItems[existingIndex].quantity += quantity;
    } else {
        cartItems.push(cartProduct);
    }

    saveCart();
    closeProductModal();
}

// ==================== MODAL CLOSE HANDLERS ====================
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('productModal');
    
    if (modal) {
        // Close modal when clicking the close button
        const closeBtn = document.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeProductModal);
        }

        // Close modal when clicking outside content
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeProductModal();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('productModal');
            if (modal && modal.style.display === 'block') {
                closeProductModal();
            }
        }
    });

    // Attach header cart button event
    const cartButton = document.getElementById('cartButton');
    if (cartButton) {
        cartButton.addEventListener('click', function(event) {
            event.preventDefault();
            openCartModal();
        });
    }

    // Render products for pages with a product grid
    const productsContainer = document.getElementById('productsContainer');
    if (productsContainer) {
        renderProducts('productsContainer', getPageProducts());
    }

    updateCartCount();
});

// ==================== CONTACT FORM HANDLING ====================
function handleContactForm(event) {
    event.preventDefault();
    
    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    const phone = document.getElementById('contactPhone').value;
    const message = document.getElementById('contactMessage').value;

    if (!name || !email || !phone || !message) {
        alert('Please fill all fields!');
        return;
    }

    // Simulate form submission
    console.log('Form submitted:', { name, email, phone, message });
    alert('Thank you for your message! We will contact you soon.');
    
    // Reset form
    event.target.reset();
}

// ==================== SMOOTH SCROLLING ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const element = document.querySelector(href);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// ==================== ANIMATION ON SCROLL ====================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.product-card, .feature-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// ==================== UTILITY FUNCTIONS ====================
function updateProductData(newProducts) {
    products.length = 0;
    products.push(...newProducts);
    if (document.getElementById('productsContainer')) {
        renderProducts('productsContainer');
    }
}

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { products, renderProducts, openProductModal, closeProductModal, updateProductData };
}

// ==================== CONTENT PROTECTION ====================
(function enableContentProtection() {
    const isProtectedTarget = (target) => {
        if (!target || !target.closest) return false;
        return !!target.closest(
            '.product-image, .modal-product-image, .qr-payment-image, ' +
            '.product-card, .product-image-wrapper, .modal-product-grid, ' +
            '.product-name, .product-short, .product-description, ' +
            '.modal-description, .modal-product-details, ' +
            '.product-price, .modal-product-price, .modal-product-code'
        );
    };

    document.addEventListener('contextmenu', (e) => {
        if (isProtectedTarget(e.target)) {
            e.preventDefault();
        }
    });

    document.addEventListener('dragstart', (e) => {
        const tag = e.target && e.target.tagName;
        if (tag === 'IMG' || isProtectedTarget(e.target)) {
            e.preventDefault();
        }
    });

    document.addEventListener('copy', (e) => {
        if (isProtectedTarget(e.target)) {
            e.preventDefault();
        }
    });

    document.addEventListener('keydown', (e) => {
        const key = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'u' || key === 'p')) {
            e.preventDefault();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('img').forEach((img) => {
            img.setAttribute('draggable', 'false');
            img.setAttribute('oncontextmenu', 'return false;');
        });
    });
})();

