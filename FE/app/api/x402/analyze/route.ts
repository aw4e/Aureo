/**
 * x402-Protected AI Market Analysis Endpoint
 * 
 * Premium AI-powered gold market analysis
 * Protected by x402 - users pay $0.01 USDC per analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { withX402Protection, X402_CONFIG } from '@/lib/x402';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ethers } from 'ethers';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.mantle.xyz';
const AUREO_POOL_ADDRESS = process.env.NEXT_PUBLIC_AUREO_POOL_ADDRESS || '0x475F5c184D23D5839123e7CDB23273eF0470C018';

const AUREO_POOL_ABI = [
    'function getGoldPrice18Decimals() external view returns (uint256)',
];

interface MarketAnalysis {
    action: 'BUY' | 'WAIT';
    confidence: number;
    reasoning: string;
    currentPrice: number;
    priceTarget: number;
    indicators: {
        priceVsEMA: 'above' | 'below' | 'at';
        volatility: 'high' | 'medium' | 'low';
        trend: 'bullish' | 'bearish' | 'neutral';
    };
    recommendation: string;
    timestamp: string;
}

/**
 * Get current gold price from Pyth oracle via Aureo Pool
 */
async function getGoldPrice(): Promise<number> {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const aureoPool = new ethers.Contract(AUREO_POOL_ADDRESS, AUREO_POOL_ABI, provider);
        const priceWei = await aureoPool.getGoldPrice18Decimals();
        return Number(ethers.formatUnits(priceWei, 18));
    } catch (error) {
        console.error('Failed to get gold price:', error);
        // Fallback to approximate price
        return 65.50;
    }
}

/**
 * AI Market Analysis Handler
 */
async function analyzeMarket(
    request: NextRequest,
    payer: string
): Promise<NextResponse> {
    try {
        const body = await request.json();
        const { depositAmount } = body;

        // Get current gold price
        const currentPrice = await getGoldPrice();

        // Simulated market data (in production, this would come from real sources)
        const high24h = currentPrice * 1.015;
        const low24h = currentPrice * 0.985;
        const change24h = ((currentPrice - low24h) / low24h) * 100;
        const volatility = Math.abs(high24h - low24h) / currentPrice * 100;
        const emaPrice = currentPrice * 0.998;

        // AI Analysis prompt
        const prompt = `You are AUREO AI, an expert gold trading analyst. Analyze the current gold market and decide whether to BUY gold NOW or WAIT for a better entry point.

CURRENT MARKET DATA:
- Current Gold Price (XAU/USD): $${currentPrice.toFixed(2)}
- 24h High: $${high24h.toFixed(2)}
- 24h Low: $${low24h.toFixed(2)}
- 24h Change: ${change24h.toFixed(2)}%
- Market Volatility: ${volatility.toFixed(2)}%
- EMA Price: $${emaPrice.toFixed(2)}
- Deposit Amount: ${depositAmount || 100} USDC

DECISION CRITERIA:
1. BUY if:
   - Price is near 24h low (within 0.5% of low)
   - Price dropped >1% from EMA (dip opportunity)
   - Volatility is high (>0.3%) indicating potential reversal
   - Strong buying signals in short-term trend

2. WAIT if:
   - Price is near 24h high
   - Price is trending upward without pullback
   - Volatility is low and no clear entry advantage
   - Better entry point expected within next 5-10 minutes

Respond ONLY in this JSON format:
{
  "action": "BUY" or "WAIT",
  "confidence": 0-100,
  "reasoning": "Brief 1-2 sentence explanation",
  "currentPrice": ${currentPrice},
  "priceTarget": estimated_optimal_entry_price,
  "indicators": {
    "priceVsEMA": "above" or "below" or "at",
    "volatility": "high" or "medium" or "low",
    "trend": "bullish" or "bearish" or "neutral"
  },
  "recommendation": "Detailed recommendation for user"
}`;

        let analysis: MarketAnalysis;

        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid AI response format');
            }

            analysis = {
                ...JSON.parse(jsonMatch[0]),
                timestamp: new Date().toISOString(),
            };
        } catch (aiError) {
            console.error('AI Analysis Error:', aiError);

            // Fallback to price-based decision
            const fallbackAction = currentPrice < emaPrice * 0.995 ? 'BUY' : 'WAIT';
            analysis = {
                action: fallbackAction,
                confidence: 60,
                reasoning: 'Fallback: Price-based decision due to AI service unavailability',
                currentPrice,
                priceTarget: low24h,
                indicators: {
                    priceVsEMA: currentPrice < emaPrice ? 'below' : currentPrice > emaPrice ? 'above' : 'at',
                    volatility: volatility > 0.5 ? 'high' : volatility > 0.2 ? 'medium' : 'low',
                    trend: change24h > 0.5 ? 'bullish' : change24h < -0.5 ? 'bearish' : 'neutral',
                },
                recommendation: fallbackAction === 'BUY'
                    ? 'Current price shows good entry opportunity based on technical indicators'
                    : 'Recommend waiting for better entry point',
                timestamp: new Date().toISOString(),
            };
        }

        return NextResponse.json({
            success: true,
            analysis,
            marketData: {
                currentPrice,
                high24h,
                low24h,
                change24h,
                volatility,
                emaPrice,
            },
            payer,
            x402Fee: X402_CONFIG.pricing.marketAnalysis / 1_000_000,
        });

    } catch (error) {
        console.error('Market analysis error:', error);
        return NextResponse.json(
            { error: 'Market analysis failed', details: (error as Error).message },
            { status: 500 }
        );
    }
}

// Export with x402 protection - $0.01 USDC per analysis
export const POST = withX402Protection(
    analyzeMarket,
    X402_CONFIG.pricing.marketAnalysis,
    'AI Market Analysis - Real-time gold market insights powered by AUREO AI'
);

// GET endpoint to check pricing
export async function GET() {
    return NextResponse.json({
        endpoint: '/api/x402/analyze',
        description: 'AI-powered gold market analysis with buy/wait recommendations',
        pricing: {
            amount: X402_CONFIG.pricing.marketAnalysis,
            amountUSDC: X402_CONFIG.pricing.marketAnalysis / 1_000_000,
            currency: 'USDC',
            network: X402_CONFIG.paymentToken.network,
        },
        x402: {
            version: '1',
            payee: X402_CONFIG.payee,
            token: X402_CONFIG.paymentToken.address,
        },
    });
}
