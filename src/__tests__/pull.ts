import * as firebase from '@firebase/testing';
import { syncFireMelon } from '../firestoreSync';
import { SyncObj } from '../types/interfaces';
import newDatabase, { Todo } from '../utils/schema';
import timeout from '../utils/timeout';

const projectId = 'firemelon';
const sessionId = 'asojfbaoufasoinfaso';

function authedApp(auth: any) {
    return firebase.initializeTestApp({ projectId, auth }).firestore();
}

describe('Pull Created', () => {
    afterAll(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should pull created documents from Firestore to WatermelonDB', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const firstDatabase = newDatabase();
        const secondDatabase = newDatabase();

        const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
        const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

        const obj: SyncObj = {
            todos: {},
            users: {}
        };

        await firstDatabase.write(async () => {
            await firstMelonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
        });

        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        const secondMelonTodoCollectionBefore = await secondMelonTodosRef.query().fetch();

        await timeout(500);

        expect(secondMelonTodoCollectionBefore.length).toBe(0);

        await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());

        const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

        expect(secondMelonTodoCollection[0].text).toBe('todo 1');
    });
});

describe('Pull Updated', () => {
    afterAll(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should pull updated documents from Firestore to WatermelonDB', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const firstDatabase = newDatabase();
        const secondDatabase = newDatabase();

        const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
        const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        await firstDatabase.write(async () => {
            await firstMelonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
        });

        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        await timeout(500);

        await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());

        const firstMelonTodoCollection = await firstMelonTodosRef.query().fetch();
        await firstDatabase.write(async () => {
            await firstMelonTodoCollection[0].update((todo: any) => {
                todo.text = 'updated todo';
            });
        });
        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        await timeout(500);

        await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());

        const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

        expect(secondMelonTodoCollection.length).toBe(1);

        expect(secondMelonTodoCollection[0].text).toBe('updated todo');
    });
});

describe('Pull Deleted', () => {
    afterAll(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should pull marked-as-deleted documents from Firestore to WatermelonDB and mark them as deleted', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const firstDatabase = newDatabase();
        const secondDatabase = newDatabase();

        const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
        const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

        const obj: SyncObj = {
            todos: {},
            users: {}
        };

        await firstDatabase.write(async () => {
            await firstMelonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
        });

        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        await timeout(500);

        await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());

        const firstMelonTodoCollection = await firstMelonTodosRef.query().fetch();
        await firstDatabase.write(async () => {
            await firstMelonTodoCollection[0].markAsDeleted();
        });

        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        await timeout(500);

        await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());

        const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

        expect(secondMelonTodoCollection.length).toBe(0);
    });
});
