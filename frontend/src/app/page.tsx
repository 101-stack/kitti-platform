import { redirect } from 'next/navigation';

// Root redirect: go to lobby if logged in, else login
export default function RootPage() {
  redirect('/lobby');
}
