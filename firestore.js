import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import firebaseApp from './firebaseConfig';

const db = getFirestore(firebaseApp);
if (process.env.NODE_ENV === 'development') {
  console.log('Firestore emulator enabled');
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export default db;