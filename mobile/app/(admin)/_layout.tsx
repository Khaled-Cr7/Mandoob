import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../context/SessionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLayout() {
  const {t} = useTranslation();  
  const { userRole, loading } = useSession();
  const insets = useSafeAreaInsets();

  if (loading) return null;

  if (userRole !== 'ADMIN') {
    return <Redirect href="/(user)" />;
  }

  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: '#fbbf24',
      tabBarInactiveTintColor: '#64748b',
      tabBarStyle: { 
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
        height: 50 + insets.bottom,
        paddingBottom: 12 + insets.bottom,
        paddingTop: 2
      },
      tabBarLabelStyle: {
        fontSize: 8,
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
          title: t('admins'),
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
      <Tabs.Screen 
        name="notifications" // This must match your filename (notifications.tsx)
        options={{ 
          href: null, // THIS HIDES IT FROM THE TAB BAR
        }} 
      />

    </Tabs>
  );
}