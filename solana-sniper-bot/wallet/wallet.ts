import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { PRIVATE_KEY } from '../constants';
import { logger } from '../utils/logger';

export class WalletProvider {
  private static instance: Keypair;

  public static init(): void {
    try {
      this.instance = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
      logger.info(`Wallet initialized with public key: ${this.instance.publicKey.toString()}`);
    } catch (error) {
      logger.error('Failed to initialize wallet:', error);
      throw error;
    }
  }

  public static getPublicKey(): PublicKey {
    return this.instance.publicKey;
  }

  public static getWallet(): Keypair {
    return this.instance;
  }
}