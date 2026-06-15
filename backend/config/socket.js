/**
 * socket.js — Socket.IO server initialisation and event registry.
 * Attaches Socket.IO to the HTTP server and exports a helper to
 * broadcast queue-state changes to all connected clients in a clinic room.
 */

const { Server } = require('socket.io');

let io; // Singleton instance

/**
 * Initialise Socket.IO on the given HTTP server.
 * @param {http.Server} httpServer
 * @returns {Server} io instance
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',        // Allow all origins in development; restrict in production
      methods: ['GET', 'POST', 'PUT'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌  Client connected: ${socket.id}`);

    /**
     * Clients join a room identified by clinicId so broadcasts
     * are scoped to the correct clinic.
     */
    socket.on('joinClinic', (clinicId) => {
      socket.join(clinicId);
      console.log(`   → Socket ${socket.id} joined clinic room: ${clinicId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌  Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Retrieve the singleton io instance (must call initSocket first).
 * @returns {Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialised. Call initSocket() first.');
  }
  return io;
};

module.exports = { initSocket, getIO };
