const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const app = express();

// Initialize Firebase Admin
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

// Middleware to verify API requests
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  
  admin.auth().verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      next();
    })
    .catch(error => {
      console.error('Error verifying token:', error);
      res.status(401).json({ error: 'Unauthorized' });
    });
};

// Get FCM access token
app.get('/api/get-fcm-token', authenticate, async (req, res) => {
  try {
    const token = await admin.messaging().createAccessToken();
    res.json({ token });
  } catch (error) {
    console.error('Error generating FCM token:', error);
    res.status(500).json({ error: 'Failed to generate FCM token' });
  }
});

// Send notification
app.post('/api/send-notification', authenticate, async (req, res) => {
  try {
    const { phoneNumber, title, body, data } = req.body;
    
    // Get user's FCM tokens
    const tokensSnapshot = await admin.firestore().collection('fcmTokens')
      .where('phoneNumber', '==', phoneNumber)
      .get();

    if (tokensSnapshot.empty) {
      return res.status(404).json({ error: 'No devices found for this user' });
    }

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      tokens.push(doc.data().token);
    });

    // Send to each token
    const responses = await Promise.all(
      tokens.map(token => 
        admin.messaging().send({
          token,
          notification: { title, body },
          data,
          android: { priority: 'high' },
          apns: { headers: { 'apns-priority': '10' } }
        })
      )
    );

    res.json({ success: true, sentTo: responses.length });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});