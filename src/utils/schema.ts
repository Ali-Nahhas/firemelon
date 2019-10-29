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
            columns: [{ name: 'text', type: 'string', isIndexed: true }],
        }),
    ],
});

export class Todo extends Model {
    static table = 'todos';

    @field('text')
    text!: string;
}

export default function newDatabase() {
    const adapter = new LokiJSAdapter({
        schema,
    });
    const database = new Database({
        adapter,
        // @ts-ignore
        modelClasses: [Todo],
        actionsEnabled: true,
    });

    return database;
}
