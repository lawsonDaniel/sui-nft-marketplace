import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/bcs';
import { MARKETPLACE_ID, PACKAGE_ID, SUI_NETWORK, SUI_PRIVATE_KEY } from '../config';

class SuiService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private packageId: string;
  private marketplaceId: string;

  constructor() {
    const network: 'testnet' | 'mainnet' | 'devnet' | 'localnet' = (SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet' | 'localnet') || 'testnet';
    this.client = new SuiClient({ url: getFullnodeUrl(network) });
    
    this.packageId = PACKAGE_ID!;
    this.marketplaceId = MARKETPLACE_ID!;

    if (!SUI_PRIVATE_KEY) {
      throw new Error('SUI_PRIVATE_KEY not found in environment variables');
    }

    // Parse private key - Sui private keys start with 'suiprivkey' prefix
    // The format is: suiprivkey + base64(flag byte + 32-byte private key)
    const privateKeyBase64 = SUI_PRIVATE_KEY.startsWith('suiprivkey') 
      ? SUI_PRIVATE_KEY.slice('suiprivkey'.length)
      : SUI_PRIVATE_KEY;
    
    const privateKeyBytes = fromBase64(privateKeyBase64);
    
    // The first byte is a flag byte (0x00 for Ed25519), followed by 32 bytes of the actual key
    // We need to extract only the 32-byte secret key
    const secretKey = privateKeyBytes.slice(1, 33); // Skip flag byte, take 32 bytes
    
    this.keypair = Ed25519Keypair.fromSecretKey(secretKey);

    console.log('Sui service initialized');
    console.log(`Package ID: ${this.packageId}`);
    console.log(`Marketplace ID: ${this.marketplaceId}`);
    console.log(`Address: ${this.keypair.getPublicKey().toSuiAddress()}`);
  }

  getClient() {
    return this.client;
  }

  getAddress() {
    return this.keypair.getPublicKey().toSuiAddress();
  }

  async mintNFT(name: string, description: string, imageUrl: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::marketplace::mint_nft`,
      arguments: [
        tx.pure.string(name),
        tx.pure.string(description),
        tx.pure.string(imageUrl),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    return result;
  }

  async listNFT(nftId: string, price: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::marketplace::list_nft`,
      arguments: [
        tx.object(this.marketplaceId),
        tx.object(nftId),
        tx.pure.u64(price),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    return result;
  }

  async buyNFT(nftId: string, coinId: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::marketplace::buy_nft`,
      arguments: [
        tx.object(this.marketplaceId),
        tx.pure.string(nftId),
        tx.object(coinId),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    return result;
  }

  async delistNFT(nftId: string) {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::marketplace::delist_nft`,
      arguments: [
        tx.object(this.marketplaceId),
        tx.object(nftId),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      signer: this.keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    return result;
  }

  async getEvents(eventType: string, cursor?: string) {
    const events = await this.client.queryEvents({
      query: {
        MoveEventType: `${this.packageId}::marketplace::${eventType}`,
      },
      cursor: cursor ? (cursor as any) : undefined,
      limit: 50,
    });

    return events;
  }

  async getAllMarketplaceEvents(cursor?: string) {
    const eventTypes = ['NFTMinted', 'NFTListed', 'NFTPurchased', 'NFTDelisted'];
    const allEvents = [];

    for (const eventType of eventTypes) {
      const events = await this.getEvents(eventType, cursor);
      allEvents.push(...events.data);
    }

    return allEvents.sort((a, b) => 
      Number(a.timestampMs) - Number(b.timestampMs)
    );
  }

  async getNFTObject(nftId: string) {
    return await this.client.getObject({
      id: nftId,
      options: {
        showContent: true,
        showOwner: true,
      },
    });
  }

  async getCoins(address?: string) {
    const addr = address || this.getAddress();
    return await this.client.getCoins({
      owner: addr,
    });
  }
}

export default new SuiService();