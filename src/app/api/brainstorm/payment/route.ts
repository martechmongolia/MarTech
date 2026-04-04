import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { createOneTimePaymentInvoice } from "@/lib/brainstorm/credits";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const invoice = await createOneTimePaymentInvoice(user.id, user.email ?? "");
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("[brainstorm/payment]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invoice үүсгэхэд алдаа гарлаа" },
      { status: 500 }
    );
  }
}
