import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { keys, map, omit } from 'lodash';
import { CollectionRef, FirestoreModule } from './types/firestore';
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
    watermelonSyncArgs: Object = {}
) {
    await synchronize({
        database,

        ...watermelonSyncArgs,

        pullChanges: async ({ lastPulledAt }) => {
            const syncTimestamp = new Date();
            const lastPulledAtTime = new Date(lastPulledAt || 0);
            let changes = {};

            const collections = keys(syncObj);

            await Promise.all(
                map(collections, async (collectionName) => {
                    const collectionOptions = syncObj[collectionName];
                    const query = (collectionOptions.customPullQuery && collectionOptions.customPullQuery(db, collectionName))
                        || db.collection(collectionName);

                    const [createdSN, deletedSN, updatedSN] = await Promise.all([
                        query.where('server_created_at', '>=', lastPulledAtTime).where('server_created_at', '<=', syncTimestamp).get(),
                        query.where('server_deleted_at', '>=', lastPulledAtTime).where('server_deleted_at', '<=', syncTimestamp).get(),
                        query.where('server_updated_at', '>=', lastPulledAtTime).where('server_updated_at', '<=', syncTimestamp).get(),
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

            const totalChanges = Object.keys(changes).reduce((prev, curr) =>
                //@ts-ignore
                prev + changes[curr].created.length + changes[curr].deleted.length + changes[curr].updated.length,
                0);
            console.log(`FireMelon > Pull > Total changes: ${totalChanges}`);

            return { changes, timestamp: +syncTimestamp };
        },

        pushChanges: async ({ changes, lastPulledAt }) => {

            const totalChanges = Object.keys(changes).reduce((prev, curr) =>
                prev + changes[curr].created.length + changes[curr].deleted.length + changes[curr].updated.length,
                0);
            console.log(`FireMelon > Push > Total changes: ${totalChanges}`);

            let docRefs = await Promise.all(Object.keys(changes).map(async (collectionName: string) => {
                const deletedIds = changes[collectionName].deleted.map(id => id);
                const createdIds = changes[collectionName].created.map(data => data.id);
                const updatedIds = changes[collectionName].updated.map(data => data.id);

                const collectionOptions = syncObj[collectionName];
                const collectionRef = (collectionOptions.customPushCollection && collectionOptions.customPushCollection(db, collectionName)) || db.collection(collectionName)

                // Check that none of the created docs already exists on the server
                //@ts-ignore
                if (createdIds.length > 0 && (await queryDocsInValue(collectionRef, 'id', createdIds)).length) {
                    throw new Error(DOCUMENT_TRYING_TO_CREATE_ALREADY_EXISTS_ON_SERVER_ERROR);
                }

                const deleted = deletedIds.length > 0 ? (await queryDocsInValue(collectionRef, 'id', deletedIds)) : [];
                const updated = updatedIds.length > 0 ? (await queryDocsInValue(collectionRef, 'id', updatedIds)) : [];

                return { [collectionName]: { deleted, updated } }
            }))

            // collapse to single object: {users: {deleted: [], updated: []}, todos: {deleted:[], updated:[]}}
            docRefs = Object.assign({}, ...docRefs);

            // Batch sync
            const batchArray: any[] = [];
            batchArray.push(db.batch());
            let operationCounter = 0;
            let batchIndex = 0;

            map(changes, async (row, collectionName) => {
                // This iterates over all the collections, e.g. todos and users
                const collectionOptions = syncObj[collectionName];
                const collectionRef = (collectionOptions.customPushCollection && collectionOptions.customPushCollection(db, collectionName)) || db.collection(collectionName);

                map(row, async (arrayOfChanged, changeName) => {
                    const isDelete = changeName === 'deleted';

                    map(arrayOfChanged, async (wmObj) => {
                        const itemValue = isDelete ? null : (wmObj.valueOf() as Item);
                        const docRef = isDelete
                            ? collectionRef.doc(wmObj.toString())
                            : collectionRef.doc(itemValue!.id);

                        const ommited = [
                            ...defaultExcluded,
                            ...(collectionOptions.excludedFields || []),
                        ];
                        const data = omit(itemValue, ommited);

                        switch (changeName) {
                            case 'created': {
                                batchArray[batchIndex].set(docRef, {
                                    ...data,
                                    server_created_at: getTimestamp(),
                                    server_updated_at: getTimestamp(),
                                    sessionId,
                                });

                                operationCounter++;

                                break;
                            }

                            case 'updated': {
                                //@ts-ignore
                                const docFromServer = docRefs[collectionName].updated.find(doc => doc.id == data.id)
                                if (docFromServer) {
                                    const { server_deleted_at: deletedAt, server_updated_at: updatedAt } = docFromServer;

                                    if (updatedAt.toDate() > lastPulledAt) {
                                        throw new Error(DOCUMENT_WAS_MODIFIED_ERROR);
                                    }

                                    if (deletedAt?.toDate() > lastPulledAt) {
                                        throw new Error(DOCUMENT_WAS_DELETED_ERROR);
                                    }

                                    batchArray[batchIndex].update(docRef, {
                                        ...data,
                                        sessionId,
                                        server_updated_at: getTimestamp(),
                                    });
                                } else {
                                    throw new Error(DOCUMENT_TRYING_TO_UPDATE_BUT_DOESNT_EXIST_ON_SERVER_ERROR)
                                }

                                operationCounter++;

                                break;
                            }

                            case 'deleted': {

                                //@ts-ignore
                                const docFromServer = docRefs[collectionName].deleted.find(doc => doc.id == wmObj.toString())
                                if (docFromServer) {
                                    const { server_deleted_at: deletedAt, server_updated_at: updatedAt } = docFromServer;

                                    if (updatedAt.toDate() > lastPulledAt) {
                                        throw new Error(DOCUMENT_WAS_MODIFIED_ERROR);
                                    }

                                    if (deletedAt?.toDate() > lastPulledAt) {
                                        throw new Error(DOCUMENT_WAS_DELETED_ERROR);
                                    }

                                    batchArray[batchIndex].update(docRef, {
                                        server_deleted_at: getTimestamp(),
                                        isDeleted: true,
                                        sessionId,
                                    });

                                } else {
                                    throw new Error(DOCUMENT_TRYING_TO_DELETE_BUT_DOESNT_EXIST_ON_SERVER_ERROR)
                                }

                                operationCounter++;

                                break;
                            }
                        }

                        // Initialize a new batch if needed -> firestore allows 500 writes per batch.
                        if (operationCounter === 499) {
                            batchArray.push(db.batch());
                            batchIndex++;
                            operationCounter = 0;
                        }

                    })
                })
            })

            console.log(`FireMelon > Push > Will commit ${batchArray.length} batches`)
            let counter = 1
            try {
                for (const batch of batchArray) {
                    console.log(`FireMelon > Push > Batch ${counter} > commit`)
                    await batch.commit()
                    console.log(`FireMelon > Push > Commit batch ${counter} done`)
                    counter++;
                }
            } catch (error) {
                console.error(error);
            }
        },
    });
}

export const DOCUMENT_WAS_MODIFIED_ERROR = 'DOCUMENT WAS MODIFIED DURING PULL AND PUSH OPERATIONS';
export const DOCUMENT_WAS_DELETED_ERROR = 'DOCUMENT WAS DELETED DURING PULL AND PUSH OPERATIONS';
export const DOCUMENT_TRYING_TO_CREATE_ALREADY_EXISTS_ON_SERVER_ERROR = 'TYRING TO CREATE A DOCUMENT THAT ALREADY EXISTS ON THE SERVER'
export const DOCUMENT_TRYING_TO_UPDATE_BUT_DOESNT_EXIST_ON_SERVER_ERROR = 'TYRING TO UPDATE A DOCUMENT BUT IT WAS NOT FOUND ON THE SERVER'
export const DOCUMENT_TRYING_TO_DELETE_BUT_DOESNT_EXIST_ON_SERVER_ERROR = 'TYRING TO DELETE A DOCUMENT BUT IT WAS NOT FOUND ON THE SERVER'

const queryDocsInValue = (collection: CollectionRef, field: string, array: any[]) => {
    return new Promise((res) => {
        // don't run if there aren't any ids or a path for the collection
        if (!array || !array.length || !collection || !field) return res([]);

        let batches = [];

        while (array.length) {
            // firestore limits batches to 10
            const batch = array.splice(0, 10);


            // add the batch request to to a queue
            batches.push(
                new Promise(response => {
                    collection
                        .where(
                            field,
                            //@ts-ignore
                            'in',
                            [...batch]
                        )
                        .get()
                        .then(results => {
                            response(results.docs.map(result => ({ ...result.data() })))
                        })
                        .catch((err) => {
                            console.error(err)
                        });
                })
            )
        }

        // after all of the data is fetched, return it
        Promise.all(batches)
            .then(content => res(content.flat()))
            .catch((err) => console.error(err));
    })
}