/**
 * Run this script to generate a secure JWT_SECRET for your .env file
 * Usage: node scripts/generate-jwt-secret.js
 */
const crypto = require('crypto');
const secret = crypto.randomBytes(64).toString('hex');
console.log('\nYour JWT_SECRET (copy this to your .env file):\n');
console.log(secret);
console.log('\n');
