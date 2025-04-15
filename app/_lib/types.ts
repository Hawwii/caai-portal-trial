export interface Task {
  id: string;
  prompt: string;
  minWords: number;
  completed: boolean;
};

export interface User {
  userId: string;
  consentGiven: boolean;
  tasks: Task[];
  showSuggestions: boolean;
  setConsentGiven: (consent: boolean) => void;
  setTaskAsCompleted: (taskId: string) => void;
};

export enum EventName {
  StudyStarted = "study_started",
  TaskStarted = "task_started",
  SuggestionShown = "suggestion_shown",
  SuggestionAccepted = "suggestion_accepted",
  SuggestionRejected = "suggestion_rejected",
  TaskCompleted = "task_completed",
  StudyFinished = "study_finished",
};

export interface Event {
  eventName: EventName;
  timestamp: number;
  timestampStr: string;
  eventDetails: any;
};