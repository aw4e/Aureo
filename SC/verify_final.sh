#!/bin/bash

# Verification using foundry.toml chain configuration

# Foundry paths
FORGE="$HOME/.foundry/bin/forge"
CAST="$HOME/.foundry/bin/cast"

# Contract Addresses
USDC_ADDR="0x53b8e9e6513A2e7A4d23F8F9BFe3F5985C9788e4"
GOLD_ADDR="0x6830999D9173B235dF6ac8c9068c4235fd58f532"
POOL_ADDR="0x475F5c184D23D5839123e7CDB23273eF0470C018"

# Pyth Config for AureoRWAPool constructor
PYTH_ADDR="0x98046Bd286715D3B0BC227Dd7a956b83D8978603"
GOLD_ID="0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"

# Load environment
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

if [ -z "$MANTLESCAN_API_KEY" ]; then
    echo "❌ Error: MANTLESCAN_API_KEY not found in .env file"
    exit 1
fi

echo "=================================="
echo "🚀 Verifying Contracts on Mantle Sepolia"
echo "=================================="
echo ""

# Verify MockUSDC
echo "📝 [1/3] Verifying MockUSDC at $USDC_ADDR..."
$FORGE verify-contract $USDC_ADDR \
    src/MockTokens.sol:MockUSDC \
    --chain mantle-sepolia \
    --watch || echo "⚠️  MockUSDC verification failed or already verified"

echo ""

# Verify MockGold  
echo "📝 [2/3] Verifying MockGold at $GOLD_ADDR..."
$FORGE verify-contract $GOLD_ADDR \
    src/MockTokens.sol:MockGold \
    --chain mantle-sepolia \
    --watch || echo "⚠️  MockGold verification failed or already verified"

echo ""

# Verify AureoRWAPool with constructor args
echo "📝 [3/3] Verifying AureoRWAPool at $POOL_ADDR..."
CONSTRUCTOR_ARGS=$($CAST abi-encode "constructor(address,bytes32,address,address)" $PYTH_ADDR $GOLD_ID $GOLD_ADDR $USDC_ADDR)
echo "Constructor args: $CONSTRUCTOR_ARGS"

$FORGE verify-contract $POOL_ADDR \
    src/AureoRWAPool.sol:AureoRWAPool \
    --constructor-args $CONSTRUCTOR_ARGS \
    --chain mantle-sepolia \
    --watch || echo "⚠️  AureoRWAPool verification failed or already verified"

echo ""
echo "=================================="
echo "✅ Verification process completed!"
echo "=================================="
echo ""
echo "Check your contracts on Mantle Explorer:"
echo "MockUSDC:      https://explorer.sepolia.mantle.xyz/address/$USDC_ADDR"
echo "MockGold:      https://explorer.sepolia.mantle.xyz/address/$GOLD_ADDR"
echo "AureoRWAPool:  https://explorer.sepolia.mantle.xyz/address/$POOL_ADDR"
echo ""
