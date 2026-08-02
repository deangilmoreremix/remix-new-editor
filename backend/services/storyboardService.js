import express from 'express';
import cors from 'cors';

const router = express.Router();

router.use(cors());
router.use(express.json({ limit: '50mb' }));

// In-memory store for demo; replace with real DB in production.
const store = new Map();

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
  res.json(doc);
});

router.delete('/:id', (req, res) => {
  store.delete(req.params.id);
  res.status(204).end();
});

export default router;
