#!/bin/bash

# Verification script for Mantle Sepolia using Blockscout
# Blockscout doesn't require an API key for verification

# Foundry paths (use full path to avoid conflicts with other forge commands)
FORGE="$HOME/.foundry/bin/forge"
CAST="$HOME/.foundry/bin/cast"

# Contract Addresses (Deployed on Mantle Sepolia - Chain ID 5003)
USDC_ADDR="0x53b8e9e6513A2e7A4d23F8F9BFe3F5985C9788e4"
GOLD_ADDR="0x6830999D9173B235dF6ac8c9068c4235fd58f532"
POOL_ADDR="0x475F5c184D23D5839123e7CDB23273eF0470C018"

# Pyth Config
PYTH_ADDR="0x98046Bd286715D3B0BC227Dd7a956b83D8978603"
# ID ETH/USD (Substitute for Gold as XAU feed is inactive)
GOLD_ID="0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"

echo "=================================="
echo "Verifying Aureo Contracts on Mantle Sepolia using Blockscout"
echo "=================================="
echo ""

# 1. Verify MockUSDC
echo "📝 [1/3] Verifying MockUSDC at $USDC_ADDR..."
$FORGE verify-contract $USDC_ADDR \
    src/MockTokens.sol:MockUSDC \
    --chain-id 5003 \
    --verifier blockscout \
    --verifier-url https://explorer.sepolia.mantle.xyz/api \
    --watch

echo ""

# 2. Verify MockGold
echo "📝 [2/3] Verifying MockGold at $GOLD_ADDR..."
$FORGE verify-contract $GOLD_ADDR \
    src/MockTokens.sol:MockGold \
    --chain-id 5003 \
    --verifier blockscout \
    --verifier-url https://explorer.sepolia.mantle.xyz/api \
    --watch

echo ""

# 3. Verify AureoRWAPool
echo "📝 [3/3] Verifying AureoRWAPool at $POOL_ADDR..."
# Constructor Args: pythAddress, goldId, goldToken, usdcToken
ARGS=$($CAST abi-encode "constructor(address,bytes32,address,address)" \
    $PYTH_ADDR \
    $GOLD_ID \
    $GOLD_ADDR \
    $USDC_ADDR)

$FORGE verify-contract $POOL_ADDR \
    src/AureoRWAPool.sol:AureoRWAPool \
    --constructor-args $ARGS \
    --chain-id 5003 \
    --verifier blockscout \
    --verifier-url https://explorer.sepolia.mantle.xyz/api \
    --watch

echo ""
echo "=================================="
echo "✅ Verification process completed!"
echo "=================================="
echo ""
echo "Check your contracts on Mantle Explorer:"
echo "MockUSDC:      https://explorer.sepolia.mantle.xyz/address/$USDC_ADDR"
echo "MockGold:      https://explorer.sepolia.mantle.xyz/address/$GOLD_ADDR"
echo "AureoRWAPool:  https://explorer.sepolia.mantle.xyz/address/$POOL_ADDR"
