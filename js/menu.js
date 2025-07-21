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