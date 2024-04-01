import {
    BigNumberish,
    Liquidity
  } from '@raydium-io/raydium-sdk';
  import {
    createCloseAccountInstruction,
  } from '@solana/spl-token';
  import {
    PublicKey,
    ComputeBudgetProgram,
    TransactionMessage,
    VersionedTransaction,
  } from '@solana/web3.js';
  import { logger } from '../utils';
  import {
    AUTO_SELL_DELAY,
    COMMITMENT_LEVEL,
    MAX_SELL_RETRIES,
    NETWORK,
  } from '../constants';
  import {  WalletProvider } from '../wallet';
  import { SolNative } from '../solNative'
  import { RabbitMQService } from '../queue';
  import { TokenAccountManager } from './TokenAccountManager';
  import { TradeType } from '../types';

export async function sell(mint: PublicKey, amount: BigNumberish): Promise<void> {
    let sold = false;
    let retries = 0;
  
    if (AUTO_SELL_DELAY > 0) {
      await new Promise((resolve) => setTimeout(resolve, AUTO_SELL_DELAY));
    }
  
    do {
      try {
        const tokenAccount = TokenAccountManager.getInstance().getExistingTokenAccounts().get(mint.toString());
  
        if (!tokenAccount) {
          return;
        }
  
        if (!tokenAccount.poolKeys) {
          logger.warn({ mint }, 'No pool keys found');
          return;
        }
  
        if (amount === 0) {
          logger.info(
            {
              mint: tokenAccount.mint,
            },
            `Empty balance, can't sell`,
          );
          return;
        }
  
        const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
          {
            poolKeys: tokenAccount.poolKeys!,
            userKeys: {
              tokenAccountOut: TokenAccountManager.getInstance().quoteTokenAssociatedAddress,
              tokenAccountIn: tokenAccount.address,
              owner: WalletProvider.getPublicKey(),
            },
            amountIn: amount,
            minAmountOut: 0,
          },
          tokenAccount.poolKeys!.version,
        );
  
        const latestBlockhash = await SolNative.getConnection().getLatestBlockhash({
          commitment: COMMITMENT_LEVEL,
        });
        const messageV0 = new TransactionMessage({
          payerKey: WalletProvider.getPublicKey(),
          recentBlockhash: latestBlockhash.blockhash,
          instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
            ...innerTransaction.instructions,
            createCloseAccountInstruction(tokenAccount.address, WalletProvider.getPublicKey(), WalletProvider.getPublicKey()),
          ],
        }).compileToV0Message();
        const transaction = new VersionedTransaction(messageV0);
        transaction.sign([WalletProvider.getWallet(), ...innerTransaction.signers]);
        const signature = await SolNative.getConnection().sendRawTransaction(transaction.serialize(), {
          preflightCommitment: COMMITMENT_LEVEL,
        });
        
        await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: mint.toString(), Amount: amount.toString(), Signature: signature, Type: TradeType.SellRequested });
        logger.info({ mint, signature, url: `https://solscan.io/tx/${signature}?cluster=${NETWORK}`, }, `Sent sell tx`);
        const confirmation = await SolNative.getConnection().confirmTransaction(
          {
            signature,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            blockhash: latestBlockhash.blockhash,
          },
          COMMITMENT_LEVEL,
        );
        if (confirmation.value.err) {
          logger.debug(confirmation.value.err);
          await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: mint.toString(), Amount: amount.toString(), Signature: signature, Type: TradeType.SellConfirmError});
          logger.info({ mint, signature }, `Error confirming sell tx`);
          continue;
        }
        
        await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: mint.toString(), Amount: amount.toString(), Signature: signature, Type: TradeType.SellConfirmed});
        logger.info(
          {
            dex: `https://dexscreener.com/solana/${mint}?maker=${WalletProvider.getPublicKey()}`,
            mint,
            signature,
            url: `https://solscan.io/tx/${signature}?cluster=${NETWORK}`,
          },
          `Confirmed sell tx`,
        );
        sold = true;
      } catch (e: any) {
        // wait for a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries++;
        logger.error(e);
        logger.error({ mint }, `Failed to sell token, retry: ${retries}/${MAX_SELL_RETRIES}`);
      }
    } while (!sold && retries < MAX_SELL_RETRIES);
  }