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
    const validateSession = async () => {
      const id = await AsyncStorage.getItem('userId');
      
      if (!id) {
        setUserId(null);
        setLoading(false);
        return;
      }

      // 🛡️ THE FORTRESS CHECK: Verify the ID with the server on boot
      try {
        const deviceId = Platform.OS === 'android' 
          ? await Application.getAndroidId() 
          : await Application.getIosIdForVendorAsync();

        const res = await fetch(`${API_URL}/security/check-status?deviceId=${deviceId}&userId=${id}`);
        
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ACTIVE') {
            setUserId(id);
          } else {
            // User exists but is Banned or Pending
            await AsyncStorage.removeItem('userId');
            setUserId(null);
          }
        } else {
          // 401 or 404: User was deleted
          await AsyncStorage.removeItem('userId');
          setUserId(null);
        }
      } catch (e) {
        // If server is down, we trust the local ID so they can at least see cached data
        setUserId(id);
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

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