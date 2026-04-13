import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../index';

const expo = new Expo();

export async function sendBroadcastNotification(log: any, excludeUserId?: number) {
  const devices = await prisma.userDevice.findMany({
    where: {
      pushToken: { not: null },
      status: 'ACTIVE',
      NOT: excludeUserId ? { userId: excludeUserId } : undefined
    },
    include: {
      user: { select: { language: true } }
    }
  });

  const messages: ExpoPushMessage[] = [];

  for (const device of devices) {
    if (!Expo.isExpoPushToken(device.pushToken)) continue;

    const lang = device.user.language || 'en';
    let title = lang === 'ar' ? "تحديث كنوز" : "Kunooz Update";
    let body = "";

    // 2. SMART MESSAGE LOGIC
    if (log.type === 'PRICE_UPDATE') {
      const isDrop = parseFloat(log.newPrice!) < parseFloat(log.oldPrice!);
      
      if (lang === 'ar') {
        body = isDrop 
          ? `انخفاض السعر! ${log.modelName} الآن بـ ${log.newPrice} ر.س`
          : `تحديث السعر: ${log.modelName} أصبح ${log.newPrice} ر.س`;
      } else {
        body = isDrop 
          ? `Price Drop! ${log.modelName} is now ${log.newPrice} SAR`
          : `Price Update: ${log.modelName} is now ${log.newPrice} SAR`;
      }
    } else if (log.type === 'ADDED') {
      body = lang === 'ar' 
        ? `وصول جديد: ${log.modelName} متوفر الآن!` 
        : `New Arrival: ${log.modelName} is now available!`;
    }

    messages.push({
      to: device.pushToken,
      sound: 'default',
      title,
      body,
      data: { modelName: log.modelName },
    });
  }

  // 3. Chunk and Send
  let chunks = expo.chunkPushNotifications(messages);
  for (let chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error("Push Error:", error);
    }
  }
}