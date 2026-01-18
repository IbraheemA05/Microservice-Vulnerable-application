export async function up(db) {
  await db.createCollection("users", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "username", "email", "password"],
        additionalProperties: false,
        properties: {
          _id: {},
          userId: { bsonType: "string" },
          username: { bsonType: "string" },
          email: { bsonType: "string" },
          password: { bsonType: "string" }
        }
      }
    }
  });

  await db.collection("users").createIndexes([
    { key: { userId: 1 }, unique: true },
    { key: { email: 1 }, unique: true },
    { key: { username: 1 }, unique: true }
  ]);
}
