import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../../firebase-service-account.json'), 'utf-8')
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
  });
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string
): Promise<boolean> {
  try {
    const message = {
      notification: { title, body },
      token
    };
    const response = await admin.messaging().send(message);
    console.log('Push enviado:', response);
    return true;
  } catch (error) {
    console.error('Erro push:', error);
    return false;
  }
}
