import { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as Application from 'expo-application';
import { API_URL } from '../constants';
import { useTranslation } from 'react-i18next';

type SessionState = {
  userId: string | null;
  userRole: string | null;
  loading: boolean;
};

export function useSession() {
  const [session, setSession] = useState<SessionState>({
    userId: null,
    userRole: null,
    loading: true,
  });
  const { t } = useTranslation();

  useEffect(() => {
    const validateSession = async () => {
      const id = await AsyncStorage.getItem('userId');
      const role = await AsyncStorage.getItem('userRole');

      if (!id) {
        setSession({ userId: null, userRole: null, loading: false });
        return;
      }

      try {
        const deviceId = Platform.OS === 'android'
          ? await Application.getAndroidId()
          : await Application.getIosIdForVendorAsync();

        const res = await fetch(`${API_URL}/security/check-status?deviceId=${deviceId}&userId=${id}`);

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ACTIVE') {
            // ✅ Set BOTH values atomically in one setState call
            setSession({ userId: id, userRole: role, loading: false });
          } else {
            await AsyncStorage.multiRemove(['userId', 'userRole']);
            setSession({ userId: null, userRole: null, loading: false });
          }
        } else {
          await AsyncStorage.multiRemove(['userId', 'userRole']);
          setSession({ userId: null, userRole: null, loading: false });
        }
      } catch (e) {
        setSession({ userId: id, userRole: role, loading: false });
      }
    };

    validateSession();
  }, []);

  // ✅ Atomic signIn — sets BOTH values in one render cycle
  const signIn = async (id: string, role: string) => {
    await AsyncStorage.setItem('userId', id);
    await AsyncStorage.setItem('userRole', role);
    setSession({ userId: id, userRole: role, loading: false });
  };

  const logout = async () => {
    try {
      const deviceId = Platform.OS === 'android'
        ? await Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();

      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(session.userId), deviceId }),
      });
    } catch (e) {
      console.log('Backend logout failed, clearing local anyway.');
    } finally {
      await AsyncStorage.multiRemove(['userId', 'userRole']);
      // ✅ Atomic logout — both cleared in one render cycle
      setSession({ userId: null, userRole: null, loading: false });
    }
  };

  const confirmSignOut = () => {
    Alert.alert(t('sign_out'), t('confirm_leave'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sign_out'), style: 'destructive', onPress: logout },
    ]);
  };

  return {
    userId: session.userId,
    userRole: session.userRole,
    loading: session.loading,
    logout,
    signIn,
    confirmSignOut,
  };
}