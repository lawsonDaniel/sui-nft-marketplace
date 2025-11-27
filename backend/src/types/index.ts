export interface NFT {
  id: string;
  name: string;
  description: string;
  image_url: string;
  creator: string;
  owner: string;
}

export interface Listing {
  nft_id: string;
  seller: string;
  price: string;
  status: 'active' | 'sold' | 'delisted';
  listed_at: number;
  updated_at?: number;
}

export interface Transaction {
  id?: number;
  tx_digest: string;
  event_type: string;
  nft_id?: string;
  from_address?: string;
  to_address?: string;
  price?: string;
  timestamp: number;
}

export interface MintRequest {
  name: string;
  description: string;
  imageUrl: string;
}

export interface BuyRequest {
  nftId: string;
  coinId: string;
}