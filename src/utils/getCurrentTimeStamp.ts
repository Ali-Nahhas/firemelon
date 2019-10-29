import { SyncTimestamp } from '../types/interfaces';
import { FirestoreModule } from '../types/firestore';

export default async function getCurrentTimeStamp(db: FirestoreModule, timestamp: () => any) {
    const currentTimestampRef = await db.collection('syncTimeStamps').add({
        syncTime: timestamp(),
    });

    const currentTimestampSN = await currentTimestampRef.get();
    const timeData = currentTimestampSN.data() as SyncTimestamp;

    const ts = +timeData.syncTime.toDate();

    return ts;
}
