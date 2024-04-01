import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils';
import { USE_SNIPE_LIST } from '../constants';
export class SnipeListManager {
    private static instance: SnipeListManager;
    private snipeList: string[] = [];
  
    private constructor() {}
  
    public static getInstance(): SnipeListManager {
      if (!SnipeListManager.instance) {
        SnipeListManager.instance = new SnipeListManager();
      }
      return SnipeListManager.instance;
    }
  
    loadSnipeList(): void {
      if (!USE_SNIPE_LIST) return;
  
      const data = fs.readFileSync(path.join(__dirname, 'snipe-list.txt'), 'utf-8');
      const newSnipeList = data.split('\n').map((a) => a.trim()).filter((a) => a);
      if (newSnipeList.length !== this.snipeList.length) {
        this.snipeList = newSnipeList;
        logger.info(`Loaded snipe list: ${this.snipeList.length}`);
      }
    }
  
    getSnipeList(): string[] {
      return this.snipeList;
    }
  }