require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const [dojangs] = await conn.query("SELECT dojang_code, dojang_name FROM dojangs");
  console.log("=== dojangs ===");
  console.log(dojangs);

  const [cols] = await conn.query("DESCRIBE class_details");
  console.log("=== class_details columns ===");
  console.log(cols.map(c => c.Field + ':' + c.Type));

  const [classRows] = await conn.query("SELECT class_id, day, time, classname, dojang_code, type FROM class_details ORDER BY dojang_code, day");
  console.log("=== class_details rows ===");
  console.log(classRows);

  const [attCols] = await conn.query("DESCRIBE attendance");
  console.log("=== attendance columns ===");
  console.log(attCols.map(c => c.Field + ':' + c.Type));

  const [scCols] = await conn.query("DESCRIBE student_classes");
  console.log("=== student_classes columns ===");
  console.log(scCols.map(c => c.Field + ':' + c.Type));

  const [absCols] = await conn.query("DESCRIBE absences");
  console.log("=== absences columns ===");
  console.log(absCols.map(c => c.Field + ':' + c.Type));

  const [notifCols] = await conn.query("DESCRIBE notifications");
  console.log("=== notifications columns (verifying our migration applied) ===");
  console.log(notifCols.map(c => c.Field + ':' + c.Type));

  await conn.end();
})().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
