import { logger } from '../utils';
import {
  LOG_LEVEL,
  SNIPE_LIST_REFRESH_INTERVAL,
  USE_SNIPE_LIST,
} from '../constants';
import { WalletProvider } from '../wallet';
import { TokenProvider } from '../token';
import { SolNative } from '../solNative'
import { SnipeListManager } from '../core/SnipeListManager';
import { TokenAccountManager } from '../core/TokenAccountManager';
import { MarketListener } from '../core/MarketListener';
import { RabbitMQService } from '../queue';
import { socketService } from '../socket';
import { TradeEvent, TradeType } from '../types';

export async function init() {
  logger.level = LOG_LEVEL;
  await RabbitMQService.getInstance().connect();

  await RabbitMQService.getInstance().createQueue('sent_buy_queue', { durable: true });
  await RabbitMQService.getInstance().createQueue('sell_queue', { durable: true });
  await RabbitMQService.getInstance().createQueue('sell_confirm_error_queue', { durable: true });
  await RabbitMQService.getInstance().createQueue('buy_confirm_error_queue', { durable: true });
  await RabbitMQService.getInstance().createQueue('buy_confirmed_queue', { durable: true });

  WalletProvider.init();
  TokenProvider.getInstance().InitQuoteTokens();
  SolNative.initializeConnection();

  await TokenAccountManager.getInstance().initTokenAccounts();
  SnipeListManager.getInstance().loadSnipeList();
  
  RabbitMQService.getInstance().consumeQueueMessages('trades', async (msg) => {
    if(!msg) return;
    let message : TradeEvent = JSON.parse(msg.content.toString());
    socketService.emitToAll(message.Type.toString(), message);
  });
  MarketListener.getInstance().listenForMarketChanges();

  if (USE_SNIPE_LIST) {
    setInterval(() => SnipeListManager.getInstance().loadSnipeList(), SNIPE_LIST_REFRESH_INTERVAL);
  }
}
