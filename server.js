const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function handleYemot(req, res) {
    console.log('=== בקשה מימות ===');
    console.log('Query:', JSON.stringify(req.query));

    const response = 'id_list_message=t-שלום עולם זאת בדיקה ידנית&hangup=yes';
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(response);
}

app.get('/ivr', handleYemot);
app.post('/ivr', handleYemot);

app.get('/health', (req, res) => res.send('השרת חי ובועט!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ שרת רץ על פורט ${PORT}`);
});
