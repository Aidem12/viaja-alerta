
export async function sendPasswordResetEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('Servicio de correo no configurado.');
  }

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Recuperación de contraseña - Viaja Alerta',
        text: [
          'Hola,',
          '',
          'Recibimos una solicitud para recuperar tu contraseña de Viaja Alerta.',
          '',
          'Tu código de recuperación es:',
          '',
          code,
          '',
          'Este código vence en 15 minutos.',
          '',
          'Si no solicitaste este cambio, puedes ignorar este correo.',
          '',
          'Viaja Alerta'
        ].join('\n')
      }),
      signal: AbortSignal.timeout(10000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo enviar el correo (HTTP ${response.status}).`
    );
  }

  return { ok: true };
}
