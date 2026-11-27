// Usage: printf %s "the password" | node tools/hash-admin-password.mjs
// Prints the value for MOMENTUM_ADMIN_PASSWORD_HASH. The password itself is never written anywhere.
import { hashPassword } from "../src/admin-login.js";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
if (password.length < 12) {
  console.error("Use a password of at least 12 characters.");
  process.exit(1);
}
console.log(await hashPassword(password));
