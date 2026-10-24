# Frontend (Web) API Guide — موقع المحاضرات

دليل كامل لمطوّر الفرونت (React / Next / Vue ...) — كل الـ endpoints، الـ body، والـ response.

الموقع فيه جزأين:
- **واجهة الطالب**: تسجيل، دخول، تصفّح المواد، المحاضرات، الكويزات، أسئلة MCQ، شات AI.
- **لوحة الأدمن**: إدارة الطلاب، الأقسام، السنوات، الفصول، المواد، المحاضرات، الكويزات والأسئلة.

---

## 1. أساسيات

### Base URL

```
http://217.76.53.136:3015
```

كل الـ endpoints تبدأ بـ `/api`. مثال: `http://217.76.53.136:3015/api/auth/student/login`

### Health check

```
GET /health   →   { "status": "ok" }
```

### Authentication

بعد الدخول بترجع **JWT token** (صالح 30 يوم افتراضياً). أرسله بكل طلب محمي:

```
Authorization: Bearer <token>
```

### شكل الرد الموحّد

نجاح:
```json
{ "success": true, "data": ... }
```

خطأ:
```json
{ "success": false, "message": "رسالة الخطأ" }
```

### أكواد الأخطاء

| Code | المعنى | شو يعمل الفرونت |
|------|--------|-----------------|
| 400 | بيانات ناقصة / ملف غير صالح | اعرض `message` |
| 401 | لا يوجد token / token غير صالح / الحساب موقوف | امسح التوكن ووجّه لصفحة الدخول |
| 403 | لا صلاحية (مادة غير مفعّلة، اشتراك منتهي، جهاز آخر، حد الشات) | اعرض `message` |
| 404 | العنصر غير موجود | صفحة 404 |
| 409 | مكرر (رقم جامعي مسجّل، طالب مفعّل مسبقاً) | اعرض `message` |
| 429 | محاولات دخول كثيرة (10 كل 15 دقيقة) | اعرض `message` |
| 502 | فشل الذكاء الاصطناعي | "حاول لاحقاً" |

### الملفات (صور / PDF / صوت)

الـ API بيرجّع مسار نسبي مثل `uploads/pdfs/1712345-123.pdf`. الرابط الكامل:

```js
const fileUrl = (p) => p ? `${BASE_URL}/${p.replace(/\\/g, '/')}` : null;
```

> ⚠️ إذا الموقع على دومين مختلف عن السيرفر، `helmet` بيحط افتراضياً
> `Cross-Origin-Resource-Policy: same-origin` وهاد بيمنع عرض الصور/PDF بـ `<img>` أو `<iframe>`.
> لازم الباك إند يعدّل `app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))`.

### Enums

| Enum | القيم |
|------|-------|
| `role` | `ADMIN`, `STUDENT` |
| `content_type` | `PDF`, `TEXT`, `BOTH`, `MCQ` |
| `category` | `LECTURE` (محاضرات), `EXAM_QUESTIONS` (أسئلة دورات), `GOLDEN_PAPER` (أوراق ذهبية), `SUMMARY` (ملخصات) |
| `question_type` | `MCQ`, `TRUE_FALSE`, `SHORT_ANSWER` |

### ملاحظات مهمة للأنواع

- الـ IDs للطلاب **UUID (string)**، وكل شي تاني (قسم، سنة، مادة، محاضرة، كويز، سؤال، خيار) **رقم (int)**.
- بـ submit الكويز/الأسئلة لازم `question_id` و `selected_option_id` يكونوا **أرقام** مش strings (المقارنة صارمة).
- `subject_ids` بتفعيل المواد لازم تكون **array of numbers**.
- بطلبات JSON ابعت `order_num` كرقم.

---

## 2. Auth

### 2.1 تسجيل طالب جديد

```
POST /api/auth/student/register
```

```json
{ "full_name": "أحمد محمد", "university_id": "2023001", "password": "mypassword" }
```

Response `201`:
```json
{
  "success": true,
  "message": "تم تسجيل حسابك، انتظر تفعيل المدير وستحصل على كودك",
  "data": { "id": "uuid", "full_name": "أحمد محمد", "university_id": "2023001" }
}
```

> الحساب بيضل معلّق لحتى يفعّله الأدمن. أخطاء: `400` حقول ناقصة، `409` رقم جامعي مسجّل.

### 2.2 دخول الطالب

```
POST /api/auth/student/login
```

```json
{ "university_id": "2023001", "password": "mypassword", "device_id": "..." }
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": "uuid", "full_name": "أحمد محمد", "university_id": "2023001", "role": "STUDENT" }
}
```

> **device_id بالموقع:** الحساب بيرتبط بأول جهاز بيدخل منه. بالويب ولّد UUID مرة وحدة واحفظه بـ `localStorage`:
> ```js
> let deviceId = localStorage.getItem('device_id');
> if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('device_id', deviceId); }
> ```
> إذا الطالب مسح بيانات المتصفح أو فتح من متصفح تاني بيطلعلو "هذا الحساب مربوط بجهاز آخر" — الأدمن لازم يعمل reset للجهاز.

أخطاء `403`: `حسابك لم يُفعَّل بعد` / `الحساب موقوف` / `انتهت صلاحية الاشتراك` / `هذا الحساب مربوط بجهاز آخر`.

### 2.3 دخول الأدمن

```
POST /api/auth/admin/login
```

```json
{ "access_code": "ADMIN-CODE", "password": "adminpass" }
```

Response:
```json
{ "success": true, "token": "eyJhbGci...", "user": { "id": "uuid", "full_name": "Admin", "role": "ADMIN" } }
```

### 2.4 المستخدم الحالي

```
GET /api/auth/me          🔒 (طالب أو أدمن)
```

```json
{
  "success": true,
  "user": {
    "id": "uuid", "full_name": "...", "university_id": "...", "role": "STUDENT",
    "is_active": true, "is_pending": false, "expires_at": null, "created_at": "..."
  }
}
```

> استعمله عند فتح الموقع لتتأكد إن التوكن صالح وتعرف الـ role لتوجّه لواجهة الطالب أو لوحة الأدمن.

---

## 3. واجهة الطالب

كلها 🔒 بتوكن **طالب**. الطالب بيشوف بس الأقسام/السنوات/الفصول/المواد اللي فيها مواد مفعّلة إلو.

### تدفق الصفحات

```
الأقسام → السنوات → الفصول → المواد → (تبويبات: محاضرات | أسئلة دورات | أوراق ذهبية | ملخصات | كويزات)
                                           ↓
                                      صفحة المحاضرة (PDF / نص / صوت / شرح / كويزات / MCQ / شات AI)
```

### 3.1 الأقسام

```
GET /api/student/departments
```
```json
{ "success": true, "data": [ { "id": 1, "name": "اللغة الإنجليزية", "description": null, "order_num": 1 } ] }
```

### 3.2 سنوات قسم

```
GET /api/student/departments/:departmentId/years
```
```json
{ "success": true, "data": [ { "id": 1, "name": "السنة الأولى", "order_num": 1, "cover_image": "uploads/images/xxx.jpg" } ] }
```

### 3.3 فصول سنة

```
GET /api/student/years/:yearId/semesters
```
```json
{ "success": true, "data": [ { "id": 1, "year_id": 1, "name": "الفصل الأول", "order_num": 1 } ] }
```

### 3.4 مواد فصل

```
GET /api/student/semesters/:semesterId/subjects
```
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Grammar", "description": "...", "cover_image": "uploads/images/xxx.jpg", "notebook_ai_url": null }
  ]
}
```

### 3.5 محتوى مادة (حسب التبويب)

```
GET /api/student/subjects/:subjectId/lectures?category=LECTURE
```

`category` اختياري (الافتراضي `LECTURE`): `LECTURE` | `EXAM_QUESTIONS` | `GOLDEN_PAPER` | `SUMMARY`

```json
{
  "success": true,
  "data": [
    { "id": 10, "title": "Lecture 1", "content_type": "BOTH", "category": "LECTURE", "order_num": 1, "notebook_ai_url": null }
  ]
}
```

`403` إذا المادة مش مفعّلة للطالب.

### 3.6 كل كويزات مادة

```
GET /api/student/subjects/:subjectId/quizzes
```
```json
{
  "success": true,
  "data": [ { "id": 5, "title": "Quiz 1", "description": null, "lecture": { "id": 10, "title": "Lecture 1" } } ]
}
```

### 3.7 تفاصيل محاضرة

```
GET /api/student/lectures/:lectureId
```
```json
{
  "success": true,
  "data": {
    "id": 10,
    "subject_id": 1,
    "title": "Lecture 1",
    "content_type": "BOTH",
    "category": "LECTURE",
    "pdf_url": "uploads/pdfs/xxx.pdf",
    "audio_url": "uploads/audio/xxx.mp3",
    "text_content": "...",
    "explanation_pdf": "uploads/pdfs/yyy.pdf",
    "explanation_text": "...",
    "notebook_ai_url": null,
    "order_num": 1,
    "subject": { "id": 1, "name": "Grammar", "...": "..." },
    "quizzes": [ { "id": 5, "title": "Quiz 1", "description": null } ]
  }
}
```

**طريقة العرض حسب `content_type`:**

| content_type | اعرض |
|--------------|------|
| `PDF` | `pdf_url` بـ iframe / pdf viewer |
| `TEXT` | `text_content` |
| `BOTH` | الاتنين |
| `MCQ` | صفحة أسئلة (3.8) |

وبكل الحالات: إذا في `audio_url` اعرض `<audio>`، وإذا في `explanation_pdf` / `explanation_text` اعرض قسم "الشرح"، وإذا في `quizzes` اعرض أزرار الكويزات.

### 3.8 أسئلة MCQ لمحتوى (تصحيح فوري، بدون حفظ)

```
GET /api/student/lectures/:lectureId/questions
```
```json
{
  "success": true,
  "data": [
    {
      "id": 1, "question_text": "Choose the correct...", "question_type": "MCQ", "points": 1, "order_num": 1,
      "options": [ { "id": 1, "option_text": "is" }, { "id": 2, "option_text": "are" } ]
    }
  ]
}
```

```
POST /api/student/lectures/:lectureId/questions/submit
```
```json
{ "answers": [ { "question_id": 1, "selected_option_id": 2 } ] }
```
```json
{
  "success": true,
  "data": {
    "score": 1, "total_points": 1, "percentage": 100, "passed": true,
    "results": [
      { "question_id": 1, "selected_option_id": 2, "correct_option_id": 2, "is_correct": true, "explanation": "..." }
    ]
  }
}
```

> `passed` = النسبة ≥ 60%. استعمل `correct_option_id` لتلوين الخيار الصح والغلط.

### 3.9 الكويز

```
GET /api/student/quizzes/:quizId
```
```json
{
  "success": true,
  "data": {
    "id": 5, "lecture_id": 10, "title": "Quiz 1", "description": null,
    "lecture": { "id": 10, "title": "Lecture 1", "subject": { "id": 1, "name": "Grammar" } },
    "questions": [
      {
        "id": 1, "question_text": "...", "question_type": "MCQ", "explanation": "...", "points": 1, "order_num": 1,
        "options": [ { "id": 1, "option_text": "A" }, { "id": 2, "option_text": "B" } ]
      }
    ]
  }
}
```

> ⚠️ `explanation` بيرجع مع الأسئلة — لا تعرضه إلا بعد التسليم.

```
POST /api/student/quizzes/:quizId/submit
```
```json
{
  "answers": [
    { "question_id": 1, "selected_option_id": 2 },
    { "question_id": 3, "answer_text": "نص الإجابة" }
  ]
}
```
```json
{
  "success": true,
  "data": {
    "score": 3, "total_points": 5, "percentage": 60, "passed": true,
    "attempt": {
      "id": 7, "quiz_id": 5, "score": 3, "total_points": 5, "completed_at": "...",
      "answers": [
        {
          "question_id": 1, "selected_option_id": 2, "answer_text": null, "is_correct": true,
          "question": { "question_text": "...", "explanation": "...", "points": 1 },
          "selected_option": { "option_text": "B" }
        }
      ]
    }
  }
}
```

> أسئلة `SHORT_ANSWER` دايماً `is_correct: false` (ما في تصحيح تلقائي). المحاولة بتنحفظ.

### 3.10 محاولاتي

```
GET /api/student/my-attempts
```
```json
{
  "success": true,
  "data": [ { "id": 7, "quiz_id": 5, "score": 3, "total_points": 5, "completed_at": "...", "quiz": { "title": "Quiz 1" } } ]
}
```

### 3.11 شات AI عن المحاضرة

حد يومي إجمالي (افتراضياً **8 أسئلة باليوم** لكل المحاضرات مع بعض)، بيتجدد منتصف الليل.

```
GET /api/student/chat/usage                        ← الحصة اليومية
GET /api/student/lectures/:lectureId/chat/usage    ← نفسها + تحقق صلاحية المحاضرة
```
```json
{ "success": true, "data": { "used": 3, "remaining": 5, "limit": 8 } }
```

```
POST /api/student/lectures/:lectureId/chat
```
```json
{ "question": "شو الفرق بين present simple و present continuous؟" }
```
```json
{ "success": true, "data": { "answer": "...", "remaining": 4 } }
```

أخطاء: `400` سؤال فاضي أو > 1000 حرف، `403` وصلت الحد اليومي، `502` فشل الـ AI.

> الرد ممكن ياخد عدة ثواني — اعرض loading واقفل زر الإرسال.

---

## 4. لوحة الأدمن

كلها 🔒 بتوكن **أدمن** (`403 Admin access required` لغير الأدمن).

### 4.1 الطلاب

| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | `/api/admin/students` | الطلاب المفعّلين |
| GET | `/api/admin/students/pending` | طلبات التسجيل المعلّقة |
| POST | `/api/admin/students/activate` | تفعيل طالب معلّق |
| POST | `/api/admin/students` | إنشاء طالب يدوياً (مفعّل مباشرة) |
| GET | `/api/admin/students/:id` | تفاصيل طالب + مواده |
| PATCH | `/api/admin/students/:id` | إيقاف / تفعيل / تمديد / reset جهاز |
| DELETE | `/api/admin/students/:id` | حذف طالب |
| POST | `/api/admin/students/:id/grant-subjects` | إعطاء مواد |
| DELETE | `/api/admin/students/:id/subjects/:subjectId` | سحب مادة |

**شكل الطالب بالقوائم:**
```json
{
  "id": "uuid", "full_name": "أحمد", "university_id": "2023001",
  "is_active": true, "is_pending": false, "expires_at": null, "device_id": "…", "created_at": "…"
}
```

**تفعيل طالب:**
```
POST /api/admin/students/activate
```
```json
{ "university_id": "2023001", "expires_at": "2026-12-31", "subject_ids": [1, 2, 3] }
```
`expires_at` و `subject_ids` اختياريين. أخطاء: `404` غير موجود، `409` مفعّل مسبقاً.

**إنشاء طالب:**
```json
{ "full_name": "أحمد", "university_id": "2023001", "password": "123456", "expires_at": null }
```

**تفاصيل طالب** (`GET /students/:id`):
```json
{
  "success": true,
  "data": {
    "id": "uuid", "full_name": "...", "university_id": "...", "is_active": true, "...": "...",
    "subject_access": [
      { "id": 1, "subject_id": 1, "granted_at": "...", "expires_at": null, "subject": { "id": 1, "name": "Grammar" } }
    ]
  }
}
```

**تعديل طالب** (كل الحقول اختيارية):
```json
{ "is_active": false, "expires_at": "2027-01-01", "resetDevice": true }
```
- `is_active: false` → إيقاف الحساب
- `expires_at: null` → بدون انتهاء
- `resetDevice: true` → فك ربط الجهاز (يقدر يدخل من متصفح/جهاز جديد)

**إعطاء مواد:**
```json
{ "subject_ids": [1, 2], "expires_at": null }
```

### 4.2 الأقسام

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/departments` | — |
| POST | `/api/admin/departments` | `{ "name": "...", "description": "...", "order_num": 1 }` |
| PATCH | `/api/admin/departments/:id` | أي حقل من `name`, `description`, `order_num` |
| DELETE | `/api/admin/departments/:id` | — |

GET بيرجع كل قسم مع `_count: { years: n }`.

> ⚠️ الحذف cascade: حذف قسم بيحذف كل سنواته وفصوله ومواده ومحاضراته. اطلب تأكيد.

### 4.3 السنوات

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/years` | — (كل السنوات) |
| GET | `/api/admin/departments/:departmentId/years` | — |
| POST | `/api/admin/years` | `department_id`, `name`, `order_num`, `cover_image` (اختياري) |
| PATCH | `/api/admin/years/:id` | أي حقل من `name`, `order_num`, `department_id`, `cover_image`, `remove_cover_image` |
| DELETE | `/api/admin/years/:id` | — |

GET بيرجع كل سنة مع `cover_image` و `department: { id, name }` و `semesters: [...]`.

**صورة السنة:** لرفع صورة ابعت الطلب `multipart/form-data` وفيه حقل `cover_image` (jpg/png/webp/gif). بدون صورة بتقدر تضل تبعت JSON عادي.
- بالـ PATCH: صورة جديدة بتستبدل القديمة، و `remove_cover_image: true` (أو `"true"` بالفورم) بيشيل الصورة.
- `cover_image` بيرجع مسار نسبي، حوّله لرابط بـ `fileUrl()`.

```js
const fd = new FormData();
fd.append('department_id', 1);
fd.append('name', 'السنة الأولى');
fd.append('order_num', 1);
fd.append('cover_image', imageFile);
await api('/admin/years', { method: 'POST', formData: fd });
```

### 4.4 الفصول

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/semesters` | — |
| GET | `/api/admin/years/:yearId/semesters` | — |
| POST | `/api/admin/semesters` | `{ "year_id": 1, "name": "الفصل الأول", "order_num": 1 }` |
| PATCH | `/api/admin/semesters/:id` | `name`, `order_num` |
| DELETE | `/api/admin/semesters/:id` | — |

GET بيرجع كل فصل مع `year: { id, name }`.

### 4.5 المواد — `multipart/form-data`

| Method | Endpoint |
|--------|----------|
| GET | `/api/admin/subjects` |
| POST | `/api/admin/subjects` |
| PATCH | `/api/admin/subjects/:id` |
| DELETE | `/api/admin/subjects/:id` |

**حقول الفورم:**

| الحقل | النوع | ملاحظات |
|-------|-------|---------|
| `semester_id` | text | مطلوب بالإنشاء |
| `name` | text | مطلوب بالإنشاء |
| `description` | text | اختياري |
| `notebook_ai_url` | text | اختياري |
| `cover_image` | file | jpg/png/webp/gif |

GET بيرجع كل مادة مع `semester: { ..., year: {...} }`.

### 4.6 المحاضرات / المحتوى — `multipart/form-data`

| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | `/api/admin/subjects/:subjectId/lectures?category=` | قائمة (category اختياري) |
| GET | `/api/admin/lectures/:id` | تفاصيل كاملة |
| POST | `/api/admin/lectures` | إنشاء |
| PATCH | `/api/admin/lectures/:id` | تعديل |
| DELETE | `/api/admin/lectures/:id` | حذف |

**حقول الفورم:**

| الحقل | النوع | ملاحظات |
|-------|-------|---------|
| `subject_id` | text | مطلوب |
| `title` | text | مطلوب |
| `content_type` | text | `PDF` / `TEXT` / `BOTH` / `MCQ` — مطلوب |
| `category` | text | افتراضي `LECTURE` |
| `order_num` | text | مطلوب |
| `text_content` | text | إذا فاضي وفي PDF، النص بينستخرج تلقائياً |
| `explanation_text` | text | إذا فاضي وفي `explanation_pdf`، بينستخرج تلقائياً |
| `notebook_ai_url` | text | اختياري |
| `pdf` | file | PDF |
| `explanation_pdf` | file | PDF |
| `audio` | file | mp3/m4a/wav/ogg/aac/webm/opus |

> الحد الأقصى لحجم الملف 50MB. رفع PDF ممكن ياخد وقت بسبب استخراج النص — اعرض progress.
> بالـ PATCH ابعت بس الحقول اللي تغيّرت.

القائمة بترجع: `{ id, title, content_type, category, order_num, _count: { quizzes } }`.

**صيانة:** إعادة استخراج النص لكل المحاضرات اللي نصها فاضي (بطيء جداً — 8 ثواني لكل محاضرة):
```
POST /api/admin/maintenance/reextract-texts
→ { "success": true, "total": 5, "updated": 4, "failed": 1, "errors": [ { "id": 3, "title": "...", "reason": "..." } ] }
```

### 4.7 الكويزات (JSON)

| Method | Endpoint | Body |
|--------|----------|------|
| GET | `/api/admin/lectures/:lectureId/quizzes` | — |
| GET | `/api/admin/quizzes/:id` | — (مع الأسئلة والخيارات و `is_correct`) |
| POST | `/api/admin/quizzes` | `{ "lecture_id": 10, "title": "Quiz 1", "description": "..." }` |
| PATCH | `/api/admin/quizzes/:id` | `title`, `description` |
| DELETE | `/api/admin/quizzes/:id` | — |

**أسئلة الكويز:**

| Method | Endpoint |
|--------|----------|
| POST | `/api/admin/quizzes/:quizId/questions` |
| PATCH | `/api/admin/questions/:id` |
| DELETE | `/api/admin/questions/:id` |

إضافة سؤال:
```json
{
  "question_text": "Choose the correct answer",
  "question_type": "MCQ",
  "explanation": "لأن الفاعل جمع",
  "points": 1,
  "order_num": 1,
  "options": [
    { "option_text": "is", "is_correct": false },
    { "option_text": "are", "is_correct": true }
  ]
}
```

> لـ `TRUE_FALSE` ابعت خيارين (صح/خطأ). لـ `SHORT_ANSWER` بدون options.
> ⚠️ PATCH سؤال الكويز بيعدّل بس `question_text`, `points`, `explanation` — **ما بيعدّل الخيارات**. لتغيير الخيارات: احذف السؤال وأضفه من جديد.

**تعبئة أسئلة الكويز من صورة / PDF بالذكاء الاصطناعي:**

الأدمن بيرفع الملف → المودل بيقرأ الأسئلة والأجوبة → بتنعرض بفورم قابل للتعديل → الأدمن بيكبس حفظ.

الخطوة 1 — الاستخراج (**ما بيحفظ شي**)، `multipart/form-data`:
```
POST /api/admin/quizzes/extract-questions
```
| الحقل | النوع | ملاحظات |
|-------|-------|---------|
| `files` | file (متعدد) | اختياري — صور (jpg/png/webp) أو PDF، لحد 10 ملفات، المجموع ≤ 18MB |
| `text` | text | اختياري — نص أسئلة ملصوق، لحد **20000 حرف** |

> لازم واحد منهم على الأقل (`files` أو `text`). إذا إجو التنين، بترجع الأسئلة كلها بمصفوفة وحدة: أسئلة النص أول وبعدها الملفات، و `order_num` متسلسل عالكل.

```json
{
  "success": true,
  "data": [
    {
      "question_text": "She ___ to school every day.",
      "question_type": "MCQ",
      "explanation": null,
      "answer_source": "FILE",
      "points": 1,
      "order_num": 1,
      "options": [
        { "option_text": "go", "is_correct": false },
        { "option_text": "goes", "is_correct": true }
      ]
    }
  ]
}
```

> `answer_source`: `FILE` = الجواب كان محدد بالملف، `AI` = المودل هو اللي اختار الجواب. **ميّز أسئلة `AI` بلون تحذير** ليراجعها الأدمن قبل الحفظ.
> الطلب ممكن ياخد 10–40 ثانية — اعرض loading.
> أخطاء: `400` لا ملفات ولا نص / نوع غير مدعوم / حجم كبير / نص أطول من 20000 حرف، `422` ما في أسئلة، `502` فشل الـ AI.

الخطوة 2 — الحفظ دفعة واحدة (JSON) بعد مراجعة الأدمن:
```
POST /api/admin/quizzes/:quizId/questions/bulk
```
```json
{ "questions": [ { "question_text": "...", "question_type": "MCQ", "explanation": null, "points": 1, "options": [ ... ] } ] }
```

Response `201`: `data` = الأسئلة المحفوظة مع الـ ids والخيارات.

> الأسئلة بتنضاف بعد الأسئلة الموجودة بالكويز بنفس ترتيب المصفوفة (`order_num` و `answer_source` المرسلين بيتجاهلهم السيرفر).
> كل سؤال MCQ / TRUE_FALSE لازم فيه خيارين على الأقل و**جواب صحيح واحد بالضبط**، وإلا `400` مع رقم السؤال. إذا في سؤال غلط ما بينحفظ ولا سؤال.
> إذا الكويز لسا مو موجود: أنشئه أول بـ `POST /api/admin/quizzes` وبعدها ابعت الأسئلة.

### 4.8 أسئلة MCQ للمحتوى (منفصلة عن الكويزات)

للمحتوى اللي `content_type = MCQ` (مثلاً أسئلة دورات).

| Method | Endpoint |
|--------|----------|
| GET | `/api/admin/lectures/:lectureId/questions` |
| POST | `/api/admin/lectures/:lectureId/questions` |
| PATCH | `/api/admin/lecture-questions/:id` |
| DELETE | `/api/admin/lecture-questions/:id` |

نفس body إضافة سؤال الكويز (`question_type` افتراضي `MCQ`).

> هون الـ PATCH بيقبل `options` — إذا بعتها بتنستبدل كل الخيارات القديمة بالجديدة.

---

## 5. API client جاهز (fetch)

```js
// src/api/client.js
export const BASE_URL = 'http://217.76.53.136:3015';

export const fileUrl = (p) => (p ? `${BASE_URL}/${p.replace(/\\/g, '/')}` : null);

export function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  if (!res.ok || json.success === false) {
    throw Object.assign(new Error(json.message || 'حدث خطأ'), { status: res.status });
  }
  return json;
}
```

```js
// src/api/endpoints.js
import { api, getDeviceId } from './client';

export const auth = {
  register: (data) => api('/auth/student/register', { method: 'POST', body: data }),
  studentLogin: (university_id, password) =>
    api('/auth/student/login', { method: 'POST', body: { university_id, password, device_id: getDeviceId() } }),
  adminLogin: (access_code, password) => api('/auth/admin/login', { method: 'POST', body: { access_code, password } }),
  me: () => api('/auth/me'),
};

export const student = {
  departments: () => api('/student/departments'),
  years: (departmentId) => api(`/student/departments/${departmentId}/years`),
  semesters: (yearId) => api(`/student/years/${yearId}/semesters`),
  subjects: (semesterId) => api(`/student/semesters/${semesterId}/subjects`),
  lectures: (subjectId, category = 'LECTURE') => api(`/student/subjects/${subjectId}/lectures?category=${category}`),
  subjectQuizzes: (subjectId) => api(`/student/subjects/${subjectId}/quizzes`),
  lecture: (id) => api(`/student/lectures/${id}`),
  lectureQuestions: (id) => api(`/student/lectures/${id}/questions`),
  submitLectureQuestions: (id, answers) => api(`/student/lectures/${id}/questions/submit`, { method: 'POST', body: { answers } }),
  quiz: (id) => api(`/student/quizzes/${id}`),
  submitQuiz: (id, answers) => api(`/student/quizzes/${id}/submit`, { method: 'POST', body: { answers } }),
  myAttempts: () => api('/student/my-attempts'),
  chatUsage: () => api('/student/chat/usage'),
  lectureChatUsage: (id) => api(`/student/lectures/${id}/chat/usage`),
  ask: (id, question) => api(`/student/lectures/${id}/chat`, { method: 'POST', body: { question } }),
};

export const admin = {
  // Students
  students: () => api('/admin/students'),
  pendingStudents: () => api('/admin/students/pending'),
  activateStudent: (data) => api('/admin/students/activate', { method: 'POST', body: data }),
  createStudent: (data) => api('/admin/students', { method: 'POST', body: data }),
  student: (id) => api(`/admin/students/${id}`),
  updateStudent: (id, data) => api(`/admin/students/${id}`, { method: 'PATCH', body: data }),
  deleteStudent: (id) => api(`/admin/students/${id}`, { method: 'DELETE' }),
  grantSubjects: (id, subject_ids, expires_at = null) =>
    api(`/admin/students/${id}/grant-subjects`, { method: 'POST', body: { subject_ids, expires_at } }),
  revokeSubject: (id, subjectId) => api(`/admin/students/${id}/subjects/${subjectId}`, { method: 'DELETE' }),

  // Departments
  departments: () => api('/admin/departments'),
  createDepartment: (data) => api('/admin/departments', { method: 'POST', body: data }),
  updateDepartment: (id, data) => api(`/admin/departments/${id}`, { method: 'PATCH', body: data }),
  deleteDepartment: (id) => api(`/admin/departments/${id}`, { method: 'DELETE' }),

  // Years
  years: (departmentId) => api(departmentId ? `/admin/departments/${departmentId}/years` : '/admin/years'),
  // data: object (JSON) أو FormData (مع cover_image)
  createYear: (data) =>
    api('/admin/years', { method: 'POST', ...(data instanceof FormData ? { formData: data } : { body: data }) }),
  updateYear: (id, data) =>
    api(`/admin/years/${id}`, { method: 'PATCH', ...(data instanceof FormData ? { formData: data } : { body: data }) }),
  deleteYear: (id) => api(`/admin/years/${id}`, { method: 'DELETE' }),

  // Semesters
  semesters: (yearId) => api(yearId ? `/admin/years/${yearId}/semesters` : '/admin/semesters'),
  createSemester: (data) => api('/admin/semesters', { method: 'POST', body: data }),
  updateSemester: (id, data) => api(`/admin/semesters/${id}`, { method: 'PATCH', body: data }),
  deleteSemester: (id) => api(`/admin/semesters/${id}`, { method: 'DELETE' }),

  // Subjects (FormData)
  subjects: () => api('/admin/subjects'),
  createSubject: (formData) => api('/admin/subjects', { method: 'POST', formData }),
  updateSubject: (id, formData) => api(`/admin/subjects/${id}`, { method: 'PATCH', formData }),
  deleteSubject: (id) => api(`/admin/subjects/${id}`, { method: 'DELETE' }),

  // Lectures (FormData)
  lectures: (subjectId, category) =>
    api(`/admin/subjects/${subjectId}/lectures${category ? `?category=${category}` : ''}`),
  lecture: (id) => api(`/admin/lectures/${id}`),
  createLecture: (formData) => api('/admin/lectures', { method: 'POST', formData }),
  updateLecture: (id, formData) => api(`/admin/lectures/${id}`, { method: 'PATCH', formData }),
  deleteLecture: (id) => api(`/admin/lectures/${id}`, { method: 'DELETE' }),
  reextractTexts: () => api('/admin/maintenance/reextract-texts', { method: 'POST' }),

  // Quizzes
  quizzes: (lectureId) => api(`/admin/lectures/${lectureId}/quizzes`),
  quiz: (id) => api(`/admin/quizzes/${id}`),
  createQuiz: (data) => api('/admin/quizzes', { method: 'POST', body: data }),
  updateQuiz: (id, data) => api(`/admin/quizzes/${id}`, { method: 'PATCH', body: data }),
  deleteQuiz: (id) => api(`/admin/quizzes/${id}`, { method: 'DELETE' }),
  addQuestion: (quizId, data) => api(`/admin/quizzes/${quizId}/questions`, { method: 'POST', body: data }),
  updateQuestion: (id, data) => api(`/admin/questions/${id}`, { method: 'PATCH', body: data }),
  deleteQuestion: (id) => api(`/admin/questions/${id}`, { method: 'DELETE' }),
  // files: File[] (صور / PDF) و/أو text (نص ملصوق) → أسئلة للمراجعة، بدون حفظ
  extractQuestions: (files = [], text = '') => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (text.trim()) formData.append('text', text);
    return api('/admin/quizzes/extract-questions', { method: 'POST', formData });
  },
  addQuestionsBulk: (quizId, questions) =>
    api(`/admin/quizzes/${quizId}/questions/bulk`, { method: 'POST', body: { questions } }),

  // Lecture MCQ questions
  lectureQuestions: (lectureId) => api(`/admin/lectures/${lectureId}/questions`),
  addLectureQuestion: (lectureId, data) => api(`/admin/lectures/${lectureId}/questions`, { method: 'POST', body: data }),
  updateLectureQuestion: (id, data) => api(`/admin/lecture-questions/${id}`, { method: 'PATCH', body: data }),
  deleteLectureQuestion: (id) => api(`/admin/lecture-questions/${id}`, { method: 'DELETE' }),
};
```

**مثال رفع محاضرة:**
```js
const fd = new FormData();
fd.append('subject_id', 1);
fd.append('title', 'Lecture 1');
fd.append('content_type', 'BOTH');
fd.append('category', 'LECTURE');
fd.append('order_num', 1);
fd.append('pdf', pdfFile);        // File من <input type="file">
fd.append('audio', audioFile);    // اختياري
await admin.createLecture(fd);
```

---

## 6. الصفحات المقترحة

**الطالب:**
1. `/register` — تسجيل
2. `/login` — دخول
3. `/` — الأقسام
4. `/departments/:id` — السنوات
5. `/years/:id` — الفصول
6. `/semesters/:id` — المواد
7. `/subjects/:id` — تبويبات (محاضرات / أسئلة دورات / أوراق ذهبية / ملخصات / كويزات)
8. `/lectures/:id` — المحاضرة + الشات
9. `/lectures/:id/questions` — MCQ
10. `/quizzes/:id` — الكويز + النتيجة
11. `/my-attempts` — محاولاتي

**الأدمن:**
1. `/admin/login`
2. `/admin/students` — تبويب المفعّلين + المعلّقين
3. `/admin/students/:id` — تفاصيل، مواد، إيقاف، reset جهاز
4. `/admin/content` — شجرة: أقسام → سنوات → فصول → مواد
5. `/admin/subjects/:id` — محاضرات المادة حسب التبويب
6. `/admin/lectures/:id` — تعديل المحاضرة + كويزاتها + أسئلة MCQ
7. `/admin/quizzes/:id` — أسئلة الكويز
