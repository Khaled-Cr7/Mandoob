import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Keyboard, KeyboardEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';
import i18n from '@/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../../context/SessionContext';
import { handleLanguageToggle } from '../../utils/language';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminPhoneManagement() {
  const { t } = useTranslation();
  const [phones, setPhones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [availableBrands, setAvailableBrands] = useState<{id: number, name: string}[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isBrandModalVisible, setIsBrandModalVisible] = useState(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandForm, setBrandForm] = useState({ id: null as number | null, name: '' });
  const [sortType, setSortType] = useState<'ID' | 'DATE'>('ID');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const { userId } = useSession() || {};
  const [unreadCount, setUnreadCount] = useState(0);
  const { confirmSignOut } = useSession();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', brandId: null as number | null, price: '' });
  const [connectionError, setConnectionError] = useState(false);
  const insets = useSafeAreaInsets();

  const CACHE_ADMIN_PHONES = "cache_admin_phones";
  const CACHE_BRANDS_KEY = "cache_available_brands";
  const CACHE_ADMIN_FULL = 'cache_admin_phones_full';

  const checkNotifications = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_URL}/notifications/${userId}`);
      const data = await res.json();
      const unread = data.filter((n: any) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (e) { console.log(e); }
  };

  useFocusEffect(useCallback(() => { checkNotifications(); }, [userId]));

  useEffect(() => {
    const loadCachedBrands = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_BRANDS_KEY);
        if (cached) setAvailableBrands(JSON.parse(cached));
      } catch (e) { console.error(e); }
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSearch('');
    setRefreshing(false);
  }, []);

  const toggleLanguage = () => { handleLanguageToggle(i18n, t, userId); };

  const applyOfflineFilters = (allPhones: any[]) => {
    let result = [...allPhones];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q)
      );
    }
    if (selectedBrands.length > 0) {
      result = result.filter(p => selectedBrands.includes(p.brandId));
    }
    const dir = sortOrder === 'desc' ? -1 : 1;
    if (sortType === 'DATE') {
      result.sort((a, b) => dir * (new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()));
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
    try {
      const brandQuery = selectedBrands.length === 0 ? 'ALL' : selectedBrands.join(',');
      const url = `${API_URL}/phones?brands=${brandQuery}&sortType=${sortType}&sortOrder=${sortOrder}&search=${search}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPhones(data);
        await AsyncStorage.setItem(CACHE_ADMIN_PHONES, JSON.stringify(data));
        if (selectedBrands.length === 0 && !search) {
          await AsyncStorage.setItem(CACHE_ADMIN_FULL, JSON.stringify(data));
        }
      } else {
        throw new Error("Downstream connection failed");
      }
    } catch (error) {
      const filteredCached = await AsyncStorage.getItem(CACHE_ADMIN_PHONES);
      const fullCached = await AsyncStorage.getItem(CACHE_ADMIN_FULL);
      if (fullCached) {
        setPhones(applyOfflineFilters(JSON.parse(fullCached)));
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

  useEffect(() => { fetchPhones(); }, [selectedBrands, sortType, sortOrder, search]);
  useFocusEffect(useCallback(() => { setSearch(''); }, []));

  const openAddModal = () => {
    setIsEditing(false);
    // Force brandId to start as null instead of pre-selecting the first brand
    setFormData({ id: '', name: '', brandId: null, price: '' });
    setIsModalVisible(true);
  };

  const openEditModal = (phone: any) => {
    setIsEditing(true);
    const brandObj = availableBrands.find(b => b.name === phone.brand);
    setFormData({ id: phone.id, name: phone.name, brandId: brandObj ? brandObj.id : null, price: phone.price.toString() });
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    const { id, name, price, brandId } = formData;
    
    // 1. Strict verification: Ensure all fields are filled AND a brand is explicitly selected
    if (!id.trim() || !name.trim() || !price || brandId === null) {
      Alert.alert(t('error'), t('fill_all_fields') || 'Please select a brand and fill all fields.');
      return;
    }
    
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      Alert.alert(t('error'), t('invalid_price_msg'));
      return;
    }
    
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const endpoint = isEditing ? `${API_URL}/phones/${id}` : `${API_URL}/phones`;
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          id: id.trim().toUpperCase(), 
          name: name.trim(), 
          price: numericPrice, 
          userId: Number(userId) 
        })
      });
      
      if (response.ok) {
        fetchPhones();
        
        if (isEditing) {
          // If editing an existing device, close the modal normally
          setIsModalVisible(false);
          Alert.alert(t('success'), t('updated_msg'));
        } else {
          // If adding a new entry, keep modal open and reset fields after clicking OK
          Alert.alert(
            t('success'), 
            t('added_msg'),
            [
              {
                text: t('ok') || 'OK',
                onPress: () => {
                  // Clear out everything so the admin can immediately type the next phone
                  setFormData({ id: '', name: '', brandId: null, price: '' });
                }
              }
            ]
          );
        }
      } else {
        const err = await response.json();
        Alert.alert(t('error'), err.message || t('action_failed'));
      }
    } catch (e) {
      Alert.alert(t('error'), t('connection_error'));
    }
  };

  const toggleBrand = (id: number | 'ALL') => {
    if (id === 'ALL') { setSelectedBrands([]); return; }
    if (selectedBrands.includes(id)) {
      setSelectedBrands(selectedBrands.filter(b => b !== id));
    } else {
      setSelectedBrands([...selectedBrands, id]);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('system_delete'), `${t('confirm_removal')}: ${id}?`, [
      { text: t('cancel'), style: "cancel" },
      { text: t('delete'), style: "destructive", onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/phones/${id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: Number(userId) })
            });
            if (res.ok) { fetchPhones(true); }
            else { Alert.alert(t('error'), t('connection_error')); }
          } catch (e) { Alert.alert(t('error'), t('connection_error')); }
        }
      }
    ]);
  };

  const handleDeleteBrand = async (id: number) => {
    Alert.alert(t('system_delete'), t('delete_brand_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/phones/brands/${id}`, { method: 'DELETE' });
            if (res.ok) {
              setAvailableBrands(prev => prev.filter(b => b.id !== id));
              if (brandForm.id === id) setBrandForm({ id: null, name: '' });
            } else {
              Alert.alert(t('error'), t('brand_in_use'));
            }
          } catch (e) { Alert.alert(t('error'), t('connection_error')); }
        }
      }
    ]);
  };

  const handleSaveBrand = async () => {
    const trimmedName = brandForm.name.trim().toUpperCase();
    if (!trimmedName) { Alert.alert(t('error'), t('brand_name_required')); return; }
    const exists = availableBrands.some(b => b.name === trimmedName && b.id !== brandForm.id);
    if (exists) { Alert.alert(t('error'), t('brand_exists')); return; }
    setIsSavingBrand(true);
    const isEdit = brandForm.id !== null;
    const url = isEdit ? `${API_URL}/phones/brands/${brandForm.id}` : `${API_URL}/phones/brands`;
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      const data = await res.json();
      if (res.ok) {
        setBrandForm({ id: null, name: '' });
        const response = await fetch(`${API_URL}/phones/brands`);
        const updatedData = await response.json();
        setAvailableBrands(updatedData);
      } else {
        Alert.alert(t('error'), data.message || t('action_failed'));
      }
    } catch (e) {
      Alert.alert(t('error'), t('connection_error'));
    } finally {
      setIsSavingBrand(false);
    }
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  return (
    <View className="flex-1 bg-slate-900">

      {/* --- HEADER --- */}
      <View className="pt-14 px-5 pb-3 bg-slate-900">

        {/* ROW 1: Title + Actions */}
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-amber-500 text-[9px] font-black uppercase tracking-[3px]">{t('system_admin')}</Text>
            <Text className="text-2xl font-black text-white">{t('price_list')}</Text>
          </View>

          <View className="flex-row items-center gap-x-2">

            {/* Add Phone */}
            <TouchableOpacity
              onPress={openAddModal}
              className="p-2 bg-amber-500 rounded-xl"
            >
              <Ionicons name="add" size={18} color="#0f172a" />
            </TouchableOpacity>

            {/* Manage Brands */}
            <TouchableOpacity
              onPress={() => setIsBrandModalVisible(true)}
              className="p-2 bg-slate-800 rounded-xl border border-slate-700"
            >
              <Ionicons name="settings-sharp" size={16} color="#fbbf24" />
            </TouchableOpacity>


            {/* Notification Bell */}
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(admin)/notifications', params: { userId } })}
              className="p-2 bg-slate-800 rounded-xl border border-slate-700"
            >
              <Ionicons name="notifications" size={16} color="#fbbf24" />
              {unreadCount > 0 && (
                <View className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
              )}
            </TouchableOpacity>

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

        {/* ROW 2: Brand Filter — ALL fixed, brands scrollable */}
        <View className="flex-row items-center mb-2">
          {/* Fixed ALL button */}
          <TouchableOpacity
            onPress={() => toggleBrand('ALL')}
            className={`px-4 py-1.5 rounded-xl border-2 ${selectedBrands.length === 0 ? 'bg-amber-500 border-amber-400' : 'bg-transparent border-slate-700'}`}
          >
            <Text className={`font-black text-[10px] ${selectedBrands.length === 0 ? 'text-slate-900' : 'text-slate-500'}`}>ALL</Text>
          </TouchableOpacity>

          {/* Separator */}
          <View className="w-[1px] h-5 bg-slate-700 mx-2" />

          {/* Scrollable brands */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
              {availableBrands.map((brand) => (
                <TouchableOpacity
                  key={brand.id}
                  onPress={() => toggleBrand(brand.id)}
                  className={`px-4 py-1.5 rounded-xl mr-2 border-2 ${selectedBrands.includes(brand.id) ? 'bg-amber-500 border-amber-400' : 'bg-transparent border-slate-700'}`}
                >
                  <Text className={`font-black text-[10px] ${selectedBrands.includes(brand.id) ? 'text-slate-900' : 'text-slate-500'}`}>{brand.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
        </View>

        {/* ROW 3: Search */}
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

      {/* --- MAIN LIST AREA --- */}
      <View className="flex-1 bg-slate-50 rounded-t-[36px] border-t border-slate-200">

        {/* List Header: counts + sort controls */}
        <View className="flex-row justify-between items-center px-6 py-4">
          <View>
            <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">
              {t('active_records')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(admin)/changes', params: { userId } })}
              className="flex-row items-center mt-0.5"
            >
              <Ionicons name="list-circle-outline" size={13} color="#64748b" />
              <Text className="text-slate-500 font-bold text-[10px] ml-1 border-b border-slate-300">
                {t('view_system_logs')}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-x-2">
            <TouchableOpacity
              onPress={() => setSortType(prev => prev === 'ID' ? 'DATE' : 'ID')}
              className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <Ionicons name={sortType === 'ID' ? "text" : "calendar"} size={12} color="#64748b" />
              <Text className="text-slate-600 font-bold text-[9px] uppercase ml-1.5">
                {sortType === 'ID' ? t('sort_ref') : t('sort_date')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-slate-100 p-1.5 rounded-lg border border-slate-200"
            >
              <Ionicons name={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} size={12} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={phones}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
          renderItem={({ item, index }: any) => (
            <View className="ml-2 mr-5 mb-1.5 flex-row items-center">
              {/* Index Number */}
              <Text className="text-[10px] font-black text-slate-400 w-6 text-right mr-1.5">{index + 1}</Text>
              
              {/* Main Card Element */}
              <TouchableOpacity
                onPress={() => setSelectedPhone(item)}
                activeOpacity={0.7}
                className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm flex-row justify-between items-center"
              >
                {/* --- LEFT SECTION: INFO --- */}
                <View className="flex-1 min-w-0 pr-2">
                  {/* TOP ROW: Fully Inline Nested Reference and Brand */}
                  <View className="flex-row items-center mb-0.5">
                    <Text className="text-[8px] font-black text-slate-400 uppercase">
                      {t('ref') + ": "}
                      <Text className="text-amber-600 tracking-tighter">
                        {item.id}
                      </Text>
                      
                      {/* Inline dot separator */}
                      <Text className="text-slate-300 px-1 font-normal">  •  </Text>
                      
                      {/* Inline Brand Text with matching layout properties */}
                      <Text className="text-[7px] text-slate-500 font-black tracking-wider bg-slate-100 px-1 rounded">
                        {" "}{item.brand}{" "}
                      </Text>
                    </Text>
                  </View>

                  {/* DEVICE NAME */}
                  <Text className="text-sm font-black text-slate-900 leading-tight" numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>

                {/* --- RIGHT SECTION: PRICE & CONTROLS --- */}
                <View className="flex-row items-center gap-x-1.5 shrink-0 ml-2">
                  {/* Compact Price Block */}
                  <View className="bg-slate-50 px-2 py-1 rounded-xl border border-slate-100">
                    <View className="flex-row items-baseline">
                      <Text className="text-sm font-black text-slate-900">{item.price}</Text>
                      <Text className="text-[7px] font-black text-slate-400 ml-0.5">{t('currency')}</Text>
                    </View>
                  </View>

                  {/* Control Buttons (Pencil + Trash stacked side-by-side cleanly) */}
                  <View className="flex-row gap-x-1">
                    <TouchableOpacity 
                      onPress={() => openEditModal(item)} 
                      className="p-2 bg-slate-900 rounded-xl shadow-sm"
                    >
                      <Ionicons name="pencil" size={11} color="#fbbf24" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDelete(item.id)} 
                      className="p-2 bg-red-50 rounded-xl border border-red-100"
                    >
                      <Ionicons name="trash" size={11} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color="#0f172a" style={{ marginTop: 80 }} />
            ) : (
              <View className="items-center mt-20 px-10">
                <Ionicons name={search.length > 0 ? "search-outline" : "file-tray-outline"} size={40} color="#cbd5e1" />
                <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                  {search.length > 0 ? `${t('no_results')} "${search}"` : t('no_inventory_found')}
                </Text>
              </View>
            )
          }
        />
      </View>

      {/* --- ADD / EDIT MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true} statusBarTranslucent={true}>
        <View className="flex-1 justify-end bg-black/60">
          <View
            className="bg-slate-900 rounded-t-[45px] p-8 border-t-2 border-amber-500/30"
            style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 32 + insets.bottom }}
          >
            <View className="w-12 h-1 bg-slate-700 rounded-full self-center mb-6" />
            <Text className="text-amber-500 font-black text-[10px] uppercase tracking-[3px] mb-2">
              {isEditing ? t('system_update') : t('new_entry')}
            </Text>
            <Text className="text-3xl font-black text-white mb-8 tracking-tighter">
              {isEditing ? t('edit_specs') : t('register_device')}
            </Text>
            <View className="gap-y-4">
              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('device_ref_id')}</Text>
                <TextInput
                  editable={!isEditing}
                  placeholder={t('device_id_placeholder')}
                  placeholderTextColor="#475569"
                  value={formData.id}
                  onChangeText={(v) => setFormData({...formData, id: v})}
                  className={`bg-slate-800 text-white p-4 rounded-2xl border ${isEditing ? 'border-slate-700 text-slate-500' : 'border-slate-700'}`}
                />
              </View>
              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('model_designation')}</Text>
                <TextInput
                  placeholder={t('model_name_placeholder')}
                  placeholderTextColor="#475569"
                  value={formData.name}
                  onChangeText={(v) => setFormData({...formData, name: v})}
                  className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700"
                />
              </View>
              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('manufacturer')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                    {availableBrands.map(b => (
                      <TouchableOpacity
                        key={b.id}
                        onPress={() => setFormData({...formData, brandId: b.id})}
                        className={`mr-2 px-5 py-2.5 rounded-xl border-2 ${formData.brandId === b.id ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700'}`}
                      >
                        <Text className={`font-black text-[10px] ${formData.brandId === b.id ? 'text-slate-900' : 'text-slate-400'}`}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
              </View>
              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('valuation_sar')}</Text>
                <TextInput
                  placeholder={t('price')}
                  keyboardType="numeric"
                  placeholderTextColor="#475569"
                  value={formData.price}
                  onChangeText={(v) => setFormData({...formData, price: v})}
                  className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold"
                />
              </View>
            </View>
            <View className="flex-row mt-10 gap-x-3">
              <TouchableOpacity onPress={() => setIsModalVisible(false)} className="flex-1 bg-slate-800 h-16 rounded-[24px] justify-center items-center">
                <Text className="text-slate-400 font-black text-xs uppercase">{t('discard')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} className="flex-[2] bg-amber-500 h-16 rounded-[24px] justify-center items-center shadow-lg shadow-amber-500/20">
                <Text className="text-slate-900 font-black text-xs tracking-widest uppercase">
                  {isEditing ? t('apply_changes') : t('confirm_enrollment')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- BRAND MANAGEMENT MODAL --- */}
      <Modal visible={isBrandModalVisible} animationType="fade" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/80 px-6">
          <View className="bg-slate-900 w-full rounded-[35px] p-8 border border-slate-800">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-black text-white">
                {brandForm.id ? t('edit_brand') : t('manage_brands')}
              </Text>
              <TouchableOpacity onPress={() => { setIsBrandModalVisible(false); setBrandForm({ id: null, name: '' }); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View className="flex-row mb-6 gap-x-2">
              <TextInput
                className="flex-1 bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold"
                placeholder={t('brand_name')}
                placeholderTextColor="#475569"
                value={brandForm.name}
                onChangeText={(val) => setBrandForm({...brandForm, name: val})}
              />
              <TouchableOpacity
                onPress={handleSaveBrand}
                disabled={isSavingBrand}
                className={`w-14 rounded-2xl items-center justify-center ${brandForm.id ? 'bg-blue-500' : 'bg-amber-500'}`}
              >
                {isSavingBrand ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Ionicons name={brandForm.id ? "checkmark" : "add"} size={24} color="#000" />
                )}
              </TouchableOpacity>
            </View>
            <View className="max-h-60">
              <FlatList
                data={availableBrands}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View className="flex-row justify-between items-center py-3 border-b border-slate-800">
                    <Text className="text-slate-300 font-bold">{item.name}</Text>
                    <View className="flex-row gap-x-4">
                      <TouchableOpacity onPress={() => setBrandForm({ id: item.id, name: item.name })}>
                        <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteBrand(item.id)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* --- PHONE DETAIL POPUP --- */}
      <Modal visible={!!selectedPhone} animationType="fade" transparent={true} onRequestClose={() => setSelectedPhone(null)}>
        <TouchableOpacity className="flex-1 justify-center items-center bg-black/70 px-8" activeOpacity={1} onPress={() => setSelectedPhone(null)}>
          <TouchableOpacity activeOpacity={1} className="bg-white w-full rounded-[30px] p-6">
            <View className="flex-row justify-between items-start mb-4">
              <View className="px-3 py-1 rounded-full bg-slate-100">
                <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedPhone?.brand}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPhone(null)} className="p-1">
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text className="text-[9px] font-black text-amber-600 uppercase mb-1">{t('ref')}: {selectedPhone?.id}</Text>
            <Text className="text-xl font-black text-slate-900 leading-snug mb-6">{selectedPhone?.name}</Text>
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