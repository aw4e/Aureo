/**
 * Cron Job: AI Agent Auto-Analysis & Execution
 * 
 * This endpoint is designed to be called by a cron scheduler (e.g., Vercel Cron)
 * to run AI analysis and execute trades for users who have auto-agent enabled.
 * 
 * Key features:
 * - Runs even when users are offline
 * - Respects user's agent settings (minConfidence, riskLevel, maxAmount)
 * - Uses shared store for settings persistence
 * - Logs all executions for transparency
 * 
 * Setup:
 * 1. Set CRON_SECRET in environment variables
 * 2. Set AI_AGENT_PRIVATE_KEY for server-side execution
 * 3. Configure cron job to call GET /api/cron/analyze with Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeGoldMarket } from '@/lib/services/aiService';
import { getUserBalances, CONTRACT_ADDRESSES } from '@/lib/services/contractService';
import { 
  agentStore, 
  AgentSettings, 
  ExecutionLog,
  getAllActiveAgents,
  addExecutionLog 
} from '@/lib/stores/agentStore';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server-side wallet for executing smart buys
const PRIVATE_KEY = process.env.AI_AGENT_PRIVATE_KEY || process.env.CONTRACT_PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.mantle.xyz';

// Minimal ABIs
const AUREO_POOL_ABI = [
  'function buyGold(uint256 _usdcAmount, uint256 _minGoldOut) external',
  'function getGoldPrice18Decimals() external view returns (uint256)',
];

const USDC_ABI = [
  'function approve(address spender, uint256 value) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

/**
 * Execute smart buy for a specific user wallet
 * Note: In production, this would use delegated execution or x402
 */
async function executeSmartBuyForUser(
  userAddress: string,
  usdcAmount: number
): Promise<{ txHash: string; goldPrice: number; goldReceived: number }> {
  if (!PRIVATE_KEY) {
    throw new Error('AI_AGENT_PRIVATE_KEY not configured for server-side execution');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const aureoContract = new ethers.Contract(
    CONTRACT_ADDRESSES.AUREO_POOL,
    AUREO_POOL_ABI,
    wallet
  );

  const usdcContract = new ethers.Contract(
    CONTRACT_ADDRESSES.M_USDC,
    USDC_ABI,
    wallet
  );

  // Get current price and decimals
  const [goldPrice, decimals] = await Promise.all([
    aureoContract.getGoldPrice18Decimals(),
    usdcContract.decimals(),
  ]);

  const priceUSD = Number(ethers.formatUnits(goldPrice, 18));
  const amountInWei = ethers.parseUnits(usdcAmount.toString(), decimals);

  // Approve and execute
  const approveTx = await usdcContract.approve(CONTRACT_ADDRESSES.AUREO_POOL, amountInWei);
  await approveTx.wait();

  const minGoldOut = BigInt(0); // Accept any amount for demo
  const tx = await aureoContract.buyGold(amountInWei, minGoldOut);
  const receipt = await tx.wait();

  // Estimate gold received
  const goldReceived = usdcAmount / priceUSD;

  console.log(`✅ Smart buy executed for ${userAddress.slice(0, 10)}...`, {
    usdcSpent: usdcAmount,
    goldReceived: goldReceived.toFixed(6),
    txHash: receipt.hash,
  });

  return {
    txHash: receipt.hash,
    goldPrice: priceUSD,
    goldReceived,
  };
}

/**
 * Process a single agent
 */
async function processAgent(settings: AgentSettings): Promise<ExecutionLog> {
  const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  console.log(`🤖 Processing agent for ${settings.walletAddress.slice(0, 10)}...`);
  
  try {
    // Get user's balances
    const balances = await getUserBalances(settings.walletAddress);
    
    if (balances.usdc <= 0) {
      const log: ExecutionLog = {
        id: executionId,
        walletAddress: settings.walletAddress,
        action: 'WAIT',
        confidence: 0,
        reasoning: 'No USDC balance available',
        status: 'skipped',
        timestamp: new Date(),
      };
      addExecutionLog(log);
      return log;
    }

    // Determine trade amount (respect maxAmountPerTrade)
    const tradeAmount = Math.min(balances.usdc, settings.maxAmountPerTrade);

    // Run AI analysis
    const analysis = await analyzeGoldMarket(tradeAmount, settings.riskLevel);

    console.log(`📊 AI Analysis for ${settings.walletAddress.slice(0, 10)}:`, {
      action: analysis.action,
      confidence: analysis.confidence,
      minRequired: settings.minConfidence,
    });

    // Check if we should execute
    const shouldExecute = 
      analysis.action === 'BUY' && 
      analysis.confidence >= settings.minConfidence &&
      settings.autoExecute;

    if (!shouldExecute) {
      const reason = analysis.action !== 'BUY' 
        ? `AI recommends ${analysis.action}`
        : `Confidence ${analysis.confidence}% below threshold ${settings.minConfidence}%`;
      
      const log: ExecutionLog = {
        id: executionId,
        walletAddress: settings.walletAddress,
        action: analysis.action === 'BUY' ? 'BUY' : 'WAIT',
        confidence: analysis.confidence,
        reasoning: reason,
        status: 'skipped',
        timestamp: new Date(),
      };
      addExecutionLog(log);
      return log;
    }

    // Execute the trade
    // Note: In current implementation, SERVER wallet executes the trade
    // In production: Use delegated execution, session keys, or x402
    const result = await executeSmartBuyForUser(settings.walletAddress, tradeAmount);

    const log: ExecutionLog = {
      id: executionId,
      walletAddress: settings.walletAddress,
      action: 'BUY',
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      amount: tradeAmount,
      txHash: result.txHash,
      status: 'executed',
      timestamp: new Date(),
    };
    addExecutionLog(log);
    return log;

  } catch (error) {
    console.error(`❌ Agent execution failed for ${settings.walletAddress}:`, error);
    const log: ExecutionLog = {
      id: executionId,
      walletAddress: settings.walletAddress,
      action: 'WAIT',
      confidence: 0,
      reasoning: `Execution failed: ${(error as Error).message}`,
      status: 'failed',
      timestamp: new Date(),
    };
    addExecutionLog(log);
    return log;
  }
}

/**
 * Main cron handler
 * 
 * Security: Protected by CRON_SECRET
 * Frequency: Recommended every 5 minutes
 * 
 * Call with: GET /api/cron/analyze
 * Headers: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  // Verify authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'hackathon-demo-secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active agents
    const activeAgentsList = getAllActiveAgents();

    console.log(`\n🔄 Cron job started at ${new Date().toISOString()}`);
    console.log(`📋 Active agents: ${activeAgentsList.length}`);

    if (activeAgentsList.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active agents to process',
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Process all agents
    const results: ExecutionLog[] = [];
    for (const agent of activeAgentsList) {
      const result = await processAgent(agent);
      results.push(result);
    }

    // Update last cron run time
    agentStore.setLastCronRun(new Date());

    // Summary
    const summary = {
      totalProcessed: results.length,
      executed: results.filter(r => r.status === 'executed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      durationMs: Date.now() - startTime,
    };

    console.log(`\n✨ Cron job completed:`, summary);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      results: results.map(r => ({
        wallet: r.walletAddress.slice(0, 10) + '...',
        action: r.action,
        confidence: r.confidence,
        status: r.status,
        txHash: r.txHash?.slice(0, 20),
      })),
    });

  } catch (error) {
    console.error('❌ Cron Job Error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST - Manual trigger for testing
 * 
 * Can be used to:
 * 1. Manually trigger the cron job
 * 2. Get current state of all agents
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'hackathon-demo-secret';

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'trigger') {
      // Trigger the cron job manually
      const response = await GET(req);
      return response;
    }

    // Default: return current state
    const activeAgents = getAllActiveAgents();
    const recentLogs = agentStore.getExecutionLogs(undefined, 20);

    return NextResponse.json({
      success: true,
      state: {
        activeAgentsCount: activeAgents.length,
        activeAgents: activeAgents.map(a => ({
          wallet: a.walletAddress.slice(0, 10) + '...',
          minConfidence: a.minConfidence,
          riskLevel: a.riskLevel,
          maxAmount: a.maxAmountPerTrade,
        })),
        recentExecutions: recentLogs.slice(0, 10),
        lastCronRun: agentStore.getLastCronRun()?.toISOString() || null,
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
