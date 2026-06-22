import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';

interface SystemLog {
  id: number;
  type: 'ADDED' | 'DELETED' | 'PRICE_UPDATE';
  modelName: string;
  oldValue?: string;
  newValue?: string;
  isPublished: boolean;
  userId: number;
  createdAt: string;
  user?: {
    name: string;
  };
}

export default function SystemChangesScreen() {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userId } = useLocalSearchParams();

  const fetchChanges = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/phones/changes?userId=${userId}`);
      const data = await res.json();
      setChanges(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (logId: number) => {
    try {
      const res = await fetch(`${API_URL}/phones/changes/${logId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId) })
      });

      if (res.ok) {
        Alert.alert(t('success'), t('notification_sent'));
        fetchChanges();
      } else {
        Alert.alert(t('error'), t('action_failed'));
      }
    } catch (e) {
      Alert.alert(t('error'), t('connection_error'));
    }
  };

  const handleDeleteLog = (logId: number) => {
    Alert.alert(t('system_delete'), t('delete_log_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/phones/changes/${logId}?userId=${userId}`, {
              method: 'DELETE',
            });
            if (res.ok) fetchChanges();
            else Alert.alert(t('error'), t('action_failed'));
          } catch (e) {
            Alert.alert(t('error'), t('connection_error'));
          }
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchChanges();
    }, [userId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChanges();
    setRefreshing(false);
  }, [userId]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'ADDED': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'add-circle' as any };
      case 'PRICE_UPDATE': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'pricetag' as any };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'help' as any };
    }
  };

  // --- LOGIC SPLIT ---
  const myDrafts = changes.filter(item => !item.isPublished && Number(item.userId) === Number(userId));
  const masterRecord = changes.filter(item => item.isPublished || Number(item.userId) !== Number(userId));

  return (
    <View className="flex-1 bg-slate-50">
      <View className="pt-14 px-6 pb-6 bg-white border-b border-slate-100 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-100 rounded-xl mr-4">
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-slate-900">
            {Number(userId) === 1 || Number(userId) === 4 ? t('master_audit_log') : t('system_logs')}
        </Text>
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        {/* --- SECTION 1: MY ACTIVE DRAFTS --- */}
        <Text className="text-[10px] font-black text-blue-600 uppercase tracking-[2px] mb-4 ml-2">
          {t('my_pending_tasks')}
        </Text>

        {myDrafts.length > 0 ? (
          myDrafts.map((item) => {
            const style = getTypeStyles(item.type);
            return (
              <View key={item.id} className="mb-4 bg-white p-5 rounded-[30px] border border-blue-100 shadow-sm">
                <View className="flex-row justify-between items-start mb-4">
                  <View className={`${style.bg} px-3 py-1 rounded-full flex-row items-center`}>
                    <Ionicons name={style.icon} size={12} color={style.text.includes('emerald') ? '#059669' : '#2563eb'} />
                    <Text className={`ml-2 text-[10px] font-black uppercase ${style.text}`}>{item.type}</Text>
                  </View>
                  <Text className="text-[10px] text-slate-400 font-bold">{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>

                <Text className="text-lg font-black text-slate-900 mb-1">{item.modelName}</Text>
                
                {item.type === 'PRICE_UPDATE' ? (
                  <Text className="text-slate-500 font-medium">
                    {t('price_shifted')} <Text className="text-red-500 font-black">{item.oldValue}</Text> {t('to')} <Text className="text-emerald-500 font-black">{item.newValue}</Text> {t('currency')}
                  </Text>
                ) : (
                  <Text className="text-slate-500 font-medium">
                    {item.type === 'ADDED' ? t('log_added_desc') : t('log_deleted_desc')}
                  </Text>
                )}

                <View className="flex-row mt-6 gap-x-3">
                  <TouchableOpacity 
                    onPress={() => handlePublish(item.id)}
                    className="flex-1 bg-slate-900 h-12 rounded-2xl flex-row justify-center items-center"
                  >
                    <Ionicons name="megaphone-outline" size={16} color="white" />
                    <Text className="text-white font-black text-[10px] uppercase ml-2">{t('send_notification')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteLog(item.id)} className="w-12 h-12 bg-red-50 rounded-2xl justify-center items-center border border-red-100">
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View className="bg-slate-100/50 p-6 rounded-[24px] mb-8 border border-dashed border-slate-300">
            <Text className="text-slate-400 text-center font-bold text-[11px] uppercase">{t('no_pending_drafts')}</Text>
          </View>
        )}

        {/* --- SECTION 2: GLOBAL AUDIT LOG (Super Admin) --- */}
        {Number(userId) === 1 || Number(userId) === 4 && (
          <>
            <View className="h-[1px] bg-slate-200 w-full my-6" />
            <Text className="text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-4 ml-2">
              {t('master_audit_log_title')}
            </Text>

            {masterRecord.map((item) => (
              <View key={item.id} className="mb-3 p-4 bg-slate-200/40 rounded-[24px] border border-slate-200">
                <View className="flex-row justify-between items-center mb-2">
                  <View className="flex-row items-center">
                    <Ionicons name="person-circle" size={14} color="#64748b" />
                    <Text className="text-[9px] font-black text-slate-500 uppercase ml-1.5">
                      {t('editor')}: <Text className="text-slate-800">{item.user?.name || "System"}</Text>
                    </Text>
                  </View>
                  <View className={`px-2 py-0.5 rounded-md ${item.isPublished ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <Text className={`text-[7px] font-black ${item.isPublished ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {item.isPublished ? t('published_status') : t('pending_status')}
                    </Text>
                  </View>
                </View>
                
                <Text className="text-sm font-black text-slate-700">{item.modelName}</Text>
                
                <View className="mt-1">
                  {item.type === 'PRICE_UPDATE' ? (
                    <Text className="text-[10px] text-slate-500">
                      {t('price_shift_label')}: <Text className="text-red-500 font-bold">{item.oldValue}</Text> {t('to')} <Text className="text-emerald-600 font-bold">{item.newValue}</Text> {t('currency')}
                    </Text>
                  ) : (
                    <Text className="text-[10px] text-slate-500 italic">
                      {item.type === 'ADDED' ? t('full_enroll_msg') : t('device_remove_msg')}
                    </Text>
                  )}
                  <Text className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}