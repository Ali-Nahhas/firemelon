import * as firebase from '@firebase/testing';
import newDatabase from '../utils/schema';

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
        const todosRef = db.collections.get('todos');
        const ref = app1.collection('todos');

        await db.action(async () => {
            await todosRef.create((todo: any) => {
                todo.text = 'New todooooooooo';
            });
        });

        const allTodos = await todosRef.query().fetch();

        await ref.add(allTodos[0]._raw);

        const added = await ref.get();

        console.log(added.docs[0].data());

        // expect(db).toBe('');
    });
});
