const fs = require('fs');

let controller = fs.readFileSync('controllers/financeController.js', 'utf8');
const missingOps = fs.readFileSync('controllers/missing_crud.js', 'utf8');

// The missing ops have require pool and module exports. I just need the middle part.
const functionsPart = missingOps.replace("const pool = require('../config/database');", "").replace(/module\.exports = {[\s\S]*};/, "");

controller = controller.replace('module.exports = {', functionsPart + '\nmodule.exports = {');

fs.writeFileSync('controllers/financeController.js', controller);
