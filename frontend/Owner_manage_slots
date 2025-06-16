import wixData from 'wix-data';
import wixLocation from 'wix-location';


$w.onReady(function () {
    console.log("Owner Manage Available Slots page loaded at:", new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" }));

    const path = wixLocation.path;
    const ownerId = decodeURIComponent(path[path.length - 1]);
    console.log("Full path:", path);
    console.log("Extracted Owner ID from URL path (raw):", ownerId);
    const normalizedOwnerId = ownerId.trim();
    console.log("Normalized Owner ID:", normalizedOwnerId);

    if (!ownerId) {
        console.error("No ownerId provided in URL. Path:", path);
        $w("#statusText").text = "Error: No owner specified.";
        $w("#statusText").show();
        return;
    }

    // Query slots and populate repeater
    wixData.query("Slots")
        .find()
        .then((results) => {
            console.log("All slots query results (raw):", JSON.stringify(results.items, null, 2));
            const ownerSlots = results.items.filter(item => item.ownerId === normalizedOwnerId);
            console.log("Filtered slots for ownerId:", normalizedOwnerId, "Count:", ownerSlots.length, "Slots:", JSON.stringify(ownerSlots, null, 2));

            if (ownerSlots.length > 0) {
                const repeaterData = ownerSlots.map(item => ({
                    _id: item._id,
                    date: item.date ? (typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
                    time: convertTo24Hour(item.time || "00:00:00.000"), // Default to 00:00 if null
                    isBooked: item.isBooked || false
                }));
                $w("#slotsRepeater").data = repeaterData;
                console.log("Repeater data set:", repeaterData);
                $w("#statusText").text = "Slots loaded successfully.";
                $w("#statusText").show();
            } else {
                $w("#slotsRepeater").data = [];
                $w("#statusText").text = `No slots found for ownerId: ${ownerId}. Check database or permissions.`;
                $w("#statusText").show();
                console.log("No slots found for ownerId:", ownerId);
            }
        })
        .catch((err) => {
            console.error("Error fetching slots:", err);
            $w("#statusText").text = "Error loading slots: " + err.message;
            $w("#statusText").show();
        });

    // Set up the save button event handler for each Repeater item
    $w("#slotsRepeater").onItemReady(($item, itemData, index) => {
        console.log("Repeater item data:", itemData);
        $item("#datePicker").value = itemData.date ? new Date(itemData.date) : new Date(); // Set date picker with Date object
        $item("#timePicker").value = itemData.time; // Set time picker value in HH:MM format
        $item("#isBookedCheckbox").checked = itemData.isBooked;

        $item("#saveSlotButton").onClick(() => {
            console.log("Save button clicked for slot:", itemData);
            if (!itemData._id) {
                $item("#statusText").text = "No slot ID specified for update.";
                $item("#statusText").show();
                console.error("No _id found in itemData for update");
                return;
            }

            // Fetch the original slot to ensure all fields are included
            wixData.get("Slots", itemData._id)
                .then((originalItem) => {
                    const newDate = $item("#datePicker").value;
                    const formattedDate = newDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' });

                    console.log("New date from datePicker:", newDate, "Formatted date:", formattedDate);
                    const updatedSlot = {
                        ...originalItem,
                        date: formattedDate, // Store as YYYY-MM-DD string
                        time: convertTo24Hour($item("#timePicker").value) || originalItem.time, // Convert to HH:MM
                        isBooked: $item("#isBookedCheckbox").checked
                    };
                    console.log("Updated slot before save:", updatedSlot);
                    wixData.update("Slots", updatedSlot)
                        .then(() => {
                            console.log("Slot updated successfully");
                            $item("#statusText").text = "Slot saved!";
                            $item("#statusText").show();
                            setTimeout(() => $item("#statusText").hide(), 2000);
                        })
                        .catch((error) => {
                            console.error("Error updating slot:", error);
                            $item("#statusText").text = "Error saving slot: " + error.message;
                            $item("#statusText").show();
                        });
                })
                .catch((err) => {
                    console.error("Error fetching original slot:", err);
                    $item("#statusText").text = "Error loading slot for update.";
                    $item("#statusText").show();
                });
        });
    });

    // Function to convert various time formats to 24-hour HH:MM
    function convertTo24Hour(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return "00:00"; // Fallback if invalid

        let time = timeStr.trim();
        let modifier = 'AM'; // Default modifier
        let hours = 0;
        let minutes = 0;

        // Handle "HH:MM:SS.mmm" format (e.g., "06:00:00.000")
        if (time.includes(':')) {
            const timeParts = time.split(':');
            if (timeParts.length >= 2) {
                hours = parseInt(timeParts[0], 10) || 0;
                minutes = parseInt(timeParts[1].split('.')[0], 10) || 0; // Remove milliseconds
                if (hours > 23 || minutes > 59) return "00:00"; // Invalid time
            }
        }

        // Adjust for 12-hour format if modifier exists
        if (time.toLowerCase().includes('pm') || time.toLowerCase().includes('am')) {
            [time, modifier] = time.replace(/\s+/g, ' ').split(' ');
            let [h, m] = time.split(':');
            hours = parseInt(h, 10) || 0;
            minutes = parseInt(m, 10) || 0;
            if (hours === 12) hours = 0;
            if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        }

        // Ensure valid range
        hours = Math.max(0, Math.min(23, hours));
        minutes = Math.max(0, Math.min(59, minutes));

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
});
