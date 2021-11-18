import { CollectionRef, FirestoreModule, Query } from './firestore';

export interface Item {
    id: string;
}

export interface SyncCollectionOptions {
    excludedFields?: string[];
    customPullQuery?: (db: FirestoreModule, collectionName: string) => Query;
    customPushCollection?: (db: FirestoreModule, collectionName: string) => CollectionRef;
}

export interface SyncObj {
    [collectionName: string]: SyncCollectionOptions;
}

export interface SyncTimestamp {
    syncTime: {
        toDate(): Date;
    };
}
