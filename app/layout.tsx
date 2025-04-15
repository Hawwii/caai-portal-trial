import "./globals.css";
import UserContextProvider from "./_context/UserContextProvider";
import { Metadata } from "next";
import CheckMobile from "./_components/CheckMobile";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: 'Online Study'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="en">
      <body>
        <CheckMobile>
          <Suspense>
            <UserContextProvider>
              {children}
            </UserContextProvider>
          </Suspense>
        </CheckMobile>
      </body>
    </html>
  );
}
