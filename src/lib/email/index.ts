/**
 * Email module — provider abstraction
 *
 * Resend байвал RESEND_API_KEY env тохируулаад доорх commented код-г идэвхжүүл.
 * Provider тохиргоогүй үед console.log mock ашиглана.
 */

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail(payload: EmailPayload): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "MarTech <noreply@martech.mn>",
      ...payload,
    });
    return;
  }

  // Provider тохируулаагүй үед mock
  console.log(`[EMAIL] To: ${payload.to} | Subject: ${payload.subject}`);
  console.log(`[EMAIL] HTML length: ${payload.html.length} chars`);
}

// ─── Trial эхлэх ──────────────────────────────────────────────────────────────

export async function sendTrialStartEmail(to: string, trialEndsAt: string) {
  const days = Math.ceil(
    (new Date(trialEndsAt).getTime() - Date.now()) / 86400000
  );
  await sendEmail({
    to,
    subject: "🚀 MarTech-ийн 14 хоногийн үнэгүй туршилт эхэллээ!",
    html: `
      <h2>Тавтай морилно уу!</h2>
      <p>Та MarTech-ийн Growth plan-ийг <strong>${days} хоног</strong> үнэгүй ашиглах боломжтой боллоо.</p>
      <p>Туршилтын хугацаанд:</p>
      <ul>
        <li>🧠 20 Brainstorming session</li>
        <li>🤖 Сард 120 AI тайлан</li>
        <li>📄 5 хуудас холбох</li>
      </ul>
      <p><a href="https://www.martech.mn/dashboard">Dashboard руу орох →</a></p>
    `,
  });
}

// ─── Trial reminder (3 хоног үлдэхэд) ────────────────────────────────────────

export async function sendTrialReminderEmail(to: string, daysLeft: number) {
  await sendEmail({
    to,
    subject: `⏰ MarTech trial: ${daysLeft} хоног үлдлээ`,
    html: `
      <h2>${daysLeft} хоног үлдлээ</h2>
      <p>Таны үнэгүй туршилт удахгүй дуусна. Subscription идэвхжүүлж MarTech-г үргэлжлүүлэн ашиглаарай.</p>
      <p><a href="https://www.martech.mn/pricing">Subscription идэвхжүүлэх →</a></p>
    `,
  });
}

// ─── Trial дуусах ─────────────────────────────────────────────────────────────

export async function sendTrialEndedEmail(to: string) {
  await sendEmail({
    to,
    subject: "MarTech туршилт дууслаа — subscription идэвхжүүл",
    html: `
      <h2>Туршилтын хугацаа дууслаа</h2>
      <p>Таны өгөгдөл хадгалагдсан хэвээр байна. Subscription идэвхжүүлбэл үргэлжлүүлэн ашиглах боломжтой.</p>
      <p><a href="https://www.martech.mn/pricing">Subscription идэвхжүүлэх →</a></p>
    `,
  });
}

// ─── Credit ≤1 ────────────────────────────────────────────────────────────────

export async function sendCreditLowEmail(to: string, balance: number) {
  await sendEmail({
    to,
    subject: "🧠 Brainstorming credit дуусахдаа ойрхон",
    html: `
      <h2>Credit үлдэгдэл: ${balance}</h2>
      <p>Таны Brainstorming credit дуусахдаа ойрхон байна. Нэмэлт session авахыг хүсвэл:</p>
      <p><a href="https://www.martech.mn/brainstorm/new">Нэмэлт session авах (500₮) →</a></p>
    `,
  });
}

// ─── Төлбөр амжилттай ─────────────────────────────────────────────────────────

export async function sendPaymentSuccessEmail(
  to: string,
  amount: number,
  planName: string
) {
  await sendEmail({
    to,
    subject: "✅ Төлбөр амжилттай баталгаажлаа — MarTech",
    html: `
      <h2>Төлбөр баталгаажлаа!</h2>
      <p>Дүн: <strong>${amount.toLocaleString()}₮</strong></p>
      <p>Төлөвлөгөө: <strong>${planName}</strong></p>
      <p>Subscription идэвхжиж, бүх боломжийг ашиглах боломжтой боллоо.</p>
      <p><a href="https://www.martech.mn/dashboard">Dashboard руу орох →</a></p>
    `,
  });
}
