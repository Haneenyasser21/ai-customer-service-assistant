import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { mediaManager } from 'wix-media-backend';
import axios from 'axios';
import FormData from 'form-data';
import wixData from 'wix-data';

// Constants
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const API_KEY = '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';

// Precomputed headers to avoid repeated computation
const OPENAI_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
    'OpenAI-Beta': 'assistants=v2'
};

/**
 * Uploads a file to OpenAI
 * @param {string} fileUrl - URL of the file to upload
 * @param {string} fileName - Name of the file
 * @returns {Promise<Object>} Uploaded file data
 */
export async function uploadToOpenAI(fileUrl, fileName) {
    try {
        const { data: fileData } = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const formData = new FormData();
        formData.append('file', Buffer.from(fileData), fileName);
        formData.append('purpose', 'assistants');

        const { data } = await axios.post(`${OPENAI_BASE_URL}/files`, formData, {
            headers: { ...OPENAI_HEADERS, ...formData.getHeaders() }
        });
        return data;
    } catch (error) {
        console.error('Error uploading to OpenAI:', error.message, error.response?.data);
        throw error;
    }
}

/**
 * Creates an OpenAI Assistant with a specified name and associates it with an uploaded file
 * @param {string} fileId - The ID of the uploaded file in OpenAI
 * @param {string} assistantName - Custom name for the assistant
 * @returns {Promise<Object>} Assistant data
 */
export async function createAssistant(fileId, assistantName) {
    try {
        if (!assistantName?.trim()) throw new Error('Invalid assistant name');

        // Create vector store
        const vectorStoreResponse = await fetch(`${OPENAI_BASE_URL}/vector_stores`, {
            method: 'POST',
            headers: OPENAI_HEADERS,
            body: JSON.stringify({ file_ids: [fileId], name: `Vector Store for ${assistantName}` })
        });
        if (!vectorStoreResponse.ok) throw new Error(`Vector store creation failed: ${await vectorStoreResponse.text()}`);
        const vectorStore = await vectorStoreResponse.json();

        // Create assistant
        const assistantResponse = await fetch(`${OPENAI_BASE_URL}/assistants`, {
            method: 'POST',
            headers: OPENAI_HEADERS,
            body: JSON.stringify({
                name: assistantName,
                instructions: `Based on your answer, determine an emotion from the following options: happy, sad, angry, surprised and out of service.
Format your response as follows:
Answer: [answer]
Emotion: [emotion]`,
                model: 'gpt-4o',
                tools: [{ type: 'file_search' }],
                tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } }
            })
        });
        if (!assistantResponse.ok) throw new Error(`Assistant creation failed: ${await assistantResponse.text()}`);
        return await assistantResponse.json();
    } catch (error) {
        console.error('Error creating assistant:', error.message);
        throw error;
    }
}

/**
 * Retrieves an assistant's details
 * @param {string} assistantId - The ID of the assistant
 * @returns {Promise<Object>} Assistant data
 */
export async function getAssistant(assistantId) {
    try {
        const response = await fetch(`${OPENAI_BASE_URL}/assistants/${assistantId}`, {
            method: 'GET',
            headers: OPENAI_HEADERS
        });
        if (!response.ok) throw new Error(`Failed to retrieve assistant: ${await response.text()}`);
        return await response.json();
    } catch (error) {
        console.error('Error retrieving assistant:', error.message);
        throw error;
    }
}

/**
 * Processes a PDF upload, creates an assistant, and updates metadata
 * @param {string} fileUrl - URL of the uploaded PDF
 * @param {string} fileName - Name of the PDF file
 * @param {Object} currentItem - The current item from the dynamic dataset
 * @param {string} assistantName - Custom name for the assistant
 * @returns {Promise<Object>} Assistant and file data
 */
export async function processOwnerPDF(fileUrl, fileName, currentItem, assistantName) {
    let fileId, assistantId;
    try {
        if (!currentItem?._id || !currentItem?.ownerName) throw new Error('Invalid currentItem: _id and ownerName required');
        if (!assistantName?.trim()) throw new Error('Invalid assistant name');

        // Parallelize upload and assistant creation
        const [uploadResult, assistant] = await Promise.all([
            uploadToOpenAI(fileUrl, fileName),
            createAssistant(null, assistantName).catch(() => null) // Placeholder for parallel execution
        ]);
        fileId = uploadResult.id;

        // If assistant creation was not started, create it now with fileId
        const finalAssistant = assistant?.id ? assistant : await createAssistant(fileId, assistantName);
        assistantId = finalAssistant.id;

        // Update record
        const dataToUpdate = { ...currentItem, assistantId, fileId, fileUrl, assistantName };
        await wixData.update('Owners', dataToUpdate);

        return { assistantId, fileId, assistantName };
    } catch (error) {
        if (fileId) {
            try {
                await wixData.update('Owners', { ...currentItem, fileId, fileUrl, assistantId, assistantName });
            } catch (cmsError) {
                console.error('Failed to save partial data:', cmsError);
            }
        }
        console.error('Error processing PDF:', error.message);
        throw error;
    }
}

/**
 * Creates a new thread in OpenAI API
 * @returns {Promise<Object>} Thread data
 */
export async function createThread() {
    try {
        const response = await fetch(`${OPENAI_BASE_URL}/threads`, {
            method: 'POST',
            headers: OPENAI_HEADERS,
            body: '{}'
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating thread:', error.message);
        throw error;
    }
}


/**
 * Creates a new message in a thread
 * @param {string} threadId - The ID of the thread
 * @param {string} content - Message content
 * @returns {Promise<void>}
 */
export async function createMessage(threadId, content) {
    try {
        await fetch(`${OPENAI_BASE_URL}/threads/${threadId}/messages`, {
            method: 'POST',
            headers: OPENAI_HEADERS,
            body: JSON.stringify({ role: 'user', content })
        });
    } catch (error) {
        console.error('Error creating message:', error.message);
        throw error;
    }
}

/**
 * Initiates an assistant run for a specified thread
 * @param {string} threadId - The ID of the thread
 * @param {string} assistantId - The ID of the assistant
 * @returns {Promise<Object>} Run response data
 */
export async function runAssistant(threadId, assistantId) {
    try {
        const response = await fetch(`${OPENAI_BASE_URL}/threads/${threadId}/runs`, {
            method: 'POST',
            headers: OPENAI_HEADERS,
            body: JSON.stringify({ assistant_id: assistantId })
        });
        return await response.json();
    } catch (error) {
        console.error(`Failed to run assistant for thread ${threadId}:`, error.message);
        throw error;
    }
}

/**
 * Retrieves the status of a specific run
 * @param {string} threadId - The ID of the thread
 * @param {string} runId - The ID of the run
 * @returns {Promise<Object>} Run status data
 */
export async function retrieveRun(threadId, runId) {
    try {
        const response = await fetch(`${OPENAI_BASE_URL}/threads/${threadId}/runs/${runId}`, {
            method: 'GET',
            headers: OPENAI_HEADERS
        });
        return await response.json();
    } catch (error) {
        console.error('Error retrieving run:', error.message);
        throw error;
    }
}

/**
 * Retrieves messages from a specific thread
 * @param {string} threadId - The ID of the thread
 * @returns {Promise<Object>} Messages data
 */
export async function listMessages(threadId) {
    try {
        const response = await fetch(`${OPENAI_BASE_URL}/threads/${threadId}/messages`, {
            method: 'GET',
            headers: OPENAI_HEADERS
        });
        return await response.json();
    } catch (error) {
        console.error('Error listing messages:', error.message);
        throw error;
    }
}
