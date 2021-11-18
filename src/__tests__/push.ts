import * as firebase from '@firebase/testing';
import { Model } from '@nozbe/watermelondb';
import { syncFireMelon } from '../firestoreSync';
import { SyncObj } from '../types/interfaces';
import newDatabase, { Todo, User } from '../utils/schema';
import timeout from '../utils/timeout';

const projectId = 'firemelon';
const sessionId = 'asojfbaoufasoinfaso';

function authedApp(auth: any) {
    return firebase.initializeTestApp({ projectId, auth }).firestore();
}

describe('Push Created', () => {
    afterEach(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should perform as successfully for more than 500 docs (Firebase write limit)', async () => {
        await firebase.clearFirestoreData({ projectId });

        const app1 = authedApp({ uid: 'owner' });

        const db = newDatabase();
        const melonTodosRef = db.collections.get<Todo>('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        // Create 510 todos
        await db.write(async () => {
            for(let i = 0; i<510; i++){
                await melonTodosRef.create((todo: any) => {
                    todo.text = 'todo';
                });
            }
        });

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        await timeout(500);

        const todosSnapshot = await fireTodosRef.get();

        expect(todosSnapshot.docs.length).toBe(510);
    });

    it('should push documents to firestore when adding new objects in watermelonDB', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const db = newDatabase();
        const melonTodosRef = db.collections.get<Todo>('todos');
        const fireTodosRef = app1.collection('todos');
        const melonUsersRef = db.collections.get<User>('users');
        const fireUsersRef = app1.collection('users');

        await db.write(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
            await melonUsersRef.create((user: any) => {
                user.text = 'some user name';
            });
        });

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        const melonTodos = await melonTodosRef.query().fetch();
        const melonUsers = await melonUsersRef.query().fetch();
        const firstMelonTodo = melonTodos[0];
        const firstMelonUser = melonUsers[0];

        const todosSnapshot = await fireTodosRef.get();
        const usersSnapshot = await fireUsersRef.get();
        const firstFireTodo = todosSnapshot.docs[0].data();
        const firstFireUser = usersSnapshot.docs[0].data();

        expect(todosSnapshot.docs.length).toBe(1);
        expect(usersSnapshot.docs.length).toBe(1);

        expect(firstFireTodo.text).toBe(firstMelonTodo.text);
        expect(firstFireUser.name).toBe(firstMelonUser.name);

        await timeout(500);
    });
});

describe('Push Updated', () => {
    afterAll(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should update documents in firestore when updating objects in watermelonDB', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const db = newDatabase();
        const melonTodosRef = db.collections.get<Todo>('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        let updated: Model;

        await db.write(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });

            updated = await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 2';
            });
        });

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        await timeout(500);

        await db.write(async () => {
            await updated.update((todo: any) => {
                todo.text = 'updated todo';
            });
        });

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        const todosSnapshot = await fireTodosRef.get();

        const firstTodoSnapshot = todosSnapshot.docs.find((t) => t.data().text === 'todo 1');
        const updatedTodoSnapshot = todosSnapshot.docs.find((t) => t.data().text === 'updated todo');

        expect(firstTodoSnapshot).not.toBeUndefined();
        expect(updatedTodoSnapshot).not.toBeUndefined();

        expect(todosSnapshot.docs.length).toBe(2);
    });
});

describe('Push Deleted', () => {
    afterAll(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should mark documents in firestore as Deleted when marking objects as deleted in watermelonDB', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const db = newDatabase();
        const melonTodosRef = db.collections.get<Todo>('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        let deleted: Model;

        await db.write(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });

            deleted = await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 2';
            });
        });

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        await timeout(500);

        await db.write(async () => {
            await deleted.markAsDeleted();
        });

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        const todosSnapshot = await fireTodosRef.get();

        const firstTodoSnapshot = todosSnapshot.docs.find((t) => t.data().text === 'todo 1');
        const deletedTodoSnapshot = todosSnapshot.docs.find((t) => t.data().text === 'todo 2');

        expect(firstTodoSnapshot).not.toBeUndefined();
        expect(deletedTodoSnapshot).not.toBeUndefined();

        expect(deletedTodoSnapshot!.data().text).toBe('todo 2');
        expect(deletedTodoSnapshot!.data().isDeleted).toBe(true);

        expect(todosSnapshot.docs.length).toBe(2);
    });
});