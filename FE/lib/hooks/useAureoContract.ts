'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import {
    CONTRACT_ADDRESSES,
    CONTRACT_ABIS,
    getGoldBalance,
    getUSDCBalance,
    getGoldPrice,
    getUSDCAllowance,
    getGoldAllowance
} from '@/lib/services/contractService';

// ============================================
// Types
// ============================================

export interface WalletBalances {
    gold: number;
    usdc: number;
    goldPrice: number;
    usdcAllowance: number;
    goldAllowance: number;
}

export interface TransactionResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

// ============================================
// Hook: useAureoContract
// ============================================

export function useAureoContract() {
    const { ready, authenticated, user } = usePrivy();
    const { wallets } = useWallets();

    const [balances, setBalances] = useState<WalletBalances>({
        gold: 0,
        usdc: 0,
        goldPrice: 0,
        usdcAllowance: 0,
        goldAllowance: 0,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get the connected wallet address
    const walletAddress = user?.wallet?.address;

    // Get the active wallet (first embedded or connected wallet)
    const activeWallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];

    // ============================================
    // Fetch Balances
    // ============================================

    const fetchBalances = useCallback(async () => {
        if (!walletAddress) return;

        setIsLoading(true);
        setError(null);

        try {
            const [gold, usdc, goldPrice, usdcAllowance, goldAllowance] = await Promise.all([
                getGoldBalance(walletAddress),
                getUSDCBalance(walletAddress),
                getGoldPrice(),
                getUSDCAllowance(walletAddress),
                getGoldAllowance(walletAddress),
            ]);

            setBalances({
                gold,
                usdc,
                goldPrice,
                usdcAllowance,
                goldAllowance,
            });
        } catch (err) {
            console.error('Error fetching balances:', err);
            setError('Failed to fetch balances');
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    // Auto-fetch balances when wallet is connected
    useEffect(() => {
        if (ready && authenticated && walletAddress) {
            fetchBalances();
        }
    }, [ready, authenticated, walletAddress, fetchBalances]);

    // ============================================
    // Get Ethers Signer from Privy Wallet
    // ============================================

    const getSigner = useCallback(async (): Promise<ethers.Signer> => {
        if (!activeWallet) {
            throw new Error('No wallet connected');
        }

        // Get the ethereum provider from Privy wallet
        const provider = await activeWallet.getEthereumProvider();

        // Check current chain and switch to Mantle Sepolia if needed
        const MANTLE_SEPOLIA_CHAIN_ID = 5003;
        const chainIdHex = `0x${MANTLE_SEPOLIA_CHAIN_ID.toString(16)}`; // 0x138b

        try {
            // Get current chain ID
            const currentChainId = await provider.request({ method: 'eth_chainId' });
            console.log('🔗 Current chain:', currentChainId, 'Target:', chainIdHex);

            if (currentChainId !== chainIdHex) {
                console.log('📡 Switching to Mantle Sepolia...');
                try {
                    // Try to switch chain
                    await provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: chainIdHex }],
                    });
                } catch (switchError: unknown) {
                    // If chain doesn't exist, add it
                    const errorCode = (switchError as { code?: number })?.code;
                    if (errorCode === 4902) {
                        await provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: chainIdHex,
                                chainName: 'Mantle Sepolia Testnet',
                                nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
                                rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
                                blockExplorerUrls: ['https://explorer.sepolia.mantle.xyz'],
                            }],
                        });
                    } else {
                        throw switchError;
                    }
                }
            }
        } catch (err) {
            console.warn('Chain switch warning:', err);
            // Continue even if chain switch fails - user might already be on correct chain
        }

        const ethersProvider = new ethers.BrowserProvider(provider);
        return ethersProvider.getSigner();
    }, [activeWallet]);

    // ============================================
    // Approve USDC
    // ============================================

    const approveUSDC = useCallback(async (amount: number): Promise<TransactionResult> => {
        try {
            setIsLoading(true);
            setError(null);

            const signer = await getSigner();
            const usdcContract = new ethers.Contract(
                CONTRACT_ADDRESSES.M_USDC,
                CONTRACT_ABIS.M_USDC,
                signer
            );

            const decimals = await usdcContract.decimals();
            const amountInWei = ethers.parseUnits(amount.toString(), decimals);

            const tx = await usdcContract.approve(CONTRACT_ADDRESSES.AUREO_POOL, amountInWei);
            const receipt = await tx.wait();

            await fetchBalances();

            return {
                success: true,
                txHash: receipt.hash,
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to approve USDC';
            console.error('Approve USDC Error:', err);
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, [getSigner, fetchBalances]);

    // ============================================
    // Approve mGold
    // ============================================

    const approveGold = useCallback(async (amount: number): Promise<TransactionResult> => {
        try {
            setIsLoading(true);
            setError(null);

            const signer = await getSigner();
            const goldContract = new ethers.Contract(
                CONTRACT_ADDRESSES.M_GOLD,
                CONTRACT_ABIS.M_GOLD,
                signer
            );

            const amountInWei = ethers.parseUnits(amount.toString(), 18);

            const tx = await goldContract.approve(CONTRACT_ADDRESSES.AUREO_POOL, amountInWei);
            const receipt = await tx.wait();

            await fetchBalances();

            return {
                success: true,
                txHash: receipt.hash,
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to approve mGold';
            console.error('Approve Gold Error:', err);
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, [getSigner, fetchBalances]);

    // ============================================
    // Buy Gold (USDC -> mGold)
    // ============================================

    const buyGold = useCallback(async (usdcAmount: number): Promise<TransactionResult> => {
        try {
            setIsLoading(true);
            setError(null);

            const signer = await getSigner();

            // Debug: Log addresses being used
            console.log('🔍 buyGold using addresses:', {
                M_USDC: CONTRACT_ADDRESSES.M_USDC,
                AUREO_POOL: CONTRACT_ADDRESSES.AUREO_POOL,
            });

            // Get USDC contract for decimals and approval
            const usdcContract = new ethers.Contract(
                CONTRACT_ADDRESSES.M_USDC,
                CONTRACT_ABIS.M_USDC,
                signer
            );

            const aureoContract = new ethers.Contract(
                CONTRACT_ADDRESSES.AUREO_POOL,
                CONTRACT_ABIS.AUREO_POOL,
                signer
            );

            const decimals = await usdcContract.decimals();
            const amountInWei = ethers.parseUnits(usdcAmount.toString(), decimals);

            // Check and handle approval
            const currentAllowance = await usdcContract.allowance(
                walletAddress,
                CONTRACT_ADDRESSES.AUREO_POOL
            );

            if (currentAllowance < amountInWei) {
                console.log('Approving USDC...');
                const approveTx = await usdcContract.approve(
                    CONTRACT_ADDRESSES.AUREO_POOL,
                    amountInWei
                );
                await approveTx.wait();
                console.log('USDC approved');
            }

            // ============================================
            // UPDATE PYTH PRICE BEFORE BUYING (Fix for StalePrice error)
            // ============================================
            console.log('📡 Updating Pyth oracle price...');
            let pythUpdateSuccess = false;
            try {
                // Pyth Hermes v2 API - correct endpoint format
                // Price ID for ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
                const priceId = 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
                const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${priceId}`;
                
                console.log('Fetching from:', PYTH_HERMES_URL);
                
                const response = await fetch(PYTH_HERMES_URL, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                
                if (!response.ok) {
                    throw new Error(`Hermes API returned ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Hermes response:', data);
                
                if (data && data.binary && data.binary.data && data.binary.data.length > 0) {
                    // v2 API returns hex encoded data directly
                    const updateData = '0x' + data.binary.data[0];
                    console.log('Update data length:', updateData.length);
                    
                    // Pyth contract on Mantle Sepolia (same as used in AureoRWAPool deployment)
                    const PYTH_ADDRESS = '0x98046Bd286715D3B0BC227Dd7a956b83D8978603';
                    const PYTH_ABI = [
                        'function updatePriceFeeds(bytes[] calldata updateData) external payable',
                        'function getUpdateFee(bytes[] calldata updateData) external view returns (uint256)'
                    ];
                    
                    const pythContract = new ethers.Contract(PYTH_ADDRESS, PYTH_ABI, signer);
                    
                    // Get update fee
                    const updateFee = await pythContract.getUpdateFee([updateData]);
                    console.log('Pyth update fee:', ethers.formatEther(updateFee), 'MNT');
                    
                    // Update price feeds
                    console.log('Sending Pyth update transaction...');
                    const updateTx = await pythContract.updatePriceFeeds([updateData], { value: updateFee });
                    await updateTx.wait();
                    console.log('✅ Pyth price updated successfully');
                    pythUpdateSuccess = true;
                } else {
                    console.warn('Hermes API returned unexpected format:', data);
                }
            } catch (pythError) {
                console.warn('⚠️ Pyth update failed:', pythError);
            }
            
            if (!pythUpdateSuccess) {
                console.warn('⚠️ Proceeding without Pyth update - transaction may fail if oracle is stale');
            }

            // Execute buyGold with slippage protection
            // Calculate minimum gold output with 5% slippage tolerance
            // For simplicity, we pass 0 (no slippage protection) - in production, calculate based on expected price
            // Better approach: fetch current price, calculate expected gold, apply 5% slippage
            console.log('Buying gold...');
            const minGoldOut = BigInt(0); // Accept any amount (no slippage protection for demo)
            const tx = await aureoContract.buyGold(amountInWei, minGoldOut);
            const receipt = await tx.wait();
            console.log('Gold purchased:', receipt.hash);

            await fetchBalances();

            return {
                success: true,
                txHash: receipt.hash,
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to buy gold';
            console.error('Buy Gold Error:', err);
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, [getSigner, walletAddress, fetchBalances]);

    // ============================================
    // Sell Gold (mGold -> USDC)
    // ============================================

    const sellGold = useCallback(async (goldAmount: number): Promise<TransactionResult> => {
        try {
            setIsLoading(true);
            setError(null);

            const signer = await getSigner();

            const goldContract = new ethers.Contract(
                CONTRACT_ADDRESSES.M_GOLD,
                CONTRACT_ABIS.M_GOLD,
                signer
            );

            const aureoContract = new ethers.Contract(
                CONTRACT_ADDRESSES.AUREO_POOL,
                CONTRACT_ABIS.AUREO_POOL,
                signer
            );

            const amountInWei = ethers.parseUnits(goldAmount.toString(), 18);

            // Check and handle approval
            const currentAllowance = await goldContract.allowance(
                walletAddress,
                CONTRACT_ADDRESSES.AUREO_POOL
            );

            if (currentAllowance < amountInWei) {
                console.log('Approving mGold...');
                const approveTx = await goldContract.approve(
                    CONTRACT_ADDRESSES.AUREO_POOL,
                    amountInWei
                );
                await approveTx.wait();
                console.log('mGold approved');
            }

            // ============================================
            // UPDATE PYTH PRICE BEFORE SELLING (Fix for StalePrice error)
            // ============================================
            console.log('📡 Updating Pyth oracle price...');
            let pythUpdateSuccess = false;
            try {
                // Pyth Hermes v2 API
                const priceId = 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
                const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${priceId}`;
                
                const response = await fetch(PYTH_HERMES_URL, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                
                if (!response.ok) {
                    throw new Error(`Hermes API returned ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data && data.binary && data.binary.data && data.binary.data.length > 0) {
                    const updateData = '0x' + data.binary.data[0];
                    
                    const PYTH_ADDRESS = '0x98046Bd286715D3B0BC227Dd7a956b83D8978603';
                    const PYTH_ABI = [
                        'function updatePriceFeeds(bytes[] calldata updateData) external payable',
                        'function getUpdateFee(bytes[] calldata updateData) external view returns (uint256)'
                    ];
                    
                    const pythContract = new ethers.Contract(PYTH_ADDRESS, PYTH_ABI, signer);
                    const updateFee = await pythContract.getUpdateFee([updateData]);
                    
                    console.log('Sending Pyth update transaction...');
                    const updateTx = await pythContract.updatePriceFeeds([updateData], { value: updateFee });
                    await updateTx.wait();
                    console.log('✅ Pyth price updated successfully');
                    pythUpdateSuccess = true;
                }
            } catch (pythError) {
                console.warn('⚠️ Pyth update failed:', pythError);
            }
            
            if (!pythUpdateSuccess) {
                console.warn('⚠️ Proceeding without Pyth update - transaction may fail if oracle is stale');
            }

            // Execute sellGold with slippage protection
            // For simplicity, we pass 0 (no slippage protection) - in production, calculate based on expected price
            console.log('Selling gold...');
            const minUsdcOut = BigInt(0); // Accept any amount (no slippage protection for demo)
            const tx = await aureoContract.sellGold(amountInWei, minUsdcOut);
            const receipt = await tx.wait();
            console.log('Gold sold:', receipt.hash);

            await fetchBalances();

            return {
                success: true,
                txHash: receipt.hash,
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to sell gold';
            console.error('Sell Gold Error:', err);
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, [getSigner, walletAddress, fetchBalances]);

    // ============================================
    // Mint Test USDC (for testnet only)
    // ============================================

    const mintTestUSDC = useCallback(async (amount: number): Promise<TransactionResult> => {
        try {
            setIsLoading(true);
            setError(null);

            const signer = await getSigner();
            const usdcContract = new ethers.Contract(
                CONTRACT_ADDRESSES.M_USDC,
                CONTRACT_ABIS.M_USDC,
                signer
            );

            const decimals = await usdcContract.decimals();
            const amountInWei = ethers.parseUnits(amount.toString(), decimals);

            // Mint test USDC (only works on testnet with mock contract)
            const tx = await usdcContract.mint(walletAddress, amountInWei);
            const receipt = await tx.wait();

            await fetchBalances();

            return {
                success: true,
                txHash: receipt.hash,
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to mint test USDC';
            console.error('Mint USDC Error:', err);
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setIsLoading(false);
        }
    }, [getSigner, walletAddress, fetchBalances]);

    return {
        // State
        balances,
        isLoading,
        error,
        walletAddress,
        isConnected: ready && authenticated && !!walletAddress,

        // Actions
        fetchBalances,
        approveUSDC,
        approveGold,
        buyGold,
        sellGold,
        mintTestUSDC,

        // Contract info
        contractAddresses: CONTRACT_ADDRESSES,
    };
}
