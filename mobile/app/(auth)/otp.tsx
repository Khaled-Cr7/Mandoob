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

  // 1. BACKSPACE LOGIC
    const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
        // If current box is empty, jump back
        if (!userEnteredCode[index] && index > 0) {
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
        // Trigger the countdown display immediately
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

    return () => {
        clearInterval(statusInterval);
        clearInterval(timerInterval);
    };
    }, []);


  // 2. HANDLE CODE INPUT
  const handleInput = (text: string, index: number) => {
    const newCode = [...userEnteredCode];
    newCode[index] = text;
    setUserEnteredCode(newCode);

    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
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
    {userEnteredCode.map((char, index) => (
        <TextInput
        key={index}
        ref={(el) => {
            if (el) inputs.current[index] = el;
        }}
        className={`w-[70px] h-20 bg-slate-800 border-2 rounded-2xl text-white text-3xl font-black text-center ${isExpired ? 'border-red-500' : 'border-slate-700'}`}
        maxLength={1}
        keyboardType="number-pad"
        onChangeText={(text) => handleInput(text, index)}
        onKeyPress={(e) => handleKeyPress(e, index)} // <--- BACKSPACE FIX
        value={char}
        />
    ))}
    </View>

    {/* TIMER & RESEND */}
    <View className="items-center mb-8">
    <Text className={`font-black ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
        {isExpired ? "CODE EXPIRED" : `Expires in: ${expiryTime}`}
    </Text>
    
    {isExpired && (
        <TouchableOpacity 
        onPress={() => router.replace('/login')} // Simply logging in again triggers a new code
        className="mt-4 bg-slate-800 px-6 py-3 rounded-xl border border-slate-700"
        >
        <Text className="text-amber-500 font-black uppercase text-xs">Request New Code</Text>
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