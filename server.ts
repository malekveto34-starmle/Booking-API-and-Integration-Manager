import express from 'express';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';

// تهيئة تطبيق Express
const app = express();
const PORT = 3000;

app.use(express.json());

// ----------------------------------------------------------------------
// إعداد قاعدة البيانات و Google Sheets
// ----------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: any = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const trimmedUrl = SUPABASE_URL.trim();
    if (trimmedUrl.match(/^https?:\/\//i)) {
      supabase = createClient(trimmedUrl, SUPABASE_SERVICE_ROLE_KEY.trim());
    } else {
      console.warn("Invalid SUPABASE_URL: Must be a valid HTTP or HTTPS URL.");
    }
  } catch (err) {
    console.error("Error initializing Supabase client:", err);
  }
}

// مسار الحفظ المحلي في حال عدم توفر Supabase تسهيلاً للاختبار المباشر
const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'bookings.json');
if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) {
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
}
if (!fs.existsSync(LOCAL_DB_PATH)) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2), 'utf-8');
}

function getLocalBookings() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveLocalBooking(booking: any) {
  try {
    const list = getLocalBookings();
    list.unshift(booking); // إضافته في البداية ليكون الأحدث أولاً
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving locally:', err);
  }
}

// ----------------------------------------------------------------------
// مسارات الـ API للـ Express
// ----------------------------------------------------------------------

// 1. مسار معرفة حالة متغيرات البيئة والاتصال
app.get('/api/status', (req, res) => {
  res.json({
    databaseConfigured: !!supabase,
    databaseType: supabase ? 'Supabase' : 'Local File (data/bookings.json)',
    googleSheetsConfigured: !!(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SPREADSHEET_ID),
    googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || 'غير مهيأ',
    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL || 'غير مهيأ'
  });
});

// 2. مسار جلب قائمة الحجوزات الحالية (لغرض العرض في الواجهة الرسومية التفاعلية)
app.get('/api/bookings', async (req, res) => {
  try {
    let bookings = [];
    if (supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        bookings = data.map(b => ({
          fullName: b.full_name,
          email: b.email,
          phone: b.phone,
          specialty: b.specialty,
          
          paymentMethod: b.payment_method,
          createdAt: b.created_at
        }));
      }
    } else {
      bookings = getLocalBookings();
    }
    res.json({ success: true, bookings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. مسار استقبال وإرسال طلب الحجز
app.post('/api/bookings', async (req, res) => {
  try {
    const { fullName, email, phone, specialty, paymentMethod } = req.body;

    // التحقق من صحة البيانات (Validation)
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'الاسم الكامل مطلوب' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'رقم الهاتف مطلوب' });
    }
    if (!specialty || !specialty.trim()) {
      return res.status(400).json({ success: false, message: 'التخصص مطلوب' });
    }
    
    if (!paymentMethod || !paymentMethod.trim()) {
      return res.status(400).json({ success: false, message: 'وسيلة الدفع مطلوبة' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'صيغة البريد الإلكتروني غير صالحة' });
    }

    const bookingId = uuidv4();
    const bookingData = {
      id: bookingId,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      specialty: specialty.trim(),
      
      paymentMethod: paymentMethod.trim(),
      createdAt: new Date().toISOString()
    };

    // حفظ في قاعدة البيانات (Supabase أو الحفظ المحلي ومحاكاة Prisma)
    let dbSaved = false;
    let dbMessage = '';

    if (supabase) {
      try {
        const { error: dbError } = await supabase
          .from('bookings')
          .insert([
            {
              full_name: bookingData.fullName,
              email: bookingData.email,
              phone: bookingData.phone,
              specialty: bookingData.specialty,
              
              payment_method: bookingData.paymentMethod,
              created_at: bookingData.createdAt
            }
          ]);
        if (dbError) throw dbError;
        dbSaved = true;
        dbMessage = 'تم الحفظ بنجاح في Supabase';
      } catch (err: any) {
        console.error('Supabase save error:', err);
        dbMessage = `عطل في Supabase: ${err.message}`;
      }
    }

    // نحفظ محلياً دائماً أو كبديل لضمان استمرارية تجربة المستخدم وتحديث القائمة فورياً
    saveLocalBooking(bookingData);
    if (!dbSaved) {
      dbSaved = true;
      dbMessage = supabase 
        ? `فشل Supabase (${dbMessage}). تم الحفظ احتياطياً في الملف المحلي (data/bookings.json)`
        : 'تم الحفظ بنجاح في قاعدة البيانات المحلية (Local JSON File)';
    }

    // إرسال البيانات فوراً لـ Google Sheet إذا كانت مهيأة
    let sheetSaved = false;
    let sheetMessage = '';

    const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
    const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
    const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

    if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SPREADSHEET_ID) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_CLIENT_EMAIL,
          private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      let attempts = 0;
      const maxRetries = 3;
      
      while (attempts < maxRetries && !sheetSaved) {
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: GOOGLE_SPREADSHEET_ID,
            range: 'Sheet1!A:H', // Extended to H for ID
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
          sheetMessage = 'تم الإرسال والإضافة بنجاح لـ Google Sheet';
        } catch (err: any) {
          attempts++;
          console.warn(`Google Sheets append attempt ${attempts} failed:`, err.message);
          if (attempts >= maxRetries) {
            console.error('Max retries reached for Google Sheets append.');
            sheetMessage = `فشل الـ Append بعد ${maxRetries} محاولات: ${err.message}. يرجى المراجعة اليدوية (ID: ${bookingData.id})`;
            // In a real app, we might flag this in the database for manual follow-up
          } else {
            // Wait for 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    } else {
      sheetMessage = 'لم يتم الإرسال (متغيرات Sheet غير مكتملة في .env)';
    }

    // إرسال بريد إلكتروني تأكيدي (Resend)
    let emailSent = false;
    let emailMessage = '';
    
    if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `الأكاديمية الدولية <${process.env.SENDER_EMAIL}>`,
          to: bookingData.email,
          subject: 'تأكيد حجز الدورة التدريبية',
          html: `
            <div dir="rtl" style="font-family: sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #4f46e5;">مرحباً ${bookingData.fullName}،</h2>
              <p>تم استلام طلب حجزك بنجاح. نحن سعداء بانضمامك لنا!</p>
              
              <h3 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">تفاصيل الحجز:</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>رقم الحجز:</strong> ${bookingData.id}</li>
                <li><strong>التخصص:</strong> ${bookingData.specialty}</li>
                <li><strong>رقم الهاتف:</strong> <span dir="ltr">${bookingData.phone}</span></li>
                <li><strong>طريقة الدفع:</strong> ${bookingData.paymentMethod}</li>
              </ul>
              
              <p style="margin-top: 24px; padding: 12px; background-color: #f3f4f6; border-radius: 8px;">
                سيقوم فريقنا بالتواصل معك قريباً لتأكيد باقي الخطوات.
              </p>
            </div>
          `,
        });
        emailSent = true;
        emailMessage = 'تم إرسال بريد التأكيد';
      } catch (emailErr: any) {
        console.error('Error sending email:', emailErr);
        emailMessage = `فشل إرسال البريد: ${emailErr.message}`;
      }
    } else {
      emailMessage = 'متغيرات Resend غير مهيأة';
    }

    res.status(201).json({
      success: true,
      message: 'تم استقبال الحجز ومعالجته!',
      data: bookingData,
      integrations: {
        database: dbMessage,
        googleSheets: sheetMessage,
        email: emailMessage,
        canTrySheetsOfflineMock: !sheetSaved
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل معالجة الطلب', error: error.message });
  }
});

// ----------------------------------------------------------------------
// دمج خادم التطوير لـ Vite وموقع الويب الرسومي
// ----------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port http://0.0.0.0:${PORT}`);
  });
}

startServer();
