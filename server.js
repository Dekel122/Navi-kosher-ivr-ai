const express = require('express');
const { YemotRouter } = require('yemot-router2');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const router = YemotRouter({ printLog: true });

router.get('/', async (call) => {
    return call.id_list_message([
        { type: 'text', data: 'שלום עולם זאת בדיקה' }
    ]);
});

app.use('/ivr', router);
app.get('/health', (req, res) => res.send('השרת חי ובועט!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ שרת ניסוי אבחון רץ על פורט ${PORT}`);
});
