import * as firebase from '@firebase/testing';
import newDatabase from '../utils/schema';
import syncFireMelon from '../firestoreSync';
import { SyncObj } from '../types/interfaces';

const projectId = 'firemelon';

function authedApp() {
    return firebase.initializeAdminApp({ projectId }).firestore();
}

describe('tests', () => {
    beforeEach(async () => {
        await firebase.clearFirestoreData({ projectId });
    });
    afterAll(async () => {
        await Promise.all(firebase.apps().map(app => app.delete()));
    });

    test('test', async () => {
        const app1 = authedApp();

        const db = newDatabase();
        const melonTodoRef = db.collections.get('todos');
        const fireTodoRef = app1.collection('todos');

        await db.action(async () => {
            await melonTodoRef.create((todo: any) => {
                todo.text = 'todooooooooo';
            });
        });

        const obj: SyncObj = {
            todos: {},
        };

        await syncFireMelon(db, obj, app1, () => new Date());

        const allTodos = await melonTodoRef.query().fetch();
        await fireTodoRef.add(allTodos[0]._raw);

        expect(1).toBe(1);
    });
});
