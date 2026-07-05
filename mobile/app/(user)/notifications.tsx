import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId } = useSession();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const CACHE_NOTIF_KEY = `cache_notifications_${userId}`;


  const renderNotificationMessage = (item: any) => {
    // If it's an old notification that still has a hardcoded string
    if (item.message && !item.type) return item.message;

   switch (item.type) {
    case 'PRICE_UPDATE':
      return `New Price: ${item.modelName} = ${item.newPrice} SAR`;

    case 'ADDED':
      return `New Model: ${item.modelName} = ${item.newPrice} SAR`;
      
      default:
        return item.message || "";
    }
  };

  // --- NEW: Dynamic Icon Helper ---
  const getIconConfig = (type: string, isRead: boolean) => {
    switch (type) {
      case 'ADDED': return { name: 'add-circle' as any, color: isRead ? '#94a3b8' : '#10b981' };
      case 'PRICE_UPDATE': return { name: 'pricetag' as any, color: isRead ? '#94a3b8' : '#3b82f6' };
      default: return { name: 'notifications' as any, color: isRead ? '#94a3b8' : '#3b82f6' };
    }
  };

  // 1. Updated fetchNotifications
  const fetchNotifications = async () => {
    if (!userId) return;
    setConnectionError(false);

    if (notifications.length === 0) setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/notifications/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        await AsyncStorage.setItem(CACHE_NOTIF_KEY, JSON.stringify(data));
        markAllAsRead();
      } else {
        throw new Error('Server error');
      }
    } catch (e) {
      const cached = await AsyncStorage.getItem(CACHE_NOTIF_KEY);
      if (cached) {
        setNotifications(JSON.parse(cached));
      } else {
        setNotifications([]);
        setConnectionError(true);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      // Just a "Fire and Forget" request to the server
      await fetch(`${API_URL}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId) }),
      });
      console.log("📡 Backend updated: Notifications marked as read.");
    } catch (e) {
      console.error("Silent mark-read failed", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchNotifications();
      }
    }, [userId])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [userId]);

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* HEADER */}
      <View className="pt-14 px-6 pb-6 bg-white border-b border-slate-100 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 bg-slate-100 rounded-xl">
          <Ionicons name="chevron-back" size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-slate-900 tracking-tighter">{t('notifications')}</Text>
        <View className="w-10" />
      </View>

      <FlatList
        data={notifications}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        ListEmptyComponent={
          loading ? (
            <View className="py-20 justify-center items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : connectionError ? (
            <View className="items-center mt-20 px-10">
              <Ionicons name="cloud-offline-outline" size={60} color="#cbd5e1" />
              <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                {t('connection_error')}
              </Text>
              <Text className="text-slate-300 font-bold text-center mt-2 text-[10px]">
                {t('pull_to_retry')}
              </Text>
            </View>
          ) : (
            <View className="items-center mt-20 px-10">
              <Ionicons name="mail-open-outline" size={60} color="#cbd5e1" />
              <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                {t('no_new_notifications')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }: any) => {
          const iconConfig = getIconConfig(item.type, item.isRead);
          
          return (
            <View className={`mb-3 p-5 rounded-[28px] border flex-row items-start ${item.isRead ? 'bg-white border-slate-100' : 'bg-blue-50/50 border-blue-100'}`}>
              <View className={`w-10 h-10 rounded-full items-center justify-center ${item.isRead ? 'bg-slate-100' : 'bg-white shadow-sm'}`}>
                <Ionicons name={iconConfig.name} size={18} color={iconConfig.color} />
              </View>
              
              <View className="flex-1 ml-4">
                <View className="flex-row justify-between items-start">
                  <Text className={`flex-1 text-sm leading-5 mb-1 ${item.isRead ? 'text-slate-600 font-medium' : 'text-slate-900 font-black'}`}>
                    {renderNotificationMessage(item)}
                  </Text>
                  {!item.isRead ? (
                    <View className="w-2.5 h-2.5 bg-blue-500 rounded-full ml-2 mt-1.5" />
                  ) : null}
                </View>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}