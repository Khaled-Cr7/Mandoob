import React from 'react';
import { View, Text } from 'react-native';

export default function ProfileScreen() {
  return (
    <View className="flex-1 bg-slate-50 items-center justify-center">
      <Text className="text-2xl font-black text-slate-900">User Profile</Text>
      <Text className="text-slate-500 mt-2 font-bold uppercase text-xs tracking-widest">
        Configuration coming soon
      </Text>
    </View>
  );
}