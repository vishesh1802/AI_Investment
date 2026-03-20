import { NextRequest, NextResponse } from "next/server";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };
type Company = {
  ticker?: string;
  name?: string;
  sector?: string;
  riskScore?: number;
  rec?: string;
  confidence?: number;
  features?: Record<string, number>;
  shap?: Record<string, number>;
};

type MaybeChatObject = {
  role?: unknown;
  content?: unknown;
};

function isCompany(x: unknown): x is Company {
  return !!x && typeof x === "object";
}

function safeLastUserMessage(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const last = [...messages]
    .reverse()
    .find((m) => m && typeof m === "object" && (m as MaybeChatObject).role === "user");
  const content =
    last && typeof last === "object" ? (last as MaybeChatObject).content : "";
  return typeof content === "string" ? content : "";
}

function formatDriverLabel(key: string): string {
  const map: Record<string, string> = {
    momentum: "Price Momentum",
    earningsSurprise: "Earnings Surprise",
    pe: "P/E Ratio",
    volatility: "Volatility",
    debtRatio: "Debt-to-Equity",
    volume: "Volume Ratio",
    beta: "Beta",
    sharpe: "Sharpe Ratio",
  };
  return map[key] || key;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | {
        company?: Company;
        systemPrompt?: string;
        messages?: ChatMessage[];
      }
    | null;

  const company = body?.company;
  const systemPrompt = body?.systemPrompt ?? "";
  const messages = body?.messages ?? [];
  const userText = safeLastUserMessage(messages);

  if (!company || !isCompany(company)) {
    return NextResponse.json({ reply: "⚠ Missing company context." }, { status: 400 });
  }

  // Always produce a deterministic fallback so the app works without an API key.
  const fallbackReply = (() => {
    const riskScore =
      typeof company.riskScore === "number" ? company.riskScore : null;
    const confidence =
      typeof company.confidence === "number" ? company.confidence : null;
    const rec = typeof company.rec === "string" ? company.rec : "HOLD";

    const abstain = confidence != null && confidence < 0.6;
    const shownRec = abstain ? "ABSTAIN" : rec;
    const confPct = confidence != null ? Math.round(confidence * 100) : null;

    const shap =
      company.shap && typeof company.shap === "object" ? company.shap : {};
    const drivers = Object.entries(shap)
      .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
      .slice(0, 3)
      .map(([k, v]) => {
        const val = typeof v === "number" ? v : 0;
        const dir = val >= 0 ? "supports" : "hurts";
        return `${formatDriverLabel(k)} ${dir} the model (${val >= 0 ? "+" : ""}${Math.round(Math.abs(val) * 100)}% contribution)`;
      });

    const driverText = drivers.length ? drivers.join("; ") : "no drivers available";
    const riskText = riskScore != null ? `Risk score is **${riskScore}/100**.` : "";
    const confText = confPct != null ? ` Confidence is **${confPct}%**.` : "";

    const topic = userText ? `You asked: "${userText}".` : "";
    const recText =
      shownRec === "ABSTAIN"
        ? "Recommendation is withheld because confidence is below the **60% guardrail**."
        : `Recommendation: **${shownRec}**.`;

    return [
      topic,
      `For **${company.name ?? "this company"} (${company.ticker ?? "N/A"})**, based on the model signals, ${recText}`,
      `${riskText}${confText} Top drivers: ${driverText}.`,
      "⚠ Educational only—please validate with your own risk tolerance and a qualified professional.",
    ]
      .filter(Boolean)
      .join(" ");
  })();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ reply: fallbackReply });
  }

  // Optional: if a key is present, we can generate a more natural explanation via Anthropic.
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        // Anthropic requirement for the Messages API
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await res.json();
    const reply =
      data?.content?.[0]?.text ??
      data?.text ??
      "Sorry, I could not generate a response.";

    return NextResponse.json({ reply });
  } catch {
    // Fall back if the external API errors.
    return NextResponse.json({ reply: fallbackReply });
  }
}

