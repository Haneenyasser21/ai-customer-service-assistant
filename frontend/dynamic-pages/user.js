import wixLocation from 'wix-location';
import wixData from 'wix-data';
import { session } from 'wix-storage';
import { processQuery } from 'backend/ragSearch';
import { generateAudio, generateTextFromAudio } from 'backend/openaiService';
import { processImageQueryNoOCR, processHybridQuery } from 'backend/imageProcessor';
import { uploadTemporaryImage } from 'backend/uploadHandler';
import { getDownloadUrl } from 'backend/media.jsw';
import { uploadAndProcessPDF } from 'backend/GenerateEmbeddings2';        

//import { processQuery } from 'backend/ragSearch';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Global Variable
let ID;

// SECTION 1: On Page Ready – Setup, Extract ID, Set Up Handlers
$w.onReady(async function () {
    try {
        const path = wixLocation.path;
        ID = path[path.length - 1]; // Simplified for consistency
        console.log("Extracted Owner ID:", ID, "Full URL Path:", path, "Current URL:", wixLocation.url);
        $w("#text1").text = ID || "ID not found";
        // Hide text elements by default
        $w('#aicontent').hide();
        $w('#text1').hide();
        $w('#text2').hide();
        $w("#sendtButton").onClick(handleUserQuery); // Corrected button ID
        $w("#toggleDetailsButton").onClick(() => {
            const currentlyHidden = $w('#aicontent').hidden;
            if (currentlyHidden) {
                $w('#aicontent').show();
                $w('#text1').show();
                $w('#text2').show();
                $w("#toggleDetailsButton").label = "Hide Details";
            } else {
                $w('#aicontent').hide();
                $w('#text1').hide();
                $w('#text2').hide();
                $w("#toggleDetailsButton").label = "Show Details";
            }
        });
        setupAudioRecorder();
    } catch (error) {
        console.error("Error extracting ID from URL:", error);
        $w("#text1").text = "Error loading ID";
    }
});

// SECTION 2: Audio Recorder Setup and Transcription
function setupAudioRecorder() {
    $w("#audioRecorder1").onSave(async (event) => {
        const audioUrl = event.data.url;
        console.log("Audio saved:", audioUrl);

        try {
            $w("#text2").text = "Transcribing audio...";
            const transcriptionData = await generateTextFromAudio(audioUrl);
            console.log("Transcription data:", transcriptionData);
            const transcript = transcriptionData.text || "";
            console.log("Extracted transcript:", transcript);

            if (!transcript) {
                $w("#text2").text = "No speech detected.";
                return;
            }

            await handleUserQuery(transcript);
        } catch (error) {
            console.error("Transcription error - Details:", { message: error.message, stack: error.stack });
            $w("#text2").text = "Error transcribing audio.";
        }
    });
}


// SECTION 3: Core Query Handling (Text, Audio, Image, Hybrid) - Updated
async function handleUserQuery(voiceQuery = null) {
    const query = (voiceQuery && typeof voiceQuery === 'string') ? voiceQuery : ($w("#userInput").value || '');
    const files = $w('#imageUpload').value;
    const queryString = String(query).toLowerCase().trim();
    const ownerIdNum = Number(ID);

    if (!queryString && files.length === 0) {
        $w("#text2").text = "Please enter a question, speak, or upload an image.";
        return;
    }

    $w("#text2").text = "Processing...";

    try {
        let aiMessage;
        const startTime = performance.now();

        if (files.length > 0 && queryString) {
            const uploadResults = await $w('#imageUpload').uploadFiles();
            const fileUrl = uploadResults[0].fileUrl;
            const imageDownloadUrl = await getDownloadUrl(fileUrl);
            await uploadTemporaryImage(fileUrl);

            // Process PDF and update MenuItems
            const pdfResult = await uploadAndProcessPDF(fileUrl, ownerIdNum);
            console.log("PDF processing result:", pdfResult);

            aiMessage = await processHybridQuery(queryString, imageDownloadUrl, ownerIdNum);
        } else if (files.length > 0) {
            const uploadResults = await $w('#imageUpload').uploadFiles();
            const fileUrl = uploadResults[0].fileUrl;
            const imageDownloadUrl = await getDownloadUrl(fileUrl);
            await uploadTemporaryImage(fileUrl);

            // Process PDF and update MenuItems
            const pdfResult = await uploadAndProcessPDF(fileUrl, ownerIdNum);
            console.log("PDF processing result:", pdfResult);

            aiMessage = await processImageQueryNoOCR({ queryString: "", imageDownloadUrl });
        } else {
            console.log("Calling processQuery with ownerId:", ownerIdNum, "query:", queryString);
            aiMessage = await processQuery(ownerIdNum, queryString);
            console.log("processQuery response:", aiMessage);
        }
        const endTime = performance.now();
        const ragTime = endTime - startTime;
        console.log(`Operation took ${ragTime} milliseconds`);

        console.log("AI Message received - Full:", aiMessage);

        // Updated: Parse the single-language response
        const answerMatch = aiMessage.message.match(/Answer:\s*(.*?)\s*Emotion:/is);
        const emotionMatch = aiMessage.message.match(/Emotion:\s*(.*)/i);

        // Detect query language (similar to backend logic)
        const isArabic = /[\u0600-\u06FF]/.test(query);
        const answer = answerMatch?.[1]?.trim() || (isArabic ? "لم يتم توفير إجابة." : "No answer provided.");
        let emotion = emotionMatch?.[1]?.trim() || "neutral";

        // Adjust emotion based on availability context
        if (!emotionMatch) {
            emotion = "neutral";
            if (answer.toLowerCase().includes("no") || answer.toLowerCase().includes("not")) {
                emotion = "sad";
            } else if (answer.toLowerCase().includes("yes")) {
                emotion = "happy";
            }
        }

        const orderId = aiMessage.orderId;

        // Update text elements with the single-language answer
        $w("#text2").text = answer; // Display only the answer in the query's language
        $w("#text1").text = `Emotion: ${emotion} (Owner ID: ${ownerIdNum})`;
        $w('#aicontent').text = "audio ready";

        const generatedAudioData = await generateAudio(answer); // Use the correct answer for audio
        const audioURL = generatedAudioData.fileUrl;
        Update3DModel(audioURL, emotion);

        // Check for availability query and skip order intent
        const isAvailabilityQuery = ['do you have', 'is there', 'are there'].some(keyword => queryString.includes(keyword));
        if (isAvailabilityQuery) {
            console.log("Availability query detected, skipping order intent.");
        } else if (orderId) {
            await handleOrderIntent(queryString, ownerIdNum, orderId, answer, answer); // Pass answer as both Arabic and English for consistency
        }
    } catch (err) {
        console.error("Processing Error - Details:", { message: err.message, stack: err.stack });
        $w("#text2").text = `Error: ${err.message}`;
    }
}

// SECTION 4: Order Handling Based on Query
async function handleOrderIntent(queryString, ownerIdNum, orderId, arabicAnswer, englishAnswer) {
    console.log("Handling order intent with query:", queryString, "ownerId:", ownerIdNum, "orderId:", orderId);

    const isOrderIntent = ['order', 'عايز', 'هات', 'أطلب', 'اطلب', 'i want', 'bring','اوردر']
        .some(keyword => queryString.includes(keyword.toLowerCase().replace(/\./g, '')));

    if (!isOrderIntent || !orderId) {
        console.log("No order intent or missing orderId, exiting:", { isOrderIntent, orderId });
        return;
    }

    let itemName = "Unknown";
    const orderKeywords = ['عايز', 'هات', 'أطلب', 'اطلب', 'order', 'i want', 'bring','اوردر'];
    for (const kw of orderKeywords) {
        const regex = new RegExp(`(${kw})\\s+(.+)`, 'i');
        const match = queryString.match(regex);
        if (match && match[2]) {
            itemName = match[2].trim().split(' ')[0].replace(/\./g, '');
            console.log("Matched item name:", itemName);
            break;
        }
    }

    // Handle ownerId as both number and string to match database schema
    const ownerIdStr = String(ownerIdNum); // For text-based ownerId
    const ownerIdNumVal = Number(ownerIdNum); // For number-based ownerId
    console.log("Querying MenuItems with ownerId (string):", ownerIdStr, "and (number):", ownerIdNumVal, "for item:", itemName);

    // Query with both string and number ownerId matches
    let menuItem = await wixData.query('MenuItems')
        .eq('ownerId', ownerIdStr) // Match as string
        .or(wixData.query('MenuItems').eq('ownerId', ownerIdNumVal)) // Match as number
        .contains('itemName_ar', itemName.toLowerCase())
        .or(wixData.query('MenuItems')
            .eq('ownerId', ownerIdStr)
            .or(wixData.query('MenuItems').eq('ownerId', ownerIdNumVal))
            .contains('name', itemName.toLowerCase()))
        .find();

    console.log("Menu item query result:", menuItem);

    if (menuItem.items.length === 0) {
        console.warn("Menu item not found or not available for this owner:", itemName);
        $w("#text2").text = `Arabic: آسف، لا يوجد لدينا هذا العنصر\nEnglish: Sorry, we don't have this item\nEmotion: sad`;
        return;
    }

    const finalItem = menuItem.items[0];
    const finalItemName = finalItem.name || finalItem.itemName_ar;
    const finalPrice = finalItem.price || 5.00;

    // Use existing session cart
    let cart = JSON.parse(session.getItem("cartData") || "[]");
    const cartItem = {
        name: finalItemName,
        price: finalPrice,
        quantity: 1,
        total: finalPrice,
        ownerId: ownerIdNum // Use original value, which can be number or string
    };
    cart.push(cartItem);
    session.setItem("cartData", JSON.stringify(cart));

    // Set pending order for customed-ordering.js
    session.setItem("pendingOrder", JSON.stringify({
        name: finalItemName,
        quantity: 1,
        ownerId: ownerIdNum // Use original value, which can be number or string
    }));

    
    $w("#text2").text = `Arabic: ${arabicAnswer}\nEnglish: ${englishAnswer}\nAdded: 1 x ${finalItemName} to cart. Order saved.`;

    const navigationUrl = `/customed-ordering/${ownerIdNum}`;
    console.log("Redirecting to:", navigationUrl);
    wixLocation.to(navigationUrl);
}

// SECTION 6: Send Data to 3D Model (Iframe)
function Update3DModel(audioURL, emotion) {
    const iframe = $w('#html4');
    iframe.postMessage({
        emotion: emotion,
        audioUrl: audioURL
    });
}

// // ///////////////////////////////////////////////////////////////
// //start ordering button
// reservation buttons
//Yasmeen

$w.onReady(async function () {
    // Verify buttons exist
    if (!$w('#OrderNow') || !$w('#Reservation') || !$w('#imageUpload') || !$w('#sendtButton')) {
        console.error("One or both buttons ('#OrderNow' or '#Reservation' or '#imageUpload' or '#sendtButton') not found.");
        return;
    }

    // Extract ownerId from the last path segment
    const ownerIdStr = decodeURIComponent(wixLocation.path[wixLocation.path.length - 1]);
    const ownerId = Number(ownerIdStr);
    if (!ownerId || isNaN(ownerId)) {
        console.error("Invalid ownerId:", ownerIdStr);
        return;
    }

    try {
        const queryResults = await wixData.query("Owners").eq("id", ownerId).find();
        if (queryResults.items.length === 0) {
            console.error("Owner not found for id:", ownerId);
            throw new Error("Owner not found");
        }

        const { subscriptionBundle = 'unknown' } = queryResults.items[0];
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
        } else {
            $w('#OrderNow').hide();
            $w('#Reservation').hide();
            $w('#imageUpload').hide();
            $w('#sendtButton').show();
        }

        // // Attach click event handler for sendtButton
        $w('#sendtButton').onClick(() => {
            if (subscriptionBundle === 'unknown') {
                $w('#messageText').text = "owner not subscribed yet, please contact the support.";
                $w('#messageText').show();
                setTimeout(() => $w('#messageText').hide(), 5000); // Hide after 5 seconds
            }
        });

        // Click handlers
        $w('#OrderNow').onClick(() => {
            if (!ownerIdStr) {
                console.error("No valid ownerIdStr available for navigation");
                return;
            }
            console.log("Navigating to Order Now with ownerId:", ownerIdStr); // Debug log
            wixLocation.to(`/customed-ordering/${ownerIdStr}`); // Use ownerIdStr for filtering
        });

        $w('#Reservation').onClick(() => {
            wixLocation.to(`/slots/${ownerId}`);
        });

    } catch (error) {
        console.error("Error:", error.message);
        $w('#OrderNow').hide();
        $w('#Reservation').hide();
    }
});
