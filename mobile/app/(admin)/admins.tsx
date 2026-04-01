import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, RefreshControl, I18nManager, DevSettings } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import * as Updates from 'expo-updates';

export default function AdminManagement() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const userId = params.userId || "11";

  const [hasAccess, setHasAccess] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', username: '', password: '', phoneNumber: '' });
  
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    try {
      await i18n.changeLanguage(newLang);
      await AsyncStorage.setItem('user-language', newLang);
      
      const isArabic = newLang === 'ar';
      I18nManager.allowRTL(isArabic);
      I18nManager.forceRTL(isArabic);

      const doRestart = async () => {
        try {
          await Updates.reloadAsync();
        } catch (e) {
          if (__DEV__) DevSettings.reload();
          else Alert.alert("Manual Restart", "Please reopen the app to apply the layout.");
        }
      };

      Alert.alert(
        t('restart_required'), 
        t('restart_msg'), 
        [{ text: t('restart'), onPress: () => doRestart() }], 
        { cancelable: false }
      );
    } catch (error) {
      console.error("Language Error:", error);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('sign_out'), t('confirm_leave'), [
      { text: t('cancel'), style: "cancel" },
      { 
        text: t('sign_out'), 
        style: "destructive", 
        onPress: async () => {
          await AsyncStorage.removeItem('userId'); // Clear the session!
          router.replace('/(auth)/login'); 
        } 
      }
    ]);
  };



  // --- ACCESS CONTROL ---
  useEffect(() => {
  const verifyAccess = async () => {
    const savedId = await AsyncStorage.getItem('userId');
    console.log("LOGGED IN ID:", savedId); // Debugging check

    if (savedId === "1") {
      setHasAccess(true);
      fetchAdmins();
    } else {
      setHasAccess(false);
    }
  };

  verifyAccess();
}, []);

  // --- FETCH LOGIC ---
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/users?search=${search}&role=ADMIN`);
      const data = await response.json();
      setAdmins(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAdmins();
    setRefreshing(false);
  }, [search]);

  useEffect(() => {
    if (hasAccess) fetchAdmins();
  }, [search]);

  // --- VALIDATION ENGINE ---
  const validateAdminData = () => {
  const { name, username, password, phoneNumber } = formData;

  if (!name.trim()) {
    Alert.alert(t('missing_data'), t('enter_name')); // "Please enter a Name"
    return false;
  }
  if (!username.trim()) {
    Alert.alert(t('missing_data'), t('enter_unique_username')); // "Please enter a Username"
    return false;
  }
  if (!isEditing || (isEditing && password.length > 0)) {
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+={}[\]|:;<>,./])[A-Za-z\d@$!%*?&#^()_\-+={}[\]|:;<>,./]{8,}$/;
    if (!passRegex.test(password)) {
      Alert.alert(t('weak_password'), t('weak_password_msg'));
      return false;
    }
  }
  // --- Smart Phone Validation ---
  if (!phoneNumber) {
    Alert.alert(t('required'), t('enter_phone'));
    return false;
  }
  if (phoneNumber.length !== 10) {
    Alert.alert(t('invalid_length'), t('ten_digits_only')); // New specific error
    return false;
  }
  if (!phoneNumber.startsWith("05")) {
    Alert.alert(t('invalid_format'), t('start_with_05'));
    return false;
  }
  return true;
};

  // --- HANDLERS ---
  const handleSave = async () => {
    if (!validateAdminData()) return;

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/admin/users/${currentId}` : `${API_URL}/admin/users`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            ...formData, 
            role: 'ADMIN', 
            username: formData.username.toLowerCase().trim() 
        })
        });

        // Move the json parsing inside the check to be safe
        if (res.ok) {
            const result = await res.json();
            setIsModalVisible(false);
            fetchAdmins();
        } else {
            const result = await res.json(); // Only parse if we know there is a body
            const serverMessage = result.message || t('action_failed');
            Alert.alert(t('system_error'), serverMessage);
        }
    } catch (e) {
      Alert.alert(t('connection_error'), t('db_reach_error'));
    }
  };

  const handleCopy = async (text: string, type: 'user' | 'pass') => {
    await Clipboard.setStringAsync(text);
    if (type === 'user') {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const generateRandomPassword = () => {
    const sets = {
      upper: "ABCDEFGH", lower: "abcdefgh", nums: "123456", special: "!@#$"
    };
    let password = sets.upper[Math.floor(Math.random() * 8)] + 
                   sets.lower[Math.floor(Math.random() * 8)] + 
                   sets.nums[Math.floor(Math.random() * 6)] + 
                   sets.special[Math.floor(Math.random() * 4)];
    const all = "ABCDEFGHabcdefgh1234567890!@#$%^&*";
    for(let i=0; i<6; i++) password += all[Math.floor(Math.random() * all.length)];
    setFormData({ ...formData, password: password.split('').sort(()=>0.5-Math.random()).join('') });
  };

  if (!hasAccess) {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center px-10">
        <Ionicons name="lock-closed" size={80} color="#ef4444" />
        <Text className="text-red-500 text-2xl font-black text-center mt-6 uppercase">{t('access_denied')}</Text>
        <Text className="text-slate-400 text-center mt-2 font-bold">Root ID "1" Required.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      <View className="pt-14 px-6 pb-8 bg-slate-900">
        <View className="absolute top-14 right-6 flex-row items-center space-x-3 gap-x-1.5">
          {/* Language Toggle */}
          <TouchableOpacity 
            onPress={toggleLanguage}
            className="flex-row items-center bg-slate-800 px-3 py-2 rounded-xl border border-slate-700"
          >
            <Ionicons name="globe-outline" size={18} color="#fbbf24" />
            <Text className="text-white font-black text-[10px] ml-2 uppercase">
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </Text>
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity 
            onPress={handleSignOut}
            className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20"
          >
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-amber-500 text-[10px] font-black uppercase tracking-[3px]">{t('special_admin')}</Text>
            <Text className="text-3xl font-black text-white mb-6">{t('admin_management')}</Text>
          </View>
        </View>
        <View className="flex-row items-center bg-slate-800 rounded-2xl px-4 h-14 border border-slate-700">
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput 
            placeholder={t('search_dot')} 
            placeholderTextColor="#475569"
            className="flex-1 ml-3 text-white font-bold"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="flex-1 bg-slate-50 rounded-t-[45px] shadow-2xl">
        <View className="px-8 py-6">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">{t('active_admins')}</Text>
        </View>

        <FlatList
          data={admins}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#fbbf24']} />}
          renderItem={({ item }: any) => (
            <TouchableOpacity 
              onPress={() => { setSelectedAdmin(item); setViewModalVisible(true); }}
              className="mx-6 mb-3 p-5 bg-white rounded-[28px] border border-slate-100 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className="text-lg font-black text-slate-900 leading-5">{item.name}</Text>
                <Text className="text-[10px] text-slate-400 font-bold uppercase mt-1">@{item.username}</Text>
              </View>
              <View className="flex-row space-x-1">
                <TouchableOpacity onPress={() => {
                   setIsEditing(true); setCurrentId(item.id);
                   setFormData({ name: item.name, username: item.username, password: '', phoneNumber: item.phoneNumber });
                   setIsModalVisible(true);
                }} className="p-2.5 bg-slate-900 rounded-xl"><Ionicons name="pencil" size={14} color="#fbbf24" /></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                   Alert.alert(t('revoke_access'), `${t('confirm_user_delete')} ${item.name}?`, [
                     { text: t('cancel') },
                     { text: t('delete'), style: "destructive", onPress: async () => {
                         await fetch(`${API_URL}/admin/users/${item.id}`, { method: 'DELETE' });
                         fetchAdmins();
                     }}
                   ]);
                }} className="p-2.5 bg-red-50 rounded-xl border border-red-100"><Ionicons name="trash" size={14} color="#ef4444" /></TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            loading ? (
                <ActivityIndicator size="large" color="#0f172a" className="mt-20" />
            ) : (
                <View className="items-center mt-20 px-10">
                <Ionicons 
                    name={search.length > 0 ? "search-outline" : "shield-outline"} 
                    size={40} 
                    color="#cbd5e1" 
                />
                <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                    {search.length > 0 
                    ? `${t('no_admin_matching')} "${search}"` 
                    : t('no_admins_enrolled') || "No Admins in Database"}
                </Text>
                </View>
            )
          }
        />

        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity 
            onPress={() => { setIsEditing(false); setFormData({name:'', username:'', password:'', phoneNumber:''}); setIsModalVisible(true); }}
            className="bg-slate-900 h-16 rounded-[24px] flex-row justify-center items-center shadow-2xl"
          >
            <View className="bg-amber-500 rounded-full p-1 mr-3"><Ionicons name="shield-checkmark" size={18} color="#0f172a" /></View>
            <Text className="text-white font-black text-base uppercase">{t('add_admin')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- DETAIL MODAL --- */}
      <Modal visible={viewModalVisible} transparent animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/80 px-4">
            <View className="bg-white w-full rounded-[40px] overflow-hidden shadow-2xl">
              <View className="p-8 items-center bg-slate-50 border-b border-slate-100">
                  <Ionicons name="shield-half" size={60} color="#fbbf24" />
                  <Text className="text-xl font-black text-slate-900 mt-4">{selectedAdmin?.name}</Text>
                  <Text className="text-slate-500 font-bold">{selectedAdmin?.phoneNumber}</Text>
              </View>
              <View className="p-8">
                  <View className="mb-6">
                    <Text className="text-[9px] font-black text-slate-400 uppercase mb-2">{t('username')}</Text>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-900 font-bold text-sm">@{selectedAdmin?.username}</Text>
                      <TouchableOpacity onPress={() => handleCopy(selectedAdmin?.username, 'user')} className={`flex-row items-center px-2 py-1 rounded-lg ${copiedUser ? 'bg-green-100' : 'bg-slate-100'}`}>
                        <Text className={`text-[9px] font-black mr-1 ${copiedUser ? 'text-green-600' : 'text-slate-400'}`}>{copiedUser ? t('copied') : t('copy')}</Text>
                        <Ionicons name={copiedUser ? "checkmark-circle" : "copy-outline"} size={14} color={copiedUser ? "#16a34a" : "#94a3b8"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View>
                    <Text className="text-[9px] font-black text-slate-400 uppercase mb-2">{t('password')}</Text>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-900 font-bold text-sm">{selectedAdmin?.password}</Text>
                      <TouchableOpacity onPress={() => handleCopy(selectedAdmin?.password, 'pass')} className={`flex-row items-center px-2 py-1 rounded-lg ${copiedPass ? 'bg-green-100' : 'bg-slate-100'}`}>
                        <Text className={`text-[9px] font-black mr-1 ${copiedPass ? 'text-green-600' : 'text-slate-400'}`}>{copiedPass ? t('copied') : t('copy')}</Text>
                        <Ionicons name={copiedPass ? "checkmark-circle" : "copy-outline"} size={14} color={copiedPass ? "#16a34a" : "#94a3b8"} />
                      </TouchableOpacity>
                    </View>
                  </View>
              </View>
              <TouchableOpacity onPress={() => setViewModalVisible(false)} className="bg-slate-900 h-14 justify-center items-center">
                <Text className="text-white font-black text-xs uppercase tracking-widest">{t('close_console')}</Text>
              </TouchableOpacity>
            </View>
          </View>
      </Modal>

      {/* --- FORM MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/60">
            <View className="bg-slate-900 rounded-t-[45px] p-8 border-t-2 border-amber-500/30">
              <View className="w-12 h-1 bg-slate-700 rounded-full self-center mb-6" />
              <Text className="text-amber-500 font-black text-[10px] uppercase tracking-[3px] mb-2">{isEditing ? t('access_level_edit') : t('access_level_create')}</Text>
              <Text className="text-3xl font-black text-white mb-8 tracking-tighter">{isEditing ? t('modify_profile') : t('add_admin')}</Text>
              <View className="gap-y-6">
                <TextInput placeholder={t('full_name')} placeholderTextColor="#475569" value={formData.name} onChangeText={(t)=>setFormData({...formData, name:t})} className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" />
                <TextInput placeholder={t('username')} placeholderTextColor="#475569" value={formData.username} onChangeText={(t)=>setFormData({...formData, username:t})} autoCapitalize="none" className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" />
                <View className="flex-row items-center bg-slate-800 rounded-2xl border border-slate-700 pr-2">
                    <TextInput placeholder={t('password')} placeholderTextColor="#475569" secureTextEntry={!showPassword} value={formData.password} onChangeText={(t)=>setFormData({...formData, password:t})} className="flex-1 text-white p-4 font-bold" />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2"><Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#64748b" /></TouchableOpacity>
                    <TouchableOpacity onPress={generateRandomPassword} className="p-2 bg-slate-700 rounded-xl"><Ionicons name="shuffle" size={16} color="#fbbf24"/></TouchableOpacity>
                </View>
                <TextInput placeholder="05XXXXXXXX" placeholderTextColor="#475569" keyboardType="numeric" maxLength={10} value={formData.phoneNumber} onChangeText={(t)=>setFormData({...formData, phoneNumber:t.replace(/[^0-9]/g, '')})} className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" />
              </View>
              <View className="flex-row mt-10 gap-x-3">
                <TouchableOpacity onPress={() => setIsModalVisible(false)} className="flex-1 bg-slate-800 h-16 rounded-[24px] justify-center items-center"><Text className="text-slate-400 font-black text-xs uppercase">{t('discard')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSave} className="flex-[2] bg-amber-500 h-16 rounded-[24px] justify-center items-center shadow-lg"><Text className="text-slate-900 font-black text-xs tracking-widest uppercase">{isEditing ? t('apply_changes') : t('confirm_enrollment')}</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}