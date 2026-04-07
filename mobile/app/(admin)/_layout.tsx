import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function AdminLayout() {
  const {t} = useTranslation();  
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: '#fbbf24', // Amber-400
      tabBarInactiveTintColor: '#64748b', // Slate-500
      tabBarStyle: { 
        backgroundColor: '#0f172a', // Deep Navy (Slate-900)
        borderTopWidth: 1,
        borderTopColor: '#1e293b', // Slate-800
        height: 70,
        paddingBottom: 12,
        paddingTop: 8
      },
      tabBarLabelStyle: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1
      }
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: t('devices'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={22} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="users" 
        options={{ 
          title: t('user'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
          )
        }} 
      />
      <Tabs.Screen
        name="admins"
        options={{
          title: "ADMINS",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "shield-checkmark" : "shield-checkmark-outline"} size={22} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="devices-secure"
        options={{
          title: t('security'), // or "ACCESS"
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "hardware-chip" : "hardware-chip-outline"} size={22} color={color} />
          )
        }}
      />
      <Tabs.Screen 
        name="changes" // This must match your filename (notifications.tsx)
        options={{ 
          href: null, // THIS HIDES IT FROM THE TAB BAR
        }} 
      />

    </Tabs>
  );
}