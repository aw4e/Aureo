import { NextRequest, NextResponse } from 'next/server';
import { deposits } from '../../deposits/route';
import { analyzeGoldMarket } from '@/lib/services/aiService';
import { getGoldPrice, CONTRACT_ADDRESSES } from '@/lib/services/contractService';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server-side wallet for executing smart buys
// Note: This requires CONTRACT_PRIVATE_KEY to be set in environment
const PRIVATE_KEY = process.env.CONTRACT_PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.mantle.xyz';

// Minimal ABI for buyGold function
const AUREO_POOL_BUY_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "_usdcAmount", "type": "uint256" }],
    "name": "buyGold",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const USDC_APPROVE_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Server-side smart buy execution
 * This is used by the cron job to execute trades on behalf of users
 */
async function executeSmartBuyServerSide(
  usdcAmount: number
): Promise<{ txHash: string; goldPrice: number }> {
  if (!PRIVATE_KEY) {
    throw new Error('CONTRACT_PRIVATE_KEY not configured for server-side execution');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const aureoContract = new ethers.Contract(
    CONTRACT_ADDRESSES.AUREO_POOL,
    AUREO_POOL_BUY_ABI,
    wallet
  );

  const usdcContract = new ethers.Contract(
    CONTRACT_ADDRESSES.M_USDC,
    USDC_APPROVE_ABI,
    wallet
  );

  try {
    // Get USDC decimals and current gold price
    const [decimals, goldPrice] = await Promise.all([
      usdcContract.decimals(),
      getGoldPrice(),
    ]);

    const amountInWei = ethers.parseUnits(usdcAmount.toString(), decimals);

    // Approve USDC spending
    const approveTx = await usdcContract.approve(
      CONTRACT_ADDRESSES.AUREO_POOL,
      amountInWei
    );
    await approveTx.wait();

    // Execute buyGold
    const tx = await aureoContract.buyGold(amountInWei);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      goldPrice,
    };
  } catch (error) {
    console.error('Server-side Smart Buy Error:', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'hackathon-demo-secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pendingDeposits = deposits.filter(
      (d) => d.status === 'pending' || d.status === 'analyzing'
    );

    if (pendingDeposits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending deposits to analyze',
        processed: 0,
      });
    }

    const results = [];

    for (const deposit of pendingDeposits) {
      try {
        deposit.status = 'analyzing';

        const aiDecision = await analyzeGoldMarket(deposit.amount);

        deposit.aiAnalysis = {
          action: aiDecision.action === 'SELL' ? 'WAIT' : aiDecision.action as 'BUY' | 'WAIT',
          confidence: aiDecision.confidence,
          reasoning: aiDecision.reasoning,
          currentPrice: aiDecision.currentPrice,
          priceTarget: aiDecision.priceTarget,
          timestamp: new Date(),
        };

        if (aiDecision.action === 'BUY' && aiDecision.confidence >= 70) {
          const result = await executeSmartBuyServerSide(deposit.amount);

          // Estimate gold received based on price
          const estimatedGoldReceived = deposit.amount / result.goldPrice;

          deposit.status = 'completed';
          deposit.goldReceived = estimatedGoldReceived;
          deposit.txHash = result.txHash;

          results.push({
            depositId: deposit.depositId,
            action: 'BUY_EXECUTED',
            goldReceived: estimatedGoldReceived,
            txHash: result.txHash,
          });
        } else {
          results.push({
            depositId: deposit.depositId,
            action: 'WAITING',
            reasoning: aiDecision.reasoning,
          });
        }
      } catch (error) {
        console.error(`Error processing deposit ${deposit.depositId}:`, error);
        deposit.status = 'failed';

        results.push({
          depositId: deposit.depositId,
          action: 'FAILED',
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Cron Job Error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
