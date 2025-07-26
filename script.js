// Firebase configuration and initialization
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
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let messaging;

try {
  messaging = firebase.messaging();
} catch (err) {
  console.error("Unable to initialize Firebase Messaging", err);
}

let isTokenRegistered = false;

// Full menu data
const fullMenu = {
  "Veg Pizzas": [
    {
      name: "Farmhouse Special",
      nameBn: "চিজের বাগানবাড়ি",
      desc: "Onion, capsicum, tomato, green chili, spicy sauce",
      variants: { "Ekla Bite 4 Pcs": 179, "Bondhu Bite 6 Pcs": 389, "Family Bite 8 Pcs": 459 }
    },
    {
      name: "Spicy Veggie Blast",
      nameBn: "ঝাল ঝাল সবজির রহস্য",
      desc: "Onion, capsicum, tomato, green chili, spicy sauce",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 339, "Family Bite": 449 }
    },
    {
      name: "Desi Delight",
      nameBn: "দেশি তারকা",
      desc: "Paneer tikka, onion, green chili, coriander",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 349, "Family Bite": 469 }
    },
    {
      name: "Cheese Overload",
      nameBn: "চিজে ভরা বন্যা",
      desc: "Triple cheese blend: mozzarella, cheddar, cream",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 359, "Family Bite": 499 }
    },
    {
      name: "Classic Margherita",
      nameBn: "শুধু চিজ়",
      desc: "Sauce, mozzarella cheese",
      variants: { "Ekla Bite": 99, "Bondhu Bite": 219, "Family Bite": 359 }
    },
    {
      name: "Corn Capsicum",
      nameBn: "কর্ন ক্যাপসিকাম",
      desc: "Sweet corn, capsicum, oregano, cheese",
      variants: { "Ekla Bite": 139, "Bondhu Bite": 289, "Family Bite": 399 }
    },
    {
      name: "Mushroom Magic",
      nameBn: "মাশরুম ম্যাজিক",
      desc: "Mushroom, onion, garlic butter, cheese",
      variants: { "Ekla Bite": 149, "Bondhu Bite": 389, "Family Bite": 439 }
    },
    {
      name: "Veggie Treat",
      nameBn: "ভেজি ট্রিট",
      desc: "Onion, capsicum, tomato, corn, black olives",
      variants: { "Ekla Bite": 179, "Bondhu Bite": 369, "Family Bite": 489 }
    },
    {
      name: "Italian Garden",
      nameBn: "ইতালিয়ান গার্ডেন",
      desc: "Zucchini, cherry tomato, bell peppers",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 379, "Family Bite": 489 }
    },
    {
      name: "Veg Hawaiian",
      nameBn: "ভেজ হাওয়াইয়ান",
      desc: "Pineapple, capsicum, onion, cheese",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 279, "Family Bite": 479 }
    },
    {
      name: "Peri Peri Veg",
      nameBn: "পেরি পেরি ভেজ",
      desc: "Onion, capsicum, corn, peri peri sauce",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 359, "Family Bite": 479 }
    },
    {
      name: "Mexican Veg",
      nameBn: "মেক্সিকান ভেজ",
      desc: "Jalapeño, bell peppers, corn, chipotle sauce",
      variants: { "Ekla Bite": 179, "Bondhu Bite": 409, "Family Bite": 489 }
    },
    {
      name: "Chili Cheese Bomb",
      nameBn: "চিলি চিজ বোম",
      desc: "Green chili, red chili flakes, extra cheese",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 369, "Family Bite": 459 }
    },
    {
      name: "BBQ Veg Lovers",
      nameBn: "বিবিকিউ ভেজ লাভার্স",
      desc: "BBQ sauce, onion, paneer, sweet corn",
      variants: { "Ekla Bite": 179, "Bondhu Bite": 379, "Family Bite": 529 }
    },
    {
      name: "Veggie Volcano",
      nameBn: "ভেজি ভলকানো",
      desc: "Hot sauce, jalapeño, onion, bell pepper",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 299, "Family Bite": 489 }
    },
    {
      name: "Veggie Foursome",
      nameBn: "ভেজি ফোরসম",
      desc: "Capsicum, onion, tomato, corn",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 299, "Family Bite": 469 }
    },
    {
      name: "Spinach & Corn",
      nameBn: "স্পিনাচ অ্যান্ড কর্ন",
      desc: "Spinach, corn, mozzarella",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 279, "Family Bite": 439 }
    },
    {
      name: "Tandoori Veg",
      nameBn: "তন্দুরি সবজির মিলন",
      desc: "Tandoori sauce, mushroom, onion, paneer, cheese",
      variants: { "Ekla Bite": 199, "Bondhu Bite": 379, "Family Bite": 529 }
    }
  ],
  "Paneer Specials": [
    {
      name: "Classic Paneer",
      nameBn: "ক্লাসিক পনির",
      desc: "Soft paneer cubes, onion, tomato, capsicum",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 299, "Family Bite": 449 }
    },
    {
      name: "Paneer Supreme",
      nameBn: "পনিরে প্রেমগাথা",
      desc: "Paneer cubes, onion, capsicum, olives, cheese",
      variants: { "Ekla Bite": 179, "Bondhu Bite": 369, "Family Bite": 489 }
    },
    {
      name: "Peri Peri Paneer",
      nameBn: "পনিরের পেরি পটাকা",
      desc: "Spicy peri peri paneer, onion, capsicum",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 309, "Family Bite": 519 }
    },
    {
      name: "Tandoori Paneer",
      nameBn: "তন্দুরির ঠেলা পনিরের খেলা",
      desc: "Tandoori paneer, bell pepper, onion, tandoori sauce",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 339, "Family Bite": 529 }
    },
    {
      name: "Achari Paneer",
      nameBn: "আচারী পনিরের যুগলবন্দী",
      desc: "Pickled masala paneer, onion, chili, mustard drizzle",
      variants: { "Ekla Bite": 179, "Bondhu Bite": 319, "Family Bite": 509 }
    },
    {
      name: "Paneer Corn Delight",
      nameBn: "পনির ভুট্টার মিষ্টি মুখ",
      desc: "Paneer, sweet corn, cheese, capsicum",
      variants: { "Ekla Bite": 159, "Bondhu Bite": 309, "Family Bite": 489 }
    },
    {
      name: "Schezwan Paneer",
      nameBn: "লাল ঝাল পনির",
      desc: "Schezwan sauce base, paneer, capsicum, onion",
      variants: { "Ekla Bite 4 Pcs": 169, "Bondhu Bite 6 Pcs": 329, "Family Bite 8 Pcs": 529 }
    }
  ],
  "Non-Veg Pizzas": [
    {
      name: "Chicken Keema Pizza",
      nameBn: "চিকেন কিমা পিজ্জা",
      desc: "Spicy chicken keema, onion, green chili",
      variants: { "Ekla Bite 4 Pcs": 169, "Bondhu Bite 6 Pcs": 349, "Family Bite 8 Pcs": 479 }
    },
    {
      name: "BBQ Chicken Pizza",
      nameBn: "বিবিকিউ চিকেন পিজ্জা",
      desc: "Barbecue chicken, capsicum, onion",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 309, "Family Bite": 499 }
    },
    {
      name: "Chicken Sausage Pizza",
      nameBn: "চিকেন সসেজ পিজ্জা",
      desc: "Chicken sausage slices, onion, jalapeños",
      variants: { "Ekla Bite": 179, "Bondhu Bite": 349, "Family Bite": 529 }
    },
    {
      name: "Tandoori Chicken Pizza",
      nameBn: "তন্দুরি চিকেন পিজ্জা",
      desc: "Tandoori chicken, red chili flakes, onion",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 299, "Family Bite": 489 }
    },
    {
      name: "Chicken Peri Peri",
      nameBn: "চিকেন পেরি পেরি",
      desc: "Spicy peri peri chicken, capsicum, onion",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 349, "Family Bite": 519 }
    },
    {
      name: "Cheese & Chicken Mix",
      nameBn: "চিজ অ্যান্ড চিকেন মিক্স",
      desc: "Mozzarella cheese & Chicken",
      variants: { "Ekla Bite": 139, "Bondhu Bite": 249, "Family Bite": 429 }
    },
    {
      name: "Onion Chicken Pizza",
      nameBn: "অনিয়ন চিকেন পিজ্জা",
      desc: "Black pepper chicken, cheese, onion",
      variants: { "Ekla Bite 4 Pcs": 149, "Bondhu Bite 6 Pcs": 259, "Family Bite 8 Pcs": 479 }
    },
    {
      name: "Schezwan Chicken Pizza",
      nameBn: "সেজওয়ান চিকেন পিজ্জা",
      desc: "Spicy schezwan chicken, onion, capsicum",
      variants: { "Ekla Bite 4 Pcs": 159, "Bondhu Bite 6 Pcs": 289, "Family Bite 8 Pcs": 489 }
    },
    {
      name: "Chicken Delight Mix",
      nameBn: "চিকেন ডিলাইট মিক্স",
      desc: "Chicken chunks, capsicum, onion, tomato",
      variants: { "Ekla Bite": 169, "Bondhu Bite": 309, "Family Bite": 509 }
    },
    {
      name: "Garden Chicken Feast",
      nameBn: "গার্ডেন চিকেন ফিস্ট",
      desc: "Chicken sausage, sweet corn, onion, bell pepper",
      variants: { "Ekla Bite 4 Pcs": 189, "Bondhu Bite 6 Pcs": 349, "Family Bite 8 Pcs": 529 }
    },
    {
      name: "Peri Veg Chicken",
      nameBn: "পেরি ভেজ চিকেন",
      desc: "Peri-peri chicken, paneer cubes, capsicum",
      variants: { "Ekla Bite 4 Pcs": 179, "Bondhu Bite 6 Pcs": 339, "Family Bite 8 Pcs": 559 }
    },
    {
      name: "Chicken Tikka Olive",
      nameBn: "চিকেন টিক্কা অলিভ",
      desc: "Chicken tikka, paneer, black olives",
      variants: { "Ekla Bite 4 Pcs": 179, "Bondhu Bite 6 Pcs": 319, "Family Bite 8 Pcs": 559 }
    },
    {
      name: "Corn Chicken Cheese",
      nameBn: "কর্ন চিকেন চিজ",
      desc: "Sweet corn, shredded chicken, cheese",
      variants: { "Ekla Bite 4 Pcs": 149, "Bondhu Bite 6 Pcs": 259, "Family Bite 8 Pcs": 489 }
    },
    {
      name: "Spicy Mixed Fusion",
      nameBn: "স্পাইসি মিক্সড ফিউশন",
      desc: "Chicken, green chili, onion, capsicum",
      variants: { "Ekla Bite 4 Pcs": 169, "Bondhu Bite 6 Pcs": 309, "Family Bite 8 Pcs": 489 }
    },
    {
      name: "Hawaiian Mix Pizza",
      nameBn: "হাওয়াইয়ান মিক্স পিজ্জা",
      desc: "Chicken, pineapple, sweet corn, capsicum",
      variants: { "Ekla Bite 4 Pcs": 179, "Bondhu Bite 6 Pcs": 319, "Family Bite 8 Pcs": 559 }
    },
    {
      name: "Fiery Veg Chicken",
      nameBn: "ফায়ারি ভেজ চিকেন",
      desc: "Spicy chicken, jalapeno, onion, cheese",
      variants: { "Ekla Bite 4 Pcs": 169, "Bondhu Bite 6 Pcs": 289, "Family Bite 8 Pcs": 509 }
    },
    {
      name: "Tomato Chicken Supreme",
      nameBn: "টমেটো চিকেন সুপ্রিম",
      desc: "Chicken, tomato, onion",
      variants: { "Ekla Bite 4 Pcs": 169, "Bondhu Bite 6 Pcs": 319, "Family Bite 8 Pcs": 499 }
    },
    {
      name: "Corny Chicken Twist",
      nameBn: "কর্নি চিকেন টুইস্ট",
      desc: "Chicken tikka, sweet corn, capsicum",
      variants: { "Ekla Bite 4 Pcs": 159, "Bondhu Bite  6 Pcs": 299, "Family Bite 8 Pcs": 529 }
    },
    {
      name: "BBQ Veg Chicken",
      nameBn: "বিবিকিউ ভেজ চিকেন",
      desc: "BBQ chicken, onion, jalapeno",
      variants: { "Ekla Bite 4 Pcs": 159, "Bondhu Bite 6 Pcs": 319, "Family Bite 8 Pcs": 519 }
    },
    {
      name: "Desi Fusion Pizza",
      nameBn: "দেশি ফিউশন পিজ্জা",
      desc: "Chicken keema, green chili, paneer, onion",
      variants: { "Ekla Bite 4 Pcs": 199, "Bondhu Bite 6 Pcs": 349, "Family Bite 8 Pcs": 529 }
    },
    {
      name: "Chicken Paradise Pizza",
      nameBn: "চিকেন প্যারাডাইস পিজ্জা",
      desc: "Grilled Chicken, onion, capsicum, corn, red paprika, black olives",
      variants: { "Ekla Bite 4 Pcs": 219, "Bondhu Bite 6 Pcs": 399, "Family Bite 8 Pcs": 609 }
    }
  ],
  "Burgers": [
    {
      name: "Veg Burger",
      nameBn: "ভেজ বার্গার",
      desc: "Classic veg patty with fresh veggies",
      variants: { "Regular": 40 }
    },
    {
      name: "Cheese Veg Burger",
      nameBn: "চিজ ভেজ বার্গার",
      desc: "Veg burger with cheese slice",
      variants: { "Regular": 69 }
    },
    {
      name: "Paneer Tikka Burger",
      nameBn: "পনির টিক্কা বার্গার",
      desc: "Paneer tikka patty with veggies",
      variants: { "Regular": 69 }
    },
    {
      name: "Classic Chicken Burger",
      nameBn: "ক্লাসিক চিকেন বার্গার",
      desc: "Classic chicken patty with fresh veggies",
      variants: { "Regular": 79 }
    },
    {
      name: "Cheese Chicken Burger",
      nameBn: "চিজ চিকেন বার্গার",
      desc: "Chicken burger with cheese slice",
      variants: { "Regular": 99 }
    },
    {
      name: "Tandoori Chicken Chunk",
      nameBn: "তন্দুরি চিকেন চাঙ্ক",
      desc: "Tandoori chicken pieces in burger",
      variants: { "Regular": 59 }
    },
    {
      name: "Peri Peri Chicken Crunch",
      nameBn: "পেরি পেরি চিকেন ক্রাঞ্চ",
      desc: "Spicy peri peri chicken burger",
      variants: { "Regular": 69 }
    },
    {
      name: "BBQ Chicken Bites Burger",
      nameBn: "বিবিকিউ চিকেন বাইটস বার্গার",
      desc: "BBQ flavored chicken pieces in burger",
      variants: { "Regular": 69 }
    },
    {
      name: "Cheese Burst Chicken Piece",
      nameBn: "চিজ বার্স্ট চিকেন পিস",
      desc: "Cheesy chicken patty burger",
      variants: { "Regular": 79 }
    },
    {
      name: "Grilled Chicken Pieces Burger",
      nameBn: "গ্রিলড চিকেন পিসেস বার্গার",
      desc: "Grilled chicken pieces in burger",
      variants: { "Regular": 49 }
    },
    {
      name: "Schezwan Chicken Piece",
      nameBn: "সেজওয়ান চিকেন পিস",
      desc: "Spicy schezwan chicken burger",
      variants: { "Regular": 69 }
    }
  ],
  "Sandwiches": [
    {
      name: "Normal Veg Sandwich",
      nameBn: "নরমাল ভেজ স্যান্ডউইচ",
      desc: "Basic veg sandwich with chutney",
      variants: { "Regular": 29 }
    },
    {
      name: "Cheese Veg Sandwich",
      nameBn: "চিজ ভেজ স্যান্ডউইচ",
      desc: "Grilled veg sandwich with cheese",
      variants: { "Regular": 49 }
    },
    {
      name: "Cheese & Corn Sandwich",
      nameBn: "চিজ অ্যান্ড কর্ন স্যান্ডউইচ",
      desc: "Cheese and sweet corn sandwich",
      variants: { "Regular": 45 }
    },
    {
      name: "Paneer Sandwich",
      nameBn: "পনির স্যান্ডউইচ",
      desc: "Paneer sandwich with veggies",
      variants: { "Regular": 49 }
    },
    {
      name: "Cheesy Paneer Sandwich",
      nameBn: "চিজি পনির স্যান্ডউইচ",
      desc: "Cheesy paneer sandwich",
      variants: { "Regular": 69 }
    },
    {
      name: "Cheesy Corn Paneer Sandwich",
      nameBn: "চিজি কর্ন পনির স্যান্ডউইচ",
      desc: "Cheese, corn and paneer sandwich",
      variants: { "Regular": 75 }
    },
    {
      name: "Normal Chicken Sandwich",
      nameBn: "নরমাল চিকেন স্যান্ডউইচ",
      desc: "Basic chicken sandwich",
      variants: { "Regular": 39 }
    },
    {
      name: "Cheese Chicken Sandwich",
      nameBn: "চিজ চিকেন স্যান্ডউইচ",
      desc: "Cheesy chicken sandwich",
      variants: { "Regular": 59 }
    },
    {
      name: "Paneer Chicken Sandwich",
      nameBn: "পনির চিকেন স্যান্ডউইচ",
      desc: "Paneer and chicken sandwich",
      variants: { "Regular": 65 }
    },
    {
      name: "Cheesy Paneer Chicken",
      nameBn: "চিজি পনির চিকেন",
      desc: "Cheesy paneer and chicken sandwich",
      variants: { "Regular": 79 }
    },
    {
      name: "Corn Chicken Sandwich",
      nameBn: "কর্ন চিকেন স্যান্ডউইচ",
      desc: "Corn and chicken sandwich",
      variants: { "Regular": 55 }
    },
    {
      name: "Cheesy Corn Chicken Sandwich",
      nameBn: "চিজি কর্ন চিকেন স্যান্ডউইচ",
      desc: "Cheese, corn and chicken sandwich",
      variants: { "Regular": 69 }
    }
  ],
  "Quick Bites": [
    {
      name: "French Fries",
      nameBn: "ফ্রেঞ্চ ফ্রাই",
      desc: "Crispy fried potatoes",
      variants: { "Small": 39, "Medium": 69, "Large": 89 }
    },
    {
      name: "Onion Rings",
      nameBn: "অনিয়ন রিংস",
      desc: "Crispy fried onion rings",
      variants: { "Small": 29, "Medium": 49, "Large": 59 }
    },
    {
      name: "Chicken Pops",
      nameBn: "চিকেন পপস",
      desc: "Crispy chicken popcorn",
      variants: { "4 Pieces": 69, "8 Pieces": 139 }
    },
    {
      name: "Peri Fire Shots",
      nameBn: "পেরি ফায়ার শটস",
      desc: "Spicy peri peri chicken bites",
      variants: { "4 Pieces": 79, "8 Pieces": 149 }
    },
    {
      name: "Schezwan Fire Bites",
      nameBn: "সেজওয়ান ফায়ার বাইটস",
      desc: "Spicy schezwan chicken bites",
      variants: { "4 Pieces": 79, "8 Pieces": 149 }
    },
    {
      name: "Tandoor Tikka Cuts",
      nameBn: "তন্দুর টিক্কা কাটস",
      desc: "Tandoori chicken pieces",
      variants: { "4 Pieces": 69, "8 Pieces": 139 }
    },
    {
      name: "Smoky BBQ Bites",
      nameBn: "স্মোকি বিবিকিউ বাইটস",
      desc: "BBQ flavored chicken bites",
      variants: { "4 Pieces": 79, "8 Pieces": 149 }
    }
  ],
  "Dips": [
    {
      name: "Normal Mayo",
      nameBn: "নরমাল মায়ো",
      variants: { "Regular": 15 }
    },
    {
      name: "Garlic Dip",
      nameBn: "গার্লিক ডিপ",
      variants: { "Regular": 25 }
    },
    {
      name: "Sweet & Tangy Dip",
      nameBn: "সুইট অ্যান্ড ট্যাঙ্গি ডিপ",
      variants: { "Regular": 20 }
    },
    {
      name: "Tandoori Dip",
      nameBn: "তন্দুরি ডিপ",
      variants: { "Regular": 20 }
    },
    {
      name: "BBQ Dip",
      nameBn: "বিবিকিউ ডিপ",
      variants: { "Regular": 20 }
    },
    {
      name: "Peri Peri Dip",
      nameBn: "পেরি পেরি ডিপ",
      variants: { "Regular": 20 }
    }
  ],
  "Combos": [
    {
      name: "Veg Pizza Combo 1",
      nameBn: "ভেজ পিজ্জা কম্বো ১",
      desc: "1 Corn Capsicum Pizza (Ekla) + Drink + 1 Dip",
      variants: { "Combo": 149 },
      deliveryAvailable: false
    },
    {
      name: "Veg Pizza Combo 2",
      nameBn: "ভেজ পিজ্জা কম্বো ২",
      desc: "1 Margherita Pizza (Bondhu) + Drink + 2 Dips",
      variants: { "Combo": 249 },
      deliveryAvailable: false
    },
    {
      name: "Veg Burger Combo",
      nameBn: "ভেজ বার্গার কম্বো",
      desc: "1 Veg Burger + Small French Fries + Drink + 1 Dip",
      variants: { "Combo": 79 },
      deliveryAvailable: false
    },
    {
      name: "Paneer Pizza Combo",
      nameBn: "পনির পিজ্জা কম্বো",
      desc: "1 Paneer Supreme Pizza (Ekla) + Drink + 1 Dip",
      variants: { "Combo": 189 },
      deliveryAvailable: false
    },
    {
      name: "Paneer Pizza Combo 2",
      nameBn: "পনির পিজ্জা কম্বো ২",
      desc: "1 Peri Peri Pizza (Bondhu) + Drink + 2 Dips",
      variants: { "Combo": 339 },
      deliveryAvailable: false
    },
    {
      name: "Ekla Tandoori Pack",
      nameBn: "তন্দুরি প্যাক",
      desc: "1 Tandoori Chicken Chunk Burger + Small Fries + Drink + 1 Dip",
      variants: { "Combo": 99 },
      deliveryAvailable: false
    },
    {
      name: "Chicken Pizza Combo 1",
      nameBn: "চিকেন পিজ্জা কম্বো ১",
      desc: "1 Cheese Chicken Mix Pizza (Ekla) + Drink + 1 Dip",
      variants: { "Combo": 149 },
      deliveryAvailable: false
    },
    {
      name: "Chicken Pizza Combo 2",
      nameBn: "চিকেন পিজ্জা কম্বো ২",
      desc: "1 Onion Chicken Pizza (Bondhu) + Drink + 2 Dips",
      variants: { "Combo": 299 },
      deliveryAvailable: false
    },
    {
      name: "Chicken Burger Combo",
      nameBn: "চিকেন বার্গার কম্বো",
      desc: "2 Classic Chicken Burgers + Medium Fries + 2 Drinks + 2 Dips",
      variants: { "Combo": 249 },
      deliveryAvailable: false
    }
  ]
};

// Category icons mapping
const categoryIcons = {
  "Veg Pizzas": "🍕",
  "Paneer Specials": "🧀",
  "Non-Veg Pizzas": "🍗",
  "Burgers": "🍔",
  "Sandwiches": "🥪",
  "Quick Bites": "🍟",
  "Dips": "🥫",
  "Combos": "🎁"
};

// Restaurant location and delivery settings
const RESTAURANT_LOCATION = {
  lat: 22.3908,
  lng: 88.2189
};
const MAX_DELIVERY_DISTANCE = 8; // 8km maximum delivery distance
const MIN_DELIVERY_ORDER = 200;

// DOM elements
const selectedItems = [];
const tabsDiv = document.getElementById("tabs");
const container = document.getElementById("menuContainer");
const totalBill = document.getElementById("liveTotal");
const cartList = document.getElementById("cartItems");
const searchInput = document.getElementById("searchInput");
const deliveryChargeDisplay = document.getElementById("deliveryChargeDisplay");
const locationStatus = document.getElementById("locationStatus");
const deliveryAddressContainer = document.getElementById("deliveryAddressContainer");
const locationPrompt = document.getElementById("locationPrompt");
const shareLocationBtn = document.getElementById("shareLocationBtn");
const locationDetails = document.getElementById("locationDetails");
const refreshLocationBtn = document.getElementById("refreshLocationBtn");
const toggleManualLocation = document.getElementById("toggleManualLocation");
const locationAccuracyWarning = document.getElementById("locationAccuracyWarning");
const quickLocationBtn = document.getElementById("quickLocationBtn");
const quickLocationStatus = document.getElementById("quickLocationStatus");
const deliveryRestriction = document.getElementById("deliveryRestriction");
const notification = document.getElementById("notification");
const notificationText = document.getElementById("notificationText");
const mobileCartBtn = document.getElementById("mobileCartBtn");
const cart = document.getElementById("cart");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const viewOrderHistoryBtn = document.getElementById("viewOrderHistoryBtn");

// Application state
let currentCategory = null;
let deliveryDistance = null;
let isLocationFetching = false;
let userLocation = null;
let watchId = null;
let isManualLocation = false;

/* ======================
   NOTIFICATION SYSTEM
   ====================== */

async function initializeNotifications() {
  try {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerServiceWorker();
      await registerToken();
      setupMessageHandlers();
    } else {
      console.log('Notification permission denied');
    }
  } catch (error) {
    console.error('Notification initialization failed:', error);
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      
      setInterval(() => {
        registration.update().then(() => {
          console.log('Service Worker updated');
        });
      }, 60 * 60 * 1000);
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }
  throw new Error('Service workers not supported');
}

async function registerToken() {
  if (isTokenRegistered) return;
  
  try {
    const currentToken = await messaging.getToken({ 
      vapidKey: 'BKTsteSYE7yggmmbvQnPzDt0wFuHADZxcJpR8hu_bGOE8RpyBx4AamyQ2TIyItS6uvwZ79EzBp1rWOpuT4KHHDY',
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    });

    if (currentToken) {
      await saveTokenToFirestore(currentToken);
      isTokenRegistered = true;
      console.log('FCM token registered');
    } else {
      console.log('No registration token available');
    }
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}

async function saveTokenToFirestore(token) {
  const phone = document.getElementById('phoneNumber')?.value;
  if (!phone) {
    console.log('Phone number not available for token registration');
    return;
  }

  try {
    await db.collection('fcmTokens').doc(token).set({
      token: token,
      phone: phone,
      userAgent: navigator.userAgent,
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving token:', error);
    throw error;
  }
}

function setupMessageHandlers() {
  messaging.onMessage((payload) => {
    console.log('Foreground message received:', payload);
    showCustomNotification(payload);
  });

  messaging.onTokenRefresh(async () => {
    console.log('Token refreshed');
    await registerToken();
  });
}

function showCustomNotification(payload) {
  const notificationContainer = document.getElementById('notification-container') || 
    createNotificationContainer();

  const notification = document.createElement('div');
  notification.className = `notification ${payload.data?.status || 'default'}`;
  
  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas ${getStatusIcon(payload.data?.status)}"></i>
    </div>
    <div class="notification-content">
      <h4>${escapeHtml(payload.notification?.title || 'Order Update')}</h4>
      <p>${escapeHtml(payload.notification?.body || 'Your order status has changed')}</p>
      ${payload.data?.timestamp ? `<small>${formatTime(payload.data.timestamp)}</small>` : ''}
    </div>
    <button class="notification-close" aria-label="Close notification">
      &times;
    </button>
  `;

  notificationContainer.prepend(notification);
  setTimeout(() => notification.classList.add('show'), 10);

  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  });

  const autoDismiss = setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 8000);

  notification.addEventListener('mouseenter', () => {
    clearTimeout(autoDismiss);
  });

  notification.addEventListener('mouseleave', () => {
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  });
}

function createNotificationContainer() {
  const container = document.createElement('div');
  container.id = 'notification-container';
  document.body.appendChild(container);
  return container;
}

function getStatusIcon(status) {
  const icons = {
    pending: 'fa-clock',
    preparing: 'fa-utensils',
    delivering: 'fa-truck',
    completed: 'fa-check-circle',
    cancelled: 'fa-times-circle',
    default: 'fa-bell'
  };
  return icons[status] || icons.default;
}

function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ======================
   MAIN APPLICATION
   ====================== */

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeTabs();
  setupEventListeners();
  
  if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
    showLocationPrompt();
  }

  // Initialize notifications after user interaction
  document.body.addEventListener('click', () => {
    initializeNotifications().catch(console.error);
  }, { once: true });
});

// Initialize category tabs
function initializeTabs() {
  tabsDiv.innerHTML = '';
  
  for (const category in fullMenu) {
    const tabBtn = document.createElement("button");
    tabBtn.textContent = `${categoryIcons[category] || "🍽"} ${category}`;
    tabBtn.dataset.category = category;
    tabBtn.addEventListener('click', () => {
      searchInput.value = '';
      renderCategory(category);
      document.getElementById("menuContainer").scrollIntoView({ behavior: 'smooth' });
      
      document.querySelectorAll('#tabs button').forEach(btn => {
        btn.classList.remove('active');
      });
      tabBtn.classList.add('active');
    });
    tabsDiv.appendChild(tabBtn);
  }
  
  const firstCategory = Object.keys(fullMenu)[0];
  if (firstCategory) {
    tabsDiv.querySelector('button').classList.add('active');
    renderCategory(firstCategory);
  }
}

// Render menu items for a category
function renderCategory(category, searchTerm = '') {
  container.innerHTML = "";
  currentCategory = category;
  
  const section = document.createElement("div");
  section.className = "menu-category";
  section.innerHTML = `<h3>${categoryIcons[category] || "🍽"} ${category}</h3>`;
  container.appendChild(section);

  const filteredItems = fullMenu[category].filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(term) || 
           (item.desc && item.desc.toLowerCase().includes(term));
  });

  if (filteredItems.length === 0) {
    container.innerHTML = '<div class="no-results">No items found matching your search.</div>';
    return;
  }

  const itemsContainer = document.createElement("div");
  itemsContainer.className = "menu-items";
  container.appendChild(itemsContainer);

  filteredItems.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "menu-item";
    
    if (category === "Combos" && document.querySelector('input[name="orderType"]:checked').value === "Delivery") {
      itemDiv.classList.add("disabled-item");
      const overlay = document.createElement("div");
      overlay.className = "disabled-overlay";
      overlay.textContent = "Combos not available for delivery";
      itemDiv.appendChild(overlay);
    }

    const itemDetails = document.createElement("div");
    itemDetails.className = "menu-item-details";
    
    const title = document.createElement("div");
    title.className = "menu-item-name";
    title.textContent = item.name;
    
    if (item.nameBn) {
      const bn = document.createElement("div");
      bn.className = "menu-item-name-bn";
      bn.textContent = item.nameBn;
      itemDetails.appendChild(bn);
    }
    
    const desc = document.createElement("div");
    desc.className = "menu-item-desc";
    desc.textContent = item.desc || "";
    
    const variantDiv = document.createElement("div");
    variantDiv.className = "variant-selector";
    
    Object.entries(item.variants).forEach(([variant, price], index) => {
      const variantOption = document.createElement("div");
      variantOption.className = "variant-option";
      
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `variant-${item.name.replace(/\s+/g, '-')}`;
      input.id = `variant-${item.name.replace(/\s+/g, '-')}-${variant.replace(/\s+/g, '-')}`;
      input.value = variant;
      input.dataset.price = price;
      
      if (index === 0) {
        input.checked = true;
      }
      
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = `${variant} - ₹${price}`;
      
      variantOption.appendChild(input);
      variantOption.appendChild(label);
      variantDiv.appendChild(variantOption);
    });
    
    const priceDiv = document.createElement("div");
    priceDiv.className = "menu-item-price";
    priceDiv.textContent = `₹${Object.values(item.variants)[0]}`;
    
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "menu-item-controls";
    
    const quantityDiv = document.createElement("div");
    quantityDiv.className = "quantity-control";
    
    const minusBtn = document.createElement("button");
    minusBtn.className = "quantity-btn minus";
    minusBtn.innerHTML = "-";
    minusBtn.addEventListener('click', () => {
      const quantitySpan = minusBtn.nextElementSibling;
      let quantity = parseInt(quantitySpan.textContent);
      if (quantity > 0) {
        quantitySpan.textContent = quantity - 1;
      }
    });
    
    const quantitySpan = document.createElement("span");
    quantitySpan.className = "quantity";
    quantitySpan.textContent = "0";
    
    const plusBtn = document.createElement("button");
    plusBtn.className = "quantity-btn plus";
    plusBtn.innerHTML = "+";
    plusBtn.addEventListener('click', () => {
      const quantitySpan = plusBtn.previousElementSibling;
      quantitySpan.textContent = parseInt(quantitySpan.textContent) + 1;
    });
    
    quantityDiv.appendChild(minusBtn);
    quantityDiv.appendChild(quantitySpan);
    quantityDiv.appendChild(plusBtn);
    
    const addBtn = document.createElement("button");
    addBtn.className = "add-to-cart";
    addBtn.innerHTML = "Add";
    addBtn.addEventListener('click', () => {
      const quantity = parseInt(quantitySpan.textContent);
      if (quantity > 0) {
        const selectedVariant = variantDiv.querySelector('input[name^="variant-"]:checked');
        if (selectedVariant) {
          addToOrder(
            item.name,
            selectedVariant.value,
            parseInt(selectedVariant.dataset.price),
            quantity
          );
          quantitySpan.textContent = "0";
        }
      }
    });
    
    controlsDiv.appendChild(quantityDiv);
    controlsDiv.appendChild(addBtn);
    
    itemDetails.appendChild(title);
    if (item.desc) itemDetails.appendChild(desc);
    itemDetails.appendChild(variantDiv);
    itemDetails.appendChild(priceDiv);
    itemDetails.appendChild(controlsDiv);
    
    itemDiv.appendChild(itemDetails);
    itemsContainer.appendChild(itemDiv);
    
    variantDiv.querySelectorAll('input[name^="variant-"]').forEach(input => {
      input.addEventListener('change', () => {
        priceDiv.textContent = `₹${input.dataset.price}`;
      });
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  document.querySelectorAll('input[name="orderType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const isDelivery = this.value === 'Delivery';
      deliveryAddressContainer.style.display = isDelivery ? 'block' : 'none';
      deliveryChargeDisplay.style.display = 'none';
      locationStatus.style.display = 'none';
      deliveryRestriction.style.display = 'none';
      
      if (isDelivery) {
        showLocationPrompt();
      } else {
        stopLocationTracking();
        deliveryDistance = null;
      }
      
      if (currentCategory) {
        renderCategory(currentCategory, searchInput.value);
      }
      updateCart();
    });
  });

  quickLocationBtn.addEventListener('click', getQuickLocation);
  shareLocationBtn.addEventListener('click', startLocationTracking);

  refreshLocationBtn.addEventListener('click', function() {
    stopLocationTracking();
    startLocationTracking();
  });

  toggleManualLocation.addEventListener('click', function() {
    isManualLocation = !isManualLocation;
    const manualContainer = document.getElementById('manualLocationContainer');
    
    if (isManualLocation) {
      manualContainer.style.display = 'block';
      this.textContent = 'Use automatic location detection';
      stopLocationTracking();
      document.getElementById('locationText').textContent = 'Using manual address entry';
      document.getElementById('deliveryEstimate').textContent = 'Distance will be estimated from address';
    } else {
      manualContainer.style.display = 'none';
      this.textContent = 'Or enter address manually';
      startLocationTracking();
    }
  });
  
  document.getElementById('saveManualLocation').addEventListener('click', function() {
    const address = document.getElementById('manualAddress').value.trim();
    if (!address) {
      alert('Please enter your address');
      return;
    }
    
    deliveryDistance = 3 + Math.random() * 5;
    document.getElementById('locationText').textContent = `📍 Manual address saved`;
    document.getElementById('locationMapLink').innerHTML = `<div style="color: var(--primary-color);">${address}</div>`;
    
    const estimatedTime = calculateDeliveryTime(deliveryDistance);
    document.getElementById('deliveryEstimate').innerHTML = 
      `📏 Estimated Distance: <strong>${deliveryDistance.toFixed(1)}km</strong> | 
       ⏳ Est. Delivery: <strong>${estimatedTime}</strong>`;
    
    updateCart();
    checkDeliveryRestriction();
  });

  mobileCartBtn.addEventListener('click', function() {
    cart.classList.toggle('active');
  });

  placeOrderBtn.addEventListener('click', confirmOrder);
  viewOrderHistoryBtn.addEventListener('click', showOrderHistory);
  
  document.getElementById('closeHistoryBtn').addEventListener('click', function() {
    document.getElementById('orderHistoryModal').style.display = 'none';
  });
  
  document.getElementById('clearHistoryBtn').addEventListener('click', clearOrderHistory);
  
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });

  searchInput.addEventListener('input', (e) => {
    if (currentCategory) {
      renderCategory(currentCategory, e.target.value);
    }
  });
}

// Show notification
function showNotification(message) {
  notificationText.textContent = message;
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Add item to order
function addToOrder(name, variant, price, quantity = 1) {
  const existingItemIndex = selectedItems.findIndex(
    item => item.name === name && item.variant === variant
  );
  
  if (existingItemIndex !== -1) {
    selectedItems[existingItemIndex].quantity += quantity;
  } else {
    selectedItems.push({ 
      name, 
      variant, 
      price, 
      quantity 
    });
  }
  
  updateCart();
  showNotification(`${quantity > 1 ? quantity + 'x ' : ''}${name} (${variant}) added to cart!`);
}

// Update cart display
function updateCart() {
  cartList.innerHTML = "";
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let deliveryCharge = 0;
  let deliveryMessage = "";
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  
  if (orderType === 'Delivery') {
    const result = calculateDeliveryCharge(subtotal, deliveryDistance);
    deliveryCharge = result.charge || 0;
    deliveryMessage = result.message;
    
    if (deliveryCharge !== null) {
      deliveryMessage += ` | ⏳ Est. Delivery: ${calculateDeliveryTime(deliveryDistance)}`;
      deliveryChargeDisplay.textContent = deliveryMessage;
      deliveryChargeDisplay.style.display = 'block';
    } else {
      deliveryChargeDisplay.textContent = deliveryMessage;
      deliveryChargeDisplay.style.color = 'var(--error-color)';
      deliveryChargeDisplay.style.display = 'block';
    }
  }

  const total = subtotal + (deliveryCharge || 0);
  
  selectedItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "cart-item-name";
    nameSpan.textContent = `${item.name} (${item.variant}) x ${item.quantity}`;
    
    const priceSpan = document.createElement("span");
    priceSpan.className = "cart-item-price";
    priceSpan.textContent = `₹${item.price * item.quantity}`;
    
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "cart-item-controls";
    
    const removeBtn = document.createElement("button");
    removeBtn.className = "cart-item-remove";
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.addEventListener('click', () => {
      selectedItems.splice(index, 1);
      updateCart();
      showNotification("Item removed from cart");
    });
    
    controlsDiv.appendChild(removeBtn);
    li.appendChild(nameSpan);
    li.appendChild(priceSpan);
    li.appendChild(controlsDiv);
    cartList.appendChild(li);
  });

  let billText = `Subtotal: ₹${subtotal}`;
  if (deliveryCharge > 0) {
    billText += ` + Delivery: ₹${deliveryCharge}`;
  } else if (orderType === 'Delivery' && deliveryCharge === 0) {
    billText += ` + Delivery: Free`;
  }
  billText += ` = Total: ₹${total}`;
  
  if (orderType === 'Delivery' && deliveryCharge === null) {
    billText += " (Delivery not available)";
  }
  
  totalBill.innerHTML = billText;
  
  const itemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count, .cart-badge').forEach(el => {
    el.textContent = itemCount;
  });
}

// Calculate delivery time estimate
function calculateDeliveryTime(distanceKm) {
  if (!distanceKm) return "Unknown";
  const preparationTime = 20;
  const travelTime = Math.round(distanceKm * 8);
  return `${preparationTime + travelTime} minutes (${preparationTime} min prep + ${travelTime} min travel)`;
}

// Calculate delivery charge based on distance and order total
function calculateDeliveryCharge(total, distance) {
  if (!distance) return { charge: null, message: "Please share your location to calculate delivery" };
  if (distance > MAX_DELIVERY_DISTANCE) return { charge: null, message: "⚠️ Delivery not available beyond 8km" };
  if (total >= 500) return { charge: 0, message: "🎉 Free delivery (order above ₹500)" };
  if (distance <= 4) return { charge: 0, message: "Free delivery (within 4km)" };
  if (distance <= 6) return { charge: 20, message: `Delivery charge: ₹20 (${distance.toFixed(1)}km)` };
  if (distance <= 8) return { charge: 30, message: `Delivery charge: ₹30 (${distance.toFixed(1)}km)` };
  return { charge: null, message: "⚠️ Delivery not available beyond 8km" };
}

// Check if delivery is restricted based on distance
function checkDeliveryRestriction() {
  if (!deliveryDistance) {
    deliveryRestriction.style.display = 'none';
    return;
  }
  
  deliveryRestriction.style.display = deliveryDistance > MAX_DELIVERY_DISTANCE ? 'block' : 'none';
}

// Show location prompt
function showLocationPrompt() {
  locationPrompt.style.display = 'flex';
  locationDetails.style.display = 'none';
  refreshLocationBtn.style.display = 'none';
  toggleManualLocation.style.display = 'none';
  document.getElementById('manualLocationContainer').style.display = 'none';
}

// Hide location prompt
function hideLocationPrompt() {
  locationPrompt.style.display = 'none';
  locationDetails.style.display = 'block';
  refreshLocationBtn.style.display = 'block';
  toggleManualLocation.style.display = 'block';
}

// Get quick location
function getQuickLocation() {
  quickLocationStatus.style.display = 'block';
  quickLocationStatus.className = 'location-loading';
  quickLocationStatus.textContent = "Detecting your location...";
  
  if (!navigator.geolocation) {
    quickLocationStatus.className = 'location-error';
    quickLocationStatus.textContent = "Geolocation is not supported by your browser.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      userLocation = { lat: userLat, lng: userLng };
      
      document.getElementById('deliveryLatitude').value = userLat;
      document.getElementById('deliveryLongitude').value = userLng;
      
      calculateRoadDistance(userLat, userLng, (distance) => {
        deliveryDistance = distance;
        quickLocationStatus.className = 'location-success';
        quickLocationStatus.innerHTML = `📍 Location shared successfully! Distance: ${distance.toFixed(1)}km`;
        
        if (document.querySelector('input[name="orderType"]:checked').value === 'Delivery') {
          updateLocationDisplay(userLat, userLng, deliveryDistance);
          hideLocationPrompt();
        }
        
        updateCart();
        checkDeliveryRestriction();
      });
    },
    (error) => {
      quickLocationStatus.className = 'location-error';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          quickLocationStatus.textContent = "Location access was denied. Please enable it in your browser settings.";
          break;
        case error.POSITION_UNAVAILABLE:
          quickLocationStatus.textContent = "Location information is unavailable.";
          break;
        case error.TIMEOUT:
          quickLocationStatus.textContent = "The request to get location timed out.";
          break;
        default:
          quickLocationStatus.textContent = "An unknown error occurred while getting location.";
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Calculate road distance using OSRM API with fallback to haversine
async function calculateRoadDistance(originLat, originLng, callback) {
  const origin = `${originLng},${originLat}`;
  const destination = `${RESTAURANT_LOCATION.lng},${RESTAURANT_LOCATION.lat}`;
  
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin};${destination}?overview=false`);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      callback(data.routes[0].distance / 1000);
    } else {
      callback(calculateHaversineDistance(originLat, originLng, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng));
    }
  } catch (error) {
    console.error("Error calculating road distance:", error);
    callback(calculateHaversineDistance(originLat, originLng, RESTAURANT_LOCATION.lat, RESTAURANT_LOCATION.lng));
  }
}

// Calculate haversine distance between two points
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Start continuous location tracking
function startLocationTracking() {
  if (isLocationFetching) return;
  
  isLocationFetching = true;
  locationStatus.style.display = 'block';
  locationStatus.className = 'location-loading';
  locationStatus.textContent = "Calculating road distance from restaurant...";
  
  if (!navigator.geolocation) {
    locationStatus.className = 'location-error';
    locationStatus.textContent = "Geolocation is not supported by your browser.";
    isLocationFetching = false;
    return;
  }

  hideLocationPrompt();
  
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      userLocation = { lat: userLat, lng: userLng };
      
      document.getElementById('deliveryLatitude').value = userLat;
      document.getElementById('deliveryLongitude').value = userLng;
      
      calculateRoadDistance(userLat, userLng, (distance) => {
        deliveryDistance = distance;
        updateLocationDisplay(userLat, userLng, deliveryDistance);
        locationStatus.className = 'location-success';
        locationStatus.innerHTML = `Location tracking active (road distance calculated)`;
        isLocationFetching = false;
        updateCart();
        checkDeliveryRestriction();
        
        locationAccuracyWarning.style.display = position.coords.accuracy > 100 ? 'flex' : 'none';
      });
    },
    (error) => {
      locationStatus.className = 'location-error';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          locationStatus.textContent = "Location access was denied. Please enable it.";
          showLocationPrompt();
          break;
        case error.POSITION_UNAVAILABLE:
          locationStatus.textContent = "Location information is unavailable.";
          showLocationPrompt();
          break;
        case error.TIMEOUT:
          locationStatus.textContent = "The request to get location timed out.";
          showLocationPrompt();
          break;
        default:
          locationStatus.textContent = "An unknown error occurred.";
          showLocationPrompt();
      }
      isLocationFetching = false;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Update location display with map link and delivery estimate
function updateLocationDisplay(lat, lng, distance) {
  document.getElementById('locationText').textContent = `📍 Your location detected`;
  document.getElementById('locationMapLink').innerHTML = 
    `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color: var(--primary-color);">
       View on Google Maps
     </a>`;
  
  const estimatedTime = calculateDeliveryTime(distance);
  document.getElementById('deliveryEstimate').innerHTML = 
    `📏 Road Distance: <strong>${distance.toFixed(1)}km</strong> | 
     ⏳ Est. Delivery: <strong>${estimatedTime}</strong>`;
}

// Stop location tracking
function stopLocationTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// Confirm order and show confirmation modal
function confirmOrder() {
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim();
  const orderType = document.querySelector('input[name="orderType"]:checked').value;
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (orderType === "Delivery") {
    const hasCombos = selectedItems.some(item => {
      return Object.keys(fullMenu).some(category => {
        return category === "Combos" && fullMenu[category].some(combo => combo.name === item.name);
      });
    });
    
    if (hasCombos) {
      alert("Combos are not available for delivery. Please remove combo items or choose pickup.");
      return;
    }
  }

  if (orderType === 'Delivery' && subtotal < MIN_DELIVERY_ORDER) {
    alert(`Minimum order for delivery is ₹${MIN_DELIVERY_ORDER}. Please add more items or choose pickup.`);
    return;
  }

  if (!name || !phone) {
    alert("Please enter your name and phone number.");
    return;
  }

  if (!/^\d{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }

  if (orderType === 'Delivery') {
    if (!userLocation && !isManualLocation) {
      alert("Please share your location or enter your address to proceed with delivery.");
      showLocationPrompt();
      document.getElementById('deliveryAddressContainer').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    if (!deliveryDistance) {
      alert("We couldn't determine your distance from the restaurant. Please check your location settings and try again.");
      return;
    }
    
    if (deliveryDistance > MAX_DELIVERY_DISTANCE) {
      alert(`Your location is ${deliveryDistance.toFixed(1)}km away (beyond our 8km delivery range). Please choose pickup or visit our restaurant.`);
      return;
    }
  }

  let deliveryCharge = 0;
  if (orderType === 'Delivery') {
    const result = calculateDeliveryCharge(subtotal, deliveryDistance);
    deliveryCharge = result.charge || 0;
  }
  const total = subtotal + deliveryCharge;

  const orderData = {
    customerName: name,
    phoneNumber: phone,
    orderType: orderType,
    items: [...selectedItems],
    subtotal: subtotal,
    deliveryCharge: deliveryCharge,
    total: total,
    status: "Pending",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (orderType === 'Delivery') {
    if (isManualLocation) {
      orderData.deliveryAddress = document.getElementById('manualAddress').value;
    } else if (userLocation) {
      orderData.deliveryLocation = new firebase.firestore.GeoPoint(userLocation.lat, userLocation.lng);
    }
    orderData.deliveryDistance = deliveryDistance;
  }

  let confirmationHTML = `
    <div class="order-summary-item"><strong>Customer:</strong> ${name}</div>
    <div class="order-summary-item"><strong>Phone:</strong> ${phone}</div>
    <div class="order-summary-item"><strong>Order Type:</strong> ${orderType}</div>`;
  
  if (orderType === 'Delivery') {
    const estimatedTime = calculateDeliveryTime(deliveryDistance);
    if (isManualLocation) {
      confirmationHTML += `
        <div class="order-summary-item"><strong>Address:</strong> ${orderData.deliveryAddress}</div>
        <div class="order-summary-item"><strong>Estimated Distance:</strong> ${deliveryDistance.toFixed(1)}km</div>`;
    } else if (userLocation) {
      confirmationHTML += `
        <div class="order-summary-item"><strong>Location:</strong> 
          <a href="https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}" target="_blank">View on Map</a>
        </div>
        <div class="order-summary-item"><strong>Distance:</strong> ${deliveryDistance.toFixed(1)}km</div>`;
    }
    confirmationHTML += `
      <div class="order-summary-item"><strong>Estimated Delivery:</strong> ${estimatedTime}</div>`;
  }
  
  confirmationHTML += `<div class="order-summary-item"><strong>Items:</strong></div>`;
  
  selectedItems.forEach((item, index) => {
    confirmationHTML += `
      <div class="order-summary-item">
        ${index + 1}. ${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}
      </div>`;
  });
  
  confirmationHTML += `
    <div class="order-summary-item"><strong>Subtotal:</strong> ₹${subtotal}</div>`;
  
  if (deliveryCharge > 0) {
    confirmationHTML += `
      <div class="order-summary-item"><strong>Delivery Charge:</strong> ₹${deliveryCharge}</div>`;
  } else if (orderType === 'Delivery') {
    confirmationHTML += `
      <div class="order-summary-item"><strong>Delivery Charge:</strong> Free</div>`;
  }
  
  confirmationHTML += `
    <div class="order-summary-item" style="font-weight:bold; color:var(--primary-color); border-bottom:none;">
      <strong>Total Amount:</strong> ₹${total}
    </div>`;
  
  document.getElementById("orderConfirmationDetails").innerHTML = confirmationHTML;
  const modal = document.getElementById("orderConfirmationModal");
  modal.style.display = "block";
  
  document.querySelector(".close-modal").onclick = 
  document.getElementById("cancelOrderBtn").onclick = function() {
    modal.style.display = "none";
  };
  
  document.getElementById("confirmOrderBtn").onclick = function() {
    modal.style.display = "none";
    
    db.collection("orders").add(orderData)
      .then((docRef) => {
        console.log("Order saved with ID: ", docRef.id);
        orderData.id = docRef.id;
        saveOrderToHistory(orderData);
        sendWhatsAppOrder(name, phone, orderType, subtotal, deliveryCharge, total);
        document.getElementById('downloadBillBtn').style.display = 'inline-block';
        document.getElementById('saveOrderBtn').style.display = 'inline-block';
      })
      .catch((error) => {
        console.error("Error saving order: ", error);
        alert("There was an error saving your order. Please try again.");
      });
  };
  
  document.getElementById("downloadBillBtn").onclick = function() {
    generatePDFBill(orderData);
  };
  
  document.getElementById("saveOrderBtn").onclick = function() {
    saveOrderToHistory(orderData);
    showNotification('Order saved to your history');
    modal.style.display = "none";
  };
}

// Save order to local storage history
function saveOrderToHistory(orderData) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  orders.unshift({
    ...orderData,
    timestamp: orderData.timestamp?.toDate?.()?.toISOString?.() || new Date().toISOString()
  });
  if (orders.length > 50) orders.pop();
  localStorage.setItem('bakeAndGrillOrders', JSON.stringify(orders));
}

// Show order history from local storage
function showOrderHistory() {
  const orderHistoryModal = document.getElementById('orderHistoryModal');
  const orderHistoryList = document.getElementById('orderHistoryList');
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  
  if (orders.length === 0) {
    orderHistoryList.innerHTML = '<div class="no-orders">No orders found in your history.</div>';
  } else {
    orderHistoryList.innerHTML = '';
    
    orders.forEach((order, index) => {
      const orderElement = document.createElement('div');
      orderElement.className = 'order-history-item';
      
      orderElement.innerHTML = `
        <div class="order-history-header">
          <span class="order-number">Order #${index + 1}</span>
          <span class="order-date">${new Date(order.timestamp).toLocaleString()}</span>
          <span class="order-total">₹${order.total}</span>
        </div>
        <div class="order-history-details">
          <div><strong>Name:</strong> ${order.customerName}</div>
          <div><strong>Phone:</strong> ${order.phoneNumber}</div>
          <div><strong>Type:</strong> ${order.orderType}</div>
          ${order.orderType === 'Delivery' ? `<div><strong>Distance:</strong> ${order.deliveryDistance ? order.deliveryDistance.toFixed(1)+'km' : 'Unknown'}</div>` : ''}
          <div class="order-items">
            <strong>Items:</strong>
            <ul>
              ${order.items.map(item => `<li>${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="order-history-actions">
          <button class="reorder-btn" data-index="${index}"><i class="fas fa-redo"></i> Reorder</button>
          <button class="download-btn" data-index="${index}"><i class="fas fa-file-pdf"></i> Download</button>
        </div>
      `;
      
      orderHistoryList.appendChild(orderElement);
    });
    
    document.querySelectorAll('.reorder-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        reorderFromHistory(parseInt(this.dataset.index));
      });
    });
    
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        downloadOrderFromHistory(parseInt(this.dataset.index));
      });
    });
  }
  
  orderHistoryModal.style.display = 'block';
}

// Clear order history from local storage
function clearOrderHistory() {
  if (confirm('Are you sure you want to clear your entire order history?')) {
    localStorage.removeItem('bakeAndGrillOrders');
    showOrderHistory();
    showNotification('Order history cleared');
  }
}

// Reorder items from history
function reorderFromHistory(orderIndex) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  if (orderIndex >= 0 && orderIndex < orders.length) {
    const order = orders[orderIndex];
    selectedItems.length = 0;
    order.items.forEach(item => {
      selectedItems.push({
        name: item.name,
        variant: item.variant,
        price: item.price,
        quantity: item.quantity
      });
    });
    
    document.getElementById('customerName').value = order.customerName;
    document.getElementById('phoneNumber').value = order.phoneNumber;
    document.querySelector(`input[name="orderType"][value="${order.orderType}"]`).checked = true;
    
    updateCart();
    document.getElementById('orderHistoryModal').style.display = 'none';
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    showNotification('Order loaded from history');
  }
}

// Download PDF for order from history
function downloadOrderFromHistory(orderIndex) {
  const orders = JSON.parse(localStorage.getItem('bakeAndGrillOrders')) || [];
  if (orderIndex >= 0 && orderIndex < orders.length) {
    generatePDFBill(orders[orderIndex]);
  }
}

// Generate PDF bill for an order
function generatePDFBill(orderDetails) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Bake & Grill', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Delicious food delivered to your doorstep', 105, 28, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setTextColor(214, 40, 40);
  doc.text('ORDER RECEIPT', 105, 40, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(`Order #: ${orderDetails.id || Math.floor(100000 + Math.random() * 900000)}`, 15, 50);
  doc.text(`Date: ${new Date(orderDetails.timestamp).toLocaleString()}`, 15, 58);
  doc.text(`Customer: ${orderDetails.customerName}`, 15, 66);
  doc.text(`Phone: ${orderDetails.phoneNumber}`, 15, 74);
  doc.text(`Order Type: ${orderDetails.orderType}`, 15, 82);
  
  if (orderDetails.orderType === 'Delivery') {
    if (orderDetails.deliveryLocation) {
      doc.text(`Location: ${orderDetails.deliveryLocation.latitude}, ${orderDetails.deliveryLocation.longitude}`, 15, 90);
    } else if (orderDetails.deliveryAddress) {
      doc.text(`Address: ${orderDetails.deliveryAddress}`, 15, 90);
    }
    doc.text(`Distance: ${orderDetails.deliveryDistance ? orderDetails.deliveryDistance.toFixed(1)+'km' : 'Unknown'}`, 15, 98);
  }
  
  doc.autoTable({
    startY: 120,
    head: [['#', 'Item', 'Variant', 'Qty', 'Price (₹)']],
    body: orderDetails.items.map((item, index) => [
      index + 1,
      item.name,
      item.variant,
      item.quantity,
      item.price * item.quantity
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [214, 40, 40],
      textColor: [255, 255, 255]
    }
  });
  
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ₹${orderDetails.subtotal}`, 140, finalY);
  
  if (orderDetails.deliveryCharge > 0) {
    doc.text(`Delivery Charge: ₹${orderDetails.deliveryCharge}`, 140, finalY + 8);
  } else if (orderDetails.orderType === 'Delivery') {
    doc.text(`Delivery Charge: Free`, 140, finalY + 8);
  }
  
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Amount: ₹${orderDetails.total}`, 140, finalY + 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your order!', 105, 280, { align: 'center' });
  doc.text('For any queries, contact: +91 8240266267', 105, 285, { align: 'center' });
  
  doc.save(`BakeAndGrill_Order_${orderDetails.customerName}.pdf`);
}

// Send order via WhatsApp
function sendWhatsAppOrder(name, phone, orderType, subtotal, deliveryCharge, total) {
  let orderDetails = "";
  selectedItems.forEach((item, index) => {
    orderDetails += `${index + 1}. ${item.name} (${item.variant}) x ${item.quantity} - ₹${item.price * item.quantity}\n`;
  });

  orderDetails += `\nSubtotal: ₹${subtotal}`;
  if (deliveryCharge > 0) orderDetails += `\nDelivery Charge: ₹${deliveryCharge}`;
  else if (orderType === 'Delivery') orderDetails += `\nDelivery Charge: Free`;
  orderDetails += `\nTotal: ₹${total}`;

  if (orderType === "Delivery") {
    if (isManualLocation) {
      orderDetails += `\n\n📍 Delivery Address:\n${document.getElementById('manualAddress').value}`;
    } else if (userLocation) {
      orderDetails += `\n\n📍 Delivery Location:\nhttps://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`;
    }
    orderDetails += `\n📏 Distance: ${deliveryDistance.toFixed(1)}km`;
    orderDetails += `\n⏳ Estimated Delivery: ${calculateDeliveryTime(deliveryDistance)}`;
  }

  const message = `🍽 *New ${orderType} Order from Bake & Grill*\n\n👤 Name: ${name}\n📞 Phone: ${phone}\n\n📦 Order Details:\n${orderDetails}`;
  window.open(`https://wa.me/918240266267?text=${encodeURIComponent(message)}`, '_blank');
  
  // Clear cart after order
  selectedItems.length = 0;
  updateCart();
  document.getElementById("customerName").value = "";
  document.getElementById("phoneNumber").value = "";
}