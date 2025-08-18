class ClientNotifications {
  constructor() {
    this.VAPID_KEY = "BGF2rBiAxvlRiqHmvDYEH7_OXxWLl0zIv9IS-2Ky9letx3l4bOyQXRF901lfKw0P7fQIREHaER4QKe4eY34g1AY";
    this.messaging = null;
    this.currentToken = null;
    
    if (firebase.messaging.isSupported()) {
      this.initialize();
    }
  }

  async initialize() {
    this.messaging = firebase.messaging();
    
    try {
      await Notification.requestPermission();
      this.currentToken = await this.messaging.getToken({
        vapidKey: this.VAPID_KEY
      });
      
      if (this.currentToken) {
        await this.saveTokenToDatabase();
      }
    } catch (error) {
      console.error('Notification initialization failed:', error);
    }
  }

  async saveTokenToDatabase(phoneNumber, preferences = {}) {
    if (!this.currentToken) return;
    
    try {
      await firebase.firestore().collection('fcmTokens').doc(this.currentToken).set({
        token: this.currentToken,
        phoneNumber,
        preferences: {
          statusUpdates: true,
          specialOffers: true,
          ...preferences
        },
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  async updateNotificationPreferences(preferences) {
    if (!this.currentToken) return false;
    
    try {
      await firebase.firestore().collection('fcmTokens')
        .doc(this.currentToken)
        .update({ preferences });
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }

  showLocalNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    const textEl = notification.querySelector('.notification-text') || 
                  document.createElement('div');
    textEl.className = 'notification-text';
    textEl.textContent = message;
    
    notification.className = `notification show ${type}`;
    notification.innerHTML = '';
    notification.appendChild(textEl);
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
}