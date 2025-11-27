import { Request, Response } from 'express';
import suiService from '../services/sui.service';
import db from '../db/database';
import { MintRequest, BuyRequest } from '../types';

export class MarketplaceController {
  // GET /listings - Get all listings
  async getListings(req: Request, res: Response) {
    try {
      const status = req.query.status as string || 'active';
      const listings = db.getListings(status);

      // Convert price from MIST to SUI
      const formattedListings = listings.map((listing: any) => ({
        ...listing,
        price_sui: (parseInt(listing.price) / 1_000_000_000).toFixed(4),
      }));

      res.json({
        success: true,
        count: formattedListings.length,
        data: formattedListings,
      });
    } catch (error: any) {
      console.error('Error getting listings:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // POST /mint - Mint a new NFT
  async mintNFT(req: Request, res: Response) {
    try {
      const { name, description, imageUrl }: MintRequest = req.body;

      if (!name || !description || !imageUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, description, imageUrl',
        });
      }

      console.log(`🎨 Minting NFT: ${name}`);

      const result = await suiService.mintNFT(name, description, imageUrl);

      // Extract NFT ID from object changes
      const createdObjects = result.objectChanges?.filter((obj: any) => obj.type === 'created');
      const nftObject:any = createdObjects?.find((obj: any) => 
        obj.objectType.includes('::marketplace::NFT')
      );

      if (!nftObject) {
        throw new Error('NFT object not found in transaction result');
      }

      const nftId = nftObject.objectId;

      // Save to database
      db.saveNFT({
        id: nftId,
        name,
        description,
        image_url: imageUrl,
        creator: suiService.getAddress(),
        owner: suiService.getAddress(),
        created_at: Date.now(),
      });

      res.json({
        success: true,
        message: 'NFT minted successfully',
        data: {
          nft_id: nftId,
          tx_digest: result.digest,
          name,
          description,
          image_url: imageUrl,
        },
      });
    } catch (error: any) {
      console.error('Error minting NFT:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // POST /buy - Buy an NFT
  async buyNFT(req: Request, res: Response) {
    try {
      const { nftId, coinId }: BuyRequest = req.body;

      if (!nftId || !coinId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: nftId, coinId',
        });
      }

      // Get listing to check price
      const listing:any = db.getListing(nftId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          error: 'NFT not listed for sale',
        });
      }

      if (listing.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'NFT is not available for purchase',
        });
      }

      console.log(`💰 Buying NFT: ${nftId}`);

      const result = await suiService.buyNFT(nftId, coinId);

      // Update database
      db.updateListingStatus(nftId, 'sold');
      db.updateNFTOwner(nftId, suiService.getAddress());

      res.json({
        success: true,
        message: 'NFT purchased successfully',
        data: {
          nft_id: nftId,
          tx_digest: result.digest,
          price_mist: listing.price,
          price_sui: (parseInt(listing.price) / 1_000_000_000).toFixed(4),
        },
      });
    } catch (error: any) {
      console.error('Error buying NFT:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GET /nft/:id - Get NFT details
  async getNFT(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const nft = db.getNFT(id);

      if (!nft) {
        return res.status(404).json({
          success: false,
          error: 'NFT not found',
        });
      }

      // Check if listed
      const listing = db.getListing(id);

      res.json({
        success: true,
        data: {
          ...nft,
          listing: listing || null,
        },
      });
    } catch (error: any) {
      console.error('Error getting NFT:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GET /nfts/owner/:address - Get NFTs by owner
  async getNFTsByOwner(req: Request, res: Response) {
    try {
      const { address } = req.params;
      const nfts = db.getNFTsByOwner(address);

      res.json({
        success: true,
        count: nfts.length,
        data: nfts,
      });
    } catch (error: any) {
      console.error('Error getting NFTs by owner:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GET /transactions - Get transaction history
  async getTransactions(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const transactions = db.getTransactions(limit);

      res.json({
        success: true,
        count: transactions.length,
        data: transactions,
      });
    } catch (error: any) {
      console.error('Error getting transactions:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GET /stats - Get marketplace statistics
  async getStats(req: Request, res: Response) {
    try {
      const stats = db.getStats();

      res.json({
        success: true,
        data: {
          ...stats,
          total_volume_sui: (parseInt(stats.total_volume) / 1_000_000_000).toFixed(4),
        },
      });
    } catch (error: any) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GET /coins - Get user's coins (for buying)
  async getCoins(req: Request, res: Response) {
    try {
      const address = req.query.address as string;
      const coins = await suiService.getCoins(address);

      res.json({
        success: true,
        data: coins.data,
      });
    } catch (error: any) {
      console.error('Error getting coins:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new MarketplaceController();