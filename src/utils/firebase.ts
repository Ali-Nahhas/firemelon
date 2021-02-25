import * as firebase from 'firebase';
import * as firebaseTesting from '@firebase/testing';

export interface UseFirebaseConfig {
  auth?: any;
  projectId?: string;
  databaseName?: string;
}

const defaultConfig: UseFirebaseConfig = {
  projectId: 'firemelon',
  databaseName: 'firemelon-default-rtdb',
};

export const useFirebase = (config: UseFirebaseConfig = defaultConfig): firebase.default.app.App => {
  const mergedConfig = {
    ...defaultConfig,
    ...config,
  };
  return firebaseTesting.initializeTestApp({
    projectId: mergedConfig.projectId!,
    auth: mergedConfig.auth!,
    databaseName: mergedConfig.databaseName!,
  }) as any;
};

export const clearFirebase = async (config: UseFirebaseConfig = defaultConfig) => {
  firebaseTesting.clearFirestoreData({ projectId: config.projectId! });
  await Promise.all(firebaseTesting.apps().map((app) => app.delete()));
};
