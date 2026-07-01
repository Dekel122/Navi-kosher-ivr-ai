const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function handleYemot(req, res) {
    console.log('=== בקשה מימות ===');
    console.log('Method:', req.method);
    console.log('Query:', JSON.stringify(req.query));
    console.log('Body:', JSON.stringify(req.body));

    const response = 'id_list_message=t-שלום עולם זאת בדיקה ידנית';
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(response);
}

app.get('/ivr', handleYemot);
app.post('/ivr', handleYemot);
app.get('/ivr/', handleYemot);
app.post('/ivr/', handleYemot);

app.get('/health', (req, res) => res.send('השרת חי ובועט!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ שרת ניסוי ידני רץ על פורט ${PORT}`);
    console.log(`📞 מאזין ל: /ivr (GET + POST)`);
});
