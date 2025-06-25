import { mediaManager } from 'wix-media-backend';
import { fetch } from 'wix-fetch';
import axios from 'axios';
import FormData from 'form-data';
import pdfParse from 'pdf-parse';
import https from 'https';

// Download file as buffer
async function getFileAsBuffer(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed with status code: ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer);
            });
        });
        req.on('error', reject);
    });
}

// Extract text from PDF
async function extractTextFromPDF(fileUrl) {
    try {
        console.log('Starting PDF text extraction for:', fileUrl);
        const downloadUrl = await mediaManager.getDownloadUrl(fileUrl);
        const buffer = await getFileAsBuffer(downloadUrl);
        const data = await pdfParse(buffer, { max: 0 });
        const text = data.text || '';
        if (!text.trim().length) {
            throw new Error('No text extracted from PDF');
        }
        console.log('Extracted text length:', text.length);
        // Log first 500 characters of extracted text for debugging
        console.log('Extracted text sample:', text.substring(0, 500));
        return text;
    } catch (err) {
        console.error('PDF text extraction error:', err.message);
        throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
}

// Validate JSONL line
function isValidJsonlLine(line) {
    try {
        const parsed = JSON.parse(line);
        if (!parsed.messages || parsed.messages.length !== 2 ||
            parsed.messages[0].role !== 'user' || parsed.messages[1].role !== 'assistant') {
            return false;
        }
        return true;
    } catch (err) {
        console.error('Invalid JSONL line:', line, 'Error:', err.message);
        return false;
    }
}

async function generateDatasetFromText(text) {
    const apiKey = "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";
    const systemPrompt = `
You are a data generation assistant creating a fine-tuning dataset for a customer service AI. Given raw text from a PDF, generate exactly 10 diverse and informative Q&A pairs. Each question must reflect what a real user might ask about a unique section or detail of the text, and each answer must be concise, complete, and based only on the text. Output Format (one line per pair, JSONL): {"messages":[{"role":"user","content":"QUESTION?"},{"role":"assistant","content":"ANSWER"}]}
Guidelines:
- Generate EXACTLY 10 Q&A pairs per call, no more, no less.
- Ensure each pair addresses a distinct section or detail of the text to maximize diversity and minimize duplicates.
- Phrase questions naturally, as a real customer would ask.
- Answers must be accurate, based strictly on the input text, with no external knowledge or hallucination.
- Output only 10 JSONL lines, no extra text, comments, or formatting.
- If the text is limited, creatively rephrase questions to cover different aspects without overlap.
`;

    const chunkSize = 5000;
    const chunks = [];
    if (text.length <= chunkSize) {
        chunks.push(text);
        console.log('Text under chunk size, processing as single chunk');
    } else {
        const overlapSize = Math.floor(chunkSize / 2);
        for (let i = 0; i < text.length; i += chunkSize - overlapSize) {
            const chunk = text.slice(i, i + chunkSize);
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
        }
        console.log('Text split into', chunks.length, 'chunks with overlap');
    }

    const uniqueEntries = new Set();
    let combinedJsonl = '';
    const targetEntries = 100;
    const maxApiCalls = 30;
    let totalApiCalls = 0;
    let chunkIndex = 0;

    while (uniqueEntries.size < targetEntries && totalApiCalls < maxApiCalls) {
        const chunk = chunks[chunkIndex % chunks.length]; // Cycle through chunks
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
            try {
                totalApiCalls++;
                console.log(`API call ${totalApiCalls} for chunk ${chunkIndex % chunks.length}, attempt ${4 - retries}`);
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: chunk }
                ];

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages,
                        temperature: 0.4,
                        max_tokens: 4096
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('OpenAI API error:', response.status, errorText);
                    throw new Error(`HTTP error ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                const content = data.choices[0].message.content;
                console.log(`API call ${totalApiCalls} returned ${content.split('\n').length} lines`);
                const lines = content.split('\n').filter(line => line.trim());
                let newEntries = 0;
                let duplicates = 0;
                for (const line of lines) {
                    if (isValidJsonlLine(line)) {
                        const parsed = JSON.parse(line);
                        const entryKey = JSON.stringify(parsed);
                        if (!uniqueEntries.has(entryKey)) {
                            uniqueEntries.add(entryKey);
                            combinedJsonl += line + '\n';
                            newEntries++;
                        } else {
                            duplicates++;
                        }
                    }
                }
                console.log(`API call ${totalApiCalls} added ${newEntries} new unique entries, ${duplicates} duplicates (total: ${uniqueEntries.size})`);
                success = true; // Mark as successful to exit retry loop
            } catch (err) {
                retries--;
                console.error(`Retry attempts remaining: ${retries}, Error:`, err.message);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.error('Failed to generate entries for chunk after 3 retries');
                }
            }
        }
        chunkIndex++; // Move to next chunk only after success or all retries exhausted
    }

    if (uniqueEntries.size < targetEntries) {
        console.warn(`Only generated ${uniqueEntries.size} unique entries after ${totalApiCalls} API calls, less than target ${targetEntries}`);
    } else {
        console.log('Generated', uniqueEntries.size, 'unique JSONL entries');
    }

    if (!combinedJsonl.trim()) {
        throw new Error('No valid JSONL entries generated');
    }

    return combinedJsonl;
}


// Upload JSONL to OpenAI
async function uploadJSONLToOpenAI(jsonlText, fileName) {
    const apiKey = "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";
    const buffer = Buffer.from(jsonlText, 'utf8');
    const formData = new FormData();
    formData.append('file', buffer, fileName);
    formData.append('purpose', 'fine-tune');

    try {
        const response = await axios.post('https://api.openai.com/v1/files', formData, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                ...formData.getHeaders()
            }
        });
        console.log('Uploaded JSONL to OpenAI, file ID:', response.data.id);
        return response.data;
    } catch (err) {
        console.error('Upload error:', err.message);
        throw new Error(`Failed to upload JSONL to OpenAI: ${err.message}`);
    }
}

// Initiate fine-tuning job
export async function initiateFineTuneOpenAIModel(fileId) {
    const apiKey = "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";
    const baseUrl = 'https://api.openai.com/v1';

    try {
        console.log('Initiating fine-tuning with file ID:', fileId);
        const response = await fetch(`${baseUrl}/fine_tuning/jobs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                training_file: fileId,
                model: 'gpt-3.5-turbo',
                hyperparameters: {
                    n_epochs: 10
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Fine-tune initiation error:', response.status, errorText);
            throw new Error(`Failed to initiate fine-tuning: ${errorText}`);
        }

        const data = await response.json();
        console.log('Fine-tuning job initiated, job ID:', data.id);
        return { success: true, jobId: data.id };
    } catch (err) {
        console.error('Initiation error:', err.message);
        return { success: false, error: err.message };
    }
}


// Check fine-tuning status
export async function checkFineTuneStatus(jobId) {
    const apiKey = "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";
    const baseUrl = 'https://api.openai.com/v1';

    try {
        console.log('Checking job ID:', jobId);
        const response = await fetch(`${baseUrl}/fine_tuning/jobs/${jobId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Status check error:', response.status, errorText);
            throw new Error(`Failed to check fine-tuning status: ${errorText}`);
        }

        const data = await response.json();
        const status = data.status;
        const fineTunedModelId = data.fine_tuned_model;

        console.log('Fine-tuning status:', status);
        if (status === 'failed') {
            throw new Error(`Fine-tuning failed: ${data.error?.message || 'Unknown error'}`);
        }

        return {
            success: true,
            status: status,
            fineTunedModelId: status === 'succeeded' ? fineTunedModelId : null
        };
    } catch (err) {
        console.error('Status check error:', err.message);
        return { success: false, error: err.message };
    }
}

// Main function to process PDF and initiate fine-tuning
export async function processPdfAndInitiateFineTune(pdfMediaUrl) {
    try {
        const text = await extractTextFromPDF(pdfMediaUrl);
        if (text.length > 50000) {
            throw new Error('Text too large, please reduce PDF size');
        }
        const jsonl = await generateDatasetFromText(text);
        const uploadResult = await uploadJSONLToOpenAI(jsonl, 'fine_tune_dataset.jsonl');
        const fineTuneResult = await initiateFineTuneOpenAIModel(uploadResult.id);
        return fineTuneResult;
    } catch (err) {
        console.error('Error in PDF processing or fine-tuning:', err.message);
        return { success: false, error: err.message };
    }
}

// Chatbot response function
export async function getChatbotResponse(messages) {
    const instructions = `
        You are a customer service assistant. Answer the user's question based on your fine-tuned dataset.
        Your response should be formatted as follows:
        "Answer: [your answer here]
        Emotion: [emotion here]"
    `;
    const systemMessage = {
        role: "system",
        content: instructions,
    };

    messages.unshift(systemMessage);
    return await getChatCompletion(messages);
}

// Get chat completion from fine-tuned model
export async function getChatCompletion(messages) {
    const apiKey = "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";
    const modelId = "ft:gpt-3.5-turbo-0125:aicsr-gp::BkOb7kOG";

    const endpoint = "https://api.openai.com/v1/chat/completions";
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messages,
            model: modelId,
            temperature: 0,
            seed: 1,
        })
    };

    try {
        const response = await fetch(endpoint, options);
        const data = await response.json();
        if (!data.choices || data.choices.length === 0) {
            throw new Error("No response from AI");
        }

        const aiResponse = data.choices[0].message;
        return aiResponse;
    } catch (error) {
        console.error("Error fetching AI response:", error);
        return { answer: "Sorry, I couldn't process your request.", emotion: "Neutral" };
    }
}
