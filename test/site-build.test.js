import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sourceHash } from "../site/hash-sources.mjs";

// The Docker image copies public/ and never builds site/, so the committed pages must match their source.
test("the built landing and sign-in pages match the site source", () => {
  const built = readFileSync(new URL("../public/site/source.sha256", import.meta.url), "utf8").trim();
  assert.equal(built, sourceHash(), "site/ changed since public/site was built: run npm run build:site and commit public/site");
});

test("the built pages exist and the sign-in page has no password-reset control", () => {
  const landing = readFileSync(new URL("../public/site/index.html", import.meta.url), "utf8");
  const login = readFileSync(new URL("../public/site/login.html", import.meta.url), "utf8");
  assert.match(landing, /href="\/login"/);
  assert.match(login, /Sign in with Google/);
  assert.doesNotMatch(login, /Forgot password/);
});
