'use client';

import Button from "./Button";
import { useRouter } from "next/navigation";
import { Event, EventName, Task } from "../_lib/types";
import { useEffect, useRef, useState, SyntheticEvent } from "react";
import AutocompleteTextbox from "./AutocompleteTextbox/AutocompleteTextbox";
import { SuggestionAcceptedInfo, SuggestionInfo, SuggestionRejectedInfo } from "./AutocompleteTextbox/types";
import { logEvents, createEvent } from "../_lib/logging";
import { useUserContext } from "../_context/UserContext";
import { countWordsInHTML } from "../_lib/utils";

interface WritingTaskProps {
  task: Task;
  nextLink: {
    href: string;
    text: string;
  }
};

export default function WritingTask({ task, nextLink }: WritingTaskProps) {
  const [numWords, setNumWords] = useState<number>(0);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [html, setHTML] = useState<string>("");
  const router = useRouter();
  const user = useUserContext();
  const events = useRef<Event[]>([]);
  const taskNumber = user.tasks.findIndex(t => t.id === task.id) + 1;
  const minWords = task.minWords;
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

  useEffect(() => {
    // Count the number of words (little hacky)
    const numWords = countWordsInHTML(html);
    setNumWords(numWords);
  }, [html]);

  const onNextClick = async () => {

    if (numWords < minWords) {
      return;
    }

    setButtonLoading(true); // Disable button to avoid multiple clicks
    // Create task completed event
    user.setTaskAsCompleted(task.id);
    const event = createEvent(EventName.TaskCompleted, {
      taskId: task.id,
      finalHtml: html
    });
    storeEvent(event);

    // Log the remaining events in this task
    if (events.current.length > 0) {
      await logEvents(user.userId, events.current);
    }

    // Redirect to next page
    router.push(nextLink.href);
  };

  const onSuggestionShown = (event: SuggestionInfo) => {
    const eventForLog = createEvent(EventName.SuggestionShown, {
      suggestionId: event.id,
      timestamp: event.timeShown,
      suggestionText: event.suggestionText,
      leadingText: event.leadingText,
      currentHtml: event.getFullHTML()
    });
    storeEvent(eventForLog)
  };

  const onSuggestionAccepted = (event: SuggestionAcceptedInfo) => {
    setSuggestionJustAccepted(true);
    const eventForLog = createEvent(EventName.SuggestionAccepted, {
      suggestionId: event.suggestionId,
      timestamp: event.timeAccepted
    });
    storeEvent(eventForLog)
  };

  const onSuggestionRejected = (event: SuggestionRejectedInfo) => {
    const eventForLog = createEvent(EventName.SuggestionRejected, {
      suggestionId: event.suggestionId,
      timestamp: event.timeRejected,
      reason: event.reason
    });
    storeEvent(eventForLog)
  };

  const handleContentChange = (content: string) => {
    setHTML(content);
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

  const getSuggestion = async (textUptilNow: string, abortSignal?: AbortSignal): Promise<string> => {
    if (suggestionJustAccepted) { // Don't show suggestions immediately after accepting one
      return "";
    }
    try {
      console.log("sending request");
      const startTime = new Date().getTime();
      const response = await fetch('/api/getSuggestion', {
        method: 'POST',
        body: JSON.stringify({ taskId: task.id, textUptilNow }),
        signal: abortSignal
      });
      const suggestion = (await response.json()).suggestion;
      const endTime = new Date().getTime();
      console.log(`Task: "${task.id}"\nText: "${textUptilNow}"\nSuggestion: "${suggestion}"\nTime taken: ${endTime - startTime}ms`);

      return suggestion;
    } catch (err: any) {
      console.log(`${err.name}: ${textUptilNow}`);
      return "";
    }
  };

  return (
    <div className="writing-task-container py-4">
      <h1 className="text-4xl font-bold text-center">
        Writing Task {taskNumber} <br />
      </h1>
      <div className="text-center mb-4 text-red-500">
        Do not refresh the page or hit back, you will loose progress.<br />
        Copy-paste is disabled to encourage original writing.
      </div>
      <div className="mb-4 select-none">
        <h2 className="text-xl font-bold">Instructions</h2>
        <ul className="list-disc pl-4">
          <li>Write an essay on the topic shown in the blue box below.</li>
          <li>Please ensure that your response is at least <b>{minWords} words</b> long.</li>
          {user.showSuggestions &&
            <>
              <li>As you type, you will see suggestions that you can accept or reject.</li>
              <li>To accept a suggestion, press <span className="bg-gray-100 px-2 py-0.5 text-sm rounded-md">TAB</span>. To reject a suggestion, continue typing or press <span className="bg-gray-100 px-2 py-0.5 text-sm rounded-md">ESCAPE</span>.</li>
            </>
          }
          <li>When you are satisfied with your response, click the {"'" + nextLink.text + "'"} button below.</li>
        </ul>
      </div>
      <p className="text-xl p-2 py-4 mb-4 bg-sky-100 select-none">{task.prompt}</p>
      <AutocompleteTextbox
        onSuggestionShown={onSuggestionShown}
        onSuggestionAccepted={onSuggestionAccepted}
        onSuggestionRejected={onSuggestionRejected}
        disableAutocomplete={!user.showSuggestions}
        onContentChange={handleContentChange}
        getSuggestion={getSuggestion}
        debounceTime={100}
        onInput={handleInput}
        disabled={buttonLoading}
        suggestionClassName="suggestion text-slate-400"
        className={`border-2 border-grey outline-none text-black my-2 h-52 p-2 overflow-y-scroll ${buttonLoading ? "opacity-50 select-none" : ""}`}
        onPaste={(event) => {
          if (process.env.NODE_ENV === "production") {
            event.preventDefault();
          }
        }}
      />
      <div className={`text-right ${numWords >= minWords ? "text-green-500" : "text-red-500"}`}>
        {numWords} words
      </div>
      <div className="mt-4 text-center">
        <Button disabled={numWords < minWords || buttonLoading} onClick={onNextClick}>
          {buttonLoading ? "Loading..." : nextLink.text}
        </Button>
      </div>
    </div>
  );
}