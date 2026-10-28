/*
 * Hindi names for common produce and categories, shown under the product name on the franchise pages
 * (client mockups show both). Products have no Hindi name stored, so this matches on words in the
 * English name; anything not listed simply shows no Hindi line.
 */

const PRODUCTS = [
    ['sweet potato', 'शकरकंद'], ['spring onion', 'हरा प्याज'], ['green chilli', 'हरी मिर्च'], ['green chili', 'हरी मिर्च'],
    ['red chilli', 'लाल मिर्च'], ['bottle gourd', 'लौकी'], ['bitter gourd', 'करेला'], ['ridge gourd', 'तोरई'],
    ['lady finger', 'भिंडी'], ['ladyfinger', 'भिंडी'], ['okra', 'भिंडी'], ['french beans', 'फ्रेंच बीन्स'],
    ['green peas', 'हरी मटर'], ['curry leaves', 'करी पत्ता'], ['mint', 'पुदीना'], ['coriander', 'धनिया'],
    ['tomato', 'टमाटर'], ['onion', 'प्याज'], ['potato', 'आलू'], ['garlic', 'लहसुन'], ['ginger', 'अदरक'],
    ['capsicum', 'शिमला मिर्च'], ['bell pepper', 'शिमला मिर्च'], ['chilli', 'मिर्च'], ['chili', 'मिर्च'],
    ['cauliflower', 'गोभी'], ['cabbage', 'पत्ता गोभी'], ['broccoli', 'ब्रोकली'], ['carrot', 'गाजर'],
    ['radish', 'मूली'], ['beetroot', 'चुकंदर'], ['spinach', 'पालक'], ['methi', 'मेथी'], ['fenugreek', 'मेथी'],
    ['brinjal', 'बैंगन'], ['eggplant', 'बैंगन'], ['cucumber', 'खीरा'], ['pumpkin', 'कद्दू'], ['peas', 'मटर'],
    ['beans', 'बीन्स'], ['mushroom', 'मशरूम'], ['lemon', 'नींबू'], ['corn', 'मक्का'],
    ['watermelon', 'तरबूज'], ['muskmelon', 'खरबूजा'], ['pineapple', 'अनानास'], ['custard apple', 'सीताफल'], ['apple', 'सेब'], ['banana', 'केला'], ['orange', 'संतरा'],
    ['mango', 'आम'], ['grapes', 'अंगूर'], ['grape', 'अंगूर'], ['papaya', 'पपीता'],
    ['pomegranate', 'अनार'], ['guava', 'अमरूद'], ['chikoo', 'चीकू'], ['sapota', 'चीकू'], ['pear', 'नाशपाती'],
    ['coconut', 'नारियल'], ['strawberr', 'स्ट्रॉबेरी'], ['kiwi', 'कीवी'], ['blueberr', 'ब्लूबेरी'],
    ['milk', 'दूध'], ['paneer', 'पनीर'], ['butter', 'मक्खन'], ['curd', 'दही'], ['yogurt', 'दही'], ['ghee', 'घी'],
    ['cheese', 'चीज़'], ['cream', 'क्रीम'], ['egg', 'अंडे'], ['bread', 'ब्रेड'],
];

const CATEGORIES = [
    ['vegetable', 'सब्जियां'], ['fruit', 'फल'], ['dairy', 'डेयरी'], ['bakery', 'बेकरी'], ['frozen', 'फ्रोज़न'],
    ['exotic', 'विदेशी'], ['herb', 'पत्ते / हर्ब्स'], ['leaf', 'पत्तेदार'], ['grocery', 'किराना'],
];

const find = (list, text) => {
    const t = String(text || '').toLowerCase();
    if (!t) return '';
    return list.find(([en]) => t.includes(en))?.[1] || '';
};

export const hindiName = (name) => find(PRODUCTS, name);
export const hindiCategory = (name) => find(CATEGORIES, name);
