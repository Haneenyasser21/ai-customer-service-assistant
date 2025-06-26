import wixLocation from 'wix-location';
import wixData from 'wix-data';
import { session } from 'wix-storage';
import { processQuery } from 'backend/ragSearch';
import { generateAudio, generateTextFromAudio } from 'backend/openaiService';
import { processImageQueryNoOCR, processHybridQuery } from 'backend/imageProcessor';
import { uploadTemporaryImage } from 'backend/uploadHandler';
import { getDownloadUrl } from 'backend/media.jsw';
import { uploadAndProcessPDF } from 'backend/ragSearch';

// ============================================================================
// Global Variables
// ============================================================================
let ownerId; // Enforce as number globally

// ============================================================================
// Page Setup and Initialization
// ============================================================================
$w.onReady(async function () {
    try {
        // Extract and validate ownerId from URL
        const path = wixLocation.path;
        const rawId = decodeURIComponent(path[path.length - 1]);
        console.log('Extracted Raw Owner ID:', rawId, 'Full URL Path:', path, 'Current URL:', wixLocation.url);

        const numericId = Number(rawId);
        if (isNaN(numericId) || !rawId || rawId === 'undefined') {
            throw new Error('Invalid or missing ownerId in URL');
        }
        ownerId = numericId; // Set as number
        console.log('Validated Owner ID:', ownerId, 'Type:', typeof ownerId);

        // Verify owner exists
        const ownerQuery = await wixData.query('Owners').eq('id', ownerId).find(); // Pass as number
        if (ownerQuery.items.length === 0) {
            throw new Error(`Owner not found for ID: ${ownerId}`);
        }
        const { subscriptionBundle = 'unknown' } = ownerQuery.items[0];

        // Initialize UI elements
        $w('#text1').text = ownerId.toString(); // Display as string for UI, explicit toString
        $w('#aicontent').hide();
        $w('#text1').hide();
        $w('#text2').hide();

        // Validate required buttons
        if (!$w('#OrderNow') || !$w('#Reservation') || !$w('#imageUpload') || !$w('#sendtButton')) {
            console.error('Required buttons not found (#OrderNow, #Reservation, #imageUpload, #sendtButton)');
            $w('#text2').text = 'UI setup error. Please contact support.';
            return;
        }

        // Configure UI based on subscription
        if (subscriptionBundle === 'premium') {
            $w('#OrderNow').show();
            $w('#Reservation').show();
            $w('#imageUpload').show();
            $w('#sendtButton').show();
        } else if (subscriptionBundle === 'standard') {
            $w('#OrderNow').show();
            $w('#Reservation').hide();
            $w('#imageUpload').show();
            $w('#sendtButton').show();
        } else if (subscriptionBundle === 'basic') {
            $w('#OrderNow').hide();
            $w('#Reservation').hide();
            $w('#imageUpload').show();
            $w('#sendtButton').show();
        } else if (subscriptionBundle === '3dReservations') {
            $w('#OrderNow').hide();
            $w('#Reservation').show();
            $w('#imageUpload').show();
            $w('#sendtButton').show();
        } else {
            $w('#OrderNow').hide();
            $w('#Reservation').hide();
            $w('#imageUpload').hide();
            $w('#sendtButton').show();
            $w('#sendtButton').onClick(() => {
                $w('#messageText').text = 'Owner not subscribed yet, please contact support.';
                $w('#messageText').show();
                setTimeout(() => $w('#messageText').hide(), 5000);
            });
        }

        // Attach event handlers
        $w('#sendtButton').onClick(() => handleUserQuery());
        $w('#toggleDetailsButton').onClick(() => {
            const isHidden = $w('#aicontent').hidden;
            $w('#aicontent')[isHidden ? 'show' : 'hide']();
            $w('#text1')[isHidden ? 'show' : 'hide']();
            $w('#text2')[isHidden ? 'show' : 'hide']();
            $w('#toggleDetailsButton').label = isHidden ? 'Hide Details' : 'Show Details';
        });
        $w('#OrderNow').onClick(() => wixLocation.to(`/customed-ordering/${ownerId}`)); // Pass as number in URL
        $w('#Reservation').onClick(() => wixLocation.to(`/slots/${ownerId}`)); // Pass as number in URL

        // Initialize audio recorder
        setupAudioRecorder();
    } catch (error) {
        console.error('Page setup error:', error.message);
        $w('#text1').text = 'Error loading page';
        $w('#text2').text = 'Please try again later';
    }
});

// ============================================================================
// Audio Recorder Setup
// ============================================================================
function setupAudioRecorder() {
    $w('#audioRecorder1').onSave(async (event) => {
        const audioUrl = event.data.url;
        console.log('Audio saved:', audioUrl);

        try {
            $w('#text2').text = 'Transcribing audio...';
            const transcriptionData = await generateTextFromAudio(audioUrl);
            const transcript = transcriptionData?.text?.trim() || '';
            console.log('Transcription:', transcript);

            if (!transcript) {
                $w('#text2').text = 'No speech detected.';
                return;
            }

            $w('#aicontent').text = transcript;
            await handleUserQuery(transcript);
        } catch (error) {
            console.error('Transcription error:', { message: error.message, stack: error.stack });
            $w('#text2').text = 'Error transcribing audio.';
        }
    });
}

// ============================================================================
// Query Handling
// ============================================================================
/**
 * Handles user queries (text, audio, image, or hybrid).
 * @param {string|null} voiceQuery - Optional voice transcript.
 * @returns {Promise<void>}
 */
async function handleUserQuery(voiceQuery = null) {
    const query = voiceQuery?.trim() || $w('#userInput').value?.trim() || '';
    const files = $w('#imageUpload').value || [];
    const queryString = query.toLowerCase();
    console.log('handleUserQuery ownerId:', ownerId, 'Type:', typeof ownerId); // Debug type

    if (!queryString && files.length === 0) {
        $w('#text2').text = 'Please enter a question, speak, or upload an image.';
        return;
    }

    $w('#text2').text = 'Processing...';

    try {
        let aiMessage;
        const startTime = performance.now();

        if (files.length > 0) {
            const uploadResults = await $w('#imageUpload').uploadFiles();
            if (!uploadResults[0]?.fileUrl) {
                throw new Error('File upload failed');
            }
            const fileUrl = uploadResults[0].fileUrl;
            const imageDownloadUrl = await getDownloadUrl(fileUrl);
            await uploadTemporaryImage(fileUrl);

            const pdfResult = await uploadAndProcessPDF(fileUrl, ownerId); // Pass number
            console.log('PDF processing result:', pdfResult);

            aiMessage = queryString
                ? await processHybridQuery(queryString, imageDownloadUrl, ownerId) // Pass number
                : await processImageQueryNoOCR({ queryString: '', imageDownloadUrl });
        } else {
            console.log('Calling processQuery with ownerId:', ownerId, 'query:', queryString);
            aiMessage = await processQuery(ownerId, queryString); // Pass number
        }

        const endTime = performance.now();
        console.log(`Operation took ${(endTime - startTime).toFixed(2)} milliseconds`);

        let message, orderId;
        if (typeof aiMessage === 'string') {
            message = aiMessage;
            orderId = null;
        } else if (aiMessage && typeof aiMessage === 'object') {
            message = aiMessage.message || 'No answer provided';
            orderId = aiMessage.orderId || null;
        } else {
            throw new Error('Invalid response from query processor');
        }

        let answer = message;
        let emotion = 'neutral';
        if (typeof message === 'string') {
            const answerMatch = message.match(/Answer:\s*(.*?)\s*Emotion:/is);
            const emotionMatch = message.match(/Emotion:\s*(.*)/i);
            answer = answerMatch?.[1]?.trim() || message;
            emotion = emotionMatch?.[1]?.trim() || 'neutral';

            if (!emotionMatch) {
                if (answer.toLowerCase().includes('no') || answer.toLowerCase().includes('not')) {
                    emotion = 'sad';
                } else if (answer.toLowerCase().includes('yes')) {
                    emotion = 'happy';
                }
            }
        }

        $w('#text2').text = answer;
        $w('#text1').text = `Emotion: ${emotion} (Owner ID: ${ownerId})`; // Display as number
        $w('#aicontent').text = queryString ? query : 'Processed';

        const generatedAudioData = await generateAudio(answer);
        if (!generatedAudioData?.fileUrl) {
            throw new Error('Audio generation failed');
        }
        const audioURL = generatedAudioData.fileUrl;
        Update3DModel(audioURL, emotion);

        const isAvailabilityQuery = ['do you have', 'is there', 'are there'].some(keyword =>
            queryString.includes(keyword)
        );
        if (isAvailabilityQuery) {
            console.log('Availability query detected, skipping order intent.');
        } else if (orderId) {
            await handleOrderIntent(queryString, ownerId, orderId, answer); // Pass number
        }
    } catch (error) {
        console.error('Processing error:', { message: error.message, stack: error.stack });
        $w('#text2').text = `Error: ${error.message || 'Something went wrong. Please try again.'}`;
    }
}

// ============================================================================
// Order Handling
// ============================================================================
/**
 * Handles order intent by adding items to the cart and navigating to the order page.
 * @param {string} queryString - The user's query.
 * @param {number} ownerId - The owner ID (number).
 * @param {string} orderId - The order ID from backend.
 * @param {string} answer - The backend response answer.
 * @returns {Promise<void>}
 */
/**
 * Removes Arabic diacritics from a string.
 * @param {string} text
 * @returns {string}
 */
function removeArabicDiacritics(text) {
  return text.normalize('NFKD').replace(/[\u064B-\u0652]/g, '');
}

/**
 * Handles order intent by adding items to the cart and navigating to the order page.
 * @param {string} queryString - The user's query.
 * @param {number} ownerId - The owner ID (number).
 * @param {string} orderId - The order ID from backend.
 * @param {string} answer - The backend response answer.
 * @returns {Promise<void>}
 */
async function handleOrderIntent(queryString, ownerId, orderId, answer) {
  console.log('handleOrderIntent ownerId:', ownerId, 'Type:', typeof ownerId);

  const orderKeywords = ['order', 'عايز', 'هات', 'أطلب', 'اطلب', 'i want', 'bring', 'اوردر'];
  const isOrderIntent = orderKeywords.some(keyword =>
    queryString.includes(keyword.toLowerCase().replace(/\./g, ''))
  );

  if (!isOrderIntent || !orderId) {
    console.log('No order intent or missing orderId:', { isOrderIntent, orderId });
    return;
  }

  let itemName = 'Unknown';
  for (const keyword of orderKeywords) {
    const regex = new RegExp(`(${keyword})\\s+(.+)`, 'i');
    const match = queryString.match(regex);
    if (match?.[2]) {
      itemName = match[2].trim().split(' ')[0].replace(/\./g, '');
      console.log('Matched item name:', itemName);
      break;
    }
  }

  const cleanedItemName = removeArabicDiacritics(itemName).toLowerCase();

  try {
    const menuQuery = await wixData.query('MenuItems')
      .eq('ownerId', ownerId)
      .find();

    const filteredMatches = menuQuery.items.filter(item => {
      const ar = removeArabicDiacritics(item.itemName_ar || '').toLowerCase();
      const en = (item.name || '').toLowerCase();
      return ar === cleanedItemName || en === cleanedItemName;
    });

    if (filteredMatches.length === 0) {
      console.warn('No exact match found:', cleanedItemName);
      $w('#text2').text = `Answer: Sorry, we couldn't match ${itemName} exactly\nEmotion: sad`;
      return;
    }

    if (filteredMatches.length > 1) {
      console.warn('Multiple matches found:', filteredMatches);
      $w('#text2').text = `Answer: Multiple matches found for ${itemName}, please clarify\nEmotion: sad`;
      return;
    }

    const finalItem = filteredMatches[0];
    const finalItemName = finalItem.name || finalItem.itemName_ar;
    const finalPrice = finalItem.price || 5.00;

    // Update cart
    let cart = JSON.parse(session.getItem('cartData') || '[]');
    const cartItem = {
      name: finalItemName,
      price: finalPrice,
      quantity: 1,
      total: finalPrice,
      ownerId
    };
    cart.push(cartItem);
    session.setItem('cartData', JSON.stringify(cart));

    // Save pending order
    session.setItem('pendingOrder', JSON.stringify({
      name: finalItemName,
      quantity: 1,
      ownerId
    }));

    // Display answer
    $w('#text2').text = `${answer}\nAdded: 1 x ${finalItemName} to cart. Order saved.`;
    console.log('UI updated:', $w('#text2').text);

    // Redirect after short delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    const navigationUrl = `/customed-ordering/${ownerId}`;
    console.log('Redirecting to:', navigationUrl);
    wixLocation.to(navigationUrl);
  } catch (error) {
    console.error('Order handling error:', error.message);
    $w('#text2').text = `Answer: Error processing order for ${itemName}\nEmotion: sad`;
  }
}

// ============================================================================
// 3D Model Updates
// ============================================================================
/**
 * Sends audio URL and emotion to the 3D model iframe.
 * @param {string} audioURL - The audio file URL.
 * @param {string} emotion - The detected emotion.
 */
function Update3DModel(audioURL, emotion) {
    const iframe = $w('#html4');
    iframe.postMessage({ emotion, audioUrl: audioURL });
}
