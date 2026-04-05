// hooks/useSession.ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getID = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    getID();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('userId');
    // add router.replace('/login') here
  };

  return { userId, logout };
}