import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import marketplaceController from './controllers/marketplace.controller';
import indexer from './services/indexer.service';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sui NFT Marketplace API',
    version: '1.0.0',
    endpoints: {
      listings: 'GET /listings',
      mint: 'POST /mint',
      buy: 'POST /buy',
      nft: 'GET /nft/:id',
      nftsByOwner: 'GET /nfts/owner/:address',
      transactions: 'GET /transactions',
      stats: 'GET /stats',
      coins: 'GET /coins',
    },
  });
});

// Routes
app.get('/listings', marketplaceController.getListings.bind(marketplaceController));
app.post('/mint', marketplaceController.mintNFT.bind(marketplaceController));
app.post('/buy', marketplaceController.buyNFT.bind(marketplaceController));
app.get('/nft/:id', marketplaceController.getNFT.bind(marketplaceController));
app.get('/nfts/owner/:address', marketplaceController.getNFTsByOwner.bind(marketplaceController));
app.get('/transactions', marketplaceController.getTransactions.bind(marketplaceController));
app.get('/stats', marketplaceController.getStats.bind(marketplaceController));
app.get('/coins', marketplaceController.getCoins.bind(marketplaceController));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('Sui NFT Marketplace Backend');
  console.log('='.repeat(50));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network: ${process.env.SUI_NETWORK}`);
  console.log(`Package: ${process.env.PACKAGE_ID}`);
  console.log(`Marketplace: ${process.env.MARKETPLACE_ID}`);
  console.log('='.repeat(50));
  console.log('');

  // Start event indexer
  indexer.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  indexer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  indexer.stop();
  process.exit(0);
});

export default app;