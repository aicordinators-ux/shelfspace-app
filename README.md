# 🛒 ShelfSpace App

تطبيق تتبع تنفيذ عقود مساحات الأرفف في FMCG. بيستخدم React + Firebase + GitHub Pages.

---

## 📋 المميزات

- ✅ **424 عميل** مع عقودهم (DRY و Impulse) في الكود مباشرة
- ✅ **حفظ على Firebase** — البيانات بتيجي على كل الأجهزة في نفس اللحظة
- ✅ **نظام صلاحيات** — مندوب يدخل زياراته فقط، مدير يشوف الكل ويعدل
- ✅ **PIN للمدير** — بدون Firebase Auth (أبسط)
- ✅ **Dashboard** — تحقيق العقد لكل مندوب/منطقة/سلسلة/فئة
- ✅ **تصدير Excel** — تقرير منظّم بكل التفاصيل
- ✅ **يشتغل على الموبايل** — RTL عربي

---

## 🚀 التشغيل المحلي (Local Development)

### المتطلبات
- Node.js 18 أو أحدث ([نزّل من هنا](https://nodejs.org))
- حساب Firebase
- حساب GitHub

### الخطوات

```bash
# 1. ثبّت الـ dependencies
npm install

# 2. أنشئ ملف .env بناءً على .env.example
cp .env.example .env

# 3. املأ بيانات Firebase في .env (شوف القسم الجاي)

# 4. شغّل المشروع
npm run dev
```

التطبيق هيفتح على `http://localhost:5173`

---

## 🔥 إعداد Firebase (لازم قبل التشغيل)

### الخطوة 1: إنشاء مشروع Firebase

1. ادخل [Firebase Console](https://console.firebase.google.com)
2. اضغط **"Add project"** أو **"إضافة مشروع"**
3. اختار اسم (مثلاً: `shelfspace-app`)
4. اختار **Disable Google Analytics** (مش محتاجها)
5. اضغط **Create project**

### الخطوة 2: تفعيل Firestore Database

1. من القائمة الجانبية: **Build → Firestore Database**
2. اضغط **Create database**
3. اختار **Start in production mode**
4. اختار location قريب (مثلاً `eur3 (europe-west)` أو `me-central1`)
5. بعد ما يخلص، روح **Rules** tab
6. انسخ محتوى ملف `firestore.rules` من المشروع
7. الصقه في الـ Rules editor واضغط **Publish**

### الخطوة 3: الحصول على API Keys

1. في Firebase Console → **Project settings** (أيقونة الترس)
2. مرر لتحت لـ **"Your apps"**
3. اضغط أيقونة الويب `</>`
4. اكتب اسم (مثلاً: `shelfspace-web`)
5. **لا تختار** "Firebase Hosting" (إحنا هنستخدم GitHub Pages)
6. اضغط **Register app**
7. هتلاقي object اسمه `firebaseConfig` — انسخ القيم منه

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",                    // VITE_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com",      // VITE_FIREBASE_AUTH_DOMAIN
  projectId: "shelfspace-app",            // VITE_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",       // VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789",         // VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:xxx:web:xxx"                  // VITE_FIREBASE_APP_ID
};
```

### الخطوة 4: ضع القيم في .env

افتح ملف `.env` وضع القيم اللي نسختها:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=shelfspace-app
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:xxx:web:xxx
```

دلوقتي شغّل `npm run dev` وهتلاقي التطبيق شغّال.

---

## 🌍 النشر على GitHub Pages

### الخطوة 1: إنشاء Repository على GitHub

1. ادخل [GitHub](https://github.com) → **New repository**
2. اختار اسم (مثلاً: `shelfspace-app`)
3. خلّيه **Public** (لازم عشان GitHub Pages المجاني)
4. **لا تضيف** README أو .gitignore (المشروع فيه بالفعل)
5. اضغط **Create repository**

### الخطوة 2: تعديل اسم الـ Repository في الكود

افتح `vite.config.js` وغير `base` لاسم الريبو الفعلي:

```javascript
base: '/shelfspace-app/',  // غيّرها لاسم الريبو بتاعك
```

### الخطوة 3: رفع الكود

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shelfspace-app.git
git push -u origin main
```

### الخطوة 4: تفعيل GitHub Pages

1. في الـ repo → **Settings** → **Pages**
2. تحت **"Build and deployment"** → **Source**: اختار **"GitHub Actions"**

### الخطوة 5: إضافة Firebase Secrets

عشان الـ build في GitHub Actions يقدر يقرأ Firebase keys:

1. في الـ repo → **Settings** → **Secrets and variables** → **Actions**
2. اضغط **"New repository secret"**
3. أضف الـ 6 secrets دول واحد واحد:

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | القيمة من firebaseConfig |
| `VITE_FIREBASE_AUTH_DOMAIN` | القيمة من firebaseConfig |
| `VITE_FIREBASE_PROJECT_ID` | القيمة من firebaseConfig |
| `VITE_FIREBASE_STORAGE_BUCKET` | القيمة من firebaseConfig |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | القيمة من firebaseConfig |
| `VITE_FIREBASE_APP_ID` | القيمة من firebaseConfig |

### الخطوة 6: تشغيل الـ Deployment

أي push على branch `main` هيشغّل الـ Action أوتوماتيك. أو ممكن تشغّله يدوياً:

1. روح **Actions** tab في الـ repo
2. اختار workflow **"Deploy to GitHub Pages"**
3. اضغط **"Run workflow"**

بعد دقيقتين، التطبيق هيكون متاح على:
```
https://YOUR_USERNAME.github.io/shelfspace-app/
```

---

## 🔐 PIN المدير

PIN الافتراضي هو **`2024`**. عشان تغيره:

1. افتح `src/services/auth.js`
2. غيّر القيمة:
   ```javascript
   export const MANAGER_PIN = '2024'; // غيّرها هنا
   ```
3. اعمل commit + push → الـ deployment هيتجدد أوتوماتيك

⚠️ **مهم:** الـ PIN موجود في الكود الـ frontend، يعني مش حماية قوية. للأمان الحقيقي، استخدم Firebase Auth.

---

## 👥 إضافة مندوبين

في **أول مرة** المدير يدخل التطبيق:
1. اختار **"مدير"**
2. أدخل PIN
3. هيظهر قسم **"إدارة المندوبين"** — أضف أسماء المندوبين
4. لما يدخلوا التطبيق، هيختاروا أسماءهم من القائمة

أو من داخل التطبيق: **تاب "المندوبين"** (للمدير فقط)

---

## 📊 الصلاحيات

| العملية | المندوب | المدير |
|---------|---------|--------|
| إدخال زيارة جديدة | ✅ | ✅ |
| تعديل زياراته | ✅ | ✅ |
| تعديل زيارات الآخرين | ❌ | ✅ |
| حذف زيارات | ❌ | ✅ |
| رؤية كل الزيارات في Dashboard | ❌ (يشوف زياراته فقط) | ✅ |
| إدارة المندوبين | ❌ | ✅ |
| تصدير Excel | ✅ (زياراته فقط) | ✅ (الكل) |

---

## 🛠️ Troubleshooting

### المشكلة: التطبيق فاضي / لا يحمل البيانات
**الحل:** افتح Console (F12) واتأكد من:
- ملف `.env` فيه القيم الصحيحة
- Firestore Rules منشورة
- المشروع شغّال (`npm run dev`)

### المشكلة: "Permission denied" عند الحفظ
**الحل:** تأكد إنك نشرت ملف `firestore.rules` في Firebase Console → Firestore → Rules

### المشكلة: GitHub Pages بيظهر صفحة بيضا
**الحل:**
- اتأكد إن `base` في `vite.config.js` هو نفس اسم الريبو
- اتأكد إن الـ Action خلّص بنجاح (Actions tab في GitHub)
- جرب hard refresh (Ctrl+Shift+R)

### المشكلة: المندوب مش لاقي اسمه في القائمة
**الحل:** المدير لازم يضيفه أولاً من تاب "المندوبين"

---

## 📁 هيكل المشروع

```
shelfspace-app/
├── src/
│   ├── App.jsx                    # الـ component الرئيسي
│   ├── main.jsx                   # نقطة الدخول
│   ├── components/
│   │   ├── LoginScreen.jsx        # شاشة الدخول
│   │   ├── CustomerPanel.jsx      # لوحة إدخال زيارة
│   │   ├── Dashboard.jsx          # لوحة الأداء
│   │   ├── VisitsLog.jsx          # سجل الزيارات
│   │   └── RepsManagement.jsx     # إدارة المندوبين
│   ├── services/
│   │   ├── firebase.js            # Firebase initialization
│   │   ├── visits.js              # Firestore operations للزيارات
│   │   ├── reps.js                # Firestore operations للمندوبين
│   │   ├── auth.js                # PIN-based session management
│   │   └── contracts.js           # حسابات العقود (utility)
│   ├── data/
│   │   └── customers.js           # بيانات الـ 424 عميل
│   └── styles/
│       └── global.css             # كل الـ CSS
├── .github/workflows/
│   └── deploy.yml                 # GitHub Actions auto-deploy
├── firestore.rules                # Firebase Security Rules
├── .env.example                   # نموذج Firebase keys
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 📦 Scripts المتاحة

```bash
npm run dev       # تشغيل local development server
npm run build     # بناء production build
npm run preview   # معاينة الـ production build محلياً
npm run deploy    # نشر يدوي (gh-pages — البديل لـ GitHub Actions)
```

---

## 🤝 الترقية المستقبلية

لو احتجت أمان أعلى:
1. استبدل `auth.js` بـ Firebase Auth
2. حدّث `firestore.rules` لتستخدم `request.auth.uid`
3. شيل الـ PIN واستخدم email/password حقيقي

---

**Built with ❤️ — React + Vite + Firebase**
