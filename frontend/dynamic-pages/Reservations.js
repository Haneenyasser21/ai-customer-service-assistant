
import wixData from 'wix-data';
import wixLocation from 'wix-location';

// Function to generate a simple UUID (for reservationId)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// On page load, set up the dataset and populate dropdowns
$w.onReady(function () {
    // Ensure the dataset is ready
    $w("#dynamicDataset").onReady(() => {
        const ownerId = ($w("#dynamicDataset").getCurrentItem()?.ownerId || wixLocation.query.ownerId)?.toString();
        console.log("Owner ID from dataset or query:", ownerId);

        if (!ownerId) {
            $w("#confirmationText").text = "No owner ID specified.";
            $w("#confirmationText").show();
            console.error("No owner ID found");
            return;
        }

        // Populate the date dropdown for this owner
        populateAvailableDates(ownerId);

        // When the date changes, populate the time dropdown for this owner
        $w("#dateInput").onChange(() => {
            populateAvailableTimes(ownerId);
        });

        // Event handler for the "Reserve Now" button
        $w("#bookButton").onClick(() => {
            console.log("Reserve Now button clicked - Event handler triggered");
            $w("#confirmationText").text = "Button clicked! Processing...";
            $w("#confirmationText").show();
            reserveSlot(ownerId);
        });

        // Event handler for the "Go to Reservation" button
        $w("#goToReservationButton").onClick(() => {
            console.log("Go to Reservation button clicked");
            $w("#confirmationText").text = "Searching for reservation...";
            $w("#confirmationText").show();
            goToReservation(ownerId);
        });

        // Populate guests dropdown with a fixed range (adjust as needed)
        populateAvailableGuests();
    });
});

// Function to populate available dates for a specific ownerId
function populateAvailableDates(ownerId) {
    console.log("Populating available dates for owner:", ownerId);
    $w("#dynamicDataset").setFilter(wixData.filter()
        .eq("ownerId", ownerId)
        .eq("isBooked", false)
    )
    .then(() => {
        $w("#dynamicDataset").getItems(0, 1000)
            .then((results) => {
                console.log("Slots dataset results for ownerId:", results.items);
                if (results.items.length > 0) {
                    let dates = results.items.map(item => item.date);
                    let uniqueDates = [...new Set(dates)];
                    uniqueDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                    $w("#dateInput").options = uniqueDates.map(date => ({
                        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        value: date
                    }));
                    console.log("Date dropdown updated with options:", uniqueDates);
                    populateAvailableTimes(ownerId);
                } else {
                    $w("#dateInput").options = [];
                    $w("#timeInput").options = [];
                    $w("#confirmationText").text = "No available dates for this owner.";
                    $w("#confirmationText").show();
                    console.log("No available dates for this owner");
                }
            })
            .catch((err) => {
                console.error("Error fetching slots from dataset:", err);
                $w("#confirmationText").text = "Error loading dates.";
                $w("#confirmationText").show();
            });
    })
    .catch((err) => {
        console.error("Error applying filter:", err);
        $w("#confirmationText").text = "Error loading dates.";
        $w("#confirmationText").show();
    });
}

// Function to populate available times based on the selected date for a specific ownerId
function populateAvailableTimes(ownerId) {
    console.log("Populating available times for owner:", ownerId);
    let selectedDate = $w("#dateInput").value;

    if (selectedDate) {
        $w("#dynamicDataset").setFilter(wixData.filter()
            .eq("ownerId", ownerId)
            .eq("date", selectedDate)
            .eq("isBooked", false)
        )
        .then(() => {
            $w("#dynamicDataset").getItems(0, 1000)
                .then((results) => {
                    console.log("Slots dataset results for selected date and ownerId:", results.items);
                    if (results.items.length > 0) {
                        let availableTimes = results.items.map(item => item.time);
                        availableTimes.sort((a, b) => {
                            const timeA = convertTo24Hour(a);
                            const timeB = convertTo24Hour(b);
                            return timeA - timeB;
                        });
                        $w("#timeInput").options = availableTimes.map(time => ({
                            label: time,
                            value: time
                        }));
                        console.log("Time dropdown updated with options:", availableTimes);
                    } else {
                        $w("#timeInput").options = [];
                        $w("#confirmationText").text = "No available slots for this date.";
                        $w("#confirmationText").show();
                        console.log("No available slots for this date");
                    }
                })
                .catch((err) => {
                    console.error("Error fetching slots:", err);
                    $w("#confirmationText").text = "Error loading slots.";
                    $w("#confirmationText").show();
                });
        })
        .catch((err) => {
            console.error("Error applying filter:", err);
            $w("#confirmationText").text = "Error loading slots.";
            $w("#confirmationText").show();
        });
    } else {
        $w("#timeInput").options = [];
        $w("#confirmationText").text = "Please select a date.";
        $w("#confirmationText").show();
        console.log("No date selected");
    }
}

// Helper function to convert time from "H:MM AM/PM" to 24-hour format for sorting
function convertTo24Hour(time) {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

// Function to populate available number of guests (fixed range for now)
function populateAvailableGuests() {
    console.log("Populating available guests...");
    let guestOptions = [];
    for (let i = 1; i <= 12; i++) {
        guestOptions.push({ label: i.toString(), value: i.toString() });
    }
    $w("#guestsInput").options = guestOptions;
    console.log("Guests dropdown updated with options:", guestOptions);
}

// Function to handle reservation for a specific owner
function reserveSlot(ownerId) {
    console.log("Starting reservation process for owner:", ownerId);
    let name = $w("#nameInput").value;
    let phone = $w("#phoneInput").value;
    let date = $w("#dateInput").value;
    let guests = $w("#guestsInput").value;
    let time = $w("#timeInput").value;
    let reservationId = generateUUID();

    console.log("Form values:", { name, phone, date, guests, time, ownerId, reservationId });

    let cleanedPhone = phone.replace(/\D/g, '');
    let phoneNumber = parseInt(cleanedPhone); // Converts "0111222333" to 111222333
    console.log("Cleaned phone number (as integer):", phoneNumber);
    console.log("Cleaned phone number (as string):", cleanedPhone);

    if (!name || !phone || !date || !guests || !time) {
        $w("#confirmationText").text = "Please fill all required fields.";
        $w("#confirmationText").show();
        console.log("Validation failed: Missing required fields");
        return;
    }
    if (isNaN(phoneNumber) || cleanedPhone.length < 10) {
        $w("#confirmationText").text = "Please enter a valid phone number (at least 10 digits).";
        $w("#confirmationText").show();
        console.log("Validation failed: Invalid phone number");
        return;
    }

    // Check if phone number already exists in Reservations
    wixData.query("Reservations")
        .eq("phone", phoneNumber) // Match as number to align with database type
        .eq("ownerId", ownerId) // Match as string
        .limit(100)
        .find()
        .then((results) => {
            console.log("Existing reservations check results for phone:", phoneNumber, "and ownerId:", ownerId, ":", results.items);
            if (results.items.length > 0) {
                $w("#confirmationText").text = "This phone number already has a reservation booked with this owner. Check it.";
                $w("#confirmationText").show();
                console.log("Reservation exists for this phone and owner");
                return;
            } else {
                console.log("No existing reservation found with phone:", phoneNumber, "and ownerId:", ownerId);
            }

            let numberOfGuests = parseInt(guests);
            if (numberOfGuests > 12) {
                $w("#confirmationText").text = "For parties of more than 12 guests, please contact us directly at (123) 456-7890.";
                $w("#confirmationText").show();
                console.log("More than 12 guests selected");
                return;
            }
            if (isNaN(numberOfGuests)) {
                $w("#confirmationText").text = "Invalid number of guests.";
                $w("#confirmationText").show();
                console.log("Validation failed: Invalid number of guests");
                return;
            }

            wixData.query("Slots")
                .eq("date", date)
                .eq("time", time)
                .eq("ownerId", ownerId)
                .eq("isBooked", false)
                .find()
                .then((results) => {
                    console.log("Slot availability results:", results.items);
                    if (results.items.length === 0) {
                        $w("#confirmationText").text = "This slot is no longer available.";
                        $w("#confirmationText").show();
                        console.log("Slot not available");
                        populateAvailableDates(ownerId);
                        return;
                    }

                    let slotToUpdate = results.items[0];
                    slotToUpdate.isBooked = true;
                    console.log("Updating slot to booked:", slotToUpdate);
                    wixData.update("Slots", slotToUpdate)
                        .then(() => {
                            console.log("Slot updated successfully");
                            let reservation = {
                                name: name,
                                phone: phoneNumber,
                                date: date,
                                numberOfGuests: numberOfGuests,
                                time: time,
                                reservationDateTime: new Date(),
                                ownerId: ownerId,
                                reservationId: reservationId
                            };
                            console.log("Saving reservation:", reservation);
                            wixData.insert("Reservations", reservation)
                                .then(() => {
                                    console.log("Reservation saved successfully");
                                    wixLocation.to(`/reservations/${reservationId}`);
                                })
                                .catch((err) => {
                                    console.error("Error saving reservation:", err);
                                    $w("#confirmationText").text = "Error saving reservation.";
                                    $w("#confirmationText").show();
                                });
                        })
                        .catch((err) => {
                            console.error("Error updating slot:", err);
                            $w("#confirmationText").text = "Error booking slot.";
                            $w("#confirmationText").show();
                        });
                })
                .catch((err) => {
                    console.error("Error checking slot availability:", err);
                    $w("#confirmationText").text = "Error checking availability.";
                    $w("#confirmationText").show();
                });
        })
        .catch((err) => {
            console.error("Error checking existing reservation:", err);
            $w("#confirmationText").text = "Error checking reservation status.";
            $w("#confirmationText").show();
        });
}

// Function to handle going to a reservation
function goToReservation(ownerId) {
    let phone = $w("#phoneInputGoBack").value;
    console.log("Entered phone number:", phone);

    if (!phone) {
        $w("#confirmationText").text = "Please enter a phone number.";
        $w("#confirmationText").show();
        console.log("Validation failed: No phone number provided");
        return;
    }

    // Clean phone number (remove non-digits) to match stored format
    let cleanedPhone = phone.replace(/\D/g, '');
    let phoneNumber = parseInt(cleanedPhone); // Convert to integer to match database
    console.log("Cleaned phone number for query:", phoneNumber);

    if (cleanedPhone.length < 10) {
        $w("#confirmationText").text = "Please enter a valid phone number (at least 10 digits).";
        $w("#confirmationText").show();
        console.log("Validation failed: Invalid phone number length");
        return;
    }

    // Query Reservations database with cleaned phone number and ownerId
    wixData.query("Reservations")
        .eq("phone", phoneNumber) // Exact match with cleaned phone as number
        .eq("ownerId", ownerId) // Filter by ownerId from the URL
        .limit(100)
        .find()
        .then((results) => {
            console.log("Query results (all items) for phone:", phoneNumber, "and ownerId:", ownerId, ":", results.items);
            if (results.items.length > 0) {
                // Filter out invalid reservationDateTime values and sort
                let validReservations = results.items.filter(item => item.reservationDateTime && new Date(item.reservationDateTime).getTime());
                if (validReservations.length > 0) {
                    let sortedReservations = validReservations.sort((a, b) => 
                        new Date(b.reservationDateTime).getTime() - new Date(a.reservationDateTime).getTime()
                    );
                    let latestReservation = sortedReservations[0];
                    let reservationId = latestReservation.reservationId;
                    console.log("Redirecting to most recent reservation for this owner:", reservationId);
                    wixLocation.to(`/reservations/${reservationId}`);
                } else {
                    $w("#confirmationText").text = "No valid reservations found with proper dates.";
                    $w("#confirmationText").show();
                    console.log("No valid reservationDateTime values found");
                }
            } else {
                $w("#confirmationText").text = "No reservation found for this phone number with this owner.";
                $w("#confirmationText").show();
                console.log("No reservation found for this phone and owner");
            }
        })
        .catch((err) => {
            console.error("Error querying reservations:", err);
            $w("#confirmationText").text = "Error finding reservation.";
            $w("#confirmationText").show();
        });
}
