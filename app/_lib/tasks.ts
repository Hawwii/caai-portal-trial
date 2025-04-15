import { Task } from "./types";

export const TUTORIAL_TASK = "Write an essay on the importance of education.";
export const TUTORIAL_TASK_ID = "tutorial";

export const tasks: Task[] = [
  {
    id: "food",
    prompt: "What is your favorite food and why?",
    minWords: 50,
    completed: false
  },
  {
    id: "public_figure",
    prompt: "Who is your favorite celebrity or public figure, and why?",
    minWords: 50,
    completed: false
  },
  {
    id: "attention_check",
    prompt: "Attention check: Leave this textbox empty.",
    minWords: 0,
    completed: false
  },
  {
    id: "festival",
    prompt: "Which is your favorite festival/holiday and how do you celebrate it?",
    minWords: 50,
    completed: false
  },
  {
    id: "leave",
    prompt: "Write an email to your boss asking them for a two week leave with information about why you need to be away.",
    minWords: 50,
    completed: false
  }
];