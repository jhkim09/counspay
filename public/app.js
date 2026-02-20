// ============================================
// Firebase 설정
// Firebase Console에서 프로젝트 생성 후 아래 값 교체
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyBWHTskXr1izeV0wWS8iPzsD4L4IHdoYyY",
  authDomain: "consultpay-13d53.firebaseapp.com",
  projectId: "consultpay-13d53",
  storageBucket: "consultpay-13d53.firebasestorage.app",
  messagingSenderId: "296494970090",
  appId: "1:296494970090:web:2e0aed355f5ec007239393",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;

// ============================================
// UI 요소
// ============================================
const loginSection = document.getElementById("login-section");
const paymentSection = document.getElementById("payment-section");
const completeSection = document.getElementById("complete-section");
const userInfo = document.getElementById("user-info");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const inputCompany = document.getElementById("input-company");
const inputCeo = document.getElementById("input-ceo");
const inputEmail = document.getElementById("input-email");
const inputPhone = document.getElementById("input-phone");
const paymentError = document.getElementById("payment-error");

// ============================================
// Auth 상태 관리
// ============================================
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    showPaymentScreen(user);
  } else {
    currentUser = null;
    showLoginScreen();
  }
});

function showLoginScreen() {
  loginSection.classList.remove("hidden");
  paymentSection.classList.add("hidden");
  completeSection.classList.add("hidden");
  userInfo.classList.add("hidden");
}

let paypalRendered = false;

function showPaymentScreen(user) {
  loginSection.classList.add("hidden");
  paymentSection.classList.remove("hidden");
  completeSection.classList.add("hidden");
  userInfo.classList.remove("hidden");

  userAvatar.src = user.photoURL || "";
  userName.textContent = user.displayName || "사용자";
  inputEmail.value = user.email || "";

  // PayPal 버튼은 섹션이 보일 때 한 번만 렌더링
  if (!paypalRendered) {
    renderPayPalButton();
    paypalRendered = true;
  }
}

function showCompleteScreen(data) {
  loginSection.classList.add("hidden");
  paymentSection.classList.add("hidden");
  completeSection.classList.remove("hidden");

  document.getElementById("receipt-info").innerHTML = `
    <strong>주문번호:</strong> ${data.order_id}<br>
    <strong>회사명:</strong> ${data.user.company}<br>
    <strong>대표자:</strong> ${data.user.ceo}<br>
    <strong>이메일:</strong> ${data.user.email}<br>
    <strong>연락처:</strong> ${data.user.phone}<br>
    <strong>결제금액:</strong> $${data.amount}<br>
    <strong>결제시간:</strong> ${new Date(data.timestamp).toLocaleString("ko-KR")}
  `;
}

// ============================================
// Google 로그인/로그아웃
// ============================================
function handleGoogleLogin() {
  auth.signInWithPopup(provider).catch((err) => {
    console.error("로그인 실패:", err);
    alert("로그인에 실패했습니다. 다시 시도해주세요.");
  });
}

function handleLogout() {
  auth.signOut();
}

// ============================================
// 유효성 검사
// ============================================
function validateForm() {
  const company = inputCompany.value.trim();
  const ceo = inputCeo.value.trim();
  const email = inputEmail.value.trim();
  const phone = inputPhone.value.trim();

  if (!company) {
    showError("회사명을 입력해주세요.");
    return false;
  }
  if (!ceo) {
    showError("대표자명을 입력해주세요.");
    return false;
  }
  if (!email) {
    showError("이메일을 입력해주세요.");
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("올바른 이메일 형식을 입력해주세요.");
    return false;
  }
  if (!phone) {
    showError("휴대폰번호를 입력해주세요.");
    return false;
  }
  if (!/^[\d\-+() ]{10,}$/.test(phone)) {
    showError("올바른 휴대폰번호를 입력해주세요.");
    return false;
  }

  paymentError.classList.add("hidden");
  return true;
}

function showError(msg) {
  paymentError.textContent = msg;
  paymentError.classList.remove("hidden");
}

// ============================================
// PayPal 결제 버튼 (화면 표시 후 렌더링)
// ============================================
function renderPayPalButton() {
  if (typeof paypal === "undefined") {
    console.error("PayPal SDK 로드 실패");
    document.getElementById("paypal-button-container").innerHTML =
      '<button class="primary-btn" style="width:100%" onclick="window.open(\'https://www.paypal.com\')">PayPal SDK 로드 실패 - 새로고침 해주세요</button>';
    return;
  }
  paypal.Buttons({
    style: {
      layout: "vertical",
      color: "blue",
      shape: "rect",
      label: "pay",
      height: 50,
    },

    onClick(data, actions) {
      if (!validateForm()) {
        return actions.reject();
      }
      return actions.resolve();
    },

    async createOrder() {
      const res = await fetch("/api/create-order", { method: "POST" });
      const order = await res.json();
      if (order.error) throw new Error(order.error);
      return order.id;
    },

    async onApprove(data) {
      const userPayload = {
        name: currentUser.displayName || "이름없음",
        company: inputCompany.value.trim(),
        ceo: inputCeo.value.trim(),
        email: inputEmail.value.trim(),
        phone: inputPhone.value.trim(),
        uid: currentUser.uid,
      };

      const res = await fetch("/api/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderID: data.orderID, userInfo: userPayload }),
      });
      const result = await res.json();

      if (result.status === "COMPLETED") {
        showCompleteScreen(result.paymentData);
      } else {
        showError("결제 처리 중 문제가 발생했습니다.");
      }
    },

    onError(err) {
      console.error("PayPal 에러:", err);
      showError("결제 중 오류가 발생했습니다. 다시 시도해주세요.");
    },
  }).render("#paypal-button-container");
}

// ============================================
// 추가 신청
// ============================================
function resetToPayment() {
  inputCompany.value = "";
  inputCeo.value = "";
  inputPhone.value = "";
  showPaymentScreen(currentUser);
}
