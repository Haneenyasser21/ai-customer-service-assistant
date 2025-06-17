import wixData from 'wix-data';
import wixLocation from 'wix-location';

// Function to load and refresh orders
function loadOrders(ownerId) {
    wixData.query("Orders")
        .eq("ownerId", ownerId)
        .limit(1000)
        .find()
        .then((results) => {
            console.log("Orders query results with _ids:", results.items);
            if (results.items.length > 0) {
                const repeaterData = results.items.map(item => {
                    const mappedItem = {
                        _id: item._id, // Internal Wix ID for deletion
                        orderId: item.orderId || "Not specified",
                        customerName: item.customerName || "Unknown",
                        customerPhone: item.customerPhone || "Not specified",
                        customerEmail: item.customerEmail || "Not specified",
                        items: item.items && Array.isArray(item.items) 
                            ? item.items.map(i => `${i.name} (${i.quantity}) - ${i.price} LE`).join(", ") 
                            : "Not specified",
                        totalPrice: item.totalPrice || "Not specified",
                        deliveryMethod: item.deliveryMethod || "Not specified",
                        location: item.location || "Not specified",
                        paymentMethod: item.paymentMethod || "Not specified"
                    };
                    console.log("Mapped item for Repeater with _id:", mappedItem);
                    return mappedItem;
                });
                $w("#ordersRepeater").data = repeaterData;
                console.log("Repeater data set:", repeaterData);
                $w("#statusMessage").text = "Orders loaded successfully.";
                $w("#statusMessage").show();
            } else {
                $w("#ordersRepeater").data = [];
                $w("#statusMessage").text = "No orders found for this owner.";
                $w("#statusMessage").show();
                console.log("No orders found for ownerId:", ownerId);
            }
        })
        .catch((err) => {
            console.error("Error fetching orders:", err);
            $w("#statusMessage").text = "Error loading orders.";
            $w("#statusMessage").show();
        });
}

$w.onReady(function () {
    console.log("Manage Orders page loaded.");

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

    // Initial setup of repeater data
    loadOrders(ownerId);

    // Set up the delete button and delay button event handlers for each Repeater item
    $w("#ordersRepeater").onItemReady(($item, itemData, index) => {
        console.log("Repeater item data with _id:", itemData);
        $item("#textOrderId").text = `Order ID: ${itemData.orderId || "Not specified"}`;
        $item("#textCustomerName").text = `Customer Name: ${itemData.customerName || "Unknown"}`;
        $item("#textCustomerPhone").text = `Phone: ${itemData.customerPhone || "Not specified"}`;
        $item("#textCustomerEmail").text = `Email: ${itemData.customerEmail || "Not specified"}`;
        $item("#textItems").text = `Items: ${itemData.items || "Not specified"}`;
        $item("#textTotalPrice").text = `Total Price: ${itemData.totalPrice} LE`; // Changed to LE
        $item("#textDeliveryMethod").text = `Delivery Method: ${itemData.deliveryMethod || "Not specified"}`;
        $item("#textLocation").text = `Location: ${itemData.location || "Not specified"}`;
        $item("#textPaymentMethod").text = `Payment Method: ${itemData.paymentMethod || "Not specified"}`;

        // Ensure the delete button is enabled and visible
        $item("#deleteButton").enable();
        $item("#deleteButton").show();
        $item("#deleteButton").onClick(() => {
            console.log("Delete button clicked for order:", itemData);
            console.log("Order _id:", itemData._id);
            console.log("Using ownerId:", ownerId);
            if (!itemData._id) {
                $w("#statusMessage").text = "No order ID specified for deletion.";
                $w("#statusMessage").show();
                console.error("No _id found in itemData for deletion");
                return;
            }
            deleteOrder(itemData, ownerId);
        });

        // Delay Button logic: Add 10 more minutes to delayMinutes
        $item("#delayButton").enable();
        $item("#delayButton").show();
        $item("#delayButton").onClick(() => {
            console.log("Delay button clicked for order:", itemData);
            try {
                const currentDelay = typeof itemData.delayMinutes === "number" ? itemData.delayMinutes : 0;
                const newDelay = currentDelay + 10;

                // Fetch the current order to preserve existing fields
                wixData.get("Orders", itemData._id)
                    .then((currentOrder) => {
                        const updatedOrder = {
                            _id: itemData._id,
                            delayMinutes: newDelay,
                            ...currentOrder // Spread the existing document to preserve all other fields
                        };
                        console.log("Update payload:", updatedOrder);

                        return wixData.update("Orders", updatedOrder);
                    })
                    .then(() => {
                        $w("#statusMessage").text = `Delay added successfully to order ${itemData.orderId}.`;
                        $w("#statusMessage").show();
                        console.log(`Order ${itemData.orderId} delayMinutes updated to ${newDelay}`);
                        // Refresh the Repeater to reflect the updated delay
                        loadOrders(ownerId);
                    })
                    .catch((err) => {
                        console.error("Error updating delayMinutes:", err);
                        $w("#statusMessage").text = "Error adding delay.";
                        $w("#statusMessage").show();
                    });
            } catch (error) {
                console.error("Unexpected error in delay logic:", error);
                $w("#statusMessage").text = "Unexpected error adding delay.";
                $w("#statusMessage").show();
            }
        });
    });
});

// Function to delete an order
function deleteOrder(orderData, ownerId) {
    console.log("Deleting order - orderData:", orderData);
    console.log("Deleting order - ownerId:", ownerId);
    console.log("Deleting order - order _id:", orderData._id);

    if (!ownerId) {
        $w("#statusMessage").text = "No owner ID specified for delete button.";
        $w("#statusMessage").show();
        console.error("No owner ID provided for deletion");
        return;
    }

    if (!orderData._id) {
        $w("#statusMessage").text = "No order ID specified for deletion.";
        $w("#statusMessage").show();
        console.error("No _id found in orderData for deletion");
        return;
    }

    //Remove the order from the Orders collection
    wixData.remove("Orders", orderData._id)
        .then(() => {
            console.log("Order deleted successfully with _id:", orderData._id);
            $w("#statusMessage").text = `Order ${orderData.orderId} deleted successfully.`;
            $w("#statusMessage").show();
            // Refresh the Repeater by re-querying the data
            loadOrders(ownerId);
        })
        .catch((err) => {
            console.error("Error deleting order:", err);
            $w("#statusMessage").text = "Error deleting order.";
            $w("#statusMessage").show();
        });
}

