import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

export const PACKAGE_ID = process.env.PACKAGE_ID || '';
export const MARKETPLACE_ID = process.env.MARKETPLACE_ID || '';
export const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
export const PORT = process.env.PORT || 3000;
export const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY || '';