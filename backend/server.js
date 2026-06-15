/**
 * server.js — QueueCure Express Application Entry Point
 *
 * Bootstraps:
 *   1. Express app with middleware
 *   2. MongoDB connection
 *   3. HTTP server
 *   4. Socket.IO server
 *   5. Static file serving for the frontend
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const queueRoutes = require('./routes/queueRoutes');

// ---------------------------------------------------------------------------
// 1. Create Express app
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// 2. Middleware
// ---------------------------------------------------------------------------
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());              // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// ---------------------------------------------------------------------------
// 3. Serve frontend static files
// ---------------------------------------------------------------------------
// Points to the frontend/public directory so all HTML/CSS/JS files are served
const frontendPath = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendPath));

// Also serve src assets (js/css) under /src
const frontendSrcPath = path.join(__dirname, '..', 'frontend', 'src');
app.use('/src', express.static(frontendSrcPath));

// ---------------------------------------------------------------------------
// 4. API Routes
// ---------------------------------------------------------------------------
app.use('/api/queue', queueRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'QueueCure API is running', timestamp: new Date() });
});

// Catch-all: serve index.html for any unmatched route (SPA-style)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ---------------------------------------------------------------------------
// 5. Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// ---------------------------------------------------------------------------
// 6. Create HTTP server and attach Socket.IO
// ---------------------------------------------------------------------------
const httpServer = http.createServer(app);
initSocket(httpServer);

// ---------------------------------------------------------------------------
// 7. Connect to MongoDB then start listening
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🏥  QueueCure Server is running          ║
║   ─────────────────────────────────────    ║
║   HTTP  → http://localhost:${PORT}            ║
║   API   → http://localhost:${PORT}/api/queue  ║
╚════════════════════════════════════════════╝
    `);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
