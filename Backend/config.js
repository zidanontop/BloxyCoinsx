/** @format */

const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

// Generate a stable secret based on the environment or use a fixed backup
const generateStableSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  
  // If no environment variable, generate a stable secret based on the day
  // This ensures the secret stays the same during the same day even if server restarts
  const date = new Date().toISOString().split('T')[0];
  return crypto.createHash('sha256').update(date + 'BLOXPVP_STABLE_KEY').digest('hex');
};

const JWT_SECRET = generateStableSecret();
const PORT = process.env.PORT || 3000;
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || "0x0000000000000000000000000000000000000000";
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://addddd:addddd@cluster0.sc5dux9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const TRANSACTION_SECRET = process.env.TRANSACTION_SECRET || "secret";
const XP_CONSTANT = process.env.XP_CONSTANT || 0.04;

// JWT Configuration
const JWT_CONFIG = {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'BLOXPVP',
  audience: 'BLOXPVP_USERS'
};

module.exports = {
  JWT_SECRET,
  JWT_CONFIG,
  HCAPTCHA_SECRET,
  PORT,
  MONGODB_URI,
  TRANSACTION_SECRET,
  XP_CONSTANT,
};
