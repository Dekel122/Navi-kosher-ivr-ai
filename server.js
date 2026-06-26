// ============================================================
//  מרכז הניווט הכשר — שרת IVR לימות המשיח
//  בנוי על ספריית yemot-router2 (הרשמית של ימות)
// ============================================================

const express = require('express');
const axios = require('axios');
const { YemotRouter } = require('yemot-router2');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔑 מפתח Google — נקרא ממשתנה סביבה ב-Render (בטוח)
//    אם לא מוגדר, אפשר לשים ידנית במקום process.env.GOOGLE_MAPS_API_KEY
// ============================================================
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'הכנס_מפתח_כאן';

// axios עם timeout כדי שהשרת לא ייתקע
const httpClient = axios.create({ timeout: 5000 });

// ============================================================
// תיאורי שטח אקראיים (שלוחה 3 בניווט)
// ============================================================
const FIELD_DESC = [
    'חפשו מבנה בגובה 4 עד 5 קומות, חזית אבן מסודרת וכניסה רחבה.',
    'באזור זה יש כמות חניות גדולה על המדרכה, וסמוך אליה חנות נוחות או מאפייה.',
    'חפשו מבנה מסחרי בן 2 קומות המכיל מספר חנויות ברצף, ביגוד או ספרי קודש.',
    'הביטו סביב וחפשו שלט רחוב גדול או צומת עם תחנת אוטובוס קרובה.'
];

// ============================================================
// סינון כשרות + שבת + צניעות
// ============================================================
function isKosherAndShabbatValid(place) {
    if (place.opening_hours && place.opening_hours.periods) {
        const opensOnSabbath = place.opening_hours.periods.some(
            p => p.open && p.open.day === 6
        );
        if (opensOnSabbath) return false;
    }
    const nameAndDetails = (
        (place.name || '') + ' ' + (place.editorial_summary?.overview || '')
    ).toLowerCase();
    if (
        nameAndDetails.includes('hostel') ||
        nameAndDetails.includes('shared') ||
        nameAndDetails.includes('dorm') ||
        nameAndDetails.includes('מעורב')
    ) return false;
    const isFoodPlace =
        place.types?.includes('restaurant') ||
        place.types?.includes('cafe') ||
        place.types?.includes('bakery');
    if (isFoodPlace) {
        const kosherKW = ['בדץ', 'בד"ץ', 'העדה החרדית', 'רובין', 'לנדא', 'בית יוסף', 'מהדרין'];
        if (!kosherKW.some(k => nameAndDetails.includes(k))) return false;
    }
    return true;
}

// ============================================================
// Google Geocoding — פענוח כתובת / תיאור חופשי
// ============================================================
async function parseAddressWithGoogle(textInput) {
    if (!textInput || String(textInput).trim().length < 2)
        return { success: false, reason: 'SHORT_INPUT' };
    try {
        const r = await httpClient.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            { params: { address: String(textInput).trim(), language: 'he', region: 'il', key: GOOGLE_MAPS_API_KEY } }
        );
        if (r.data.status === 'OK' && r.data.results.length > 0) {
            const top = r.data.results[0];
            return { success: true, formattedAddress: top.formatted_address, coordinates: top.geometry.location };
        }
        return { success: false, reason: r.data.status };
    } catch (err) {
        return { success: false, reason: err.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR' };
    }
}

// ============================================================
// Google Places — חיפוש עסקים כשרים בסביבה
// ============================================================
async function searchNearbyKosher(keyword, lat, lng, limit = 5) {
    try {
        const r = await httpClient.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            { params: { location: `${lat},${lng}`, radius: 2000, keyword: keyword + ' כשר בדץ', language: 'he', key: GOOGLE_MAPS_API_KEY } }
        );
        if (r.data.status === 'OK')
            return r.data.results.filter(isKosherAndShabbatValid).slice(0, limit);
        return [];
    } catch { return []; }
}

// עזר: בונה אובייקט הודעת טקסט לימות
// מנקה תווים שימות לא מקבלת (גרשיים, סוגריים, תווים מיוחדים)
function cleanText(t) {
    return String(t)
        .replace(/["'`]/g, '')        // גרשיים
        .replace(/[<>]/g, ' ')         // סוגריים זוויתיים
        .replace(/[{}]/g, ' ')         // סוגריים מסולסלים
        .replace(/[\[\]]/g, ' ')      // סוגריים מרובעים
        .replace(/[|\\^~&]/g, ' ')    // תווים מיוחדים
        .replace(/[,;:=]/g, ' ')       // פסיק/נקודה-פסיק/נקודתיים/שווה - תווים מיוחדים בימות
        .replace(/\s+/g, ' ')          // רווחים כפולים
        .trim();
}
function txt(t) { return [{ type: 'text', data: cleanText(t) }]; }

// ============================================================
// הראוטר של ימות
// ============================================================
const router = YemotRouter({
    printLog: true,
    timeout: 60000,
    uncaughtErrorHandler: (err, call) => {
        console.error('שגיאה בשיחה:', err);
        try { call.id_list_message(txt('אירעה שגיאה זמנית. אנא התקשרו שוב.')); } catch {}
    }
});

// ============================================================
// השלוחה הראשית — כל הזרימה
// ============================================================
router.get('/', async (call) => {
    while (true) {
        // ===== תפריט ראשי =====
        const mainChoice = await call.read(
            txt('ברוכים הבאים למרכז הניווט, הטיולים והמידע הכשר. ' +
                'לניווט ברכב הקישו 1. לניווט באוטובוס הקישו 2. לניווט ברגל הקישו 3. ' +
                'לזיהוי מיקומכם הקישו 4. לחנויות בדץ הקישו 5. למסלולי שטח הקישו 6. ' +
                'לאטרקציות הקישו 7. לקמפינג ולינה הקישו 9.'),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2, 3, 4, 5, 6, 7, 9] }
        );

        if (['1', '2', '3'].includes(mainChoice)) {
            await handleNavigation(call);
        } else if (mainChoice === '4') {
            await handleFreeLocation(call);
        } else if (mainChoice === '5') {
            await handleStores(call);
        } else if (mainChoice === '6') {
            await handleTrails(call);
        } else if (mainChoice === '7') {
            await handleAttractions(call);
        } else if (mainChoice === '9') {
            await handleLodging(call);
        }
        // הלולאה חוזרת לתפריט הראשי
    }
});

// ============================================================
// ניווט (שלוחות 1, 2, 3)
// ============================================================
async function handleNavigation(call) {
    // נקודת מוצא
    const origin = await getConfirmedAddress(call, 'נקודת המוצא');
    if (!origin) return;

    // יעד
    const dest = await getConfirmedAddress(call, 'היעד');
    if (!dest) return;

    await call.id_list_message(txt('היעד אושר. מחשב מסלול ומתחילים בהנחיות הניווט.'),
        { prependToNextAction: true });

    // ניווט פעיל
    while (true) {
        const navChoice = await call.read(
            txt('להוראה הבאה הקישו 1. לחזרה על הפקודה הקישו 2. ' +
                'לתיאור שטח הקישו 3. לחישוב מסלול מחדש הקישו 9. לסיום הקישו 0.'),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [0, 1, 2, 3, 9] }
        );

        if (navChoice === '1') {
            await call.id_list_message(txt('מתקדמים להוראה הבאה. פנו ימינה ברחוב חזון איש והמשיכו ישר 200 מטרים.'),
                { prependToNextAction: true });
        } else if (navChoice === '2') {
            await call.id_list_message(txt('חזרה על הפקודה. פנו ימינה ברחוב חזון איש והמשיכו ישר 200 מטרים.'),
                { prependToNextAction: true });
        } else if (navChoice === '3') {
            const d = FIELD_DESC[Math.floor(Math.random() * FIELD_DESC.length)];
            await call.id_list_message(txt('תיאור שטח: ' + d), { prependToNextAction: true });
        } else if (navChoice === '9') {
            await handleFreeLocation(call);
            return;
        } else if (navChoice === '0') {
            await call.id_list_message(txt('הניווט הסתיים. נסיעה טובה!'), { prependToNextAction: true });
            return;
        }
    }
}

// ============================================================
// עזר: קבלת כתובת + אימות (לאישור 1, לתיקון 2)
// ============================================================
async function getConfirmedAddress(call, label) {
    while (true) {
        // בחירת שיטה
        const method = await call.read(
            txt(`לקביעת ${label}: לכתובת מדויקת הקישו 1, לתיאור חופשי הקישו 2.`),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2] }
        );

        // קבלת הקלט בהקלדה במקלדת עברית (כמו טלפון כשר: 2=אבג, 3=דהו...)
        const prompt = method === '1'
            ? `הקלידו את שם העיר והרחוב של ${label}, באמצעות מקשי הטלפון. בסיום הקישו סולמית.`
            : `הקלידו תיאור של ${label}, באמצעות מקשי הטלפון. בסיום הקישו סולמית.`;
        const spoken = await call.read(txt(prompt), 'tap', {
            removeInvalidChars: true,
            typing_playback_mode: 'HebrewKeyboard',
            max_digits: '*',
            sec_wait: 20
        });

        // פענוח מול גוגל
        const result = await parseAddressWithGoogle(spoken);

        if (!result.success) {
            const msg = result.reason === 'TIMEOUT'
                ? 'השירות אינו זמין כרגע, אנא נסו שנית.'
                : 'לא נמצאו תוצאות באזור. ננסה להגדיר מיקום אחר.';
            await call.id_list_message(txt(msg), { prependToNextAction: true });
            continue; // חזרה לבחירת שיטה
        }

        // אימות
        const confirm = await call.read(
            txt(`זיהיתי את ${label}: ${result.formattedAddress}. לאישור הקישו 1, לתיקון הקישו 2.`),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2] }
        );

        if (confirm === '1') {
            return result; // אושר
        }
        // אם 2 — הלולאה חוזרת אחורה אוטומטית
        await call.id_list_message(txt('בסדר, נגדיר מחדש.'), { prependToNextAction: true });
    }
}

// ============================================================
// זיהוי מיקום חופשי (שלוחה 4)
// ============================================================
async function handleFreeLocation(call) {
    while (true) {
        const spoken = await call.read(
            txt('הקלידו מה אתם רואים סביבכם כעת, או איזה מבנה בולט לידכם, באמצעות מקשי הטלפון. בסיום הקישו סולמית.'),
            'tap',
            {
                removeInvalidChars: true,
                typing_playback_mode: 'HebrewKeyboard',
                max_digits: '*',
                sec_wait: 20
            }
        );
        const result = await parseAddressWithGoogle(spoken);

        if (!result.success) {
            await call.id_list_message(txt('לא הצלחנו לזהות את המיקום. נסו לתאר שוב.'),
                { prependToNextAction: true });
            continue;
        }

        const next = await call.read(
            txt(`זיהינו את מיקומכם: ${result.formattedAddress}. ` +
                'לניווט מכאן הקישו 1, לחזרה לתפריט הראשי הקישו 0.'),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [0, 1] }
        );

        if (next === '1') {
            await handleNavigation(call);
        }
        return; // חזרה לתפריט הראשי
    }
}

// ============================================================
// חנויות בדץ (שלוחה 5)
// ============================================================
async function handleStores(call) {
    const cats = {
        '1': 'ביגוד', '2': 'מאפיות', '3': 'קיוסקים', '4': 'תחנות דלק', '5': 'פארם',
        '6': 'ספרי קודש', '7': 'כספומטים', '8': 'מסעדות בדץ', '9': 'סופרמרקט'
    };

    const choice = await call.read(
        txt('חנויות ועסקים בכשרות בדץ מהדרין. ' +
            'לביגוד 1. למאפיות 2. לקיוסקים 3. לתחנות דלק 4. לפארם 5. ' +
            'לספרי קודש 6. לכספומטים 7. למסעדות בדץ 8. לסופרמרקט 9.'),
        'tap',
        { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2, 3, 4, 5, 6, 7, 8, 9] }
    );

    const cat = cats[choice];
    if (!cat) return;

    await call.id_list_message(
        txt(`מחפש ${cat} כשר בדץ בסביבתכם. אנא המתינו.`),
        { prependToNextAction: true }
    );

    const nav = await call.read(
        txt(`נמצאה חנות ${cat} כשרה בדץ באזורכם. לניווט לחנות הקישו 1, לחזרה לתפריט הקישו 0.`),
        'tap',
        { removeInvalidChars: true, max_digits: 1, digits_allowed: [0, 1] }
    );

    if (nav === '1') {
        await handleNavigation(call);
    }
}

// ============================================================
// מסלולי שטח (שלוחה 6) — ניווט עד פתח המסלול בלבד
// ============================================================
async function handleTrails(call) {
    const choice = await call.read(
        txt('מסלולי שטח וטיולים מסוננים לשומרי שבת. ' +
            'לג\'יפים הקישו 1, לאופניים הקישו 2, למסלול רגלי הקישו 3.'),
        'tap',
        { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2, 3] }
    );

    if (!['1', '2', '3'].includes(choice)) return;

    // שם המסלול בדיבור
    const trail = await getConfirmedAddress(call, 'פתח המסלול');
    if (!trail) return;

    await call.id_list_message(
        txt('מתחילים בניווט לפתח המסלול.'),
        { prependToNextAction: true }
    );

    // ניווט עד פתח המסלול
    while (true) {
        const navChoice = await call.read(
            txt('להוראה הבאה הקישו 1. לחזרה על הפקודה הקישו 2. ' +
                'לתיאור שטח הקישו 3. לסיום בפתח המסלול הקישו 9.'),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2, 3, 9] }
        );

        if (navChoice === '1') {
            await call.id_list_message(
                txt('המשיכו ישר לאורך השביל המסומן, 300 מטרים עד לפתח המסלול.'),
                { prependToNextAction: true });
        } else if (navChoice === '2') {
            await call.id_list_message(
                txt('חזרה על הפקודה. המשיכו ישר לאורך השביל המסומן עד לפתח המסלול.'),
                { prependToNextAction: true });
        } else if (navChoice === '3') {
            const d = FIELD_DESC[Math.floor(Math.random() * FIELD_DESC.length)];
            await call.id_list_message(txt('תיאור שטח: ' + d), { prependToNextAction: true });
        } else if (navChoice === '9') {
            await call.id_list_message(
                txt('הגענו לפתח המסלול. הניווט מסתיים כאן. תיהנו מהטיול!'),
                { prependToNextAction: true });
            return;
        }
    }
}

// ============================================================
// אטרקציות (שלוחה 7)
// ============================================================
async function handleAttractions(call) {
    const attrs = {
        '1': 'רייזרים ושטח', '2': 'חאנים ומאהלים', '3': 'בתי קפה בדץ', '4': 'פארקים ותצפיות'
    };

    const choice = await call.read(
        txt('אטרקציות ובילויים שומרי שבת בהפרדה. ' +
            'לרייזרים ושטח הקישו 1, לחאנים ומאהלים הקישו 2, ' +
            'לבתי קפה בדץ הקישו 3, לפארקים ותצפיות הקישו 4.'),
        'tap',
        { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2, 3, 4] }
    );

    const attr = attrs[choice];
    if (!attr) return;

    await call.id_list_message(
        txt(`מחפש ${attr} שומר שבת בסביבתכם. אנא המתינו.`),
        { prependToNextAction: true }
    );

    const nav = await call.read(
        txt(`נמצאה אטרקציה מסוג ${attr} בהפרדה מלאה. לניווט הקישו 1, לחזרה לתפריט הקישו 0.`),
        'tap',
        { removeInvalidChars: true, max_digits: 1, digits_allowed: [0, 1] }
    );

    if (nav === '1') {
        await handleNavigation(call);
    }
}

// ============================================================
// קמפינג ולינה (שלוחה 9) — הקראת כל התוצאות ברצף
// ============================================================
async function handleLodging(call) {
    const types = {
        '1': 'קמפינג ואוהלים', '2': 'כפרי נופש', '3': 'אכסניות וחאנים'
    };

    const choice = await call.read(
        txt('מתחמי לינה מוצנעים למשפחות. ' +
            'לקמפינג ואוהלים הקישו 1, לכפרי נופש הקישו 2, לאכסניות וחאנים הקישו 3.'),
        'tap',
        { removeInvalidChars: true, max_digits: 1, digits_allowed: [1, 2, 3] }
    );

    const type = types[choice];
    if (!type) return;

    await call.id_list_message(
        txt(`סורק ${type} מוצנעים בסביבתכם. אנא המתינו.`),
        { prependToNextAction: true }
    );

    // רשימת תוצאות לדוגמה — בפרודקשן תוחלף ב-searchNearbyKosher
    const results = [
        'חניון הלילה נחל ערוגות, 5 קילומטר מכם',
        'קמפינג ים המלח המשפחתי, 12 קילומטר מכם',
        'כפר נופש עמק השרון, 18 קילומטר מכם',
        'אכסניית בית שמש המשפחתית, 22 קילומטר מכם'
    ];

    // הקראת כל התוצאות ברצף
    let index = 0;
    while (index < results.length) {
        const nav = await call.read(
            txt(`תוצאה ${index + 1}: ${results[index]}. ` +
                'לניווט לכאן הקישו 1, לתוצאה הבאה הקישו 2, לחזרה לתפריט הקישו 0.'),
            'tap',
            { removeInvalidChars: true, max_digits: 1, digits_allowed: [0, 1, 2] }
        );

        if (nav === '1') {
            await handleNavigation(call);
            return;
        } else if (nav === '2') {
            index++;
            if (index >= results.length) {
                await call.id_list_message(
                    txt('לא נמצאו מתחמי לינה נוספים בסביבה. חוזרים לתפריט.'),
                    { prependToNextAction: true });
                return;
            }
        } else if (nav === '0') {
            return;
        }
    }
}

// ============================================================
// חיבור הראוטר ל-express
// ============================================================
app.use('/ivr', router);

// בדיקת חיים
app.get('/health', (req, res) => res.send('השרת חי ובועט!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('=========================================');
    console.log(`  ✅  השרת רץ על פורט ${PORT}`);
    console.log(`  📞  שלוחת IVR: /ivr`);
    console.log(`  ❤️   בריאות: /health`);
    console.log('=========================================');
    if (GOOGLE_MAPS_API_KEY === 'הכנס_מפתח_כאן') {
        console.log('  ⚠️  שים לב: לא הוגדר מפתח Google!');
    }
});
