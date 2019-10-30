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

export interface DocumentRef {
    get: () => Promise<DocumentSnapshot>;
    set: (data: { [key: string]: any }) => Promise<void>;
    update: (data: { [key: string]: any }) => Promise<void>;
}

export interface Query {
    where: (field: string, operator: WhereFilterOp, value: any) => Query;
    get: () => Promise<QuerySnapshot>;
}

export interface CollectionRef extends Query {
    add: (data: { [key: string]: any }) => Promise<DocumentRef>;
    doc: (documentName: string) => DocumentRef;
}

export type WhereFilterOp = '<' | '<=' | '==' | '>=' | '>' | 'array-contains';

export interface FirestoreModule {
    collection: (collectionPath: string) => CollectionRef;
}
