'use client';

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { useUserContext } from '@/app/_context/UserContext';
import Tutorial from '../_components/Tutorial/Tutorial';

export default function TutorialPage() {
  const user = useUserContext();
  const router = useRouter();

  useEffect(() => {
    // If the user comes directly to this page without giving consent, redirect them back to the welcome page
    if (!user.consentGiven) {
      router.push("/")
    }
  }, []);

  return (
    <div className='px-8'>
      {user.consentGiven && <Tutorial />}
    </div>
  );
}
