/**
 * queueRoutes.js — Express router for all queue-related REST endpoints.
 */

const express = require('express');
const router = express.Router();

const {
  getQueueStatus,
  registerPatient,
  callNext,
  skipCurrent,
  recallToken,
  updateConfig,
  resetQueue,
} = require('../controllers/queueController');

// ── Read ────────────────────────────────────────────────────────────────────
/** GET  /api/queue/status?clinicId=xxx  — Fetch full queue state */
router.get('/status', getQueueStatus);

// ── Write ───────────────────────────────────────────────────────────────────
/** POST /api/queue/register   — Register a new patient & issue a token */
router.post('/register', registerPatient);

/** POST /api/queue/next       — Advance to the next waiting patient */
router.post('/next', callNext);

/** POST /api/queue/skip       — Skip the current token */
router.post('/skip', skipCurrent);

/** POST /api/queue/recall     — Re-announce the current token */
router.post('/recall', recallToken);

/** POST /api/queue/reset      — Clear the entire queue (end of day) */
router.post('/reset', resetQueue);

// ── Config ──────────────────────────────────────────────────────────────────
/** PUT  /api/queue/config     — Update avg consultation time / status */
router.put('/config', updateConfig);

module.exports = router;
