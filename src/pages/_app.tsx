import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import { ApplicationState } from '@/types/schema';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
