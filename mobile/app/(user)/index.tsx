import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
export default function UserInventoryScreen() {
  const [phones, setPhones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(['ALL']);
  const [sortOrder, setSortOrder] = useState<'NEW' | 'OLD'>('NEW');

  const [availableBrands, setAvailableBrands] = useState<string[]>([]);


  useEffect(() => {
  const fetchBrands = async () => {
    try {
      console.log("📡 Fetching brands from:", `${API_URL}/phones/brands`);
      const response = await fetch(`${API_URL}/phones/brands`);
      
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Brands received:", data);
      setAvailableBrands(data);
    } catch (error) {
      console.error("❌ Brand fetch failed:", error);
      // Fallback so the UI isn't broken if the server is restarting
      setAvailableBrands(['SAMSUNG', 'HONOR', 'TECHNO', 'INFINIX']); 
    }
  };
  fetchBrands();
}, []);


  const toggleBrand = (brand: string) => {
    if (brand === 'ALL') {
      setSelectedBrands(['ALL']);
      return;
    }

    let newSelected = [...selectedBrands].filter(b => b !== 'ALL');

    if (newSelected.includes(brand)) {
      // Remove the brand
      newSelected = newSelected.filter(b => b !== brand);
      // If none left, default back to ALL
      if (newSelected.length === 0) newSelected = ['ALL'];
    } else {
      // Add the brand
      newSelected.push(brand);
    }
    setSelectedBrands(newSelected);
  };

  const fetchPhones = async () => {
    setLoading(true);
    try {
      // Convert array ['SAMSUNG', 'HONOR'] to string "SAMSUNG,HONOR"
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

  return (
    <View className="flex-1 bg-slate-50">
      {/* --- SYSTEM HEADER --- */}
      <View className="pt-14 px-6 pb-6 bg-white border-b border-slate-100">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-blue-600 text-[10px] font-black uppercase tracking-[3px]">Kunooz Albaraka</Text>
            <Text className="text-3xl font-black text-slate-900 tracking-tighter">Inventory</Text>
          </View>
          <TouchableOpacity className="p-3 bg-slate-100 rounded-2xl">
            <Ionicons name="notifications" size={22} color="#1e293b" />
            <View className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 h-14 border border-slate-200 shadow-inner">
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput 
            placeholder="Search devices..." 
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
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Filter Brands</Text>
          <TouchableOpacity 
            onPress={() => setSortOrder(prev => prev === 'NEW' ? 'OLD' : 'NEW')}
            className="flex-row items-center bg-blue-50 px-4 py-2 rounded-xl border border-blue-100"
          >
            <Ionicons name="swap-vertical" size={13} color="#2563eb" />
            <Text className="text-blue-600 font-black ml-1.5 text-[10px] uppercase">
              {sortOrder === 'NEW' ? 'Most Recent ' : 'Oldest '}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
          <TouchableOpacity
            onPress={() => toggleBrand('ALL')}
            className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.includes('ALL') ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-200'}`}
          >
            <Text className={`font-black text-[11px] ${selectedBrands.includes('ALL') ? 'text-white' : 'text-slate-500'}`}>ALL</Text>
          </TouchableOpacity>
          {availableBrands.map((brand) => (
            <TouchableOpacity
              key={brand}
              onPress={() => toggleBrand(brand)}
              className={`px-6 py-2 rounded-xl mr-3 border-2 ${selectedBrands.includes(brand) ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-200'}`}
            >
              <Text className={`font-black text-[11px] ${selectedBrands.includes(brand) ? 'text-white' : 'text-slate-500'}`}>{brand}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* --- DATA LIST --- */}
      <FlatList
        data={phones} 
        className="px-4 py-4"
        contentContainerStyle={{ paddingBottom: 120 }}
        keyExtractor={(item: any, index) => item?.id ? item.id.toString() : index.toString()}
        ListEmptyComponent={
          loading ? (
            <View className="py-20 items-center justify-center">
              <ActivityIndicator size="large" color="#2563eb" />
              <Text className="text-slate-400 font-black mt-4 uppercase text-[10px]">Accessing Stock...</Text>
            </View>
          ) : (
            <View className="flex-1 py-20 items-center justify-center px-10">
              <Ionicons name="phone-portrait-outline" size={48} color="#cbd5e1" />
              <Text className="text-slate-400 font-black mt-4 text-center text-[10px] uppercase tracking-widest">
                No Device found matching "{search}"
              </Text>
            </View>
          )
        }
        renderItem={({ item }: any) => (
          <View className="mb-3 p-5 bg-white rounded-[32px] border border-slate-100 shadow-sm flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-[9px] font-black text-blue-500 mb-1 tracking-widest uppercase">REF: {item.id}</Text>
              <Text className="text-xl font-black text-slate-900 leading-6 mb-2" numberOfLines={1}>
                {item.name}
              </Text>
              <View className="bg-slate-100 self-start px-2 py-1 rounded-lg">
                <Text className="text-[9px] text-slate-500 font-black uppercase">{item.brand}</Text>
              </View>
            </View>

            <View className="bg-blue-50 p-4 rounded-3xl">
              <View className="flex-row items-baseline">
                <Text className="text-xl font-black text-blue-700">{item.price}</Text>
                <Text className="text-[8px] font-black text-blue-400 ml-1">SAR</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}