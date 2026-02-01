async function runMigrations() {
  await connectWithRetry();
  const db = client.db(DB_NAME);

  await db.createCollection("_migrations").catch(() => {});
  const meta = db.collection("_migrations");

  const migrationsDir = path.join(process.cwd(), "db/migrations");
  const files = fs.readdirSync(migrationsDir).sort();

  const applied = await meta.find({}, { projection: { name: 1 } }).toArray();
  const appliedNames = new Set(applied.map(m => m.name));

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`⏭ Skipping ${file}`);
      continue;
    }

    console.log(`🚀 Running ${file}`);
    const migration = require(path.join(migrationsDir, file));

    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${file} has no up() function`);
    }

    try {
      await migration.up(db);
      await meta.insertOne({ name: file, appliedAt: new Date() });
      console.log(`✅ Applied ${file}`);
    } catch (err) {
      console.error(`❌ Failed ${file}`);
      throw err;
    }
  }

  await client.close();
}
