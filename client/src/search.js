// Client-side fuzzy product search.
//
// The catalogue is small (well under a few hundred items) and already fetched
// for the storefront, so matching runs in memory on every keystroke instead of
// hitting the API. Build the index once per product list, then query it.

// Fold a string to a comparable form: lowercase, accent-free, punctuation
// flattened to spaces. "Photo-Frame (A4)" -> "photo frame a4".
export function normalize(str) {
  return (str || '')
    .toLowerCase()
    // NFD splits "é" into "e" + a combining mark; dropping the marks keeps the
    // word intact, where the [^a-z0-9] pass below would have split it in two.
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// How many typos to forgive in a word of this length. Short words get none:
// at 3 characters a single edit reaches so many unrelated words ("cat" -> hat,
// car, bat) that the results stop feeling related to what was typed.
function typoBudget(len) {
  if (len < 4) return 0;
  if (len < 6) return 1;
  return 2;
}

// True when b is a with one adjacent pair swapped ("mgu" -> "mug"). Unlike a
// substitution, a swap can't quietly turn a word into an unrelated one, so it
// stays safe to forgive even on tokens too short for the budget above.
function isAdjacentSwap(a, b) {
  if (a.length !== b.length) return false;
  const diff = [];
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      diff.push(i);
      if (diff.length > 2) return false;
    }
  }
  return diff.length === 2
    && diff[1] === diff[0] + 1
    && a[diff[0]] === b[diff[1]]
    && a[diff[1]] === b[diff[0]];
}

// Optimal string alignment distance: Levenshtein plus adjacent transpositions,
// so "lmap" still finds "lamp". Gives up as soon as the best possible result
// exceeds `max`, which keeps the common non-match case cheap.
function editDistance(a, b, max) {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  if (!al) return bl;
  if (!bl) return al;

  let prev2 = [];
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;

  for (let i = 1; i <= al; i += 1) {
    curr[0] = i;
    let rowBest = curr[0];
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, prev2[j - 2] + 1); // transposition
      }
      curr[j] = val;
      if (val < rowBest) rowBest = val;
    }
    if (rowBest > max) return max + 1;
    prev2 = prev;
    prev = curr;
    curr = new Array(bl + 1);
  }
  return prev[bl];
}

// Score one search token against one normalized field, 0 (no match) to 1.
// The tiers rank literal hits above forgiven typos, so an exact match always
// outranks a fuzzy one no matter which field it came from.
function scoreToken(token, text, words, fuzzy) {
  if (!text) return 0;
  if (text === token) return 1;
  if (words.includes(token)) return 0.95;
  if (text.startsWith(token)) return 0.9;
  if (words.some((w) => w.startsWith(token))) return 0.85;
  if (text.includes(token)) return 0.7;
  if (!fuzzy) return 0;

  const budget = typoBudget(token.length);
  if (budget === 0) {
    return words.some((w) => isAdjacentSwap(token, w)) ? 0.55 : 0;
  }

  let best = 0;
  for (const w of words) {
    const d = editDistance(token, w, budget);
    if (d > budget) continue;
    // Closer edits score higher, but always below a literal substring hit.
    const s = 0.62 * (1 - d / (token.length + 1));
    if (s > best) best = s;
  }
  return best;
}

// Field weights: a hit in the name means far more than one in the blurb.
// `code` opts out of typo tolerance — codes are exact identifiers, so forgiving
// an edit there makes "LA01" also return the unrelated product coded "LL01".
const FIELDS = [
  { key: 'name', weight: 1, fuzzy: true },
  { key: 'code', weight: 0.9, fuzzy: false },
  { key: 'category', weight: 0.72, fuzzy: true },
  { key: 'description', weight: 0.45, fuzzy: true },
];

// Precompute the normalized text once per product so keystrokes only compare.
export function buildSearchIndex(products) {
  return (products || []).map((product) => ({
    product,
    fields: FIELDS.map(({ key, weight, fuzzy }) => {
      const text = normalize(product[key]);
      return { text, words: text ? text.split(' ') : [], weight, fuzzy };
    }),
  }));
}

// Rank an index against a raw query. Every token must hit something (an AND),
// so extra words narrow the list rather than flooding it with loose matches.
// Returns every match, ranked: the caller decides how many to render, and needs
// the full length to report an honest count.
export function searchIndex(index, query, limit = Infinity) {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length) return [];

  const hits = [];
  for (const entry of index) {
    let total = 0;
    let matchedAll = true;

    for (const token of tokens) {
      let best = 0;
      for (const field of entry.fields) {
        const s = scoreToken(token, field.text, field.words, field.fuzzy) * field.weight;
        if (s > best) best = s;
      }
      if (best === 0) { matchedAll = false; break; }
      total += best;
    }
    if (!matchedAll) continue;

    let score = total / tokens.length;
    // Reward the full phrase landing in the name ("heart lamp" over two
    // products that merely mention "heart" and "lamp" separately).
    if (tokens.length > 1 && entry.fields[0].text.includes(q)) score += 0.15;
    // Nudge orderable items above unorderable ones when scores tie.
    if (entry.product.outOfStock) score -= 0.02;

    hits.push({ product: entry.product, score });
  }

  hits.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
  return (limit === Infinity ? hits : hits.slice(0, limit)).map((h) => h.product);
}

// Split text into segments flagged as matched, for emphasising the hit in the
// results list. Literal substrings only — a typo-forgiven match has nothing
// meaningful to underline, so it simply renders plain.
export function highlightSegments(text, query) {
  const src = text || '';
  const hay = src.toLowerCase();
  const tokens = (query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);

  const ranges = [];
  for (const t of tokens) {
    let from = 0;
    let i = hay.indexOf(t, from);
    while (i !== -1) {
      ranges.push([i, i + t.length]);
      from = i + t.length;
      i = hay.indexOf(t, from);
    }
  }
  if (!ranges.length) return [{ text: src, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: src.slice(pos, s), hit: false });
    out.push({ text: src.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < src.length) out.push({ text: src.slice(pos), hit: false });
  return out;
}
