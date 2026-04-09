import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSession } from '@/hooks/useSession';

export default function NotificationListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId } = useSession();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);


  const renderNotificationMessage = (item: any) => {
    // If it's an old notification that still has a hardcoded string
    if (item.message && !item.type) return item.message;

    switch (item.type) {
      case 'PRICE_UPDATE':
        return t('notif_price_change', { 
          model: item.modelName, 
          old: item.oldPrice, 
          new: item.newPrice 
        });
      case 'ADDED':
        return t('notif_added', { model: item.modelName });
      case 'DELETED':
        return t('notif_deleted', { model: item.modelName });
      default:
        return item.message || "";
    }
  };

  // --- NEW: Dynamic Icon Helper ---
  const getIconConfig = (type: string, isRead: boolean) => {
    switch (type) {
      case 'ADDED': return { name: 'add-circle' as any, color: isRead ? '#94a3b8' : '#10b981' };
      case 'DELETED': return { name: 'trash' as any, color: isRead ? '#94a3b8' : '#ef4444' };
      case 'PRICE_UPDATE': return { name: 'pricetag' as any, color: isRead ? '#94a3b8' : '#3b82f6' };
      default: return { name: 'notifications' as any, color: isRead ? '#94a3b8' : '#3b82f6' };
    }
  };

  // 1. Updated fetchNotifications
  const fetchNotifications = async () => {
    if (!userId) return;
    
    // Only show the big loading spinner if we don't have any notifications yet
    if (notifications.length === 0) setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/notifications/${userId}`);
      const data = await res.json();
      setNotifications(data);
      markAllAsRead();
    } catch (e) {
      console.error("Fetch error:", e);
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