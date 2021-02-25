import { Query } from './firestore';

export interface Item {
  id: string;
}

export interface SyncCollectionOptions {
  excludedFields?: string[];
  customQuery?: Query;
}

export type SyncObj =
  | {
      [collectionName: string]: SyncCollectionOptions;
    }
  | string[];

export interface SyncTimestamp {
  syncTime: {
    toDate(): Date;
  };
}

export interface SyncedDocument {
  sessionId: string;
  id: string;
  [key: string]: any;
}

export type SyncStorage = 'firestore' | 'realtime-database';
