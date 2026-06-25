const express = require('express');
const axios   = require('axios');
const app     = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔑 מפתח Google — הכנס כאן את המפתח האמיתי שלך
// ============================================================
const GOOGLE_MAPS_API_KEY = 'AIzaSyBhaz-PnSyoosRHxf_4hFXK0-zoj5nnIB4';

// ============================================================
// 📝 MESSAGES — כל הטקסטים במקום אחד
// ============================================================
const MSG = {
    WELCOME:
        'ברוכים הבאים למרכז הניווט, הטיולים והמידע הכשר. ' +
        'הקש: לניווט ברכב 1, באוטובוס 2, ברגל 3. ' +
        'לזיהוי מיקומך 4. חנויות בדץ 5. מסלולי שטח 6. אטרקציות 7. קמפינג ולינה 9.',

    MAIN_MENU_INVALID:
        'לא הובן. הקש: ניווט 1-3, מיקום 4, חנויות 5, שטח 6, אטרקציות 7, לינה 9.',

    CHOOSE_ORIGIN:    'לקביעת נקודת המוצא: לכתובת מדויקת עיר ורחוב הקש 1, לתיאור חופשי הקש 2.',
    ORIGIN_EXACT:     'אנא אמרו או הקלידו את שם העיר והרחוב.',
    ORIGIN_FREE:      'אנא תארו באריכות את המקום בו אתם עומדים.',
    ORIGIN_CONFIRMED: 'נקודת המוצא אושרה. כעת לקביעת היעד: לכתובת מדויקת הקש 1, לתיאור חופשי הקש 2.',
    ORIGIN_FIX:       'בסדר, נחזור. הקש 1 לכתובת מדויקת, 2 לתיאור חופשי.',

    DEST_EXACT:       'אנא אמרו את עיר ויעד הנסיעה.',
    DEST_FREE:        'אנא תארו במילים את אזור היעד.',
    DEST_CONFIRMED:   'היעד אושר. מחשב מסלול ומייד מתחילים בהנחיות הניווט.',
    DEST_FIX:         'בסדר, נחזור. הקש 1 לכתובת יעד, 2 לתיאור חופשי.',

    GEO_TIMEOUT:      'השירות אינו זמין כרגע, אנא נסו שנית.',
    GEO_NOT_FOUND:    'לא נמצאו תוצאות באזור. ננסה להגדיר מיקום אחר.',

    NAV_HELP:         'הקש 1 להוראה הבאה, 2 לחזרה על הפקודה, 3 לתיאור שטח, 9 לחישוב מחדש.',
    NAV_NEXT:         'מתקדמים להוראה הבאה במסלול.',
    NAV_LOST:         'הלכתם לאיבוד? תארו במלל חופשי מה אתם רואים סביבכם ונחשב מסלול מחדש.',
    TRAIL_ARRIVED:    'הגענו לפתח המסלול, הניווט מסתיים כאן. תיהנו! לחישוב מסלול חדש הקש 9.',

    FREE_LOC_ASK:     'אנא תארו במילים מה אתם רואים סביבכם כעת.',
    FREE_LOC_RETRY:   'לא הצלחנו לזהות את המיקום. נסו לתאר שוב.',
    FREE_LOC_OPTIONS: 'לניווט מכאן הקש 1, לחזרה לתפריט הקש 0.',

    STORES_MENU:
        'חנויות ועסקים בכשרות בדץ מהדרין. הקש: 1 ביגוד, 2 מאפיות, 3 קיוסקים, ' +
        '4 דלק, 5 פארם, 6 ספרי קודש, 7 כספומטים, 8 מסעדות בדץ, 9 סופרמרקט.',
    STORES_INVALID:
        'הקש: 1 ביגוד, 2 מאפיות, 3 קיוסקים, 4 דלק, 5 פארם, ' +
        '6 ספרי קודש, 7 כספומטים, 8 מסעדות, 9 סופרמרקט.',
    STORE_NAV:        'מגדירים ניווט לחנות. הקש 1 לכתובת מוצא, 2 לתיאור חופשי.',
    STORE_NEXT:       'מחפש תוצאה נוספת. אנא המתינו.',

    TRAIL_MENU:       "מסלולי שטח וטיולים מסוננים. לג'יפים הקש 1, לאופניים 2, למסלול רגלי 3.",
    TRAIL_INVALID:    "לג'יפים הקש 1, לאופניים 2, למסלול רגלי 3.",
    TRAIL_SAY_NAME:   'אנא אמרו את שם המסלול.',
    TRAIL_FIX:        'בסדר, נחזור. אנא אמרו שוב את שם המסלול.',

    ATTR_MENU:
        'אטרקציות ובילויים שומרי שבת בהפרדה. ' +
        'לרייזרים ושטח הקש 1, לחאנים ומאהלים 2, לבתי קפה בדץ 3, לפארקים ותצפיות 4.',
    ATTR_INVALID:     'לרייזרים 1, חאנים 2, בתי קפה בדץ 3, פארקים 4.',
    ATTR_NAV:         'מגדירים ניווט. הקש 1 לכתובת מוצא, 2 לתיאור חופשי.',

    LODGING_MENU:     'מתחמי לינה מוצנעים למשפחות. לקמפינג ואוהלים הקש 1, לכפרי נופש 2, לאכסניות וחאנים 3.',
    LODGING_INVALID:  'לקמפינג 1, כפרי נופש 2, אכסניות 3.',
    LODGING_NAV:      'מגדירים ניווט למתחם הלינה. הקש 1 לכתובת מוצא, 2 לתיאור חופשי.',
    LODGING_NONE:     'לא נמצאו מתחמי לינה נוספים בסביבה. חוזרים לתפריט הקודם.',

    ERR_INTERNAL:     'שגיאה פנימית. אנא התקשרו שוב.',
};

// ============================================================
// תיאורי שטח אקראיים — שלוחה 3 בניווט
// ============================================================
const FIELD_DESC = [
    'חפשו מבנה בגובה 4-5 קומות, חזית אבן מסודרת וכניסה רחבה.',
    'באזור זה יש כמות חניות גדולה על המדרכה, וסמוך אליה חנות נוחות או מאפייה.',
    'חפשו מבנה מסחרי בן 2 קומות המכיל מספר חנויות ברצף (ביגוד או ספרי קודש).',
    'הביטו סביב וחפשו שלט רחוב גדול או צומת עם תחנת אוטובוס קרובה.',
];

// ============================================================
// axios עם timeout — בלי זה השרת יכול לקפוא לנצח
// ============================================================
const httpClient = axios.create({ timeout: 5000 });

// ============================================================
// סינון כשרות + שבת + צניעות — לא שונה מהגרסה הקודמת
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
        nameAndDetails.includes('dorm')   ||
        nameAndDetails.includes('מעורב')
    ) return false;
    const isFoodPlace =
        place.types?.includes('restaurant') ||
        place.types?.includes('cafe')       ||
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
    if (!textInput || textInput.trim().length < 2)
        return { success: false, reason: 'SHORT_INPUT' };
    try {
        const r = await httpClient.get(
            'https://maps.googleapis.com/maps/api/geocode/json',
            { params: { address: textInput.trim(), language: 'he', region: 'il', key: GOOGLE_MAPS_API_KEY } }
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
// Google Places — חיפוש עסקים / לינה כשרים בסביבה
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

// ============================================================
// עזר: תגובה אחידה + הודעת שגיאה גיאוקודינג
// ============================================================
function reply(res, text, nextStep, extra = '') {
    return res.send(`read=t-${text}&target=ivr?step=${nextStep}${extra}`);
}
function geoError(reason) {
    return reason === 'TIMEOUT' ? MSG.GEO_TIMEOUT : MSG.GEO_NOT_FOUND;
}

// ============================================================
// IVR ROUTER
// ============================================================
app.all('/ivr', async (req, res) => {
    const input  = (req.query.ApiDigits  || req.body.ApiDigits  || '').trim();
    const step   = (req.query.step       || req.body.step       || 'INITIAL_START').trim();
    const speech = (req.query.speechText || req.body.speechText || '').trim();

    // ── פתיחה ──────────────────────────────────────────────────
    if (step === 'INITIAL_START')
        return reply(res, MSG.WELCOME, 'MAIN_MENU');

    // ── תפריט ראשי ─────────────────────────────────────────────
    if (step === 'MAIN_MENU') {
        if (['1','2','3'].includes(input)) return reply(res, MSG.CHOOSE_ORIGIN, 'CHOOSE_ORIGIN_METHOD');
        if (input === '4') return reply(res, MSG.FREE_LOC_ASK,  'PROCESSING_FREE_LOCATION');
        if (input === '5') return reply(res, MSG.STORES_MENU,   'STORE_CATEGORY');
        if (input === '6') return reply(res, MSG.TRAIL_MENU,    'TRAIL_TYPE');
        if (input === '7') return reply(res, MSG.ATTR_MENU,     'ATTRACTION_CATEGORY');
        if (input === '9') return reply(res, MSG.LODGING_MENU,  'LODGING_CATEGORY');
        return reply(res, MSG.MAIN_MENU_INVALID, 'MAIN_MENU');
    }

    // ── הגדרת מוצא ─────────────────────────────────────────────
    if (step === 'CHOOSE_ORIGIN_METHOD')
        return reply(res, input === '1' ? MSG.ORIGIN_EXACT : MSG.ORIGIN_FREE, 'PROCESSING_ORIGIN_INPUT');

    if (step === 'PROCESSING_ORIGIN_INPUT') {
        const r = await parseAddressWithGoogle(speech || input);
        if (r.success)
            return reply(res, `זיהיתי את נקודת המוצא: ${r.formattedAddress}. לאישור הקש 1, לתיקון הקש 2.`, 'CONFIRM_ORIGIN');
        return reply(res, geoError(r.reason), 'CHOOSE_ORIGIN_METHOD');
    }

    if (step === 'CONFIRM_ORIGIN') {
        if (input === '1') return reply(res, MSG.ORIGIN_CONFIRMED, 'CHOOSE_DESTINATION_METHOD');
        return reply(res, MSG.ORIGIN_FIX, 'CHOOSE_ORIGIN_METHOD'); // 2 = חזרה שלב אחורה
    }

    // ── הגדרת יעד ──────────────────────────────────────────────
    if (step === 'CHOOSE_DESTINATION_METHOD')
        return reply(res, input === '1' ? MSG.DEST_EXACT : MSG.DEST_FREE, 'PROCESSING_DESTINATION_INPUT');

    if (step === 'PROCESSING_DESTINATION_INPUT') {
        const r = await parseAddressWithGoogle(speech || input);
        if (r.success)
            return reply(res, `זיהיתי את היעד: ${r.formattedAddress}. לאישור הקש 1, לתיקון הקש 2.`, 'CONFIRM_DESTINATION');
        return reply(res, geoError(r.reason), 'CHOOSE_DESTINATION_METHOD');
    }

    if (step === 'CONFIRM_DESTINATION') {
        if (input === '1') return reply(res, MSG.DEST_CONFIRMED, 'NAVIGATING');
        return reply(res, MSG.DEST_FIX, 'CHOOSE_DESTINATION_METHOD'); // 2 = חזרה שלב אחורה
    }

    // ── ניווט פעיל ─────────────────────────────────────────────
    if (step === 'NAVIGATING') {
        const inst = 'פנו ימינה ברחוב חזון איש והמשיכו ישר 200 מטרים.';
        if (input === '1') return reply(res, MSG.NAV_NEXT, 'NAVIGATING');
        if (input === '2') return reply(res, `חזרה: ${inst}`, 'NAVIGATING');
        if (input === '3') return reply(res, `תיאור שטח: ${FIELD_DESC[Math.floor(Math.random() * FIELD_DESC.length)]}`, 'NAVIGATING');
        if (input === '9') return reply(res, MSG.NAV_LOST, 'PROCESSING_FREE_LOCATION');
        return reply(res, MSG.NAV_HELP, 'NAVIGATING');
    }

    // ── זיהוי מיקום חופשי (שלוחה 4 + איבוד בניווט) ────────────
    if (step === 'PROCESSING_FREE_LOCATION') {
        const r = await parseAddressWithGoogle(speech || input);
        if (r.success)
            return reply(res, `זיהינו את מיקומכם: ${r.formattedAddress}. ${MSG.FREE_LOC_OPTIONS}`, 'FREE_LOCATION_RESULT');
        return reply(res, MSG.FREE_LOC_RETRY, 'PROCESSING_FREE_LOCATION');
    }

    if (step === 'FREE_LOCATION_RESULT') {
        if (input === '1') return reply(res, MSG.CHOOSE_ORIGIN, 'CHOOSE_ORIGIN_METHOD');
        return reply(res, MSG.WELCOME, 'MAIN_MENU');
    }

    // ── שלוחה 6 — מסלולי שטח ──────────────────────────────────
    if (step === 'TRAIL_TYPE') {
        if (['1','2','3'].includes(input)) return reply(res, MSG.TRAIL_SAY_NAME, 'HIKING_INPUT');
        return reply(res, MSG.TRAIL_INVALID, 'TRAIL_TYPE');
    }

    if (step === 'HIKING_INPUT') {
        const r = await parseAddressWithGoogle(speech || input);
        if (r.success)
            return reply(res, `זיהיתי את המסלול: ${r.formattedAddress}. לאישור הקש 1, לתיקון הקש 2.`, 'CONFIRM_TRAIL');
        return reply(res, geoError(r.reason), 'TRAIL_TYPE');
    }

    if (step === 'CONFIRM_TRAIL') {
        if (input === '1') return reply(res, MSG.DEST_CONFIRMED, 'NAVIGATING_TRAIL');
        return reply(res, MSG.TRAIL_FIX, 'HIKING_INPUT'); // 2 = חזרה שלב אחורה
    }

    // ניווט מסלול — מסתיים בפתח המסלול בלבד
    if (step === 'NAVIGATING_TRAIL') {
        const inst = 'המשיכו ישר לאורך השביל המסומן, 300 מטרים עד לפתח המסלול.';
        if (input === '1') return reply(res, MSG.TRAIL_ARRIVED, 'MAIN_MENU');
        if (input === '2') return reply(res, `חזרה: ${inst}`, 'NAVIGATING_TRAIL');
        if (input === '3') return reply(res, `תיאור שטח: ${FIELD_DESC[Math.floor(Math.random() * FIELD_DESC.length)]}`, 'NAVIGATING_TRAIL');
        if (input === '9') return reply(res, MSG.TRAIL_ARRIVED, 'MAIN_MENU');
        return reply(res, MSG.NAV_HELP, 'NAVIGATING_TRAIL');
    }

    // ── שלוחה 5 — חנויות בד"ץ ─────────────────────────────────
    if (step === 'STORE_CATEGORY') {
        const cats = { '1':'ביגוד','2':'מאפיות','3':'קיוסקים','4':'דלק','5':'פארם','6':'ספרי קודש','7':'כספומטים','8':'מסעדות','9':'סופרמרקט' };
        if (cats[input]) return reply(res, `מחפש ${cats[input]} כשר בד״ץ בסביבתכם. אנא המתינו.`, 'STORE_RESULT');
        return reply(res, MSG.STORES_INVALID, 'STORE_CATEGORY');
    }

    if (step === 'STORE_RESULT') {
        if (input === '1') return reply(res, MSG.STORE_NAV,  'CHOOSE_ORIGIN_METHOD');
        if (input === '2') return reply(res, MSG.STORE_NEXT, 'STORE_RESULT');
        return reply(res, MSG.STORES_MENU, 'STORE_CATEGORY');
    }

    // ── שלוחה 7 — אטרקציות ────────────────────────────────────
    if (step === 'ATTRACTION_CATEGORY') {
        const attrs = { '1':'רייזרים ושטח','2':'חאנים ומאהלים','3':'בתי קפה בדץ','4':'פארקים ותצפיות' };
        if (attrs[input]) return reply(res, `מחפש ${attrs[input]} שומר שבת בסביבתכם. אנא המתינו.`, 'ATTRACTION_RESULT');
        return reply(res, MSG.ATTR_INVALID, 'ATTRACTION_CATEGORY');
    }

    if (step === 'ATTRACTION_RESULT') {
        if (input === '1') return reply(res, MSG.ATTR_NAV, 'CHOOSE_ORIGIN_METHOD');
        return reply(res, MSG.ATTR_MENU, 'ATTRACTION_CATEGORY');
    }

    // ── שלוחה 9 — קמפינג ולינה — קריאת תוצאות ברצף ───────────
    if (step === 'LODGING_CATEGORY') {
        const types = { '1':'קמפינג ואוהלים','2':'כפרי נופש','3':'אכסניות וחאנים' };
        if (types[input]) return reply(res, `סורק ${types[input]} מוצנעים בסביבתכם. אנא המתינו.`, 'LODGING_RESULT');
        return reply(res, MSG.LODGING_INVALID, 'LODGING_CATEGORY');
    }

    if (step === 'LODGING_RESULT') {
        // resultIndex עוקב אחרי מיקום בתוך רשימת התוצאות
        const idx = parseInt(req.query.resultIndex || req.body.resultIndex || '0', 10);

        // בפרודקשן: החלף את SAMPLE_RESULTS בתוצאות אמיתיות מ-searchNearbyKosher
        const SAMPLE_RESULTS = [
            'חניון הלילה נחל ערוגות — 5 ק״מ מכם',
            'קמפינג ים המלח המשפחתי — 12 ק״מ מכם',
            'כפר נופש עמק השרון — 18 ק״מ מכם',
            'אכסניה בית שמש המשפחתית — 22 ק״מ מכם',
            'חאן מצפה יריחו — 30 ק״מ מכם',
        ];

        if (input === '1')
            return reply(res, MSG.LODGING_NAV, 'CHOOSE_ORIGIN_METHOD');

        if (input === '2') {
            const nextIdx = idx + 1;
            if (nextIdx < SAMPLE_RESULTS.length) {
                return res.send(
                    `read=t-מצאתי: ${SAMPLE_RESULTS[nextIdx]}. לניווט לכאן הקש 1, לתוצאה הבאה הקש 2, לחזרה הקש 0.` +
                    `&target=ivr?step=LODGING_RESULT&resultIndex=${nextIdx}`
                );
            }
            return reply(res, MSG.LODGING_NONE, 'LODGING_CATEGORY');
        }

        // 0 / אחר — חזרה לתפריט
        return reply(res, MSG.LODGING_MENU, 'LODGING_CATEGORY');
    }

    // ── שלב לא מזוהה — מניעת קריסה ───────────────────────────
    return reply(res, MSG.ERR_INTERNAL, 'INITIAL_START');
});

// ============================================================
app.get('/health', (req, res) => res.send('השרת חי ובועט!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('=========================================');
    console.log(`  ✅  השרת רץ על פורט ${PORT}`);
    console.log(`  🌐  http://localhost:${PORT}/ivr`);
    console.log(`  ❤️   http://localhost:${PORT}/health`);
    console.log('=========================================');
});
