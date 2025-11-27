#!/bin/bash

# Sui NFT Marketplace Deployment Script
# This script deploys the smart contract to Sui testnet

echo "🚀 Sui NFT Marketplace Deployment Script"
echo "=========================================="

# Check if sui CLI is installed
if ! command -v sui &> /dev/null; then
    echo "❌ Error: Sui CLI is not installed"
    echo "Please install from: https://docs.sui.io/guides/developer/getting-started/sui-install"
    exit 1
fi

echo "✅ Sui CLI found"

# Check if we're on testnet
NETWORK=$(sui client active-env)
echo "📡 Active network: $NETWORK"

if [ "$NETWORK" != "testnet" ]; then
    echo "⚠️  Warning: Not on testnet. Switching to testnet..."
    sui client switch --env testnet
fi

# Get active address
ADDRESS=$(sui client active-address)
echo "📍 Active address: $ADDRESS"

# Check balance
echo "💰 Checking SUI balance..."
sui client gas --json | head -n 1

echo ""
echo "📦 Building Move package..."
cd contracts
sui move build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""
echo "🚀 Publishing to testnet..."
echo "This may take a minute..."

# Publish and capture output
PUBLISH_OUTPUT=$(sui client publish --gas-budget 100000000 --json)

if [ $? -ne 0 ]; then
    echo "❌ Publish failed"
    exit 1
fi

# Extract Package ID
PACKAGE_ID=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.type=="published") | .packageId')

# Extract Marketplace ID (the shared object)
MARKETPLACE_ID=$(echo $PUBLISH_OUTPUT | jq -r '.objectChanges[] | select(.type=="created" and .objectType | contains("Marketplace")) | .objectId')

echo ""
echo "✅ Deployment successful!"
echo "=========================================="
echo "📦 Package ID: $PACKAGE_ID"
echo "🏪 Marketplace ID: $MARKETPLACE_ID"
echo ""
echo "📝 Next steps:"
echo "1. Copy the following to your backend/.env file:"
echo ""
echo "PACKAGE_ID=$PACKAGE_ID"
echo "MARKETPLACE_ID=$MARKETPLACE_ID"
echo ""
echo "2. Get your private key (export from Sui client)"
echo "3. Add SUI_PRIVATE_KEY to .env"
echo "4. Run: cd ../backend && npm install && npm run dev"
echo ""
echo "🎉 Happy building!"