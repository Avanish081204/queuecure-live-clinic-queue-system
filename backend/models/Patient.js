/**
 * Patient.js — Mongoose schema for individual patient records.
 * Each document represents one visit/appointment token in the queue.
 */

const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema(
  {
    /** Reference to the clinic's queue */
    clinicId: {
      type: String,
      required: [true, 'clinicId is required'],
      trim: true,
      index: true,
    },

    /** Patient's full name */
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
      maxlength: [100, 'Name must be under 100 characters'],
    },

    /** Contact number (optional but useful for notifications) */
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number must be under 20 characters'],
      default: '',
    },

    /**
     * tokenNumber — unique sequential number for this visit.
     * Assigned atomically by the backend (not auto-incremented by Mongoose).
     */
    tokenNumber: {
      type: Number,
      required: [true, 'Token number is required'],
      min: 1,
    },

    /**
     * status — lifecycle of the patient's visit:
     *   waiting   → in the queue, not yet called
     *   serving   → currently being seen by the doctor
     *   completed → consultation finished
     *   skipped   → receptionist skipped this token
     */
    status: {
      type: String,
      enum: ['waiting', 'serving', 'skipped', 'completed'],
      default: 'waiting',
    },

    /** Timestamp when the patient was registered */
    createdAt: {
      type: Date,
      default: Date.now,
    },

    /** Timestamp when the patient's consultation started */
    servedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Disable the default timestamps so we control createdAt manually
    timestamps: false,
  }
);

// Compound index: ensures uniqueness of tokenNumber within a clinic
PatientSchema.index({ clinicId: 1, tokenNumber: 1 }, { unique: true });

module.exports = mongoose.model('Patient', PatientSchema);
