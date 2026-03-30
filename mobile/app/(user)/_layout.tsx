import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function UserLayout() {

  const { t } = useTranslation();
  
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: '#3b82f6', // Blue-500 (Matches your Inventory theme)
      tabBarInactiveTintColor: '#64748b', // Slate-500
      tabBarStyle: { 
        backgroundColor: '#f8fafc', // Light Slate (Matches User page background)
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0', // Slate-200
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
    </Tabs>
  );
}