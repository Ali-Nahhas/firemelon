import { syncFireMelon } from '../firestoreSync';
import { SyncObj } from '../types/interfaces';
import newDatabase, { Todo } from '../utils/schema';
import timeout from '../utils/timeout';
import { Model } from '@nozbe/watermelondb';
import { getAuthedFirestore } from './testUtils';

const sessionId = 'asojfbaoufasoinfaso';

describe('extra', () => {
    it('should not try to update created document', async () => {
        const app1 = await getAuthedFirestore({ uid: 'owner' });

        const firstDatabase = newDatabase();
        const secondDatabase = newDatabase();

        const firstMelonTodosRef = firstDatabase.collections.get<Todo>('todos');
        const secondMelonTodosRef = secondDatabase.collections.get<Todo>('todos');

        const obj: SyncObj = {
            todos: {},
        };

        let created: Model;

        await firstDatabase.write(async () => {
            created = await firstMelonTodosRef.create((todo: any) => {
                todo.text = 'todo 1';
            });
        });
        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());

        await firstDatabase.write(async () => {
            await created.update((todo: any) => {
                todo.text = 'todo 2';
            });
        });
        await syncFireMelon(firstDatabase, obj, app1, sessionId, () => new Date());
        await timeout(500);

        await syncFireMelon(secondDatabase, obj, app1, 'secondSessionId', () => new Date());
        await timeout(500);

        const secondMelonTodoCol = await secondMelonTodosRef.query().fetch();

        expect(secondMelonTodoCol.length).toBe(1);

        expect(secondMelonTodoCol[0].text).toBe('todo 2');
    });
});
