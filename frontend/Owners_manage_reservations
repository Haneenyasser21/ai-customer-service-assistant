import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(function () {
    console.log("Manage Reservations page loaded.");

    // Extract ownerId from URL path
    const path = wixLocation.path;
    const ownerId = decodeURIComponent(path[path.length - 1]);
    console.log("Owner ID from URL path:", ownerId);

    if (!ownerId) {
        console.error("No ownerId provided in URL.");
        $w("#statusMessage").text = "Error: No owner specified.";
        $w("#statusMessage").show();
        return;
    }

    // Query the Reservations collection directly
    wixData.query("Reservations")
        .eq("ownerId", ownerId)
        .limit(1000)
        .find()
        .then((results) => {
            console.log("Reservations query results with _ids:", results.items);
            if (results.items.length > 0) {
                const repeaterData = results.items.map(item => {
                    const mappedItem = {
                        _id: item._id, // Reservation ID
                        name: item.name || "Unknown",
                        date: item.date || "Not specified",
                        time: item.time || "Not specified",
                        guests: `${item.numberOfGuests} guests` || "Not specified",
                        dateValue: item.date,
                        timeValue: item.time
                    };
                    console.log("Mapped item for Repeater with _id:", mappedItem);
                    return mappedItem;
                });
                $w("#reservationsRepeater").data = repeaterData;
                console.log("Repeater data set:", repeaterData);
                $w("#statusMessage").text = "Reservations loaded successfully.";
                $w("#statusMessage").show();
            } else {
                $w("#reservationsRepeater").data = [];
                $w("#statusMessage").text = "No reservations found for this owner.";
                $w("#statusMessage").show();
                console.log("No reservations found for ownerId:", ownerId);
            }
        })
        .catch((err) => {
            console.error("Error fetching reservations:", err);
            $w("#statusMessage").text = "Error loading reservations.";
            $w("#statusMessage").show();
        });

    // Set up the delete button event handler for each Repeater item
    $w("#reservationsRepeater").onItemReady(($item, itemData, index) => {
        console.log("Repeater item data with _id:", itemData);
        $item("#textName").text = `Name: ${itemData.name || "Unknown"}`;
        $item("#textDate").text = `Date: ${itemData.date || "Not specified"}`;
        $item("#textTime").text = `Time: ${itemData.time || "Not specified"}`;
        $item("#textGuests").text = `Guests: ${itemData.guests || "Not specified"}`;

        $item("#deleteButton").onClick(() => {
            console.log("Delete button clicked for reservation:", itemData);
            console.log("Reservation _id:", itemData._id);
            console.log("Using ownerId:", ownerId);
            if (!itemData._id) {
                $w("#statusMessage").text = "No reservation ID specified for deletion.";
                $w("#statusMessage").show();
                console.error("No _id found in itemData for deletion");
                return;
            }
            deleteReservation(itemData, ownerId); // Pass reservation data and ownerId
        });
    });
});

// Function to delete a reservation and update the slot
function deleteReservation(reservationData, ownerId) {
    console.log("Deleting reservation - reservationData:", reservationData);
    console.log("Deleting reservation - ownerId:", ownerId);
    console.log("Deleting reservation - reservation _id:", reservationData._id);

    if (!ownerId) {
        $w("#statusMessage").text = "No owner ID specified delete button.";
        $w("#statusMessage").show();
        console.error("No owner ID provided for deletion");
        return;
    }

    if (!reservationData._id) {
        $w("#statusMessage").text = "No reservation ID specified for deletion.";
        $w("#statusMessage").show();
        console.error("No _id found in reservationData for deletion");
        return;
    }

    // Step 1: Remove the reservation from the Reservations collection
    wixData.remove("Reservations", reservationData._id)
        .then(() => {
            console.log("Reservation deleted successfully with _id:", reservationData._id);

            // Step 2: Update the corresponding slot in the Slots collection
            wixData.query("Slots")
                .eq("date", reservationData.dateValue)
                .eq("time", reservationData.timeValue)
                .eq("ownerId", ownerId)
                .find()
                .then((slotResults) => {
                    if (slotResults.items.length > 0) {
                        let slotToUpdate = slotResults.items[0];
                        slotToUpdate.isBooked = false;
                        wixData.update("Slots", slotToUpdate)
                            .then(() => {
                                console.log("Slot updated to available");
                                $w("#statusMessage").text = `Reservation for ${reservationData.name} on ${reservationData.date} at ${reservationData.time} deleted successfully.`;
                                $w("#statusMessage").show();
                                // Refresh the Repeater by re-querying the data
                                wixData.query("Reservations")
                                    .eq("ownerId", ownerId)
                                    .limit(1000)
                                    .find()
                                    .then((results) => {
                                        const updatedData = results.items.map(item => ({
                                            _id: item._id,
                                            name: item.name || "Unknown",
                                            date: item.date || "Not specified",
                                            time: item.time || "Not specified",
                                            guests: `${item.numberOfGuests} guests` || "Not specified",
                                            dateValue: item.date,
                                            timeValue: item.time
                                        }));
                                        $w("#reservationsRepeater").data = updatedData;
                                        console.log("Repeater refreshed with updated data:", updatedData);
                                    })
                                    .catch((err) => {
                                        console.error("Error refreshing Repeater:", err);
                                    });
                            })
                            .catch((err) => {
                                console.error("Error updating slot:", err);
                                $w("#statusMessage").text = "Error making slot available.";
                                $w("#statusMessage").show();
                            });
                    } else {
                        $w("#statusMessage").text = "Slot not found, but reservation deleted.";
                        $w("#statusMessage").show();
                        // Refresh the Repeater
                        wixData.query("Reservations")
                            .eq("ownerId", ownerId)
                            .limit(1000)
                            .find()
                            .then((results) => {
                                const updatedData = results.items.map(item => ({
                                    _id: item._id,
                                    name: item.name || "Unknown",
                                    date: item.date || "Not specified",
                                    time: item.time || "Not specified",
                                    guests: `${item.numberOfGuests} guests` || "Not specified",
                                    dateValue: item.date,
                                    timeValue: item.time
                                }));
                                $w("#reservationsRepeater").data = updatedData;
                                console.log("Repeater refreshed with updated data:", updatedData);
                            })
                            .catch((err) => {
                                console.error("Error refreshing Repeater:", err);
                            });
                    }
                })
                .catch((err) => {
                    console.error("Error finding slot:", err);
                    $w("#statusMessage").text = "Error finding slot to update.";
                    $w("#statusMessage").show();
                });
        })
        .catch((err) => {
            console.error("Error deleting reservation:", err);
            $w("#statusMessage").text = "Error deleting reservation.";
            $w("#statusMessage").show();
        });
}
