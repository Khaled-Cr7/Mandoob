import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL } from '../constants';

export const syncPushToken = async (userId: number) => {
  try {
    const deviceId = Platform.OS === 'android' 
      ? await Application.getAndroidId() 
      : await Application.getIosIdForVendorAsync();

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log("⚠️ No EAS projectId found in app config — cannot get push token");
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData.data;

    await fetch(`${API_URL}/notifications/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pushToken, deviceId }),
    });
    console.log(`🔄 Token synced for User ${userId}`);
  } catch (e) {
    console.log("⚠️ Sync error:", e);
  }
};