/**
 * Semantic Search Service — Express router mounted at /api/semantic-search
 *
 * Replaces the previous random-score mock. Semantic search is delegated to the
 * VideoDB collection search endpoint (real embeddings, real relevance), which
 * is the same backend the Video Agent / Director studios use. When no VideoDB
 * token is available (neither VIDEO_DB_API_KEY server-side nor an
 * x-access-token header), the route returns an explicit 400 rather than
 * fabricating plausible-looking random scores.
 *
 * The legacy in-memory `search(query, mediaItems)` form is kept for callers
 * that pass a pre-filtered candidate list: it now ranks purely by the
 * caller-supplied score when present, and otherwise signals that real semantic
 * ranking requires VideoDB.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const VIDEODB_BASE_URL = (
  process.env.VIDEO_DB_BASE_URL || 'https://api.videodb.io'
).replace(/\/$/, '');
const DEFAULT_COLLECTION = process.env.VIDEO_DB_DEFAULT_COLLECTION || 'default';

function serverKey() {
  return (process.env.VIDEO_DB_API_KEY || '').trim();
}

function resolveToken(req) {
  const h = req.header('x-access-token');
  if (h && String(h).trim()) return String(h).trim();
  const q = req.query.accessToken;
  if (q && String(q).trim()) return String(q).trim();
  const k = serverKey();
  if (k) return k;
  return null;
}

class SemanticSearchService {
  constructor() {
    this.mediaIndex = new Map();
  }

  /**
   * In-memory ranking fallback. If the caller provides candidate `mediaItems`
   * each carrying their own `score`, we honor it. Otherwise we refuse to invent
   * scores and throw — real semantic ranking must come from VideoDB.
   */
  rankLocally(query, mediaItems = []) {
    if (!mediaItems.length) return [];
    const hasScores = mediaItems.every(
      (it) => typeof it.score === 'number'
    );
    if (!hasScores) {
      throw new Error(
        'Local semantic ranking requires caller-supplied scores or a VideoDB token for real semantic search.'
      );
    }
    return [...mediaItems]
      .sort((a, b) => b.score - a.score)
      .map((it) => ({ ...it, relevance: it.relevance || 'medium' }));
  }

  async searchCollection(req, query, {
    collectionId = DEFAULT_COLLECTION,
    indexType = 'scene',
    searchType = 'semantic',
    resultThreshold = 10,
  } = {}) {
    const token = resolveToken(req);
    if (!token) {
      const err = new Error(
        'No VideoDB access token available. Set VIDEO_DB_API_KEY or pass x-access-token for real semantic search.'
      );
      err.status = 400;
      throw err;
    }
    const res = await axios({
      method: 'POST',
      url: `${VIDEODB_BASE_URL}/collection/${encodeURIComponent(collectionId)}/search/`,
      headers: { 'Content-Type': 'application/json', 'x-access-token': token },
      data: {
        query,
        index_type: indexType,
        search_type: searchType,
        result_threshold: resultThreshold,
      },
      timeout: 60000,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      const detail =
        (res.data && (res.data.message || JSON.stringify(res.data))) ||
        `HTTP ${res.status}`;
      const err = new Error(`VideoDB search failed (${res.status}): ${detail}`);
      err.status = res.status >= 500 ? 502 : 400;
      throw err;
    }
    const payload = res.data || {};
    return payload.data !== undefined ? payload.data : payload;
  }
}

const semanticSearch = new SemanticSearchService();

// POST /api/semantic-search/search
// Two modes:
//   1. { query }                      -> real VideoDB collection semantic search
//   2. { query, mediaItems:[...] }    -> local ranking of caller-supplied items
router.post('/search', async (req, res) => {
  try {
    const { query, mediaItems, collectionId, indexType, searchType, resultThreshold } = req.body || {};
    if (!query) {
      return res.status(400).json({ error: 'Search failed', message: 'query is required' });
    }

    if (Array.isArray(mediaItems)) {
      const ranked = semanticSearch.rankLocally(query, mediaItems);
      return res.json({ success: true, query, mode: 'local', results: ranked });
    }

    const data = await semanticSearch.searchCollection(req, query, {
      collectionId,
      indexType,
      searchType,
      resultThreshold,
    });
    res.json({ success: true, query, mode: 'videodb', results: data });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: status === 502 ? 'VideoDB upstream error' : 'Search failed',
      message: error.message,
    });
  }
});

export default router;
