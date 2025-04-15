'use client';

import Link from "next/link";
import { useEffect } from "react";
import { useUserContext } from "../_context/UserContext";
import { useRouter } from "next/navigation";
import { logEvent } from "../_lib/logging";
import { EventName } from "../_lib/types";

export default function FinishPage() {
  const user = useUserContext();
  const router = useRouter();
  const surveyLink = "https://cornell.ca1.qualtrics.com/jfe/form/SV_b1oUPBqO9DGfZki";

  useEffect(() => {
    if (!user.consentGiven) {
      router.push('/');
    }

    const { setConsentGiven, setTaskAsCompleted, ...userToLog } = user;
    logEvent(user.userId, EventName.StudyFinished, { user: userToLog });
  }, []);

  return (
    user.consentGiven &&
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">
        Next, please fill out a short survey by clicking <Link href={`${surveyLink}?completionCode=${user.userId}`} className="text-blue-600 underline">here</Link>.
      </h1>
      <p className="text-xl mb-4">
        {user.userId.startsWith("p-")
          ? "At the end of the survey, you will be redirected back to Prolific."
          : "At the end of the survey, you will receive a completion code. Please submit that code on mTurk to finish the study."
        }

      </p>
    </div>
  );
}