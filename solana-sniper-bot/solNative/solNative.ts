  import {
    Connection,
  } from '@solana/web3.js';
  import {
    RPC_ENDPOINT,
    RPC_WEBSOCKET_ENDPOINT,
  } from '../constants';
  
export class SolNative {
    private static connection: Connection;

    public static initializeConnection(): void {
        this.connection = new Connection(RPC_ENDPOINT, {
            wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
          });
    }

    public static getConnection(): Connection {
        return this.connection;
    }
}

