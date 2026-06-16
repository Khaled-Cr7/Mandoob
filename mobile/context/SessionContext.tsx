import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as Application from 'expo-application';
import { API_URL } from '../constants';
import { useTranslation } from 'react-i18next';

type SessionState = {
  userId: string | null;
  userRole: string | null;
  loading: boolean;
  signIn: (id: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  confirmSignOut: () => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const validateSession = async () => {
      const id = await AsyncStorage.getItem('userId');
      const role = await AsyncStorage.getItem('userRole');

      if (!id) {
        setUserId(null);
        setUserRole(null);
        setLoading(false);
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
            setUserId(id);
            setUserRole(role);
          } else {
            await AsyncStorage.multiRemove(['userId', 'userRole']);
            setUserId(null);
            setUserRole(null);
          }
        } else {
          await AsyncStorage.multiRemove(['userId', 'userRole']);
          setUserId(null);
          setUserRole(null);
        }
      } catch (e) {
        setUserId(id);
        setUserRole(role);
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const signIn = async (id: string, role: string) => {
    await AsyncStorage.setItem('userId', id);
    await AsyncStorage.setItem('userRole', role);
    setUserId(id);
    setUserRole(role);
  };

  const logout = async () => {
    try {
      const deviceId = Platform.OS === 'android'
        ? await Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();

      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), deviceId }),
      });
    } catch (e) {
      console.log('Backend logout failed, clearing local anyway.');
    } finally {
      await AsyncStorage.multiRemove(['userId', 'userRole']);
      setUserId(null);
      setUserRole(null);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(t('sign_out'), t('confirm_leave'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sign_out'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SessionContext.Provider value={{ userId, userRole, loading, signIn, logout, confirmSignOut }}>
      {children}
    </SessionContext.Provider>
  );
}

// This replaces your useSession hook — same API, drop-in replacement
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}