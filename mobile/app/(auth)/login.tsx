import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    try {
      // Use your laptop's IP address if testing on a real phone, 
      // or 10.0.2.2 for Android Emulator, or localhost for iOS Simulator
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // THE REDIRECT LOGIC
        if (data.role === 'ADMIN') {
          router.replace('/(admin)');
        } else {
          router.replace({
            pathname: '/(user)',
            params: { userId: data.id }
          });
        }
      } else {
        Alert.alert(t('login_failed'),t('login_failed_msg'));
      }
    } catch (error) {
      Alert.alert(t('login_failed'), t('login_failed_msg'));
    }
  };

  return (
    <View className="flex-1 bg-white px-8 justify-center">
      <Text className="text-4xl font-extrabold text-slate-900 mb-8">{t('sign_in')}</Text>
      
      <View className="space-y-4">
        {/* Email Slot */}
        <View>
          <Text className="text-slate-600 mb-1 ml-1 font-medium">{t('username')}</Text>
          <TextInput 
            className="..."
            placeholder={t('Enter_your_username')}
            value={username} // Add this
            onChangeText={setUsername} // Add this
          />
        </View>

        {/* Password Slot */}
        <View className="mt-4">
          <Text className="text-slate-600 mb-1 ml-1 font-medium">{t('password')}</Text>
          <TextInput 
            className="..."
            placeholder="••••••••"
            secureTextEntry
            value={password} // Add this
            onChangeText={setPassword} // Add this
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity onPress={handleLogin} className="bg-blue-600 h-14 rounded-xl items-center justify-center mt-8">
          <Text className="text-white text-lg font-bold">{t('login')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}