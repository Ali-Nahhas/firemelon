/* 
- These are added to work with both firebase and react-native-firebase.
- Only internally needed methods and are included.
*/

export interface DocumentSnapshot {
    id: string;
    data(): any;
}

export interface QuerySnapshot {
    docs: DocumentSnapshot[];
}

export interface Query {
    set: (data: { [key: string]: any }) => Promise<void>;
    update: (data: { [key: string]: any }) => Promise<void>;
    add: (data: { [key: string]: any }) => Promise<DocumentRef>;
}

export interface DocumentRef extends Query {
    get: () => Promise<DocumentSnapshot>;
}

export interface CollectionRef extends Query {
    doc: (documentName: string) => DocumentRef;
    get: () => Promise<QuerySnapshot>;
    where: (field: string, operator: string, value: any) => CollectionRef;
}

export interface FirestoreModule {
    collection: (collectionPath: string) => CollectionRef;
}
