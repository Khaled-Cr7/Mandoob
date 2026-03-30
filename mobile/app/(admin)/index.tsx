import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useFocusEffect } from 'expo-router';
import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

export default function AdminPhoneManagement() {
  const { t } = useTranslation();
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(['ALL']);
  const [sortOrder, setSortOrder] = useState<'NEW' | 'OLD'>('NEW');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // --- NEW: FORM & MODAL STATES ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', brand: '', price: '' });

  

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch(`${API_URL}/phones/brands`);
        const data = await response.json();
        setAvailableBrands(data);
      } catch (error) {
        setAvailableBrands(['SAMSUNG', 'HONOR', 'TECHNO', 'INFINIX']); 
      }
    };
    fetchBrands();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPhones();
    setRefreshing(false);
  }, []);

  const fetchPhones = async () => {
    setLoading(true);
    try {
      const brandQuery = selectedBrands.includes('ALL') ? 'ALL' : selectedBrands.join(',');
      const url = `${API_URL}/phones?brands=${brandQuery}&sort=${sortOrder}&search=${search}`;
      const response = await fetch(url);
      const data = await response.json();
      setPhones(data);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhones();
  }, [selectedBrands, sortOrder, search]);

  useFocusEffect(
    useCallback(() => {
      setSearch(''); // Your existing search reset
    }, [])
  );

  // --- NEW: MODAL HANDLERS ---
  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ id: '', name: '', brand: availableBrands[0] || 'SAMSUNG', price: '' });
    setIsModalVisible(true);
  };

  const openEditModal = (phone: any) => {
    setIsEditing(true);
    setFormData({ 
        id: phone.id, 
        name: phone.name, 
        brand: phone.brand, 
        price: phone.price.toString() 
    });
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.price) {
      Alert.alert(t('missing_data'), t('missing_data_msg'));
      return;
    }

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const endpoint = isEditing ? `${API_URL}/phones/${formData.id}` : `${API_URL}/phones`;
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, price: parseFloat(formData.price) })
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

  const toggleBrand = (brand: string) => {
    if (brand === 'ALL') {
      setSelectedBrands(['ALL']);
      return;
    }
    let newSelected = [...selectedBrands].filter(b => b !== 'ALL');
    if (newSelected.includes(brand)) {
      newSelected = newSelected.filter(b => b !== brand);
      if (newSelected.length === 0) newSelected = ['ALL'];
    } else {
      newSelected.push(brand);
    }
    setSelectedBrands(newSelected);
  };

  const handleDelete = (id: string) => {
    Alert.alert(t('system_delete'), `${t('confirm_removal')}: ${id}?`, [
      { text: t('cancel'), style: "cancel" },
      { 
        text: t('delete'), 
        style: "destructive", 
        onPress: async () => {
          try {
            await fetch(`${API_URL}/phones/${id}`, { method: 'DELETE' });
            fetchPhones();
          } catch (e) {
            Alert.alert(t('error'), t('server_rejected'));
          }
        } 
      }
    ]);
  };

  return (
    <View className="flex-1 bg-slate-900">
      
      {/* --- CONSOLE HEADER --- */}
      <View className="pt-14 px-6 pb-8 bg-slate-900">
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
        <View>
          <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">{t('filter_source')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity 
              onPress={() => toggleBrand('ALL')}
              className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.includes('ALL') ? 'bg-amber-500 border-amber-400' : 'bg-transparent border-slate-800'}`}
            >
              <Text className={`font-black text-[11px] ${selectedBrands.includes('ALL') ? 'text-slate-900' : 'text-slate-500'}`}>ALL</Text>
            </TouchableOpacity>
            {availableBrands.map((brand) => (
              <TouchableOpacity 
                key={brand}
                onPress={() => toggleBrand(brand)}
                className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.includes(brand) ? 'bg-amber-500 border-amber-400' : 'bg-transparent border-slate-800'}`}
              >
                <Text className={`font-black text-[11px] ${selectedBrands.includes(brand) ? 'text-slate-900' : 'text-slate-500'}`}>{brand}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* --- THE MAIN DATA TERMINAL --- */}
      <View className="flex-1 bg-slate-50 rounded-t-[45px] shadow-2xl border-t border-slate-200">
        <View className="flex-row justify-between items-center px-8 py-6">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">{t('active_records')}</Text>
          <TouchableOpacity onPress={() => setSortOrder(sortOrder === 'NEW' ? 'OLD' : 'NEW')} className="flex-row items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Text className="text-slate-600 font-bold text-[9px] uppercase tracking-tighter mr-2">
              {sortOrder === 'NEW' ? t('latest') : t('oldest')}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748b" />
          </TouchableOpacity>
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
               <Ionicons name="file-tray-outline" size={40} color="#cbd5e1" />
               <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">{t('no_results')} "{search}"</Text>
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
                        key={b} 
                        onPress={() => setFormData({...formData, brand: b})} 
                        className={`mr-2 px-5 py-2.5 rounded-xl border-2 ${formData.brand === b ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700'}`}
                    >
                        <Text className={`font-black text-[10px] ${formData.brand === b ? 'text-slate-900' : 'text-slate-400'}`}>{b}</Text>
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
    </View>
  );
}