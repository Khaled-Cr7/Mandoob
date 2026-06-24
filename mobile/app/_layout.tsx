import { Stack, useRouter, useSegments } from "expo-router";
import "./globals.css";
import "../i18n"; 
import { useEffect, useState } from 'react';
import { I18nManager, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { syncPushToken } from '../utils/push'; 
import { SessionProvider, useSession } from '../context/SessionContext';
import * as Application from 'expo-application';
import { API_URL } from '../constants';
import { useTranslation } from 'react-i18next';
import i18n from "../i18n";


// --- Global Config & State ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let globalAlertActive = false;

export default function RootLayout() {
   return (
    <SessionProvider>
      <RootLayoutInner />
    </SessionProvider>
  );
}

function RootLayoutInner() {
  const { userId, userRole, loading, logout, signIn } = useSession();
  const { t } = useTranslation();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  // --- 1. Startup Sync (Language & RTL) ---
  useEffect(() => {
    const initializeLayout = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('user-language');
        if (savedLang) {
          // Set the text language
          await i18n.changeLanguage(savedLang);

          // Check if Native RTL matches saved language
          const shouldBeRTL = savedLang === 'ar';
          if (I18nManager.isRTL !== shouldBeRTL) {
            I18nManager.allowRTL(shouldBeRTL);
            I18nManager.forceRTL(shouldBeRTL);
            
            // Re-boot to apply the side flip
            await Updates.reloadAsync();
            return; 
          }
        }
      } catch (e) {
        console.log("Layout sync failed:", e);
      } finally {
        setIsReady(true);
      }
    };
    initializeLayout();
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log('OTA update check failed:', e);
      }
    };

    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);

  // --- 2. Guardian Heartbeat (Security Check) ---
 useEffect(() => {
  if (loading || !userId) return;

  const currentPath = segments[0] as string;
  const isAuthGroup = currentPath === '(auth)' || currentPath === 'login' || currentPath === 'otp';
  if (isAuthGroup) return;

  // 1. Move these variables up so the cleanup can see them clearly
  let intervalId: any;
  let subscription: any;

  const startGuardian = async () => {
    const deviceId = Platform.OS === 'android' 
      ? await Application.getAndroidId() 
      : await Application.getIosIdForVendorAsync();

    const check = async () => {
      if (globalAlertActive || !userId) return; 
      try {
        const res = await fetch(`${API_URL}/security/check-status?deviceId=${deviceId}&userId=${userId}`);
        
        if (res.status === 401 || res.status === 404) {
           handleKick('NOT_FOUND');
           return;
        }

        const data = await res.json();
        if (data.status === 'DENIED' || data.status === 'NOT_FOUND') {
          handleKick(data.status);
        }
      } catch (e) {
        console.log("Guardian: connection silent");
      }
    };

    const handleKick = (status: string) => {
      globalAlertActive = true;
      Alert.alert(
        t('access_denied'), 
        status === 'NOT_FOUND' ? t('account_deleted_msg') : t('revoked_msg'), 
        [{ 
          text: t('ok'), 
          onPress: async () => {
            await logout(); 
            globalAlertActive = false;
            if (intervalId) clearInterval(intervalId);
          } 
        }], 
        { cancelable: false }
      );
    };

    // 2. Assign the listener to the variable we defined above
    subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log("📱 App foreground: checking security...");
        check();
      }
    });

    await check();
    intervalId = setInterval(check, 60000); 
  };

  startGuardian();

  // 3. Simple, synchronous cleanup
  return () => {
    if (subscription) subscription.remove();
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}, [userId, loading, segments]);
  

  // --- 3. Push Notification Listener ---
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      Alert.alert(
        notification.request.content.title || "Update",
        notification.request.content.body || ""
      );
    });
    return () => subscription.remove();
  }, []);

  // --- 3b. Push Token Sync ---
  useEffect(() => {
    if (loading || !userId) return;
    syncPushToken(Number(userId));
  }, [userId, loading]);

  useEffect(() => {
    if (!isReady || loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!userId && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (userId && userRole && inAuthGroup) {
      // ✅ Only redirect when BOTH userId AND userRole are present
      if (userRole === 'ADMIN') {
        router.replace('/(admin)');
      } else {
        router.replace('/(user)');
      }
    }
  }, [userId, userRole, loading, isReady, segments]);


  // --- 4. Render Logic ---
  // We wait for isReady to be true so the Stack doesn't load with the wrong RTL direction
  if (!isReady || loading) {
    return null; 
  }

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(auth)/login">
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(user)" />   
    </Stack>
  );
}