import {
    createThread,
    createMessage,
    runAssistant,
    retrieveRun,
    listMessages
} from 'backend/openaiService';

// Constants
const ASSISTANT_ID = 'asst_TaVkzjrRVjYPi92IJ7UdU2dW';
const POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 60;
let threadId = null;

// Array to store questions and results
const questions = [
    "What’s the name of the restaurant?",
    "What type of cuisine do you serve?",
    "Are your ingredients fresh?",
    "What makes Bazooka special?",
    "Do you have vegan options?",
    "What’s in your Hearty Vegetable Stew?",
    "Tell me about the Quinoa Salad",
    "How’s the Tofu Stir‑Fry prepared?",
    "Are vegan dishes clearly marked?",
    "Do you serve halal food?",
    "What’s your most popular halal dish?",
    "What comes with Lamb Kebabs?",
    "Is the Chickpea Curry spicy?",
    "Do you serve alcohol?",
    "What fresh juices do you offer?",
    "What mocktails would you recommend?",
    "Do you have specialty coffee?",
    "Do you change your menu seasonally?",
    "How often do you introduce new dishes?",
    "What’s your signature dish?",
    "Is this restaurant family‑friendly?",
    "Do you take reservations?",
    "Do you offer takeout?",
    "Is the vegetable stew gluten‑free?",
    "What protein options are available?",
    "Are your vegan and halal options clearly separated?",
    "Can the quinoa salad be made nut‑free?",
    "What’s in the minted yogurt sauce?",
    "How spicy is the chickpea curry normally?",
    "Can you make dishes less spicy?",
    "Do you use peanut oil in cooking?",
    "Is cross‑contamination a concern for allergies?",
    "What are your busiest times?",
    "Do you have high chairs?",
    "Is parking available?",
    "What’s the lightest dish?",
    "What’s the most filling vegan option?",
    "Best dish for someone who likes bold flavors?",
    "How is your chicken prepared?",
    "Are fries cooked separately from meat?",
    "Can vegans and meat‑eaters dine together happily?",
    "Do you have nut‑free options?",
    "Does the menu change based on seasons?",
    "How can guests learn about seasonal dishes?",
    "Is the halal meat certified?",
    "Is the Grilled Chicken dish halal?",
    "Are the mocktails made in‑house?",
    "Can I host a private event here?",
    "Are all vegan dishes free of animal products?",
    "Can dishes be customized?"
];
let results = [];

/**
 * Initializes the page when Wix elements are ready
 */
$w.onReady(async () => {
    try {
        threadId = (await createThread()).id;
        $w('#submitButton').onClick(() => processQuestions());
    } catch (error) {
        console.error('Error initializing page:', error);
        $w('#answertext').text = 'Error loading page';
    }
});

/**
 * Processes all questions sequentially
 */
async function processQuestions() {
    results = []; // Reset results array
    $w('#answertext').text = 'Processing questions...';
    $w('#emotiontext').text = 'working';
    $w('#responseTimeText').text = '';

    try {
        for (const [index, question] of questions.entries()) {
            const result = await sendMessage(question);
            results.push(result);
            $w('#answertext').text = `Processed ${index + 1}/${questions.length} questions`;
        }

        // Display results when done
        displayResults();
    } catch (error) {
        console.error('Error processing questions:', error);
        $w('#answertext').text = 'Error processing questions';
        $w('#emotiontext').text = 'error';
    }
}

/**
 * Processes a single message and returns result
 * @param {string} customerQuery - The question to process
 * @returns {Promise<Object>} Result object with question, answer, and response time
 */
async function sendMessage(customerQuery) {
    const startTime = performance.now();
    
    if (!customerQuery) {
        return {
            question: 'N/A',
            answer: 'No query provided',
            responseTimeSec: 0
        };
    }

    try {
        await createMessage(threadId, customerQuery);
        const status = await createAndPollRun(threadId, ASSISTANT_ID);

        let answer = 'There is a problem, please ask your question again.';

        if (status === 'completed') {
            const { data: [ { content: [{ text: { value: aiMessage } }] } ] } = await listMessages(threadId);
            const answerMatch = aiMessage.match(/Answer:\s*(.*)/i);
            answer = answerMatch ? answerMatch[1] : aiMessage || answer;
        }

        const responseTimeSec = ((performance.now() - startTime) / 1000).toFixed(2);
        return {
            question: customerQuery,
            answer,
            responseTimeSec
        };
    } catch (error) {
        console.error('Error processing message:', error);
        return {
            question: customerQuery,
            answer: 'Error processing query',
            responseTimeSec: ((performance.now() - startTime) / 1000).toFixed(2)
        };
    }
}

/**
 * Creates an assistant run and polls for completion
 * @returns {Promise<string>} Final status of the run
 */
async function createAndPollRun(threadId, assistantId) {
    try {
        const { id: runId, status: initialStatus } = await runAssistant(threadId, assistantId);
        if (initialStatus === 'completed') return initialStatus;

        for (let attempts = 0; attempts < MAX_ATTEMPTS; attempts++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            const { status } = await retrieveRun(threadId, runId);
            if (status === 'completed' || status === 'failed') return status;
        }
        return 'timeout';
    } catch (error) {
        console.error('Error polling run:', error);
        return 'failed';
    }
}

/**
 * Displays the results in the UI
 */
function displayResults() {
    const resultText = results.map((result, index) => 
        `Q${index + 1}: ${result.question}\n` +
        `Answer: ${result.answer}\n` +
        `Response Time: ${result.responseTimeSec}s\n`
    ).join('\n---\n');

    // Calculate average response time
    const avgResponseTime = results.length > 0
        ? (results.reduce((sum, result) => sum + parseFloat(result.responseTimeSec), 0) / results.length).toFixed(2)
        : 0;

    $w('#answertext').text = resultText || 'No results to display';
    $w('#emotiontext').text = 'completed';
    $w('#responseTimeText').text = `Processed ${results.length} questions\nAverage Response Time: ${avgResponseTime}s`;
}
