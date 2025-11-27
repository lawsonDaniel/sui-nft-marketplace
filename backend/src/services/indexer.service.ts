import suiService from './sui.service';
import db from '../db/database';

class IndexerService {
  private isRunning = false;
  private pollInterval: number;
  private packageId: string;

  constructor() {
    this.pollInterval = parseInt(process.env.INDEXER_POLL_INTERVAL || '5000');
    this.packageId = process.env.PACKAGE_ID!;
  }

  start() {
    if (this.isRunning) {
      console.log('Indexer already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting event indexer...');
    console.log(`Polling every ${this.pollInterval}ms`);
    
    // Start polling
    this.poll();
  }

  private async poll() {
    while (this.isRunning) {
      try {
        await this.indexEvents();
      } catch (error) {
        console.error('Indexer error:', error);
      }

      await this.sleep(this.pollInterval);
    }
  }

  private async indexEvents() {
    try {
      const events = await suiService.getAllMarketplaceEvents();

      if (events.length === 0) {
        return;
      }

      console.log(`Processing ${events.length} events...`);

      for (const event of events) {
        await this.processEvent(event);
      }

      console.log(`Indexed ${events.length} events`);
    } catch (error) {
      console.error('Error indexing events:', error);
    }
  }

  private async processEvent(event: any) {
    const eventType = event.type.split('::').pop();
    const parsedJson = event.parsedJson;

    console.log(`Processing ${eventType}:`, parsedJson);

    try {
      switch (eventType) {
        case 'NFTMinted':
          await this.handleNFTMinted(event);
          break;
        case 'NFTListed':
          await this.handleNFTListed(event);
          break;
        case 'NFTPurchased':
          await this.handleNFTPurchased(event);
          break;
        case 'NFTDelisted':
          await this.handleNFTDelisted(event);
          break;
        default:
          console.log('Unknown event type:', eventType);
      }

      // Save transaction
      db.saveTransaction({
        tx_digest: event.id.txDigest,
        event_type: eventType,
        nft_id: parsedJson.nft_id || null,
        from_address: event.sender,
        to_address: parsedJson.buyer || parsedJson.seller || null,
        price: parsedJson.price || null,
        timestamp: parseInt(event.timestampMs),
      });
    } catch (error) {
      console.error(`Error processing ${eventType}:`, error);
    }
  }

  private async handleNFTMinted(event: any) {
    const { nft_id, creator, name } = event.parsedJson;

    // Fetch NFT object to get full details
    try {
      const nftObject = await suiService.getNFTObject(nft_id);
      const content = nftObject.data?.content;

      if (content && 'fields' in content) {
        const fields = content.fields as any;
        
        db.saveNFT({
          id: nft_id,
          name: fields.name || name,
          description: fields.description || '',
          image_url: fields.url || '',
          creator: creator,
          owner: creator,
          created_at: parseInt(event.timestampMs),
        });

        console.log(`NFT minted: ${fields.name}`);
      }
    } catch (error) {
      console.error('Error fetching NFT object:', error);
      // Save with basic info if fetch fails
      db.saveNFT({
        id: nft_id,
        name: name,
        description: '',
        image_url: '',
        creator: creator,
        owner: creator,
        created_at: parseInt(event.timestampMs),
      });
    }
  }

  private async handleNFTListed(event: any) {
    const { nft_id, seller, price } = event.parsedJson;

    db.saveListing({
      nft_id,
      seller,
      price: price.toString(),
      status: 'active',
      listed_at: parseInt(event.timestampMs),
    });

    console.log(`NFT listed: ${nft_id} for ${price}`);
  }

  private async handleNFTPurchased(event: any) {
    const { nft_id, buyer, seller, price } = event.parsedJson;

    // Update listing status
    db.updateListingStatus(nft_id, 'sold');

    // Update NFT owner
    db.updateNFTOwner(nft_id, buyer);

    console.log(`NFT purchased: ${nft_id} by ${buyer}`);
  }

  private async handleNFTDelisted(event: any) {
    const { nft_id, seller } = event.parsedJson;

    // Update listing status
    db.updateListingStatus(nft_id, 'delisted');

    console.log(`NFT delisted: ${nft_id}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    console.log('Stopping indexer...');
    this.isRunning = false;
  }
}

export default new IndexerService();