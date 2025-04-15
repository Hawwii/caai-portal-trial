'use client';

import React, { useEffect } from 'react'
import WritingTask from '@/app/_components/WritingTask';
import { notFound, useRouter } from 'next/navigation';
import { useUserContext } from '@/app/_context/UserContext';

interface TaskProps {
  params: {
    taskNumber: string;
  }
};

export default function Task({ params }: TaskProps) {
  const user = useUserContext();
  const router = useRouter();

  useEffect(() => {
    // If the user comes directly to this page without giving consent, redirect them back to the welcome page
    if (!user.consentGiven) {
      router.push("/")
    }
  }, []);

  const tasks = user.tasks;
  const taskNumber = parseInt(params.taskNumber);
  if (taskNumber < 1 || taskNumber > tasks.length) {
    notFound();
  }

  const currentTask = tasks[taskNumber - 1];
  const nextLink = {
    href: taskNumber < tasks.length ? `/tasks/${taskNumber + 1}` : "/finish",
    text: taskNumber < tasks.length ? "Next" : "Finish"
  };

  return (
    <div className='px-8'>
      {user.consentGiven && <WritingTask task={currentTask} nextLink={nextLink} />}
    </div>
  );
}
