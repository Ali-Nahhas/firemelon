import { initializeTestEnv, cleanupTestEnv, clearFirestoreData } from './testUtils';

// Global setup that runs once before all tests
beforeAll(async () => {
    await initializeTestEnv();
});

// Global cleanup that runs once after all tests
afterAll(async () => {
    await cleanupTestEnv();
});

// Clear Firestore data before each test
beforeEach(async () => {
    await clearFirestoreData();
});
