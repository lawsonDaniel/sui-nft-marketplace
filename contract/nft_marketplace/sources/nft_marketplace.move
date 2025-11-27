/*
/// Module: nft_marketplace
module nft_marketplace::nft_marketplace;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions


module nft_marketplace::marketplace {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use std::string::{Self, String};
    use sui::table::{Self, Table};
    use sui::package;
    use sui::display;

    // ===== Error Codes =====
    const ENotOwner: u64 = 1;
    const EInsufficientPayment: u64 = 2;
    const ENotListed: u64 = 3;

    // ===== Structs =====
    
    /// One-Time-Witness for the module
    public struct MARKETPLACE has drop {}

    /// NFT object
    public struct NFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: String,
        creator: address,
        owner: address,
    }

    /// Marketplace shared object
    public struct Marketplace has key {
        id: UID,
        listings: Table<ID, Listing>,
        owner: address,
    }

    /// Listing struct
    public struct Listing has store, drop, copy {
        nft_id: ID,
        price: u64,
        seller: address,
    }

    // ===== Events =====
    
    public struct NFTMinted has copy, drop {
        nft_id: ID,
        creator: address,
        name: String,
    }

    public struct NFTListed has copy, drop {
        nft_id: ID,
        seller: address,
        price: u64,
    }

    public struct NFTPurchased has copy, drop {
        nft_id: ID,
        buyer: address,
        seller: address,
        price: u64,
    }

    public struct NFTDelisted has copy, drop {
        nft_id: ID,
        seller: address,
    }

    // ===== Initialization =====
    
    fun init(otw: MARKETPLACE, ctx: &mut TxContext) {
        // Create and share marketplace
        let marketplace = Marketplace {
            id: object::new(ctx),
            listings: table::new(ctx),
            owner: tx_context::sender(ctx),
        };
        
        transfer::share_object(marketplace);

        // Create publisher for display
        let publisher = package::claim(otw, ctx);

        // Create display for NFT
        let keys = vector[
            string::utf8(b"name"),
            string::utf8(b"description"),
            string::utf8(b"image_url"),
            string::utf8(b"creator"),
        ];

        let values = vector[
            string::utf8(b"{name}"),
            string::utf8(b"{description}"),
            string::utf8(b"{url}"),
            string::utf8(b"{creator}"),
        ];

        let mut display = display::new_with_fields<NFT>(
            &publisher, keys, values, ctx
        );
        
        display::update_version(&mut display);
        
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }

    // ===== Public Functions =====

    /// Mint a new NFT
    public entry fun mint_nft(
        name: vector<u8>,
        description: vector<u8>,
        url: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let nft = NFT {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            url: string::utf8(url),
            creator: sender,
            owner: sender,
        };

        let nft_id = object::id(&nft);

        event::emit(NFTMinted {
            nft_id,
            creator: sender,
            name: string::utf8(name),
        });

        transfer::public_transfer(nft, sender);
    }

    /// List NFT for sale
    public entry fun list_nft(
        marketplace: &mut Marketplace,
        nft: NFT,
        price: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.owner == sender, ENotOwner);

        let nft_id = object::id(&nft);
        
        let listing = Listing {
            nft_id,
            price,
            seller: sender,
        };

        table::add(&mut marketplace.listings, nft_id, listing);

        event::emit(NFTListed {
            nft_id,
            seller: sender,
            price,
        });

        // Transfer NFT to marketplace (escrow)
        transfer::public_transfer(nft, @nft_marketplace);
    }

    /// Buy listed NFT
    public entry fun buy_nft(
        marketplace: &mut Marketplace,
        nft_id: ID,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&marketplace.listings, nft_id), ENotListed);
        
        let listing = table::remove(&mut marketplace.listings, nft_id);
        let payment_value = coin::value(&payment);
        
        assert!(payment_value >= listing.price, EInsufficientPayment);

        let buyer = tx_context::sender(ctx);

        event::emit(NFTPurchased {
            nft_id,
            buyer,
            seller: listing.seller,
            price: listing.price,
        });

        // Transfer payment to seller
        transfer::public_transfer(payment, listing.seller);
    }

    /// Delist NFT (cancel listing)
    public entry fun delist_nft(
        marketplace: &mut Marketplace,
        nft: NFT,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let nft_id = object::id(&nft);
        
        assert!(table::contains(&marketplace.listings, nft_id), ENotListed);
        
        let listing = table::remove(&mut marketplace.listings, nft_id);
        assert!(listing.seller == sender, ENotOwner);

        event::emit(NFTDelisted {
            nft_id,
            seller: sender,
        });

        // Return NFT to owner
        transfer::public_transfer(nft, sender);
    }

    /// Update NFT owner (called after purchase)
    public entry fun update_nft_owner(
        nft: &mut NFT,
        new_owner: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(nft.owner == sender, ENotOwner);
        nft.owner = new_owner;
    }

    // ===== View Functions =====

    public fun get_nft_info(nft: &NFT): (String, String, String, address, address) {
        (nft.name, nft.description, nft.url, nft.creator, nft.owner)
    }

    public fun get_listing_price(marketplace: &Marketplace, nft_id: ID): u64 {
        let listing = table::borrow(&marketplace.listings, nft_id);
        listing.price
    }
}