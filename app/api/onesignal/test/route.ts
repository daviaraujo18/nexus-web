import { NextResponse } from 'next/server';

function normalizeOneSignalApiKey(raw?: string | null) {
  if (!raw) return null;
  return raw.trim().replace(/^key\s+/i, '');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawKey = process.env.ONESIGNAL_REST_API_KEY ?? null;
    const apiKey = normalizeOneSignalApiKey(rawKey);
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? null;

    if (!apiKey || !appId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing OneSignal env vars',
          keyExists: !!rawKey,
          appIdExists: !!appId,
        },
        { status: 500 }
      );
    }

    const payload = {
      app_id: appId,
      include_aliases: {
        external_id: [String(body.userId)],
      },
      target_channel: 'push',
      headings: { en: body.title ?? 'Teste' },
      contents: { en: body.body ?? 'Teste manual' },
      data: {
        type: body.type ?? 'manual',
        route: body.route ?? '/',
      },
    };

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      appId,
      keyExists: !!rawKey,
      keyPrefix: apiKey.slice(0, 20),
      keySuffix: apiKey.slice(-12),
      payload,
      rawResponse: text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'internal error',
      },
      { status: 500 }
    );
  }
}