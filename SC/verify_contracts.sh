#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "Error: .env file not found."
    exit 1
fi

if [ -z "$MANTLESCAN_API_KEY" ]; then
    echo "Error: MANTLESCAN_API_KEY not found in .env"
    echo "Please add it: MANTLESCAN_API_KEY=your_api_key"
    exit 1
fi

# New Deployment Addresses (Deployed on Mantle Sepolia - Chain ID 5003)
USDC_ADDR="0x20f58AE33a676969B29721E09c7B8fD67B2EB212"
GOLD_ADDR="0xE4D1eE878Ea7821777A648633565de9cD7633C34"
POOL_ADDR="0x7D62184c94F46048014C89652690732d5bac5B3F"

# Pyth Config
PYTH_ADDR="0xA2aa501b19aff244D90cc15a4Cf739D2725B5729"
GOLD_ID="0x765d2ba906dbc32ca17cc11f5310a89e9ee7f6496373a5527cf664719e700975"

# 1. Verify MockUSDC
echo "Verifying MockUSDC at $USDC_ADDR..."
forge verify-contract $USDC_ADDR src/MockTokens.sol:MockUSDC --chain-id 5003 --watch

# 2. Verify MockGold
echo "Verifying MockGold at $GOLD_ADDR..."
forge verify-contract $GOLD_ADDR src/MockTokens.sol:MockGold --chain-id 5003 --watch

# 3. Verify AureoRWAPool
echo "Verifying AureoRWAPool at $POOL_ADDR..."
# Constructor Args: pythAddress, goldId, goldToken, usdcToken
# Note: We use the NEW addresses for gold and usdc here
ARGS=$(cast abi-encode "constructor(address,bytes32,address,address)" \
    $PYTH_ADDR \
    $GOLD_ID \
    $GOLD_ADDR \
    $USDC_ADDR)

forge verify-contract $POOL_ADDR src/AureoRWAPool.sol:AureoRWAPool --constructor-args $ARGS --chain-id 5003 --watch

echo "Verification process completed."