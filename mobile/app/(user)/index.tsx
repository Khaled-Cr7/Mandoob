import { View, Text } from 'react-native';

export default function UserHome() {
  return (
    <View className="flex-1 bg-blue-50 items-center justify-center">
      <View className="p-6 bg-white rounded-2xl shadow-md border border-blue-100">
        <Text className="text-3xl font-bold text-blue-600">User Home</Text>
        <Text className="text-slate-500 mt-2 text-center">Welcome back!</Text>
      </View>
    </View>
  );
}