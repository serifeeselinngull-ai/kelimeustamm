// We will put 10 words per module here for demonstration.
// In a real scenario, this would be 100 words per module.

export const modules = [
  {
    id: 1,
    title: "Module 1",
    words: [
      { id: "w1-1", en: "Apple", tr: "Elma", example: "I eat an apple every day." },
      { id: "w1-2", en: "Book", tr: "Kitap", example: "This book is very interesting." },
      { id: "w1-3", en: "Cat", tr: "Kedi", example: "My cat is sleeping on the sofa." },
      { id: "w1-4", en: "Dog", tr: "Köpek", example: "The dog is barking outside." },
      { id: "w1-5", en: "House", tr: "Ev", example: "They have a big house." },
      { id: "w1-6", en: "Water", tr: "Su", example: "Can I have a glass of water?" },
      { id: "w1-7", en: "Friend", tr: "Arkadaş", example: "She is my best friend." },
      { id: "w1-8", en: "Car", tr: "Araba", example: "He drives a red car." },
      { id: "w1-9", en: "School", tr: "Okul", example: "We go to school by bus." },
      { id: "w1-10", en: "Time", tr: "Zaman", example: "What time is it?" }
    ]
  },
  {
    id: 2,
    title: "Module 2",
    words: [
      { id: "w2-1", en: "Family", tr: "Aile", example: "My family lives in Istanbul." },
      { id: "w2-2", en: "Money", tr: "Para", example: "I don't have enough money." },
      { id: "w2-3", en: "Work", tr: "İş/Çalışmak", example: "I work from 9 to 5." },
      { id: "w2-4", en: "Food", tr: "Yiyecek", example: "Turkish food is delicious." },
      { id: "w2-5", en: "Morning", tr: "Sabah", example: "Good morning!" },
      { id: "w2-6", en: "Night", tr: "Gece", example: "The stars are beautiful tonight." },
      { id: "w2-7", en: "Happy", tr: "Mutlu", example: "I am very happy today." },
      { id: "w2-8", en: "Sad", tr: "Üzgün", example: "Why are you sad?" },
      { id: "w2-9", en: "Big", tr: "Büyük", example: "That is a big building." },
      { id: "w2-10", en: "Small", tr: "Küçük", example: "I have a small problem." }
    ]
  },
  {
    id: 3,
    title: "Module 3",
    words: [
      { id: "w3-1", en: "Beautiful", tr: "Güzel", example: "It is a beautiful day." },
      { id: "w3-2", en: "Ugly", tr: "Çirkin", example: "This sweater is ugly." },
      { id: "w3-3", en: "Hot", tr: "Sıcak", example: "The tea is too hot." },
      { id: "w3-4", en: "Cold", tr: "Soğuk", example: "It is very cold outside." },
      { id: "w3-5", en: "Fast", tr: "Hızlı", example: "He runs very fast." },
      { id: "w3-6", en: "Slow", tr: "Yavaş", example: "Turtles are slow animals." },
      { id: "w3-7", en: "Good", tr: "İyi", example: "This is a good book." },
      { id: "w3-8", en: "Bad", tr: "Kötü", example: "That was a bad idea." },
      { id: "w3-9", en: "New", tr: "Yeni", example: "I bought a new phone." },
      { id: "w3-10", en: "Old", tr: "Eski/Yaşlı", example: "My car is old." }
    ]
  }
];

// Generate empty modules for 4 to 8 just for structure
for (let i = 4; i <= 8; i++) {
  const dummyWords = [];
  for (let j = 1; j <= 10; j++) {
    dummyWords.push({
      id: `w${i}-${j}`,
      en: `Word ${i}-${j}`,
      tr: `Kelime ${i}-${j}`,
      example: `Example sentence for word ${i}-${j}.`
    });
  }
  modules.push({
    id: i,
    title: `Module ${i}`,
    words: dummyWords
  });
}
