import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, DevSettings } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { router, useFocusEffect } from 'expo-router';
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';
import i18n from '@/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '@/hooks/useSession';

export default function AdminPhoneManagement() {
  const { t } = useTranslation();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]); 
  const [availableBrands, setAvailableBrands] = useState<{id: number, name: string}[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isBrandModalVisible, setIsBrandModalVisible] = useState(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [brandForm, setBrandForm] = useState({ id: null as number | null, name: '' });
  const [sortType, setSortType] = useState<'ID' | 'DATE'>('ID'); // Default: Alphabetical Ref
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Default: A-Z
  const { userId } = useSession() || {};


  // --- NEW: FORM & MODAL STATES ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', brandId: null as number | null, price: '' });

  

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch(`${API_URL}/phones/brands`);
        const data = await response.json();
        setAvailableBrands(data);
      } catch (error) {
        console.error("Brand fetch failed:", error);
      }
    };
    fetchBrands();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPhones();
    setRefreshing(false);
  }, []);


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


  const fetchPhones = async () => {
    setLoading(true);
    try {
      const brandQuery = selectedBrands.length === 0 ? 'ALL' : selectedBrands.join(',');
      // Pass both sort parameters to the backend
      const url = `${API_URL}/phones?brands=${brandQuery}&sortType=${sortType}&sortOrder=${sortOrder}&search=${search}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setPhones(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhones();
  }, [selectedBrands, sortType, sortOrder, search]);

  useFocusEffect(
    useCallback(() => {
      setSearch(''); // Your existing search reset
    }, [])
  );

  // --- NEW: MODAL HANDLERS ---
  const openAddModal = () => {
    setIsEditing(false);
    // Default to the first brand ID available
    setFormData({ 
      id: '', 
      name: '', 
      brandId: availableBrands[0]?.id || null, 
      price: '' 
    });
    setIsModalVisible(true);
  };

  const openEditModal = (phone: any) => {
    setIsEditing(true);
    // Find the ID of the brand based on the name from the phone object
    const brandObj = availableBrands.find(b => b.name === phone.brand);
    setFormData({ 
      id: phone.id, 
      name: phone.name, 
      brandId: brandObj ? brandObj.id : null, 
      price: phone.price.toString() 
    });
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.price || !formData.brandId) {
      Alert.alert(t('missing_data'), t('missing_data_msg'));
      return;
    }

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const endpoint = isEditing ? `${API_URL}/phones/${formData.id}` : `${API_URL}/phones`;
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          price: parseFloat(formData.price),
          userId: Number(userId)
        })
      });

      if (response.ok) {
        setIsModalVisible(false);
        fetchPhones();
      } else {
        const err = await response.json();
        Alert.alert(t('system_error'), err.message || t('action_failed'));
      }
    } catch (e) {
      Alert.alert(t('connection_error'), t('db_reach_error'));
    }
  };

  const toggleBrand = (id: number | 'ALL') => {
    if (id === 'ALL') {
      setSelectedBrands([]);
      return;
    }
    if (selectedBrands.includes(id)) {
      setSelectedBrands(selectedBrands.filter(b => b !== id));
    } else {
      setSelectedBrands([...selectedBrands, id]);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('system_delete'), `${t('confirm_removal')}: ${id}?`, [
      { text: t('cancel'), style: "cancel" },
      { 
        text: t('delete'), 
        style: "destructive", 
        onPress: async () => {
          try {
            await fetch(`${API_URL}/phones/${id}`, { 
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: Number(userId) }) 
            });
            fetchPhones();
          } catch (e) {
            Alert.alert(t('error'), t('server_rejected'));
          }
        } 
      }
    ]);
  };

  
  const handleDeleteBrand = async (id: number) => {
    // 1. CONFIRMATION ALERT
    Alert.alert(
      t('system_delete'), 
      t('delete_brand_msg'), 
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('delete'), 
          style: 'destructive', 
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/phones/brands/${id}`, { 
                method: 'DELETE' 
              });

              if (res.ok) {
                // 2. SUCCESS: Remove from local state immediately
                setAvailableBrands(prev => prev.filter(b => b.id !== id));
                
                // 3. CLEANUP: If the user was editing THIS brand, reset the form
                if (brandForm.id === id) {
                  setBrandForm({ id: null, name: '' });
                }
              } else {
                // 4. DATABASE PROTECTION: 
                // Usually fails if phones are still linked to this brandId
                const errData = await res.json();
                Alert.alert(t('error'), t('brand_in_use'));
              }
            } catch (e) {
              Alert.alert(t('error'), t('connection_error'));
            }
          } 
        }
      ]
    );
  };

  const handleSaveBrand = async () => {
    const trimmedName = brandForm.name.trim();

    // 1. EMPTY INPUT CHECK
    if (!trimmedName) {
      Alert.alert(t('error'), t('brand_name_required'));
      return;
    }

    // 2. DUPLICATE CHECK (Local check before hitting server)
    const exists = availableBrands.some(
      (b) => b.name.toUpperCase() === trimmedName.toUpperCase() && b.id !== brandForm.id
    );
    if (exists) {
      Alert.alert(t('error'), t('brand_exists'));
      return;
    }

    setIsSavingBrand(true);
    const isEditing = brandForm.id !== null;
    const url = isEditing 
      ? `${API_URL}/phones/brands/${brandForm.id}` 
      : `${API_URL}/phones/brands`;

    try {
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });

      const data = await res.json();

      if (res.ok) {
        setBrandForm({ id: null, name: '' });
        // Refresh the local list
        const response = await fetch(`${API_URL}/phones/brands`);
        const updatedData = await response.json();
        setAvailableBrands(updatedData);
        
        // Optional: Success message
        // Alert.alert(t('success'), isEditing ? t('brand_updated') : t('brand_added'));
      } else {
        // 3. SERVER-SIDE ERROR (e.g., Database unique constraint failed)
        Alert.alert(t('error'), data.message || t('action_failed'));
      }
    } catch (e) {
      Alert.alert(t('error'), t('connection_error'));
    } finally {
      setIsSavingBrand(false);
    }
  };

  return (
    <View className="flex-1 bg-slate-900">
      
      {/* --- CONSOLE HEADER --- */}
      <View className="pt-14 px-6 pb-8 bg-slate-900">
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
            <Text className="text-amber-500 text-[10px] font-black uppercase tracking-[3px]">{t('system_admin')}</Text>
            <Text className="text-3xl font-black text-white tracking-tighter">{t('inventory')}</Text>
            
          </View>
        </View>
        
        {/* Integrated Search */}
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

        {/* Brand Scrollbox */}
        <View className="mb-6">
          <View className="flex-row justify-between items-end mb-3 mt-4">
            <View>
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">
                {t('filter_source')}
              </Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => setIsBrandModalVisible(true)}
              className="flex-row items-center bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700"
            >
              <Ionicons name="settings-sharp" size={12} color="#fbbf24" />
              <Text className="text-amber-500 font-black text-[9px] ml-2 uppercase">
                {t('manage_brands')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity 
              onPress={() => toggleBrand('ALL')}
              className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.length === 0 ? 'bg-amber-500 border-amber-400' : 'bg-transparent border-slate-800'}`}
            >
              <Text className={`font-black text-[11px] ${selectedBrands.length === 0 ? 'text-slate-900' : 'text-slate-500'}`}>ALL</Text>
            </TouchableOpacity>
            {availableBrands.map((brand) => (
              <TouchableOpacity 
                key={brand.id}
                onPress={() => toggleBrand(brand.id)}
                className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.includes(brand.id) ? 'bg-amber-500 border-amber-400' : 'bg-transparent border-slate-800'}`}
              >
                <Text className={`font-black text-[11px] ${selectedBrands.includes(brand.id) ? 'text-slate-900' : 'text-slate-500'}`}>{brand.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* --- THE MAIN DATA TERMINAL --- */}
      <View className="flex-1 bg-slate-50 rounded-t-[45px] shadow-2xl border-t border-slate-200">
        <View className="flex-row justify-between items-center px-8 py-6">
          <View>
            <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">
              {t('active_records')}
            </Text>
            {/* NEW LOGS BUTTON */}
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/(admin)/changes', params: { userId } })} 
              className="flex-row items-center mt-1"
            >
              <Ionicons name="list-circle-outline" size={14} color="#64748b" />
              <Text className="text-slate-500 font-bold text-[10px] ml-1 border-b border-slate-300">
                {t('view_system_logs')}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-x-2">
            {/* TOGGLE 1: TYPE (ID vs DATE) */}
            <TouchableOpacity 
              onPress={() => setSortType(prev => prev === 'ID' ? 'DATE' : 'ID')}
              className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              <Ionicons name={sortType === 'ID' ? "text" : "calendar"} size={12} color="#64748b" />
              <Text className="text-slate-600 font-bold text-[9px] uppercase ml-2">
                {sortType === 'ID' ? t('sort_ref') : t('sort_date')}
              </Text>
            </TouchableOpacity>

            {/* TOGGLE 2: DIRECTION (ASC vs DESC) */}
            <TouchableOpacity 
              onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="bg-slate-100 p-1.5 rounded-lg border border-slate-200"
            >
              <Ionicons 
                name={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} 
                size={12} 
                color="#3b82f6" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={phones}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
          }
          renderItem={({ item } : any) => (
            <View className="mx-6 mb-3 p-5 bg-white rounded-[28px] border border-slate-100 shadow-sm flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-[10px] font-black text-amber-600 mb-1 tracking-tighter">{t('ref')}: {item.id}</Text>
                <Text className="text-lg font-black text-slate-900 leading-5 mb-2" numberOfLines={1}>{item.name}</Text>
                
                <View className="flex-row">
                  <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    <Text className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{item.brand}</Text>
                  </View>
                </View>
              </View>

              <View className="items-end ml-4">
                <View className="flex-row items-baseline">
                  <Text className="text-xl font-black text-slate-900">{item.price}</Text>
                  <Text className="text-[10px] font-bold text-slate-400 ml-1">{t('currency')}</Text>
                </View>
                <View className="flex-row mt-3 space-x-1">
                  <TouchableOpacity 
                    onPress={() => openEditModal(item)} // OPEN EDIT
                    className="p-2.5 bg-slate-900 rounded-xl shadow-lg"
                  >
                    <Ionicons name="pencil" size={14} color="#fbbf24" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                    <Ionicons name="trash" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            loading ? <ActivityIndicator size="large" color="#0f172a" className="mt-20" /> : 
            <View className="items-center mt-20 px-10">
               <Ionicons 
                name= {search.length > 0 ? "search-outline" : "file-tray-outline"}
                size={40} 
                color="#cbd5e1" />
               <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                {search.length > 0
                ? `${t('no_results')} "${search}"`
                : t('no_inventory_found')}
              </Text>
            </View>
          }
        />

        {/* --- FIXED FLOATING ACTION BAR --- */}
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity 
            onPress={openAddModal} // OPEN ADD
            className="bg-slate-900 h-16 rounded-[24px] flex-row justify-center items-center shadow-2xl border-t border-slate-800"
            style={{ elevation: 10 }}
          >
            <View className="bg-amber-500 rounded-full p-1 mr-3">
              <Ionicons name="add" size={20} color="#0f172a" />
            </View>
            <Text
            numberOfLines={1} 
            adjustsFontSizeToFit 
            minimumFontScale={0.8} 
            className="text-white font-black text-base tracking-tight uppercase">{t('enroll_new_device')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- ADD / EDIT SYSTEM MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          className="flex-1 justify-end bg-black/60"
        >
          <View className="bg-slate-900 rounded-t-[45px] p-8 border-t-2 border-amber-500/30">
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
                  onChangeText={(t) => setFormData({...formData, id: t})} 
                  className={`bg-slate-800 text-white p-4 rounded-2xl border ${isEditing ? 'border-slate-700 text-slate-500' : 'border-slate-700'}`} 
                />
              </View>

              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">{t('model_designation')}</Text>
                <TextInput 
                  placeholder={t('model_name_placeholder')} 
                  placeholderTextColor="#475569" 
                  value={formData.name} 
                  onChangeText={(t) => setFormData({...formData, name: t})} 
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
                  onChangeText={(t) => setFormData({...formData, price: t})} 
                  className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" 
                />
              </View>
            </View>

            <View className="flex-row mt-10 gap-x-3">
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)} 
                className="flex-1 bg-slate-800 h-16 rounded-[24px] justify-center items-center"
              >
                <Text className="text-slate-400 font-black text-xs  uppercase flex-shrink: 0">{t('discard')}</Text> 
              </TouchableOpacity>
              
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

      
      {/* Brand Management Modal */}
      <Modal visible={isBrandModalVisible} animationType="fade" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/80 px-6">
          <View className="bg-slate-900 w-full rounded-[35px] p-8 border border-slate-800">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-black text-white">
                {brandForm.id ? t('edit_brand') : t('manage_brands')}
              </Text>
              <TouchableOpacity onPress={() => {
                setIsBrandModalVisible(false);
                setBrandForm({ id: null, name: '' });
              }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Input Field (Handles both Add and Edit) */}
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

            {/* List of Existing Brands */}
            <View className="max-h-60">
              <FlatList 
                data={availableBrands}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View className="flex-row justify-between items-center py-3 border-b border-slate-800">
                    <Text className="text-slate-300 font-bold">{item.name}</Text>
                    <View className="flex-row gap-x-4">
                      {/* EDIT BUTTON */}
                      <TouchableOpacity onPress={() => setBrandForm({ id: item.id, name: item.name })}>
                        <Ionicons name="pencil-outline" size={18} color="#3b82f6" />
                      </TouchableOpacity>
                      {/* DELETE BUTTON */}
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


    </View>
  );
}