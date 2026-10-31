// Create or revoke temporary MCP tokens (ES module, matches server.js)
//   node token.js 60       -> new token valid for 60 minutes
//   node token.js revoke   -> delete all tokens
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const FILE = process.env.TOKENS_FILE || "./tokens.json";
const arg = process.argv[2];

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

if (arg === "revoke") {
  fs.writeFileSync(FILE, "{}");
  console.log("All tokens revoked");
} else {
  const minutes = Number(arg) || 60;
  const now = Date.now();
  const tokens = load();

  // drop already-expired tokens while we're here
  for (const [t, exp] of Object.entries(tokens)) {
    if (Number(exp) <= now) delete tokens[t];
  }

  const token = crypto.randomBytes(32).toString("hex");
  tokens[token] = now + minutes * 60000;
  fs.writeFileSync(FILE, JSON.stringify(tokens, null, 2));

  console.log(`Token valid for ${minutes} min (until ${new Date(tokens[token]).toLocaleString()})`);
  console.log(`Connector URL path: /mcp/${token}`);
}
