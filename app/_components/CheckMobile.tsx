'use client';

import { useEffect, useState } from "react";
import { isMobileBrowser } from "./AutocompleteTextbox/utils";

export default function CheckMobile({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (isMobileBrowser(window)) {
      setIsMobile(true);
    }
  }, []);

  return (
    <>
      {isMobile
        ? <div className="text-red-500 text-4xl font-bold m-4 text-center">This study can only be taken on the desktop.</div>
        : <>{children}</>
      }
    </>
  )
}