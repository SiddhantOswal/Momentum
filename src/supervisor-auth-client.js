const statusNode = document.getElementById("supervisor-auth-status");
const signInButton = document.getElementById("supervisor-sign-in");
const signOutButton = document.getElementById("supervisor-sign-out");
const refreshButton = document.getElementById("supervisor-refresh-session");

if (statusNode && signInButton && signOutButton) {
  const originalFetch = window.fetch.bind(window);
  const protectedPath = /^\/(?:api\/runs(?:\/|$)|orders\/extract|conditions\/current|risk\/(?:predict|optimize|explanation|similar-runs)|evidence\/(?:seen-before|approved-photos|classify-photo)|insights\/summary|jobs(?:\/|$))/;
  let auth;
  let currentUser;
  let signOutUser;

  function setStatus(message) {
    statusNode.textContent = message;
  }

  function jsonResponse(status, code, message) {
    return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const response = await originalFetch("/api/auth/config", { cache: "no-store" });
    const config = await response.json();
    if (response.ok && config.authorizationMode === "HACKATHON_DEMO") {
      signInButton.hidden = true;
      signOutButton.hidden = true;
      if (refreshButton) refreshButton.hidden = true;
      const note = document.createElement("p");
      note.id = "hackathon-approval-note";
      note.className = "muted small";
      note.textContent = config.approvalNote;
      document.getElementById("approval-form")?.after(note);
      const banner = document.createElement("p");
      banner.id = "hackathon-provenance-note";
      banner.className = "provenance-pill";
      banner.setAttribute("role", "note");
      // Required disclosure (D1/D5); "Try sample order" in New Lot replaces the PO1 instructions.
      banner.textContent = "Prototype · modelled on our plant · simulated conditions · predicted, not measured";
      document.getElementById("main-content")?.prepend(banner);
      document.getElementById("open-session").textContent = "Demo session";
      document.getElementById("session-title").textContent = "Hackathon session";
      let session;
      async function ensureSession() {
        if (!session) session = (async () => {
          const created = await originalFetch("/api/auth/demo-session", { method: "POST", credentials: "same-origin", cache: "no-store" });
          const result = await created.json();
          if (!created.ok || result.ok !== true) throw new Error("Temporary demo authorization is unavailable. No action was executed.");
          setStatus("Temporary demo session active. This is not an authenticated supervisor identity. Sessions expire after two hours; keep this browser session to retrieve its records.");
          return result;
        })().catch(error => { session = undefined; throw error; });
        return session;
      }
      window.fetch = async (input, init = {}) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.origin);
        if (url.origin !== location.origin || !protectedPath.test(url.pathname)) return originalFetch(input, init);
        try { await ensureSession(); }
        catch (error) { setStatus(error.message); return jsonResponse(503, "DEMO_AUTHORIZATION_UNAVAILABLE", error.message); }
        const result = await originalFetch(input, { ...init, credentials: "same-origin" });
        if (result.status === 401) {
          session = undefined;
          setStatus("Demo session expired. This action was not retried. A new session cannot retrieve the previous session’s records.");
        }
        return result;
      };
      if (config.demoSessionConfigured === true) await ensureSession();
      else setStatus("Hackathon authorization is not configured. Protected actions remain blocked.");
    } else if (!response.ok || config.enabled !== true || !config.clientConfig) {
      setStatus("Supervisor sign-in is not configured. Privileged cloud actions remain unavailable.");
    } else if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      setStatus("Supervisor sign-in requires HTTPS.");
    } else {
      setStatus("Loading Firebase supervisor sign-in…");
      const version = "12.19.0";
      const [{ initializeApp }, { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut }] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      ]);
      const app = initializeApp(config.clientConfig);
      auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      signOutUser = signOut;

      window.fetch = async (input, init = {}) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.origin);
        if (url.origin !== location.origin || !protectedPath.test(url.pathname)) {
          return originalFetch(input, init);
        }
        if (!currentUser) {
          return jsonResponse(401, "AUTHENTICATION_REQUIRED", "Sign in with an approved supervisor account to continue.");
        }
        try {
          const token = await currentUser.getIdToken();
          const headers = new Headers(input instanceof Request ? input.headers : undefined);
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
          headers.set("Authorization", `Bearer ${token}`);
          const response = await originalFetch(input, { ...init, headers });
          if (response.status === 401) {
            setStatus("Your supervisor session is missing, expired, or could not be verified. Sign in again.");
          } else if (response.status === 403) {
            setStatus("This account is signed in but is not authorized as an approved supervisor.");
          } else if (response.status === 503) {
            setStatus("A required identity or service integration is unavailable. The protected action was not completed.");
          }
          return response;
        } catch {
          currentUser = undefined;
          setStatus("Your sign-in session expired. Sign in again to continue.");
          signInButton.hidden = false;
          signOutButton.hidden = true;
          return jsonResponse(401, "INVALID_AUTHENTICATION", "Your sign-in session expired. Sign in again.");
        }
      };

      signInButton.hidden = false;
      signInButton.addEventListener("click", async () => {
        signInButton.disabled = true;
        setStatus("Opening Google sign-in…");
        try {
          await signInWithPopup(auth, provider);
        } catch (error) {
          const expired = error?.code === "auth/user-token-expired";
          setStatus(expired
            ? "The sign-in session expired. Start sign-in again."
            : "Sign-in did not complete. Check the approved Google account and try again.");
        } finally {
          signInButton.disabled = false;
        }
      });

      signOutButton.addEventListener("click", async () => {
        signOutButton.disabled = true;
        try {
          await signOutUser(auth);
          setStatus("Signed out. Privileged actions require supervisor sign-in.");
        } catch {
          setStatus("Sign-out could not be confirmed. Refresh the page and verify the session.");
        } finally {
          signOutButton.disabled = false;
        }
      });

      refreshButton?.addEventListener("click", async () => {
        refreshButton.disabled = true;
        try {
          if (!currentUser) throw new Error("Signed out");
          await currentUser.getIdToken(true);
          setStatus("Access token refreshed. The server will verify your supervisor role and approved UID on the next action.");
        } catch {
          setStatus("Access could not be refreshed. Sign out and sign in again with the approved account.");
        } finally {
          refreshButton.disabled = false;
        }
      });

      onAuthStateChanged(auth, (user) => {
        currentUser = user ?? undefined;
        if (refreshButton) refreshButton.hidden = !currentUser;
        if (currentUser) {
          setStatus(`Signed in${currentUser.email ? ` as ${currentUser.email}` : ""}. Supervisor access is checked by the server for each protected action.`);
          signInButton.hidden = true;
          signOutButton.hidden = false;
        } else {
          setStatus("Signed out. Sign in with an approved supervisor account to use protected actions.");
          signInButton.hidden = false;
          signOutButton.hidden = true;
        }
      });
    }
  } catch {
    setStatus("Supervisor sign-in is unavailable. The application will keep protected actions blocked.");
    signInButton.hidden = true;
    signOutButton.hidden = true;
  }
}
