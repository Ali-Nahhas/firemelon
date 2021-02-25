# Firemelon

[![NPM version](https://img.shields.io/npm/v/firemelon)](https://www.npmjs.com/package/firemelon?activeTab=versions)
[![Test](https://github.com/AliAllaf/firemelon/workflows/Test/badge.svg)](https://github.com/AliAllaf/firemelon)

A simple way to sync between WatermelonDB and Firestore/Realtime Database (Experimental).

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
import { sync, SyncConfig, sessionId } from 'firemelon';

const syncConfig: SyncConfig = {
  objects: ['todos'],
  db: firebase.firestore(),
  storage: 'firestore',
  getTimestamp: () => new Date(),
};

await sync(watermelonDatabase, sessionId(), syncConfig);
```

---

```typescript
const sync = async (database: Database, sessionId: string, config: SyncConfig);
```

- **database** :
  The _WatermelonDB_ database to be synced.

- **sessionId** :
  A unique ID for each session to prevent the function from pulling its own pushed changes.

- **config**: The sync configuration object

---

### SyncConfig

```typescript
interface SyncConfig {
  objects: SyncObj;
  storage: SyncStorage;
  getTimestamp?: () => any;
  authenticated?: boolean;
  getUserId?: () => Promise<string>;
  db: FirestoreModule | Database;
  excludedFields?: string[];
}
```

- **objects** :
  Refers to which collections should be synced from Watermelon DB to Firebase.
  Can either be an array or a `SyncObj`.

- **storage**:
  Must be either `firestore` or `realtime-database`. Note: `relatime-database` support is currently experimental.

- **db** :
  The _firestore_ or _realtime database_ module used in the app.

- **authenticated**:
  When enabled, the `sync` function will throw an error unless a valid userId is retrieved from the getUserId function.

- **getUserId**:
  Returns a string value for the current userId. All written data will be scoped to this user and fetched data too.

- **getTimestamp**:
  A custom function to provide a date for the sync time.
  default is `new Date()`.

  This is an example of a more accurate way :

  ```typescript
  const timefn = () => firestore.FieldValue.serverTimestamp();
  ```

- **excludedFields**:
  Fields to exclude from _ALL_ synchronized objects. If you would lie to exclude fields on a per-collection basis use the `SyncObj`.

---

### SyncObj

```typescript
export type SyncObj =
  | {
      [collectionName: string]: SyncCollectionOptions;
    }
  | string[];
```

Example usage:

```typescript
// 1. A simple array, do not require any configuration
const objects: SyncObj = ['todos', 'users', 'feeds'];

// 2. An object, with each collection key and custom configuration
const objects: SyncObj = {
  todos: {},
  users: {
    excludedFields: ['email'],
  },
  feeds: {
    customQuery: firestore().collection('feeds').where('isSpecial', '==', true),
  },
};
```

---

### Older Usage

This is how the library was accessed in older versions, the same interface is still exported for reverse-compatibility.
You can interact with it using either interface.

```typescript
import { syncFireMelon } from 'firemelon';

async () => {
  await syncFireMelon(database, syncObject, firestore, sessionId, timefn());
};
```

- **database** :
  The _WatermelonDB_ database to be synced.

- **syncObject** :
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

- **firestore** :
  The _Firestore_ module used in the app.

- **sessionId** :
  A unique ID for each session to prevent the function from pulling its own pushed changes.

- **timefn()** :

  A custom function to provide a date for the sync time.
  default is `new Date()`.

  This is an example of a more accurate way :

  ```typescript
  const timefn = () => firestore.FieldValue.serverTimestamp();
  ```

## Realtime Database Support (Experimental)

Realtime database support is currently experimental, under active development.
If you wish to use the realtime database, update your `syncConfig` accordingly.

**Why use Realtime Database?**

Unlike Cloud Firestore, Realtime DB does not charge per operation (read/write/delete) rather they charge for total bandwidth and data stored.

If your app requires frequent synchronization across several clients, you could be looking at a large number of reads and writes per day or hour, depending on the amount of data stored and the amount of devices being synced to. This could end up costing quite a bit.

So using the Realtime Database might be a better alternative. However, there are some limitations:

- All of the synchronized data has to be stored under one object for a given user (see below)

```json
{
    "sync": {
        "user1": {
            "todos": {...},
            "feeds": {...},
            "lists": {...}
        },
        "user2": {
            "todos": {...},
            "feeds": {...},
            "lists": {...}
        }
    }
}
```

- Every time you call `sync` the entire dataset for a given user must be downloaded. So if you have 10mb worth of data stored in `sync/user1/**` that must be downloaded in order to write any new data to that location. This may affect performance seriously with large datasets.
- Timestamps must be stored as `numbers` and note a `Date` otherwise the data will fail to save properly
- You cannot use `customQueries` to apply additional filtering to the pulled changes. All data stored will be synchronized across all devices.

**Which one should I use?**

Considering Realtime Database support is experimental, I would suggest using Firestore for now.
If you anticipate a high number of monthly read/write/delete operations or high-frequency synchronization across several devices, the RTDB might be a better shot.

## Authentication

Support for authentication is also experimental.
If you pass a `getUserId` function to the `syncConfig` and set `authenticated` to true, the synchronized data will be scoped to the user with the given userId.

It's up to you to decide where to get the userId from, this can be the firebase user UID or from another authentication provider (Auth0, AWS Cognito, Next Auth etc.)
