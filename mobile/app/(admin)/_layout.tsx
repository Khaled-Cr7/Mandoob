import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayout() {
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
          title: 'DEVICES',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={22} color={color} />
          )
        }} 
      />
      <Tabs.Screen 
        name="users" 
        options={{ 
          title: 'PERSONNEL',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
          )
        }} 
      />
    </Tabs>
  );
}