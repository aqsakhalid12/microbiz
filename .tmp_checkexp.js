const { Pool } = require("pg");
const p = new Pool({ connectionString: "postgresql://postgres:2345@localhost:5432/microbiz" });
p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='expenses' ORDER BY ordinal_position")
  .then((r) => {
    console.log(r.rows.map((x) => `${x.column_name}: ${x.data_type}`).join("\n"));
    p.end();
  })
  .catch((e) => { console.error("ERR", e.message); p.end(); });
