import { Stack } from 'expo-router';

export default function UserLayout() {
  // Eventually, we will add: if (!isAdmin) return <Redirect href="/login" />
  return <Stack screenOptions={{ headerShown: false }} />;
}