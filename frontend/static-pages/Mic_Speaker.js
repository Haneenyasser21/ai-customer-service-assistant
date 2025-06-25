import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { mediaManager } from 'wix-media-backend';
import axios from 'axios';
import FormData from 'form-data';
import wixData from 'wix-data';

// Constants
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = 'IES4nrmZdUBHByLBde0P';



//MIC

/**
 * Converts audio to text using ElevenLabs API
 * @param {string} url - URL of the audio file
 * @returns {Promise<Object>} Transcription data
 */
export async function generateTextFromAudio(url) {
    try {
        const apiKey = await getSecret('ELEVENLABS_API_KEY');
        const { data: fileData } = await axios.get(url, { responseType: 'arraybuffer' });
        const formData = new FormData();
        formData.append('file', Buffer.from(fileData), 'testaudio.mp3');
        formData.append('model_id', 'scribe_v1');
        formData.append('tag_audio_events', 'true');
        formData.append('language_code', 'ara');
        formData.append('diarize', 'true');

        const { data } = await axios.post(`${ELEVENLABS_BASE_URL}/speech-to-text`, formData, {
            headers: { 'xi-api-key': apiKey, ...formData.getHeaders() }
        });
        return data;
    } catch (error) {
        console.error('Speech-to-text failed:', error.message);
        throw error;
    }
}





//Speaker

/**
 * Generates audio from text using ElevenLabs API
 * @param {string} input - Text to convert to audio
 * @returns {Promise<Object>} Uploaded audio file details with static URL
 */
export async function generateAudio(input) {
    try {
        const apiKey = await getSecret('ELEVENLABS_API_KEY');
        const body = {
            text: input,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.2, similarity_boost: 0.2 }
        };
        const { data } = await axios.post(`${ELEVENLABS_BASE_URL}/text-to-speech/${DEFAULT_VOICE_ID}`, body, {
            headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer'
        });

        const buffer = Buffer.from(data);
        const fileName = input.slice(0, 20).replace(/ /g, '-') + '.mp3';
        const uploadResult = await uploadToWix(buffer, fileName);
        return { ...uploadResult, fileUrl: convertWixAudioToStaticUrl(uploadResult.fileUrl) };
    } catch (error) {
        console.error('Audio generation failed:', error.message);
        throw error;
    }
}

/**
 * Uploads audio buffer to Wix Media Manager
 * @param {Buffer} buffer - Audio buffer
 * @param {string} fileName - Name for the audio file
 * @returns {Promise<Object>} Uploaded file details
 */
async function uploadToWix(buffer, fileName) {
    return mediaManager.upload('/Uploads/audio', buffer, `${fileName}.mp3`, {
        mediaOptions: { mimeType: 'audio/mpeg', mediaType: 'audio' },
        metadataOptions: { isPrivate: false, isVisitorUpload: false }
    });
}

/**
 * Converts a Wix audio URL to a static Wix URL
 * @param {string} wixUrl - Wix audio URL
 * @returns {string} Static URL
 */
function convertWixAudioToStaticUrl(wixUrl) {
    const match = wixUrl.match(/wix:audio:\/\/v1\/([^\/]+)/);
    if (!match) throw new Error('Invalid Wix audio URL');
    const [prefix, hash] = match[1].split('_');
    if (!prefix || !hash) throw new Error('Invalid identifier in Wix audio URL');
    return `https://static.wixstatic.com/mp3/${prefix}_${hash.replace(/\.mp3$/, '')}.mp3`;
}
