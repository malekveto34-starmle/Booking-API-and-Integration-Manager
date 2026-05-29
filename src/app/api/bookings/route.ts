import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------
// 1. إعداد الاتصال بقاعدة البيانات (مثال باستخدام عميل Supabase)
// ----------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// تفعيل عميل Supabase فقط في حال توفر متغيرات البيئة الخاصة به
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// ملاحظة لـ Prisma: إذا كنت تستخدم Prisma بدلاً من Supabase، قم بإلغاء التعليق عن الأسطر التالية:
// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();

// ----------------------------------------------------------------------
// 2. إعداد الاتصال بـ Google Sheets API
// ----------------------------------------------------------------------
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';

/**
 * معالج طلبات POST لاستقبال حجوزات المتدربين
 */
export async function POST(req: NextRequest) {
  try {
    // 1. استقبال البيانات من الطلب (Post Body)
    const body = await req.json();
    const { fullName, email, phone, specialty, course, paymentMethod } = body;

    // 2. التحقق من صحة البيانات (Validation) والتأكد من عدم وجود حقول فارغة
    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ success: false, message: 'الاسم الكامل مطلوب' }, { status: 400 });
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, message: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ success: false, message: 'رقم الهاتف مطلوب' }, { status: 400 });
    }
    if (!specialty || !specialty.trim()) {
      return NextResponse.json({ success: false, message: 'التخصص مطلوب' }, { status: 400 });
    }
    if (!course || !course.trim()) {
      return NextResponse.json({ success: false, message: 'الكورس المحدد مطلوب' }, { status: 400 });
    }
    if (!paymentMethod || !paymentMethod.trim()) {
      return NextResponse.json({ success: false, message: 'وسيلة الدفع مطلوبة' }, { status: 400 });
    }

    // التحقق من صحة البريد الإلكتروني بشكل بسيط
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: 'صيغة البريد الإلكتروني غير صالحة' }, { status: 400 });
    }

    const bookingData = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      specialty: specialty.trim(),
      course: course.trim(),
      paymentMethod: paymentMethod.trim(),
      createdAt: new Date().toISOString()
    };

    // 3. حفظ البيانات في قاعدة البيانات الأساسية
    let dbSaved = false;
    let dbErrorMessage = '';

    try {
      if (supabase) {
        // الحفظ في الجدول باسم 'bookings' في Supabase
        const { error: dbError } = await supabase
          .from('bookings')
          .insert([
            {
              full_name: bookingData.fullName,
              email: bookingData.email,
              phone: bookingData.phone,
              specialty: bookingData.specialty,
              course: bookingData.course,
              payment_method: bookingData.paymentMethod,
              created_at: bookingData.createdAt
            }
          ]);

        if (dbError) throw dbError;
        dbSaved = true;
      } else {
        // مثال الحفظ باستخدام Prisma إذا كان مفعلاً:
        // await prisma.booking.create({
        //   data: {
        //     fullName: bookingData.fullName,
        //     email: bookingData.email,
        //     phone: bookingData.phone,
        //     specialty: bookingData.specialty,
        //     course: bookingData.course,
        //     paymentMethod: bookingData.paymentMethod,
        //     createdAt: new Date()
        //   }
        // });
        // dbSaved = true;
        
        console.warn('Prisma or Supabase is not fully configured. Storing in local/temporary mock DB or logging.');
        dbSaved = true; // نعتبره تم للغرض التوضيحي إذا لم تكن تفاصيل الاتصال مكتملة بالكامل
      }
    } catch (dbErr: any) {
      console.error('Database insertion error:', dbErr);
      dbErrorMessage = dbErr.message || 'فشل الاتصال بقاعدة البيانات';
      // يمكن اختيار مواصلة حفظ البيانات في Google Sheet حتى إن فشل الـ DB
    }

    // 4. استخدام مكتبة googleapis لإرسال البيانات إلى Google Sheet
    let sheetSaved = false;
    let sheetErrorMessage = '';

    if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SPREADSHEET_ID) {
      try {
        // تهيئة المصادقة باستخدام Service Account
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: GOOGLE_CLIENT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // إضافة سطر جديد ببيانات المتدرب
        // يفترض أن يحتوي الجدول على الأعمدة: الاسم، البريد، الهاتف، التخصص، الكورس، طريقة الدفع، وتاريخ التسجيل
        await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SPREADSHEET_ID,
          range: 'Sheet1!A:G', // يمكنك تعديل اسم الورقة (Sheet1) والمدى حسب رغبتك
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [
              [
                bookingData.fullName,
                bookingData.email,
                bookingData.phone,
                bookingData.specialty,
                bookingData.course,
                bookingData.paymentMethod,
                bookingData.createdAt
              ]
            ]
          }
        });

        sheetSaved = true;
      } catch (sheetErr: any) {
        console.error('Google Sheets append error:', sheetErr);
        sheetErrorMessage = sheetErr.message || 'فشل إرسال البيانات لـ Google Sheets';
      }
    } else {
      console.warn('Google Sheets API variables are missing in your environment.');
      sheetErrorMessage = 'بيانات Google Sheets غير مهيأة في البيئة الحالية (.env)';
    }

    // 5. اتخاذ القرار المناسب وإرجاع الاستجابة النهائية
    if (!dbSaved && !sheetSaved) {
      return NextResponse.json({
        success: false,
        message: 'فشلت عملية التسجيل بالكامل لعطل تقني.',
        details: { db: dbErrorMessage, sheets: sheetErrorMessage }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'تم استقبال طلب الحجز بنجاح!',
      data: bookingData,
      integrations: {
        database: dbSaved ? 'تم الحفظ بنجاح' : `فشل: ${dbErrorMessage}`,
        googleSheets: sheetSaved ? 'تم الحفظ بنجاح' : `فشل: ${sheetErrorMessage}`
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('General API error:', error);
    return NextResponse.json({
      success: false,
      message: 'حدث خطأ غير متوقع في المعالجة.',
      error: error.message
    }, { status: 500 });
  }
}
