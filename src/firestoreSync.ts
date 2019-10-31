import { synchronize } from '@nozbe/watermelondb/sync';
import { Item, SyncObj } from './types/interfaces';
import { Database } from '@nozbe/watermelondb';
import { map, keys, omit } from 'lodash';
import { FirestoreModule } from './types/firestore';

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
                map(collections, async collectionName => {
                    const collectionOptions = syncObj[collectionName];
                    const query = collectionOptions.customQuery || db.collection(collectionName);

                    const [createdSN, deletedSN, updatedSN] = await Promise.all([
                        query
                            .where('createdAt', '>=', lastPulledAtTime)
                            .where('createdAt', '<=', syncTimestamp)
                            .get(),
                        query
                            .where('deletedAt', '>=', lastPulledAtTime)
                            .where('deletedAt', '<=', syncTimestamp)
                            .get(),
                        query
                            .where('updatedAt', '>=', lastPulledAtTime)
                            .where('updatedAt', '<=', syncTimestamp)
                            .get(),
                    ]);

                    const created = createdSN.docs
                        .filter(t => t.data().sessionId !== sessionId)
                        .map(createdDoc => {
                            const data = createdDoc.data();

                            const ommited = [...defaultExcluded, ...(collectionOptions.excludedFields || [])];
                            const createdItem = omit(data, ommited);

                            return createdItem;
                        });

                    const updated = updatedSN.docs
                        .filter(t => t.data().sessionId !== sessionId)
                        .map(updatedDoc => {
                            const data = updatedDoc.data();

                            const ommited = [...defaultExcluded, ...(collectionOptions.excludedFields || [])];
                            const updatedItem = omit(data, ommited);

                            return updatedItem;
                        });

                    const deleted = deletedSN.docs
                        .filter(t => t.data().sessionId !== sessionId)
                        .map(deletedDoc => {
                            return deletedDoc.id;
                        });

                    changes = {
                        ...changes,
                        [collectionName]: { created: created, deleted: deleted, updated: updated },
                    };
                }),
            );

            return { changes, timestamp: +syncTimestamp };
        },

        pushChanges: async ({ changes }) => {
            map(changes, (row, collectionName) => {
                const collectionRef = db.collection(collectionName);
                const collectionOptions = syncObj[collectionName];

                map(row, (arrayOfChanged, changeName) => {
                    const isDelete = changeName === 'deleted';

                    map(arrayOfChanged, async doc => {
                        const itemValue = isDelete ? null : (doc.valueOf() as Item);
                        const docRef = isDelete ? collectionRef.doc(doc.toString()) : collectionRef.doc(itemValue!.id);

                        const ommited = [...defaultExcluded, ...(collectionOptions.excludedFields || [])];
                        const data = isDelete ? null : omit(itemValue, ommited);

                        switch (changeName) {
                            case 'created':
                                await docRef.set({
                                    ...data,
                                    createdAt: getTimestamp(),
                                    sessionId,
                                });
                                break;

                            case 'updated':
                                docRef.update({
                                    ...data,
                                    updatedAt: getTimestamp(),
                                    sessionId,
                                });
                                break;

                            case 'deleted':
                                docRef.update({
                                    isDeleted: true,
                                    deletedAt: getTimestamp(),
                                    sessionId,
                                });
                                break;
                        }
                    });
                });
            });
        },
    });
}
