import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { API_URL } from '../constants';

export const syncPushToken = async (userId: number) => {
  try {
    // 1. Get the current push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    // 2. Get the hardware Device ID
    const deviceId = Platform.OS === 'android' 
      ? await Application.getAndroidId() 
      : await Application.getIosIdForVendorAsync();

    if (!deviceId) return;

    // 3. Sync with the server
    await fetch(`${API_URL}/notifications/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: Number(userId),
        pushToken,
        deviceId
      }),
    });
    
    console.log("🔄 Push token re-synced successfully");
  } catch (e) {
    console.log("⚠️ Token sync failed:", e);
  }
};