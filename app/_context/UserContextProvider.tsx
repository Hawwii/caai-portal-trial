'use client';

import { useState } from 'react';
import { UserContext } from './UserContext';
import { v4 as uuidv4 } from 'uuid';
import { Task, User } from '../_lib/types';
import { tasks } from '../_lib/tasks';
import * as Sentry from "@sentry/nextjs";
import { useSearchParams } from 'next/navigation'

export default function UserContextProvider({ children }: { children: React.ReactNode }) {
  // If there is a url query parameter with Prolific ID, use that as the user id.
  // Otherwise, generate a new user id.
  const searchParams = useSearchParams();
  const prolific_id = searchParams.get('PROLIFIC_PID');
  let uuid;
  if (prolific_id) {
    uuid = `p-${prolific_id}`;
  } else {
    uuid = process.env.NODE_ENV === "development" ? "u-admin" : `u-${uuidv4()}`;
  }
  const [userId] = useState<string>(uuid);
  const [consentGiven, setConsentGiven] = useState<boolean>(false);
  const shouldShowSuggestions = Math.random() <= 0.5;
  const [showSuggestions] = useState<boolean>(process.env.NODE_ENV === "development" ? true : shouldShowSuggestions);
  const [assignedTasks, setAssignedTasks] = useState<Task[]>(tasks);
  Sentry.setUser({ username: userId });

  const user: User = {
    userId,
    consentGiven,
    showSuggestions,
    tasks: assignedTasks,
    setConsentGiven: (consent: boolean) => {
      setConsentGiven(consent);
    },
    setTaskAsCompleted: (taskId: string) => {
      setAssignedTasks((tasks) => tasks.map(task => {
        if (task.id === taskId) {
          return { ...task, completed: true };
        }
        return task;
      }));
    }
  };

  return (
    <UserContext.Provider value={user}>
      {children}
    </UserContext.Provider>
  );
};