import { initializeTestEnvironment, RulesTestEnvironment, TokenOptions } from '@firebase/rules-unit-testing';
import { config } from 'dotenv';
config({ path: '.env.test' });

let testEnv: RulesTestEnvironment;

const firestoreConfig = {
    projectId: process.env.FIREMELON_PROJECT_ID || 'firemelon-testing',
    emulatorHost: process.env.FIREMELON_EMULATOR_HOST || '127.0.0.1',
    emulatorPort: parseInt(process.env.FIREMELON_EMULATOR_PORT || '9080', 10),
};

export async function initializeTestEnv() {
    if (!testEnv) {
        testEnv = await initializeTestEnvironment({
            projectId: firestoreConfig.projectId,
            firestore: {
                rules: `rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /{document=**} {
              allow read, write: if true;
            }
          }
        }`,
                host: firestoreConfig.emulatorHost,
                port: firestoreConfig.emulatorPort,
            },
        });

        // Test the connection
        try {
            const testDb = await getAuthedFirestore({ uid: 'test', tokenOptions: { admin: true } });
            await testDb.collection('test').doc('test').set({ test: true });
            await testDb.collection('test').doc('test').delete();
            console.log('Firestore emulator connection test successful');
        } catch (error) {
            console.error('Firestore emulator connection test failed:', error);
            throw error;
        }
    }
    return testEnv;
}

export async function getAuthedFirestore(auth: { uid: string; tokenOptions?: TokenOptions }) {
    if (!testEnv) {
        await initializeTestEnv();
    }
    const result = await testEnv.authenticatedContext(auth.uid, auth.tokenOptions);
    return result.firestore();
}

export async function cleanupTestEnv() {
    if (testEnv) {
        await testEnv.cleanup();
    }
}

export async function clearFirestoreData() {
    if (testEnv) {
        await testEnv.clearFirestore();
    }
}
