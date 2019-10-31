import * as firebase from '@firebase/testing';
import newDatabase from '../utils/schema';
import syncFireMelon from '../firestoreSync';
import { SyncObj } from '../types/interfaces';
import timeout from '../utils/timeout';

const projectId = 'firemelon';
const sessionId = 'asojfbaoufasoinfaso';

function authedApp(auth: any) {
    return firebase.initializeTestApp({ projectId, auth }).firestore();
}

describe('Options Excluded Fields', () => {
    beforeEach(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map(app => app.delete()));
    });

    it('should exclude fields passes in options from being synced', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const firstDatabase = newDatabase();
        const firstMelonTodosRef = firstDatabase.collections.get('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {
                excludedFields: ['color'],
            },
        };

        await firstDatabase.action(async () => {
            await firstMelonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
                todo.color = 'red';
            });
        });

        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        const todosSnapshot = await fireTodosRef.get();

        expect(todosSnapshot.docs.length).toBe(1);
        expect(todosSnapshot.docs[0].data().text).toBe('todo 1');
        expect(todosSnapshot.docs[0].data().color).toBeUndefined();
    });
});
