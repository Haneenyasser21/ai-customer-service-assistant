import { getChatbotResponse } from 'backend/pdfToFineTune';

// Constants
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
    "How is your grilled chicken prepared?",
    "Are fries cooked separately from meat?",
    "Can vegans and meat‑eaters dine here happily?",
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
let messages = [];
let results = [];

/**
 * Initializes the page when Wix elements are ready
 */
$w.onReady(function () {
    try {
        $w("#sendtButton").onClick(processQuestions);
    } catch (error) {
        console.error('Error initializing page:', error);
        $w("#text2").text = 'Error loading page';
        $w("#text1").text = 'error';
    }
});

/**
 * Processes all questions sequentially
 */
async function processQuestions() {
    results = []; // Reset results array
    messages = []; // Reset messages
    $w("#text2").text = 'Processing questions...';
    $w("#text1").text = 'working';
    $w("#responseTimeText").text = '';

    try {
        for (const [index, question] of questions.entries()) {
            const result = await sendMessage(question);
            results.push(result);
            $w("#text2").text = `Processed ${index + 1}/${questions.length} questions`;
        }

        // Display results when done
        displayResults();
    } catch (error) {
        console.error('Error processing questions:', error);
        $w("#text2").text = 'Error processing questions';
        $w("#text1").text = 'Error';
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
            responseTimeSec: '0.00'
        };
    }

    try {
        const message = {
            role: "user",
            content: customerQuery,
        };
        messages.push(message);

        // Get chatbot response
        const chatbotResponse = await getChatbotResponse(messages);
        messages.push(chatbotResponse);

        // Extract Answer & Emotion
        const answerMatch = chatbotResponse.content.match(/Answer:\s*(.*)/i);
        const answer = answerMatch ? answerMatch[1] : "No answer provided.";

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
        : '0.00';

    $w("#text2").text = resultText || 'No results to display';
    $w("#text1").text = 'Completed';
    $w("#responseTimeText").text = `Processed ${results.length} questions\nAverage Response Time: ${avgResponseTime}s`;
}



//wix:document://v1/409971_d974bb7405d24d468d68e8d3b46b5810.pdf/Test_2.pdf
