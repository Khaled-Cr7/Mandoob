import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Modal, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useFocusEffect } from 'expo-router';

export default function PersonnelManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const generateRandomEmail = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 8; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData({ ...formData, email: `${rand}@mandoob.com` });
  };

  const generateRandomPassword = () => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nums = "0123456789";
    const special = "!@#$%^&*";
    const all = upper + nums + special + "abcdefghijklmnopqrstuvwxyz";
    let pass = upper[Math.floor(Math.random()*26)] + nums[Math.floor(Math.random()*10)] + special[Math.floor(Math.random()*8)];
    for(let i=0; i<7; i++) pass += all[Math.floor(Math.random()*all.length)];
    setFormData({ ...formData, password: pass });
  };

  const validateUser = () => {
    const { email, password } = formData;
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!email.endsWith('@mandoob.com')) {
      Alert.alert("Invalid Email", "Email must end with @mandoob.com");
      return false;
    }
    if (!passRegex.test(password) && !isEditing) {
      Alert.alert("Weak Password", "Must include UpperCase, Number, and Special Character.");
      return false;
    }
    return true;
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/users?search=${search}`);
      const data = await response.json();
      setUsers(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [search]);
  

  useFocusEffect(
    useCallback(() => {
      setSearch(''); // Reset search when tab is focused
    }, [])
  );

  const handleSave = async () => {
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_URL}/admin/users/${currentId}` : `${API_URL}/admin/users`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalVisible(false);
        fetchUsers();
      }
    } catch (e) { Alert.alert("Error", "Action failed"); }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("🚨 Revoke Access", `Are you sure you want to delete ${name}?`, [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          await fetch(`${API_URL}/admin/users/${id}`, { method: 'DELETE' });
          fetchUsers();
      }}
    ]);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({ name: '', email: '', password: '' });
    setIsModalVisible(true);
  };


  const handleOpenEdit = (user: any) => {
    setIsEditing(true);
    setCurrentId(user.id);
    setFormData({ name: user.name, email: user.email, password: '' });
    setIsModalVisible(true);
  };

  return (
    <View className="flex-1 bg-slate-900">
      
      {/* --- CONSOLE HEADER --- */}
      <View className="pt-14 px-6 pb-8 bg-slate-900">
        <Text className="text-amber-500 text-[10px] font-black uppercase tracking-[3px]">System Admin</Text>
        <Text className="text-3xl font-black text-white tracking-tighter mb-6">Personnel</Text>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-800 rounded-2xl px-4 h-14 mb-6 border border-slate-700 shadow-inner">
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput 
            placeholder="Search..." 
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
      </View>

      {/* --- STAFF DATA TERMINAL --- */}
      <View className="flex-1 bg-slate-50 rounded-t-[45px] shadow-2xl border-t border-slate-200">
        <View className="px-8 py-6">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[2px]">Active Personnel</Text>
        </View>

        <FlatList
          data={users}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item } : any) => (
            <View className="mx-6 mb-3 p-4 bg-white rounded-[28px] border border-slate-100 shadow-sm flex-row justify-between items-center">
              <View className="flex-row items-center flex-1">
                {/* Avatar on the Left */}
                <View className="border-2 border-slate-100 rounded-full p-0.5">
                    <Image 
                        source={{ uri: item.avatar }} 
                        className="w-12 h-12 rounded-full"
                    />
                </View>
                <View className="ml-4">
                  <Text className="text-lg font-black text-slate-900 leading-5">{item.name}</Text>
                  <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{item.email}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row space-x-1">
                <TouchableOpacity onPress={() => handleOpenEdit(item)} className="p-2.5 bg-slate-900 rounded-xl shadow-lg">
                  <Ionicons name="pencil" size={14} color="#fbbf24" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                  <Ionicons name="trash" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            loading ? (
              <View className="items-center mt-20">
                <ActivityIndicator size="large" color="#0f172a" />
                <Text className="text-slate-400 font-black mt-4 uppercase text-[10px]">Accessing Database...</Text>
              </View>
            ) : (
              <View className="items-center mt-20 px-10">
                <Ionicons name="person-remove-outline" size={40} color="#cbd5e1" />
                <Text className="text-slate-400 font-black text-center mt-4 text-[11px] uppercase tracking-widest">
                  No personnel found matching "{search}"
                </Text>
              </View>
            )
          }
        />

        {/* --- ADD NEW USER BUTTON --- */}
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity 
            onPress={handleOpenAdd}
            className="bg-slate-900 h-16 rounded-[24px] flex-row justify-center items-center shadow-2xl border-t border-slate-800"
          >
            <View className="bg-amber-500 rounded-full p-1 mr-3">
              <Ionicons name="person-add" size={18} color="#0f172a" />
            </View>
            <Text className="text-white font-black text-base tracking-tight uppercase">Add New Personnel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- ADD / EDIT USER MODAL --- */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/60">
          <View className="bg-slate-900 rounded-t-[45px] p-8 border-t-2 border-amber-500/30">
            <View className="w-12 h-1 bg-slate-700 rounded-full self-center mb-6" />
            
            <Text className="text-amber-500 font-black text-[10px] uppercase tracking-[3px] mb-2">
                {isEditing ? 'Access Level: Edit' : 'Access Level: Create'}
            </Text>
            <Text className="text-3xl font-black text-white mb-8 tracking-tighter">
                {isEditing ? 'Modify Profile' : 'New User Enrollment'}
            </Text>

            <View className="gap-y-4">
              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">Full Name</Text>
                <TextInput 
                  placeholder="Enter Name" 
                  placeholderTextColor="#475569" 
                  value={formData.name}
                  onChangeText={(t) => setFormData({...formData, name: t})}
                  className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" 
                />
              </View>

              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">Email Address</Text>
                <TextInput 
                  placeholder="name@mandoob.com" 
                  placeholderTextColor="#475569" 
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(t) => setFormData({...formData, email: t})}
                  className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" 
                />
                <TouchableOpacity onPress={generateRandomEmail} className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  <Ionicons name="shuffle" size={20} color="#fbbf24" />
                </TouchableOpacity>
              </View>

              <View>
                <Text className="text-slate-500 text-[9px] font-black uppercase ml-1 mb-2">Password</Text>
                <TextInput 
                  placeholder="••••••••" 
                  placeholderTextColor="#475569" 
                  secureTextEntry
                  value={formData.password}
                  onChangeText={(t) => setFormData({...formData, password: t})}
                  className="bg-slate-800 text-white p-4 rounded-2xl border border-slate-700 font-bold" 
                />
              </View>
            </View>

            <View className="flex-row mt-10 gap-x-3">
              <TouchableOpacity onPress={() => setIsModalVisible(false)} className="flex-1 bg-slate-800 h-16 rounded-[24px] justify-center items-center">
                <Text className="text-slate-400 font-black text-xs uppercase">Discard</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleSave} className="flex-[2] bg-amber-500 h-16 rounded-[24px] justify-center items-center">
                <Text className="text-slate-900 font-black text-xs uppercase">
                    {isEditing ? 'Apply Changes' : 'Confirm Enrollment'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}