import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';

export default function SystemChangesScreen() {

  interface SystemLog {
    id: number;
    type: 'ADDED' | 'DELETED' | 'PRICE_UPDATE';
    modelName: string;
    oldValue?: string;
    newValue?: string;
    createdAt: string;
  }


  const { t } = useTranslation();
  const [changes, setChanges] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userId } = useLocalSearchParams();

  const fetchChanges = async () => {
    if (!userId) return;
    try {
      // Filter the request so the server only returns THIS admin's logs
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
        body: JSON.stringify({ userId: Number(userId) }) // Passing current admin ID
      });

      if (res.ok) {
        Alert.alert(t('success'), t('notification_sent'));
        // Remove it from the list since isPublished is now true
        setChanges(prev => prev.filter(item => item.id !== logId));
      } else {
        Alert.alert(t('error'), t('action_failed'));
      }
    } catch (e) {
      Alert.alert(t('error'), t('connection_error'));
    }
  };



  const handleDeleteLog = (logId: number) => {
    Alert.alert(
      t('system_delete'),
      t('delete_log_confirm'), // Add this to your JSON
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/phones/changes/${logId}?userId=${userId}`, {
                method: 'DELETE',
              });

              if (res.ok) {
                // Remove from local state so the UI updates instantly
                setChanges(prev => prev.filter(log => log.id !== logId));
              } else {
                Alert.alert(t('error'), t('action_failed'));
              }
            } catch (e) {
              Alert.alert(t('error'), t('connection_error'));
            }
          },
        },
      ]
    );
  };



  useFocusEffect(
    useCallback(() => {
        setLoading(true);
        fetchChanges();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchChanges();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchChanges]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'ADDED': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'add-circle' as any };
      case 'DELETED': return { bg: 'bg-red-50', text: 'text-red-600', icon: 'trash' as any };
      case 'PRICE_UPDATE': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'pricetag' as any };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'help' as any };
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      <View className="pt-14 px-6 pb-6 bg-white border-b border-slate-100 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-100 rounded-xl mr-4">
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-slate-900">{t('system_logs')}</Text>
      </View>

      <FlatList
        data={changes}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator size="large" color="#3b82f6" className="mt-20" /> :
          <View className="items-center mt-20"><Text className="text-slate-400 font-bold">{t('no_logs')}</Text></View>
        }
        renderItem={({ item }: any) => {
          const style = getTypeStyles(item.type);
          return (
            <View className="mb-4 bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm">
              <View className="flex-row justify-between items-start mb-4">
                <View className={`${style.bg} px-3 py-1 rounded-full flex-row items-center`}>
                  <Ionicons name={style.icon} size={12} color={style.text.includes('emerald') ? '#059669' : style.text.includes('red') ? '#dc2626' : '#2563eb'} />
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

                <TouchableOpacity 
                  onPress={() => handleDeleteLog(item.id)}
                  className="w-12 h-12 bg-red-50 rounded-2xl justify-center items-center border border-red-100"
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}