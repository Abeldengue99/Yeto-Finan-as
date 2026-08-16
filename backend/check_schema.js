const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres',
  password: '5850',
  host: 'localhost',
  port: 5432,
  database: 'Yeto Finanças'
});

async function run() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';");
  console.log(res.rows);
  pool.end();
}

run();
