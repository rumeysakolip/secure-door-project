const express = require('express');
const router = express.Router();

const mockAtamalar = [
    { atamaId: 1, cihazId: 1, kapiId: 1, baslangic: new Date() }
];

router.get('/', (req, res) => res.json(mockAtamalar));

module.exports = router;