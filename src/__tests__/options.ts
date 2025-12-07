import { syncFireMelon } from '../index';
import { SyncObj } from '../types/interfaces';
import newDatabase, { Todo } from '../utils/schema';
import timeout from '../utils/timeout';
import { getAuthedFirestore } from './testUtils';

const sessionId = 'asojfbaoufasoinfaso';

describe('Options Excluded Fields', () => {
    it('should exclude fields passes in options from being synced', async () => {
        const app1 = await getAuthedFirestore({ uid: 'owner' });

        const firstDatabase = newDatabase();
        const firstMelonTodosRef = firstDatabase.collections.get('todos');
        const fireTodosRef = app1.collection('todos');

        const obj: SyncObj = {
            todos: {
                excludedFields: ['color'],
            },
        };

        await firstDatabase.write(async () => {
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
    it('should sync performing the custom query passed in options', async () => {
        const app1 = await getAuthedFirestore({ uid: 'owner' });

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

        await firstDatabase.write(async () => {
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
