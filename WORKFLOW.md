# 기업분석 유료 서비스 운영 워크플로우

## 서비스 개요

| 항목 | 내용 |
|------|------|
| 상품 | 경영컨설팅 보고서 (AI 기반 기업분석) |
| 가격 | $5.00 (해외/PayPal) / ₩7,500 (국내/mmtum.shop) |
| 결제 페이지 | https://mmtum.co.kr/consulting.html |
| 분석 범위 | 재무분석, 절세전략, 정부지원금 매칭, 임원소득설계 |
| 납품 형태 | 비밀번호 보호 웹 보고서 (mmtum.co.kr/blog/) |

---

## 결제 채널

### 1. PayPal (해외 결제) - 자동 알림
- 고객이 consulting.html에서 Google 로그인 → 폼 입력 → PayPal 결제
- 결제 완료 시 서버가 Make.com 웹훅으로 자동 전송
- **텔레그램 알림이 자동으로 옴**

### 2. mmtum.shop (국내 결제) - 수동 확인
- 고객이 consulting.html에서 "국내 결제로 이동하기" 클릭 → mmtum.shop 이동
- mmtum.shop에서 결제 완료
- **관리자 페이지에서 수동 확인 필요**: https://mmtum.shop/admin/

---

## PayPal 웹훅 → Make.com 페이로드

결제 완료 시 다음 JSON이 Make.com으로 전송됨:

```json
{
  "event": "payment_completed",
  "timestamp": "2026-03-31T14:30:00.000Z",
  "order_id": "ORDER_ID",
  "amount": "5.00",
  "currency": "USD",
  "description": "경영컨설팅 보고서 1건",
  "user": {
    "name": "구글 계정 이름",
    "company": "주식회사 예시",
    "ceo": "홍길동",
    "email": "customer@email.com",
    "phone": "010-1234-5678",
    "google_uid": "firebase_uid"
  },
  "paypal": {
    "payer_email": "paypal@email.com",
    "transaction_id": "PAYPAL_TXN_ID"
  }
}
```

---

## Make.com 알림 시나리오 설정

### 웹훅 URL (이미 설정됨)
`https://hook.eu2.make.com/t7k1twfge7uhwjdj2a2fg6i4n768w5bm`

### 시나리오 구성

```
[Webhook] Custom webhook 수신
    ↓
[Filter] event = "payment_completed"
    ↓
[Telegram] Bot 메시지 전송
    텍스트: "새 컨설팅 주문
    회사: {{user.company}}
    대표: {{user.ceo}}
    이메일: {{user.email}}
    연락처: {{user.phone}}
    금액: ${{amount}}
    시간: {{timestamp}}"
    ↓
[Email] 관리자 이메일 발송 (선택)
    제목: "[모멘텀비즈] 새 주문 - {{user.company}}"
    본문: 위 정보 포함
```

---

## 주문 접수 후 분석 프로세스

주문을 확인했으면 Claude Code에서 다음 명령 실행:

### 1단계: biz-master 분석
```
biz-master로 {회사명} 분석해줘. 대표자: {대표자명}
```

이 명령이 자동으로 실행하는 것:
- Copartner API로 기업정보 조회 (재무제표, 임원, 매출)
- 사업자등록번호 자동 확보 → 보고서 비밀번호로 사용
- 절세/승계/정부지원금/보험 종합 분석

### 2단계: 보고서 배포 (blog-post 스킬)
분석 완료 후 자동 실행:
- `momentum-biz/blog/{slug}.html` 생성 (비밀번호 보호)
- `momentum-biz/blog.html` 목록 업데이트
- `momentum-biz/sitemap.xml` 업데이트
- git push → Render 자동 배포 (1~2분)
- 네이버 블로그 동시 게시 (t678)

### 3단계: 고객 납품 이메일
```
t697 이메일 발송:
제목: [모멘텀비즈] {회사명} 경영분석 보고서가 준비되었습니다
본문:
  안녕하세요, {대표자명} 대표님.

  요청하신 경영분석 보고서가 준비되었습니다.

  보고서 링크: https://mmtum.co.kr/blog/{slug}.html
  비밀번호: {사업자등록번호}

  보고서에는 다음 내용이 포함되어 있습니다:
  - 기업 현황 분석 및 재무 진단
  - 맞춤형 절세 전략
  - 정부지원사업 매칭 결과
  - AI 기반 경영 솔루션 제안

  추가 문의사항은 카카오톡 채널로 연락 부탁드립니다.

  감사합니다.
  모멘텀비즈 드림
```

### 4단계: 텔레그램 완료 알림
```
t1028 텔레그램 전송:
"납품 완료: {회사명} / {대표자} / 보고서 링크 발송됨"
```

---

## 운영 체크리스트

### 매일
- [ ] mmtum.shop 관리자 페이지에서 신규 주문 확인
- [ ] 텔레그램 알림 확인 (PayPal 주문)

### 주문 처리
- [ ] 회사명/대표자명 확인
- [ ] biz-master 분석 실행
- [ ] 보고서 생성 및 배포 확인 (링크 접속 테스트)
- [ ] 고객에게 납품 이메일 발송
- [ ] 완료 알림 기록

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `momentum-biz/consulting.html` | 결제 페이지 (PayPal + 국내결제 링크) |
| `consulting-payment/server.js` | PayPal 결제 서버 + Make.com 웹훅 |
| `consulting-payment/.env` | API 키, 웹훅 URL |
| `.claude/agents/biz-master.md` | 기업분석 에이전트 |
| `.claude/skills/blog-post/SKILL.md` | 보고서 배포 스킬 |
| `momentum-biz/js/blog-features.js` | 비밀번호 보호 스크립트 |

## 향후 확장

- mmtum.shop → 토스페이먼츠 전환 (국내결제 자동화, 주문량 증가 시)
- API 서버로 자동 분석 트리거 (Make.com → Claude API)
- 주문 대시보드 구축
- 상품 다양화 (기본분석 vs 심화분석)
