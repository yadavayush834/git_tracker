import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations.");

const client = postgres(connectionString, { max: 1, prepare: false });
const database = drizzle(client);

try {
  await migrate(database, { migrationsFolder: "drizzle" });
  console.log("RepoPulse database migrations completed.");
} finally {
  await client.end();
}
