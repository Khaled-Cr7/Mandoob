import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

export default function PersonnelManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
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


  const onRefresh = useCallback(async () => {
      setRefreshing(true);
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

  const generateRandomPassword = () => {
    const sets = {
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      lower: "abcdefghijklmnopqrstuvwxyz",
      nums: "0123456789",
      special: "!@#$%^&*"
    };

    // 1. Force at least one of each required type immediately
    let password = "";
    password += sets.upper[Math.floor(Math.random() * sets.upper.length)];
    password += sets.lower[Math.floor(Math.random() * sets.lower.length)];
    password += sets.nums[Math.floor(Math.random() * sets.nums.length)];
    password += sets.special[Math.floor(Math.random() * sets.special.length)];

    // 2. Fill the remaining 6 characters with anything from the full pool
    const allChars = sets.upper + sets.lower + sets.nums + sets.special;
    for (let i = 0; i < 6; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // 3. Shuffle the string so the required chars aren't always at the start
    const shuffledPassword = password.split('').sort(() => 0.5 - Math.random()).join('');

    setFormData({ ...formData, password: shuffledPassword });
  };

  const validateUser = () => {
    const { name, username, password, phoneNumber } = formData;
    
    // 1. Basic Info Check
    if (!name.trim() || !username.trim()) {
      Alert.alert(t('missing_data'), t('enter_name'));
      return false;
    }

    // 2. Password Check (Only on Add or if changing during Edit)
    if (!isEditing || (isEditing && password.length > 0)) {
      const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+={}[\]|:;<>,./])[A-Za-z\d@$!%*?&#^()_\-+={}[\]|:;<>,./]{8,}$/;
      if (!passRegex.test(password)) {
        Alert.alert(t('weak_password'), t('weak_password_msg'));
        return false;
      }
    }

    // 3. Phone Number Check
    if (!phoneNumber) {
      Alert.alert(t('required'), t('enter_phone'));
      return false;
    }

    const isNumeric = /^\d+$/.test(phoneNumber);

    if (!isNumeric) {
      Alert.alert(t('invalid_input'), t('digits_only'));
      return false;
    }

    // Check Length (10 digits)
    if (phoneNumber.length !== 10) {
      Alert.alert(t('invalid_length'), t('ten_digits_only'));
      return false;
    }

    // Check Prefix (Starts with 05)
    if (!phoneNumber.startsWith("05")) {
      Alert.alert(t('invalid_format'), t('start_with_05'));
      return false;
    }

    // If we reach here, everything is perfect
    return true;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/users?search=${search}`);
      const data = await response.json();
      setUsers(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [search]);
  

  useFocusEffect(
    useCallback(() => {
      setSearch(''); // Reset search when tab is focused
    }, [])
  );

  const handleSave = async () => {
    if (!validateUser()) return;

    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/admin/users/${currentId}` : `${API_URL}/admin/users`;

    // Create a copy of the data and lowercase the username
    const normalizedData = {
      ...formData,
      username: formData.username.toLowerCase().trim()
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedData) // Send normalizedData instead of formData
      });
      
      if (res.ok) {
        setIsModalVisible(false);
        fetchUsers();
      } else {
        const errorData = await res.json();
        Alert.alert(t('system_error'), errorData.message || t('action_failed'));
      }
    } catch (e) { 
      Alert.alert(t('connection_error'), t('db_reach_error'));
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert(t('revoke_access'), `${t('confirm_user_delete')} ${name}?`, [
      { text: t('cancel') },
      { text: t('delete'), style: "destructive", onPress: async () => {
          await fetch(`${API_URL}/admin/users/${id}`, { method: 'DELETE' });
          fetchUsers();
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
      <View className="pt-14 px-6 pb-8 bg-slate-900">
        <Text className="text-amber-500 text-[10px] font-black uppercase tracking-[3px]">{t('system_admin')}</Text>
        <Text className="text-3xl font-black text-white tracking-tighter mb-6">{t('personnel')}</Text>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-800 rounded-2xl px-4 h-14 mb-6 border border-slate-700 shadow-inner">
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

      {/* --- STAFF DATA TERMINAL --- */}
      <View className="flex-1 bg-slate-50 rounded-t-[45px] shadow-2xl border-t border-slate-200">
        <View className="px-8 py-6">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">{t('active_personnel')}</Text>
        </View>
        
        
        <FlatList
          data={users}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
          }
          renderItem={({ item }: any) => (
            // WRAP IN TOUCHABLE TO OPEN VIEW BOX
            <TouchableOpacity 
              onPress={() => { setSelectedUser(item); setViewModalVisible(true); }}
              activeOpacity={0.7}
              className="mx-6 mb-3 p-4 bg-white rounded-[28px] border border-slate-100 shadow-sm flex-row justify-between items-center"
            >
              <View className="flex-row items-center flex-1 mr-4">
                <View className="border-2 border-slate-100 rounded-full p-0.5">
                  <Image source={{ uri: item.avatar }} className="w-12 h-12 rounded-full" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-black text-slate-900 leading-5" style={{ flexShrink: 1 }}>{item.name}</Text>
                  <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{item.username}</Text>
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
          )}
          ListEmptyComponent={
            loading ? (
              <View className="items-center mt-20">
                <ActivityIndicator size="large" color="#0f172a" />
                <Text className="text-slate-400 font-black mt-4 uppercase text-[10px]">{t('accessing_db')}</Text>
              </View>
            ) : (
              <View className="items-center mt-20 px-10">
                <Ionicons name="person-remove-outline" size={40} color="#cbd5e1" />
                <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                  {t('no_personnel_matching')} "{search}"
                </Text>
              </View>
            )
          }
        />

        {/* --- NEW SPLIT-PANE DETAIL BOX --- */}
        <Modal visible={viewModalVisible} transparent animationType="fade">
          <View className="flex-1 justify-center items-center bg-black/80 px-4">
            <View className="bg-white w-full rounded-[40px] overflow-hidden shadow-2xl">
              
              <View className="flex-row min-h-[220px]">
                {/* LEFT SIDE: Identity & Phone */}
                <View className="flex-1 justify-center items-center p-4 bg-slate-50/80">
                  <Image source={{ uri: selectedUser?.avatar }} className="w-20 h-20 rounded-full border-4 border-white mb-3" />
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
            </View>
          </View>
        </Modal>

        {/* --- ADD NEW USER BUTTON --- */}
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity 
            onPress={handleOpenAdd}
            className="bg-slate-900 h-16 rounded-[24px] flex-row justify-center items-center shadow-2xl border-t border-slate-800"
          >
            <View className="bg-amber-500 rounded-full p-1 mr-3">
              <Ionicons name="person-add" size={18} color="#0f172a" />
            </View>
            <Text 
            numberOfLines={1} 
            adjustsFontSizeToFit 
            minimumFontScale={0.8}              
            className="text-white font-black text-base tracking-tight uppercase">{t('add_personnel')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- ADD / EDIT USER MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/60">
            <View className="bg-slate-900 rounded-t-[45px] p-8 border-t-2 border-amber-500/30">
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
                    <TouchableOpacity onPress={generateRandomPassword} className="p-2 bg-slate-700 rounded-xl">
                      <Ionicons name="shuffle" size={16} color="#fbbf24"/>
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
          </KeyboardAvoidingView>
        </Modal>
    </View>
  );
}