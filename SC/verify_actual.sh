#!/bin/bash

# This script verifies the contract that was actually deployed according to broadcast/DeployAureo.s.sol/5003/run-latest.json

# Foundry paths
FORGE="$HOME/.foundry/bin/forge"
CAST="$HOME/.foundry/bin/cast"

# ACTUAL deployed contract addresses from run-latest.json
USDC_ADDR="0x20f58AE33a676969B29721E09c7B8fD67B2EB212"
GOLD_ADDR="0xE4D1eE878Ea7821777A648633565de9cD7633C34"
POOL_ADDR="0x7D62184c94F46048014C89652690732d5bac5B3F"

# Pyth Config used in deployment
PYTH_ADDR="0xA2aa501b19aff244D90cc15a4Cf739D2725B5729"
GOLD_ID="0x765d2ba906dbc32ca17cc11f5310a89e9ee7f6496373a5527cf664719e700975"

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
echo "🚀 Verifying ACTUAL Deployed Contracts"
echo "=================================="
echo ""
echo "NOTE: The addresses in your README are DIFFERENT from the actual deployed contracts!"
echo ""
echo "Actual deployed addresses (from broadcast log):"
echo "MockUSDC:     $USDC_ADDR"
echo "MockGold:     $GOLD_ADDR"
echo "AureoRWAPool: $POOL_ADDR"
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
echo "⚠️  Note: Please update your README.md with these correct addresses!"
echo ""
