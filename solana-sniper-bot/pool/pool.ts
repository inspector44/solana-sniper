import { LiquidityStateV4, TokenAmount, } from '@raydium-io/raydium-sdk';
import { PublicKey } from '@solana/web3.js';
  import { logger } from '../utils';
  import { MintLayout } from '../types';
  import {
    CHECK_IF_MINT_IS_RENOUNCED,
    USE_SNIPE_LIST,
  } from '../constants';
  import { SolNative } from '../solNative'
  import { buy } from '../buy';
  import { TokenProvider } from '../token';
  import { SnipeListManager } from '../core/SnipeListManager';
  
export async function processRaydiumPool(id: PublicKey, poolState: LiquidityStateV4) {
    if (!shouldBuy(poolState.baseMint.toString(), SnipeListManager.getInstance().getSnipeList())) {
      return;
    }
  
    if (!TokenProvider.getInstance().quoteMinPoolSizeAmount.isZero()) {
      const poolSize = new TokenAmount(TokenProvider.getInstance().quoteToken, poolState.swapQuoteInAmount, true);
      logger.info(`Processing pool: ${id.toString()} with ${poolSize.toFixed()} ${TokenProvider.getInstance().quoteToken.symbol} in liquidity`);
  
      if (poolSize.lt(TokenProvider.getInstance().quoteMinPoolSizeAmount)) {
        logger.warn(
          {
            mint: poolState.baseMint,
            pooled: `${poolSize.toFixed()} ${TokenProvider.getInstance().quoteToken.symbol}`,
          },
          `Skipping pool, smaller than ${TokenProvider.getInstance().quoteMinPoolSizeAmount.toFixed()} ${TokenProvider.getInstance().quoteToken.symbol}`,
          `Swap quote in amount: ${poolSize.toFixed()}`,
        );
        return;
      }
    }
  
    if (CHECK_IF_MINT_IS_RENOUNCED) {
      const mintOption = await checkMintable(poolState.baseMint);
  
      if (mintOption !== true) {
        logger.warn({ mint: poolState.baseMint }, 'Skipping, owner can mint tokens!');
        return;
      }
    }
  
    await buy(id, poolState);
  }

  function shouldBuy(key: string, snipeList : string[]): boolean {
    return USE_SNIPE_LIST ? snipeList.includes(key) : true;
  }

  export async function checkMintable(vault: PublicKey): Promise<boolean | undefined> {
    try {
      let { data } = (await SolNative.getConnection().getAccountInfo(vault)) || {};
      if (!data) {
        return;
      }
      const deserialize = MintLayout.decode(data);
      return deserialize.mintAuthorityOption === 0;
    } catch (e) {
      logger.debug(e);
      logger.error({ mint: vault }, `Failed to check if mint is renounced`);
    }
  }