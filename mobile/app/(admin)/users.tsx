import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, I18nManager, DevSettings, Keyboard, KeyboardEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, BASE_URL } from '../../constants';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import { handleLanguageToggle } from '../../utils/language';
import { useSession } from '../../context/SessionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UserAvatar = ({ item, baseUrl }: { item: any, baseUrl: string }) => {
  const [loading, setLoading] = useState(false); // Default to false
  const [error, setError] = useState(false);
  

  // Re-calculate the URI logic
  const initialUri = item?.avatar?.includes('/uploads/')
    ? `${baseUrl}${item.avatar}`
    : item?.avatar;

  const fallbackUri = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0f172a&color=fbbf24`;

  useEffect(() => {
    // Only show loading if we are actually trying to fetch a real upload
    if (initialUri && initialUri.includes('/uploads/')) {
      setLoading(true);
    } else {
      setLoading(false);
    }
    setError(false);
  }, [item?.avatar]);

  return (
    <View className="w-12 h-12 rounded-full overflow-hidden justify-center items-center bg-slate-100">
      <Image
        key={item?.avatar} 
        source={{ 
          uri: error || !initialUri ? fallbackUri : encodeURI(initialUri) 
        }}
        className="w-12 h-12 rounded-full"
        onLoadStart={() => {
            // Only start spinner if it's not the fallback
            if (!error && initialUri?.includes('/uploads/')) setLoading(true);
        }}
        onLoad={() => setLoading(false)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false); 
        }}
        style={{ backgroundColor: '#f1f5f9' }}
      />
      
      {/* 🛡️ Final Guard: If it's a fallback or we had an error, NEVER show spinner */}
      {loading && !error && !(!initialUri || error) && (
        <ActivityIndicator 
          size="small" 
          color="#94a3b8" 
          style={{ position: 'absolute' }} 
        />
      )}
    </View>
  );
};



export default function PersonnelManagement() {
  const params = useLocalSearchParams();
  const userId = params.userId || "11";
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', username: '', password: '', phoneNumber: '' });
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { confirmSignOut } = useSession();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [connectionError, setConnectionError] = useState(false);
  const CACHE_USERS_KEY = 'cache_users_list';
  const CACHE_USERS_FULL = 'cache_users_full';
  const insets = useSafeAreaInsets();


  const toggleLanguage = () => {
    handleLanguageToggle(i18n, t, userId);
  }

  const onRefresh = useCallback(async () => {
      setRefreshing(true);
      setSearch('');
      await fetchUsers();
      setRefreshing(false);
    }, []);


  const handleCopy = async (text: string, type: 'user' | 'pass') => {
    await Clipboard.setStringAsync(text);
    if (type === 'user') {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000); // Reset after 2 seconds
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };


  const [showPassword, setShowPassword] = useState(false);


  const validateUser = () => {
    const { name, username, password, phoneNumber } = formData;
    
    // 1. Basic Info & Username Regex
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/; // 3-20 chars, alphanumeric + underscore
    
    if (!name.trim()) {
      Alert.alert(t('missing_data'), t('enter_name'));
      return false;
    }
    
    if (!usernameRegex.test(username.trim())) {
      Alert.alert(t('invalid_username'), t('username_rules_msg')); // "3-20 chars, letters, numbers, underscores only"
      return false;
    }

    // 2. Password Check
     if (!isEditing || (isEditing && password.length > 0)) {
      const passRegex = /^[a-zA-Z0-9]{4,8}$/;
      if (!passRegex.test(password)) {
        Alert.alert(t('error'), t('password_rules_msg'));
        return false;
      }
    }

    // 3. Phone Number Check (Strict 05XXXXXXXX)
    const phoneRegex = /^05\d{8}$/; 
    if (!phoneRegex.test(phoneNumber.trim())) {
      Alert.alert(t('invalid_phone'), t('phone_format_msg')); // "Must start with 05 and be 10 digits"
      return false;
    }

    return true;
  };

  const fetchUsers = async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    setConnectionError(false);
    try {
      const res = await fetch(`${API_URL}/admin/users?search=${search}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        await AsyncStorage.setItem(CACHE_USERS_KEY, JSON.stringify(data));

        // Save full unfiltered list when no search active
        if (!search) {
          await AsyncStorage.setItem(CACHE_USERS_FULL, JSON.stringify(data));
        }
      } else {
        throw new Error('Server error');
      }
    } catch (e) {
      const fullCached = await AsyncStorage.getItem(CACHE_USERS_FULL);
      const filteredCached = await AsyncStorage.getItem(CACHE_USERS_KEY);

      if (fullCached) {
        const full = JSON.parse(fullCached);
        const q = search.toLowerCase();
        const filtered = q
          ? full.filter((u: any) =>
              u.name?.toLowerCase().includes(q) ||
              u.username?.toLowerCase().includes(q)
            )
          : full;
        setUsers(filtered);
      } else if (filteredCached) {
        setUsers(JSON.parse(filteredCached));
      } else {
        setUsers([]);
        setConnectionError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [search]);

  useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });
  
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

  

  useFocusEffect(
    useCallback(() => {
      setSearch(''); // Reset search when tab is focused
    }, [])
  );

  const handleSave = async () => {
    if (!validateUser()) return;

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/admin/users/${currentId}` : `${API_URL}/admin/users`;

    const normalizedData = {
      ...formData,
      name: formData.name.trim(),
      username: formData.username.toLowerCase().trim(),
      phoneNumber: formData.phoneNumber.trim()
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedData)
      });
      
      if (res.ok) {
        fetchUsers(true);
        
        if (isEditing) {
          // If editing, close modal immediately
          setIsModalVisible(false);
          Alert.alert(t('success'), t('updated_msg') || 'Updated successfully.');
        } else {
          // If adding, keep modal open and reset fields when they tap OK
          Alert.alert(
            t('success'), 
            t('added_msg') || 'Personnel enrolled successfully.',
            [
              {
                text: t('ok') || 'OK',
                onPress: () => {
                  // Clear the form fields instantly for the next entry
                  setFormData({ name: '', username: '', password: '', phoneNumber: '' });
                }
              }
            ]
          );
        }
      } else {
        const errorData = await res.json();
        Alert.alert(t('system_error'), errorData.message || t('action_failed'));
      }
    } catch (e) { 
      Alert.alert(t('error'), t('connection_error'));
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert(t('revoke_access'), `${t('confirm_user_delete')} ${name}?`, [
      { text: t('cancel') },
      { text: t('delete'), style: "destructive", onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/admin/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
              fetchUsers(true);
            } else {
              Alert.alert(t('error'), t('action_failed'));
            }
          } catch (e) {
            Alert.alert(t('error'), t('connection_error'));
          }
      }}
    ]);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ name: '', username: '', password: '', phoneNumber: '' });
    setShowPassword(false);
    setIsModalVisible(true);
  };


  const handleOpenEdit = (user: any) => {
    setIsEditing(true);
    setCurrentId(user.id);
    setFormData({ name: user.name, username: user.username, password: '', phoneNumber: user.phoneNumber });
    setShowPassword(false);
    setIsModalVisible(true);
  };


  return (
    <View className="flex-1 bg-slate-900">

      {/* --- CONSOLE HEADER --- */}
      <View className="pt-14 px-5 pb-2 bg-slate-900">
        
        {/* ROW 1: Title + Action Controls */}
        <View className="flex-row justify-between items-center mb-2">
          <View>
            <Text className="text-amber-500 text-[9px] font-black uppercase tracking-[3px]">{t('system_admin')}</Text>
            <Text className="text-2xl font-black text-white">{t('personnel')}</Text>
          </View>
          
          <View className="flex-row items-center gap-x-2">
            {/* Language Toggle */}
            <TouchableOpacity
              onPress={toggleLanguage}
              className="flex-row items-center bg-slate-800 px-2.5 py-2 rounded-xl border border-slate-700"
            >
              <Ionicons name="globe-outline" size={16} color="#fbbf24" />
              <Text className="text-white font-black text-[9px] ml-1.5 uppercase">
                {i18n.language === 'ar' ? 'EN' : 'AR'}
              </Text>
            </TouchableOpacity>
            
            {/* Logout */}
            <TouchableOpacity
              onPress={confirmSignOut}
              className="p-2 bg-red-500/10 rounded-xl border border-red-500/20"
            >
              <Ionicons name="log-out-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ROW 2: Add Personnel Button + Dynamic User Count */}
        <View className="flex-row justify-between items-center bg-slate-800/40 p-1 rounded-xl border-l-4 border-amber-500 mb-2">
          {/* Add Personnel Button */}
          <TouchableOpacity
            onPress={handleOpenAdd}
            className="flex-row items-center bg-amber-500 px-2.5 py-1 rounded-lg gap-x-1"
          >
            <Ionicons name="person-add" size={11} color="#0f172a" />
            <Text className="text-slate-900 font-black text-[9px] uppercase">{t('add_personnel')}</Text>
          </TouchableOpacity>

          {/* Active List Counter */}
          <View className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            <Text className="text-amber-500 font-black text-[9px] uppercase tracking-wider">
              {t('number_of_users')}: {users.length}
            </Text>
          </View>
        </View>

        {/* ROW 3: Micro Search Bar (Locked height & center text layout alignment) */}
        <View className="flex-row items-center bg-slate-800 rounded-2xl px-4 h-12 border border-slate-700">
          <Ionicons name="search" size={18} color="#64748b" />
          <TextInput
            placeholder={t('search_dot')}
            placeholderTextColor="#475569"
            style={{ includeFontPadding: false, textAlignVertical: 'center' }}
            className="flex-1 ml-3 text-white font-bold"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- STAFF DATA TERMINAL --- */}
      <View className="flex-1 bg-slate-50 rounded-t-[36px] shadow-2xl border-t border-slate-200">
        <View className="px-8 py-6">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">{t('active_personnel')}</Text>
        </View>
        
        
        <FlatList
          data={users}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
          }
          renderItem={({ item, index }: any) => (
            <View className="ml-3 mr-6 mb-3 flex-row items-center">
              <Text className="text-[10px] font-black text-slate-400 w-5 text-right mr-2">{index + 1}</Text>
              <TouchableOpacity 
                onPress={() => { setSelectedUser(item); setViewModalVisible(true); }}
                activeOpacity={0.7}
                className="flex-1 p-4 bg-white rounded-[28px] border border-slate-100 shadow-sm flex-row justify-between items-center"
              >
              <View className="flex-row items-center flex-1 mr-4">
                <View className="border-2 border-slate-100 rounded-full p-0.5">
                  {/* Use the new component here */}
                  <UserAvatar item={item} baseUrl={BASE_URL} />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-black text-slate-900 leading-5">{item.name}</Text>
                  <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">
                    {item.username}
                  </Text>
                </View>
              </View>

                {/* ACTION BUTTONS (Pencil and Trash) */}
                <View className="flex-row space-x-1">
                  <TouchableOpacity onPress={() => handleOpenEdit(item)} className="p-2.5 bg-slate-900 rounded-xl shadow-lg">
                    <Ionicons name="pencil" size={14} color="#fbbf24" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                    <Ionicons name="trash" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <View className="items-center mt-20">
                <ActivityIndicator size="large" color="#0f172a" />
                <Text className="text-slate-400 font-black mt-4 uppercase text-[10px]">{t('accessing_db')}</Text>
              </View>
            ) : connectionError ? (
              <View className="items-center mt-20 px-10">
                <Ionicons name="cloud-offline-outline" size={40} color="#cbd5e1" />
                <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                  {t('connection_error')}
                </Text>
                <Text className="text-slate-300 font-bold text-center mt-2 text-[10px]">
                  {t('pull_to_retry')}
                </Text>
              </View>
            ) : (
              <View className="items-center mt-20 px-10">
                <Ionicons 
                  name={search.length > 0 ? "search-outline" : "person-remove-outline"}
                  size={40} 
                  color="#cbd5e1" />
                <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                  {search.length > 0
                  ? `${t('no_personnel_matching')} "${search}"`
                  : t('no_personnel_enrolled')}
                </Text>
              </View>
            )
          }
        />

        {/* --- NEW SPLIT-PANE DETAIL BOX --- */}
         <Modal visible={viewModalVisible} transparent animationType="fade" onRequestClose={() => setViewModalVisible(false)}>
          <TouchableOpacity className="flex-1 justify-center items-center bg-black/80 px-4" activeOpacity={1} onPress={() => setViewModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} className="bg-white w-full rounded-[40px] overflow-hidden shadow-2xl">
              
              <View className="flex-row min-h-[220px]">
                {/* LEFT SIDE: Identity & Phone */}
                <View className="flex-1 justify-center items-center p-4 bg-slate-50/80">
                  <UserAvatar item={selectedUser} baseUrl={BASE_URL} />
                  <Text className="text-lg font-black text-slate-900 text-center leading-5">{selectedUser?.name}</Text>
                  <Text className="text-[10px] font-bold text-slate-500 mt-2">{selectedUser?.phoneNumber}</Text>
                </View>

                {/* SEPARATOR LINE */}
                <View className="w-[1px] bg-slate-200 my-10" />

                {/* RIGHT SIDE: Copyable Credentials */}
                <View className="flex-[1.5] justify-center p-6">
                  
                  {/* Username Row */}
                  <View className="mb-6">
                    <Text className="text-[9px] font-black text-slate-400 uppercase mb-2">{t('username')}</Text>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-900 font-bold text-sm">@{selectedUser?.username}</Text>
                      <TouchableOpacity 
                        onPress={() => handleCopy(selectedUser?.username, 'user')}
                        className={`flex-row items-center px-2 py-1 rounded-lg ${copiedUser ? 'bg-green-100' : 'bg-slate-100'}`}
                      >
                        <Text className={`text-[9px] font-black mr-1 ${copiedUser ? 'text-green-600' : 'text-slate-400'}`}>
                          {copiedUser ? t('copied') : t('copy')}
                        </Text>
                        <Ionicons name={copiedUser ? "checkmark-circle" : "copy-outline"} size={14} color={copiedUser ? "#16a34a" : "#94a3b8"} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Password Row (Real Password) */}
                  <View>
                    <Text className="text-[9px] font-black text-slate-400 uppercase mb-2">{t('password')}</Text>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-900 font-bold text-sm" numberOfLines={1}>{selectedUser?.password}</Text>
                      <TouchableOpacity 
                        onPress={() => handleCopy(selectedUser?.password, 'pass')}
                        className={`flex-row items-center px-2 py-1 rounded-lg ${copiedPass ? 'bg-green-100' : 'bg-slate-100'}`}
                      >
                        <Text className={`text-[9px] font-black mr-1 ${copiedPass ? 'text-green-600' : 'text-slate-400'}`}>
                          {copiedPass ? t('copied') : t('copy')}
                        </Text>
                        <Ionicons name={copiedPass ? "checkmark-circle" : "copy-outline"} size={14} color={copiedPass ? "#16a34a" : "#94a3b8"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bottom Close Button */}
              <TouchableOpacity onPress={() => setViewModalVisible(false)} className="bg-slate-900 h-14 justify-center items-center">
                <Text className="text-white font-black text-xs uppercase tracking-widest">{t('close_console')}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>

      {/* --- ADD / EDIT USER MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <View className="flex-1 justify-end bg-black/60">
            <View 
              className="bg-slate-900 rounded-t-[45px] p-8 border-t-2 border-amber-500/30"
              style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 32 + insets.bottom }}
            >
              <View className="w-12 h-1 bg-slate-700 rounded-full self-center mb-6" />
              
              <Text className="text-amber-500 font-black text-[10px] uppercase tracking-[3px] mb-2">
                {isEditing ? t('access_level_edit') : t('access_level_create')}
              </Text>
              <Text className="text-3xl font-black text-white mb-8 tracking-tighter">
                {isEditing ? t('modify_profile') : t('new_user_enrollment')}
              </Text>

              <View className="gap-y-4">
                {/* Full Name */}
                <View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('full_name')}</Text>
                  <TextInput 
                    placeholder={t('enter_name')} placeholderTextColor="#475569" 
                    value={formData.name} onChangeText={(t) => setFormData({...formData, name: t})}
                    className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" 
                  />
                </View>

                {/* Username */}
                <View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('username')}</Text>
                  <View className="flex-row items-center bg-slate-800 rounded-2xl border border-slate-700 pr-2">
                    <TextInput 
                      placeholder={t('enter_unique_username')} placeholderTextColor="#475569" 
                      autoCapitalize="none" value={formData.username}
                      onChangeText={(t) => setFormData({...formData, username: t})}
                      className="flex-1 text-white p-4 font-bold" 
                    />
                  </View>
                </View>

                {/* Password + Eye + Shuffle */}
                <View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('password')}</Text>
                   <View className="flex-row items-center bg-slate-800 rounded-2xl border border-slate-700 pr-2">
                    <TextInput 
                      placeholder="••••••••" placeholderTextColor="#475569" 
                      secureTextEntry={!showPassword} value={formData.password}
                      onChangeText={(t) => setFormData({...formData, password: t})}
                      className="flex-1 text-white p-4 font-bold" 
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                      <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Phone Number */}
                <View>
                  <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('phone_number')}</Text>
                  <View className="flex-row items-center bg-slate-800 rounded-2xl border border-slate-700 pr-2">
                    <TextInput 
                      keyboardType="numeric" 
                      maxLength={10}
                      placeholder="05********" placeholderTextColor="#475569" 
                      value={formData.phoneNumber} 
                      onChangeText={(t) => {
                        const cleaned = t.replace(/[^0-9]/g, '');
                        setFormData({...formData, phoneNumber: cleaned});
                      }}
                      className="flex-1 text-white p-4 font-bold" 
                    />
                  </View>
                </View>
              </View>

              <View className="flex-row mt-10 gap-x-3">

                {/* DISCARD BUTTON */}
                <TouchableOpacity 
                  onPress={() => setIsModalVisible(false)} 
                  className="flex-1 flex-1 bg-slate-800 h-16 rounded-[24px] justify-center items-center"
                >
                  <Text className="text-slate-400 font-black text-xs uppercase flex-shrink: 0">{t('discard')}</Text>
                </TouchableOpacity>
                

                {/* CONFIRM BUTTON */}
                <TouchableOpacity 
                  onPress={handleSave} 
                  className="flex-[2] bg-amber-500 h-16 rounded-[24px] justify-center items-center shadow-lg shadow-amber-500/20"
                >
                  <Text className="text-slate-900 font-black text-xs tracking-widest uppercase">
                    {isEditing ? t('apply_changes') : t('confirm_enrollment')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
    </View>
  );
}