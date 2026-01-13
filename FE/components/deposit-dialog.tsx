'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Wallet, Loader2, AlertCircle } from 'lucide-react';

interface DepositDialogProps {
  children: React.ReactNode;
  onDeposit: (amount: number) => void;
  usdcBalance?: number;
  isLoading?: boolean;
}

export function DepositDialog({
  children,
  onDeposit,
  usdcBalance = 0,
  isLoading = false
}: DepositDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const quickAmounts = [25, 50, 100, 250];
  const parsedAmount = parseFloat(amount) || 0;
  const hasEnoughBalance = parsedAmount <= usdcBalance;
  const isValidAmount = parsedAmount > 0 && hasEnoughBalance;

  const handleDeposit = async () => {
    if (!isValidAmount) return;

    setIsProcessing(true);
    try {
      await onDeposit(parsedAmount);
      setOpen(false);
      setAmount('');
    } catch (error) {
      console.error('Deposit error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(usdcBalance.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl border-border bg-card">
        <DialogHeader className="text-left">
          <div className="w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
            <Wallet className="w-7 h-7 text-green-500" />
          </div>
          <DialogTitle className="text-xl">Buy Gold</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Spend USDC to buy mGold tokens at the current market price via Pyth Oracle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Available Balance */}
          <div className="bg-muted rounded-2xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-muted-foreground">Available USDC</div>
                <div className="text-2xl font-bold mt-1">${usdcBalance.toFixed(2)}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMaxAmount}
                className="rounded-xl"
              >
                Max
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (USDC)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 py-6 text-2xl font-semibold rounded-xl"
                disabled={isProcessing || isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Quick select</label>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((quick) => (
                <Button
                  key={quick}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(quick.toString())}
                  disabled={quick > usdcBalance || isProcessing || isLoading}
                  className={`font-medium rounded-xl py-5 ${amount === quick.toString()
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                    } ${quick > usdcBalance ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  ${quick}
                </Button>
              ))}
            </div>
          </div>

          {/* Insufficient Balance Warning */}
          {parsedAmount > 0 && !hasEnoughBalance && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-4 rounded-xl">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Insufficient Balance</p>
                <p className="text-red-400">You only have ${usdcBalance.toFixed(2)} USDC.</p>
              </div>
            </div>
          )}

          {/* Transaction Preview */}
          {isValidAmount && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-2 text-sm w-full">
                  <p className="font-medium text-foreground">Transaction Preview</p>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>You spend:</span>
                      <span className="font-medium text-foreground">${parsedAmount.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between">
                      <span>You receive:</span>
                      <span className="font-medium text-amber-600">mGold (at market price)</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/50">
                    The transaction will require 2 steps: approve USDC spending, then buy gold.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setAmount('');
            }}
            disabled={isProcessing || isLoading}
            className="w-full sm:w-auto rounded-xl py-5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            disabled={!isValidAmount || isProcessing || isLoading}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white rounded-xl py-5"
          >
            {isProcessing || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Buy Gold'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
