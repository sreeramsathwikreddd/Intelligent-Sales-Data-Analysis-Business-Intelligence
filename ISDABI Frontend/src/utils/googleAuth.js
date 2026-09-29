let googleScriptPromise = null;
let googleInitialized = false;
let currentCredentialCallback = null;

const GOOGLE_SCRIPT_ID = "isDabi-google-gsi-script";

function loadGoogleScript() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Unable to load Google Identity Services.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Unable to load Google Identity Services."));

    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function initializeGoogle(callback) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("Google Client ID is not configured.");
  }

  currentCredentialCallback = callback;

  await loadGoogleScript();

  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services is unavailable.");
  }

  if (!googleInitialized) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (currentCredentialCallback) {
          currentCredentialCallback(response);
        }
      },
      ux_mode: "popup",
      auto_select: false
    });

    googleInitialized = true;
  }

  return true;
}

export function renderGoogleButton(container) {
  if (!container) {
    throw new Error("Google button container was not found.");
  }

  if (!window.google?.accounts?.id) {
    throw new Error("Google Identity Services is not ready.");
  }

  container.innerHTML = "";

  window.google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    width: 320,
    logo_alignment: "left",
    use_fedcm_for_button: false
  });
}
