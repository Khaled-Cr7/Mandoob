import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OTPScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId, deviceId } = useLocalSearchParams();
  const [userEnteredCode, setUserEnteredCode] = useState(['', '', '', '']);
  const [status, setStatus] = useState('PENDING'); // PENDING or DENIED
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const [now, setNow] = useState(new Date());
  const [expiryTimeFromDB, setExpiryTimeFromDB] = useState<string | null>(null);

  // 1. BACKSPACE LOGIC
  const handleKeyPress = (e: any, index: number) => {
    const pressedKey = e.nativeEvent.key;

    // --- 1. HANDLE BACKSPACE (Your existing logic) ---
    if (pressedKey === 'Backspace') {
      if (userEnteredCode[index] !== '') {
        const newCode = [...userEnteredCode];
        newCode[index] = '';
        setUserEnteredCode(newCode);
        if (index > 0) inputs.current[index - 1]?.focus();
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
      }
      return;
    }

    // --- 2. THE SAME-NUMBER FIX (Handle digits 0-9) ---
    if (/^[0-9]$/.test(pressedKey)) {
      // Manually update the state for the current box
      const newCode = [...userEnteredCode];
      newCode[index] = pressedKey;
      setUserEnteredCode(newCode);

      // Force the jump immediately, even if the number is the same!
      if (index < 3) {
        setTimeout(() => {
          inputs.current[index + 1]?.focus();
        }, 10);
      }
    }
  };

  // 2. TIMER LOGIC (Add these states)
  const [expiryTime, setExpiryTime] = useState('05:00');
  const [isExpired, setIsExpired] = useState(false);

  const calculateExpiry = (expiresAt: string) => {
  const diff = new Date(expiresAt).getTime() - new Date().getTime();
    if (diff <= 0) {
        setIsExpired(true);
        setExpiryTime('00:00');
    } else {
        const mins = Math.floor(diff / 1000 / 60);
        const secs = Math.floor((diff / 1000) % 60);
        setExpiryTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        setIsExpired(false);
    }
    };

  
  const handleRequestNewCode = async () => {
    setLoading(true);
    try {
      // We call a new "Resend" endpoint instead of making the user log in again
      const res = await fetch(`${API_URL}/security/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deviceId })
      });
      
      if (res.ok) {
        // Reset the UI to "Fresh" state
        setIsExpired(false);
        setUserEnteredCode(['', '', '', '']);
        checkDeviceStatus(); // Fetch the new code's expiry from DB
      }
    } catch (e) {
      Alert.alert(t('error'), t('connection_error'));
    } finally {
      setLoading(false);
    }
  };

  // 1. POLL ONLY FOR STATUS (Check if Admin blocked them while they were waiting)
  const checkDeviceStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/security/check-status?deviceId=${deviceId}&userId=${userId}`);
      const data = await res.json();
      
      setStatus(data.status);

      // If the device is active, route based on the role we just sent from the backend
      if (data.status === 'ACTIVE') {
        if (data.role === 'ADMIN') {
          router.replace('/(admin)');
        } else {
          router.replace('/(user)');
        }
        return;
      }

      // Update the timer if we found an expiry date
      if (data.expiresAt) {
        setExpiryTimeFromDB(data.expiresAt); 
        calculateExpiry(data.expiresAt);
      }
    } catch (e) { 
      console.error("Polling error:", e); 
    }
  };

  useEffect(() => {
    // 1. Run the status check IMMEDIATELY (Fixes the 5-second delay)
    checkDeviceStatus();

    // 2. Poll the server every 5 seconds for Status (ACTIVE/DENIED)
    const statusInterval = setInterval(() => {
      checkDeviceStatus();
    }, 5000);

    // 3. Update the local "now" time every 1 second (Fixes the Fixed Timer)
    const timerInterval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    // CLEANUP: Stop both intervals when the user leaves the page
    return () => {
      clearInterval(statusInterval);
      clearInterval(timerInterval);
    };
  }, []);

  // 4. Update the visual timer whenever 'now' or 'expiryTimeFromDB' changes
  useEffect(() => {
    if (expiryTimeFromDB) {
      const diff = new Date(expiryTimeFromDB).getTime() - now.getTime();
      if (diff <= 0) {
        setIsExpired(true);
        setExpiryTime('00:00');
      } else {
        const mins = Math.floor(diff / 1000 / 60);
        const secs = Math.floor((diff / 1000) % 60);
        setExpiryTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        setIsExpired(false);
      }
    }
  }, [now, expiryTimeFromDB]);


  // 2. HANDLE CODE INPUT
  const handleInput = (text: string, index: number) => {
    // 1. If text is empty, it's a deletion (handled by handleKeyPress, but safety first)
    if (text.length === 0) {
      const newCode = [...userEnteredCode];
      newCode[index] = '';
      setUserEnteredCode(newCode);
      return;
    }

    // 2. Get the new character (handles the "55" case)
    const char = text.slice(-1); 
    
    // 3. Update the state
    const newCode = [...userEnteredCode];
    newCode[index] = char;
    setUserEnteredCode(newCode);

    // 4. THE MAGIC JUMP:
    // We use a 0ms delay. This ensures the native side finishes 
    // rendering the "5" before we yank the focus to the next box.
    if (index < 3) {
      setTimeout(() => {
        inputs.current[index + 1]?.focus();
      }, 0);
    }
  };

  // 3. VERIFY THE CODE
  const verifyCode = async () => {
  setLoading(true);
  try {
    const fullCode = userEnteredCode.join('');
    const res = await fetch(`${API_URL}/security/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId, code: fullCode })
    });

    const data = await res.json(); // Get user data (including role) from response

    if (res.ok) {
      // 1. Persist the ID immediately (just like in Login)
      await AsyncStorage.setItem('userId', String(data.userId || userId));

      // 2. Logic to route based on Role
      if (data.role === 'ADMIN') {
        router.replace('/(admin)');
      } else {
        router.replace(`/(user)?userId=${userId}`);
      }
      
      console.log("Verified as:", data.role);
    } else {
      Alert.alert(t('error'), t('invalid_code') || "Invalid code. Please try again.");
    }
  } catch (e) {
    Alert.alert(t('error'), t('connection_error'));
  } finally {
    setLoading(false);
  }
};

  // --- RENDER DENIED STATE ---
  if (status === 'DENIED') {
    return (
      <View className="flex-1 bg-slate-900 justify-center items-center px-10">
        <Ionicons name="ban-outline" size={80} color="#ef4444" />
        <Text className="text-white text-2xl font-black text-center mt-6 uppercase">Access Denied</Text>
        <Text className="text-slate-400 text-center mt-4 font-bold">
          This device has been blacklisted. Please contact your system administrator for assistance.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/login')} className="mt-10 border-b border-slate-500 pb-1">
          <Text className="text-slate-400 font-black uppercase tracking-[2px]">{t('back_to_login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- RENDER PENDING (OTP) STATE ---
  return (
    <View className="flex-1 bg-slate-900 justify-center px-8">
      <Text className="text-white text-3xl font-black mb-2">{t('verify_device') || "Verify Device"}</Text>
      <Text className="text-slate-400 font-bold mb-10">{t('enter_admin_code') || "Enter the 4-digit security code provided by your Admin."}</Text>

    {/* THE CODE BOXES */}
    <View className="flex-row justify-between mb-10">
    {userEnteredCode.map((char, index) => {
      const firstEmpty = userEnteredCode.findIndex(c => c === '');
      const target = firstEmpty === -1 ? 3 : firstEmpty;

      return (
        <TextInput
          // 1. STABLE KEY: This stops the keyboard from popping up/down
          key={index} 
          
          ref={(el) => { if (el) inputs.current[index] = el; }}
          editable={!isExpired}
          
          // 2. FORCE BOLDNESS: Using inline style bypasses the NativeWind glitch
          style={{ 
            fontWeight: '900', 
            color: 'white', 
            fontSize: 26,
            textAlign: 'center' 
          }}
          
          // Keep the rest of the layout in Tailwind
          className={`w-[70px] h-20 bg-slate-800 border-2 rounded-2xl 
            ${isExpired ? 'border-red-500' : 'border-slate-700'}`}
          
          maxLength={1}
          keyboardType="number-pad"
          selectTextOnFocus={true}
          
          onChangeText={(text) => {
            if (text.length > 0) handleInput(text, index);
          }}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => {
            if (index > target) {
              inputs.current[target]?.focus();
            }
          }}
          value={userEnteredCode[index]}
        />
      );
    })}
    </View>

    {/* TIMER & RESEND */}
    <View className="items-center mb-8">
    <Text className={`font-black ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
        {isExpired ? "CODE EXPIRED" : `Expires in: ${expiryTime}`}
    </Text>
    
    {isExpired && (
      <TouchableOpacity 
        onPress={handleRequestNewCode} // Use the new function here
        className="mt-4 bg-amber-500 px-8 h-14 rounded-2xl justify-center"
      >
        <Text className="text-slate-900 font-black uppercase">{t('request_new_code')}</Text>
      </TouchableOpacity>
    )}
    </View>

    <TouchableOpacity 
    onPress={verifyCode}
    disabled={isExpired}
    className={`h-16 rounded-2xl items-center justify-center ${isExpired ? 'bg-slate-800' : 'bg-amber-500'}`}
    >
    <Text className="text-slate-900 font-black uppercase text-lg">Verify & Enter </Text>
    </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/login')} className="mt-8 self-center">
        <Text className="text-slate-500 font-black uppercase tracking-widest">{t('back_to_login')}</Text>
      </TouchableOpacity>
    </View>
  );
}