import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../index';

const expo = new Expo();

export async function sendBroadcastNotification(log: any, excludeUserId?: number) {
  const devices = await prisma.userDevice.findMany({
    where: {
      pushToken: { not: null },
      status: 'ACTIVE',
      NOT: excludeUserId ? { userId: excludeUserId } : undefined
    }
  });

  let brandName = "";
  if (log.brandId) {
    try {
      const brandRecord = await prisma.brand.findUnique({
        where: { id: Number(log.brandId) }
      });
      // If found, add a space after it so it separates cleanly from the model name
      if (brandRecord) {
        brandName = `${brandRecord.name} `; 
      }
    } catch (e) {
      console.error("❌ Failed to fetch brand name for push notification:", e);
    }
  }


  const messages: ExpoPushMessage[] = [];

  for (const device of devices) {
    if (!device.pushToken || !Expo.isExpoPushToken(device.pushToken)) continue;

    const title = "Update";
    let body = "";

    // Handle payload generation purely in English
    if (log.type === 'PRICE_UPDATE') {
      body = `New Price:\n${brandName}${log.modelName} = ${log.newValue} SAR`;
    } else if (log.type === 'ADDED') {
      body = `New Model:\n${brandName}${log.modelName} = ${log.newValue} SAR`;
    }

    if (body) {
      messages.push({
        to: device.pushToken,
        sound: 'default',
        title,
        body,
        data: { modelName: log.modelName },
      });
    }
  }

  // Chunk and Send
  let chunks = expo.chunkPushNotifications(messages);
  for (let chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error("❌ Push Error:", error);
    }
  }
}