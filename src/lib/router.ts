import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.send('Guessing Game backend is running!');
});

export default router;
