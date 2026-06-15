/**
 * socket-client.js — QueueCure Socket.IO Client Wrapper
 *
 * Provides a singleton socket connection with:
 *  - Automatic reconnection with exponential backoff
 *  - Connection status UI updates
 *  - Typed event emitter pattern
 */

const API_BASE = window.location.origin; // Same origin as the server

// ─── Singleton socket instance ────────────────────────────────────────────
let socket = null;

/**
 * Initialise (or return existing) Socket.IO connection.
 * @param {string} clinicId — the room to join after connection
 * @returns {Socket}
 */
function initSocket(clinicId) {
  if (socket && socket.connected) return socket;

  socket = io(API_BASE, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  // ── Connection lifecycle ─────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    setConnectionStatus('connected');

    // Join the clinic room so broadcasts are scoped correctly
    if (clinicId) {
      socket.emit('joinClinic', clinicId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
    setConnectionStatus('disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    setConnectionStatus('connecting');
  });

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log(`[Socket] Reconnection attempt #${attempt}`);
    setConnectionStatus('connecting');
  });

  socket.io.on('reconnect', () => {
    console.log('[Socket] Reconnected');
    setConnectionStatus('connected');
    if (clinicId) socket.emit('joinClinic', clinicId);
  });

  return socket;
}

/**
 * Update every `.conn-status` element on the page.
 * @param {'connected'|'disconnected'|'connecting'} state
 */
function setConnectionStatus(state) {
  const labels = {
    connected:    { text: 'Live',         cls: 'conn-status--connected' },
    disconnected: { text: 'Offline',      cls: 'conn-status--disconnected' },
    connecting:   { text: 'Connecting…',  cls: 'conn-status--connecting' },
  };

  document.querySelectorAll('.conn-status').forEach((el) => {
    // Remove all state classes
    el.classList.remove('conn-status--connected', 'conn-status--disconnected', 'conn-status--connecting');
    el.classList.add(labels[state].cls);

    const textEl = el.querySelector('.conn-status__text');
    if (textEl) textEl.textContent = labels[state].text;
  });
}

/**
 * Expose socket getter so other modules can subscribe to events.
 * @returns {Socket|null}
 */
function getSocket() {
  return socket;
}

// ─── Export ───────────────────────────────────────────────────────────────
window.QCSocket = { initSocket, getSocket, setConnectionStatus };
