# Flutter Developer Guide — تطبيق المحاضرات

## نظرة عامة

تطبيق محاضرات للطلاب — الطالب يسجّل حساب برقمه الجامعي وكلمة سره، يفعّله المدير، ثم يدخل ويستعرض المحتوى التعليمي حسب القسم/السنة/الفصل/المادة.

**نوعا المستخدمين:**
- **Admin**: يدير المحتوى والطلاب
- **Student**: يسجّل بحسابه (اسم + رقم جامعي + كلمة سر)، الأدمن يفعّله ويعطيه مواد، الطالب يدخل برقمه الجامعي وكلمة سره

---

## Base URL

```
http://217.76.53.136:3015
```

كل الـ endpoints تبدأ بـ `/api`

> مثال طلب كامل: `http://217.76.53.136:3015/api/auth/student/login`

---

## Authentication

### نظام الـ Token

بعد تسجيل الدخول تحصل على **JWT token**، أرسله في كل طلب محمي:

```
Authorization: Bearer <token>
```

### تدفق الحساب

```
1. الطالب يسجّل   → register (full_name + university_id + password)
2. الأدمن يشاهده → /admin/students/pending
3. الأدمن يفعّله  → activate + يعطيه مواد
4. الطالب يدخل   → student/login (university_id + password + device_id)
```

---

## Endpoints

### 1. تسجيل حساب طالب جديد

```
POST /api/auth/student/register
```

**Body:**
```json
{
  "full_name": "أحمد محمد",
  "university_id": "2023001",
  "password": "mypassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "تم تسجيل حسابك، انتظر تفعيل المدير",
  "data": {
    "id": "uuid",
    "full_name": "أحمد محمد",
    "university_id": "2023001"
  }
}
```

> الحساب معلّق حتى يفعّله المدير. بعد التفعيل يقدر يدخل مباشرة بنفس الرقم الجامعي وكلمة السر اللي اختارها.

---

### 2. تسجيل دخول الطالب

```
POST /api/auth/student/login
```

**Body:**
```json
{
  "university_id": "2023001",
  "password": "mypassword",
  "device_id": "unique-device-identifier"
}
```

> `device_id`: معرّف الجهاز الفريد. أول مرة يدخل الطالب → يُربط الحساب بالجهاز. لو حاول جهاز ثاني → يُرفض.

**Response ناجح:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "full_name": "أحمد محمد",
    "university_id": "2023001",
    "role": "STUDENT"
  }
}
```

**Responses فاشلة:**
```json
{ "success": false, "message": "الرقم الجامعي أو كلمة السر غير صحيحة" }
{ "success": false, "message": "حسابك لم يُفعَّل بعد، تواصل مع المدير" }
{ "success": false, "message": "هذا الحساب مربوط بجهاز آخر" }
{ "success": false, "message": "انتهت صلاحية الاشتراك" }
```

> **مهم — منطق ربط الجهاز:**
> - أول login ناجح → يُحفظ `device_id` بالـ DB
> - أي login تالي بـ `device_id` مختلف → يُرفض برسالة "مربوط بجهاز آخر"
> - لو الطالب بدّل جهازه → الأدمن يعمل reset عبر `PATCH /api/admin/students/:id` بـ `{ "resetDevice": true }`

---

### 3. تسجيل دخول Admin

```
POST /api/auth/admin/login
```

**Body:**
```json
{
  "access_code": "ADMIN001",
  "password": "Admin@12345"
}
```

---

### 4. بيانات المستخدم الحالي

```
GET /api/auth/me
```

---

## Student Endpoints (يحتاج token طالب)

### التدفق الهرمي للمحتوى

```
أقسام → سنوات → فصول → مواد → (محاضرات | دورات | ذهبية | ملخصات | كويزات)
```

---

### 5. الأقسام المتاحة

```
GET /api/student/departments
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "قسم اللغة الإنجليزية", "description": "...", "order_num": 1 },
    { "id": 2, "name": "قسم الرياضيات", "description": "...", "order_num": 2 }
  ]
}
```

> يرجع فقط الأقسام التي فيها مواد مفعّلة للطالب.

---

### 6. السنوات داخل قسم

```
GET /api/student/departments/:departmentId/years
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "السنة الأولى", "order_num": 1 },
    { "id": 2, "name": "السنة الثانية", "order_num": 2 }
  ]
}
```

---

### 7. الفصول داخل سنة

```
GET /api/student/years/:yearId/semesters
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "الفصل الأول", "order_num": 1, "year_id": 1 },
    { "id": 2, "name": "الفصل الثاني", "order_num": 2, "year_id": 1 }
  ]
}
```

---

### 8. المواد داخل فصل

```
GET /api/student/semesters/:semesterId/subjects
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Grammar",
      "description": "...",
      "cover_image": "uploads/images/abc.jpg",
      "notebook_ai_url": "https://notebooklm.google.com/notebook/..."
    }
  ]
}
```

> `cover_image`: مسار نسبي — أضف الـ Base URL قبله.
> `notebook_ai_url`: إذا موجود، اعرض زر "افتح في NotebookLM".

---

### 9. محتوى المادة — 4 أقسام

كل مادة فيها 4 أقسام منفصلة. كلها بنفس الـ endpoint مع `category` مختلف:

```
GET /api/student/subjects/:subjectId/lectures?category=<TYPE>
```

| القسم | `category` |
|-------|------------|
| محاضرات | `LECTURE` (الافتراضي) |
| أسئلة دورات | `EXAM_QUESTIONS` |
| أوراق ذهبية | `GOLDEN_PAPER` |
| ملخصات | `SUMMARY` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Lesson 1 - Introduction",
      "content_type": "PDF",
      "category": "LECTURE",
      "order_num": 1,
      "notebook_ai_url": null
    }
  ]
}
```

> `content_type`: `PDF` | `TEXT` | `BOTH`

**في Flutter:** اعمل TabBar بـ 4 تبويبات داخل شاشة المادة:

```dart
final tabs = [
  ('محاضرات',     'LECTURE'),
  ('أسئلة دورات', 'EXAM_QUESTIONS'),
  ('أوراق ذهبية', 'GOLDEN_PAPER'),
  ('ملخصات',      'SUMMARY'),
];
```

---

### 10. كويزات المادة

```
GET /api/student/subjects/:subjectId/quizzes
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Quiz - Parts of Speech",
      "description": "...",
      "lecture": { "id": 1, "title": "Lesson 1" }
    }
  ]
}
```

---

### 11. تفاصيل محاضرة (مع الشرح)

```
GET /api/student/lectures/:lectureId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Lesson 1",
    "content_type": "PDF",
    "category": "LECTURE",
    "pdf_url": "uploads/pdfs/lecture.pdf",
    "text_content": null,
    "explanation_pdf": "uploads/pdfs/explanation.pdf",
    "explanation_text": "نص الشرح هنا...",
    "notebook_ai_url": "https://notebooklm.google.com/..."
  }
}
```

| الحقل | الوصف |
|-------|-------|
| `pdf_url` | PDF المحاضرة الرئيسية |
| `text_content` | نص المحاضرة (إذا كانت TEXT أو BOTH) |
| `explanation_pdf` | PDF شرح المحاضرة (اختياري) |
| `explanation_text` | نص شرح المحاضرة (اختياري) |
| `notebook_ai_url` | رابط NotebookLM للمحاضرة |

> **في الشاشة:** إذا `explanation_pdf` أو `explanation_text` موجود → اعرض زر "شرح المحاضرة" يفتح التبويبة المناسبة.

---

### 11.1 شات الـ AI للمحاضرة (جديد)

كل محاضرة فيها زر شات. الطالب عندو **3 أسئلة كحد أقصى لكل محاضرة باليوم** (تتجدد عند منتصف الليل).

**أ. جلب الحالة (الأسئلة المتبقية):**

```
GET /api/student/lectures/:lectureId/chat/usage
```

**Response:**
```json
{
  "success": true,
  "data": { "used": 1, "remaining": 2, "limit": 3 }
}
```

> اعرض هذا في الـ UI: "تبقى لك 2 من 3 أسئلة"

---

**ب. إرسال سؤال:**

```
POST /api/student/lectures/:lectureId/chat
```

**Body:**
```json
{ "question": "ما الفرق بين noun و pronoun؟" }
```

**Response ناجح (200):**
```json
{
  "success": true,
  "data": {
    "answer": "الـ noun هو اسم لشخص أو مكان أو شيء (مثل: book, teacher)، أما الـ pronoun فهو ضمير يحل محل الـ noun (مثل: he, she, it).",
    "remaining": 1
  }
}
```

**Response عند تجاوز الحد (403):**
```json
{ "success": false, "message": "وصلت للحد الأقصى من الأسئلة لليوم (3). تتجدد عند منتصف الليل." }
```

**Response عند خطأ AI (502):**
```json
{ "success": false, "message": "تعذّر الحصول على إجابة من الذكاء الاصطناعي حالياً" }
```

> **مهم**: العداد يزداد فقط عند **نجاح** الإجابة. لو فشل الـ AI، الطالب ما يخسر سؤال.

#### مثال خدمة Dart للشات

```dart
class ChatService {
  final String baseUrl = 'http://217.76.53.136:3015';
  final String token; // JWT
  ChatService(this.token);

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };

  // جلب الحالة قبل فتح الشات
  Future<ChatUsage> getUsage(int lectureId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/student/lectures/$lectureId/chat/usage'),
      headers: _headers,
    );
    final body = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(body['message']);
    final d = body['data'];
    return ChatUsage(used: d['used'], remaining: d['remaining'], limit: d['limit']);
  }

  // إرسال سؤال
  Future<ChatAnswer> ask(int lectureId, String question) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/student/lectures/$lectureId/chat'),
      headers: _headers,
      body: jsonEncode({'question': question}),
    );
    final body = jsonDecode(res.body);
    if (res.statusCode == 403) throw LimitReachedException(body['message']);
    if (res.statusCode == 502) throw AiUnavailableException(body['message']);
    if (res.statusCode != 200) throw Exception(body['message']);
    final d = body['data'];
    return ChatAnswer(answer: d['answer'], remaining: d['remaining']);
  }
}
```

#### نصائح UX

- اعرض العداد بوضوح: `2 من 3 متبقية`
- لمّا الـ remaining = 0: عطّل مربع الإرسال + اعرض رسالة "استنفدت أسئلتك لليوم — تتجدد منتصف الليل"
- لمّا الـ AI ما رد (502): اعرض زر "حاول مرة أخرى" — العداد ما ينقص في هاي الحالة
- اعرض indicator أثناء انتظار الرد (الـ AI ممكن ياخد 2-5 ثواني)
- خزّن المحادثة محلياً (في الذاكرة فقط، مش persistent) عشان الطالب يشوف الأسئلة السابقة في نفس الجلسة

---

### 12. عرض الكويز (بدون إجابات صحيحة)

```
GET /api/student/quizzes/:quizId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Quiz 1",
    "questions": [
      {
        "id": 1,
        "question_text": "What is a noun?",
        "question_type": "MCQ",
        "points": 1,
        "order_num": 1,
        "options": [
          { "id": 1, "option_text": "A person, place, or thing" },
          { "id": 2, "option_text": "An action word" }
        ]
      },
      {
        "id": 2,
        "question_text": "A verb describes an action.",
        "question_type": "TRUE_FALSE",
        "points": 1,
        "options": [
          { "id": 3, "option_text": "True" },
          { "id": 4, "option_text": "False" }
        ]
      },
      {
        "id": 3,
        "question_text": "Define an adjective.",
        "question_type": "SHORT_ANSWER",
        "points": 2,
        "options": []
      }
    ]
  }
}
```

> **مهم:** لا يوجد `is_correct` في الخيارات — التصحيح على السيرفر فقط.

---

### 13. تسليم الكويز ونتيجة من 100

```
POST /api/student/quizzes/:quizId/submit
```

**Body:**
```json
{
  "answers": [
    { "question_id": 1, "selected_option_id": 1 },
    { "question_id": 2, "selected_option_id": 3 },
    { "question_id": 3, "answer_text": "A word that describes a noun" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 3,
    "total_points": 4,
    "percentage": 75,
    "passed": true,
    "attempt": {
      "id": 1,
      "answers": [
        {
          "question_id": 1,
          "is_correct": true,
          "selected_option": { "option_text": "A person, place, or thing" },
          "question": {
            "question_text": "What is a noun?",
            "explanation": "Nouns name people, places, or things.",
            "points": 1
          }
        }
      ]
    }
  }
}
```

| الحقل | الوصف |
|-------|-------|
| `score` | الدرجة الخام |
| `total_points` | المجموع الكلي |
| `percentage` | النسبة من 100 |
| `passed` | true إذا ≥ 60% |

---

### 14. محاولاتي السابقة

```
GET /api/student/my-attempts
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "score": 3,
      "total_points": 4,
      "completed_at": "2026-04-26T10:30:00.000Z",
      "quiz": { "title": "Quiz 1" }
    }
  ]
}
```

---

## Admin Endpoints (يحتاج token admin)

### إدارة الطلاب

| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | `/api/admin/students` | الطلاب المفعّلين |
| GET | `/api/admin/students/pending` | الطلاب المعلّقين (سجّلوا ولم يُفعَّلوا) |
| POST | `/api/admin/students/activate` | تفعيل طالب بالرقم الجامعي |
| POST | `/api/admin/students` | إنشاء طالب يدوياً (الأدمن) |
| GET | `/api/admin/students/:id` | تفاصيل طالب |
| PATCH | `/api/admin/students/:id` | تعديل (تعطيل/تمديد/reset جهاز) |
| DELETE | `/api/admin/students/:id` | حذف |
| POST | `/api/admin/students/:id/grant-subjects` | تفعيل مواد للطالب |
| DELETE | `/api/admin/students/:id/subjects/:subjectId` | سحب مادة |

**تفعيل طالب (الأهم):**
```json
POST /api/admin/students/activate
{
  "university_id": "2023001",
  "expires_at": "2026-09-01",
  "subject_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "success": true,
  "message": "تم تفعيل الطالب بنجاح",
  "data": {
    "id": "uuid",
    "full_name": "أحمد",
    "university_id": "2023001",
    "is_active": true,
    "is_pending": false
  }
}
```

> الطالب يدخل برقمه الجامعي وكلمة السر التي اختارها وقت التسجيل — لا يحتاج كود.

---

### إدارة المحتوى

| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET/POST/PATCH/DELETE | `/api/admin/departments` | الأقسام |
| GET/POST/PATCH/DELETE | `/api/admin/years` | السنوات |
| GET/POST/PATCH/DELETE | `/api/admin/subjects` | المواد (مع رفع صورة) |
| GET/POST/PATCH/DELETE | `/api/admin/lectures` | المحاضرات (مع رفع PDF + شرح) |
| GET/POST/PATCH/DELETE | `/api/admin/quizzes` | الكويزات |

**رفع محاضرة كاملة (multipart/form-data):**
```
POST /api/admin/lectures

subject_id:        1
title:             "Lesson 1 - Nouns"
content_type:      PDF                  (PDF | TEXT | BOTH)
category:          LECTURE              (LECTURE | EXAM_QUESTIONS | GOLDEN_PAPER | SUMMARY)
order_num:         1
notebook_ai_url:   "https://..."        (اختياري)

pdf:               <File>               (المحاضرة الرئيسية)
explanation_pdf:   <File>               (شرح المحاضرة - اختياري)
explanation_text:  "نص الشرح"           (اختياري)
text_content:      "نص المحاضرة"        (اختياري)
```

**إضافة سؤال للكويز:**
```json
POST /api/admin/quizzes/1/questions
{
  "question_text": "What is a noun?",
  "question_type": "MCQ",
  "explanation": "Nouns name people, places, or things.",
  "points": 1,
  "order_num": 1,
  "options": [
    { "option_text": "A person, place, or thing", "is_correct": true },
    { "option_text": "An action word", "is_correct": false }
  ]
}
```

---

## تدفق الشاشات (Student)

```
[Splash]
    ↓
[Register] full_name + university_id + password
    ↓
[Pending] "بانتظار تفعيل المدير"
    ↓ (الأدمن يفعّل + يعطي مواد)
[Login] university_id + password + device_id
    ↓
[Home] الأقسام
    ↓
[Department] السنوات
    ↓
[Year] الفصلين (1, 2)
    ↓
[Semester] قائمة المواد (مع غلاف + زر AI)
    ↓
[Subject] TabBar 4 تبويبات + Tab كويزات:
    ├─ محاضرات
    ├─ أسئلة دورات
    ├─ أوراق ذهبية
    ├─ ملخصات
    └─ كويزات
    ↓
[Lecture]
    ├─ PDF / نص المحاضرة
    └─ زر مساعدة في الأسفل ⤵
         ↓ (يفتح bottom sheet بخيارين)
    [Bottom Sheet]
    ├─ "شرح المحاضرة" → يعرض explanation_pdf أو explanation_text
    └─ "اسأل الذكاء الاصطناعي" → شاشة الشات
                                    ↓
                          [AI Chat Screen]
                          ├─ مربع رسالة + زر إرسال
                          ├─ عداد "تبقى لك X من 3 أسئلة"
                          └─ تاريخ الأسئلة والأجوبة
    ↓
[Quiz]
    ├─ MCQ / TRUE_FALSE / SHORT_ANSWER
    └─ تسليم → نتيجة من 100 + Pass/Fail + شرح كل سؤال
```

---

## ملاحظات تقنية مهمة

### 1. Device ID
```dart
// device_info_plus package
final deviceInfo = DeviceInfoPlugin();
String deviceId;
if (Platform.isAndroid) {
  final info = await deviceInfo.androidInfo;
  deviceId = info.id;
} else {
  final info = await deviceInfo.iosInfo;
  deviceId = info.identifierForVendor ?? '';
}
```

### 2. عرض الملفات
```
http://217.76.53.136:3015/uploads/pdfs/filename.pdf
```
- لعرض PDF: `flutter_pdfview` أو `syncfusion_flutter_pdfviewer`

### 3. فتح NotebookLM
```dart
import 'package:url_launcher/url_launcher.dart';

if (lecture.notebookAiUrl != null) {
  await launchUrl(Uri.parse(lecture.notebookAiUrl!));
}
```

### 4. Token Storage
خزّن الـ token في `flutter_secure_storage` وليس `SharedPreferences`.

### 5. التعامل مع 401
إذا جاء `401` → امسح الـ token ووجّه المستخدم لشاشة Login.

### 6. منع السكرين شوت (مطلوب)
```dart
// في initState للشاشات الحساسة
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);
```

---

## Models مقترحة (Dart)

```dart
class User {
  final String id;
  final String fullName;
  final String? universityId;
  final String role; // ADMIN | STUDENT
}

class Department {
  final int id;
  final String name;
  final String? description;
}

class AcademicYear {
  final int id;
  final String name;
  final int orderNum;
}

class Semester {
  final int id;
  final String name;
  final int orderNum;
}

class Subject {
  final int id;
  final String name;
  final String? description;
  final String? coverImage;
  final String? notebookAiUrl;
}

class Lecture {
  final int id;
  final String title;
  final String contentType;     // PDF | TEXT | BOTH
  final String category;        // LECTURE | EXAM_QUESTIONS | GOLDEN_PAPER | SUMMARY
  final String? pdfUrl;
  final String? textContent;
  final String? explanationPdf;
  final String? explanationText;
  final String? notebookAiUrl;
}

class Quiz {
  final int id;
  final String title;
  final String? description;
  final List<QuizQuestion> questions;
}

class QuizQuestion {
  final int id;
  final String questionText;
  final String questionType; // MCQ | TRUE_FALSE | SHORT_ANSWER
  final int points;
  final List<QuizOption> options;
}

class QuizOption {
  final int id;
  final String optionText;
}

class QuizResult {
  final int score;
  final int totalPoints;
  final int percentage;
  final bool passed;
}

class ChatUsage {
  final int used;
  final int remaining;
  final int limit;
}

class ChatAnswer {
  final String answer;
  final int remaining;
}
```

---

## بيانات الاختبار

**Admin:**
- access_code: `ADMIN001`
- password: `Admin@12345`

**طلاب جاهزين (من الـ seed) — كلمة السر للجميع: `student123`:**
- `2023001` (أحمد) → Grammar + Reading + Vocabulary
- `2023002` (سارة) → Grammar فقط
- `2023003` (محمود) → 4 مواد كاملة

---

## ⚠️ ملاحظات مهمة جداً للمبرمج

### 1. ما في كود تفعيل (Access Code) للطلاب

النظام تغيّر — **الطالب يدخل برقمه الجامعي + كلمة سره فقط**، ما في كود يُعطى له. الأدمن فقط يفعّل الحساب من قائمة `pending` ويعطيه المواد.

### 2. كلمة السر بتنشال بالـ register

الطالب نفسو يختار كلمة السر وقت التسجيل. ما في API لـ "نسيت كلمة السر" حالياً — لو بدها، الأدمن يضيف endpoint أو يعمل reset يدوي.

### 3. الجهاز الواحد = حساب واحد

أول جهاز يدخل عليه الطالب → بيصير محصور عليه. لو بدل جهاز → ما يقدر يدخل حتى الأدمن يعمل `resetDevice: true`.

```dart
// في شاشة الـ login، لو رجعت "هذا الحساب مربوط بجهاز آخر":
showDialog(
  // اعرض رسالة: "تواصل مع المدير لإعادة ضبط الجهاز"
);
```

### 4. التدفق الصحيح للشاشات

```
Splash
  ├─ في token محفوظ؟
  │    ├─ نعم → جرّب /auth/me
  │    │         ├─ نجح → Home
  │    │         └─ فشل (401) → Login (امسح token)
  │    └─ لا → Login
  │
  ├─ Login (university_id + password)
  │    ├─ نجح → Home
  │    ├─ فشل (401) → "بيانات غير صحيحة"
  │    ├─ فشل (403 + pending) → شاشة "بانتظار التفعيل"
  │    └─ فشل (403 + device) → "مربوط بجهاز آخر"
  │
  └─ Register (full_name + university_id + password)
       └─ نجح → شاشة "بانتظار التفعيل"
```

### 5. ما يلزم تخزين كلمة السر

استخدم `flutter_secure_storage` للـ JWT token فقط. **لا تخزّن كلمة السر** بأي مكان.
