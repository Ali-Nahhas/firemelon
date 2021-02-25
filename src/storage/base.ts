import { SyncedDocument } from '../types/interfaces';

export interface TransactionBlock {
  write: (document: any, collection: string, ref: string) => void;
  update: (document: any, collection: string, ref: string) => void;
  get: (collection: string, ref: string) => Promise<SyncedDocument>;
}

export type TransactionBlockCallback = (block: TransactionBlock) => void | Promise<void>;

export interface BaseStorageAdapter {
  pullUpdated: (lastPulledAtTime: Date, syncTimestamp: Date) => Promise<SyncedDocument[]>;
  pullCreated: (lastPulledAtTime: Date, syncTimestamp: Date) => Promise<SyncedDocument[]>;
  pullDeleted: (lastPulledAtTime: Date, syncTimestamp: Date) => Promise<SyncedDocument[]>;
  pullChanges: (
    lastPulledAtTime: Date,
    syncTimestamp: Date,
  ) => Promise<{
    updated: SyncedDocument[];
    deleted: SyncedDocument[];
    created: SyncedDocument[];
  }>;
  // static withTransaction: (callback: TransactionBlockCallback) => Promise<any>;
}
