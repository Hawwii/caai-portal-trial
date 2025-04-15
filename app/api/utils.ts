// import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { tasks, TUTORIAL_TASK, TUTORIAL_TASK_ID } from "../_lib/tasks";

/**
 * Generates a system prompt for an autocomplete assistant.
 * 
 * @param {string} taskPrompt - The topic the user is writing about.
 * @returns {string} - The generated system prompt.
 */
function systemPrompt(taskPrompt: string) {
  let prompt = `You are an AI autocomplete assistant. You need to provide short autocomplete suggestions to help people with writing. Some guidelines:\n\
- Your suggestion should make sense inline (it will be shown to the user as ghost text).\n\
- If the user has just completed a word, add a space before the suggestion.\n\
- Suggestions should be <=10 words\n\
- The user is writing about the topic: \"${taskPrompt}\"\n\
- Output a JSON of the following format: {"suggestion": "<your suggestion here>"}`;

  return prompt;
};

const isPunctuation = (char: string): boolean => /[.,!?]/.test(char);

const fixSuggestionPunctuation = (textUptilNow: string, suggestion: string): string => {
  // Since the model is not being able to handle punctions properly, let's do the basic ones manually

  const original = suggestion;

  let lastOfText = textUptilNow.slice(-1);
  let firstOfSuggestion = suggestion.charAt(0);

  if (isPunctuation(lastOfText) && isPunctuation(firstOfSuggestion)) {
    suggestion = suggestion.slice(1);
    firstOfSuggestion = suggestion.charAt(0);
  }
  if (isPunctuation(lastOfText) && firstOfSuggestion !== " ") {
    suggestion = " " + suggestion;
    firstOfSuggestion = suggestion.charAt(0);
  }
  if (lastOfText === " " && firstOfSuggestion === " ") {
    suggestion = suggestion.slice(1);
    firstOfSuggestion = suggestion.charAt(0);
  }

  if (suggestion !== original) {
    console.log(`Fixed punctuation: "${original}" -> "${suggestion}"`);
  }

  return suggestion;
};

// export const createClient = (): OpenAIClient => {
//   // Load the environment variables
//   const URL = process.env["AZURE_OPENAI_API_URL"];
//   const KEY = process.env["AZURE_OPENAI_API_KEY"];

//   if (!URL || !KEY) {
//     throw new Error("Missing environment variables");
//   }

//   // Create the OpenAI client
//   const client = new OpenAIClient(URL, new AzureKeyCredential(KEY));

//   return client;
// }

export const getSuggestionFromKrutrim = async (
  taskId: string,
  textUptilNow: string
): Promise<string> => {
  const MAX_TOKENS = 128;
  const TEMPERATURE = 0.7;

  const KRUTRIM_API_KEY = process.env["KRUTRIM_API_KEY"];
  const KRUTRIM_API_URL = process.env["KRUTRIM_API_URL"] || "https://api.krutrim.com/v1/completions";

  let taskPrompt;
  if (taskId === TUTORIAL_TASK_ID) {
    taskPrompt = TUTORIAL_TASK;
  } else {
    taskPrompt = tasks.find(task => task.id === taskId)?.prompt;
  }

  if (!taskPrompt) {
    throw new Error("Task not found");
  }

  const fullPrompt = `${systemPrompt(taskPrompt)}\n\n${textUptilNow}`;

  const response = await fetch(KRUTRIM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${KRUTRIM_API_KEY || "fake-key"}`
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE
    }),
  });

  const data = await response.json();
  if (!data || !data.choices || !data.choices[0] || !data.choices[0].text) {
    throw new Error("No completion returned from Krutrim");
  }

  let suggestion = JSON.parse(data.choices[0].text)['suggestion'];
  suggestion = fixSuggestionPunctuation(textUptilNow, suggestion);

  return suggestion;
};


// export const getSuggestionfromOpenAI = async (
//   client: OpenAIClient,
//   taskId: string,
//   textUptilNow: string
// ): Promise<string> => {

//   // Constants
//   const MAX_TOKENS = 128;
//   const TEMPERATURE = 0.7;
//   const DEPLOYMENT_ID = process.env["AZURE_DEPLOYMENT_ID"];
//   if (!DEPLOYMENT_ID) throw new Error("Missing AZURE_DEPLOYMENT_ID");

//   let taskPrompt;
//   if (taskId === TUTORIAL_TASK_ID) {
//     taskPrompt = TUTORIAL_TASK;
//   } else {
//     taskPrompt = tasks.find(task => task.id === taskId)?.prompt;
//   }
//   console.log(`Task prompt: "${taskPrompt}"`);
//   console.log(`Leading text: "${textUptilNow}"`);
//   if (!taskPrompt) {
//     throw new Error("Task not found");
//   }

//   const result = await client.getChatCompletions(
//     DEPLOYMENT_ID,
//     [
//       { role: "system", content: systemPrompt(taskPrompt) },
//       { role: "user", content: textUptilNow }
//     ],
//     { maxTokens: MAX_TOKENS, temperature: TEMPERATURE }
//   );

//   if (!result || !result.choices || result.choices.length === 0 || !result.choices[0].message) {
//     throw new Error("No completion returned");
//   }

//   const completion = result.choices[0].message.content!;
//   console.log(`Raw completion: "${completion}"`);
//   let suggestion = JSON.parse(completion)['suggestion'];
//   suggestion = fixSuggestionPunctuation(textUptilNow, suggestion);

//   console.log(`Completion: "${suggestion}"`);
//   return suggestion;
// };