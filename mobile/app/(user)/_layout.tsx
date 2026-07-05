import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UserLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: '#3b82f6',
      tabBarInactiveTintColor: '#64748b',
      tabBarStyle: { 
        backgroundColor: '#f8fafc',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
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
            <Ionicons name={focused ? "phone-portrait" : "phone-portrait-outline"} size={22} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: t('my_profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={22} color={color} />
          )
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