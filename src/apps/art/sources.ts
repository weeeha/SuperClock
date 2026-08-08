import type { Artwork } from './types';

/**
 * Adapters for three open-access museum APIs. All are CORS-enabled and
 * require no key. We round-robin between them so the queue stays mixed
 * even when each fetch returns a same-source batch.
 *
 * - Art Institute of Chicago  https://api.artic.edu/docs/
 * - The Met                   https://metmuseum.github.io/
 * - Cleveland Museum of Art   https://openaccess-api.clevelandart.org/
 */

const TARGET_PIXELS = 1200; // a hair larger than the 1080-circle so cover-crop has slack
const MIN_ASPECT = 0.5; // skip extreme scrolls
const MAX_ASPECT = 2.4; // skip extreme friezes

/* -------------------- Art Institute of Chicago -------------------- */

const AIC_BASE = 'https://api.artic.edu/api/v1/artworks';
const AIC_IIIF = 'https://www.artic.edu/iiif/2';

interface AicResp {
  pagination: { total: number; total_pages: number };
  data: Array<{
    id: number;
    title: string | null;
    artist_display: string | null;
    artist_title: string | null;
    date_display: string | null;
    image_id: string | null;
    thumbnail?: { width: number; height: number } | null;
  }>;
}

async function fetchAicBatch(): Promise<Artwork[]> {
  // AIC has ~125k records; search/results scale better than the raw list endpoint.
  // We restrict to records that have an image and pull a random page from the first 800 (~20k items).
  const page = 1 + Math.floor(Math.random() * 800);
  const url =
    `${AIC_BASE}/search` +
    `?query%5Bexists%5D%5Bfield%5D=image_id` +
    `&fields=id,title,artist_display,artist_title,date_display,image_id,thumbnail` +
    `&limit=25&page=${page}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`AIC ${res.status}`);
  const json = (await res.json()) as AicResp;

  return json.data
    .filter((d) => d.image_id)
    .filter((d) => okAspect(d.thumbnail?.width, d.thumbnail?.height))
    .map<Artwork>((d) => ({
      id: `aic-${d.id}`,
      source: 'aic',
      title: d.title ?? 'Untitled',
      artist: d.artist_title ?? firstLine(d.artist_display ?? ''),
      date: d.date_display ?? '',
      museum: 'Art Institute of Chicago',
      imageUrl: `${AIC_IIIF}/${d.image_id}/full/${TARGET_PIXELS},/0/default.jpg`,
    }));
}

/* -------------------- The Met -------------------- */

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
// The Met `q` is required and uppercase * is rejected. A common keyword gives us
// tens of thousands of IDs back; we rotate the seed to keep the pool fresh.
const MET_SEED_WORDS = ['nature', 'figure', 'portrait', 'landscape', 'study', 'object', 'flower'];

interface MetSearchResp {
  total: number;
  objectIDs: number[] | null;
}
interface MetObject {
  objectID: number;
  primaryImage: string;
  title: string;
  artistDisplayName: string;
  objectDate: string;
}

// Module-level cache: the IDs list is large; fetch once per session per seed.
const metIdsBySeed = new Map<string, number[]>();

async function getMetIds(): Promise<number[]> {
  const seed = MET_SEED_WORDS[Math.floor(Math.random() * MET_SEED_WORDS.length)];
  const cached = metIdsBySeed.get(seed);
  if (cached) return cached;
  const res = await fetch(`${MET_BASE}/search?hasImages=true&q=${seed}`);
  if (!res.ok) throw new Error(`Met search ${res.status}`);
  const json = (await res.json()) as MetSearchResp;
  const ids = json.objectIDs ?? [];
  metIdsBySeed.set(seed, ids);
  return ids;
}

async function fetchMetBatch(): Promise<Artwork[]> {
  const ids = await getMetIds();
  if (ids.length === 0) return [];
  // Pick 10 random IDs, fetch in parallel. Many will have no primaryImage; we drop those.
  const picks = new Set<number>();
  while (picks.size < 10 && picks.size < ids.length) {
    picks.add(ids[Math.floor(Math.random() * ids.length)]);
  }
  const objs = await Promise.all(
    [...picks].map(async (id) => {
      try {
        const r = await fetch(`${MET_BASE}/objects/${id}`);
        if (!r.ok) return null;
        return (await r.json()) as MetObject;
      } catch {
        return null;
      }
    }),
  );
  return objs
    .filter((o): o is MetObject => !!o && !!o.primaryImage)
    .map<Artwork>((o) => ({
      id: `met-${o.objectID}`,
      source: 'met',
      title: o.title || 'Untitled',
      artist: o.artistDisplayName || '',
      date: o.objectDate || '',
      museum: 'The Met',
      imageUrl: o.primaryImage,
    }));
}

/* -------------------- Cleveland Museum of Art -------------------- */

const CMA_BASE = 'https://openaccess-api.clevelandart.org/api';

interface CmaResp {
  data: Array<{
    id: number;
    title: string | null;
    creators?: Array<{ description: string }>;
    creation_date?: string;
    images?: {
      web?: { url: string; width: string; height: string };
    };
  }>;
}

async function fetchCmaBatch(): Promise<Artwork[]> {
  // Cleveland's open-access catalog has ~30k pieces; sample a random window.
  const skip = Math.floor(Math.random() * 30000);
  const url = `${CMA_BASE}/artworks?has_image=1&cc0=1&limit=25&skip=${skip}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CMA ${res.status}`);
  const json = (await res.json()) as CmaResp;
  return json.data
    .filter((d) => d.images?.web?.url)
    .filter((d) => okAspect(Number(d.images?.web?.width), Number(d.images?.web?.height)))
    .map<Artwork>((d) => ({
      id: `cma-${d.id}`,
      source: 'cma',
      title: d.title || 'Untitled',
      artist: cleanCmaCreator(d.creators?.[0]?.description),
      date: d.creation_date ?? '',
      museum: 'Cleveland Museum of Art',
      imageUrl: d.images!.web!.url,
    }));
}

/* -------------------- Pooled fetch -------------------- */

const fetchers = [fetchAicBatch, fetchCmaBatch, fetchAicBatch, fetchMetBatch];
let cursor = Math.floor(Math.random() * fetchers.length);

/** Returns a batch of artworks from a single source, cycling sources across calls. */
export async function fetchRandomBatch(): Promise<Artwork[]> {
  const fetcher = fetchers[cursor % fetchers.length];
  cursor++;
  const batch = await fetcher();
  // Shuffle within the batch so the first few items aren't always page-top hits.
  for (let i = batch.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [batch[i], batch[j]] = [batch[j], batch[i]];
  }
  return batch;
}

/* -------------------- helpers -------------------- */

function okAspect(w?: number, h?: number): boolean {
  if (!w || !h || !isFinite(w) || !isFinite(h)) return true; // unknown → allow
  const ar = w / h;
  return ar >= MIN_ASPECT && ar <= MAX_ASPECT;
}

function firstLine(s: string): string {
  return s.split('\n')[0].trim();
}

function cleanCmaCreator(raw: string | undefined): string {
  if (!raw) return '';
  // CMA creator strings look like "Claude Monet (French, 1840-1926)" — strip the paren tail.
  return raw.split('(')[0].trim();
}
