// useAccount nécessite un 'use client'
'use client';

import NotConnected from "@/components/shared/NotConnected";
import SimpleStorage from "@/components/shared/SimpleStorage";

import { useAccount } from 'wagmi'

export default function Home() {

  // On récupère si quelqu'un est connecté à notre DApp
  const { isConnected } = useAccount();

  return (
    <>
      {isConnected ? (
        <SimpleStorage />
      ) : (
        <NotConnected />
      )}
    </>
  );
}