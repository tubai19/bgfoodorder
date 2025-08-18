const firebaseConfig = {
  apiKey: "AIzaSyBuBmCQvvNVFsH2x6XGrHXrgZyULB1_qH8",
  authDomain: "bakeandgrill-44c25.firebaseapp.com",
  projectId: "bakeandgrill-44c25",
  storageBucket: "bakeandgrill-44c25.appspot.com",
  messagingSenderId: "713279633359",
  appId: "1:713279633359:web:ba6bcd411b1b6be7b904ba",
  measurementId: "G-SLG2R88J72"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Initialize services
const adminNotifications = new AdminNotifications(db, auth);
const clientNotifications = new ClientNotifications();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(registration => {
      console.log('ServiceWorker registration successful');
    })
    .catch(err => {
      console.error('ServiceWorker registration failed:', err);
    });
}