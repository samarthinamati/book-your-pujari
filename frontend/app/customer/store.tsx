import { Redirect } from 'expo-router';

// The Samagri Store now lives under /store; keep this route so existing links keep working.
export default function CustomerStoreRedirect() {
  return <Redirect href="/store" />;
}
