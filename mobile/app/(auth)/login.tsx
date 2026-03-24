import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    try {
      // Use your laptop's IP address if testing on a real phone, 
      // or 10.0.2.2 for Android Emulator, or localhost for iOS Simulator
      const response = await fetch('http://192.168.8.100:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // THE REDIRECT LOGIC
        if (data.role === 'ADMIN') {
          router.replace('/(admin)');
        } else {
          router.replace('/(user)');
        }
      } else {
        Alert.alert("Login Failed", data.message);
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to server");
    }
  };

  return (
    <View className="flex-1 bg-white px-8 justify-center">
      <Text className="text-4xl font-extrabold text-slate-900 mb-8">Sign In</Text>
      
      <View className="space-y-4">
        {/* Email Slot */}
        <View>
          <Text className="text-slate-600 mb-1 ml-1 font-medium">Email</Text>
          <TextInput 
            className="..."
            placeholder="example@company.com"
            value={email} // Add this
            onChangeText={setEmail} // Add this
            autoCapitalize="none" // Recommended for emails
          />
        </View>

        {/* Password Slot */}
        <View className="mt-4">
          <Text className="text-slate-600 mb-1 ml-1 font-medium">Password</Text>
          <TextInput 
            className="..."
            placeholder="••••••••"
            secureTextEntry
            value={password} // Add this
            onChangeText={setPassword} // Add this
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity onPress={handleLogin} className="bg-blue-600 h-14 rounded-xl items-center justify-center mt-8">
          <Text className="text-white text-lg font-bold">Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}