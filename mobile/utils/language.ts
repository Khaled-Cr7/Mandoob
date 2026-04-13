import { I18nManager, Alert, DevSettings, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants';

export const handleLanguageToggle = async (i18n: any, t: any, userId: any, targetLang?: string) => {
  const newLang = targetLang || (i18n.language === 'ar' ? 'en' : 'ar');
  if (i18n.language === newLang) return;

  try {
    // 1. SYNC WITH BACKEND FIRST
    if (userId) {
      console.log(`📡 Syncing language (${newLang}) to server for user ${userId}...`);
      
      const response = await fetch(`${API_URL}/profile/language`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), language: newLang })
      });

      if (!response.ok) {
        throw new Error("Server rejected the language update");
      }
      console.log("✅ Server sync successful");
    }

    // 2. SAVE LOCALLY
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem('user-language', newLang);
    
    // 3. APPLY RTL
    const isArabic = newLang === 'ar';
    I18nManager.allowRTL(isArabic);
    I18nManager.forceRTL(isArabic);

    // 4. RESTART
    Alert.alert(
      t('restart_required'), 
      t('restart_msg'), 
      [{ 
        text: t('restart'), 
        onPress: async () => {
          try {
            await Updates.reloadAsync();
          } catch (e) {
            if (__DEV__) DevSettings.reload();
          }
        } 
      }], 
      { cancelable: false }
    );
  } catch (error) {
    console.error("❌ Language Toggle Error:", error);
    Alert.alert("Error", "Could not sync language with server.");
  }
};