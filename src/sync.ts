import { Database } from '@nozbe/watermelondb';
import { SyncDatabaseChangeSet, synchronize, SyncPullResult } from '@nozbe/watermelondb/sync';
import { keys, omit, map } from 'lodash';

import {
  defaultExclusions,
  defaultSyncConfig,
  DOCUMENT_WAS_DELETED_ERROR,
  DOCUMENT_WAS_MODIFIED_ERROR,
  INVALID_USER_ID_ERROR,
  SyncConfig,
} from './config';
import { FirestoreDatabaseStorageAdapter } from './storage/firestore';
import { RealtimeDatabaseStorageAdapter } from './storage/rtdb';
import { Item, SyncObj } from './types/interfaces';
import { FirestoreModule } from './types/firestore';
import { isDateGreater } from './utils/dates';

export const sync = async (database: Database, sessionId: string, config: SyncConfig) => {
  const {
    objects,
    storage,
    db: firebaseDatabase,
    getUserId,
    authenticated: usesAuthentication,
    getTimestamp: getTimestampValue = defaultSyncConfig.getTimestamp,
    excludedFields: globalExclusions = [],
  } = {
    ...defaultSyncConfig,
    ...config,
  };
  const collections = Array.isArray(objects) ? objects : keys(objects);
  const StorageAdapter = storage === 'firestore' ? FirestoreDatabaseStorageAdapter : RealtimeDatabaseStorageAdapter;
  const optionsForCollection = (name: string) => {
    if (Array.isArray(objects)) {
      return {};
    }
    return objects[name];
  };

  let userId: string | undefined;

  if (usesAuthentication) {
    userId = await getUserId?.();
    if (!userId) {
      throw new Error(INVALID_USER_ID_ERROR);
    }
  }

  const pullChanges = async (lastPulledAt: number | null): Promise<SyncPullResult> => {
    const syncTimestamp = new Date();
    const lastPulledAtTime = new Date(lastPulledAt || 0);
    let changes = {};

    await Promise.all(
      collections.map(async (collectionName) => {
        const collectionOptions = optionsForCollection(collectionName);
        const storage = new StorageAdapter(
          firebaseDatabase as any,
          collectionName,
          collectionOptions.customQuery,
          userId,
        );

        const {
          created: createdDocuments,
          deleted: deletedDocuments,
          updated: updatedDocuments,
        } = await storage.pullChanges(lastPulledAtTime, syncTimestamp);
        const exclusions = [...defaultExclusions, ...globalExclusions, ...(collectionOptions.excludedFields || [])];
        const cleanDocument = (doc: any) => omit(doc, exclusions);

        // prettier-ignore
        const created = createdDocuments
          .filter((doc) => doc.sessionId !== sessionId)
          .map(doc => cleanDocument(doc));

        // prettier-ignore
        const updated = updatedDocuments
          .filter((doc) => doc.sessionId !== sessionId && !createdDocuments.find(cdoc => cdoc.id === doc.id))
          .map((doc) => cleanDocument(doc));

        // prettier-ignore
        const deleted = deletedDocuments
          .filter(doc => doc.sessionId !== sessionId)
          .map(doc => doc.id)

        changes = {
          ...changes,
          [collectionName]: {
            created,
            updated,
            deleted,
          },
        };
      }),
    );

    return {
      changes,
      timestamp: +syncTimestamp,
    };
  };

  const pushChanges = async (changes: SyncDatabaseChangeSet, lastPulledAt: number) => {
    console.log(changes);
    await StorageAdapter.withTransaction(
      firebaseDatabase as any,
      async (transaction) => {
        await Promise.all(
          map(changes, async (row, collectionName) => {
            const collectionOptions = optionsForCollection(collectionName);

            await Promise.all(
              map(row, async (arrayOfChanged, changeName) => {
                const isDelete = changeName === 'delete';
                await Promise.all(
                  map(arrayOfChanged, async (doc) => {
                    const itemValue = isDelete ? null : (doc.valueOf() as Item);
                    const docRef = isDelete ? doc.toString() : itemValue!.id;
                    const exclusions = [
                      ...defaultExclusions,
                      ...globalExclusions,
                      ...(collectionOptions.excludedFields || []),
                    ];
                    const data = isDelete ? null : omit(itemValue, exclusions);
                    console.log(itemValue, docRef, isDelete, changeName);

                    switch (changeName) {
                      case 'created':
                        transaction.write(
                          {
                            ...data,
                            id: itemValue!.id,
                            createdAt: getTimestampValue(),
                            updatedAt: getTimestampValue(),
                            sessionId,
                            userId,
                          },
                          collectionName,
                          docRef,
                        );
                        break;
                      case 'updated': {
                        const docFromServer = await transaction.get(collectionName, docRef);
                        const { deletedAt, updatedAt } = docFromServer;

                        if (isDateGreater(updatedAt, lastPulledAt)) {
                          throw new Error(DOCUMENT_WAS_MODIFIED_ERROR);
                        }

                        if (isDateGreater(deletedAt, lastPulledAt)) {
                          throw new Error(DOCUMENT_WAS_DELETED_ERROR);
                        }

                        transaction.update(
                          {
                            ...data,
                            sessionId,
                            updatedAt: getTimestampValue(),
                          },
                          collectionName,
                          docRef,
                        );
                        break;
                      }
                      case 'deleted': {
                        const docFromServer = await transaction.get(collectionName, docRef);
                        const { deletedAt, updatedAt } = docFromServer;

                        if (isDateGreater(updatedAt, lastPulledAt)) {
                          throw new Error(DOCUMENT_WAS_MODIFIED_ERROR);
                        }

                        if (isDateGreater(deletedAt, lastPulledAt)) {
                          throw new Error(DOCUMENT_WAS_DELETED_ERROR);
                        }

                        transaction.update(
                          {
                            deletedAt: getTimestampValue(),
                            isDeleted: true,
                            sessionId,
                          },
                          collectionName,
                          docRef,
                        );

                        break;
                      }
                    }
                  }),
                );
              }),
            );
          }),
        );
      },
      userId,
    );
  };

  return synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => await pullChanges(lastPulledAt),
    pushChanges: async ({ changes, lastPulledAt }) => await pushChanges(changes, lastPulledAt),
  });
};

export const syncFireMelon = (
  database: Database,
  syncObj: SyncObj,
  db: FirestoreModule,
  sessionId: string,
  getTimestamp: () => any = () => new Date(),
) => {
  return sync(database, sessionId, {
    objects: syncObj,
    db,
    getTimestamp,
  });
};
