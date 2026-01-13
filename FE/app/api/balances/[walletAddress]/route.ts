import { NextRequest, NextResponse } from 'next/server';
import { getGoldBalance, getUSDCBalance } from '@/lib/services/contractService';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  try {
    const { walletAddress } = await params;

    const [goldBalance, usdcBalance] = await Promise.all([
      getGoldBalance(walletAddress),
      getUSDCBalance(walletAddress),
    ]);

    return NextResponse.json({
      success: true,
      balances: {
        gold: goldBalance,
        usdc: usdcBalance,
      },
    });
  } catch (error) {
    console.error('Balances API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    );
  }
}
