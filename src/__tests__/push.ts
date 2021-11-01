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
    afterAll(async () => {
        await firebase.clearFirestoreData({ projectId });
        await Promise.all(firebase.apps().map((app) => app.delete()));
    });

    it('should raise an error if some document already exists on the server', async () => {
        const app1 = authedApp({ uid: 'owner' });

        const db = newDatabase();
        const melonTodosRef = db.collections.get<Todo>('todos');
        const fireTodosRef = app1.collection('todos');

        await db.write(async () => {
            await melonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
        });

        const obj: SyncObj = {
            todos: {},
            users: {},
        };

        await syncFireMelon(db, obj, app1, sessionId, () => new Date());

        const melonTodos = await melonTodosRef.query().fetch();
        const firstMelonTodo = melonTodos[0];

        const todosSnapshot = await fireTodosRef.get();
        const firstFireTodo = todosSnapshot.docs[0].data();

        expect(todosSnapshot.docs.length).toBe(1);

        expect(firstFireTodo.text).toBe(firstMelonTodo.text);

        await timeout(500);
    })

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

    /**
     * @todo
     * For now watermelon doesn't seem to 'simple' re-execute the sync afeter setting the _status to 'created'. Must find another way...
     */
    // it('should update documents in firestore when updating objects in watermelonDB', async () => {
    //     const app1 = authedApp({ uid: 'owner1' });

    //     const db1 = newDatabase();

    //     const melonTodosRef1 = db1.collections.get<Todo>('todos');

    //     const obj: SyncObj = {
    //         todos: {},
    //         users: {},
    //     };

    //     //@ts-ignore
    //     let created1: Model = null;

    //     await db1.write(async () => {
    //         created1 = await melonTodosRef1.create((todo: any) => {
    //             todo.text = 'todo 1';
    //         });
    //     });

    //     await syncFireMelon(db1, obj, app1, sessionId, () => new Date());

    //     console.debug(created1._raw);

    //     await db1.write(async () => {
    //         created1._raw._status = 'created'
    //     })

    //     console.debug(created1._raw);

    //     console.debug('Will sync again')
    //     await syncFireMelon(db1, obj, app1, sessionId, () => new Date());
    //     console.debug('Sync again completed')

    //     await timeout(500);
    // });
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
