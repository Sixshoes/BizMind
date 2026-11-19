import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { app } from './firebase';

export const auth = getAuth(app);

export const GUEST_MODE_STORAGE_KEY = 'bizmind_guest_mode_v1';
export const GUEST_OWNER_UID = '__guest__';

export const isGuestSessionActive = (): boolean => {
  try {
    return localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setGuestSessionActive = (active: boolean): void => {
  try {
    if (active) {
      localStorage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const getActiveOwnerUid = (): string | null => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  if (isGuestSessionActive()) return GUEST_OWNER_UID;
  return null;
};

export const watchAuth = (onChange: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      setGuestSessionActive(false);
    }
    onChange(user);
  });
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
    setGuestSessionActive(false);
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
};

export const signOut = async () => {
  setGuestSessionActive(false);
  if (auth.currentUser) {
    await firebaseSignOut(auth);
  }
};

export const authErrorMessage = (error: any): string => {
  const code = error?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return '此網域尚未加入 Firebase 允許清單。請至 Firebase Console → Authentication → Settings → Authorized domains 新增目前網域，或先使用「免登入本機體驗模式」。';
  }
  if (code === 'auth/popup-closed-by-user') {
    return '已取消 Google 登入視窗。';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase 尚未啟用 Google 登入方式。';
  }
  return error?.message || '登入失敗，請稍後再試或改用免登入體驗模式。';
};
