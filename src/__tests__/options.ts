import * as firebase from '@firebase/testing';
import { syncFireMelon } from '../sync';
import { SyncObj } from '../types/interfaces';
import newDatabase, { Todo } from '../utils/schema';
import timeout from '../utils/timeout';

const projectId = 'firemelon';
const sessionId = 'asojfbaoufasoinfaso';

function authedApp(auth: any) {
  return firebase.initializeTestApp({ projectId, auth }).firestore();
}

describe('Options Excluded Fields', () => {
  afterAll(async () => {
    await firebase.clearFirestoreData({ projectId });
    await Promise.all(firebase.apps().map((app) => app.delete()));
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

    await syncFireMelon(firstDatabase, obj, app1, sessionId);

    const todosSnapshot = await fireTodosRef.get();

    expect(todosSnapshot.docs.length).toBe(1);
    expect(todosSnapshot.docs[0].data().text).toBe('todo 1');
    expect(todosSnapshot.docs[0].data().color).toBeUndefined();
  });
});

describe('Options Custom Query', () => {
  afterAll(async () => {
    await firebase.clearFirestoreData({ projectId });
    await Promise.all(firebase.apps().map((app) => app.delete()));
  });

  it('should sync performing the custom query passed in options', async () => {
    const app1 = authedApp({ uid: 'owner' });

    const firstDatabase = newDatabase();
    const secondDatabase = newDatabase();

    const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
    const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

    const fireTodosRef = app1.collection('todos').where('color', '==', 'red');

    const obj: SyncObj = {
      todos: {
        customQuery: fireTodosRef,
      },
    };

    await firstDatabase.action(async () => {
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 1';
        todo.color = 'red';
      });
      await firstMelonTodosRef.create((todo: any) => {
        todo.text = 'todo 2';
        todo.color = 'blue';
      });
    });

    await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

    await timeout(500);

    await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());

    const secondMelonTodoCollection = await secondMelonTodosRef.query().fetch();

    expect(secondMelonTodoCollection.length).toBe(1);
    expect(secondMelonTodoCollection[0].color).toBe('red');
    expect(secondMelonTodoCollection[0].text).toBe('todo 1');
  });
});
