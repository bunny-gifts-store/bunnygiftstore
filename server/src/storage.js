import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// Durable image storage.
//
// Product images (admin uploads / camera captures) must survive server
// restarts. Render's disk is ephemeral, so writing them to server/uploads
// loses them on every restart — the same class of problem Turso fixed for the
// database.
//
// When CLOUDINARY_URL is set (a single env var:
//   cloudinary://<api_key>:<api_secret>@<cloud_name>
// which the SDK reads automatically) images are uploaded to Cloudinary and we
// store the returned HTTPS CDN URL on the product. The frontend's resolveImage()
// already passes absolute http(s) URLs through untouched, so nothing else needs
// to change. Without the env var we fall back to the local uploads folder, so
// local dev behaves exactly as before.
// ---------------------------------------------------------------------------
export const usingCloudinary = Boolean(process.env.CLOUDINARY_URL);

if (usingCloudinary) {
  // cloudinary.config() auto-reads CLOUDINARY_URL; force https URLs back.
  cloudinary.config({ secure: true });
  console.log('[storage] Using Cloudinary for durable product images.');
} else {
  console.log('[storage] Using local uploads folder (images are NOT durable across restarts).');
}

// Persist an uploaded image buffer and return the path/URL to store on the
// product. Cloudinary -> absolute HTTPS URL; local -> "uploads/<file>".
export async function saveImage(buffer, originalName, mimetype) {
  if (usingCloudinary) {
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
    if (/^https?:\/\/res\.cloudinary\.com\//i.test(image)) {
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
