const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');

// Route imports
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const credentialRoutes = require('./routes/credentials');

const { initVault } = require('./services/vaultService');

// Initialize express
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/credentials', credentialRoutes);


// Health check
app.get("/", (req, res) => {
  res.send("✅ Municipal Backend API is running");
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global Error Handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});


(async () => {
  try {
    await initVault();
    console.log('Vault ready');
  } catch (err) {
    console.error('Vault initialization failed:', err);
    process.exit(1);
  }
})();

module.exports = app;