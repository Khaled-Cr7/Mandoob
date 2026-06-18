import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { useSession } from '../../context/SessionContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { signIn } = useSession();

  const handleLogin = async () => {
    setLoading(true);
    try {
      let uniqueId = "UNKNOWN_ID";
      if (Platform.OS === 'android') {
        // ✅ FIXED: Added 'await' because getAndroidId() is an asynchronous operation
        uniqueId = await Application.getAndroidId(); 
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
          password: password.trim(),
          ...deviceData,
          pushToken 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.needsOTP) {
          router.replace({ 
            pathname: '/(auth)/otp', 
            params: { userId: String(data.id), deviceId: deviceData.deviceId } 
          });
        } else {
          await signIn(String(data.id), data.role);
        }
      } else {
        switch (data.message) {
          case "INVALID_CREDENTIALS":
            Alert.alert(t('login_failed'), t('wrong_user_pass'));
            break;
          case "DEVICE_LINKED_ELSEWHERE":
            Alert.alert(t('access_denied'), t('device_already_linked_msg'));
            break;
          case "RATE_LIMIT_EXCEEDED":
            Alert.alert(
              t('too_many_requests'), 
              `${t('wait_msg')} ${data.secondsRemaining} ${t('seconds')}`
            );
            break;
          case "DEVICE_DENIED":
            router.replace({ 
              pathname: '/(auth)/otp', 
              params: { userId: String(data.id), deviceId: deviceData.deviceId } 
            });
            break;
          default:
            Alert.alert(t('error'), t('system_error'));
        }
      }
    } catch (error) {
      Alert.alert(t('error'), t('connection_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    // ✅ KeyboardAvoidingView handles shifting logic based on device platform mechanics
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 25 : 0}
      className="flex-1 bg-slate-50"
    >
      {/* ✅ ScrollView added to enable viewport flexibility when keyboard expands */}
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        className="px-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- BRANDING SECTION --- */}
        <View className="items-center mb-12">
          <Image 
            source={require('../../assets/images/k_logo.png')} 
            className="w-36 h-36 mb-6"
            resizeMode="contain"
          />
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
                editable={!loading}
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
                editable={!loading}
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
            disabled={loading}
            className="bg-blue-600 h-16 rounded-2xl items-center justify-center mt-10 shadow-xl shadow-blue-500/30"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-black uppercase tracking-tight">
                {t('login')}
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Subtle Footer */}
          <Text className="text-center text-slate-400 text-[10px] font-bold uppercase mt-8 tracking-widest">
            {t('system_version')}
          </Text>
          <Text className="text-center text-slate-400 text-[10px] font-bold uppercase mt-2 tracking-widest">
            Update ID: dfda3374 (test 3)
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}