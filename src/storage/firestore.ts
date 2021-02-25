import { BaseStorageAdapter, TransactionBlockCallback } from './base';
import { DocumentSnapshot, FirestoreModule, Query } from '../types/firestore';
import { SyncedDocument } from '../types/interfaces';

class FirestoreDatabaseStorageAdapter implements BaseStorageAdapter {
  public constructor(
    protected readonly db: FirestoreModule,
    protected readonly collectionName: string,
    protected readonly collectionQuery?: Query,
    protected readonly userId: string | null = null,
  ) {}

  private get query() {
    if (this.userId && this.collectionQuery) {
      return this.collectionQuery.where('userId', '==', 'userId');
    }

    if (!this.userId && this.collectionQuery) {
      return this.collectionQuery;
    }

    if (this.userId) {
      return this.db.collection(this.collectionName).where('userId', '==', this.userId);
    }

    return this.db.collection(this.collectionName);
  }

  private documentMapper = (doc: DocumentSnapshot): SyncedDocument => ({
    ...doc.data(),
    id: doc.id,
  });

  pullUpdated = async (lastPulledAtTime: Date, syncTimestamp: Date) => {
    const documents = await this.query
      .where('createdAt', '>=', lastPulledAtTime)
      .where('createdAt', '<=', syncTimestamp)
      .get();
    return documents.docs.map(this.documentMapper) || [];
  };

  pullDeleted = async (lastPulledAtTime: Date, syncTimestamp: Date) => {
    const documents = await this.query
      .where('deletedAt', '>=', lastPulledAtTime)
      .where('deletedAt', '<=', syncTimestamp)
      .get();
    return documents.docs.map(this.documentMapper) || [];
  };

  pullCreated = async (lastPulledAtTime: Date, syncTimestamp: Date) => {
    const documents = await this.query
      .where('updatedAt', '>=', lastPulledAtTime)
      .where('updatedAt', '<=', syncTimestamp)
      .get();
    return documents.docs.map(this.documentMapper) || [];
  };

  pullChanges = async (lastPulledAtTime: Date, syncTimestamp: Date) => {
    const [created, updated, deleted] = await Promise.all([
      this.pullCreated(lastPulledAtTime, syncTimestamp),
      this.pullUpdated(lastPulledAtTime, syncTimestamp),
      this.pullDeleted(lastPulledAtTime, syncTimestamp),
    ]);

    return {
      created,
      updated,
      deleted,
    };
  };

  static withTransaction = (db: FirestoreModule, callback: TransactionBlockCallback): Promise<any> => {
    return db.runTransaction(async (transaction) => {
      const write = (document: any, collection: string, ref: string) => {
        const docRef = db.collection(collection).doc(ref);
        transaction.set(docRef, document);
      };

      const update = (document: any, collection: string, ref: string) => {
        const docRef = db.collection(collection).doc(ref);
        transaction.update(docRef, document);
      };

      const get = async (collection: string, ref: string) => {
        const docRef = db.collection(collection).doc(ref);
        const doc = await transaction.get(docRef);
        return {
          ...doc.data(),
          id: doc.id,
        };
      };

      await callback({
        write,
        update,
        get,
      });
    });
  };
}

export { FirestoreDatabaseStorageAdapter };
