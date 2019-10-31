import { appSchema, tableSchema } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { Database } from '@nozbe/watermelondb';
import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export const schema = appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'todos',
            columns: [
                { name: 'text', type: 'string', isIndexed: true },
                { name: 'color', type: 'string', isIndexed: true },
            ],
        }),
        tableSchema({
            name: 'users',
            columns: [{ name: 'name', type: 'string', isIndexed: true }],
        }),
    ],
});

export class Todo extends Model {
    static table = 'todos';

    @field('text')
    text!: string;

    @field('color')
    color!: string;
}
export class User extends Model {
    static table = 'users';

    @field('name')
    text!: string;
}

export default function newDatabase() {
    const adapter = new LokiJSAdapter({
        schema,
    });
    const database = new Database({
        adapter,
        // @ts-ignore
        modelClasses: [Todo, User],
        actionsEnabled: true,
    });

    return database;
}
