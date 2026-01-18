export async function up(db) {
  await db.createCollection("settings", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId"],
        additionalProperties: false,
        properties: {
          _id: {},
          userId: { bsonType: "string" },
          preferences: {
            bsonType: "object",
            properties: {
              theme: { bsonType: "string" },
              language: { bsonType: "string" },
              timezone: { bsonType: "string" }
            }
          },
          notifications: {
            bsonType: "object",
            properties: {
              email: { bsonType: "bool" }
            }
          },
          privacy: {
            bsonType: "object",
            properties: {
              profileVisible: { bsonType: "bool" },
              searchIndexing: { bsonType: "bool" }
            }
          }
        }
      }
    }
  });

  await db.collection("settings").createIndex({ userId: 1 }, { unique: true });
}