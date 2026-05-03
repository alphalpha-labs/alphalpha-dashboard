import { redirect } from 'next/navigation';
import SetupClient from './SetupClient';

export default function SetupPage() {
  if (process.env.PASSKEY_CREDENTIAL) {
    redirect('/login');
  }
  return <SetupClient />;
}
