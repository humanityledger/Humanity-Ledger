import { redirect } from 'next/navigation';

// Quantum Dots are not part of Humanity Ledger, so this page no longer exists.
export default function QDsPage() {
  redirect('/docs');
}
