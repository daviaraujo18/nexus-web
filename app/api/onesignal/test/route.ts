import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const keyExists = !!process.env.ONESIGNAL_REST_API_KEY;
    const keyPrefix = process.env.ONESIGNAL_REST_API_KEY?.slice(0, 6) ?? null;
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? null;
    const authorizationSchemeUsed = process.env.ONESIGNAL_REST_API_KEY ? 'key' : null;

    console.log('ONESIGNAL KEY EXISTS:', keyExists);
    console.log('ONESIGNAL KEY PREFIX:', keyPrefix);
    console.log('ONESIGNAL APP ID:', appId);
    console.log('ONESIGNAL AUTH SCHEME:', authorizationSchemeUsed);

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_aliases: {
          external_id: [String(body.userId)],
        },
        target_channel: 'push',
        headings: { en: body.title },
        contents: { en: body.body },
        data: {
          route: body.route,
          type: body.type,
        },
      }),
    });

    const data = await response.json();

    console.log('ONESIGNAL RESPONSE:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: data,
    });

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      keyExists,
      keyPrefix,
      appId,
      authorizationSchemeUsed,
      data,
    });
  } catch (error) {
    console.error('ONESIGNAL ERROR:', error);

    return NextResponse.json({
      success: false,
      error: 'internal error',
    });
  }
}