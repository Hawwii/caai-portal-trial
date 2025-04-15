'use client';

import React, { SyntheticEvent, useEffect, useRef, useState } from 'react';
import AutocompleteTextbox from "../AutocompleteTextbox/AutocompleteTextbox";
import { GetSuggestionFn, SuggestionAcceptedInfo, SuggestionInfo, SuggestionRejectedInfo } from '../AutocompleteTextbox/types';
import Button from '../Button';
import TutorialPopup from './TutorialPopup';
import { FaCheckCircle, FaRegCircle } from "react-icons/fa";
import { useRouter } from 'next/navigation';
import { useUserContext } from "../../_context/UserContext";
import { TUTORIAL_TASK, TUTORIAL_TASK_ID } from '@/app/_lib/tasks';
import { EventName, Event, Task } from '@/app/_lib/types';
import { createEvent, logEvents } from '@/app/_lib/logging';

export default function Tutorial() {

  // The tutorial task (defining here since this is different from the rest of the tasks)
  const task: Task = {
    id: TUTORIAL_TASK_ID,
    prompt: TUTORIAL_TASK,
    minWords: -1,
    completed: false
  };

  const tutorialSteps = [
    {
      id: 'accept_suggestion',
      popupText: "When you pause typing, you will see an AI suggestion. Press TAB to accept it. Try it out!",
    },
    {
      id: 'ignore_suggestion',
      popupText: "If you want to write something different from what is suggested, you can always do so and the suggestion will disappear. Try it out!",
    },
    {
      id: 'reject_suggestion',
      popupText: "You can also press ESCAPE to ignore a suggestion. Try it out!",
    }
  ];

  // Just some icons to show the completion of the tutorial steps
  const BulletBeforeDone = <FaRegCircle style={{ display: 'inline' }} className='text-yellow-400' />;
  const BulletAfterDone = <FaCheckCircle style={{ display: 'inline' }} className='text-green-600' />;

  /**
   * Logic for the tutorial:
   * All tutorial steps are initially incomplete and the tutorial index is initialized to 0.
   * When a suggestion is shown, the popup is shown.
   * Once the user completed the step, the completion status is updated (setStepIndexAsCompleted).
   * This updates the tutorialStepsCompletion array, which triggers the useEffect to compute
   * the next tutorial index.
   */

  const router = useRouter();
  const user = useUserContext();
  const [currentTutorialIndex, setCurrentTutorialIndex] = useState(0); // note: tutorial steps are one-indexed
  const [tutorialStepsCompletion, setTutorialStepsCompletion] = useState(tutorialSteps.map(step => false));
  const [showPopup, setShowPopup] = useState(false);
  const [anchorEl, setAnchorEl] = useState<Element | null>(null);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [showInitialScreen, setShowInitialScreen] = useState(true);
  const [html, setHTML] = useState<string>("");
  const events = useRef<Event[]>([]);
  const [suggestionJustAccepted, setSuggestionJustAccepted] = useState(false);

  // This function will handle storing the events in the events array and delta uploading them to the server
  const storeEvent = async (event: Event) => {
    events.current.push(event);
    if (events.current.length >= 10) {
      const eventsToLog = [...events.current];
      events.current = [];
      await logEvents(user.userId, eventsToLog);
    }
  };

  useEffect(() => {
    // Log task started event
    const event = createEvent(EventName.TaskStarted, { task });
    storeEvent(event);
  }, []);

  /**
   * Compute the next tutorial step (the first false in the tutorialStepsCompletion array).
   */
  useEffect(() => {
    const nextStep = tutorialStepsCompletion.findIndex(step => !step);
    setCurrentTutorialIndex(nextStep);
  }, [tutorialStepsCompletion]);

  // Show the initial screen with the welcome message
  const handleNextClick = () => {
    setShowInitialScreen(false);
  };

  /**
   * Sets the completion status of a tutorial step at the specified index.
   * 
   * @param stepIndex - The index of the tutorial step.
   */
  const setStepIndexAsCompleted = (stepIndex: number) => {
    setTutorialStepsCompletion(prev => {
      const newCompletion = [...prev];
      newCompletion[stepIndex] = true;
      return newCompletion;
    });
  }

  /**
   * When a suggestion is shown, show the popup with the appropriate message.
   * Also, set the anchor element to the suggestion element so that the popup is shown at the right place.
   * But if the tutorial is already completed, don't show the popup.
   */
  const onSuggestionShown = (event: SuggestionInfo) => {
    const eventForLog = createEvent(EventName.SuggestionShown, {
      suggestionId: event.id,
      timestamp: event.timeShown,
      suggestionText: event.suggestionText,
      leadingText: event.leadingText,
      currentHtml: event.getFullHTML()
    });
    storeEvent(eventForLog);

    if (currentTutorialIndex == -1) return; // tutorial is already completed; don't show the popup

    const anchorElementForPopup = document.querySelector(`[data-suggestionid="${event.id}"]`);
    setAnchorEl(anchorElementForPopup);
    setShowPopup(true);
  }

  /**
   * If the user accepted the suggestion by pressing tab, then that tutorial step is completed (only if that was the current step).
   */
  const onSuggestionAccepted = (event: SuggestionAcceptedInfo) => {
    setSuggestionJustAccepted(true);
    const eventForLog = createEvent(EventName.SuggestionAccepted, {
      suggestionId: event.suggestionId,
      timestamp: event.timeAccepted
    });
    storeEvent(eventForLog);

    if (currentTutorialIndex == -1) return;
    if (tutorialSteps[currentTutorialIndex].id === 'accept_suggestion') {
      setStepIndexAsCompleted(currentTutorialIndex);
    }
    setShowPopup(false);
  }

  /**
   * If the user pressed escape (when they're in that step), then that tutorial step is completed.
   * Similarly, for the implicit rejection (when they're in that step).
   * This ensures that the order of the tutorial steps is maintained.
   * For example, if the user presses escape while in step 1 (when we're teaching them to accept a
   * suggestion), step 3 is not marked as completed.
   */
  const onSuggestionRejected = (event: SuggestionRejectedInfo) => {
    const eventForLog = createEvent(EventName.SuggestionRejected, {
      suggestionId: event.suggestionId,
      timestamp: event.timeRejected,
      reason: event.reason
    });
    storeEvent(eventForLog);

    if (currentTutorialIndex == -1) return;
    const currentStep = tutorialSteps[currentTutorialIndex];
    if (currentStep.id === 'ignore_suggestion' && event.reason === "implicit") {
      setStepIndexAsCompleted(currentTutorialIndex);
    }
    else if (currentStep.id === 'reject_suggestion' && event.reason === "pressed_escape") {
      setStepIndexAsCompleted(currentTutorialIndex);
    }
    setShowPopup(false);
  }

  const handleContentChange = (content: string) => {
    setHTML(content);
  };

  const handleTutorialCompletion = async () => {
    setButtonLoading(true);

    // Create task completed event
    const event = createEvent(EventName.TaskCompleted, {
      taskId: task.id,
      finalHtml: html
    });
    storeEvent(event);

    // Log the remaining events in this task
    if (events.current.length > 0) {
      await logEvents(user.userId, events.current);
    }

    router.push("/tasks/1");
  };

  // We don't want to show a suggestion immediately after the user has accepted one
  // This function tracks if the user has typed a non-whitespace character after accepting a suggestion
  // If they have, we set suggestionJustAccepted to false (so that we can show suggestions again)
  const handleInput = (event: SyntheticEvent<HTMLDivElement>) => {
    const justTyped = (event.nativeEvent as InputEvent).data;
    if (suggestionJustAccepted && justTyped && justTyped.trim() !== "") {
      setSuggestionJustAccepted(false);
    }
  }

  const getSuggestion: GetSuggestionFn = async (textUptilNow: string, abortSignal?: AbortSignal): Promise<string> => {
    if (textUptilNow === "") return "";

    if (suggestionJustAccepted) { // Don't show suggestions immediately after accepting one
      return "";
    }

    try {
      console.log("sending request");
      const startTime = new Date().getTime();
      const response = await fetch('/api/getSuggestion', {
        method: 'POST',
        body: JSON.stringify({ taskId: TUTORIAL_TASK_ID, textUptilNow }),
        signal: abortSignal
      });
      const suggestion = (await response.json()).suggestion;
      const endTime = new Date().getTime();
      console.log(`Task: "${TUTORIAL_TASK_ID}"\nText: "${textUptilNow}"\nSuggestion: "${suggestion}"\nTime taken: ${endTime - startTime}ms`);

      return suggestion;
    } catch (err: any) {
      console.log(`${err.name}: ${textUptilNow}`);
      return "";
    }
  };

  if (showInitialScreen) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl mb-4 px-4">Let us first show you a brief tutorial of how to use our system</h1>
        <Button onClick={handleNextClick}>See Tutorial</Button>
      </div>
    );
  }

  return (
    <div className="writing-task-container py-4 relative">
      <h1 className="text-4xl font-bold text-center">
        Tutorial <br />
      </h1>
      <div className="text-center mb-4 text-red-500">
        Do not refresh the page or hit back, you will lose progress.<br />
      </div>
      <div className="mb-4 select-none">
        <h2 className="text-xl font-bold">How to Use AI Suggestions</h2>
        As you type, you will see suggestions that you can accept or reject.
        <ul className="list-none pl-4">
          <li>
            {tutorialStepsCompletion[0] ? BulletAfterDone : BulletBeforeDone}&nbsp;
            To accept a suggestion, press <span className="bg-gray-100 px-2 py-0.5 text-sm rounded-md">TAB</span>.
          </li>
          <li>
            {tutorialStepsCompletion[1] && tutorialStepsCompletion[2] ? BulletAfterDone : BulletBeforeDone}&nbsp;
            To reject a suggestion, you can either:
            <ul className="list-none pl-4">
              <li>
                {tutorialStepsCompletion[1] ? BulletAfterDone : BulletBeforeDone}&nbsp;
                Continue typing, or
              </li>
              <li>
                {tutorialStepsCompletion[2] ? BulletAfterDone : BulletBeforeDone}&nbsp;
                Press <span className="bg-gray-100 px-2 py-0.5 text-sm rounded-md">ESCAPE</span>.
              </li>
            </ul>
          </li>
        </ul>
        Your turn to try it out! Answer the prompt below.
      </div>
      <p className="text-xl p-2 py-4 mb-4 bg-sky-100 select-none">
        Sample task: {TUTORIAL_TASK}
      </p>

      <AutocompleteTextbox
        onSuggestionShown={onSuggestionShown}
        onSuggestionRejected={onSuggestionRejected}
        onSuggestionAccepted={onSuggestionAccepted}
        disabled={currentTutorialIndex == -1}
        getSuggestion={getSuggestion}
        debounceTime={100}
        onInput={handleInput}
        onContentChange={handleContentChange}
        suggestionClassName='suggestion text-slate-400'
        className={`AutocompleteTextbox border-2 border-grey outline-none text-black my-2 h-52 p-2 overflow-y-scroll ${currentTutorialIndex == -1 ? "opacity-50 select-none" : ""}`}
        onPaste={(event) => {
          if (process.env.NODE_ENV === "production") {
            event.preventDefault();
          }
        }}
      />

      {/* Show the popup if required */}
      {showPopup && <TutorialPopup popupText={tutorialSteps[currentTutorialIndex].popupText} anchorEl={anchorEl} />}

      {/* Show the study button once the tutorial steps have been completed */}
      {<div className="flex flex-col items-center mt-4">
        <p className="text-lg mb-2 font-bold text-green-600">
          {currentTutorialIndex == -1 && "Tutorial Completed! Click below."}
        </p>
        <Button onClick={handleTutorialCompletion} disabled={process.env.NODE_ENV === 'development' ? false : currentTutorialIndex != -1 || buttonLoading}>
          Begin Tasks
        </Button>
      </div>}
    </div>
  );
}