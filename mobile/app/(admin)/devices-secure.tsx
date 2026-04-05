import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, I18nManager, DevSettings } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import * as Updates from 'expo-updates';

type DeviceStatus = 'PENDING' | 'ACTIVE' | 'DENIED';

export default function DeviceSecureManagement() {
  const { t } = useTranslation();
  
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<DeviceStatus>('PENDING');
  const [now, setNow] = useState(new Date());

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

  // --- 1. ACCESS CONTROL ---
  useEffect(() => {
    const checkAccess = async () => {
      const savedId = await AsyncStorage.getItem('userId');
      if (savedId === "1") {
        setHasAccess(true);
        fetchDevices();
      } else {
        setHasAccess(false);
        setLoading(false);
      }
    };
    checkAccess();
  }, []);

  // --- 2. LIVE TIMER ENGINE ---
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- 3. DATA FETCHING ---
  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_URL}/security/devices?status=${activeTab}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setDevices(data);
    } catch (e) {
      Alert.alert(t('connection_error'), t('db_reach_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      setLoading(true);
      fetchDevices();
    }
  }, [activeTab]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDevices();
  }, [activeTab]);

  // --- 4. DATA GROUPING LOGIC ---
  // This converts the flat list into: [{ user: {name, username}, devices: [...] }]
  const groupedUsers = useMemo(() => {
    const groups: { [key: number]: any } = {};
    
    devices.forEach((device) => {
      const userId = device.userId;

      if (userId === 1) return;

      if (!groups[userId]) {
        groups[userId] = {
          user: device.user,
          deviceList: [],
        };
      }
      groups[userId].deviceList.push(device);
    });

    return Object.values(groups);
  }, [devices]);

  // --- 5. ACTIONS ---
  const handleUpdateStatus = (id: number, newStatus: DeviceStatus, name: string) => {
    const alertMsg = newStatus === 'DENIED' ? t('confirm_block') : t('confirm_authorize');
    
    Alert.alert(t('security_action'), `${alertMsg} ${name}?`, [
      { text: t('cancel'), style: 'cancel' },
      { 
        text: t('confirm'), 
        onPress: async () => {
          setLoading(true);
          try {
            const res = await fetch(`${API_URL}/security/devices/${id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) fetchDevices();
          } catch (e) {
            Alert.alert(t('error'), t('action_failed'));
            setLoading(false);
          }
        }
      }
    ]);
  };

  // --- 6. UTILS ---
  const getExpiryText = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - now.getTime();
    if (diff <= 0) return t('expired');
    const mins = Math.floor(diff / 1000 / 60);
    const secs = Math.floor((diff / 1000) % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!hasAccess && !loading) {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center px-10">
        <Ionicons name="lock-closed" size={80} color="#ef4444" />
        <Text className="text-red-500 text-2xl font-black text-center mt-6 uppercase">{t('access_denied')}</Text>
        <Text className="text-slate-400 text-center mt-2 font-bold">Root ID "1" Required for Security Console.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      {/* HEADER */}
      <View className="pt-14 px-6 pb-6 bg-slate-900">
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
                <Text className="text-3xl font-black text-white mb-6">{t('device_control')}</Text>
                </View>
        </View>
        <View className="flex-row bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
          {(['PENDING', 'ACTIVE', 'DENIED'] as const).map((tab) => (
            <TouchableOpacity 
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl items-center ${activeTab === tab ? 'bg-amber-500' : ''}`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab ? 'text-slate-900' : 'text-slate-400'}`}>
                {t(tab.toLowerCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* BODY */}
      <View className="flex-1 bg-slate-50 rounded-t-[45px]">
        <View className="px-8 py-6 flex-row justify-between items-center">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">
            {activeTab === 'PENDING' ? t('awaiting_codes') : activeTab === 'ACTIVE' ? t('authorized_hardware') : t('blacklisted')}
          </Text>
          <View className="bg-slate-200 px-3 py-1 rounded-full">
            <Text className="text-[10px] font-black text-slate-600">
              {groupedUsers.reduce((acc, curr) => acc + curr.deviceList.length, 0)} {t('total')}
            </Text>
          </View>
        </View>

        <FlatList
          data={groupedUsers}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#fbbf24']} />}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          ListEmptyComponent={
            loading ? (
                <ActivityIndicator size="large" color="#fbbf24" className="mt-20" />
            ) : (
                <View className="items-center mt-20 px-10">
                    <Ionicons name="shield-outline" size={50} color="#cbd5e1" />
                    <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                        {t('no_devices_found')}
                    </Text>
                </View>
            )
          }
          renderItem={({ item: userGroup }) => (
            <View className="mb-8">
              {/* --- USER HEADING --- */}
              <View className="px-8 mb-4 flex-row items-center">
                <View className="w-1 h-8 bg-amber-500 rounded-full mr-4" />
                <View>
                  <Text className="text-lg font-black text-slate-900 leading-tight">{userGroup.user.name}</Text>
                  <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">@{userGroup.user.username}</Text>
                </View>
              </View>

              {/* --- USER'S DEVICES --- */}
              {userGroup.deviceList.map((device: any) => {
                const codeInfo = userGroup.user.validationCode;
                const expired = codeInfo ? new Date() > new Date(codeInfo.expiresAt) : true;

                return (
                  <View key={device.id} className="mx-6 mb-3 bg-white rounded-[28px] border border-slate-100 shadow-sm p-5 flex-row items-center">
                    <View className="w-12 h-12 rounded-2xl bg-slate-50 items-center justify-center">
                      <Ionicons 
                        name={activeTab === 'DENIED' ? "ban-outline" : "phone-portrait-outline"} 
                        size={20} 
                        color={activeTab === 'DENIED' ? "#ef4444" : "#64748b"} 
                      />
                    </View>

                    {/* DEVICE INFO - UPDATED DESIGN */}
                    <View className="flex-1 ml-4">
                        {/* 1. The Device Nickname (e.g., Ahmad's iPhone) */}
                        <Text className="text-slate-900 font-black text-[15px] tracking-tight">
                        {device.deviceName || 'Personal Device'}
                        </Text>
                        
                        {/* 2. The Brand & Model Tag Row */}
                        <View className="flex-row items-center mt-1">
                        <View className="bg-slate-100 px-2 py-0.5 rounded-md mr-2">
                            <Text className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                            {device.brand}
                            </Text>
                        </View>
                        <Text className="text-[11px] text-slate-400 font-bold">
                            {device.deviceModel}
                        </Text>
                        </View>
                    </View>

                    {/* --- PENDING / TIMER SECTION --- */}
                    {activeTab === 'PENDING' && codeInfo && (
                      <View className="flex-row items-center gap-x-3">
                         <View className={`px-4 py-2 rounded-2xl ${expired ? 'bg-red-500' : 'bg-slate-900'}`}>
                            <Text className="text-[8px] text-white/50 font-black uppercase text-center mb-0.5">{t('code')}</Text>
                            <Text className="text-lg font-black text-white text-center leading-none">{codeInfo.code}</Text>
                         </View>
                         
                         <View className="items-center min-w-[45px]">
                            <Ionicons name={expired ? "alert-circle" : "time"} size={14} color={expired ? "#ef4444" : "#f59e0b"} />
                            <Text className={`text-[10px] font-black mt-0.5 ${expired ? 'text-red-500' : 'text-amber-600'}`}>
                              {getExpiryText(codeInfo.expiresAt)}
                            </Text>
                         </View>
                      </View>
                    )}

                    {/* --- ACTION BUTTONS --- */}
                    {(activeTab === 'ACTIVE' || activeTab === 'DENIED') && (
                      <TouchableOpacity 
                        onPress={() => handleUpdateStatus(device.id, activeTab === 'ACTIVE' ? 'DENIED' : 'ACTIVE', userGroup.user.name)}
                        className={`p-3 rounded-2xl ${activeTab === 'ACTIVE' ? 'bg-red-50' : 'bg-green-50'}`}
                      >
                        <Ionicons 
                          name={activeTab === 'ACTIVE' ? "remove-circle-outline" : "checkmark-circle-outline"} 
                          size={24} 
                          color={activeTab === 'ACTIVE' ? "#ef4444" : "#22c55e"} 
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        />
      </View>
    </View>
  );
}