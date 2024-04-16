'use strict';
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!')
});

app.use(require('./line'));
app.use(express.static('public'))

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});