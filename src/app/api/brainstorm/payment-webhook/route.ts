import { NextRequest, NextResponse } from "next/server";
import { grantCreditAfterPayment } from "@/lib/brainstorm/credits";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // QPay webhook payload: { payment_id, invoice_id, payment_status, ... }
    const { invoice_id, payment_status } = body as {
      invoice_id: string;
      payment_status: string;
    };

    if (payment_status !== "PAID") {
      return NextResponse.json({ ok: false, reason: "not_paid" });
    }

    // invoice_id-ээс user_id олох
    // as any: brainstorm_credit_transactions not in DB type
    const admin = getSupabaseAdminClient();
    const { data: tx } = await (admin as any)
      .from("brainstorm_credit_transactions")
      .select("user_id")
      .eq("invoice_id", invoice_id)
      .single();

    if (!tx) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    await grantCreditAfterPayment(tx.user_id, invoice_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[brainstorm/payment-webhook]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
