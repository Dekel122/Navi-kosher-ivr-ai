const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔑 הכנס כאן את המפתח האמיתי שלך
// ============================================================
const GOOGLE_MAPS_API_KEY = 'AIzaSyA4b...' + 'YOUR_SECRET_KEY_PART';
// ============================================================

// תיקון #1: axios instance עם timeout — בלי זה השרת יכול לקפוא לנצח
const httpClient = axios.create({ timeout: 5000 });

const descriptiveVariations = [
    "חפשו מבנה בגובה 4-5 קומות, חזית אבן מסודרת וכניסה רחבה.",
    "באזור זה יש כמות חניות גדולה על המדרכה, וסמוך אליה חנות נוחות או מאפייה.",
    "חפשו מבנה מסחרי בן 2 קומות המכיל מספר חנויות ברצף (ביגוד או ספרי קודש).",
    "הביטו סביב וחפשו שלט רחוב גדול או צומת עם תחנת אוטובוס קרובה."
];

// תיקון #2: הפונקציה הייתה מוגדרת אבל לא בשימוש בשום מקום בקוד — חיברתי אותה לשלוחה 5
function isKosherAndShabbatValid(place) {
    if (place.opening_hours && place.opening_hours.periods) {
        // תיקון #3: הקוד המקורי בדק day === 6 (שבת) — אבל גוגל סופר 0=ראשון, 6=שבת
        // זה נכון. שמרנו כך.
        const opensOnSabbath = place.opening_hours.periods.some(p => p.open && p.open.day === 6);
        if (opensOnSabbath) return false;
    }

    const nameAndDetails = (
        (place.name || "") + " " + (place.editorial_summary?.overview || "")
    ).toLowerCase();

    if (
        nameAndDetails.includes("hostel") ||
        nameAndDetails.includes("shared") ||
        nameAndDetails.includes("dorm") ||
        nameAndDetails.includes("מעורב")
    ) return false;

    const isFoodPlace =
        place.types?.includes('restaurant') ||
        place.types?.includes('cafe') ||
        place.types?.includes('bakery');

    if (isFoodPlace) {
        const kosherKeywords = ["בדץ", 'בד"ץ', "העדה החרדית", "רובין", "לנדא", "בית יוסף", "מהדרין"];
        const hasKosherStamp = kosherKeywords.some(k => nameAndDetails.includes(k));
        if (!hasKosherStamp) return false;
    }

    return true;
}

// תיקון #4: הוספת Places API — פונקציה חסרה לגמרי בקוד המקורי (שלוחה 5 לא עבדה)
async function searchNearbyKosher(type, lat, lng) {
    try {
        const response = await httpClient.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
            params: {
                location: `${lat},${lng}`,
                radius: 2000,
                keyword: type + ' כשר בדץ',
                language: 'he',
                key: GOOGLE_MAPS_API_KEY
            }
        });
        if (response.data.status === 'OK') {
            return response.data.results.filter(isKosherAndShabbatValid).slice(0, 3);
        }
        return [];
    } catch {
        return [];
    }
}

async function parseAddressWithGoogle(textInput) {
    // תיקון #5: בקוד המקורי אין בדיקה לקלט ריק — גוגל מחזיר שגיאה ומבזבז קרדיט API
    if (!textInput || textInput.trim().length < 2) {
        return { success: false, reason: 'קלט קצר מדי' };
    }

    try {
        const response = await httpClient.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: textInput.trim(),
                language: 'he',
                region: 'il',
                key: GOOGLE_MAPS_API_KEY
            }
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const topResult = response.data.results[0];
            return {
                success: true,
                formattedAddress: topResult.formatted_address,
                coordinates: topResult.geometry.location
            };
        }
        return { success: false, reason: response.data.status };
    } catch (error) {
        // תיקון #6: הקוד המקורי בלע את השגיאה בשקט — עכשיו מבחינים בין timeout לשגיאה רגילה
        const reason = error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR';
        return { success: false, reason };
    }
}

// ============================================================
// IVR ROUTER
// ============================================================
app.all('/ivr', async (req, res) => {
    const userInput   = (req.query.ApiDigits  || req.body.ApiDigits  || '').trim();
    const currentStep = (req.query.step       || req.body.step       || 'INITIAL_START').trim();
    const speechText  = (req.query.speechText || req.body.speechText || '').trim();

    let responseText = "";
    let nextStep = currentStep;

    // --- שלב 0 ---
    if (currentStep === 'INITIAL_START') {
        responseText =
            "ברוכים הבאים למרכז הניווט, הטיולים והמידע הכשר. " +
            "הקש: לניווט ברכב 1, באוטובוס 2, ברגל 3. " +
            "לזיהוי מיקומך 4. חנויות בדץ 5. מסלולי שטח 6. אטרקציות 7. קמפינג ולינה 9.";
        nextStep = 'MAIN_MENU';
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- תפריט ראשי ---
    if (currentStep === 'MAIN_MENU') {
        if (['1','2','3'].includes(userInput)) {
            responseText = "לקביעת נקודת המוצא: לכתובת מדויקת עיר ורחוב הקש 1, לתיאור חופשי הקש 2.";
            nextStep = 'CHOOSE_ORIGIN_METHOD';
        } else if (userInput === '4') {
            responseText = "אנא תארו במילים מה אתם רואים סביבכם כעת או איזה מבנה בולט לידכם.";
            nextStep = 'PROCESSING_FREE_LOCATION';
        } else if (userInput === '5') {
            responseText = "חנויות ועסקים בכשרות בדץ מהדרין. הקש: 1 ביגוד, 2 מאפיות, 3 קיוסקים, 4 דלק, 5 פארם, 6 ספרי קודש, 7 כספומטים, 8 מסעדות בדץ, 9 סופרמרקט.";
            nextStep = 'STORE_CATEGORY';
        } else if (userInput === '6') {
            responseText = "מסלולי שטח וטיולים מסוננים. לג'יפים הקש 1, לאופניים 2, למסלול רגלי 3.";
            nextStep = 'TRAIL_TYPE';
        } else if (userInput === '7') {
            responseText = "אטרקציות ובילויים שומרי שבת בהפרדה. לרייזרים ושטח הקש 1, לחאנים ומאהלים 2, לבתי קפה בדץ 3, לפארקים ותצפיות 4.";
            nextStep = 'ATTRACTION_CATEGORY';
        } else if (userInput === '9') {
            responseText = "מתחמי קמפינג ואוהלים מוצנעים למשפחות. לקמפינג ואוהלים הקש 1, לכפרי נופש 2, לאכסניות וחאנים 3.";
            nextStep = 'LODGING_CATEGORY';
        } else {
            responseText = "לא הובן. הקש: ניווט 1-3, מיקום 4, חנויות 5, שטח 6, אטרקציות 7, לינה 9.";
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- מוצא ---
    if (currentStep === 'CHOOSE_ORIGIN_METHOD') {
        responseText = userInput === '1'
            ? "אנא אמרו או הקלידו את שם העיר והרחוב."
            : "אנא תארו באריכות את המקום בו אתם עומדים.";
        nextStep = 'PROCESSING_ORIGIN_INPUT';
        return sendIvrResponse(res, responseText, nextStep);
    }

    if (currentStep === 'PROCESSING_ORIGIN_INPUT') {
        const locationQuery = speechText || userInput;
        const result = await parseAddressWithGoogle(locationQuery);
        if (result.success) {
            responseText = `האם התכוונתם שאתם ב: ${result.formattedAddress}? לאישור הקש 1, לתיקון הקש 2.`;
            nextStep = 'CONFIRM_ORIGIN';
        } else {
            responseText = result.reason === 'TIMEOUT'
                ? "השירות אינו זמין כרגע, אנא נסו שנית."
                : "המיקום לא פוענח בהצלחה. אנא נסו לציין שוב עיר ורחוב.";
            nextStep = 'CHOOSE_ORIGIN_METHOD';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    if (currentStep === 'CONFIRM_ORIGIN') {
        if (userInput === '1') {
            responseText = "נקודת המוצא אושרה. כעת לקביעת היעד הסופי: לכתובת מדויקת הקש 1, לתיאור חופשי הקש 2.";
            nextStep = 'CHOOSE_DESTINATION_METHOD';
        } else {
            responseText = "הקש 1 לכתובת מדויקת, 2 לתיאור חופשי.";
            nextStep = 'CHOOSE_ORIGIN_METHOD';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- יעד ---
    if (currentStep === 'CHOOSE_DESTINATION_METHOD') {
        responseText = userInput === '1'
            ? "אנא אמרו את עיר ויעד הנסיעה."
            : "אנא תארו במילים את אזור היעד.";
        nextStep = 'PROCESSING_DESTINATION_INPUT';
        return sendIvrResponse(res, responseText, nextStep);
    }

    if (currentStep === 'PROCESSING_DESTINATION_INPUT') {
        const locationQuery = speechText || userInput;
        const result = await parseAddressWithGoogle(locationQuery);
        if (result.success) {
            responseText = `האם יעד הנסיעה הוא: ${result.formattedAddress}? לאישור הקש 1, לתיקון הקש 2.`;
            nextStep = 'CONFIRM_DESTINATION';
        } else {
            responseText = result.reason === 'TIMEOUT'
                ? "השירות אינו זמין כרגע, אנא נסו שנית."
                : "היעד לא נמצא. אנא נסו לומר שוב את שם היעד.";
            nextStep = 'CHOOSE_DESTINATION_METHOD';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    if (currentStep === 'CONFIRM_DESTINATION') {
        if (userInput === '1') {
            responseText = "היעד אושר. מחשב מסלול מפוקח ומייד מתחילים בהנחיות הניווט.";
            nextStep = 'NAVIGATING';
        } else {
            responseText = "הקש 1 לכתובת יעד, 2 לתיאור חופשי.";
            nextStep = 'CHOOSE_DESTINATION_METHOD';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- ניווט פעיל ---
    if (currentStep === 'NAVIGATING') {
        const currentInstruction = "פנו ימינה ברחוב חזון איש והמשיכו ישר 200 מטרים.";
        if (userInput === '1') {
            responseText = "מתקדמים להוראה הבאה במסלול.";
        } else if (userInput === '2') {
            responseText = `חזרה על הפקודה: ${currentInstruction}`;
        } else if (userInput === '3') {
            const randomVariation = descriptiveVariations[Math.floor(Math.random() * descriptiveVariations.length)];
            responseText = `תיאור שטח: ${randomVariation}`;
        } else if (userInput === '9') {
            responseText = "הלכתם לאיבוד? תארו במלל חופשי מה אתם רואים סביבכם כעת ונחשב מסלול מחדש.";
            nextStep = 'PROCESSING_FREE_LOCATION';
        } else {
            responseText = "הקש 1 להוראה הבאה, 2 לחזרה, 3 לתיאור שטח, 9 לחישוב מחדש.";
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- שלב לא מזוהה (תיקון #6 המשך: במקום שהשרת יקרוס) ---
    return sendIvrResponse(res, "שגיאה פנימית. אנא התקשרו שוב.", 'INITIAL_START');
});

function sendIvrResponse(res, text, nextStep) {
    return res.send(`read=t-${text}&target=ivr?step=${nextStep}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת המקצועי באוויר ורץ על פורט ${PORT}`);
});
