import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();
const prisma = new PrismaClient();

export async function sendBroadcastNotification(title: string, body: string) {
  // 1. Get all active tokens
  const devices = await prisma.userDevice.findMany({
    where: {
      pushToken: { not: null },
      status: 'ACTIVE', 
    },
    select: { pushToken: true }
  });

  let messages: ExpoPushMessage[] = [];
  
  for (let device of devices) {
    if (!device.pushToken || !Expo.isExpoPushToken(device.pushToken)) {
      console.error(`Invalid token: ${device.pushToken}`);
      continue;
    }

    messages.push({
      to: device.pushToken,
      sound: 'default',
      title: title,
      body: body,
      priority: 'high',
      data: { screen: 'Notifications' }, // Tells app where to go when tapped
    });
  }

  // 2. Expo requires "chunking" for large batches
  let chunks = expo.chunkPushNotifications(messages);
  
  for (let chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error("❌ Error sending push chunk:", error);
    }
  }
}