const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// מאפשר לשרת לקרוא נתונים שנשלחים אליו מחברת הטלפוניה
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// מפתח ה-API הרשמי של גוגל מאפס
const GOOGLE_MAPS_API_KEY = 'AIzaSyA4b...' + 'YOUR_SECRET_KEY_PART'; 

// מאגר וריאציות ויזואליות משתנות עבור שלוחה 3
const descriptiveVariations = [
    "חפשו מבנה בגובה 4-5 קומות, חזית אבן מסודרת וכניסה רחבה.",
    "באזור זה יש כמות חניות גדולה על המדרכה, וסמוך אליה חנות נוחות או מאפייה.",
    "חפשו מבנה מסחרי בן 2 קומות המכיל מספר חנויות ברצף (ביגוד או ספרי קודש).",
    "הביטו סביב וחפשו שלט רחוב גדול או צומת עם תחנת אוטובוס קרובה."
];

// --- נתיב בדיקה שהשרת חי (מומלץ להשאיר) ---
app.get('/health', (req, res) => {
    res.send('השרת חי ובועט!');
});

/**
 * פונקציית סינון מחמירה מאחורי הקלעים: שומר שבת + כשרות בד"ץ מהדרין + צניעות
 */
function isKosherAndShabbatValid(place) {
    if (place.opening_hours && place.opening_hours.periods) {
        const opensOnSabbath = place.opening_hours.periods.some(p => p.open.day === 6); 
        if (opensOnSabbath) return false;
    }
    const nameAndDetails = (place.name + " " + (place.editorial_summary?.overview || "")).toLowerCase();
    if (nameAndDetails.includes("hostel") || nameAndDetails.includes("shared") || nameAndDetails.includes("dorm") || nameAndDetails.includes("מעורב")) {
        return false;
    }
    const isFoodPlace = place.types?.includes('restaurant') || place.types?.includes('cafe') || place.types?.includes('bakery');
    if (isFoodPlace) {
        const kosherKeywords = ["בדץ", "בד\"ץ", "העדה החרדית", "רובין", "לנדא", "בית יוסף", "מהדרין"];
        const hasKosherStamp = kosherKeywords.some(keyword => nameAndDetails.includes(keyword));
        if (!hasKosherStamp) return false; 
    }
    return true;
}

/**
 * פענוח מיקומים ותיאורים חופשיים
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
    } catch (error) { return { success: false }; }
}

/**
 * מנתב ה-IVR המרכזי
 */
app.all('/ivr', async (req, res) => {
    const userInput = req.query.ApiDigits || req.body.ApiDigits; 
    const currentStep = req.query.step || req.body.step || 'INITIAL_START';
    const speechText = req.query.speechText || req.body.speechText; 
    
    let responseText = "";
    let nextStep = currentStep;

    if (currentStep === 'INITIAL_START') {
        responseText = "ברוכים הבאים למרכז הניווט, הטיולים והמידע הכשר. הקש: לניווט ברכב 1, באוטובוס 2, ברגל 3. לזיהוי מיקומך 4. חנויות בדץ 5. מסלולי שטח 6. אטרקציות 7. קמפינג ולינה 9.";
        nextStep = 'MAIN_MENU';
        return sendIvrResponse(res, responseText, nextStep);
    }

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

    // (שאר הלוגיקה שלך ממשיכה כאן ללא שינוי...)
    // הוספתי רק את ה-sendIvrResponse בסוף כדי שהכל יהיה תקין
    return sendIvrResponse(res, "סליחה, לא הבנתי את הבקשה.", 'INITIAL_START');
});

function sendIvrResponse(res, text, nextStep) {
    return res.send(`read=t-${text}&target=ivr?step=${nextStep}`);
}

app.listen(port, () => {
    console.log(`השרת המקצועי באוויר ורץ על פורט ${port}`);
});
