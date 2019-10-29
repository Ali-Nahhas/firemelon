import { CollectionRef } from './firestore';

export interface Item {
    id: string;
}

export interface SyncCollectionOptions {
    excludedFields: string[];
    customQuery: CollectionRef;
}

export interface SyncObj {
    [collectionName: string]: SyncCollectionOptions;
}

export interface SyncTimestamp {
    syncTime: {
        toDate(): Date;
    };
}
