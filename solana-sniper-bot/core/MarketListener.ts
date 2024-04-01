import { LIQUIDITY_STATE_LAYOUT_V4, MARKET_STATE_LAYOUT_V3, MarketStateV3 } from '@raydium-io/raydium-sdk';
import { PublicKey, KeyedAccountInfo } from '@solana/web3.js';
import { RAYDIUM_LIQUIDITY_PROGRAM_ID_V4, OPENBOOK_PROGRAM_ID } from '../liquidity';
import { logger } from '../utils';
import { MinimalTokenAccountData } from '../types';
import bs58 from 'bs58';
import { AUTO_SELL, COMMITMENT_LEVEL } from '../constants';
import { TokenProvider } from '../token';
import { SolNative } from '../solNative'
import { sell } from './sell';
import { processRaydiumPool } from '../pool';
import { TokenAccountManager } from './TokenAccountManager';
import { WalletProvider } from '../wallet';
import {
  AccountLayout,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

export class MarketListener {
  private existingOpenBookMarkets: Set<string> = new Set<string>();
  private static instance: MarketListener;
  private existingLiquidityPools: Set<string> = new Set();

  private constructor() { }

  public static getInstance(): MarketListener {
    if (!MarketListener.instance) {
      MarketListener.instance = new MarketListener();
    }
    return MarketListener.instance;
  }

  async listenForMarketChanges(): Promise<void> {
    const runTimestamp = Math.floor(new Date().getTime() / 1000);

    SolNative.getConnection().onProgramAccountChange(
      RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
      async (updatedAccountInfo) => {
        const key = updatedAccountInfo.accountId.toString();
        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(updatedAccountInfo.accountInfo.data);
        const poolOpenTime = parseInt(poolState.poolOpenTime.toString());
        const existing = this.existingLiquidityPools.has(key);

        if (poolOpenTime > runTimestamp && !existing) {
          logger.info(`Success. Processing pool: ${key} with open time: ${poolOpenTime} and run time: ${runTimestamp}`);
          this.existingLiquidityPools.add(key);
          await processRaydiumPool(
            updatedAccountInfo.accountId,
            poolState
          );
        }
      },
      COMMITMENT_LEVEL,
      [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
        { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'), bytes: TokenProvider.getInstance().quoteToken.mint.toBase58() } },
        { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'), bytes: OPENBOOK_PROGRAM_ID.toBase58() } },
        { memcmp: { offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'), bytes: bs58.encode([6, 0, 0, 0, 0, 0, 0, 0]) } },
      ],
    );

    const openBookSubscriptionId = SolNative.getConnection().onProgramAccountChange(
      OPENBOOK_PROGRAM_ID,
      async (updatedAccountInfo) => {
        const key = updatedAccountInfo.accountId.toString();
        const existing = this.existingOpenBookMarkets.has(key);
        if (!existing) {
          this.existingOpenBookMarkets.add(key);
          const _ = this.processOpenBookMarket(updatedAccountInfo);
        }
      },
      COMMITMENT_LEVEL,
      [
        { dataSize: MARKET_STATE_LAYOUT_V3.span },
        {
          memcmp: {
            offset: MARKET_STATE_LAYOUT_V3.offsetOf('quoteMint'),
            bytes: TokenProvider.getInstance().quoteToken.mint.toBase58(),
          },
        },
      ],
    );

    if (AUTO_SELL) {
      this.listenForWalletChanges();
    }
    logger.info(`Listening for open book changes: ${openBookSubscriptionId}`);
  }

  private async processOpenBookMarket(updatedAccountInfo: KeyedAccountInfo) {
    let accountData: MarketStateV3 | undefined;
    try {
      accountData = MARKET_STATE_LAYOUT_V3.decode(updatedAccountInfo.accountInfo.data);
  
      // to be competitive, we collect market data before buying the token...
      if (TokenAccountManager.getInstance().existingTokenAccounts.has(accountData.baseMint.toString())) {
        return;
      }
  
      TokenAccountManager.getInstance().saveTokenAccount(accountData.baseMint, accountData);
    } catch (e) {
      logger.debug(e);
      logger.error({ mint: accountData?.baseMint }, `Failed to process market`);
    }
  }

  private listenForWalletChanges(): void {
    SolNative.getConnection().onProgramAccountChange(
      TOKEN_PROGRAM_ID,
      async (updatedAccountInfo) => {
        logger.info(`Received wallet change`);
        if (updatedAccountInfo.accountId.equals(TokenAccountManager.getInstance().quoteTokenAssociatedAddress)) return;

        const accountData = AccountLayout.decode(updatedAccountInfo.accountInfo!.data);
        await sell(accountData.mint, accountData.amount);
      },
      COMMITMENT_LEVEL,
      [
        { dataSize: 165 },
        { memcmp: { offset: 32, bytes: WalletProvider.getPublicKey().toBase58() } },
      ],
    );
  }
}