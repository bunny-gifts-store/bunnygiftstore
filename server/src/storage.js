import fs from 'fs';
import path from 'path';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// Durable image storage.
//
// Product images (admin uploads / camera captures) must survive server
// restarts. Render's disk is ephemeral, so writing them to server/uploads loses
// them on every restart — the same class of problem Postgres solves for the
// database.
//
// When CLOUDINARY_URL is set to a VALID value
//   cloudinary://<api_key>:<api_secret>@<cloud_name>
// images are uploaded to Cloudinary and we store the returned HTTPS CDN URL on
// the product (the frontend's resolveImage() passes absolute URLs through
// untouched). Otherwise we fall back to the local uploads folder, so local dev
// is unchanged.
//
// IMPORTANT: the cloudinary SDK parses process.env.CLOUDINARY_URL when it loads
// and THROWS on a malformed value — which would crash the whole API at boot.
// So we validate the value ourselves first and only import/enable Cloudinary
// when it is well-formed; a bad value is ignored (local fallback + a warning),
// never fatal. A typo in one env var must not take the store offline.
// ---------------------------------------------------------------------------

// Well-formed: cloudinary://<key>:<secret>@<cloud> with no whitespace, quotes,
// angle brackets, or extra ':'/'@' inside the three segments. This rejects the
// common mistakes: leftover <placeholders>, a missing @cloud_name, and stray
// quotes pasted around the value.
const CLOUDINARY_RE = /^cloudinary:\/\/[^\s:@'"<>]+:[^\s:@'"<>]+@[^\s:@'"<>]+$/;

const rawUrl = process.env.CLOUDINARY_URL || '';
const cleanedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, ''); // tolerate surrounding whitespace/quotes
const cloudinaryValid = CLOUDINARY_RE.test(cleanedUrl);

let cloudinary = null;
export let usingCloudinary = false;

if (rawUrl && !cloudinaryValid) {
  console.error(
    '[storage] CLOUDINARY_URL is set but MALFORMED — expected ' +
    'cloudinary://<api_key>:<api_secret>@<cloud_name> (no <> placeholders, no ' +
    'quotes, and it must end with @your-cloud-name). Ignoring it and using ' +
    'local disk (images will NOT persist across restarts).'
  );
  // Make sure the cloudinary SDK never sees (and chokes on) the bad value.
  delete process.env.CLOUDINARY_URL;
}

if (cloudinaryValid) {
  // Normalise the env var to the cleaned value so the SDK parses cleanly.
  process.env.CLOUDINARY_URL = cleanedUrl;
  try {
    const mod = await import('cloudinary');
    cloudinary = mod.v2;
    cloudinary.config({ secure: true }); // keep the URL-derived creds; force https
    usingCloudinary = true;
    console.log('[storage] Using Cloudinary for durable product images.');
  } catch (err) {
    usingCloudinary = false;
    console.error('[storage] Cloudinary init failed, using local disk instead:', err.message);
  }
} else {
  console.log('[storage] Using local uploads folder (images are NOT durable across restarts).');
}

// Persist an uploaded image buffer and return the path/URL to store on the
// product. Cloudinary -> absolute HTTPS URL; local -> "uploads/<file>".
export async function saveImage(buffer, originalName, mimetype) {
  if (usingCloudinary && cloudinary) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bunnygiftstore/products', resource_type: 'image' },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(buffer);
    });
    return result.secure_url;
  }

  // Local fallback: write to the uploads dir with a unique name.
  const ext = (path.extname(originalName || '').toLowerCase()) || extFromMime(mimetype) || '.png';
  const filename = `item-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(config.uploadsDir, filename), buffer);
  return `uploads/${filename}`;
}

// Best-effort delete of a previously-stored image when its product is removed.
export async function deleteImage(image) {
  if (!image) return;
  try {
    if (usingCloudinary && cloudinary && /^https?:\/\/res\.cloudinary\.com\//i.test(image)) {
      const publicId = cloudinaryPublicId(image);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    } else if (image.startsWith('uploads/')) {
      fs.rm(path.join(config.uploadsDir, path.basename(image)), () => {});
    }
  } catch { /* non-critical cleanup */ }
}

function extFromMime(mimetype) {
  const m = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
  return m[mimetype] || '';
}

// Extract the Cloudinary public id (incl. folder, minus extension) from a URL:
// https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg
//   -> folder/name
function cloudinaryPublicId(url) {
  const m = String(url).match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i);
  return m ? m[1] : null;
}
