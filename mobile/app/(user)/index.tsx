import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import {RefreshControl} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/hooks/useSession';

export default function UserInventoryScreen() {
  const { userId } = useSession() || "11";
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAVORITES'>('ALL');
  const { t } = useTranslation();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [availableBrands, setAvailableBrands] = useState<{id: number, name: string}[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sortType, setSortType] = useState<'ID' | 'DATE'>('ID');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const checkNotifications = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/notifications/${userId}`);
      const data = await res.json();
      // Count how many are NOT read
      const unread = data.filter((n: any) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (e) { console.log(e); }
  };

  // Check for new notifications every time the screen focuses or userId loads
  useEffect(() => {
    checkNotifications();
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      checkNotifications(); // This updates the red dot state
    }, [userId])
  );


  useEffect(() => {
    const fetchBrands = async () => {
      try {
        console.log("📡 Fetching brands from:", `${API_URL}/phones/brands`);
        const response = await fetch(`${API_URL}/phones/brands`);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const data = await response.json();
        setAvailableBrands(data);
      } catch (error) {
        console.error("❌ Brand fetch failed:", error);
      }
    };
    fetchBrands();
  }, []);

  const toggleFavorite = async (phoneId: string) => {
    try {
      const res = await fetch(`${API_URL}/phones/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(userId), phoneId })
      });
      if (res.ok) fetchPhones(); // Refresh list to update hearts
    } catch (e) { console.error(e); }
  };



  const toggleBrand = (brandId: number | 'ALL') => {
    if (brandId === 'ALL') {
      setSelectedBrands([]); // Empty array means "ALL"
      return;
    }

    if (selectedBrands.includes(brandId)) {
      setSelectedBrands(selectedBrands.filter(id => id !== brandId));
    } else {
      setSelectedBrands([...selectedBrands, brandId]);
    }
  };

  const fetchPhones = async () => {
    setLoading(true);
    try {
      // If selectedBrands is empty, we send 'ALL'
      const brandQuery = selectedBrands.length === 0 ? 'ALL' : selectedBrands.join(',');
      const favQuery = activeTab === 'FAVORITES' ? '&favoritesOnly=true' : '';
      
      const url = `${API_URL}/phones?brands=${brandQuery}&sortType=${sortType}&sortOrder=${sortOrder}&search=${search}&userId=${userId}${favQuery}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setPhones(data);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPhones(); 
    setRefreshing(false);
  }, [fetchPhones]);


  useEffect(() => {
  // Only fetch if userId is not null
    if (userId) {
      fetchPhones();
    }
  }, [selectedBrands, sortOrder, sortType, search, activeTab, userId]); // Added userId to dependencies

  return (
    <View className="flex-1 bg-slate-50">
      {/* --- SYSTEM HEADER --- */}
      <View className="pt-14 px-6 pb-6 bg-white border-b border-slate-100">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-blue-600 text-[10px] font-black uppercase tracking-[3px]">{t("kunooz")}</Text>
            <Text className="text-3xl font-black text-slate-900 tracking-tighter">{t('inventory')}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/(user)/notifications', params: { userId } })}
            className="p-3 bg-slate-100 rounded-2xl"
          >
            <Ionicons name="notifications" size={22} color="#1e293b" />
            {/* ONLY SHOW RED DOT IF UNREAD > 0 */}
            {unreadCount > 0 && (
              <View className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 h-14 border border-slate-200 shadow-inner">
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput 
            placeholder={t('search_placeholder')} 
            placeholderTextColor="#94a3b8"
            className="flex-1 ml-3 text-slate-900 font-bold"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- BRAND FILTERS --- */}
      <View>
        <View className="flex-row justify-between items-center px-6 mb-3 mt-4">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">{t('filter_brands')}</Text>
          
          <View className="flex-row gap-x-2">
            {/* TOGGLE 1: TYPE (Alphabetical vs Date) */}
            <TouchableOpacity 
              onPress={() => setSortType(prev => prev === 'ID' ? 'DATE' : 'ID')}
              className="flex-row items-center bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100"
            >
              <Ionicons name={sortType === 'ID' ? "text" : "calendar"} size={12} color="#2563eb" />
              <Text className="text-blue-600 font-black ml-1.5 text-[9px] uppercase">
                {sortType === 'ID' ? t('sort_ref') : t('sort_date')}
              </Text>
            </TouchableOpacity>

            {/* TOGGLE 2: DIRECTION (A-Z or Z-A) */}
            <TouchableOpacity 
              onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-blue-50 p-1.5 rounded-xl border border-blue-100"
            >
              <Ionicons 
                name={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} 
                size={14} 
                color="#2563eb" 
              />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
          <TouchableOpacity
            onPress={() => toggleBrand('ALL')}
            className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.length === 0 ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-200'}`}
          >
            <Text className={`font-black text-[11px] ${selectedBrands.length === 0 ? 'text-white' : 'text-slate-500'}`}>ALL</Text>
          </TouchableOpacity>

          {availableBrands.map((brand) => (
            <TouchableOpacity
              key={brand.id}
              onPress={() => toggleBrand(brand.id)}
              className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.includes(brand.id) ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-200'}`}
            >
              <Text className={`font-black text-[11px] ${selectedBrands.includes(brand.id) ? 'text-white' : 'text-slate-500'}`}>
                {brand.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* --- SECTION TABS --- */}
      <View className="flex-row px-6 mt-4">
        <TouchableOpacity 
          onPress={() => setActiveTab('ALL')}
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'ALL' ? 'border-blue-600' : 'border-transparent'}`}
        >
          <Text className={`font-black ${activeTab === 'ALL' ? 'text-blue-600' : 'text-slate-400'}`}>{t('all_phones')}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('FAVORITES')}
          className={`flex-1 py-3 items-center border-b-2 ${activeTab === 'FAVORITES' ? 'border-blue-600' : 'border-transparent'}`}
        >
          <View className="flex-row items-center">
            <Ionicons name="heart" size={16} color={activeTab === 'FAVORITES' ? '#2563eb' : '#94a3b8'} />
            <Text className={`font-black ml-2 ${activeTab === 'FAVORITES' ? 'text-blue-600' : 'text-slate-400'}`}>{t('favorites')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* --- DATA LIST --- */}
      <FlatList
        data={phones} 
        className="px-4 py-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        keyExtractor={(item: any, index) => item?.id ? item.id.toString() : index.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
        }
        ListEmptyComponent={
          loading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#2563eb" />
              <Text className="text-slate-400 font-black mt-4 uppercase text-[10px]">Accessing Stock...</Text>
            </View>
          ) : (
            <View className="flex-1 py-20 items-center justify-center px-10">
              <Ionicons 
                name={activeTab === 'FAVORITES' ? "heart-outline" : "phone-portrait-outline"} 
                size={48} 
                color="#cbd5e1" 
              />
              <Text className="text-slate-400 font-black mt-4 text-center text-[10px] uppercase tracking-widest">
                {activeTab === 'FAVORITES' 
                  ? t('no_favorites')
                  : `${t('no_results')} "${search}"`}
              </Text>
            </View>
          )
        }
        renderItem={({ item }: any) => (
          <View className="mb-4 p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm flex-row justify-between items-center">
            
            {/* --- LEFT SECTION: INFO --- */}
            <View className="flex-1 pr-4">
              {/* TOP ROW: REF ID & BRAND */}
              <View className="flex-row items-center mb-1">
                <Text className="text-[9px] font-black text-blue-500 tracking-widest uppercase">
                  REF: {item.id}
                </Text>
                <View className="mx-2 w-1 h-1 bg-slate-300 rounded-full" /> 
                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                  <Text className="text-[8px] text-slate-500 font-black uppercase">
                    {item.brand}
                  </Text>
                </View>
              </View>
              
              {/* DEVICE NAME */}
              <Text className="text-xl font-black text-slate-900 leading-6 mb-3" numberOfLines={1}>
                {item.name}
              </Text>

              {/* HEART ACTION */}
              <TouchableOpacity 
                onPress={() => toggleFavorite(item.id)} 
                className={`flex-row items-center self-start px-3 py-1.5 rounded-full border 
                  ${item.isFavorite ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}
              >
                <Ionicons 
                  name={item.isFavorite ? "heart" : "heart-outline"} 
                  size={14} 
                  color={item.isFavorite ? "#ef4444" : "#94a3b8"} 
                />
                <Text className={`text-[9px] ml-1.5 font-black uppercase ${item.isFavorite ? 'text-red-500' : 'text-slate-400'}`}>
                  {item.isFavorite ? t('saved') : t('savefavorite')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* --- RIGHT SECTION: PRICE --- */}
            <View className="bg-blue-50 p-4 rounded-3xl">
              <View className="flex-row items-baseline">
                <Text className="text-xl font-black text-blue-700">{item.price}</Text>
                <Text className="text-[8px] font-black text-blue-400 ml-1">{t('currency')}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}