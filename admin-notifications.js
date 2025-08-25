class AdminNotifications {
  constructor(db, auth) {
    this.db = db;
    this.auth = auth;
    this.messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
    
    if (this.messaging) {
      this.initMessaging();
    }
  }

  async initMessaging() {
    try {
      // Request permission for notifications
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        
        // Get registration token
        const token = await this.messaging.getToken({
          vapidKey: 'YOUR_VAPID_KEY_HERE' // Replace with your VAPID key
        });
        
        if (token) {
          // Save the token to the user's document in Firestore
          await this.saveToken(token);
        } else {
          console.log('No registration token available.');
        }
        
        // Handle token refresh
        this.messaging.onTokenRefresh(async () => {
          try {
            const newToken = await this.messaging.getToken();
            await this.saveToken(newToken);
          } catch (error) {
            console.error('Error refreshing token:', error);
          }
        });
        
        // Handle incoming messages
        this.messaging.onMessage((payload) => {
          console.log('Message received:', payload);
          this.showNotification(payload.notification);
        });
      }
    } catch (error) {
      console.error('Error initializing messaging:', error);
    }
  }

  async saveToken(token) {
    try {
      const user = this.auth.currentUser;
      
      if (user) {
        await this.db.collection('users').doc(user.uid).set({
          fcmToken: token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error saving token:', error);
    }
  }

  showNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/assets/images/logo.png' // Replace with your icon path
      });
    }
  }

  async sendNotificationToUser(phoneNumber, title, body, data = {}) {
    try {
      // Find user by phone number
      const usersSnapshot = await this.db.collection('users')
        .where('phoneNumber', '==', phoneNumber)
        .get();
      
      if (usersSnapshot.empty) {
        console.log('No user found with phone number:', phoneNumber);
        return false;
      }
      
      let sentCount = 0;
      
      // Send notification to each device token
      for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        
        if (user.fcmToken) {
          const message = {
            token: user.fcmToken,
            notification: {
              title,
              body
            },
            data
          };
          
          // Send the message using Firebase Cloud Messaging
          await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'key=YOUR_SERVER_KEY_HERE' // Replace with your server key
            },
            body: JSON.stringify(message)
          });
          
          sentCount++;
        }
      }
      
      // Save notification to database
      await this.db.collection('notifications').add({
        title,
        body,
        type: data.type || 'info',
        phoneNumber,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return sentCount > 0;
      
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  async sendBroadcastNotification(title, body, type = 'info') {
    try {
      // Get all users with FCM tokens
      const usersSnapshot = await this.db.collection('users')
        .where('fcmToken', '!=', null)
        .get();
      
      if (usersSnapshot.empty) {
        console.log('No users with FCM tokens found');
        return 0;
      }
      
      let sentCount = 0;
      
      // Send notification to each user
      for (const doc of usersSnapshot.docs) {
        const user = doc.data();
        
        const message = {
          token: user.fcmToken,
          notification: {
            title,
            body
          },
          data: {
            type
          }
        };
        
        // Send the message using Firebase Cloud Messaging
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'key=YOUR_SERVER_KEY_HERE' // Replace with your server key
          },
          body: JSON.stringify(message)
        });
        
        sentCount++;
      }
      
      // Save notification to database
      await this.db.collection('notifications').add({
        title,
        body,
        type,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return sentCount;
      
    } catch (error) {
      console.error('Error sending broadcast notification:', error);
      return 0;
    }
  }
}