import { Stack } from "expo-router";
import "./globals.css"

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="(admin)">
      <Stack.Screen name="(auth)/login" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(user)" />  
    </Stack>
  );
}