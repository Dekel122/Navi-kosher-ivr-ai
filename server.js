const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.send('השרת חי ובועט!');
});

// מפתח ה-API
const GOOGLE_MAPS_API_KEY = 'AIzaSyA4b...' + 'YOUR_SECRET_KEY_PART'; 

// מאגר וריאציות
const descriptiveVariations = [
    "חפשו מבנה בגובה 4-5 קומות, חזית אבן מסודרת וכניסה רחבה.",
    "באזור זה יש כמות חניות גדולה על המדרכה, וסמוך אליה חנות נוחות או מאפייה.",
    "חפשו מבנה מסחרי בן 2 קומות המכיל מספר חנויות ברצף (ביגוד או ספרי קודש).",
    "הביטו סביב וחפשו שלט רחוב גדול או צומת עם תחנת אוטובוס קרובה."
];

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

app.all('/ivr', async (req, res) => {
    const userInput = req.query.ApiDigits || req.body.ApiDigits; 
    const currentStep = req.query.step || req.body.step || 'INITIAL_START';
    const speechText = req.query.speechText || req.body.speechText; 
    
    let responseText = "";
    let nextStep = currentStep;

    if (currentStep === 'INITIAL_START') {
        responseText = "ברוכים הבאים למרכז הניווט, הטיולים והמידע הכשר. הקש: לניווט ברכב 1, באוטובוס 2, ברגל 3. לזיהוי מיקומך 4. חנויות בדץ 5. מסלולי שטח 6. אטרקציות 7. קמפינג ולינה 9.";
        nextStep = 'MAIN_MENU';
    } else if (currentStep === 'MAIN_MENU') {
        responseText = "תפריט ראשי: בחר שלוחה.";
        nextStep = 'MAIN_MENU';
    }

    return sendIvrResponse(res, responseText, nextStep);
});

function sendIvrResponse(res, text, nextStep) {
    return res.send(`read=t-${text}&target=ivr?step=${nextStep}`);
}

app.listen(port, () => {
    console.log(`השרת רץ על פורט ${port}`);
});
