# Firemelon

[![NPM version](https://img.shields.io/npm/v/firemelon)](https://www.npmjs.com/package/firemelon?activeTab=versions)
[![Test](https://github.com/AliAllaf/firemelon/workflows/Test/badge.svg)](https://github.com/AliAllaf/firemelon)

A simple way to sync between WatermelonDB and Firestore.

## Installation

Using npm :

```
$ npm install firemelon
```

Using yarn :

```
$ yarn add firemelon
```

## Compatibility

Firemelon works with both [@firebase/firestore](https://www.npmjs.com/package/@firebase/firestore) and [@react-native-firebase/firestore](https://www.npmjs.com/package/@react-native-firebase/firestore)

## Usage

```typescript
import { syncFireMelon } from 'firemelon';

async () => {
    await syncFireMelon(database, syncObject, firestore, sessionId, timefn());
};
```

-   **database** :
    The _WatermelonDB_ database to be synced.

-   **syncObject** :
    An object in which the synced collections and there options are

### Example:

```typescript
const syncObject = {
    // collections to sync
    todos: {
        // (optional)
        excludedFields: ['color', 'userId'],

        // To provide extra filters in queries. (optional)
        customQuery: firestore.collection('todos').where('color', '==', 'red'),
    },

    users: {},
};
```

-   **firestore** :
    The _Firestore_ module used in the app.

-   **sessionId** :
    A unique ID for each session to prevent the function from pulling its own pushed changes.

-   **timefn()** :

    A custom function to provide a date for the sync time.
    default is `new Date()`.

    This is an example of a more accurate way :

    ```typescript
    const timefn = () => firestore.FieldValue.serverTimestamp();
    ```
