import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { keys, map, omit } from 'lodash';
import { FirestoreModule } from './types/firestore';
import { Item, SyncObj } from './types/interfaces';

/* const ex: SyncObj = {
    todos: {
        excludedFields: [],
        customQuery: firestore.collection('todos').where('color', '==', 'red'),
    },
} */

const defaultExcluded = ['_status', '_changed'];

export async function syncFireMelon(
    database: Database,
    syncObj: SyncObj,
    db: FirestoreModule,
    sessionId: string,
    getTimestamp: () => any = () => new Date(),
) {
    await synchronize({
        database,

        pullChanges: async ({ lastPulledAt }) => {
            const syncTimestamp = new Date();
            const lastPulledAtTime = new Date(lastPulledAt || 0);
            let changes = {};

            const collections = keys(syncObj);

            await Promise.all(
                map(collections, async (collectionName) => {
                    const collectionOptions = syncObj[collectionName];
                    const query = collectionOptions.customQuery || db.collection(collectionName);

                    const [createdSN, deletedSN, updatedSN] = await Promise.all([
                        query.where('createdAt', '>=', lastPulledAtTime).where('createdAt', '<=', syncTimestamp).get(),
                        query.where('deletedAt', '>=', lastPulledAtTime).where('deletedAt', '<=', syncTimestamp).get(),
                        query.where('updatedAt', '>=', lastPulledAtTime).where('updatedAt', '<=', syncTimestamp).get(),
                    ]);

                    const created = createdSN.docs
                        .filter((t) => t.data().sessionId !== sessionId)
                        .map((createdDoc) => {
                            const data = createdDoc.data();

                            const ommited = [...defaultExcluded, ...(collectionOptions.excludedFields || [])];
                            const createdItem = omit(data, ommited);

                            return createdItem;
                        });

                    const updated = updatedSN.docs
                        .filter(
                            (t) => t.data().sessionId !== sessionId && !createdSN.docs.find((doc) => doc.id === t.id),
                        )
                        .map((updatedDoc) => {
                            const data = updatedDoc.data();

                            const ommited = [...defaultExcluded, ...(collectionOptions.excludedFields || [])];
                            const updatedItem = omit(data, ommited);

                            return updatedItem;
                        });

                    const deleted = deletedSN.docs
                        .filter((t) => t.data().sessionId !== sessionId)
                        .map((deletedDoc) => {
                            return deletedDoc.id;
                        });

                    changes = {
                        ...changes,
                        [collectionName]: { created, deleted, updated },
                    };
                }),
            );

            return { changes, timestamp: +syncTimestamp };
        },

        pushChanges: async ({ changes, lastPulledAt }) => {
            await db.runTransaction(async (transaction) => {
                await Promise.all(
                    map(changes, async (row, collectionName) => {
                        const collectionRef = db.collection(collectionName);
                        const collectionOptions = syncObj[collectionName];

                        await Promise.all(
                            map(row, async (arrayOfChanged, changeName) => {
                                const isDelete = changeName === 'deleted';

                                await Promise.all(
                                    map(arrayOfChanged, async (doc) => {
                                        const itemValue = isDelete ? null : (doc.valueOf() as Item);
                                        const docRef = isDelete
                                            ? collectionRef.doc((doc as string).toString())
                                            : collectionRef.doc(itemValue!.id);

                                        const ommited = [
                                            ...defaultExcluded,
                                            ...(collectionOptions.excludedFields || []),
                                        ];
                                        const data = isDelete ? null : omit(itemValue, ommited);

                                        switch (changeName) {
                                            case 'created': {
                                                transaction.set(docRef, {
                                                    ...data,
                                                    createdAt: getTimestamp(),
                                                    updatedAt: getTimestamp(),
                                                    sessionId,
                                                });

                                                break;
                                            }

                                            case 'updated': {
                                                const docFromServer = await transaction.get(docRef);
                                                const { deletedAt, updatedAt } = docFromServer.data();

                                                if (updatedAt.toDate() > lastPulledAt) {
                                                    throw new Error(DOCUMENT_WAS_MODIFIED_ERROR);
                                                }

                                                if (deletedAt?.toDate() > lastPulledAt) {
                                                    throw new Error(DOCUMENT_WAS_DELETED_ERROR);
                                                }

                                                transaction.update(docRef, {
                                                    ...data,
                                                    sessionId,
                                                    updatedAt: getTimestamp(),
                                                });

                                                break;
                                            }

                                            case 'deleted': {
                                                const docFromServer = await transaction.get(docRef);
                                                const { deletedAt, updatedAt } = docFromServer.data();

                                                if (updatedAt.toDate() > lastPulledAt) {
                                                    throw new Error(DOCUMENT_WAS_MODIFIED_ERROR);
                                                }

                                                if (deletedAt?.toDate() > lastPulledAt) {
                                                    throw new Error(DOCUMENT_WAS_DELETED_ERROR);
                                                }

                                                transaction.update(docRef, {
                                                    deletedAt: getTimestamp(),
                                                    isDeleted: true,
                                                    sessionId,
                                                });

                                                break;
                                            }
                                        }
                                    }),
                                );
                            }),
                        );
                    }),
                );
            });
        },
    });
}

export const DOCUMENT_WAS_MODIFIED_ERROR = 'DOCUMENT WAS MODIFIED DURING PULL AND PUSH OPERATIONS';
export const DOCUMENT_WAS_DELETED_ERROR = 'DOCUMENT WAS DELETED DURING PULL AND PUSH OPERATIONS';
