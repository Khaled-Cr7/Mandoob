import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { Alert, Platform } from 'react-native';
import * as Application from 'expo-application';
import { API_URL } from '../constants';
import { useTranslation } from 'react-i18next';

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const { t } = useTranslation();

  useEffect(() => {
    const getID = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
      setLoading(false);
    };
    getID();
  }, [segments]);

  const logout = async () => {
    // We wrap the actual logic so we can call it from the Alert or directly
    try {
      const deviceId = Platform.OS === 'android' 
        ? await Application.getAndroidId() 
        : await Application.getIosIdForVendorAsync();

      // 1. Server cleanup (Delete push token)
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: Number(userId), 
          deviceId: deviceId 
        })
      });
    } catch (e) {
      console.log("Backend logout failed, clearing local storage anyway.");
    } finally {
      // 2. Local cleanup
      await AsyncStorage.removeItem('userId');
      setUserId(null); 
      router.replace('/(auth)/login');
    }
  };

  // This is the function you will call from your UI buttons
  const confirmSignOut = () => {
    Alert.alert(t('sign_out'), t('confirm_leave'), [
      { text: t('cancel'), style: "cancel" },
      { 
        text: t('sign_out'), 
        style: "destructive", 
        onPress: logout 
      }
    ]);
  };

  return { userId, loading, logout, confirmSignOut };
}