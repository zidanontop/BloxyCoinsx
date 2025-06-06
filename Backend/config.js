/** @format */

const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// Generate a stable secret for token signing
const generateStableSecret = () => {
  if (process.env.API_SECRET) return process.env.API_SECRET;
  const date = new Date().toISOString().split('T')[0];
  return crypto.createHash('sha256').update(date + 'BLOXPVP_STABLE_KEY').digest('hex');
};

// Configuration
const API_SECRET = generateStableSecret();
const PORT = process.env.PORT || 3000;
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || "0x0000000000000000000000000000000000000000";
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://addddd:addddd@cluster0.sc5dux9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const TRANSACTION_SECRET = process.env.TRANSACTION_SECRET || "secret";
const XP_CONSTANT = process.env.XP_CONSTANT || 0.04;

// Token configuration
const TOKEN_CONFIG = {
  expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  tokenLength: 64 // Length of the random token
};

// Function to generate a secure random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Function to hash a token
const hashToken = (token) => {
  return crypto.createHmac('sha256', API_SECRET)
    .update(token)
    .digest('hex');
};

module.exports = {
  API_SECRET,
  TOKEN_CONFIG,
  generateToken,
  hashToken,
  HCAPTCHA_SECRET,
  PORT,
  MONGODB_URI,
  TRANSACTION_SECRET,
  XP_CONSTANT,
};
