import { Redirect } from 'expo-router';
import type { Href } from 'expo-router';

import { useAuth } from '../context/AuthContext';

/**
 * Launch URL is kairomobile:/// → "/". The protected tab root lives at /talk,
 * so this unprotected route decides where a fresh launch goes.
 */
export default function Index() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  return <Redirect href={(session ? '/talk' : '/login') as Href} />;
}
