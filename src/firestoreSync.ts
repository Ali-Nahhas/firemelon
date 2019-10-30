import { synchronize } from '@nozbe/watermelondb/sync';
import { Item, SyncObj } from './types/interfaces';
import { Database } from '@nozbe/watermelondb';
import getCurrentTimeStamp from './utils/getCurrentTimeStamp';
import { map, keys, omit } from 'lodash';
import { FirestoreModule } from './types/firestore';

/* const ex: SyncObj = {
    todos: {
        excludedFields: [],
        customQuery: db.collection('todos').where('color', '==', 'red'),
    },
} */

export default async function syncFireMelon(
    database: Database,
    syncObj: SyncObj,
    db: FirestoreModule,
    getTimestamp: () => any,
) {
    await synchronize({
        database,

        pullChanges: async ({ lastPulledAt }) => {
            const syncTimestamp = await getCurrentTimeStamp(db, getTimestamp);
            let changes = {};

            const collections = keys(syncObj);

            await Promise.all(
                map(collections, async collectionName => {
                    const collectionOptions = syncObj[collectionName];
                    const query = collectionOptions.customQuery || db.collection(collectionName);

                    const [createdSN, deletedSN, updatedSN] = await Promise.all([
                        query
                            .where('createdAt', '>=', lastPulledAt || 0)
                            .where('createdAt', '<=', syncTimestamp)
                            .get(),

                        query
                            .where('deletedAt', '>=', lastPulledAt || 0)
                            .where('deletedAt', '<=', syncTimestamp)
                            .get(),

                        query
                            .where('updatedAt', '>=', lastPulledAt || 0)
                            .where('updatedAt', '<=', syncTimestamp)
                            .get(),
                    ]);

                    const created = createdSN.docs.map(createdDoc => {
                        const data = createdDoc.data();
                        const createdItem = omit(data, collectionOptions.excludedFields || []);
                        return createdItem;
                    });

                    const updated = updatedSN.docs.map(updatedDoc => {
                        const data = updatedDoc.data();
                        const updatedItem = omit(data, collectionOptions.excludedFields || []);
                        return updatedItem;
                    });

                    const deleted = deletedSN.docs.map(deletedDoc => {
                        return deletedDoc.id;
                    });

                    changes = {
                        ...changes,
                        [collectionName]: { created: created, deleted: deleted, updated: updated },
                    };
                }),
            );

            return { changes, timestamp: syncTimestamp };
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
                        const data = isDelete ? null : omit(itemValue, collectionOptions.excludedFields || []);

                        switch (changeName) {
                            case 'created':
                                await docRef.set({
                                    ...data,
                                    createdAt: getTimestamp(),
                                });
                                break;

                            case 'updated':
                                docRef.update({
                                    ...data,
                                    updatedAt: getTimestamp(),
                                });
                                break;

                            case 'deleted':
                                docRef.update({
                                    isDeleted: true,
                                    deletedAt: getTimestamp(),
                                });
                                break;
                        }
                    });
                });
            });
        },
    });
}
