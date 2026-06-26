// ============================================================
//  גרסת בדיקה מינימלית — לבודד את בעיית הניתוק
// ============================================================
const express = require('express');
const { YemotRouter } = require('yemot-router2');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = YemotRouter({
    printLog: true,
    defaults: { removeInvalidChars: true }
});

function txt(t) { return [{ type: 'text', data: t }]; }

router.get('/', async (call) => {
    // שלב 1 — ברכה + קבלת הקשה
    const choice = await call.read(
        txt('ברוכים הבאים למרכז הניווט הכשר. לניווט הקישו 1. למידע הקישו 2.'),
        'tap',
        { max_digits: 1, digits_allowed: [1, 2] }
    );

    // שלב 2 — תגובה לפי הבחירה
    if (choice === '1') {
        return call.id_list_message(txt('בחרת ניווט. תודה ולהתראות.'));
    } else {
        return call.id_list_message(txt('בחרת מידע. תודה ולהתראות.'));
    }
});

app.use('/ivr', router);
app.get('/health', (req, res) => res.send('השרת חי ובועט!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ שרת בדיקה רץ על פורט ${PORT}`);
});
