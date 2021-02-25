import { Database, DataSnapshot } from '../types/rtdb';
import { BaseStorageAdapter, TransactionBlockCallback } from './base';
import { Query } from '../types/firestore';
import { SyncedDocument } from '../types/interfaces';
import { DEFAULT_USER_ID } from '../config';

class RealtimeDatabaseStorageAdapter implements BaseStorageAdapter {
  public constructor(
    protected readonly db: Database,
    protected readonly collectionName: string,
    protected readonly collectionQuery?: Query, // adding it for type safety, dont use!
    protected readonly userId: string = DEFAULT_USER_ID,
  ) {}

  private syncRefPath = `sync/${this.userId}`;
  private syncRef = this.db.ref(this.syncRefPath);
  private query = this.db.ref(`${this.syncRefPath}/${this.collectionName}`);

  private parse = (data: DataSnapshot): SyncedDocument[] => {
    const value = data.val() || {};
    const entries = Object.entries(value);
    return entries.map(([_, data]) => data as SyncedDocument);
  };

  pullUpdated = async (lastPulledAtTime: Date, syncTimestamp: Date): Promise<SyncedDocument[]> => {
    const documents = await this.query
      .orderByChild('createdAt')
      .startAt(lastPulledAtTime.getTime())
      .endAt(syncTimestamp.getTime())
      .once('value');
    return this.parse(documents);
  };

  pullDeleted = async (lastPulledAtTime: Date, syncTimestamp: Date): Promise<SyncedDocument[]> => {
    const documents = await this.query
      .orderByChild('deletedAt')
      .startAt(lastPulledAtTime.getTime())
      .endAt(syncTimestamp.getTime())
      .once('value');
    return this.parse(documents);
  };

  pullCreated = async (lastPulledAtTime: Date, syncTimestamp: Date): Promise<SyncedDocument[]> => {
    const documents = await this.query
      .orderByChild('updatedAt')
      .startAt(lastPulledAtTime.getTime())
      .endAt(syncTimestamp.getTime())
      .once('value');
    return this.parse(documents);
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

  static withTransaction = async (
    db: Database,
    callback: TransactionBlockCallback,
    userId: string | undefined = DEFAULT_USER_ID,
  ) => {
    const syncRef = db.ref(`sync/${userId}`);
    const syncRefValue = await syncRef.once('value');
    const updates: Record<string, any> = {
      ...syncRefValue.val(),
    };

    const write = (document: any, collection: string, ref: string) => {
      if (!updates[collection]) updates[collection] = {};
      updates[collection][ref] = document;
    };

    const update = (document: any, collection: string, ref: string) => {
      if (!updates[collection]) return;
      if (!updates[collection][ref]) return;
      updates[collection][ref] = document;
    };

    const get = async (collection: string, ref: string) => {
      const snapshot = await syncRef.child(collection).child(ref).once('value');
      console.log(collection, ref);
      return snapshot.val();
    };

    await callback({
      write,
      update,
      get,
    });

    await syncRef.set(updates);
  };
}

export { RealtimeDatabaseStorageAdapter };
