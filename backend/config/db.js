/**
 * db.js — MongoDB connection configuration using Mongoose.
 * Establishes a persistent connection with retry logic and event listeners.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 8.x no longer requires useNewUrlParser / useUnifiedTopology
    });

    console.log(`✅  MongoDB Connected: ${conn.connection.host}`);

    // Gracefully handle connection events
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect…');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅  MongoDB reconnected.');
    });
  } catch (error) {
    console.error(`❌  MongoDB connection error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
