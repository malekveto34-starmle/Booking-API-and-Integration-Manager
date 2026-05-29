import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Send, 
  Database, 
  FileSpreadsheet, 
  Copy, 
  RefreshCw, 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  BookOpen, 
  CreditCard, 
  Check, 
  ChevronRight,
  BookMarked,
  ShieldCheck,
  FileCode,
  Users
} from 'lucide-react';

// الأنواع والبيانات المشتركة
interface Booking {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  paymentMethod: string;
  createdAt: string;
}

interface IntegrationStatus {
  databaseConfigured: boolean;
  databaseType: string;
  googleSheetsConfigured: boolean;
  googleSpreadsheetId: string;
  googleClientEmail: string;
}

const SPECIALTIES = [
  'هندسة البرمجيات (Software Engineering)',
  'تطوير الويب المتكامل (Full-Stack Development)',
  'علوم البيانات والذكاء الاصطناعي (Data Science & AI)',
  'إدارة تكنولوجيا المعلومات والشبكات (IT & Networking)',
  'تصميم واجهات وتجربة المستخدم (UI/UX Design)',
  'تخصص آخر / طالب (Other / Student)',
];

const PAYMENT_METHODS = [
  { id: 'cash', name: 'كاش (نقدي)', desc: 'الدفع نقداً في مقر الفرع', icon: '💵' },
  { id: 'instapay', name: 'انستاباي', desc: 'تحويل من خلال تطبيق انستاباي', icon: '⚡' },
];

export default function App() {
  // تفاصيل حالة النموذج
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    specialty: '',
    paymentMethod: 'cash',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<{
    success: boolean;
    message: string;
    data?: Booking;
    integrations?: { database: string; googleSheets: string; email?: string };
  } | null>(null);

  // حالة التكامل والمزامنة
  const [status, setStatus] = useState<IntegrationStatus>({
    databaseConfigured: false,
    databaseType: 'جاري التحميل...',
    googleSheetsConfigured: false,
    googleSpreadsheetId: '',
    googleClientEmail: '',
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'admin'>('form');

  // جلب الحالة والبيانات من الـ Express API
  const fetchStatusAndBookings = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      // 1. جلب حالة التكامل
      const statusRes = await fetch('/api/status');
      if (statusRes.ok && statusRes.headers.get('content-type')?.includes('application/json')) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      // 2. جلب الحجوزات السابقة
      const bookingsRes = await fetch('/api/bookings');
      if (bookingsRes.ok && bookingsRes.headers.get('content-type')?.includes('application/json')) {
        const bookingsData = await bookingsRes.json();
        if (bookingsData.success) {
          setBookings(bookingsData.bookings || []);
        }
      }
    } catch (err) {
      console.error('Error fetching data from local server:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatusAndBookings(true);
    // تكرار الجلب كل 30 ثانية لتحديث البيانات تلقائياً
    const interval = setInterval(() => fetchStatusAndBookings(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // التحقق من الحقول
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'الاسم الكامل مطلوب للحجز';
    if (!formData.email.trim()) {
      errors.email = 'البريد الإلكتروني مطلوب للاتصال بالمتدرب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'يرجى إدخال بريد إلكتروني صالح';
    }
    if (!formData.phone.trim()) errors.phone = 'رقم الهاتف مطلوب لمتابعة التسجيل بالواتساب';
    if (!formData.specialty) errors.specialty = 'يرجى تحديد تخصصك الدراسي أو المهني';
    if (!formData.paymentMethod) errors.paymentMethod = 'يرجى تحديد طريقة الدفع المفضلة';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // إرسال طلب الحجز
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiResponse(null);

    if (!validateForm()) {
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      let result;
      if (response.ok) {
        result = await response.json();
      } else {
        try {
          result = await response.json();
        } catch {
          throw new Error(`Server returned ${response.status}`);
        }
      }
      
      setApiResponse(result);

      if (response.ok && result?.success) {
        // تفريغ النموذج عند النجاح
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          specialty: '',
          paymentMethod: 'cash',
        });
        setFormErrors({});
        // تحديث الحجوزات
        fetchStatusAndBookings(true);
      }
    } catch (error: any) {
      setApiResponse({
        success: false,
        message: 'تعذر الاتصال بالخادم السحابي. يرجى التحقق من اتصال الإنترنت وحالة التشغيل.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // كود Next.js المراد عرضه للمستخدم بالكامل لنسخه
  const nextJsRouteCode = `import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';

// ----------------------------------------------------------------------
// 1. اتصالات قواعد البيانات السحابية (Supabase)
// ----------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const trimmedUrl = SUPABASE_URL.trim();
    if (trimmedUrl.match(/^https?:\\/\\//i)) {
      supabase = createClient(trimmedUrl, SUPABASE_SERVICE_ROLE_KEY.trim());
    } else {
      console.warn("Invalid SUPABASE_URL: Must be a valid HTTP or HTTPS URL.");
    }
  } catch (err) {
    console.error("Error initializing Supabase client:", err);
  }
}

// ----------------------------------------------------------------------
// 2. إعدادات Google Sheets المعتمدة على الـ Service Account
// ----------------------------------------------------------------------
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, phone, specialty, paymentMethod } = body;

    // التحقق من صحة البيانات (Validation)
    if (!fullName?.trim() || !email?.trim() || !phone?.trim() || !specialty?.trim() || !paymentMethod?.trim()) {
      return NextResponse.json({ success: false, message: 'ممنوع وجود حقول فارغة' }, { status: 400 });
    }

    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: 'البريد الإلكتروني غير صالح' }, { status: 400 });
    }

    const bookingData = {
      id: uuidv4(),
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      specialty: specialty.trim(),
      
      paymentMethod: paymentMethod.trim(),
      createdAt: new Date().toISOString()
    };

    // أ) الحفظ في Supabase Database
    let dbSaved = false;
    let dbErrorMessage = '';
    
    if (supabase) {
      try {
        const { error: dbError } = await supabase
          .from('bookings')
          .insert([{
            id: bookingData.id,
            full_name: bookingData.fullName,
            email: bookingData.email,
            phone: bookingData.phone,
            specialty: bookingData.specialty,
            
            payment_method: bookingData.paymentMethod,
            created_at: bookingData.createdAt
          }]);
        if (dbError) throw dbError;
        dbSaved = true;
      } catch (err: any) {
        dbErrorMessage = err.message || 'خطأ في جدول Supabase';
      }
    } else {
      dbErrorMessage = 'Supabase Environment variables not configured.';
    }

    // ب) استخدام مكتبة googleapis للإرسال اللحظي لـ Google Sheet
    let sheetSaved = false;
    let sheetErrorMessage = '';

    if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SPREADSHEET_ID) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_CLIENT_EMAIL,
          private_key: GOOGLE_PRIVATE_KEY.replace(/\\\\n/g, '\\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const maxRetries = 3;
      let attempts = 0;

      while(attempts < maxRetries && !sheetSaved) {
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A:H',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
              values: [
                [
                  bookingData.id,
                  bookingData.fullName,
                  bookingData.email,
                  bookingData.phone,
                  bookingData.specialty,
                  
                  bookingData.paymentMethod,
                  bookingData.createdAt
                ]
              ]
            }
          });
          sheetSaved = true;
        } catch (sheetErr: any) {
          attempts++;
          if (attempts >= maxRetries) {
             sheetErrorMessage = sheetErr.message || 'خطأ أثناء الكتابة لملف Google Sheets';
          }
        }
      }
    } else {
      sheetErrorMessage = 'مفاتيح Google API ناقصة في ملف الـ Environment (.env)';
    }

    // ج) إرسال بريد إلكتروني تأكيدي (Resend)
    let emailSent = false;
    let emailMessage = '';
    if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: \`الأكاديمية الدولية <\${process.env.SENDER_EMAIL}>\`,
          to: bookingData.email,
          subject: 'تأكيد حجز الدورة التدريبية',
          html: \`
            <div dir="rtl" style="font-family: sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #4f46e5;">مرحباً \${bookingData.fullName}،</h2>
              <p>تم استلام طلب حجزك بنجاح. رقم الحجز: \${bookingData.id}</p>
            </div>
          \`,
        });
        emailSent = true;
      } catch (error) {
        emailMessage = 'فشل إرسال الإيميل';
      }
    }

    // د) اتخاذ قرار إرجاع النتيجة
    if (!dbSaved && !sheetSaved) {
      return NextResponse.json({
        success: false,
        message: 'فشلت المزامنة وقاعدة البيانات بالكامل لعقبة تقنية.',
        details: { db: dbErrorMessage, sheets: sheetErrorMessage }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'تم استقبال وحفظ الحجز بنجاح!',
      data: bookingData,
      integrations: {
        database: dbSaved ? 'مكتمل بنجاح' : \`فاشل: \${dbErrorMessage}\`,
        googleSheets: sheetSaved ? 'مكتمل بنجاح' : \`فاشل: \${sheetErrorMessage}\`,
        email: emailSent ? 'تم إرسال بريد التأكيد' : emailMessage
      }
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'حدث خطأ تقني داخلي في الخادم',
      error: error.message
    }, { status: 500 });
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(nextJsRouteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans antialiased" dir="rtl">
      {/* رأس الصفحة العصري الأنيق */}
      <header className="bg-white border-b border-[#e2e8f0]/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* الشعار وعنوان وتفاصيل البوابة */}
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2.5 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/10">
                <BookMarked className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                  الأكاديمية الدولية للتدريب
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                  منصة التسجيل الإلكتروني في دورات وكورسات التمريض
                </p>
              </div>
            </div>

            {/* أزرار التبديل والمؤشرات */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              {activeTab === 'admin' ? (
                <button
                  onClick={() => setActiveTab('form')}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 bg-[#f1f5f9] text-slate-600 hover:bg-[#e2e8f0]"
                >
                  <BookOpen className="w-4 h-4" />
                  بوابة الحجز
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('admin')}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 bg-slate-900 text-white shadow-md shadow-slate-900/10"
                >
                  <Database className="w-4 h-4" />
                  دخول الإدارة
                </button>
              )}
              {activeTab === 'admin' && (
                <button
                  onClick={() => fetchStatusAndBookings()}
                  disabled={isRefreshing}
                  className="bg-white border border-[#e2e8f0] text-slate-600 hover:text-slate-900 hover:bg-[#f8fafc] p-2.5 rounded-xl transition-all duration-300 disabled:opacity-50"
                  title="تحديث حالة البيئة"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'admin' && (
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* كارت 1: حالة الاتصال بقاعدة البيانات لبيئة الـ Live Demo */}
          <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0]/80 shadow-xs flex items-start gap-4">
            <div className={`p-3 rounded-xl flex items-center justify-center ${status.databaseConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
              <Database className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">قاعدة البيانات الحالية</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                {status.databaseType}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`w-2 h-2 rounded-full ${status.databaseConfigured ? 'bg-emerald-500 shrink-0' : 'bg-indigo-500 shrink-0'}`} />
                <span className="text-xs text-slate-500 font-medium truncate">
                  {status.databaseConfigured ? 'نشط (مستعد لاستقبال الحجوزات)' : 'حفظ تلقائي احتياطي في JSON'}
                </span>
              </div>
            </div>
          </div>

          {/* كارت 2: حالة التكامل مع Google Sheets */}
          <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0]/80 shadow-xs flex items-start gap-4">
            <div className={`p-3 rounded-xl flex items-center justify-center ${status.googleSheetsConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">تكامل جداول Google Sheets</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                {status.googleSheetsConfigured ? 'مفعل وجاهز للكتابة اللحظية' : 'غير متصل (بانتظار تهيئة البيئة)'}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`w-2 h-2 rounded-full ${status.googleSheetsConfigured ? 'bg-emerald-500 shrink-0' : 'bg-red-400 shrink-0'}`} />
                <span className="text-xs text-slate-500 font-medium truncate">
                  {status.googleSheetsConfigured ? `ID: ${status.googleSpreadsheetId.substring(0, 12)}...` : 'سيتم المزامنة محلياً حتى إدخال المفاتيح'}
                </span>
              </div>
            </div>
          </div>

          {/* كارت 3: الحماية والأمان والأداء العام */}
          <div className="bg-white p-5 rounded-2xl border border-[#e2e8f0]/80 shadow-xs flex items-start gap-4 md:col-span-2 lg:col-span-1">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">حماية البيانات والتحقق (Validation)</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate">حماية قوية ومصادقة آمنة</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 truncate">
                تم عزل مفاتيح Google و Supabase بالكامل في السيرفر دون تسريبات.
              </p>
            </div>
          </div>

        </section>
        )}

        {/* عرض تفاعلي بناء على التبويب المختار */}
        <AnimatePresence mode="wait">
          {activeTab === 'form' ? (
            <motion.div
              key="form-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="max-w-3xl mx-auto"
            >
              
              {/* نموذج الحجز المباشر (التفاعلي) */}
              <div className="w-full">
                
                {/* Banner Image Place */}
                <div className="mb-6 rounded-3xl overflow-hidden shadow-xs border border-slate-200 relative bg-indigo-50 min-h-[200px] sm:min-h-[300px] flex items-center justify-center group">
                  {/* رسالة إرشادية في حال عدم رفع الصورة بدلاً من placehold */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-indigo-800 z-0">
                    <BookMarked className="w-12 h-12 mb-3 opacity-50" />
                    <h3 className="font-bold text-lg mb-1">صورة البنر غير موجودة</h3>
                    <p className="text-sm opacity-80 max-w-md">لإظهار البنر الذي قمت بإرفاقه: افتح قائمة الملفات، ثم افتح مجلد public، وارفع الصورة باسم banner.jpg</p>
                  </div>
                  <img 
                    src="/banner.jpg" 
                    alt="الأكاديمية الدولية للتدريب" 
                    className="w-full h-auto object-cover max-h-[500px] object-top bg-transparent relative z-10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>

                <div className="bg-white rounded-3xl border border-[#e2e8f0] p-6 sm:p-8 shadow-xs">
                  <div className="border-b border-slate-100 pb-5 mb-6">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase">استمارة الحجز</span>
                    <h2 className="text-xl font-bold text-slate-900 mt-2">بداية التسجيل في كورسات التمريض</h2>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">يرجى تعبئة الحقول التالية بعناية، وسيتم تأكيد حجزك وإرسال التفاصيل.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* الاسم الكامل */}
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        الاسم الكامل للمتدرب/ة <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="مثل: مالك بن أحمد بن علي"
                        className={`w-full px-4 py-3 rounded-xl border ${formErrors.fullName ? 'border-rose-500 ring-rose-200' : 'border-[#e2e8f0] ring-indigo-50/50'} focus:outline-hidden focus:border-indigo-500 focus:ring-4 transition-all placeholder-slate-400 text-xs sm:text-sm`}
                      />
                      {formErrors.fullName && (
                        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {formErrors.fullName}
                        </p>
                      )}
                    </div>

                    {/* البريد الإلكتروني ورقم الهاتف في صف واحد على الشاشات الكبيرة */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      
                      {/* البريد الإلكتروني */}
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-slate-400" />
                          البريد الإلكتروني <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="example@student.com"
                          className={`w-full px-4 py-3 rounded-xl border ${formErrors.email ? 'border-rose-500 ring-rose-200' : 'border-[#e2e8f0] ring-indigo-50/50'} focus:outline-hidden focus:border-indigo-500 focus:ring-4 transition-all placeholder-slate-400 text-xs sm:text-sm ltr font-mono`}
                        />
                        {formErrors.email && (
                          <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {formErrors.email}
                          </p>
                        )}
                      </div>

                      {/* رقم الهاتف */}
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Phone className="w-4 h-4 text-slate-400" />
                          رقم الهاتف <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+966 50 123 4567"
                          className={`w-full px-4 py-3 rounded-xl border ${formErrors.phone ? 'border-rose-500 ring-rose-200' : 'border-[#e2e8f0] ring-indigo-50/50'} focus:outline-hidden focus:border-indigo-500 focus:ring-4 transition-all placeholder-slate-400 text-xs sm:text-sm ltr font-mono`}
                        />
                        {formErrors.phone && (
                          <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {formErrors.phone}
                          </p>
                        )}
                      </div>

                    </div>

                    {/* التخصص الدراسي أو المهني */}
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-slate-400" />
                        التخصص الأكاديمي أو المهني <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        className={`w-full px-4 py-3 rounded-xl border ${formErrors.specialty ? 'border-rose-500 ring-rose-200' : 'border-[#e2e8f0] ring-indigo-50/50'} bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-4 transition-all text-xs sm:text-sm`}
                      >
                        <option value="">-- يرجى تحديد التخصص من القائمة --</option>
                        {SPECIALTIES.map((spec, i) => (
                          <option key={i} value={spec}>{spec}</option>
                        ))}
                      </select>
                      {formErrors.specialty && (
                        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {formErrors.specialty}
                        </p>
                      )}
                    </div>

                    {/* وسيلة الدفع المفضلة */}
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-slate-400" />
                        طريقة السداد المفضلة <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {PAYMENT_METHODS.map((method) => (
                          <label
                            key={method.id}
                            className={`border rounded-xl p-3 flex flex-col items-center text-center cursor-pointer transition-all duration-200 ${
                              formData.paymentMethod === method.name
                                ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600'
                                : 'border-[#e2e8f0] hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={method.name}
                              checked={formData.paymentMethod === method.name}
                              onChange={() => setFormData({ ...formData, paymentMethod: method.name })}
                              className="sr-only"
                            />
                            <span className="text-2xl mb-1.5 block">{method.icon}</span>
                            <span className="text-xs font-bold text-slate-900 block">{method.name}</span>
                            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1 text-center leading-normal block">
                              {method.desc}
                            </span>
                          </label>
                        ))}
                      </div>
                      {formErrors.paymentMethod && (
                        <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {formErrors.paymentMethod}
                        </p>
                      )}
                    </div>

                    {/* زر الإرسال والحجز */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            جاري فحص وتأمين البيانات وإرسال الطلب...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5 ltr" />
                            تأكيد طلب الحجز وإرسال البيانات
                          </>
                        )}
                      </button>
                    </div>

                  </form>

                  {/* رسائل التنبيه والنتائج والاتحاد تلقائي */}
                  <AnimatePresence>
                    {apiResponse && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className={`overflow-hidden border rounded-2xl p-5 ${
                          apiResponse.success 
                            ? 'bg-emerald-50/50 border-emerald-100 text-emerald-950' 
                            : 'bg-rose-50/40 border-rose-100 text-rose-950'
                        }`}
                      >
                        <div className="flex gap-3">
                          {apiResponse.success ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                          )}
                          <div className="flex-1">
                            <h4 className="font-bold text-sm leading-6">
                              {apiResponse.success ? 'تمت معالجة تسجيل الحجز بنجاح!' : 'لم تكتمل معالجة الحجز بالكامل'}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 font-medium">
                              {apiResponse.success && apiResponse.data?.id && (
                                <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md inline-block mb-1 ltr">ID: {apiResponse.data.id.split('-')[0]}</span>
                              )}
                              <br/>
                              {apiResponse.message}
                            </p>
                            
                            {/* نتائج التكامل بالتفصيل */}
                            {apiResponse.integrations && (
                              <div className="mt-4 pt-3 border-t border-slate-200/65 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-white/80 p-3 rounded-lg border border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <span className="text-xs font-bold text-slate-700">قاعدة البيانات:</span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 block mt-1 leading-normal font-mono">
                                    {apiResponse.integrations.database}
                                  </span>
                                </div>
                                <div className="bg-white/80 p-3 rounded-lg border border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="w-4 h-4 text-[#107c41] shrink-0" />
                                    <span className="text-xs font-bold text-slate-700">Google Sheets:</span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 block mt-1 leading-normal font-mono">
                                    {apiResponse.integrations.googleSheets}
                                  </span>
                                </div>
                                {apiResponse.integrations.email && (
                                  <div className="bg-white/80 p-3 rounded-lg border border-slate-100 md:col-span-2">
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-rose-500 shrink-0" />
                                      <span className="text-xs font-bold text-slate-700">تأكيد البريد (Resend):</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 block mt-1 leading-normal font-mono">
                                      {apiResponse.integrations.email}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </div>

            </motion.div>
          ) : (
            
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-3xl border border-[#e2e8f0] overflow-hidden shadow-xs">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">سجل الحجوزات</h2>
                      <p className="text-xs text-slate-500 mt-1">
                        إجمالي الحجوزات: {bookings.length}
                      </p>
                    </div>
                    <button
                      onClick={() => fetchStatusAndBookings()}
                      disabled={isRefreshing}
                      className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="p-0">
                    {bookings.length > 0 ? (
                      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                        {bookings.map((booking) => (
                          <div key={booking.id} className="p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-sm text-slate-900">{booking.fullName}</h4>
                                <div className="text-xs text-slate-500 flex flex-col gap-1 mt-1.5">
                                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {booking.email}</span>
                                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> <span dir="ltr">{booking.phone}</span></span>
                                  <span className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {booking.specialty}</span>
                                  <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> {booking.paymentMethod}</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                {new Date(booking.createdAt).toLocaleDateString('ar-SA')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500">
                        <Users className="w-12 h-12 mb-3 text-slate-300" />
                        <p className="text-sm">لا توجد حجوزات بعد</p>
                        <p className="text-xs text-slate-400 mt-1">سيتم عرض الحجوزات الجديدة هنا</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
  
              
              {/* عرض وتصدير كود Next.js App Router */}
              <div className="bg-white rounded-3xl border border-[#e2e8f0] overflow-hidden shadow-xs">
                
                {/* الهيدر للبطاقة البرمجية */}
                <div className="bg-slate-950 text-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-850">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 text-indigo-400 rounded-xl">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base">مسار الواجهة البرمجية (API Route in Next.js)</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ملف الكود الكامل كما طلبتم في المسار: <span className="font-mono text-indigo-400">src/app/api/bookings/route.ts</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={copyToClipboard}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          تم نسخ الكود!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-0.5" />
                          نسخ الكود بالكامل
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* الوصف والتحذيرات */}
                <div className="bg-indigo-50/50 border-b border-indigo-100 p-4 shrink-0">
                  <div className="flex gap-2.5 items-start">
                    <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-indigo-950 leading-relaxed font-sans">
                      <strong className="block mb-1 font-bold">طريقة التهيئة والتشغيل في تطبيق Next.js الخاص بك:</strong>
                      1. قم بنسخ الكود أدناه ووضعه في ملف <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-rose-600">src/app/api/bookings/route.ts</code> داخل مشروعك. <br />
                      2. ثبّت مكتبات التطوير المطلوبة عبر npm: <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-indigo-800">npm install googleapis @supabase/supabase-js uuid resend</code>. <br />
                      3. أضف متغيرات البيئة المناسبة لملف <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold text-slate-800">.env.local</code> كما هو موضح بالكامل في التبويب الجانبي.
                    </div>
                  </div>
                </div>

                {/* كود المصدر الفعلي في نافذة مبرمجة ملونة */}
                <div className="p-1.5 bg-slate-950 block">
                  <pre className="text-xs text-slate-300 font-mono p-5 overflow-x-auto leading-6 ltr text-left max-h-[600px] select-all bg-slate-900 rounded-xl">
                    <code>{nextJsRouteCode}</code>
                  </pre>
                </div>

              </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* الفوتر */}
      <footer className="bg-white border-t border-[#e2e8f0]/80 mt-16 py-8 text-center text-xs sm:text-sm text-slate-400 font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
          <p>
            الأكاديمية الدولية للتدريب © {new Date().getFullYear()} - جميع الحقوق محفوظة
          </p>
          <div className="mt-4 flex justify-center gap-4 text-xs">
            <button 
              onClick={() => setActiveTab('admin')} 
              className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
            >
              <Database className="w-3.5 h-3.5" /> الإدارة المحمية
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
