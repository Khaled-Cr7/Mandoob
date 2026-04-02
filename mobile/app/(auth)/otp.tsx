import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../constants';
import { useTranslation } from 'react-i18next';

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
    if (e.nativeEvent.key === 'Backspace') {
      // 1. If box has a value, clear it and jump back immediately
      if (userEnteredCode[index] !== '') {
        const newCode = [...userEnteredCode];
        newCode[index] = '';
        setUserEnteredCode(newCode);
        if (index > 0) inputs.current[index - 1]?.focus();
      } 
      // 2. If box was already empty, just jump back
      else if (index > 0) {
        inputs.current[index - 1]?.focus();
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
      if (data.status === 'ACTIVE') {
        router.replace('/(user)');
        return;
      }

      if (data.expiresAt) {
        // THIS IS THE FIX: Update the state so the 1-second useEffect sees it
        setExpiryTimeFromDB(data.expiresAt); 
        calculateExpiry(data.expiresAt);
      }
    } catch (e) { console.error(e); }
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
    // 1. Get the new character (if they typed "55", take the last "5")
    const char = text.length > 1 ? text.charAt(text.length - 1) : text;
    
    // 2. Update the state
    const newCode = [...userEnteredCode];
    newCode[index] = char;
    setUserEnteredCode(newCode);

    // 3. THE FIX: Jump even if it's the same number
    // If the text has length (meaning a key was pressed) and we aren't at the end
    if (text.length > 0 && index < 3) {
      // We use a small timeout to ensure the state has "accepted" the press
      // before we yank the focus away to the next box
      setTimeout(() => {
        inputs.current[index + 1]?.focus();
      }, 10);
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

      if (res.ok) {
        router.replace('/(user)');
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
      // We determine where the user SHOULD be
      const firstEmptyIndex = userEnteredCode.findIndex(c => c === '');
      const targetIndex = firstEmptyIndex === -1 ? 3 : firstEmptyIndex;

      return (
        <TextInput
          key={index}
          ref={(el) => { if (el) inputs.current[index] = el; }}
          editable={!isExpired} 
          onFocus={() => {
            // Focus Magnet Logic from before
            const firstEmpty = userEnteredCode.findIndex(c => c === '');
            const target = firstEmpty === -1 ? 3 : firstEmpty;
            if (index > target) {
              inputs.current[target]?.focus();
            }
          }}
          className={`w-[70px] h-20 bg-slate-800 border-2 rounded-2xl text-white text-3xl font-black text-center 
            ${isExpired ? 'border-red-500' : 'border-slate-700'}`}
          
          maxLength={2}
          keyboardType="number-pad"
          contextMenuHidden={true}
          selectTextOnFocus={true}
          onChangeText={(text) => handleInput(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
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