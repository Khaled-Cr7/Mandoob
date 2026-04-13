import { Stack } from "expo-router";
import "./globals.css"
import "../i18n"; 
import { useEffect, useState } from 'react'; // Added useState
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { syncPushToken } from '../utils/push'; // Import your helper
import { useSession } from '@/hooks/useSession'; // Use your existing session hook

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const { userId, loading } = useSession();

  // --- 1. Notification Listener ---
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      Alert.alert(
        notification.request.content.title || "Update",
        notification.request.content.body || ""
      );
    });
    return () => subscription.remove();
  }, []);

  // --- 2. Push Token Sync (The New Part) ---
  useEffect(() => {
    // Only sync if we are done loading and we actually have a user
    if (!loading && userId) {
      console.log("🚀 RootLayout: Syncing push token for user", userId);
      syncPushToken(Number(userId));
    }
  }, [userId, loading]); // Fires when loading finishes OR userId changes

  // --- 3. RTL / Language Startup Sync ---
  useEffect(() => {
    const syncLayoutAtStartup = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('user-language');
        const shouldBeRTL = savedLang === 'ar';

        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(shouldBeRTL);
          I18nManager.forceRTL(shouldBeRTL);
          
          await Updates.reloadAsync().catch(() => {
             console.log("Startup reload failed - Manual restart may be needed");
          });
        }
      } catch (err) {
        console.error("Layout sync error:", err);
      }
    };
    syncLayoutAtStartup();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(user)">
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(user)" />  
    </Stack>
  );
}