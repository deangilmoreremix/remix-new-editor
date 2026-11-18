// [remix] CineGen's Firebase cloud account (its own hosted project) is not part of this editor: there is no cloud sign-in,
// so every cloud branch in CineGen's projects/elements/collaboration code sees "signed out" and uses the local store
// (`window.electronAPI.project/db`), exactly as CineGen does for a signed-out user.
import type { User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Functions } from 'firebase/functions';

export const firebaseApp = null;
export const cloudAuth = { currentUser: null as User | null };
export const cloudDb = null as unknown as Firestore;
export const cloudStorage = null as unknown as FirebaseStorage;
export const cloudFunctions = null as unknown as Functions;

export function waitForCloudAuth(): Promise<User | null> {
  return Promise.resolve(null);
}
