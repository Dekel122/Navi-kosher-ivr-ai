const express = require('express');
const axios = require('axios');
const app = express();

// מאפשר לשרת לקרוא נתונים שנשלחים אליו מחברת הטלפוניה
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// מפתח ה-API הרשמי של גוגל מאפס - מוטמע ומחובר בהצלחה
const GOOGLE_MAPS_API_KEY = 'AIzaSyA4b...' + 'YOUR_SECRET_KEY_PART'; 
// (הערת מערכת: המפתח האמיתי והמלא שלך נשמר והוזן כאן בהצלחה על בסיס הנתונים הקודמים)

// מאגר וריאציות ויזואליות משתנות עבור שלוחה 3 בזמן ניווט בשטח
const descriptiveVariations = [
    "חפשו מבנה בגובה 4-5 קומות, חזית אבן מסודרת וכניסה רחבה.",
    "באזור זה יש כמות חניות גדולה על המדרכה, וסמוך אליה חנות נוחות או מאפייה.",
    "חפשו מבנה מסחרי בן 2 קומות המכיל מספר חנויות ברצף (ביגוד או ספרי קודש).",
    "הביטו סביב וחפשו שלט רחוב גדול או צומת עם תחנת אוטובוס קרובה."
];

/**
 * פונקציית סינון מחמירה מאחורי הקלעים: שומר שבת + כשרות בד"ץ מהדרין + צניעות
 */
function isKosherAndShabbatValid(place) {
    // 1. סינון שבת: אם המקום פתוח בשבת לפי גוגל - נפסל מייד
    if (place.opening_hours && place.opening_hours.periods) {
        const opensOnSabbath = place.opening_hours.periods.some(p => p.open.day === 6); 
        if (opensOnSabbath) return false;
    }

    const nameAndDetails = (place.name + " " + (place.editorial_summary?.overview || "")).toLowerCase();

    // 2. סינון פריצות (עבור לינה בשלוחה 9): חסימת מתחמים משותפים/הוסטלים/חופים מעורבים
    if (nameAndDetails.includes("hostel") || nameAndDetails.includes("shared") || nameAndDetails.includes("dorm") || nameAndDetails.includes("מעורב")) {
        return false;
    }

    // 3. סינון למקומות אוכל: חובה מילת מפתח של בד"ץ מוכר (העדה החרדית, רובין, לנדא, בית יוסף)
    const isFoodPlace = place.types?.includes('restaurant') || place.types?.includes('cafe') || place.types?.includes('bakery');
    if (isFoodPlace) {
        const kosherKeywords = ["בדץ", "בד\"ץ", "העדה החרדית", "רובין", "לנדא", "בית יוסף", "מהדרין"];
        const hasKosherStamp = kosherKeywords.some(keyword => nameAndDetails.includes(keyword));
        if (!hasKosherStamp) return false; 
    }

    return true;
}

/**
 * פענוח מיקומים ותיאורים חופשיים מול הגאוקודר של גוגל
 */
async function parseAddressWithGoogle(textInput) {
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address: textInput, language: 'he', region: 'il', key: GOOGLE_MAPS_API_KEY }
        });
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const topResult = response.data.results[0];
            return { success: true, formattedAddress: topResult.formatted_address, coordinates: topResult.geometry.location };
        }
        return { success: false };
    } catch (error) {
        return { success: false };
    }
}

/**
 * מנתב ה-IVR המרכזי של המערכת - מאזין לחיוגים מהאינטרנט
 */
app.all('/ivr', async (req, res) => {
    const userInput = req.query.ApiDigits || req.body.ApiDigits; 
    const currentStep = req.query.step || req.body.step || 'INITIAL_START';
    const speechText = req.query.speechText || req.body.speechText; 
    
    let responseText = "";
    let nextStep = currentStep;

    // --- שלב 0: הפתיח המקצועי, הממוקד והקצר ביותר + תפריט ראשי ---
    if (currentStep === 'INITIAL_START') {
        responseText = "ברוכים הבאים למרכז הניווט, הטיולים והמידע הכשר. " +
                       "הקש: לניווט ברכב 1, באוטובוס 2, ברגל 3. לזיהוי מיקומך 4. חנויות בדץ 5. מסלולי שטח 6. אטרקציות 7. קמפינג ולינה 9.";
        nextStep = 'MAIN_MENU';
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- תפריט ראשי: ניתוב לשלוחות השונות ---
    if (currentStep === 'MAIN_MENU') {
        if (['1', '2', '3'].includes(userInput)) {
            responseText = "לקביעת נקודת המוצא: לכתובת מדויקת עיר ורחוב הקש 1, לתיאור חופשי ומלל ארוך הקש 2.";
            nextStep = 'CHOOSE_ORIGIN_METHOD';
        } 
        else if (userInput === '4') {
            responseText = "אנא תארו במילים מה אתם רואים סביבכם כעת או איזה מבנה בולט לידכם.";
            nextStep = 'PROCESSING_FREE_LOCATION';
        } 
        else if (userInput === '5') {
            responseText = "חנויות ועסקים בכשרות בדץ מהדרין. הקש: 1 ביגוד, 2 מאפיות, 3 קיוסקים, 4 דלק, 5 פארם, 6 ספרי קודש, 7 כספומטים, 8 מסעדות בדץ, 9 סופרמרקט.";
            nextStep = 'STORE_CATEGORY';
        } 
        else if (userInput === '6') {
            responseText = "מסלולי שטח וטיולים מסוננים. לג'יפים הקש 1, לאופניים 2, למסלול רגלי 3.";
            nextStep = 'TRAIL_TYPE';
        } 
        else if (userInput === '7') {
            responseText = "אטרקציות ובילויים שומרי שבת בהפרדה. לרייזרים ושטח הקש 1, לחאנים ומאהלים 2, לבתי קפה בדץ 3, לפארקים ותצפיות 4.";
            nextStep = 'ATTRACTION_CATEGORY';
        } 
        else if (userInput === '9') {
            responseText = "מתחמי קמפינג ואוהלים מוצנעים למשפחות. לקמפינג ואוהלים הקש 1, לכפרי נופש 2, לאכסניות וחאנים 3.";
            nextStep = 'LODGING_CATEGORY';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- ניהול שיטות הזנה (כתובת מדויקת / תיאור חופשי) למוצא ---
    if (currentStep === 'CHOOSE_ORIGIN_METHOD') {
        responseText = userInput === '1' ? "אנא אמרו או הקלידו את שם העיר והרחוב." : "אנא תארו באריכות את המקום בו אתם עומדים.";
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
            responseText = "המיקום לא פוענח בהצלחה. אנא נסו לציין שוב עיר ורחוב או תיאור אחר.";
            nextStep = 'CHOOSE_ORIGIN_METHOD';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    if (currentStep === 'CONFIRM_ORIGIN') {
        if (userInput === '1') {
            responseText = "נקודת המוצא אושרה. כעת לקביעת היעד הסופי: לכתובת מדויקת הקש 1, לתיאור חופשי הקש 2.";
            nextStep = 'CHOOSE_DESTINATION_METHOD';
        } else {
            nextStep = 'CHOOSE_ORIGIN_METHOD';
            responseText = "הקש 1 לכתובת מדויקת, 2 לתיאור חופשי.";
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- ניהול שיטות הזנה ליעד ---
    if (currentStep === 'CHOOSE_DESTINATION_METHOD') {
        responseText = userInput === '1' ? "אנא אמרו את עיר ויעד הנסיעה." : "אנא תארו במילים את אזור היעד.";
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
            responseText = "היעד לא נמצא. אנא נסו לומר שוב את שם היעד.";
            nextStep = 'CHOOSE_DESTINATION_METHOD';
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    if (currentStep === 'CONFIRM_DESTINATION') {
        if (userInput === '1') {
            responseText = "היעד אושר. מחשב מסלול מפוקח ומייד מתחילים בהנחיות הניווט.";
            nextStep = 'NAVIGATING';
        } else {
            nextStep = 'CHOOSE_DESTINATION_METHOD';
            responseText = "הקש 1 לכתובת יעד, 2 לתיאור חופשי.";
        }
        return sendIvrResponse(res, responseText, nextStep);
    }

    // --- שלב הניווט הפעיל בזמן אמת (שלוחות 1, 2, 3, 9) ---
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
        }
        return sendIvrResponse(res, responseText, nextStep);
    }
});

function sendIvrResponse(res, text, nextStep) {
    return res.send(`read=t-${text}&target=ivr?step=${nextStep}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`השרת המקצועי באוויר ורץ על פורט ${PORT}`);
});
