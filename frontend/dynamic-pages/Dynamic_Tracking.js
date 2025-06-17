import wixLocation from 'wix-location';
import wixData from 'wix-data';

$w.onReady(function () {
    console.log("Dynamic Tracking page loaded.");

    if (!$w("#trackingMessage")) {
        console.error("Text element '#trackingMessage' not found on the page.");
        return;
    }

    const path = wixLocation.path;
    console.log("Full URL:", wixLocation.url);
    console.log("Path segments:", path);
    console.log("Path length:", path.length);
    console.log("Last path segment (before decode):", path[path.length - 1]);
    const orderId = path[path.length - 1] ? decodeURIComponent(path[path.length - 1]) : null;
    console.log("Extracted Order ID from path:", orderId);

    if (!orderId || orderId.trim() === "") {
        console.error("No valid orderId provided in URL.");
        $w("#trackingMessage").text = "Error: No order specified.";
        $w("#trackingMessage").show();
        return;
    }

    let timerInterval, statusInterval, refreshInterval;

    function updateOrderDetails() {
        wixData.query("Orders")
            .eq("orderId", orderId)
            .find()
            .then((results) => {
                console.log("Orders query results:", results);
                if (results.items.length === 0) {
                    console.log("Order deleted or not found for orderId:", orderId);
                    $w("#trackingMessage").text = "Your order is deleted by owner, contact for support.";
                    $w("#trackingMessage").show();
                    $w("#timerDisplay").hide(); // Hide timer if visible
                    $w("#statusText").hide();   // Hide status if visible
                    clearInterval(timerInterval);
                    clearInterval(statusInterval);
                    clearInterval(refreshInterval);
                    return;
                }

                const order = results.items[0];
                console.log("Found order:", order);

                let message = `Order Details\n`;
                message += `------------------\n`;
                message += `Order ID: ${order.orderId}\n`;
                message += `Customer: ${order.customerName}\n`;
                message += `Total Price: ${order.totalPrice.toFixed(2)} LE\n`;
                message += `Delivery Method: ${order.deliveryMethod}\n`;
                if (order.location) {
                    message += `Delivery Location: ${order.location}\n`;
                }
                message += `Payment Method: ${order.paymentMethod}\n`;
                if (order.extraNotes) {
                    message += `Extra Notes: ${order.extraNotes}\n`;
                }
                message += `Order Date: ${new Date(order.orderDateTime).toLocaleString()}\n`;
                message += `\nItems:\n`;
                message += `------------------\n`;
                order.items.forEach(item => {
                    const pricePerItem = (item.total / item.quantity).toFixed(2);
                    message += `Item: ${item.name}\n`;
                    message += `Quantity: ${item.quantity}\n`;
                    message += `Price per Item: ${pricePerItem} LE\n`;
                    message += `Total for Item: ${item.total.toFixed(2)} LE\n`;
                    message += `------------------\n`;
                });

                $w("#trackingMessage").text = message;
                $w("#trackingMessage").show();
                $w("#timerDisplay").show(); // Ensure timer is visible
                $w("#statusText").show();   // Ensure status is visible

                // Update timer with the latest delayMinutes
                let orderDateTime = new Date(order.orderDateTime);
                let delayMinutes = order.delayMinutes || 0;
                let countdownTime = (20 + delayMinutes) * 60 * 1000; // Base 20 minutes + delay
                let currentTime = new Date().getTime();
                let remainingTime = countdownTime - (currentTime - orderDateTime.getTime());

                function updateTimer() {
                    if (remainingTime <= 0) {
                        $w("#timerDisplay").text = "00:00";
                        clearInterval(timerInterval);
                    } else {
                        remainingTime -= 1000;
                        let minutes = Math.floor(remainingTime / 60000);
                        let seconds = Math.floor((remainingTime % 60000) / 1000);
                        $w("#timerDisplay").text = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    }
                }

                clearInterval(timerInterval); // Clear existing timer interval
                timerInterval = setInterval(updateTimer, 1000);
                updateTimer(); // Initial update

                // Periodically refresh delayMinutes and check order existence
                clearInterval(refreshInterval); // Clear existing refresh interval
                refreshInterval = setInterval(() => {
                    wixData.get("Orders", order._id)
                        .then((updatedOrder) => {
                            let newDelayMinutes = updatedOrder.delayMinutes || 0;
                            if (newDelayMinutes !== delayMinutes) {
                                console.log("DelayMinutes updated from", delayMinutes, "to", newDelayMinutes);
                                delayMinutes = newDelayMinutes;
                                countdownTime = (20 + delayMinutes) * 60 * 1000;
                                remainingTime = countdownTime - (new Date().getTime() - orderDateTime.getTime());
                                updateTimer(); // Update timer immediately
                            }
                        })
                        .catch((err) => {
                            console.error("Error refreshing delayMinutes:", err);
                            // If get fails (e.g., order deleted), force a full query
                            wixData.query("Orders")
                                .eq("orderId", orderId)
                                .find()
                                .then((checkResults) => {
                                    if (checkResults.items.length === 0) {
                                        console.log("Order deleted detected during refresh for orderId:", orderId);
                                        $w("#trackingMessage").text = "Your order is deleted by owner, contact for support.";
                                        $w("#trackingMessage").show();
                                        $w("#timerDisplay").hide();
                                        $w("#statusText").hide();
                                        clearInterval(timerInterval);
                                        clearInterval(statusInterval);
                                        clearInterval(refreshInterval);
                                    }
                                })
                                .catch((queryErr) => {
                                    console.error("Error checking order existence:", queryErr);
                                });
                        });
                }, 30000); // Check every 30 seconds
            })
            .catch((err) => {
                console.error("Error querying Orders:", err);
                $w("#trackingMessage").text = "Error: Unable to fetch order details.";
                $w("#trackingMessage").show();
            });
    }

    // Initial load
    updateOrderDetails();

    // --- Order Status Update Logic ---
    const statuses = ["Received", "Preparing", "Prepared", "Arrived"];
    let statusIndex = 0;

    function updateStatus() {
        if (statusIndex < statuses.length) {
            $w("#statusText").text = `Status: ${statuses[statusIndex]}`;
            statusIndex++;
        }
    }

    updateStatus(); // Show first status immediately

    statusInterval = setInterval(() => {
        if (statusIndex >= statuses.length) {
            clearInterval(statusInterval);
        } else {
            updateStatus();
        }
    }, 5 * 60 * 1000); // Every 5 minutes
});
