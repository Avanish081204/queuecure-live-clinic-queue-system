/**
 * Queue.js — Mongoose schema for the clinic's queue state.
 * One Queue document exists per clinic and tracks the running state.
 */

const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema(
  {
    /**
     * clinicId — unique identifier for the clinic.
     * Doubles as the Socket.IO room name so broadcasts are clinic-scoped.
     */
    clinicId: {
      type: String,
      required: [true, 'clinicId is required'],
      unique: true,
      trim: true,
      index: true,
    },

    /**
     * currentToken — the token number that is *currently* being served.
     * 0 means no patient is currently being called.
     */
    currentToken: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * lastIssuedToken — monotonically increasing counter used to assign
     * the next token atomically via $inc to prevent race conditions when
     * multiple receptionists register patients simultaneously.
     */
    lastIssuedToken: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * avgConsultationTime — average time (in minutes) per consultation.
     * Used to calculate estimated waiting time for patients.
     */
    avgConsultationTime: {
      type: Number,
      default: 8,
      min: [1, 'Minimum consultation time is 1 minute'],
      max: [120, 'Maximum consultation time is 120 minutes'],
    },

    /**
     * status — operational state of the queue.
     */
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

module.exports = mongoose.model('Queue', QueueSchema);
