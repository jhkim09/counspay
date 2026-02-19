require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

// PayPal 액세스 토큰 발급
async function getPayPalToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token;
}

// PayPal 주문 생성 ($5)
app.post("/api/create-order", async (req, res) => {
  try {
    const token = await getPayPalToken();
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "USD", value: "5.00" },
            description: "경영컨설팅 보고서 1건",
          },
        ],
      }),
    });
    const order = await response.json();
    res.json(order);
  } catch (err) {
    console.error("주문 생성 실패:", err);
    res.status(500).json({ error: "주문 생성 실패" });
  }
});

// PayPal 결제 승인
app.post("/api/capture-order", async (req, res) => {
  try {
    const { orderID, userInfo } = req.body;
    const token = await getPayPalToken();

    const response = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const capture = await response.json();

    if (capture.status === "COMPLETED") {
      // 결제 완료 데이터 구성
      const paymentData = {
        event: "payment_completed",
        timestamp: new Date().toISOString(),
        order_id: orderID,
        amount: "5.00",
        currency: "USD",
        description: "경영컨설팅 보고서 1건",
        user: {
          name: userInfo.name,
          email: userInfo.email,
          phone: userInfo.phone,
          google_uid: userInfo.uid,
        },
        paypal: {
          payer_email: capture.payer?.email_address,
          transaction_id:
            capture.purchase_units?.[0]?.payments?.captures?.[0]?.id,
        },
      };

      // 콘솔에 JSON 출력
      console.log("\n=== 결제 완료 ===");
      console.log(JSON.stringify(paymentData, null, 2));
      console.log("=================\n");

      // Webhook 전송
      if (process.env.WEBHOOK_URL && process.env.WEBHOOK_URL !== "https://your-webhook-url.com/callback") {
        fetch(process.env.WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentData),
        }).catch((err) => console.error("Webhook 전송 실패:", err));
      }

      // 로컬 파일로도 저장
      const fs = require("fs");
      const logDir = path.join(__dirname, "payments");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      fs.writeFileSync(
        path.join(logDir, `${orderID}.json`),
        JSON.stringify(paymentData, null, 2)
      );

      res.json({ status: "COMPLETED", paymentData });
    } else {
      res.json({ status: capture.status, details: capture });
    }
  } catch (err) {
    console.error("결제 승인 실패:", err);
    res.status(500).json({ error: "결제 승인 실패" });
  }
});

// 결제 내역 조회
app.get("/api/payments", (req, res) => {
  const fs = require("fs");
  const logDir = path.join(__dirname, "payments");
  if (!fs.existsSync(logDir)) return res.json([]);

  const files = fs.readdirSync(logDir).filter((f) => f.endsWith(".json"));
  const payments = files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(logDir, f), "utf-8"))
  );
  res.json(payments);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
