import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || './marketplace.db';

class DatabaseService {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initTables();
  }

  private initTables() {
    // NFTs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nfts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        creator TEXT NOT NULL,
        owner TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )
    `);

    // Listings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS listings (
        nft_id TEXT PRIMARY KEY,
        seller TEXT NOT NULL,
        price TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        listed_at INTEGER NOT NULL,
        updated_at INTEGER,
        FOREIGN KEY (nft_id) REFERENCES nfts(id)
      )
    `);

    // Transactions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_digest TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        nft_id TEXT,
        from_address TEXT,
        to_address TEXT,
        price TEXT,
        timestamp INTEGER NOT NULL
      )
    `);

    // Indexer state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexer_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_checkpoint TEXT,
        last_event_seq TEXT,
        updated_at INTEGER NOT NULL
      )
    `);

    // Insert initial indexer state if not exists
    this.db.prepare(`
      INSERT OR IGNORE INTO indexer_state (id, last_checkpoint, last_event_seq, updated_at)
      VALUES (1, '0', '0', ?)
    `).run(Date.now());

    console.log('✅ Database tables initialized');
  }

  // NFT operations
  saveNFT(nft: any) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO nfts (id, name, description, image_url, creator, owner, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      nft.id,
      nft.name,
      nft.description,
      nft.image_url,
      nft.creator,
      nft.owner,
      nft.created_at || Date.now(),
      Date.now()
    );
  }

  getNFT(id: string) {
    return this.db.prepare('SELECT * FROM nfts WHERE id = ?').get(id);
  }

  getNFTsByOwner(owner: string) {
    return this.db.prepare('SELECT * FROM nfts WHERE owner = ?').all(owner);
  }

  updateNFTOwner(nftId: string, newOwner: string) {
    this.db.prepare('UPDATE nfts SET owner = ?, updated_at = ? WHERE id = ?')
      .run(newOwner, Date.now(), nftId);
  }

  // Listing operations
  saveListing(listing: any) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO listings (nft_id, seller, price, status, listed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      listing.nft_id,
      listing.seller,
      listing.price,
      listing.status || 'active',
      listing.listed_at || Date.now(),
      Date.now()
    );
  }

  getListing(nftId: string) {
    return this.db.prepare('SELECT * FROM listings WHERE nft_id = ?').get(nftId);
  }

  getListings(status?: string) {
    const query = status 
      ? 'SELECT l.*, n.name, n.description, n.image_url, n.creator FROM listings l JOIN nfts n ON l.nft_id = n.id WHERE l.status = ? ORDER BY l.listed_at DESC'
      : 'SELECT l.*, n.name, n.description, n.image_url, n.creator FROM listings l JOIN nfts n ON l.nft_id = n.id ORDER BY l.listed_at DESC';
    
    return status 
      ? this.db.prepare(query).all(status)
      : this.db.prepare(query).all();
  }

  updateListingStatus(nftId: string, status: string) {
    this.db.prepare('UPDATE listings SET status = ?, updated_at = ? WHERE nft_id = ?')
      .run(status, Date.now(), nftId);
  }

  // Transaction operations
  saveTransaction(tx: any) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO transactions (tx_digest, event_type, nft_id, from_address, to_address, price, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      tx.tx_digest,
      tx.event_type,
      tx.nft_id || null,
      tx.from_address || null,
      tx.to_address || null,
      tx.price || null,
      tx.timestamp || Date.now()
    );
  }

  getTransactions(limit = 100) {
    return this.db.prepare('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?').all(limit);
  }

  getTransactionsByNFT(nftId: string) {
    return this.db.prepare('SELECT * FROM transactions WHERE nft_id = ? ORDER BY timestamp DESC').all(nftId);
  }

  // Indexer state operations
  getIndexerState() {
    return this.db.prepare('SELECT * FROM indexer_state WHERE id = 1').get();
  }

  updateIndexerState(checkpoint: string, eventSeq: string) {
    this.db.prepare('UPDATE indexer_state SET last_checkpoint = ?, last_event_seq = ?, updated_at = ? WHERE id = 1')
      .run(checkpoint, eventSeq, Date.now());
  }

  // Stats
  getStats() {
    const totalNFTs = this.db.prepare('SELECT COUNT(*) as count FROM nfts').get() as any;
    const activeListings = this.db.prepare("SELECT COUNT(*) as count FROM listings WHERE status = 'active'").get() as any;
    const totalSales = this.db.prepare("SELECT COUNT(*) as count FROM transactions WHERE event_type = 'NFTPurchased'").get() as any;
    const totalVolume = this.db.prepare("SELECT SUM(CAST(price AS INTEGER)) as volume FROM transactions WHERE event_type = 'NFTPurchased'").get() as any;

    return {
      total_nfts: totalNFTs.count,
      active_listings: activeListings.count,
      total_sales: totalSales.count,
      total_volume: totalVolume.volume || 0
    };
  }

  close() {
    this.db.close();
  }
}

export default new DatabaseService();