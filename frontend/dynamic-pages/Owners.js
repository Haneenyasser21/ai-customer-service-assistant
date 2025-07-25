import wixData from 'wix-data';
import { generateAndSaveNumericOwnerId } from 'backend/owner.jsw';
import { getPublicUrl } from 'backend/media.jsw';
import { createDynamicPage } from 'backend/DynamicPageCreation.jsw';
import { uploadAndProcessPDF } from 'backend/GenerateEmbeddings2.jsw';
import { currentMember } from 'wix-members';
import { getChunksByOwner } from 'backend/Chunks.jsw';

$w.onReady(async function () {
  try {
    // Get the current logged-in member
    const member = await currentMember.getMember();
    if (!member) {
      console.error("No member logged in");
      $w('#html4').postMessage({ businessName: "Guest" });
      return;
    }

    const email = member.loginEmail;

    // Query the Owners collection to get the businessName
    const result = await wixData.query("Owners")
      .eq("email", email)
      .find();

    if (result.items.length > 0) {
      const businessName = result.items[0].businessName || "Guest";
      $w('#html4').postMessage({ businessName: businessName });
    } else {
      console.error("No matching owner found for email:", email);
      $w('#html4').postMessage({ businessName: "Guest" });
    }
  } catch (error) {
    console.error("Error fetching business name:", error);
    $w('#html4').postMessage({ businessName: "Guest" });
  }

  showQR(); // Display QR code if available
});

$w("#uploadButton1").onChange(async () => {
  const files = $w("#uploadButton1").value;
  if (files.length === 0) return;

  try {
    // Upload the file
    const uploadResults = await $w("#uploadButton1").uploadFiles();
    if (uploadResults.length) {
      const fileUrl = uploadResults[0].fileUrl;
      console.log("Internal File URL:", fileUrl);

      // Get the public URL
      const publicUrl = await getPublicUrl(fileUrl);
      console.log("Public File URL:", publicUrl);

      // Get the current owner's email from the dataset
      const dataset = $w("#dynamicDataset");
      const currentItem = await dataset.getCurrentItem();
      const ownerEmail = currentItem.email;

      // Generate and save a numeric ID for the owner
      const numericId = await generateAndSaveNumericOwnerId(ownerEmail);
      console.log("Generated Numeric Owner ID:", numericId);

      // Call uploadAndProcessPDF with retries
      const result = await callUploadAndProcessPDF(fileUrl, numericId);
      console.log("PDF processed and embeddings saved successfully:", result);
      /////////////////////
      const chunks = await getChunksByOwner(numericId);

// Option 1: Show in a repeater
// $w("#chunksRepeater").data = chunks;
// $w("#chunksRepeater").onItemReady(($item, itemData) => {
//   $item("#chunkText").text = `Chunk ${itemData.index}:\n${itemData.text}`;
// });

// Option 2: Dump into multiline text box
$w("#rawChunksText").text = chunks.map(c => `Chunk ${c.index}:\n${c.text}`).join("\n\n---\n\n");


      // Create dynamic page and refresh dataset
      await createDynamicPage(numericId);
      await dataset.refresh();
      showQR();
    }
  } catch (error) {
    console.error("Error during upload or processing:", error);
  }
});

async function callUploadAndProcessPDF(fileUrl, ownerId, retries = 1, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const start = Date.now();
      const result = await uploadAndProcessPDF(String(fileUrl), Number(ownerId));
      console.log(`uploadAndProcessPDF succeeded in ${Date.now() - start}ms`);
      return result;
    } catch (err) {
      console.error(`Attempt ${i + 1} failed:`, err.message);
      if (err.message.includes('504') && i < retries - 1) {
        console.log(`Retrying after ${delay * Math.pow(2, i)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
}

async function showQR() {
  try {
    const dataset = $w("#dynamicDataset");
    const currentItem = await dataset.getCurrentItem();
    const qrurl = currentItem.qRcodeUrl;
    if (!qrurl) {
      console.warn("QR code URL is missing or undefined in the dataset");
      return;
    }
    $w('#image1').src = qrurl;
    $w('#image1').show();
    const customerUrl = currentItem.customerUrl;
  //  $w("#qrdl").text = customerUrl;
    //    $w("#qrdl").show();
    $w("#qrdl").label = "Open Customer Page";
    $w("#qrdl").show();
    $w("#qrdl").onClick(() => {
    wixLocation.to(customerUrl);
});

    console.log("QR code displayed successfully");
  } catch (error) {
    console.error("Error in showQR function:", error);
  }
}

////////////////////////


// After PDF processing completes


//////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////
// manage buttons according to subscrition bundle

import wixLocation from 'wix-location';


$w.onReady(async function () {
    // Verify the buttons exist
    if (!$w('#manageOrders') || !$w('#manageReservations') || !$w('#ManageMenue') || !$w('#manageSlots') || !$w('#managePdfs') || !$w('#mySubPlan') || !$w('#uploadButton1')) {
        console.error("One or all buttons ('#manageOrders' or '#manageReservations' or '#ManageMenue' or '#manageSlots' or 'managePdfs' or 'mySubPlan') not found on the page.");
        return;
    }

    // Get the full URL and path for debugging
    const fullUrl = wixLocation.url;
    const path = wixLocation.path;
    console.log("Full URL:", fullUrl);
    console.log("Full path:", path);

    // Extract the email from the path
    const emailFromUrl = path.length > 0 ? decodeURIComponent(path[0] || '') : '';
    console.log("Email from URL (raw):", emailFromUrl);

    if (!emailFromUrl || emailFromUrl === 'blank-3') {
        console.error("Invalid or missing email in URL:", emailFromUrl);
        return;
    }

    try {
        // Query the Owners collection using the 'email' field without forcing lowercase
        console.log("Querying Owners collection for email:", emailFromUrl);
        let queryResults = await wixData.query("Owners")
            .eq("email", emailFromUrl) // Try exact match first
            .find();

        console.log("Query results (exact match):", queryResults);

        let owner;
        if (queryResults.items.length === 0) {
            // Fallback: Fetch all records and filter case-insensitively client-side
            console.log("No exact match found, performing case-insensitive search...");
            const allOwners = await wixData.query("Owners").find();
            const matchingOwner = allOwners.items.find(item =>
                item.email && item.email.toLowerCase() === emailFromUrl.toLowerCase()
            );
            if (matchingOwner) {
                owner = matchingOwner;
                console.log("Case-insensitive match found:", owner);
            } else {
                console.error("Owner not found for email (case-insensitive):", emailFromUrl);
                const allItems = await wixData.query("Owners").find();
                console.log("All items in Owners collection (detailed):", allItems.items);
                throw new Error("Owner not found for email: " + emailFromUrl);
            }
        } else {
            owner = queryResults.items[0];
        }

        const ownerId = owner["id"];
        let subscriptionBundle = owner["subscriptionBundle"] || 'unknown';
        const subscriptionDate = owner["subscriptionDate"] || null;
        console.log("Owner ID:", ownerId, "Subscription Bundle:", subscriptionBundle, "Subscription Date:", subscriptionDate);

        // Check and update subscription expiration on page load
        if (subscriptionDate) {
            const now = new Date(); // Current date and time (02:28 AM EEST, June 17, 2025)
            const monthDiff = (now.getFullYear() - subscriptionDate.getFullYear()) * 12 + (now.getMonth() - subscriptionDate.getMonth());
            if (monthDiff >= 1) {
                subscriptionBundle = 'unknown';
                const updateData = {
                    ...owner, // Preserve all existing fields
                    subscriptionBundle: 'unknown',
                    subscriptionDate: null,
                    paymentStatus: null // Explicitly set to null after spread
                };
                console.log("Update data:", updateData); // Debug the update object
                await wixData.update("Owners", updateData);
                console.log("Subscription expired, updated to 'unknown' for email:", emailFromUrl);
            }
        }

        if (!ownerId) {
            console.error("No ownerId found for the email. Available fields:", Object.keys(owner));
            return;
        }

        // Control button visibility based on subscription plan
        if (subscriptionBundle === 'standard') {
            $w('#manageOrders').show();
            $w('#ManageMenue').show(); 
            $w('#manageReservations').hide();
            $w('#manageSlots').hide();
            $w('#managePdfs').show();
            $w('#uploadButton1').show();
        } else if (subscriptionBundle === 'premium') {
            $w('#manageOrders').show();
            $w('#ManageMenue').show(); 
            $w('#manageReservations').show();
            $w('#manageSlots').show();
            $w('#managePdfs').show();
            $w('#uploadButton1').show();
        } else if (subscriptionBundle === 'basic') {
            $w('#manageOrders').hide();
            $w('#ManageMenue').hide(); 
            $w('#manageReservations').hide();
            $w('#manageSlots').hide();
            $w('#managePdfs').show();
            $w('#uploadButton1').show();
        } else {
            $w('#manageOrders').hide();
            $w('#ManageMenue').hide(); 
            $w('#manageReservations').hide();
            $w('#manageSlots').hide();
            $w('#managePdfs').hide();
            $w('#uploadButton1').hide();
        }

        // Attach click event handlers
        $w('#manageOrders').onClick(() => {
            console.log("Manage Orders button clicked, redirecting to:", `/manage-orders/${ownerId}`);
            wixLocation.to(`/manage-orders/${ownerId}`);
        });

        $w('#manageReservations').onClick(() => {
            console.log("Manage Reservations button clicked, redirecting to:", `/manage-reservations/${ownerId}`);
            wixLocation.to(`/manage-reservations/${ownerId}`);
        });

        $w('#ManageMenue').onClick(() => {
            console.log("Manage My Menu button clicked, redirecting to:", `/managemenu/${ownerId}`);
            wixLocation.to(`/managemenu/${ownerId}`);
        });

        $w('#manageSlots').onClick(() => {
            console.log("Manage My Slots button clicked, redirecting to:", `/manageslots/${ownerId}`);
            wixLocation.to(`/manageslots/${ownerId}`);
        });

        $w('#managePdfs').onClick(() => {
            console.log("Manage My pdfs button clicked, redirecting to:", `/managepdfs/${ownerId}`);
            wixLocation.to(`/managepdfs/${ownerId}`);
        });

        // Add click event handler for mySubPlan button
        $w('#mySubPlan').onClick(async () => {
            console.log("My Subscription Plan button clicked");
            try {
                // Query the Owners collection again to get the latest subscriptionBundle and subscriptionDate
                const subQueryResults = await wixData.query("Owners")
                    .eq("email", emailFromUrl) // Try exact match first
                    .find();

                console.log("Subscription query results (exact match):", subQueryResults);

                let subOwner;
                if (subQueryResults.items.length === 0) {
                    // Fallback: Fetch all records and filter case-insensitively
                    console.log("No exact match found, performing case-insensitive search...");
                    const allOwners = await wixData.query("Owners").find();
                    const matchingOwner = allOwners.items.find(item =>
                        item.email && item.email.toLowerCase() === emailFromUrl.toLowerCase()
                    );
                    if (matchingOwner) {
                        subOwner = matchingOwner;
                        console.log("Case-insensitive match found:", subOwner);
                    } else {
                        console.error("Owner not found for email (case-insensitive):", emailFromUrl);
                        throw new Error("Owner not found for email: " + emailFromUrl);
                    }
                } else {
                    subOwner = subQueryResults.items[0];
                }

                let subBundle = subOwner["subscriptionBundle"] || 'unknown';
                const subDate = subOwner["subscriptionDate"] || null;
                console.log("Subscription Bundle:", subBundle, "Subscription Date:", subDate);

                // Check and update subscription expiration on button click
                if (subDate) {
                    const now = new Date(); // Current date and time (02:28 AM EEST, June 17, 2025)
                    const monthDiff = (now.getFullYear() - subDate.getFullYear()) * 12 + (now.getMonth() - subDate.getMonth());
                    if (monthDiff >= 1) {
                        subBundle = 'unknown';
                        const updateData = {
                            ...subOwner, // Preserve all existing fields
                            subscriptionBundle: 'unknown',
                            subscriptionDate: null,
                            paymentStatus: null // Explicitly set to null after spread
                        };
                        console.log("Update data:", updateData); // Debug the update object
                        await wixData.update("Owners", updateData);
                        console.log("Subscription expired, updated to 'unknown' for email:", emailFromUrl);
                    }
                }

                // Show the subscription box and set the text
                $w('#subscriptionBox').show();

                if (subBundle === 'unknown') {
                    $w('#subscriptionDisplay').text = 'not subscribed yet, please upgrade now';
                } else {
                    const formattedDate = subDate ? subDate.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }) : 'N/A';
                    const daysLeft = calculateDaysLeft(subDate);
                    $w('#subscriptionDisplay').text = `${subBundle} \nSubscribed on: ${formattedDate}${daysLeft !== null ? ` \n${daysLeft} days left` : ''}`;
                }

                // Position the box (e.g., center it)
                // $w('#subscriptionBox').center();
            } catch (error) {
                console.error("Error fetching subscription data:", error.message);
            }
        });

        // Add click event handler for close button
        $w('#closeBox').onClick(() => {
            $w('#subscriptionBox').hide();
        });

    } catch (error) {
        console.error("Query or setup error:", error.message);
    }
});

// Function to calculate days left in the subscription month
function calculateDaysLeft(subDate) {
    if (!subDate) return null;

    const now = new Date(); // Current date and time (02:28 AM EEST, June 17, 2025)
    const subMonthStart = new Date(subDate.getFullYear(), subDate.getMonth(), subDate.getDate());
    const nextMonthStart = new Date(subMonthStart.getFullYear(), subMonthStart.getMonth() + 1, subDate.getDate());

    // If the subscription month has already passed, return null or handle renewal
    if (now > nextMonthStart) {
        return null; // Indicates expiration
    }

    const timeDiff = nextMonthStart.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysLeft;
}
//////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////end of buttons codes
