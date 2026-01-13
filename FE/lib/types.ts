// ============================================
// Aureo Smart Contract Types
// ============================================

export interface ContractAddresses {
  AUREO_POOL: string;
  M_GOLD: string;
  M_USDC: string;
}

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

// ABI Types
export interface BuyGoldEvent {
  user: string;
  usdcSpent: bigint;
  goldReceived: bigint;
  priceUsed: bigint;
}

export interface SellGoldEvent {
  user: string;
  goldSold: bigint;
  usdcReceived: bigint;
  priceUsed: bigint;
}

// Transaction Types
export interface GoldTransaction {
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: Date;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
}

// Deposit Types (for pending analysis)
export interface Deposit {
  depositId: string;
  walletAddress: string;
  amount: number;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  aiAnalysis?: AIAnalysis;
  goldReceived?: number;
  txHash?: string;
  createdAt: Date;
}

export interface AIAnalysis {
  action: 'BUY' | 'WAIT';
  confidence: number;
  reasoning: string;
  currentPrice: number;
  priceTarget: number;
  timestamp: Date;
}

// Network Configuration
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const MANTLE_SEPOLIA: NetworkConfig = {
  chainId: 5003,
  name: 'Mantle Sepolia Testnet',
  rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  explorerUrl: 'https://explorer.sepolia.mantle.xyz',
  nativeCurrency: {
    name: 'MNT',
    symbol: 'MNT',
    decimals: 18,
  },
};
