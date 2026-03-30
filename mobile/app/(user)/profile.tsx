import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router'; 
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates'; // Fixed import
import { DevSettings } from 'react-native';
import { RefreshControl } from 'react-native';

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const userId = params.userId || "11"; 
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [refreshing, setRefreshing] = useState(false);

  const { t, i18n } = useTranslation();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  }, [userId]);

  const changeLanguage = async (lang: string) => {
    try {
      const currentLang = i18n.language; 
      if (currentLang === lang) return;

      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem('user-language', lang);
      
      const isArabic = lang === 'ar';
      I18nManager.allowRTL(isArabic);
      I18nManager.forceRTL(isArabic);

      const doRestart = async () => {
        try {
          // 1. Try the official way first
          await Updates.reloadAsync();
        } catch (e) {
          // 2. FALLBACK: If Updates fails, use DevSettings (for Expo Go / Dev mode)
          console.log("Updates.reloadAsync failed, trying DevSettings...");
          if (__DEV__) {
            DevSettings.reload(); 
          } else {
            Alert.alert("Manual Restart", "Please close and reopen the app to apply the Arabic layout.");
          }
        }
      };

      Alert.alert(
        t('restart_required'), 
        t('restart_msg'), 
        [{ text: t('restart'), onPress: () => doRestart() }], 
        { cancelable: false }
      );

    } catch (error) {
      console.error("Error changing language:", error);
    }
  };

  const uploadImage = async (uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename as string);
    const type = match ? `image/${match[1]}` : `image`;

    formData.append('avatar', {
      uri,
      name: filename,
      type,
    } as any);

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/profile/avatar/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setUser({ ...user, avatar: data.avatarUrl });
        Alert.alert("Success", "Profile picture updated");
      } else {
        Alert.alert("Error", data.message || "Upload failed");
      }
    } catch (error) {
      console.error("❌ Upload Network Error:", error);
      Alert.alert("Error", "Network error. Try again.");
    } finally {
      setLoading(false);
      setUploadModalVisible(false);
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission", "Permission to access camera is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) await uploadImage(result.assets[0].uri);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission", "Permission to access photo gallery is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) await uploadImage(result.assets[0].uri);
  };

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/profile/${userId}`);
      const data = await response.json();
      if (response.ok) setUser(data);
      else Alert.alert("Error", data.message || "User not found");
    } catch (error) {
      console.error("❌ Network Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUserProfile(); }, [userId]);

  const handleUpdatePassword = async () => {
    const { newPassword, confirmPassword } = passwordData;
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+={}[\]|:;<>,./])[A-Za-z\d@$!%*?&#^()_\-+={}[\]|:;<>,./]{8,}$/;

    if (!passRegex.test(newPassword)) {
      Alert.alert("Weak Password", "Must be 8+ characters with uppercase, lowercase, numbers, and symbols.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (response.ok) {
        Alert.alert("Success", "Password updated successfully");
        setPassModalVisible(false);
        setPasswordData({ newPassword: '', confirmPassword: '' });
      } else {
        Alert.alert("Error", "Could not update password");
      }
    } catch (error) {
      Alert.alert("Error", "Server error");
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('sign_out'), t('confirm_leave'), [
      { text: t('cancel'), style: "cancel" },
      { text: t('sign_out'), style: "destructive", onPress: () => router.replace('/(auth)/login') }
    ]);
  };

  if (loading) return (
    <View className="flex-1 justify-center bg-white">
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );

  return (
    <ScrollView 
    refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }
    className="flex-1 bg-slate-50">
      <View className="pt-16 pb-8 bg-white rounded-b-[50px] shadow-sm border-b border-slate-100">
        <Text className="text-center text-slate-400 font-black uppercase text-[10px] tracking-widest mb-6">{t('your_profile')}</Text>
        <View className="items-center">
          <View className="relative">
            <View className="border-2 border-blue-500/10 rounded-full p-1.5">
              <Image source={{ uri: user?.avatar }} className="w-28 h-28 rounded-full shadow-lg" />
            </View>
            <TouchableOpacity 
              onPress={() => setUploadModalVisible(true)}
              className="absolute bottom-0 right-0 bg-white p-2.5 rounded-full shadow-md border border-slate-100"
            >
              <Ionicons name="camera" size={16} color="#3b82f6" />
            </TouchableOpacity>
          </View>
          <Text className="text-3xl font-black text-slate-900 mt-6 tracking-tighter">{user?.name}</Text>

          <View className="flex-row mt-4 gap-x-4 justify-center w-full">
            <TouchableOpacity 
              onPress={() => changeLanguage('en')}
              className={`px-4 py-2 rounded-full ${i18n.language === 'en' ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <Text className={i18n.language === 'en' ? 'text-white' : 'text-slate-600 font-bold'}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => changeLanguage('ar')}
              className={`px-4 py-2 rounded-full ${i18n.language === 'ar' ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <Text className={i18n.language === 'ar' ? 'text-white' : 'text-slate-600 font-bold'}>العربية</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View className="px-6 mt-8">
        <View className="bg-white rounded-[35px] p-8 shadow-sm border border-slate-100">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">{t('personal_info')}</Text>
          <View className="gap-y-8">
            <View className="flex-row items-center">
              <View className="bg-slate-50 p-3 rounded-2xl mr-4"><Ionicons name="at" size={18} color="#94a3b8" /></View>
              <View>
                <Text className="text-[9px] font-black text-slate-400 uppercase">{t('username')}</Text>
                <Text className="text-slate-900 font-bold text-base">@{user?.username}</Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <View className="bg-slate-50 p-3 rounded-2xl mr-4"><Ionicons name="call" size={18} color="#94a3b8" /></View>
              <View>
                <Text className="text-[9px] font-black text-slate-400 uppercase">{t('phone_number')}</Text>
                <Text className="text-slate-900 font-bold text-base">{user?.phoneNumber}</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => setPassModalVisible(true)} className="bg-white flex-row items-center justify-between p-6 rounded-[30px] border border-slate-100 shadow-sm mt-6">
          <View className="flex-row items-center">
            <View className="bg-blue-50 p-3 rounded-2xl mr-4"><Ionicons name="lock-closed" size={18} color="#3b82f6" /></View>
            <Text className="text-slate-900 font-black text-sm">{t('change_password')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} className="bg-red-50 flex-row items-center justify-between p-6 rounded-[30px] border border-red-100 mt-4 mb-20">
          <View className="flex-row items-center">
            <View className="bg-white p-3 rounded-2xl mr-4 shadow-sm"><Ionicons name="log-out" size={18} color="#ef4444" /></View>
            <Text className="text-red-600 font-black text-sm">{t('sign_out')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={passModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[50px] p-10 border-t border-slate-200">
            <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-8" />
            <Text className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">{t('new_password')}</Text>
            <Text className="text-slate-400 text-xs font-bold mb-10 uppercase tracking-widest">{t('update_security')}</Text>
            <View className="gap-y-5">
              <TextInput placeholder={t('new_password')} secureTextEntry className="bg-slate-50 p-5 rounded-3xl border border-slate-100 font-bold" value={passwordData.newPassword} onChangeText={(v) => setPasswordData({...passwordData, newPassword: v})} />
              <TextInput placeholder={t('repeat_password')} secureTextEntry className="bg-slate-50 p-5 rounded-3xl border border-slate-100 font-bold" value={passwordData.confirmPassword} onChangeText={(v) => setPasswordData({...passwordData, confirmPassword: v})} />
            </View>
            <View className="flex-row mt-12 gap-x-4">
              <TouchableOpacity onPress={() => setPassModalVisible(false)} className="flex-1 h-16 rounded-[24px] justify-center items-center border border-slate-200"><Text className="text-slate-400 font-black text-xs uppercase">{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleUpdatePassword} className="flex-[2] bg-blue-600 h-16 rounded-[24px] justify-center items-center shadow-lg"><Text className="text-white font-black text-xs uppercase tracking-widest">{t('save')}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={uploadModalVisible} animationType="slide" transparent>
        <TouchableOpacity className="flex-1 bg-black/60 justify-end" onPress={() => setUploadModalVisible(false)}>
          <View className="bg-white rounded-t-[40px] p-10 pb-16">
            <Text className="text-2xl font-black text-slate-900 mb-2">{t('change_picture')}</Text>
            <Text className="text-slate-400 text-xs font-bold mb-10 uppercase tracking-widest">{t('select_option')}</Text>
            <View className="flex-row gap-x-4">
              <TouchableOpacity onPress={openCamera} className="flex-1 h-32 rounded-[24px] justify-center items-center bg-slate-50"><Ionicons name="camera" size={32} color="#3b82f6" /><Text className="text-slate-700 font-bold mt-3">{t('camera')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={openGallery} className="flex-1 h-32 rounded-[24px] justify-center items-center bg-slate-50"><Ionicons name="image" size={32} color="#3b82f6" /><Text className="text-slate-700 font-bold mt-3">{t('gallery')}</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}