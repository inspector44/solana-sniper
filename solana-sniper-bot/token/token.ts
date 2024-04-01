import { QUOTE_AMOUNT, QUOTE_MINT, MIN_POOL_SIZE, } from '../constants';
import { Token, TokenAmount, } from '@raydium-io/raydium-sdk';
import { TOKEN_PROGRAM_ID, } from '@solana/spl-token';
import { PublicKey, } from '@solana/web3.js';

export class TokenProvider {
  public quoteToken!: Token;
  public quoteAmount!: TokenAmount;
  public quoteMinPoolSizeAmount!: TokenAmount;
  private static instance: TokenProvider;

  public static getInstance(): TokenProvider {
    if (!TokenProvider.instance) {
      TokenProvider.instance = new TokenProvider();
    }
    return TokenProvider.instance;
  }

  public InitQuoteTokens(): void {
    switch (QUOTE_MINT) {
      case 'WSOL': {
        this.quoteToken = Token.WSOL;
        this.quoteAmount = new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false);
        this.quoteMinPoolSizeAmount = new TokenAmount(this.quoteToken, MIN_POOL_SIZE, false);
        break;
      }
      case 'USDC': {
        this.quoteToken = new Token(
          TOKEN_PROGRAM_ID,
          new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
          6,
          'USDC',
          'USDC',
        );
        this.quoteAmount = new TokenAmount(this.quoteToken, QUOTE_AMOUNT, false);
        this.quoteMinPoolSizeAmount = new TokenAmount(this.quoteToken, MIN_POOL_SIZE, false);
        break;
      }
      default: {
        throw new Error(`Unsupported quote mint "${QUOTE_MINT}". Supported values are USDC and WSOL`);
      }
    }
  }
}