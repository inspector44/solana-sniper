import { Liquidity, LiquidityStateV4 } from '@raydium-io/raydium-sdk';
import { createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { PublicKey, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { createPoolKeys } from './liquidity';
import { logger } from './utils';
import { getMinimalMarketV3 } from './market';
import { COMMITMENT_LEVEL, NETWORK } from './constants';
import { SolNative } from './solNative';
import { WalletProvider } from './wallet';
import { TokenAccountManager } from './core/TokenAccountManager';
import { RabbitMQService } from './queue';
import { TokenProvider } from './token';
import { TradeType } from './types';

export async function buy(accountId: PublicKey, accountData: LiquidityStateV4): Promise<void> {
  try {
    const tokenAccountManager = new TokenAccountManager();
    let tokenAccount = TokenAccountManager.getInstance().existingTokenAccounts.get(accountData.baseMint.toString());

    if (!tokenAccount) {
      // it's possible that we didn't have time to fetch open book data
      const market = await getMinimalMarketV3(SolNative.getConnection(), accountData.marketId, COMMITMENT_LEVEL);
      tokenAccount = tokenAccountManager.saveTokenAccount(accountData.baseMint, market);
    }

    tokenAccount.poolKeys = createPoolKeys(accountId, accountData, tokenAccount.market!);
    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys: tokenAccount.poolKeys,
        userKeys: {
          tokenAccountIn: TokenAccountManager.getInstance().quoteTokenAssociatedAddress,
          tokenAccountOut: tokenAccount.address,
          owner: WalletProvider.getWallet().publicKey,
        },
        amountIn: TokenProvider.getInstance().quoteAmount.raw,
        minAmountOut: 0,
      },
      tokenAccount.poolKeys.version,
    );

    const latestBlockhash = await SolNative.getConnection().getLatestBlockhash({
      commitment: COMMITMENT_LEVEL,
    });
    const messageV0 = new TransactionMessage({
      payerKey: WalletProvider.getWallet().publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
        createAssociatedTokenAccountIdempotentInstruction(
          WalletProvider.getWallet().publicKey,
          tokenAccount.address,
          WalletProvider.getWallet().publicKey,
          accountData.baseMint,
        ),
        ...innerTransaction.instructions,
      ],
    }).compileToV0Message();
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([WalletProvider.getWallet(), ...innerTransaction.signers]);
    const signature = await SolNative.getConnection().sendRawTransaction(transaction.serialize(), {
      preflightCommitment: COMMITMENT_LEVEL,
    });

    await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: accountData.baseMint.toString(), Amount: TokenProvider.getInstance().quoteAmount.raw.toString(), Signature: signature, Type: TradeType.BuyRequested });
    logger.info({ mint: accountData.baseMint, signature }, `Sent buy tx`);
    const confirmation = await SolNative.getConnection().confirmTransaction(
      {
        signature,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        blockhash: latestBlockhash.blockhash,
      },
      COMMITMENT_LEVEL,
    );
    
    if (!confirmation.value.err) {
      await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: accountData.baseMint.toString(), Amount: TokenProvider.getInstance().quoteAmount.raw.toString(), Signature: "", Type: TradeType.BuyConfirmed })
      logger.info(
        {
          mint: accountData.baseMint,
          signature,
          url: `https://solscan.io/tx/${signature}?cluster=${NETWORK}`,
        },
        `Confirmed buy tx`,
      );
    } else {
      await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: accountData.baseMint.toString(), Amount: TokenProvider.getInstance().quoteAmount.raw.toString(), Signature: signature, Type: TradeType.BuyConfirmError });
      logger.debug(confirmation.value.err);
      logger.info({ mint: accountData.baseMint, signature }, `Error confirming buy tx`);
    }
  } catch (e) {
    logger.debug(e);
    logger.error({ mint: accountData.baseMint }, `Failed to buy token`);
  }
}