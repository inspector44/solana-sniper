import { struct, u32, u8 } from '@solana/buffer-layout';
import { bool, publicKey, u64 } from '@solana/buffer-layout-utils';
import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import { MinimalMarketLayoutV3 } from '../market';
import { logger } from '../utils';
import { SolNative } from '../solNative';
import {
    LiquidityPoolKeys,
  } from '@raydium-io/raydium-sdk';

/** Information about a mint */
export interface Mint {
    /** Address of the mint */
    address: PublicKey;
    /**
     * Optional authority used to mint new tokens. The mint authority may only be provided during mint creation.
     * If no mint authority is present then the mint has a fixed supply and no further tokens may be minted.
     */
    mintAuthority: PublicKey | null;
    /** Total supply of tokens */
    supply: bigint;
    /** Number of base 10 digits to the right of the decimal place */
    decimals: number;
    /** Is this mint initialized */
    isInitialized: boolean;
    /** Optional authority to freeze token accounts */
    freezeAuthority: PublicKey | null;
}

/** Mint as stored by the program */
export interface RawMint {
    mintAuthorityOption: 1 | 0;
    mintAuthority: PublicKey;
    supply: bigint;
    decimals: number;
    isInitialized: boolean;
    freezeAuthorityOption: 1 | 0;
    freezeAuthority: PublicKey;
}

/** Buffer layout for de/serializing a mint */
export const MintLayout = struct<RawMint>([
    u32('mintAuthorityOption'),
    publicKey('mintAuthority'),
    u64('supply'),
    u8('decimals'),
    bool('isInitialized'),
    u32('freezeAuthorityOption'),
    publicKey('freezeAuthority'),
]);

export interface MinimalTokenAccountData {
    mint: PublicKey;
    address: PublicKey;
    poolKeys?: LiquidityPoolKeys;
    market?: MinimalMarketLayoutV3;
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