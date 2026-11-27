# Landing and sign-in pages

Source for the public landing page (`/`) and the sign-in page (`/login`). Each builds to one
self-contained file in `public/site/`, which the Hono server in `index.mjs` serves.

    cd site
    npm ci
    npm run build      # writes ../public/site/index.html and login.html

`npm run build:site` at the repo root does the same. Commit the rebuilt files in `public/site/` with
the source change: the Docker image copies `public/` and does not build this folder. A test
(`test/site-build.test.js`) fails when `site/` changed and `public/site/` was not rebuilt.

## Where links go

`src/links.js` holds every outbound link. `app` is `/login` and `dashboard` is `/app/`. The demo
video, blog and the founders' LinkedIn and X addresses are empty until they are supplied; empty
values render as plain text.

## Sign-in

- Google: the page reads the Firebase web config from `/api/auth/config`, signs in with the Firebase
  web SDK and posts the ID token to `/api/auth/session`. Nothing is configured in this folder.
- Email and password: posts to `/api/auth/admin-login`. The route is off unless
  `MOMENTUM_ADMIN_EMAIL` and `MOMENTUM_ADMIN_PASSWORD_HASH` are set. Make the hash with
  `printf %s "the password" | node tools/hash-admin-password.mjs`. It works only while the server is
  not using Google sessions (it answers 409 when Google sign-in is on).
- `/app/` redirects to `/login` unless the visitor has a Google session or the admin cookie. The gate
  is on whenever either method is set up; with neither, `/app/` opens as it did before.

## Model file

`src/model/m01.glb` is the 3D model on the landing page. It was made by the Momentum founders, who own it.
