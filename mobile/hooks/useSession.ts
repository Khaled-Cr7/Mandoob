// hooks/useSession.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 👈 Added loading state
  const router = useRouter();

  useEffect(() => {
    const getID = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setUserId(id);
      } catch (e) {
        console.error("Failed to load session", e);
      } finally {
        setLoading(false); // 👈 Fetching is done
      }
    };
    getID();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('userId');
    setUserId(null); // Clear state immediately
    router.replace('/(auth)/login');
  };

  return { userId, logout, loading };
}