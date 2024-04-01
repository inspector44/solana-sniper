import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { getTokenAccounts } from '../liquidity';
import { MinimalMarketLayoutV3 } from '../market';
import { MinimalTokenAccountData } from '../types';
import { COMMITMENT_LEVEL } from '../constants';
import { WalletProvider } from '../wallet';
import { TokenProvider } from '../token';
import { SolNative } from '../solNative'

export class TokenAccountManager {
  public existingTokenAccounts: Map<string, MinimalTokenAccountData> = new Map();
  public quoteTokenAssociatedAddress!: PublicKey;
  private static instance: TokenAccountManager;

  public static getInstance(): TokenAccountManager {
    if (!TokenAccountManager.instance) {
      TokenAccountManager.instance = new TokenAccountManager();
    }
    return TokenAccountManager.instance;
  }

  saveTokenAccount(mint: PublicKey, accountData: MinimalMarketLayoutV3): MinimalTokenAccountData {
    const ata = getAssociatedTokenAddressSync(mint, WalletProvider.getPublicKey());
    const tokenAccount: MinimalTokenAccountData = {
      address: ata,
      mint: mint,
      market: {
        bids: accountData.bids,
        asks: accountData.asks,
        eventQueue: accountData.eventQueue,
      },
    };
    this.existingTokenAccounts.set(mint.toString(), tokenAccount);
    return tokenAccount;
  }

  getExistingTokenAccounts(): Map<string, MinimalTokenAccountData> {
    return this.existingTokenAccounts;
  }

  async initTokenAccounts(): Promise<void> {
    const tokenAccounts = await getTokenAccounts(
      SolNative.getConnection(),
      WalletProvider.getPublicKey(),
      COMMITMENT_LEVEL,
    );
    tokenAccounts.forEach((ta) =>
      this.existingTokenAccounts.set(ta.accountInfo.mint.toString(), {
        mint: ta.accountInfo.mint,
        address: ta.pubkey,
      }),
    );
    const tokenAccount = tokenAccounts.find(
      (acc) => acc.accountInfo.mint.toString() === TokenProvider.getInstance().quoteToken.mint.toString(),
    );
    if (!tokenAccount) throw new Error(`No ${TokenProvider.getInstance().quoteToken.symbol} token account found in wallet.`);
    this.quoteTokenAssociatedAddress = tokenAccount.pubkey;
  }
}