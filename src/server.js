require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Node بيسكّر أي طلب بياخد أكتر من 5 دقايق افتراضياً، وهاد بيقطع رفع الملفات الكبيرة
// عالنت البطيء (Broken pipe عند العميل). منطوّله لـ 30 دقيقة
server.requestTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS) || 30 * 60 * 1000;
