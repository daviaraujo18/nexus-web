export async function sendOneSignalPush({
  userId,
  title,
  body,
  data,
  apiKey
}: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  apiKey: string;
}) {
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: '3306949a-e7f5-4273-9c5b-9d0d8bbc3705',
      include_aliases: {
        external_id: [userId],
      },
      target_channel: 'push',
      headings: {
        pt: title,
        en: title,
      },
      contents: {
        pt: body,
        en: body,
      },
      data: data || {},
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    console.error('OneSignal error:', json);
    throw new Error('Falha ao enviar push via OneSignal.');
  }

  return json;
}