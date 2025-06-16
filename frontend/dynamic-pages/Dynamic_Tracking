import wixLocation from 'wix-location';
import wixData from 'wix-data';

$w.onReady(function () {
    console.log("Dynamic Tracking page loaded.");

    // Verify the trackingMessage element exists
    if (!$w("#trackingMessage")) {
        console.error("Text element '#trackingMessage' not found on the page.");
        return;
    }

    // Get the full path and extract the orderId
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

    // Display initial confirmation message
    $w("#trackingMessage").text = `Successfully redirected!\nOrder ID: ${orderId}`;
    $w("#trackingMessage").show();

    // Query the Orders collection to find the order
    wixData.query("Orders")
        .eq("orderId", orderId)
        .find()
        .then((results) => {
            console.log("Orders query results:", results);
            if (results.items.length === 0) {
                console.error("No order found for orderId:", orderId);
                $w("#trackingMessage").text = `Error: Order not found for Order ID: ${orderId}`;
                $w("#trackingMessage").show();
                return;
            }

            const order = results.items[0];
            console.log("Found order:", order);

            // Format the order details
            let message = `Order Details\n`;
            message += `------------------\n`;
            message += `Order ID: ${order.orderId}\n`;
            message += `Customer: ${order.customerName}\n`;
            message += `Total Price: ${order.totalPrice.toFixed(2)} LE\n`; // Changed $ to LE
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
                message += `Price per Item: ${pricePerItem} LE\n`; // Changed $ to LE
                message += `Total for Item: ${item.total.toFixed(2)} LE\n`; // Changed $ to LE
                message += `------------------\n`;
            });

            // Update the tracking message with detailed order information
            $w("#trackingMessage").text = message;
            $w("#trackingMessage").show();
        })
        .catch((err) => {
            console.error("Error querying Orders:", err);
            $w("#trackingMessage").text = "Error: Unable to fetch order details.";
            $w("#trackingMessage").show();
        });
});

///////////////////////////////////////////////////////////////buttons codes
///////////////////////////////////////////////////////////////
$w.onReady(function () {
    const button = $w('#backToMenuButton');
    if (!button) {
        console.error("Button '#backToMenuButton' not found on the page at", new Date().toISOString());
        return;
    }
    console.log("Button '#backToMenuButton' found.");

    const path = wixLocation.path;
    const orderId = path.length > 0 ? decodeURIComponent(path[path.length - 1]) : null;
    console.log("Extracted path:", path, "Order ID:", orderId);

    if (!orderId) {
        console.error("No orderId provided in URL at", new Date().toISOString());
        return;
    }

    // Set up the onClick handler immediately with a placeholder
    let ownerId = null;
    button.onClick(() => {
        if (!ownerId) {
            console.error("ownerId not available at", new Date().toISOString());
            return;
        }
        console.log("Back to Menu button clicked at", new Date().toISOString(), "redirecting to:", `/customed-ordering/${ownerId}`);
        try {
            wixLocation.to(`/customed-ordering/${ownerId}`);
            console.log("Redirect successful to:", `/customed-ordering/${ownerId}`);
        } catch (error) {
            console.error("Error during redirection:", error, "at", new Date().toISOString());
        }
    });
    console.log("onClick handler attached.");

    // Query the Orders database
    console.log("Querying Orders database for orderId:", orderId);
    wixData.query("Orders")
        .eq("orderId", orderId)
        .find()
        .then((results) => {
            console.log("Database query results:", results);
            if (results.items.length === 0) {
                console.error("No order found with orderId:", orderId, "at", new Date().toISOString());
                return;
            }

            const order = results.items[0];
            console.log("Found order:", order);
            ownerId = order.ownerId; // Use ownerId as per your database
            console.log("Found ownerId:", ownerId);

            if (!ownerId) {
                console.error("No ownerId found for orderId:", orderId, "at", new Date().toISOString());
            }
        })
        .catch((error) => {
            console.error("Error querying Orders database:", error, "at", new Date().toISOString());
        });
});
