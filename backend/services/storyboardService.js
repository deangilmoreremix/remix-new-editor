import express from 'express';
import cors from 'cors';

const router = express.Router();

router.use(cors());
router.use(express.json({ limit: '50mb' }));

// File-persisted store so storyboards survive restarts.
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'storyboards.json');
const STATE_FILE = path.join(process.cwd(), 'data', 'storyboards-state.json');

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadStore() {
  try {
    ensureDataDir();
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      return new Map(JSON.parse(raw));
    }
  } catch (err) {
    console.warn('[storyboardService] Failed to load store, starting fresh:', err.message);
  }
  return new Map();
}

function saveStore(store) {
  try {
    ensureDataDir();
    const entries = Array.from(store.entries());
    fs.writeFileSync(STATE_FILE, JSON.stringify(entries));
  } catch (err) {
    console.warn('[storyboardService] Failed to persist store:', err.message);
  }
}

const store = loadStore();

// Flush to disk after mutations.
function persist() { saveStore(store); }

router.get('/:id', (req, res) => {
  const doc = store.get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, frames: doc.frames, preset: doc.preset, updated_at: doc.updated_at });
});

router.post('/:id', (req, res) => {
  const { frames, preset } = req.body || {};
  const id = req.params.id;
  const doc = { id, frames: Array.isArray(frames) ? frames : [], preset: preset || null, updated_at: new Date().toISOString() };
  store.set(id, doc);
  persist();
  res.status(201).json(doc);
});

router.put('/:id', (req, res) => {
  const existing = store.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { frames, preset } = req.body || {};
  const doc = {
    id: req.params.id,
    frames: Array.isArray(frames) ? frames : existing.frames,
    preset: preset ?? existing.preset,
    updated_at: new Date().toISOString(),
  };
  store.set(req.params.id, doc);
  persist();
  res.json(doc);
});

router.delete('/:id', (req, res) => {
  store.delete(req.params.id);
  persist();
  res.status(204).end();
});

export default router;
