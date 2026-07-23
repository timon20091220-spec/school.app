const showBootError = (error) => {
  console.error("Baemoon app bootstrap failed:", error);
  const message = error?.message || "앱 초기화 중 오류가 발생했습니다.";
  const studentError = document.querySelector("#studentLoginError");
  const adminError = document.querySelector("#adminLoginError");
  const toast = document.querySelector("#toast");

  if (studentError) {
    studentError.textContent = `앱 초기화 오류: ${message}`;
    studentError.hidden = false;
  }
  if (adminError) {
    adminError.textContent = `앱 초기화 오류: ${message}`;
    adminError.hidden = false;
  }
  if (toast) {
    toast.textContent = "앱을 불러오지 못했습니다. 새로고침해주세요.";
    toast.classList.add("show");
  }
};

try {
  // 반드시 앱 UI가 모두 준비된 다음 Firebase 인증을 시작합니다.
  await import("./app.js");

  if (!window.baemoonApp || typeof window.baemoonApp.setSession !== "function") {
    throw new Error("앱 UI 초기화가 완료되지 않았습니다.");
  }

  await import("./firebase-runtime.js");
  window.__baemoonBootstrapReady = true;
} catch (error) {
  window.__baemoonBootstrapReady = false;
  showBootError(error);
}
