#!/bin/bash

# Simple verification script using flatten contracts
# This uses the already flattened contracts in the repo

# Foundry paths
FORGE="$HOME/.foundry/bin/forge"
CAST="$HOME/.foundry/bin/cast"

# Compiler version (must match the version used during deployment)
COMPILER_VERSION="0.8.30"

# Contract Addresses (Deployed on Mantle Sepolia - Chain ID 5003)
USDC_ADDR="0x53b8e9e6513A2e7A4d23F8F9BFe3F5985C9788e4"
GOLD_ADDR="0x6830999D9173B235dF6ac8c9068c4235fd58f532"
POOL_ADDR="0x475F5c184D23D5839123e7CDB23273eF0470C018"

echo "=================================="
echo "Mantle Sepolia Contract Verification Guide"
echo "=================================="
echo ""
echo "Your deployed contracts:"
echo "1. MockUSDC:     $USDC_ADDR"
echo "2. MockGold:     $GOLD_ADDR"
echo "3. AureoRWAPool: $POOL_ADDR"
echo ""
echo "Explorer URLs:"
echo "MockUSDC:      https://explorer.sepolia.mantle.xyz/address/$USDC_ADDR"
echo "MockGold:      https://explorer.sepolia.mantle.xyz/address/$GOLD_ADDR"
echo "AureoRWAPool:  https://explorer.sepolia.mantle.xyz/address/$POOL_ADDR"
echo ""
echo "=================================="
echo "Verification Options:"
echo "=================================="
echo ""
echo "Option 1: Manual UI Verification (Recommended for beginners)"
echo "  1. Go to the explorer URL above"
echo "  2. Click 'Code' or 'Contract' tab"
echo "  3. Click 'Verify & Publish'"
echo "  4. Upload the flattened contract files from this directory"
echo ""
echo "Option 2: Using Foundry with Blockscout API (Requires API Key)"
echo "  1. Visit: https://explorer.sepolia.mantle.xyz"
echo "  2. Sign in or create an account"
echo "  3. Go to 'My Account' -> 'API Keys'"
echo "  4. Generate a new API key"
echo "  5. Add it to your .env file: MANTLESCAN_API_KEY=your_key_here"
echo "  6. Run this script again with --run flag"
echo ""
echo "=================================="

# Check if --run flag is provided
if [ "$1" = "--run" ]; then
    # Load environment
    if [ -f .env ]; then
        set -a
        source .env
        set +a
    fi
    
    if [ -z "$MANTLESCAN_API_KEY" ]; then
        echo "❌ Error: MANTLESCAN_API_KEY not found in .env file"
        echo "Please follow Option 2 above to get your API key"
        exit 1
    fi
    
    echo "🚀 Starting automatic verification..."
    echo ""
    
    # Verify MockUSDC
    echo "📝 [1/3] Verifying MockUSDC..."
    $FORGE verify-contract $USDC_ADDR \
        src/MockTokens.sol:MockUSDC \
        --chain-id 5003 \
        --compiler-version $COMPILER_VERSION \
        --verifier blockscout \
        --verifier-url https://explorer.sepolia.mantle.xyz/api \
        --watch
    
    echo ""
    
    # Verify MockGold
    echo "📝 [2/3] Verifying MockGold..."
    $FORGE verify-contract $GOLD_ADDR \
        src/MockTokens.sol:MockGold \
        --chain-id 5003 \
        --compiler-version $COMPILER_VERSION \
        --verifier blockscout \
        --verifier-url https://explorer.sepolia.mantle.xyz/api \
        --watch
    
    echo ""
    
    # Verify AureoRWAPool with constructor args
    echo "📝 [3/3] Verifying AureoRWAPool..."
    
    PYTH_ADDR="0x98046Bd286715D3B0BC227Dd7a956b83D8978603"
    GOLD_ID="0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
    
    $FORGE verify-contract $POOL_ADDR \
        src/AureoRWAPool.sol:AureoRWAPool \
        --constructor-args $($CAST abi-encode "constructor(address,bytes32,address,address)" $PYTH_ADDR $GOLD_ID $GOLD_ADDR $USDC_ADDR) \
        --chain-id 5003 \
        --compiler-version $COMPILER_VERSION \
        --verifier blockscout \
        --verifier-url https://explorer.sepolia.mantle.xyz/api \
        --watch
    
    echo ""
    echo "✅ Verification complete!"
else
    echo "To verify automatically, first add your API key to .env, then run:"
    echo "  bash verify_simple.sh --run"
fi
