import { I18nManager, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { API_URL } from '../constants';

export const handleLanguageToggle = async (
  i18n: any,
  t: any,
  userId?: any,
  lang?: string
) => {
  const currentLang = i18n.language;
  const targetLang = lang || (currentLang === 'ar' ? 'en' : 'ar');
  const isArabic = targetLang === 'ar';

  // 1. Save to storage FIRST (reload will read this)
  await AsyncStorage.setItem('user-language', targetLang);

  // 2. Sync with backend (fire and forget)
  if (userId) {
    fetch(`${API_URL}/profile/language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, language: targetLang }),
    }).catch(() => {});
  }

  // 3. Check if RTL direction needs to change
  const needsFlip = I18nManager.isRTL !== isArabic;

  if (needsFlip) {
    I18nManager.allowRTL(isArabic);
    I18nManager.forceRTL(isArabic);
  }

  // 4. Always reload — avoids any mid-render state change
  //    The Alert itself causes a re-render which triggers the crash.
  //    Use InteractionManager to defer until after the current render cycle.
  const { InteractionManager } = require('react-native');
  InteractionManager.runAfterInteractions(() => {
    Alert.alert(
      isArabic ? 'إعادة تشغيل' : 'Restart Required',
      isArabic
        ? 'يجب إعادة تشغيل التطبيق لتغيير اللغة.'
        : 'The app will restart to apply the language change.',
      [
        {
          text: 'OK',
          onPress: () => {
            Updates.reloadAsync().catch(() => {
              Alert.alert('Notice', 'Please restart the app manually.');
            });
          },
        },
      ]
    );
  });
};