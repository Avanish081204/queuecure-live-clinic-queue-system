/**
 * app.js — Shared QueueCure Utilities
 *
 * Provides:
 *  - API request helpers
 *  - Toast notification system
 *  - General DOM utilities
 */

// ─── Configuration ─────────────────────────────────────────────────────────
const API_BASE = `${window.location.origin}/api`;

// ─── API Helper ────────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper with JSON parsing and error handling.
 * @param {string} path  — endpoint path (relative to API_BASE)
 * @param {Object} [options] — fetch options
 * @returns {Promise<Object>} — parsed JSON response
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };

  try {
    const response = await fetch(url, { ...defaults, ...options });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[API] ${options.method || 'GET'} ${url} failed:`, err);
    throw err;
  }
}

// Convenience wrappers
const api = {
  get:  (path)         => apiFetch(path, { method: 'GET' }),
  post: (path, body)   => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put:  (path, body)   => apiFetch(path, { method: 'PUT',  body: JSON.stringify(body) }),
};

// ─── Toast System ──────────────────────────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

const TOAST_ICONS = {
  success: '✅',
  error:   '❌',
  info:    'ℹ️',
  warning: '⚠️',
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number} [duration=4000] — ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <span class="toast__message">${message}</span>
    <span class="toast__close" onclick="dismissToast(this.parentElement)">✕</span>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), duration);
  toast._timer = timer;
}

function dismissToast(toast) {
  if (!toast || !toast.parentElement) return;
  clearTimeout(toast._timer);
  toast.classList.add('hiding');
  setTimeout(() => toast.remove(), 300);
}

// ─── Number formatting ─────────────────────────────────────────────────────

/** Format minutes into a human-readable string */
function formatWaitTime(minutes) {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Pad a number to 2+ digits for display */
function padToken(n) {
  return String(n).padStart(3, '0');
}

// ─── URL Query Params ──────────────────────────────────────────────────────

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token:    params.get('token') ? parseInt(params.get('token'), 10) : null,
    clinicId: params.get('clinicId') || 'default-clinic',
  };
}

// ─── DOM Helpers ───────────────────────────────────────────────────────────

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return Array.from(document.querySelectorAll(selector)); }

function setText(selector, text) {
  const el = $(selector);
  if (el) el.textContent = text;
}

function setHTML(selector, html) {
  const el = $(selector);
  if (el) el.innerHTML = html;
}

function show(selector) {
  const el = $(selector);
  if (el) el.classList.remove('hidden');
}

function hide(selector) {
  const el = $(selector);
  if (el) el.classList.add('hidden');
}

function toggle(selector, condition) {
  condition ? show(selector) : hide(selector);
}

function setDisabled(selector, disabled) {
  const el = $(selector);
  if (el) el.disabled = disabled;
}

// ─── Export globals ────────────────────────────────────────────────────────
window.QCApp = {
  api,
  showToast,
  dismissToast,
  formatWaitTime,
  padToken,
  getUrlParams,
  $, $$, setText, setHTML, show, hide, toggle, setDisabled,
};
