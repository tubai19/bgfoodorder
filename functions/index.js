const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendOrderNotification = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    
    if (newData.status === previousData.status) return null;
    
    const tokensSnapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('phoneNumber', '==', newData.phoneNumber)
      .get();
    
    if (tokensSnapshot.empty) return null;
    
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      // Check preferences
      if (data.preferences && data.preferences.statusUpdates === false) return;
      tokens.push(data.token);
    });

    if (tokens.length === 0) return null;
    
    let title, body;
    switch(newData.status) {
      case 'preparing':
        title = 'Order Update';
        body = `Your order #${context.params.orderId.substring(0, 6)} is being prepared`;
        break;
      case 'on_the_way':
        title = 'Order Update';
        body = `Your order #${context.params.orderId.substring(0, 6)} is on its way!`;
        break;
      case 'delivered':
        title = 'Order Delivered!';
        body = `Your order #${context.params.orderId.substring(0, 6)} has been delivered. Enjoy!`;
        break;
      default:
        return null;
    }
    
    const payload = {
      notification: {
        title,
        body,
        icon: '/android-chrome-192x192.png',
        badge: '/badge.png'
      },
      data: {
        orderId: context.params.orderId,
        type: 'order_update',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };
    
    return admin.messaging().sendToDevice(tokens, payload);
  });

exports.sendPromotionalNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Only authenticated users can send notifications');
  }

  const { title, message, targetUsers } = data;
  
  let tokensSnapshot;
  if (targetUsers === 'all') {
    tokensSnapshot = await admin.firestore()
      .collection('fcmTokens')
      .where('preferences.specialOffers', '==', true)
      .get();
  } else {
    // Handle specific target users
  }

  const tokens = [];
  tokensSnapshot.forEach(doc => {
    tokens.push(doc.data().token);
  });

  if (tokens.length === 0) {
    return { success: false, message: 'No eligible recipients' };
  }

  const payload = {
    notification: {
      title,
      body: message,
      icon: '/android-chrome-192x192.png',
      badge: '/badge.png'
    },
    data: {
      type: 'promotion',
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    }
  };

  try {
    await admin.messaging().sendToDevice(tokens, payload);
    return { success: true, message: `Notification sent to ${tokens.length} users` };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new functions.https.HttpsError('internal', 'Error sending notifications');
  }
});