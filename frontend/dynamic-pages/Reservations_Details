import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(function () {
    // Ensure the dataset is ready
    $w("#dynamicDataset").onReady(() => {
        const reservation = $w("#dynamicDataset").getCurrentItem();
        console.log("Reservation Details:", reservation);

        if (!reservation) {
            console.error("No reservation found for this ID");
            $w("#errorText").text = "Reservation not found.";
            $w("#errorText").show();
            $w("#deleteButton").hide();
            return;
        }

        // "Delete Reservation" button event handler
        $w("#deleteButton").onClick(() => {
            console.log("Delete Reservation button clicked");
            $w("#deleteButton").disable();
            $w("#errorText").text = "Deleting reservation...";
            $w("#errorText").show();

            // Step 1: Update the corresponding slot in Slots dataset to unbooked
            wixData.query("Slots")
                .eq("date", reservation.date)
                .eq("time", reservation.time)
                .eq("ownerId", reservation.ownerId)
                .find()
                .then((slotResults) => {
                    console.log("Slot query results:", slotResults.items);
                    if (slotResults.items.length === 0) {
                        console.error("Corresponding slot not found");
                        $w("#errorText").text = "Error: Corresponding slot not found.";
                        $w("#errorText").show();
                        $w("#deleteButton").enable();
                        return;
                    }

                    let slotToUpdate = slotResults.items[0];
                    slotToUpdate.isBooked = false;
                    console.log("Updating slot to unbooked:", slotToUpdate);
                    wixData.update("Slots", slotToUpdate)
                        .then(() => {
                            console.log("Slot updated to unbooked successfully");
                            // Step 2: Delete the reservation from Reservations dataset
                            wixData.remove("Reservations", reservation._id)
                                .then(() => {
                                    console.log("Reservation deleted successfully");
                                    // Step 3: Redirect back to the reservation page
                                    wixLocation.to(`/slots/${reservation.ownerId}`);
                                })
                                .catch((err) => {
                                    console.error("Error deleting reservation:", err);
                                    $w("#errorText").text = "Error deleting reservation.";
                                    $w("#errorText").show();
                                    $w("#deleteButton").enable();
                                });
                        })
                        .catch((err) => {
                            console.error("Error updating slot:", err);
                            $w("#errorText").text = "Error updating slot.";
                            $w("#errorText").show();
                            $w("#deleteButton").enable();
                        });
                })
                .catch((err) => {
                    console.error("Error querying slots:", err);
                    $w("#errorText").text = "Error finding slot.";
                    $w("#errorText").show();
                    $w("#deleteButton").enable();
                });
        });
    });
});

///////////////////////////////////////////////////////////////buttons codes
///////////////////////////////////////////////////////////////
$w.onReady(function () {
    const button = $w('#BackToUserPage');
    if (!button) {
        console.error("Button '#BackToUserPage' not found on the page at", new Date().toISOString());
        return;
    }
    console.log("Button '#BackToUserPage' found.");

    const path = wixLocation.path;
    const reservationId = path.length > 0 ? decodeURIComponent(path[path.length - 1]) : null;
    console.log("Extracted path:", path, "Reservation ID:", reservationId);

    if (!reservationId) {
        console.error("No reservationId provided in URL at", new Date().toISOString());
        return;
    }

    // Set up the onClick handler immediately with a placeholder
    let ownerId = null;
    button.onClick(() => {
        if (!ownerId) {
            console.error("ownerId not available at", new Date().toISOString());
            return;
        }
        console.log("Back to Menu button clicked at", new Date().toISOString(), "redirecting to:", `/customers/${ownerId}`);
        try {
            wixLocation.to(`/customers/${ownerId}`);
            console.log("Redirect successful to:", `/customers/${ownerId}`);
        } catch (error) {
            console.error("Error during redirection:", error, "at", new Date().toISOString());
        }
    });
    console.log("onClick handler attached.");

    // Query the Reservation database
    console.log("Querying Reservations database for reservationId:", reservationId);
    wixData.query("Reservations")
        .eq("reservationId", reservationId)
        .find()
        .then((results) => {
            console.log("Database query results:", results);
            if (results.items.length === 0) {
                console.error("No Reservation found with reservationId:", reservationId, "at", new Date().toISOString());
                return;
            }

            const Reservations = results.items[0];
            console.log("Found order:", Reservations);
            ownerId = Reservations.ownerId; // Use ownerId as per your database
            console.log("Found ownerId:", ownerId);

            if (!ownerId) {
                console.error("No ownerId found for reservationId:", reservationId, "at", new Date().toISOString());
            }
        })
        .catch((error) => {
            console.error("Error querying Reservations database:", error, "at", new Date().toISOString());
        });
});
