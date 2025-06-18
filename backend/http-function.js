 import { processQuery } from 'backend/ragSearch';

 // export function post_getAnswer(request) {
 //   console.log('Received request:', request.body);

 //   const { ownerId, query } = request.body;
 //   const startTime = Date.now();

 //   return processQuery(ownerId, query).then(result => {
 //     const endTime = Date.now();
 //     const timeTaken = (endTime - startTime) / 1000;

 //     console.log('processQuery completed successfully, time taken:', timeTaken, 'seconds');

 //     return {
 //       body: {
 //         ...result,
 //         timeTaken: timeTaken
 //       },
 //       headers: {
 //         'Content-Type': 'application/json',
 //         'Access-Control-Allow-Origin': '*'
 //       }
 //     };
 //   }).catch(error => {
 //     console.error('Error in post_getAnswer:', error);
 //     throw error;
 //   });
 // }

 // export function options_getAnswer(request) {
 //   return {
 //     headers: {
 //       'Access-Control-Allow-Origin': '*',
 //       'Access-Control-Allow-Methods': 'POST, OPTIONS',
 //       'Access-Control-Allow-Headers': 'Content-Type',
 //       'Access-Control-Max-Age': '86400'
 //     }
 //   };
 // }
// backend/http-functions.js
import { ok, badRequest } from 'wix-http-functions';
import { performance } from 'perf_hooks';

export async function post_getAnswer(request) {
  try {
    const body = await request.body.json();
    const { ownerId, query } = body;

    console.log("Received request:", { ownerId, query });

    const startTime = performance.now();
    const result_from_processQuery = await processQuery(ownerId, query); // This returns the "Answer: ... Emotion: ..." string
    const endTime = performance.now();
    const ragTime = endTime - startTime;
    
    console.log("DEBUG_WIX: Result from processQuery (string):", result_from_processQuery);
    console.log("DEBUG_WIX: RagTime:", ragTime);
    // Explicitly create an object with a 'message' key holding the string result,
    // and a 'ragTime' key.
    const responseBody = {
        message: result_from_processQuery, // Assign the string to the 'message' key
        ragTime: ragTime
    };
    // *************************
    
    console.log("DEBUG_WIX: Sending responseBody (JSON):", responseBody);
    return ok({ body: responseBody });
  } catch (e) {
    console.error("Error in getAnswer:", e.message);
    return badRequest({ body: { message: "Invalid input or internal error", error: e.message } });
  }
}
