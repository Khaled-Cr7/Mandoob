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
      {/* --- FIXED TOP SECTION --- */}
      <View className="pt-14 px-6 pb-4 bg-white shadow-sm">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-extrabold text-slate-900">Kunooz Albaraka</Text>
          <TouchableOpacity className="p-2 bg-slate-100 rounded-full">
            <Ionicons name="notifications" size={22} color="#1e293b" />
            {/* Small Red Dot for new notifications */}
            <View className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-100 rounded-xl px-4 h-12 mb-4 border border-slate-200">
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput 
            placeholder="Search by Name or ID..." 
            className="flex-1 ml-2 -mb-2 text-slate-800 font-medium"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>

        {/* Multi-Select Brand Filters */}
        <View>
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2 ml-1">Filter Brands</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            <TouchableOpacity 
              onPress={() => toggleBrand('ALL')}
              className={`px-5 py-2 rounded-full mr-2 ${selectedBrands.includes('ALL') ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <Text className={`font-semibold ${selectedBrands.includes('ALL') ? 'text-white' : 'text-slate-600'}`}>ALL</Text>
            </TouchableOpacity>

            {availableBrands.map((brand) => (
              <TouchableOpacity 
                key={brand}
                onPress={() => toggleBrand(brand)}
                className={`px-5 py-2 rounded-full mr-2 ${selectedBrands.includes(brand) ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <Text className={`font-semibold ${selectedBrands.includes(brand) ? 'text-white' : 'text-slate-600'}`}>
                  {brand}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* --- SCROLLING CONTAINER BOX --- */}
      <View className="flex-1 px-4 mt-4">
        <View className="flex-1 bg-white rounded-t-[30px] shadow-lg border-t border-x border-slate-200 overflow-hidden">
          
          <View className="flex-row justify-between items-center p-5 border-b border-slate-100">
            <Text className="text-lg font-bold text-slate-800">Phones List</Text>
            <TouchableOpacity 
              onPress={() => setSortOrder(sortOrder === 'NEW' ? 'OLD' : 'NEW')}
              className="flex-row items-center bg-blue-50 px-3 py-1 rounded-lg"
            >
              <Ionicons name="swap-vertical" size={14} color="#2563eb" />
              <Text className="text-blue-600 font-bold ml-1 text-[10px]">
                {sortOrder === 'NEW' ? 'MOST RECENT' : 'OLDEST'}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={phones} 
            refreshing={false}
            onRefresh={fetchPhones}
            ListEmptyComponent={
              loading ? (
                <View className="py-20 items-center justify-center">
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text className="text-slate-400 mt-4">Loading inventory...</Text>
                </View>
              ) : (
                <View className="flex-1 py-20 items-center justify-center px-10">
                  <Ionicons name="phone-portrait-outline" size={48} color="#cbd5e1" />
                  <Text className="text-slate-400 mt-4 text-center text-sm">
                    No phones found in stock right now...
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View className="mx-4 my-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex-row justify-between items-center">
                <View className="flex-1">
                  {/* ID Above Name - Professional Stock Look */}
                  <Text className="text-[10px] font-bold text-blue-600 mb-0.5 tracking-tighter">
                    ID: {item.id}
                  </Text>
                  <Text className="text-lg font-bold text-slate-900 leading-5" numberOfLines={1}>
                    {item.name}
                  </Text>
                  
                  {/* Brand Tag with custom background */}
                  <View className="flex-row items-center mt-2">
                    <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      <Text className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                        {item.brand}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Price Section */}
                <View className="items-end ml-4">
                  <View className="flex-row items-baseline">
                    <Text className="text-xl font-black text-slate-900">{item.price}</Text>
                    <Text className="text-[10px] font-bold text-slate-500 ml-1">SAR</Text>
                  </View>
                  {/* Visual Status Indicator (Optional but looks good)
                  <View className="flex-row items-center mt-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                    <Text className="text-[9px] text-slate-400 font-medium">In Stock</Text>
                  </View> */}
                </View>
              </View>
            )}
            keyExtractor={(item: any) => item.id}
          />
        </View>
      </View>
    </View>
  );
}