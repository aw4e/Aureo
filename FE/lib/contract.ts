/**
 * @deprecated Use lib/hooks/useAureoContract.ts instead for React components
 * This file is kept for backwards compatibility
 */

import { ethers, Eip1193Provider } from 'ethers';
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from './services/contractService';

/**
 * @deprecated Use useAureoContract hook instead
 */
export class ContractService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  async initialize(provider: Eip1193Provider) {
    this.provider = new ethers.BrowserProvider(provider);
    this.signer = await this.provider.getSigner();
  }

  async getUSDCContract() {
    if (!this.signer) throw new Error('Wallet not connected');
    return new ethers.Contract(CONTRACT_ADDRESSES.M_USDC, CONTRACT_ABIS.M_USDC, this.signer);
  }

  async getGoldContract() {
    if (!this.signer) throw new Error('Wallet not connected');
    return new ethers.Contract(CONTRACT_ADDRESSES.M_GOLD, CONTRACT_ABIS.M_GOLD, this.signer);
  }

  async getAureoPoolContract() {
    if (!this.signer) throw new Error('Wallet not connected');
    return new ethers.Contract(CONTRACT_ADDRESSES.AUREO_POOL, CONTRACT_ABIS.AUREO_POOL, this.signer);
  }

  async approveUSDC(amount: string) {
    const usdcContract = await this.getUSDCContract();
    const decimals = await usdcContract.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);

    const tx = await usdcContract.approve(CONTRACT_ADDRESSES.AUREO_POOL, amountInWei);
    await tx.wait();
    return tx.hash;
  }

  async buyGold(amount: string) {
    const aureoPool = await this.getAureoPoolContract();
    const usdcContract = await this.getUSDCContract();
    const decimals = await usdcContract.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);

    const allowance = await usdcContract.allowance(
      await this.signer!.getAddress(),
      CONTRACT_ADDRESSES.AUREO_POOL
    );

    if (allowance < amountInWei) {
      await this.approveUSDC(amount);
    }

    const tx = await aureoPool.buyGold(amountInWei);
    await tx.wait();
    return tx.hash;
  }

  async sellGold(goldAmount: string) {
    const aureoPool = await this.getAureoPoolContract();
    const goldContract = await this.getGoldContract();
    const amountInWei = ethers.parseUnits(goldAmount, 18);

    const allowance = await goldContract.allowance(
      await this.signer!.getAddress(),
      CONTRACT_ADDRESSES.AUREO_POOL
    );

    if (allowance < amountInWei) {
      const approveTx = await goldContract.approve(CONTRACT_ADDRESSES.AUREO_POOL, amountInWei);
      await approveTx.wait();
    }

    const tx = await aureoPool.sellGold(amountInWei);
    await tx.wait();
    return tx.hash;
  }

  async getGoldBalance(address: string): Promise<string> {
    const goldContract = await this.getGoldContract();
    const balance = await goldContract.balanceOf(address);
    return ethers.formatUnits(balance, 18);
  }

  async getGoldPrice(): Promise<string> {
    const aureoPool = await this.getAureoPoolContract();
    const price = await aureoPool.getGoldPrice18Decimals();
    return ethers.formatUnits(price, 18);
  }

  async getUSDCBalance(address: string): Promise<string> {
    const usdcContract = await this.getUSDCContract();
    const balance = await usdcContract.balanceOf(address);
    const decimals = await usdcContract.decimals();
    return ethers.formatUnits(balance, decimals);
  }
}

export const contractService = new ContractService();
