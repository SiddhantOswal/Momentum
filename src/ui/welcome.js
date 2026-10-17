// Demo welcome screen: brand, tagline and a single "Log in" button. There is no authentication;
// it shows once per browser tab when the app is opened at its root address. Direct links
// (#screen-…) and ?skipWelcome skip it. Imported before workflow.js so it sees the original URL.
const KEY = "momentum-welcome-seen";
const screen = document.getElementById("welcome-screen");
const seen = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
const skip = location.hash !== "" || new URLSearchParams(location.search).has("skipWelcome") || seen();
if (screen) {
  if (skip) screen.remove();
  else {
    screen.hidden = false;
    document.body.classList.add("welcome-open");
    // Modal: the app behind stays inert (no focus or clicks) until Log in.
    const app = document.querySelector(".app-shell");
    app?.setAttribute("inert", "");
    const button = document.getElementById("welcome-login");
    const keepFocus = (event) => { if (!screen.contains(event.target)) button.focus({ preventScroll: true }); };
    document.addEventListener("focusin", keepFocus);
    // Focus after the app has finished its first render, so Enter logs in straight away.
    setTimeout(() => button.focus({ preventScroll: true }), 0);
    button.addEventListener("click", () => {
      try { sessionStorage.setItem(KEY, "1"); } catch { /* shows again in a new tab */ }
      document.removeEventListener("focusin", keepFocus);
      app?.removeAttribute("inert");
      screen.classList.add("is-leaving");
      document.body.classList.remove("welcome-open");
      const done = () => { screen.remove(); document.getElementById("main-content")?.focus({ preventScroll: true }); };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) done();
      else screen.addEventListener("animationend", done, { once: true });
    }, { once: true });
  }
}
