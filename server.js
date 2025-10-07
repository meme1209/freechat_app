
// Simple Node/Express stub for local testing.
// Run: npm install express && node server.js
const express = require('express');
const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname)));
app.get('/ping', (req,res)=>res.json({ok:true, time:Date.now()}));
app.listen(3000, ()=>console.log('Static server on http://localhost:3000'));
