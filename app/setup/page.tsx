import { redirect } from 'next/navigation';
import SetupClient from './SetupClient';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  if (process.env.PASSKEY_CREDENTIAL) {
    redirect('/login');
  }
  return <SetupClient />;
}
