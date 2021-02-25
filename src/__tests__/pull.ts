import { DEFAULT_USER_ID } from '../config';
import { sync } from '../sync';
import { clearFirebase, useFirebase } from '../utils/firebase';
import newDatabase, { Todo } from '../utils/schema';
import timeout from '../utils/timeout';

describe('Pull created', () => {
  afterAll(async () => await clearFirebase());

  it('should pull created documents from Realtime Database to WatermelonDB', async () => {
    const app = useFirebase();
    const firstDatabase = newDatabase();
    const secondDatabase = newDatabase();

    const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
    const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

    const objects = ['todos'];
    const sessionId = () => `${new Date().getTime()}`;

    await app.database().ref('sync/default_user/todos').set({});

    await firstDatabase.action(async () => {
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 1';
      });
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app.database(),
      storage: 'realtime-database',
    });

    const [createdTodo] = await firstMelonTodosRef.query().fetch();
    const persistedDocuments = await app
      .database()
      .ref(`sync/${DEFAULT_USER_ID}/todos/${createdTodo.id}`)
      .once('value');
    expect(persistedDocuments.val()).toBeTruthy();
    expect(persistedDocuments.val().text).toBe('todo 1');

    const secondMelonTodoCollectionBefore = await secondMelonTodosRef.query().fetch();
    await timeout(500);
    expect(secondMelonTodoCollectionBefore.length).toBe(0);

    await sync(secondDatabase, 'secondSession', {
      objects,
      db: app.database(),
      storage: 'realtime-database',
    });

    const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();
    expect(secondMelonTodoCollection[0].text).toBe('todo 1');
  });

  it('should pull created documents from Firestore to WatermelonDB', async () => {
    const app = useFirebase();
    const firstDatabase = newDatabase();
    const secondDatabase = newDatabase();

    const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
    const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

    const objects = ['todos'];
    const sessionId = () => `${new Date().getTime()}`;

    await firstDatabase.action(async () => {
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 1';
      });
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app.firestore(),
      storage: 'firestore',
      getTimestamp: () => new Date(),
    });

    const [createdTodo] = await firstMelonTodosRef.query().fetch();
    const persistedDocuments = await app.firestore().collection('todos').doc(createdTodo.id).get();
    expect(persistedDocuments.data()).toBeTruthy();
    expect(persistedDocuments.data().text).toBe('todo 1');

    const secondMelonTodoCollectionBefore = await secondMelonTodosRef.query().fetch();
    await timeout(500);
    expect(secondMelonTodoCollectionBefore.length).toBe(0);

    await sync(secondDatabase, 'secondSession', {
      objects,
      db: app.firestore(),
      storage: 'firestore',
      getTimestamp: () => new Date(),
    });

    const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();
    expect(secondMelonTodoCollection[0].text).toBe('todo 1');
  });
});

describe('pull updated', () => {
  afterAll(async () => await clearFirebase());

  it('should pull updated documents from Firestore to WatermelonDB', async () => {
    const app1 = useFirebase({ auth: { uid: 'owner' } });
    const firstDatabase = newDatabase();
    const secondDatabase = newDatabase();
    const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
    const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');
    const objects = ['todos'];
    const sessionId = () => `${new Date().getTime()}`;

    await firstDatabase.action(async () => {
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 1';
      });
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      getTimestamp: () => new Date(),
    });

    await timeout(500);

    await sync(secondDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      getTimestamp: () => new Date(),
    });

    const firstMelonTodoCollection = await firstMelonTodosRef.query().fetch();
    await firstDatabase.action(async () => {
      await firstMelonTodoCollection[0].update((todo: any) => {
        todo.text = 'updated todo';
      });
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      getTimestamp: () => new Date(),
    });

    await timeout(500);

    await sync(secondDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      getTimestamp: () => new Date(),
    });

    const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

    expect(secondMelonTodoCollection.length).toBe(1);

    expect(secondMelonTodoCollection[0].text).toBe('updated todo');
  });

  it('should pull updated documents from Realtime Database to WatermelonDB', async () => {
    const app1 = useFirebase({ auth: { uid: 'owner' } });
    const firstDatabase = newDatabase();
    const secondDatabase = newDatabase();
    const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
    const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');
    const objects = ['todos'];
    const sessionId = () => `${new Date().getTime()}`;

    await firstDatabase.action(async () => {
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 1';
      });
    });

    await app1.database().ref('sync/default_user/todos').set({});

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app1.database(),
      getTimestamp: () => new Date(),
      storage: 'realtime-database',
    });

    await timeout(500);

    await sync(secondDatabase, sessionId(), {
      objects,
      db: app1.database(),
      getTimestamp: () => new Date().getTime(),
      storage: 'realtime-database',
    });

    const firstMelonTodoCollection = await firstMelonTodosRef.query().fetch();
    await firstDatabase.action(async () => {
      await firstMelonTodoCollection[0].update((todo: any) => {
        todo.text = 'updated todo';
      });
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app1.database(),
      getTimestamp: () => new Date().getTime(),
      storage: 'realtime-database',
    });

    await timeout(500);

    await sync(secondDatabase, sessionId(), {
      objects,
      db: app1.database(),
      getTimestamp: () => new Date().getTime(),
      storage: 'realtime-database',
    });

    const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

    expect(secondMelonTodoCollection.length).toBe(1);
    expect(secondMelonTodoCollection[0].text).toBe('updated todo');
  });
});

describe('pull Deleted', () => {
  afterAll(async () => {
    await clearFirebase();
  });

  it('should pull marked-as-deleted documents from Firestore to WatermelonDB and mark them as deleted', async () => {
    const app1 = useFirebase({ auth: { uid: 'owner' } });
    const firstDatabase = newDatabase();
    const secondDatabase = newDatabase();
    const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
    const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');
    const objects = ['todos'];
    const sessionId = () => `${new Date().getTime()}`;

    await firstDatabase.action(async () => {
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 1';
      });
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      storage: 'firestore',
      getTimestamp: () => new Date(),
    });

    await timeout(500);

    await sync(secondDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      storage: 'firestore',
      getTimestamp: () => new Date(),
    });

    const firstMelonTodoCollection = await firstMelonTodosRef.query().fetch();
    await firstDatabase.action(async () => {
      await firstMelonTodoCollection[0].markAsDeleted();
    });

    await sync(firstDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      storage: 'firestore',
      getTimestamp: () => new Date(),
    });

    const firestoreDocs = await app1.firestore().collection('todos').get();
    console.log(firestoreDocs.docs.map((doc) => doc.data()));
    expect(firestoreDocs.docs[0].data().isDeleted).toBeTruthy();

    await timeout(500);

    await sync(secondDatabase, sessionId(), {
      objects,
      db: app1.firestore(),
      storage: 'firestore',
      getTimestamp: () => new Date(),
    });

    const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

    expect(secondMelonTodoCollection.length).toBe(0);
  });
});
