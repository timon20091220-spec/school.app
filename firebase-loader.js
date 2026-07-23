const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForApp(timeoutMs = 10000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (
      window.__baemoonAppReady === true &&
      window.baemoonApp &&
      typeof window.baemoonApp.setSession === "function" &&
      typeof window.baemoonApp.openOverlay === "function"
    ) {
      return window.baemoonApp;
    }
    await sleep(25);
  }

  throw new Error("앱 화면을 불러오지 못했습니다.");
}

function showFirebaseLoadError(error) {
  window.__firebaseRuntimeReady = false;
  console.error("Firebase runtime load failed:", error);

  const message =
    "Firebase 연결 파일을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해주세요.";

  const studentError = document.querySelector("#studentLoginError");
  const adminError = document.querySelector("#adminLoginError");
  const toast = document.querySelector("#toast");

  if (studentError) {
    studentError.textContent = message;
  }
  if (adminError) {
    adminError.textContent = message;
  }
  if (toast) {
    toast.textContent = message;
  }
}

try {
  await waitForApp();
  await import("./firebase-runtime.js?v=11.8.0");
} catch (error) {
  showFirebaseLoadError(error);
}
