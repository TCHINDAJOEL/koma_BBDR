import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ToastProvider } from '@/components/Toast';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Visualisateur dynamique de base de données</title>
        <meta name="description" content="Visualisateur dynamique de base de données avec validation intelligente" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </>
  );
}
