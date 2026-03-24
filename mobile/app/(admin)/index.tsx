import { View, Text } from 'react-native';

export default function AdminDashboard() {
  return (
    <View className="flex-1 bg-slate-900 items-center justify-center">
      <View className="p-6 bg-white rounded-2xl shadow-xl">
        <Text className="text-3xl font-bold text-slate-900">Admin Panel</Text>
        <Text className="text-slate-500 mt-2 text-center">Management Mode</Text>
      </View>
    </View>
  );
}