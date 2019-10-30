import * as firebase from '@firebase/testing';
import newDatabase from '../utils/schema';
import syncFireMelon from '../firestoreSync';
import { SyncObj } from '../types/interfaces';
import { Q, Model } from '@nozbe/watermelondb';

const projectId = 'firemelon';

function authedApp() {
    return firebase.initializeAdminApp({ projectId }).firestore();
}

describe('Pull Changes function tests', () => {
    beforeEach(async () => {
        await firebase.clearFirestoreData({ projectId });
    });
    afterAll(async () => {
        await Promise.all(firebase.apps().map(app => app.delete()));
    });

    it('test', async () => {
        const app1 = authedApp();
    });
});
