export interface TradeEvent {
    Mint: String;
    Amount: String
    Signature: String;
    Type: TradeType;
  }

export enum TradeType {
    BuyRequested = 'BuyRequested',
    SellRequested = 'SellRequested',
    BuyConfirmed = 'BuyConfirmed',
    SellConfirmed = 'SellConfirmed',
    BuyConfirmError = 'BuyConfirmError',
    SellConfirmError = 'SellConfirmError',
  }