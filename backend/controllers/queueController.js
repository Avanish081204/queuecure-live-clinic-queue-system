/**
 * queueController.js — Core business logic for the Queue Management System.
 *
 * All write operations (register, next, skip) use MongoDB atomic operations
 * ($inc, findOneAndUpdate with strict query conditions) to prevent race
 * conditions when multiple receptionists operate concurrently.
 */

const QRCode = require('qrcode');
const Queue = require('../models/Queue');
const Patient = require('../models/Patient');
const { getIO } = require('../config/socket');

// ---------------------------------------------------------------------------
// Helper — build the full queue state payload sent to all clients
// ---------------------------------------------------------------------------
const buildQueueState = async (clinicId) => {
  const queue = await Queue.findOne({ clinicId });
  if (!queue) return null;

  // Fetch all patients for this clinic, sorted by token number
  const allPatients = await Patient.find({ clinicId }).sort({ tokenNumber: 1 });

  // Split into logical groups
  const waiting = allPatients.filter((p) => p.status === 'waiting');
  const serving = allPatients.filter((p) => p.status === 'serving');
  const completed = allPatients.filter(
    (p) => p.status === 'completed' || p.status === 'skipped'
  );

  return {
    clinicId: queue.clinicId,
    currentToken: queue.currentToken,
    lastIssuedToken: queue.lastIssuedToken,
    avgConsultationTime: queue.avgConsultationTime,
    status: queue.status,
    waitingCount: waiting.length,
    waitingPatients: waiting,
    servingPatient: serving[0] || null,
    completedPatients: completed,
  };
};

// ---------------------------------------------------------------------------
// Helper — broadcast the latest state to all sockets in a clinic room
// ---------------------------------------------------------------------------
const broadcastState = async (clinicId, event = 'queueUpdated') => {
  const state = await buildQueueState(clinicId);
  if (state) {
    getIO().to(clinicId).emit(event, state);
  }
};

// ---------------------------------------------------------------------------
// GET /api/queue/status?clinicId=xxx
// Returns full queue state (used on page load / refresh)
// ---------------------------------------------------------------------------
const getQueueStatus = async (req, res) => {
  try {
    const { clinicId } = req.query;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'clinicId is required' });
    }

    // Auto-create the queue document if this is a brand-new clinic
    let queue = await Queue.findOne({ clinicId });
    if (!queue) {
      queue = await Queue.create({ clinicId });
    }

    const state = await buildQueueState(clinicId);
    return res.status(200).json({ success: true, data: state });
  } catch (error) {
    console.error('getQueueStatus error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/queue/register
// Atomically assigns the next token and creates a Patient document.
// ---------------------------------------------------------------------------
const registerPatient = async (req, res) => {
  try {
    const { clinicId, name, phone } = req.body;

    // --- Validation ---
    if (!clinicId || !name) {
      return res.status(400).json({ success: false, message: 'clinicId and name are required' });
    }

    // --- Atomic token increment ---
    // $inc on lastIssuedToken is an atomic MongoDB operation, so even if two
    // receptionists click "Register" simultaneously they get distinct tokens.
    const updatedQueue = await Queue.findOneAndUpdate(
      { clinicId },
      { $inc: { lastIssuedToken: 1 } },
      {
        new: true,          // return the document AFTER the update
        upsert: true,       // create queue document if it doesn't exist yet
        setDefaultsOnInsert: true,
      }
    );

    const tokenNumber = updatedQueue.lastIssuedToken;

    // --- Create patient record ---
    const patient = await Patient.create({
      clinicId,
      name: name.trim(),
      phone: (phone || '').trim(),
      tokenNumber,
      status: 'waiting',
    });

    // --- Generate personalised QR code ---
    // The QR code points to patient.html with query params so the patient can
    // open it on their phone and track exactly their position in the queue.
    const patientUrl = `${
      process.env.CLIENT_ORIGIN || 'http://localhost:3000'
    }/patient.html?token=${tokenNumber}&clinicId=${encodeURIComponent(clinicId)}`;

    const qrDataUrl = await QRCode.toDataURL(patientUrl, {
      errorCorrectionLevel: 'M',
      width: 200,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    // --- Broadcast new patient addition ---
    await broadcastState(clinicId, 'queueUpdated');

    return res.status(201).json({
      success: true,
      message: `Patient registered with token #${tokenNumber}`,
      data: {
        patient,
        tokenNumber,
        qrCode: qrDataUrl,
        qrUrl: patientUrl,
      },
    });
  } catch (error) {
    console.error('registerPatient error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/queue/next
// Advances the queue: marks current patient as 'completed', calls next patient.
// Uses atomic findOneAndUpdate to avoid double-advance race conditions.
// ---------------------------------------------------------------------------
const callNext = async (req, res) => {
  try {
    const { clinicId } = req.body;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'clinicId is required' });
    }

    const queue = await Queue.findOne({ clinicId });
    if (!queue) {
      return res.status(404).json({ success: false, message: 'Queue not found' });
    }

    // --- Mark currently-serving patient as completed ---
    if (queue.currentToken > 0) {
      await Patient.findOneAndUpdate(
        { clinicId, tokenNumber: queue.currentToken, status: 'serving' },
        { status: 'completed' }
      );
    }

    // --- Find next waiting patient ---
    const nextPatient = await Patient.findOne({
      clinicId,
      status: 'waiting',
    }).sort({ tokenNumber: 1 });

    if (!nextPatient) {
      // No more patients — reset currentToken to 0
      await Queue.findOneAndUpdate({ clinicId }, { currentToken: 0 });
      await broadcastState(clinicId, 'currentTokenChanged');
      return res.status(200).json({
        success: true,
        message: 'Queue is empty. No more patients waiting.',
        data: { currentToken: 0 },
      });
    }

    // --- Atomic status update: only succeed if patient is still 'waiting' ---
    // This prevents two concurrent "Call Next" requests from picking the same patient.
    const updatedPatient = await Patient.findOneAndUpdate(
      { _id: nextPatient._id, status: 'waiting' }, // Guard condition
      { status: 'serving', servedAt: new Date() },
      { new: true }
    );

    if (!updatedPatient) {
      // Another request beat us to it — retry by re-querying
      return callNext(req, res);
    }

    // Update queue's currentToken
    await Queue.findOneAndUpdate(
      { clinicId },
      { currentToken: updatedPatient.tokenNumber }
    );

    await broadcastState(clinicId, 'currentTokenChanged');

    return res.status(200).json({
      success: true,
      message: `Now serving token #${updatedPatient.tokenNumber}`,
      data: { currentToken: updatedPatient.tokenNumber, patient: updatedPatient },
    });
  } catch (error) {
    console.error('callNext error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/queue/skip
// Marks the current patient as 'skipped' and advances to the next patient.
// ---------------------------------------------------------------------------
const skipCurrent = async (req, res) => {
  try {
    const { clinicId } = req.body;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'clinicId is required' });
    }

    const queue = await Queue.findOne({ clinicId });
    if (!queue) {
      return res.status(404).json({ success: false, message: 'Queue not found' });
    }

    if (queue.currentToken === 0) {
      return res.status(400).json({ success: false, message: 'No patient is currently being served' });
    }

    // Mark current patient as skipped (was serving)
    await Patient.findOneAndUpdate(
      { clinicId, tokenNumber: queue.currentToken, status: 'serving' },
      { status: 'skipped' }
    );

    // Find the next waiting patient
    const nextPatient = await Patient.findOne({
      clinicId,
      status: 'waiting',
    }).sort({ tokenNumber: 1 });

    if (!nextPatient) {
      await Queue.findOneAndUpdate({ clinicId }, { currentToken: 0 });
      await broadcastState(clinicId, 'currentTokenChanged');
      return res.status(200).json({
        success: true,
        message: 'Patient skipped. Queue is now empty.',
        data: { currentToken: 0 },
      });
    }

    // Atomically mark next patient as serving
    const updatedPatient = await Patient.findOneAndUpdate(
      { _id: nextPatient._id, status: 'waiting' },
      { status: 'serving', servedAt: new Date() },
      { new: true }
    );

    if (!updatedPatient) {
      return skipCurrent(req, res); // Retry on race condition
    }

    await Queue.findOneAndUpdate(
      { clinicId },
      { currentToken: updatedPatient.tokenNumber }
    );

    await broadcastState(clinicId, 'currentTokenChanged');

    return res.status(200).json({
      success: true,
      message: `Skipped. Now serving token #${updatedPatient.tokenNumber}`,
      data: { currentToken: updatedPatient.tokenNumber, patient: updatedPatient },
    });
  } catch (error) {
    console.error('skipCurrent error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/queue/recall
// Re-announces the current token (e.g., patient didn't hear their number).
// ---------------------------------------------------------------------------
const recallToken = async (req, res) => {
  try {
    const { clinicId } = req.body;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'clinicId is required' });
    }

    const queue = await Queue.findOne({ clinicId });
    if (!queue || queue.currentToken === 0) {
      return res.status(400).json({ success: false, message: 'No patient is currently being served' });
    }

    // Re-broadcast without changing any state
    await broadcastState(clinicId, 'currentTokenChanged');

    return res.status(200).json({
      success: true,
      message: `Recalled token #${queue.currentToken}`,
      data: { currentToken: queue.currentToken },
    });
  } catch (error) {
    console.error('recallToken error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// PUT /api/queue/config
// Updates queue configuration (e.g., avgConsultationTime).
// ---------------------------------------------------------------------------
const updateConfig = async (req, res) => {
  try {
    const { clinicId, avgConsultationTime, status } = req.body;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'clinicId is required' });
    }

    const updates = {};
    if (avgConsultationTime !== undefined) {
      const time = parseInt(avgConsultationTime, 10);
      if (isNaN(time) || time < 1 || time > 120) {
        return res.status(400).json({ success: false, message: 'avgConsultationTime must be between 1 and 120 minutes' });
      }
      updates.avgConsultationTime = time;
    }

    if (status !== undefined) {
      if (!['active', 'paused'].includes(status)) {
        return res.status(400).json({ success: false, message: 'status must be "active" or "paused"' });
      }
      updates.status = status;
    }

    const queue = await Queue.findOneAndUpdate(
      { clinicId },
      updates,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Broadcast updated wait time to all clients in the clinic
    await broadcastState(clinicId, 'waitTimeUpdated');

    return res.status(200).json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        avgConsultationTime: queue.avgConsultationTime,
        status: queue.status,
      },
    });
  } catch (error) {
    console.error('updateConfig error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/queue/reset
// Clears the entire queue (end-of-day cleanup).
// ---------------------------------------------------------------------------
const resetQueue = async (req, res) => {
  try {
    const { clinicId } = req.body;

    if (!clinicId) {
      return res.status(400).json({ success: false, message: 'clinicId is required' });
    }

    // Mark all non-completed patients as completed
    await Patient.updateMany(
      { clinicId, status: { $in: ['waiting', 'serving'] } },
      { status: 'completed' }
    );

    // Reset queue counters
    await Queue.findOneAndUpdate(
      { clinicId },
      { currentToken: 0, lastIssuedToken: 0 }
    );

    await broadcastState(clinicId, 'queueUpdated');

    return res.status(200).json({ success: true, message: 'Queue reset successfully' });
  } catch (error) {
    console.error('resetQueue error:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getQueueStatus,
  registerPatient,
  callNext,
  skipCurrent,
  recallToken,
  updateConfig,
  resetQueue,
};
