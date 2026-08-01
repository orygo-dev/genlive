import { NextResponse } from "next/server";

export const runtime = "nodejs";

type MeetingAiRequest = {
  message?: string;
  roomName?: string;
};

type OpenAiChoice = {
  message?: {
    content?: string;
  };
};

export async function POST(request: Request) {
  let body: MeetingAiRequest;
  try {
    body = (await request.json()) as MeetingAiRequest;
  } catch {
    return NextResponse.json(
      { error: "Permintaan tidak valid." },
      { status: 400 },
    );
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json(
      { error: "Pesan wajib diisi." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Asisten AI belum dikonfigurasi. Hubungi administrator untuk menambahkan kunci API.",
      },
      { status: 503 },
    );
  }

  const roomLabel = body.roomName?.trim() || "meeting";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Anda asisten meeting GenMeet. Gunakan bahasa Indonesia. Bantu membuat agenda, merangkum diskusi, dan memberi ide tindak lanjut secara singkat dan praktis.",
          },
          {
            role: "user",
            content: `Ruang meeting: ${roomLabel}\n\nPermintaan:\n${message}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    const payload = (await response.json()) as {
      choices?: OpenAiChoice[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload.error?.message ??
            "Asisten AI gagal merespons. Coba lagi sebentar lagi.",
        },
        { status: 502 },
      );
    }

    const reply = payload.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: "Asisten AI tidak mengembalikan jawaban." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Tidak dapat terhubung ke layanan AI." },
      { status: 502 },
    );
  }
}
