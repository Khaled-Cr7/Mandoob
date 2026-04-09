import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
  setLoading(true);
  try {
    let uniqueId = "UNKNOWN_ID";
    if (Platform.OS === 'android') {
      // FIX 1: Use the function call instead of property
      uniqueId = Application.getAndroidId(); 
    } else {
      const iosId = await Application.getIosIdForVendorAsync();
      uniqueId = iosId || "UNKNOWN_IOS_ID";
    }

    const deviceData = {
      deviceId: uniqueId,
      deviceName: Device.deviceName || "Unknown Device",
      deviceModel: Device.modelName || "Unknown Model",
      brand: Device.brand || "Unknown Brand",
    };

    let pushToken = "";
    
    if (Device.isDevice) { 
      try {
        const ExpoNotifications = require('expo-notifications'); 
        
        const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await ExpoNotifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          const tokenData = await ExpoNotifications.getExpoPushTokenAsync({
            // Ensure you have a projectID in your app.json!
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          pushToken = tokenData.data;
          console.log("Token generated:", pushToken);
        }
      } catch (tokenError) {
        console.log("Push token error:", tokenError);
      }
    } else {
      console.log("Push notifications skipped: Not a physical device.");
    }

    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: username.toLowerCase().trim(), 
        password,
        ...deviceData,
        pushToken 
      }),
    });

    const data = await response.json();

    if (response.ok) {
      await AsyncStorage.setItem('userId', String(data.id));

      if (data.needsOTP) {
        router.replace({ 
          pathname: '/(auth)/otp', 
          params: { userId: String(data.id), deviceId: deviceData.deviceId } 
        });
      } else {
        // Standard successful login (No OTP needed)
        if (data.role === 'ADMIN') {
          router.replace('/(admin)');
        } else {
          router.replace('/(user)');
        }
      }
    } else {
      // --- THIS IS WHERE THE ERROR LOGIC LIVES ---
      if (data.message === "DEVICE_LINKED_ELSEWHERE") {
        Alert.alert(
          t('access_denied'), 
          t('device_already_linked_msg') || "This device is already linked to another account."
        );
      } else {
        // Default error (Wrong password, etc.)
        Alert.alert(t('login_failed'), t('login_failed_msg'));
      }
    }
  } catch (error) {
    Alert.alert(t('error'), t('connection_error'));
  } finally {
    setLoading(false);
  }
};

  return (
    <View className="flex-1 bg-slate-50 justify-center px-8">
      {/* --- BRANDING SECTION --- */}
      <View className="items-center mb-12">
        <View className="bg-blue-600 w-20 h-20 rounded-[24px] items-center justify-center shadow-lg shadow-blue-500/40 mb-6">
          <Ionicons name="cube" size={40} color="white" />
        </View>
        <Text className="text-blue-600 text-[10px] font-black uppercase tracking-[4px] mb-1">
          Kunooz Albaraka
        </Text>
        <Text className="text-3xl font-black text-slate-900">
          {t('welcome_back')}
        </Text>
      </View>

      {/* --- FORM SECTION --- */}
      <View className="space-y-4">
        {/* Username Slot */}
        <View>
          <Text className="text-slate-500 text-[10px] font-black uppercase ml-1 mb-2 tracking-widest">
            {t('username')}
          </Text>
          <View className="flex-row items-center bg-white h-16 rounded-2xl px-4 border border-slate-200 shadow-sm">
            <Ionicons name="person-outline" size={20} color="#94a3b8" />
            <TextInput 
              className="flex-1 ml-3 text-slate-900 font-bold text-base"
              placeholder={t('Enter_your_username')}
              placeholderTextColor="#cbd5e1"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </View>
        </View>

        {/* Password Slot */}
        <View className="mt-4">
          <Text className="text-slate-500 text-[10px] font-black uppercase ml-1 mb-2 tracking-widest">
            {t('password')}
          </Text>
          <View className="flex-row items-center bg-white h-16 rounded-2xl px-4 border border-slate-200 shadow-sm">
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
            <TextInput 
              className="flex-1 ml-3 text-slate-900 font-bold text-base"
              placeholder="••••••••"
              placeholderTextColor="#cbd5e1"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity 
          onPress={handleLogin} 
          activeOpacity={0.8}
          className="bg-blue-600 h-16 rounded-2xl items-center justify-center mt-10 shadow-xl shadow-blue-500/30"
        >
          <Text className="text-white text-lg font-black uppercase tracking-tight">
            {t('login')}
          </Text>
        </TouchableOpacity>
        
        {/* Subtle Footer */}
        <Text className="text-center text-slate-400 text-[10px] font-bold uppercase mt-8 tracking-widest">
          {t('system_version')}
        </Text>
      </View>
    </View>
  );
}