// import { createClient, getSuggestionfromOpenAI } from '../utils';

// const client = createClient();

import { getSuggestionFromKrutrim } from '../utils';

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.log("SyntaxError (likely due to abort):", e);
      return Response.json({ suggestion: "" });
    }
  }

  const { taskId, textUptilNow } = body;

  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

  try {
    const suggestion = await getSuggestionFromKrutrim(taskId, textUptilNow);
    return Response.json({ suggestion });
  } catch (e) {
    console.log("Error from Krutrim:", e);
    return Response.json({ suggestion: "" });
  }
}


// export async function POST(request: Request) {
//   try {
//     var body = await request.json();
//   } catch (e) {
//     if (e instanceof SyntaxError) {
//       console.log("SyntaxError (likely due to abort):", e);
//       return Response.json({ suggestion: "" });
//     }
//   }

//   const taskId = body.taskId;
//   const textUptilNow = body.textUptilNow;

//   await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
//   const suggestion = "suggestion";
//   return Response.json({ suggestion: suggestion });

//   // try {
//   //   const suggestion = await getSuggestionfromOpenAI(client, taskId, textUptilNow);
//   //   return Response.json({ suggestion: suggestion });
//   // } catch (e) {
//   //   console.log("Error (likely due to misformed JSON from OpenAI):", e);
//   //   return Response.json({ suggestion: "" });
//   // }
// };