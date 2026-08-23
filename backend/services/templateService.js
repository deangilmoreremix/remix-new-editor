import express from 'express';
const router = express.Router();
router.use((req, res) => {
  res.status(501).json({ error: 'templateService not implemented' });
});
export default router;
