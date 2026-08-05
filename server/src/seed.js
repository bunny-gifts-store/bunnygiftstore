import bcrypt from 'bcryptjs';
import { db, usingTurso, persist } from './db.js';
import { config } from './config.js';

// Category taxonomy (sortOrder = display order).
export const CATEGORIES = [
  'Personalised Keepsakes',
  'Jewellery & Lockets',
  'Keychains',
  'Photo Frames',
  'Home & Decor',
  'Mugs & Drinkware',
  'Apparel & T-shirts',
  'Corporate Gifts',
  'Lamps & Lighting',
  'Baby & Kids',
  'Mobile Accessories',
  'Party & Events',
];

// The existing 42 storefront products, now with an assigned category.
// image paths are relative to the frontend public root (images/CODE.png).
export const PRODUCTS = [
  { code: 'LA01', name: 'Premium Heart Lamp', price: 350, category: 'Lamps & Lighting', description: 'Romantic premium heart lamp with glowing LED lighting.' },
  { code: 'CO01', name: 'Corporate Gift Combo Set', price: 1250, category: 'Corporate Gifts', description: 'Premium gifting combo ideal for corporate events and clients.' },
  { code: 'NB01', name: 'New Born Baby T-shirts & Rompers', price: 550, category: 'Baby & Kids', description: 'Soft newborn baby t-shirts and rompers in cute designs.' },
  { code: 'KC01', name: 'David Keychain', price: 550, category: 'Keychains', description: 'Personalized David keychain with elegant design.' },
  { code: 'KC02', name: 'Eye Pendant', price: 650, category: 'Jewellery & Lockets', description: 'Beautiful eye-shaped pendant for a unique gift.' },
  { code: 'LL01', name: 'Vintage Love Letter', price: 350, category: 'Personalised Keepsakes', description: 'Romantic vintage love letter presentation for special occasions.' },
  { code: 'PKC03', name: 'Heart Photo Keychain Premium', price: 550, category: 'Keychains', description: 'Premium heart-shaped photo keychain for keepsake memories.' },
  { code: 'CH01', name: 'Name Pendant', price: 99, category: 'Jewellery & Lockets', description: 'Custom name pendant with polished finish.' },
  { code: 'BR01', name: 'Name Bracelet', price: 249, category: 'Jewellery & Lockets', description: 'Adjustable name bracelet for a personalized gift.' },
  { code: 'CH02', name: 'Name Locket', price: 249, category: 'Jewellery & Lockets', description: 'Classic name locket with elegant detailing.' },
  { code: 'CH03', name: 'Heart Locket', price: 550, category: 'Jewellery & Lockets', description: 'Romantic heart-shaped locket with photo space.' },
  { code: 'CH04', name: 'Hidden Name Locket', price: 250, category: 'Jewellery & Lockets', description: 'A hidden name locket for subtle personalized gifting.' },
  { code: 'PKC04', name: 'Box Photo Keychain Premium', price: 550, category: 'Keychains', description: 'Premium box-shaped photo keychain for cherished moments.' },
  { code: 'CO02', name: 'Personal and Corporate Gifting', price: 360, category: 'Corporate Gifts', description: 'Versatile gifting options for personal and corporate needs.' },
  { code: 'AP01', name: 'Cotton T-shirt (Customised) Round Neck', price: 550, category: 'Apparel & T-shirts', description: 'Comfortable custom cotton round neck t-shirt.' },
  { code: 'CL01', name: 'Acrylic Clock - Wooden Clock with Photo or Logo Print', price: 999, category: 'Home & Decor', description: 'Decorative acrylic clock with custom photo or logo print.' },
  { code: 'BG01', name: 'Magic Mirror with Photo', price: 750, category: 'Home & Decor', description: 'Magic mirror that reveals a photo when exposed to heat.' },
  { code: 'BG02', name: 'Heart Magic Mirror', price: 750, category: 'Home & Decor', description: 'Heart-shaped magic mirror for romantic gifting.' },
  { code: 'CO03', name: 'Pen Stand Suitable for Office, Home Desk, Desktop', price: 750, category: 'Corporate Gifts', description: 'Elegant pen stand perfect for office and home desks.' },
  { code: 'BG03', name: 'Plant Mug with Photo Or Logo', price: 450, category: 'Mugs & Drinkware', description: 'Custom plant mug with photo or logo print.' },
  { code: 'BG04', name: 'Magic Mug', price: 550, category: 'Mugs & Drinkware', description: 'Photo appears only when the mug is filled with hot drink.' },
  { code: 'BG05', name: 'Acrylic Couple Names', price: 1250, category: 'Home & Decor', description: 'Personalized acrylic display featuring couple names.' },
  { code: 'BG06', name: 'Customised Keychains', price: 180, category: 'Keychains', description: 'Custom keychains for parties, gifts, and keepsakes.' },
  { code: 'BG07', name: 'Photo Pillow', price: 650, category: 'Personalised Keepsakes', description: 'Soft pillow printed with your favorite photo.' },
  { code: 'BG08', name: 'Signature Day T-Shirts', price: 350, category: 'Apparel & T-shirts', description: 'Signature day t-shirts custom designed for celebrations.' },
  { code: 'BG09', name: 'Mobile Pop Sockets with your Photo', price: 99, category: 'Mobile Accessories', description: 'Photo pop sockets to personalize your mobile grip.' },
  { code: 'BG10', name: 'Customised Sashes', price: 99, category: 'Party & Events', description: 'Customised sashes for events, celebrations, and awards.' },
  { code: 'BG11', name: 'Premium Customised Mobile Case', price: 450, category: 'Mobile Accessories', description: 'Premium mobile case customized with your design.' },
  { code: 'BG12', name: 'Resin Art', price: 3500, category: 'Personalised Keepsakes', description: 'Handcrafted resin art pieces for decorative gifting.' },
  { code: 'BG13', name: 'Polaroid Photos', price: 250, category: 'Personalised Keepsakes', description: 'Retro polaroid-style printed photo keepsakes.' },
  { code: 'BG14', name: 'Resin Art', price: 3500, category: 'Personalised Keepsakes', description: 'Unique resin art masterpiece for premium gifting.' },
  { code: 'BG15', name: 'Photo Alarm Clock', price: 550, category: 'Home & Decor', description: 'Alarm clock customized with a special photo.' },
  { code: 'BG16', name: 'A4 Certificate Frames', price: 500, category: 'Photo Frames', description: 'A4 frames ideal for certificates, awards, and diplomas.' },
  { code: 'BG17', name: 'College-Events-Wedding-Corporate Keychai', price: 80, category: 'Keychains', description: 'Keychain gifts suitable for colleges, weddings, and corporate events.' },
  { code: 'BG18', name: 'Customised Combo Gift Hamper', price: 1250, category: 'Corporate Gifts', description: 'Custom combo gift hamper for special gifting needs.' },
  { code: 'BG19', name: 'Customised Combo Gift Hamper', price: 1599, category: 'Corporate Gifts', description: 'Larger customised gift hamper with premium items.' },
  { code: 'BG20', name: 'Customised Tshirt', price: 550, category: 'Apparel & T-shirts', description: 'Personalized custom t-shirt for every occasion.' },
  { code: 'BG21', name: 'Customised Combo Gift Hamper', price: 2499, category: 'Corporate Gifts', description: 'Deluxe customised combo gift hamper for premium gifting.' },
  { code: 'BG22', name: 'ALL SPORTS FULLY CUSTOM', price: 650, category: 'Apparel & T-shirts', description: 'Fully custom sports-themed gift options.' },
  { code: 'BG23', name: 'OCCASION BASED FULL CUSTOMISED TSHIRTS FOR MOM-TO-BE. DAD-TO-BE.', price: 550, category: 'Apparel & T-shirts', description: 'Occasion-based customized tees for expecting parents.' },
  { code: 'BG24', name: 'Dog Photo Frame', price: 350, category: 'Photo Frames', description: 'Photo frame specially designed for pet dog photo displays.' },
];

export const FRAME_SIZE_OPTIONS = [
  { width: '8', height: '12', label: '8/12 Inch', price: 500 },
  { width: 'A4', height: 'A4', label: 'A4 Size', price: 650 },
  { width: '12', height: '18', label: '12/18 Inch', price: 999 },
  { width: '20', height: '30', label: '20/30 Inch', price: 3500 },
];

export const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Last seed outcome, surfaced on /api/health so a deploy's result (and any
// failure cause) is verifiable with a simple request — no log access needed.
export const seedStatus = {
  ran: false, skipped: false, products: null, categories: null,
  failedInserts: 0, firstError: null,
};

export function seedDatabase({ force = false } = {}) {
  // Always ensure a default admin exists.
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c;
  if (adminCount === 0) {
    const hash = bcrypt.hashSync(config.defaultAdmin.password, 10);
    db.prepare('INSERT INTO admins (username, passwordHash) VALUES (?, ?)').run(
      config.defaultAdmin.username,
      hash
    );
    console.log(`[seed] Created default admin "${config.defaultAdmin.username}". Change the password after first login.`);
  }

  // Seeding runs outside any HTTP request, so app.js's per-request flush doesn't
  // cover it — fold the default admin (and, below, the catalogue) into the .db
  // file here.
  persist();

  const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (productCount > 0 && !force) {
    console.log('[seed] Products already present; skipping product seed.');
    seedStatus.skipped = true;
    seedStatus.products = productCount;
    seedStatus.categories = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
    return;
  }

  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO categories (name, slug, sortOrder) VALUES (?, ?, ?)'
  );
  const getCategoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
  // POSITIONAL parameters (?), not named (@name): libSQL's remote/hrana protocol
  // (Turso) does not bind @-named parameters, so a named INSERT lands NULLs and
  // fails the NOT NULL columns — which is exactly why products never persisted
  // while the positional category/user/order inserts did. Positional binding
  // works everywhere.
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (code, name, description, price, priceLabel, categoryId, image, sizeOptions, sortOrder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insert one product, logging (but not aborting on) any failure so a single
  // bad row can never wipe out the whole seed — and so the exact cause of a
  // failure is visible in the deploy logs instead of a silent empty catalogue.
  let failed = 0;
  let firstError = null;
  const seedProduct = (row) => {
    try {
      insertProduct.run(
        row.code, row.name, row.description, row.price, row.priceLabel,
        row.categoryId, row.image, row.sizeOptions, row.sortOrder
      );
    } catch (e) {
      failed += 1;
      if (!firstError) firstError = `${row.code}: ${e.message}`;
      if (failed <= 5) console.error(`[seed] product ${row.code} failed:`, e.message);
    }
  };

  const runSeed = () => {
    CATEGORIES.forEach((name, i) => insertCategory.run(name, slugify(name), i));

    PRODUCTS.forEach((p, i) => {
      const categoryId = getCategoryId.get(p.category)?.id ?? null;
      seedProduct({
        code: p.code,
        name: p.name,
        description: p.description,
        price: p.price,
        priceLabel: null,
        categoryId,
        image: `images/${p.code}.png`,
        sizeOptions: null,
        sortOrder: i,
      });
    });

    // Photo frames (F1..F27) with variable size pricing.
    const framesCategoryId = getCategoryId.get('Photo Frames')?.id ?? null;
    for (let i = 0; i < 27; i++) {
      const code = `F${i + 1}`;
      seedProduct({
        code,
        name: `Photo Frame ${code}`,
        description: 'High-quality photo frame available in multiple sizes.',
        price: null,
        priceLabel: 'From ₹500',
        categoryId: framesCategoryId,
        image: `images/frames/${i + 1}.png`,
        sizeOptions: JSON.stringify(FRAME_SIZE_OPTIONS),
        sortOrder: 100 + i,
      });
    }
  };

  // libSQL rejects the client-side BEGIN/COMMIT that a better-sqlite3-style
  // db.transaction() issues against a remote/replica connection
  // (InvalidParserState). The seed is idempotent (INSERT OR IGNORE) and runs
  // only once, so run the statements directly on Turso; keep the transaction
  // (a minor speed-up) only for the plain local SQLite file.
  if (usingTurso) {
    runSeed();
  } else {
    db.transaction(runSeed)();
  }
  persist();
  if (failed) console.error(`[seed] ${failed} product(s) failed to insert.`);
  const total = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  console.log(`[seed] Seeded ${CATEGORIES.length} categories and ${total} products.`);

  seedStatus.ran = true;
  seedStatus.products = total;
  seedStatus.categories = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  seedStatus.failedInserts = failed;
  seedStatus.firstError = firstError;
}

// Allow running directly: `node src/seed.js` or `node src/seed.js --force`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase({ force: process.argv.includes('--force') });
}
