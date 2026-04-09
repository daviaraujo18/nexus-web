import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const response = await fetch(
      'https://onesignal.com/api/v1/notifications',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          include_external_user_ids: [String(body.userId)],
          headings: { en: body.title },
          contents: { en: body.body },
          data: {
            route: body.route,
            type: body.type,
          },
        }),
      }
    );

    const data = await response.json();

    console.log('ONESIGNAL RESPONSE:', data);

    return NextResponse.json({
      success: response.ok,
      status: response.status,
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