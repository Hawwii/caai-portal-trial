'use client';

import Link from "next/link";
import Button from "./Button";
import { FaArrowRight } from "react-icons/fa";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserContext } from "../_context/UserContext";
import { logEvent } from "../_lib/logging";
import { EventName } from "../_lib/types";

export default function WelcomePage() {
  const [consent, setConsent] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const router = useRouter();
  const user = useUserContext();

  const handleClick = async () => {
    if (!consent) {
      return;
    } else {
      setButtonLoading(true);
      const { setConsentGiven, setTaskAsCompleted, ...userToLog } = user;
      logEvent(user.userId, EventName.StudyStarted, { user: userToLog });
      user.setConsentGiven(true);
      user.showSuggestions ? router.push("/tutorial") : router.push("/tasks/1");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-4">Welcome</h1>
      <p className="text-lg mb-4 text-center px-4">
        Today, you will be asked to complete a series of writing tasks. Before you begin, please review the <Link href="/consent-form.pdf" target="_blank" className="text-blue-500 underline">
          consent form</Link>.
      </p>
      <div className="mb-4">
        <p className="flex items-center justify-center mt-2">
          <input
            type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 cursor-pointer"
            onChange={(e) => setConsent(e.target.checked)}
            checked={consent} />
          <label className="ml-2 text-gray-700">I consent to participate in this study.</label>
        </p>
      </div>
      <div className="flex flex-col items-center mt-4">
        <Button disabled={!consent || buttonLoading} onClick={handleClick}>
          Begin <FaArrowRight style={{ display: 'inline' }} />
        </Button>
      </div>
    </div>
  );
}