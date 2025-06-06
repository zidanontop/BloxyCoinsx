/** @format */

require('dotenv').config();

// Use a more secure default secret if environment variable is not set
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const PORT = process.env.PORT || 3000;
const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || "0x0000000000000000000000000000000000000000";
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://addddd:addddd@cluster0.sc5dux9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const TRANSACTION_SECRET = process.env.TRANSACTION_SECRET || "secret";
const XP_CONSTANT = process.env.XP_CONSTANT || 0.04;

// JWT Configuration
const JWT_CONFIG = {
  expiresIn: '7d',
  algorithm: 'HS256'
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
