import { Stack } from "expo-router";
import "./globals.css"
import "../i18n"; 
import { useEffect } from 'react';
import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';


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

  useEffect(() => {
    // 1. Listen for notifications arriving while app is open
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log("🔔 Notification Received:", notification);
      Alert.alert(
        notification.request.content.title || "Update",
        notification.request.content.body || ""
      );
    });

    return () => subscription.remove();
  }, []);


  useEffect(() => {
    const syncLayoutAtStartup = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('user-language');
        const shouldBeRTL = savedLang === 'ar';

        // Check if the current native state matches our saved preference
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(shouldBeRTL);
          I18nManager.forceRTL(shouldBeRTL);
          
          // Force a clean native reload
          // We wrap it to avoid the "1 argument" error
          const doReload = async () => {
            try {
              await Updates.reloadAsync();
            } catch (e) {
              // In dev mode, we might need a manual swipe-close
              console.log("Startup reload failed - Manual restart may be needed in Expo Go");
            }
          };
          
          doReload();
        }
      } catch (err) {
        console.error("Layout sync error:", err);
      }
    };

    syncLayoutAtStartup();
  }, []);
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(auth)/login">
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(user)" />  
    </Stack>
  );
}