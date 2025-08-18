class AdminNotifications {
  constructor(db, auth) {
    this.db = db;
    this.auth = auth;
    this.messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
    this.VAPID_KEY = "BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY";
    
    if (this.messaging) {
      this.setupMessageHandling();
    }
  }

  setupMessageHandling() {
    this.messaging.onMessage((payload) => {
      console.log('Foreground message:', payload);
      this.showNotification(payload.notification?.body || 'New message');
    });
  }

  async sendNotificationToUser(phoneNumber, title, body, data = {}) {
    try {
      const tokensSnapshot = await this.db.collection('fcmTokens')
        .where('phoneNumber', '==', phoneNumber)
        .get();

      if (tokensSnapshot.empty) return false;

      const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
      
      await this.messaging.sendMulticast({
        tokens,
        notification: { title, body },
        data: {
          ...data,
          click_action: data.click_action || `https://${window.location.hostname}`
        },
        webpush: {
          fcmOptions: {
            link: data.click_action || `https://${window.location.hostname}`
          }
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  async sendBroadcastNotification(title, body, type) {
    const batch = this.db.batch();
    let successCount = 0;
    
    const tokensSnapshot = await this.db.collection('fcmTokens').get();
    
    for (const doc of tokensSnapshot.docs) {
      const userData = doc.data();
      
      try {
        await this.sendNotificationToUser(
          userData.phoneNumber,
          title,
          body,
          { type }
        );
        
        const notificationRef = this.db.collection('notifications').doc();
        batch.set(notificationRef, {
          title,
          body,
          type,
          phoneNumber: userData.phoneNumber,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        successCount++;
      } catch (error) {
        console.error(`Failed for user ${userData.phoneNumber}:`, error);
      }
    }
    
    await batch.commit();
    return successCount;
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}