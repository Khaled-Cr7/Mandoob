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
    if (!device.pushToken || !Expo.isExpoPushToken(device.pushToken)) continue;

    const lang = device.user.language || 'en';
    const isArabic = lang === 'ar';

    let title = isArabic ? "تحديث" : "Update";
    let body = "";

    // Strictly using the types from your original code
    if (log.type === 'PRICE_UPDATE') {
      body = isArabic 
        ? `تحديث السعر: ${log.modelName} أصبح ${log.newValue} ر.س`
        : `Price Update: ${log.modelName} is now ${log.newValue} SAR`;
    } else if (log.type === 'ADDED') {
      const price = log.newValue ? (isArabic ? `${log.newValue} ر.س` : `${log.newValue} SAR`) : '';
      body = isArabic 
        ? `هاتف جديد: ${log.modelName}${price ? ` - ${price}` : ''}` 
        : `New Phone: ${log.modelName}${price ? ` - ${price}` : ''}`;
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