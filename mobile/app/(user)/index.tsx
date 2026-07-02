import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import {RefreshControl} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../../context/SessionContext';


export default function UserInventoryScreen() {
  const { userId } = useSession() || "11";
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAVORITES'>('ALL');
  const { t } = useTranslation();
  const [phones, setPhones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [availableBrands, setAvailableBrands] = useState<{id: number, name: string}[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sortType, setSortType] = useState<'ID' | 'DATE'>('ID');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPhone, setSelectedPhone] = useState<any>(null);
  const [connectionError, setConnectionError] = useState(false);

  const CACHE_PHONES_KEY = `cache_user_phones_${userId}`;
  const CACHE_FAVORITES_KEY = `cache_user_favorites_${userId}`;
  const CACHE_BRANDS_KEY = "cache_available_brands";
  const CACHE_USER_FULL = `cache_user_phones_full_${userId}`;

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
    const loadCachedBrands = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_BRANDS_KEY);
        if (cached) setAvailableBrands(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    };

    const fetchBrands = async () => {
      try {
        const response = await fetch(`${API_URL}/phones/brands`);
        if (response.ok) {
          const data = await response.json();
          setAvailableBrands(data);
          await AsyncStorage.setItem(CACHE_BRANDS_KEY, JSON.stringify(data));
        } else {
          await loadCachedBrands();
        }
      } catch (error) {
        await loadCachedBrands();
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
      if (res.ok) {
        fetchPhones(true);
      } else {
        alert(t('connection_error'));
      }
    } catch (e) {
      alert(t('connection_error'));
    }
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

  const applyOfflineFilters = (allPhones: any[], favoritesOnly = false) => {
    let result = [...allPhones];

    // 1. Favorites tab
    if (favoritesOnly) {
      result = result.filter(p => p.isFavorite);
    }

    // 2. Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q)
      );
    }

    // 3. Brand filter
    if (selectedBrands.length > 0) {
      result = result.filter(p => selectedBrands.includes(p.brandId));
    }

    // 4. Sort
    const dir = sortOrder === 'desc' ? -1 : 1;
    if (sortType === 'DATE') {
      result.sort((a, b) =>
        dir * (new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime())
      );
    } else {
      result.sort((a, b) => {
        const brandCompare = (a.brand || '').localeCompare(b.brand || '') * dir;
        if (brandCompare !== 0) return brandCompare;
        return (a.id || '').localeCompare(b.id || '') * dir;
      });
    }

    return result;
  };

  const fetchPhones = async (forceRefresh = false) => {
    if (!forceRefresh) setLoading(true);
    setConnectionError(false);

    const brandQuery = selectedBrands.length === 0 ? 'ALL' : selectedBrands.join(',');
    const favQuery = activeTab === 'FAVORITES' ? '&favoritesOnly=true' : '';
    const url = `${API_URL}/phones?brands=${brandQuery}&sortType=${sortType}&sortOrder=${sortOrder}&search=${search}&userId=${userId}${favQuery}`;
    const cacheKey = activeTab === 'FAVORITES' ? CACHE_FAVORITES_KEY : CACHE_PHONES_KEY;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPhones(data);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));

        // Save full unfiltered ALL tab list for offline filtering
        if (selectedBrands.length === 0 && !search && activeTab === 'ALL') {
          await AsyncStorage.setItem(CACHE_USER_FULL, JSON.stringify(data));
        }
      } else {
        throw new Error("Server downstream communication error.");
      }
    } catch (error) {
      const fullCached = await AsyncStorage.getItem(CACHE_USER_FULL);
      const filteredCached = await AsyncStorage.getItem(cacheKey);

      if (fullCached) {
        const full = JSON.parse(fullCached);
        setPhones(applyOfflineFilters(full, activeTab === 'FAVORITES'));
      } else if (filteredCached) {
        setPhones(JSON.parse(filteredCached));
      } else {
        setPhones([]);
        if (!forceRefresh) setConnectionError(true);
      }
    } finally {
      setLoading(false);
    }
  };


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSearch('');
    setRefreshing(false);
  }, []);


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
              <Text className="text-slate-400 font-black mt-4 uppercase text-[10px]">{t('accessing_db')}</Text>
            </View>
          ) : connectionError ? (
            <View className="flex-1 py-20 items-center justify-center px-10">
              <Ionicons name="cloud-offline-outline" size={48} color="#cbd5e1" />
              <Text className="text-slate-400 font-black text-center mt-4 text-[10px] uppercase tracking-widest">
                {t('connection_error')}
              </Text>
              <Text className="text-slate-300 font-bold text-center mt-2 text-[10px]">
                {t('pull_to_retry')}
              </Text>
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
       renderItem={({ item, index } : any) => (
            <View className="mb-2 flex-row items-center">
              <Text className="text-[10px] font-black text-slate-400 w-5 text-right mr-2">{index + 1}</Text>
              <TouchableOpacity 
                onPress={() => setSelectedPhone(item)}
                activeOpacity={0.7}
                className="flex-1 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex-row justify-between items-center"
              >
            
            {/* --- LEFT SECTION: INFO --- */}
            <View className="flex-1 pr-3 min-w-0">
              {/* TOP ROW: REF ID & BRAND (Items-baseline locks text position perfectly) */}
              <View className="flex-row items-baseline mb-0.5">
                <Text className="text-[9px] font-black text-slate-500 uppercase">
                  {t('ref') + ":"}
                </Text>
                <Text className="text-[9px] font-black text-blue-500 tracking-tighter">
                  {item.id}
                </Text>
                <View className="mx-1.5 w-1 h-1 bg-slate-300 rounded-full self-center" /> 
                <View className="bg-slate-100 px-1.5 py-0.5 rounded">
                  <Text className="text-[8px] text-slate-500 font-black uppercase tracking-wider">
                    {item.brand + " "}
                  </Text>
                </View>
              </View>
              
              {/* DEVICE NAME (Stepped down from text-xl to text-base) */}
              <Text className="text-base font-black text-slate-900 leading-tight mb-2" numberOfLines={1}>
                {item.name}
              </Text>

              {/* HEART ACTION (Slimmed padding and scaled fonts down) */}
              <TouchableOpacity 
                onPress={() => toggleFavorite(item.id)} 
                className={`flex-row items-center self-start px-2 py-1 rounded-full border 
                  ${item.isFavorite ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}
              >
                <Ionicons 
                  name={item.isFavorite ? "heart" : "heart-outline"} 
                  size={11} 
                  color={item.isFavorite ? "#ef4444" : "#94a3b8"} 
                />
                <Text className={`text-[8px] ml-1 font-black uppercase ${item.isFavorite ? 'text-red-500' : 'text-slate-400'}`}>
                  {item.isFavorite ? t('saved') : t('savefavorite')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* --- RIGHT SECTION: PRICE (Made compact to keep card height slim) --- */}
            <View className="bg-blue-50 px-3 py-2 rounded-2xl ml-2 shrink-0">
              <View className="flex-row items-baseline">
                <Text className="text-lg font-black text-blue-700">{item.price}</Text>
                <Text className="text-[8px] font-black text-blue-400 ml-0.5">{t('currency')}</Text>
              </View>
            </View>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* --- PHONE DETAIL POPUP --- */}
      <Modal visible={!!selectedPhone} animationType="fade" transparent={true} onRequestClose={() => setSelectedPhone(null)}>
        <TouchableOpacity 
          className="flex-1 justify-center items-center bg-black/70 px-8"
          activeOpacity={1}
          onPress={() => setSelectedPhone(null)}
        >
          <TouchableOpacity activeOpacity={1} className="bg-white w-full rounded-[30px] p-6">
            <View className="flex-row justify-between items-start mb-4">
              <View className={`px-3 py-1 rounded-full bg-slate-100`}>
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {selectedPhone?.brand}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPhone(null)} className="p-1">
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text className="text-[9px] font-black text-blue-500 uppercase mb-1">
              {t('ref')}: {selectedPhone?.id}
            </Text>
            <Text className="text-xl font-black text-slate-900 leading-snug mb-6">
              {selectedPhone?.name}
            </Text>

            <View className="flex-row justify-between items-center border-t border-slate-100 pt-4">
              <Text className="text-slate-400 text-[10px] font-black uppercase">{t('valuation_sar')}</Text>
              <View className="flex-row items-baseline">
                <Text className="text-2xl font-black text-slate-900">{selectedPhone?.price}</Text>
                <Text className="text-[10px] font-bold text-slate-400 ml-1">{t('currency')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}