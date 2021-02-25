import { FirestoreModule } from './types/firestore';
import { SyncObj, SyncStorage } from './types/interfaces';
import { Database } from './types/rtdb';

export interface SyncConfig {
  objects: SyncObj;
  storage: SyncStorage;
  getTimestamp?: () => any;
  authenticated?: boolean;
  getUserId?: () => Promise<string>;
  db: FirestoreModule | Database;
  excludedFields?: string[];
}

export const defaultSyncConfig = {
  storage: 'firestore',
  getTimestamp: () => new Date().getTime(),
  authenticated: false,
  excludedFields: [],
};

export const defaultExclusions = ['_status', '_changed'];
export const DEFAULT_USER_ID = 'default_user';

export const DOCUMENT_WAS_MODIFIED_ERROR = 'DOCUMENT WAS MODIFIED DURING PULL AND PUSH OPERATIONS';
export const DOCUMENT_WAS_DELETED_ERROR = 'DOCUMENT WAS DELETED DURING PULL AND PUSH OPERATIONS';
export const INVALID_USER_ID_ERROR = 'Invalid User Id';
