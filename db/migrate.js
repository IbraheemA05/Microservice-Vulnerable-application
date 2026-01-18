const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "microservices";

if (!MONGO_URI) {
  throw new Error("❌ MONGO_URI is not defined");
}

const client = new MongoClient(MONGO_URI);

async function runMigrations() {
  await client.connect();
  const db = client.db(DB_NAME);

  const migrationsDir = path.join(process.cwd(), "db/migrations");
  const files = fs.readdirSync(migrationsDir).sort();

  const meta = db.collection("_migrations");
  const applied = await meta.find().toArray();
  const appliedNames = applied.map(m => m.name);

  for (const file of files) {
    if (appliedNames.includes(file)) {
      console.log(`⏭ Skipping ${file}`);
      continue;
    }

    console.log(`🚀 Running ${file}`);
    const migration = await require(path.join(migrationsDir, file));
    await migration.up(db);

    await meta.insertOne({
      name: file,
      appliedAt: new Date()
    });
  }

  console.log("✅ Migrations complete");
  await client.close();
}

runMigrations().catch(err => {
  console.error(err);
  process.exit(1);
});