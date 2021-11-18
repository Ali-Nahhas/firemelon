import { appSchema, Database, Model, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { field } from '@nozbe/watermelondb/decorators';

export const schema = appSchema({
    tables: [
        tableSchema({
            columns: [
                { name: 'text', type: 'string', isIndexed: true },
                { name: 'color', type: 'string', isIndexed: true },
            ],
            name: 'todos',
        }),
        tableSchema({
            columns: [{ name: 'name', type: 'string', isIndexed: true }],
            name: 'users',
        }),
    ],
    version: 1,
});

export class Todo extends Model {
    static table = 'todos';

    @((field as any)('text'))
    text!: string;

    @((field as any)('color'))
    color!: string;
}
export class User extends Model {
    static table = 'users';

    @((field as any)('name'))
    name!: string;
}

export default function newDatabase() {
    const adapter = new LokiJSAdapter({
        schema,
        useWebWorker: false,
        useIncrementalIndexedDB: true,
    });
    const database = new Database({
        adapter,
        modelClasses: [Todo, User],
    });

    return database;
}
