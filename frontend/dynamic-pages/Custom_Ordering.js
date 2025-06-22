import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import wixWindow from 'wix-window';

// Cart to store selected items
let cart = JSON.parse(session.getItem("cartData") || "[]");

$w.onReady(async function () {
    console.log("Customed Ordering page loaded.");

    const path = wixLocation.path;
    const query = wixLocation.query;
    const ownerId = decodeURIComponent(path[path.length - 1]);
    console.log("Owner ID from URL path:", ownerId, "Query params:", query);

    if (!ownerId) {
        console.error("No ownerId provided in URL.");
        $w("#cartSummary").text = "Error: No owner specified.";
        $w("#cartSummary").show();
        return;
    }

    // Fetch and populate menu items with client-side filtering
    try {
        const results = await wixData.query("MenuItems")
            .limit(1000) // Increase limit to ensure all items are fetched
            .find();
        console.log("All menu items fetched, length:", results.items.length);
        console.log("Menu items with ownerId:", results.items.map(item => ({
            name: item.name,
            ownerId: item.ownerId,
            ownerIdType: typeof item.ownerId
        })));
        const matchingItems = results.items.filter(item => {
            const dbOwnerIdStr = item.ownerId ? item.ownerId.toString() : null; // Null if no ownerId
            return dbOwnerIdStr === ownerId; // Only match if ownerId exists and matches
        });
        console.log("Matching menu items after filter, length:", matchingItems.length);
        console.log("Matching menu items:", matchingItems.map(item => ({
            name: item.name,
            ownerId: item.ownerId
        })));
        if (matchingItems.length > 0) {
            $w("#menuRepeater").data = []; // Clear existing data
            $w("#menuRepeater").data = matchingItems; // Set filtered data
            // Workaround: Force re-render by re-triggering onItemReady indirectly
            $w("#menuRepeater").forEachItem(($item, itemData) => {
                $item("#foodImage").src = itemData.image || "";
                $item("#textName").text = itemData.name || "Unnamed Item";
                $item("#textPrice").text = `${(itemData.price || 0).toFixed(2)} LE`;
                $item("#textDescription").text = itemData.description || "";
                let options = [{ label: "0", value: "0" }];
                for (let i = 1; i <= (itemData.quantity || 1); i++) {
                    options.push({ label: i.toString(), value: i.toString() });
                }
                $item("#quantityDropdown").options = options;
                $item("#quantityDropdown").value = "0";
            });
        } else {
            console.log("No menu items found for owner:", ownerId);
            $w("#cartSummary").text = "No menu items available for this owner.";
            $w("#cartSummary").show();
        }
    } catch (err) {
        console.error("Error fetching menu items:", err);
        $w("#cartSummary").text = "Error loading menu items.";
        $w("#cartSummary").show();
    }

    // Handle auto-add from redirect query params
    const orderedItemName = query.item ? query.item.toLowerCase().trim() : "";
    const orderedQuantity = parseInt(query.quantity || "1");
    if (orderedItemName && orderedQuantity > 0) {
        const results = await wixData.query("MenuItems")
            .limit(1000) // Increase limit to ensure all items are fetched
            .find();
        const matchingItems = results.items.filter(item => {
            const dbOwnerIdStr = item.ownerId ? item.ownerId.toString() : null;
            return dbOwnerIdStr === ownerId;
        });
        const matchedItem = matchingItems.find(item =>
            item.name.toLowerCase().includes(orderedItemName) ||
            (item.itemName_ar && item.itemName_ar.toLowerCase().includes(orderedItemName))
        );
        if (matchedItem) {
            addToCart(matchedItem, orderedQuantity, ownerId);
            session.setItem("cartData", JSON.stringify(cart)); // Save cart after auto-add
            updateCartSummary();
            $w("#sideCartStrip").show("slide", { direction: "right", duration: 300 });
            console.log(`Auto-added ${orderedQuantity} x ${matchedItem.name} to cart from redirect.`);
        } else {
            console.warn(`Ordered item "${orderedItemName}" not found for owner: ${ownerId}`);
        }
    }

    $w("#menuRepeater").onItemReady(($item, itemData) => {
        $item("#foodImage").src = itemData.image || "";
        $item("#textName").text = itemData.name || "Unnamed Item";
        $item("#textPrice").text = `${(itemData.price || 0).toFixed(2)} LE`;
        $item("#textDescription").text = itemData.description || "";

        let options = [{ label: "0", value: "0" }]; // Add 0 as first option
        for (let i = 1; i <= (itemData.quantity || 1); i++) {
            options.push({ label: i.toString(), value: i.toString() });
        }
        $item("#quantityDropdown").options = options;
        $item("#quantityDropdown").value = "0"; // Set default to 0

        $item("#addToCartButton").onClick(() => {
            const quantity = parseInt($item("#quantityDropdown").value);
            if (quantity > 0 && quantity <= (itemData.quantity || 1)) {
                addToCart(itemData, quantity, ownerId);
                $item("#cartConfirmationMessage").text = `Added: ${quantity} x ${itemData.name}`;
                $item("#cartConfirmationMessage").show();
                updateCartSummary();
                $w("#sideCartStrip").show("slide", { direction: "right", duration: 300 });
            } else {
                $item("#cartConfirmationMessage").text = "Invalid quantity selected.";
                $item("#cartConfirmationMessage").show();
            }
        });
    });

    $w("#viewCart").onClick(() => {
        wixWindow.scrollTo(0, 0);
        $w("#sideCartStrip").show("slide", { direction: "right", duration: 300 });
        updateCartSummary();
    });

    $w("#closeCartButton").onClick(() => {
        $w("#sideCartStrip").hide("slide", { direction: "right", duration: 300 });
    });

    $w("#placeOrderNowButton").onClick(() => {
        if (cart.length === 0) {
            $w("#sideCartStrip").hide("slide", { direction: "right", duration: 300 });
            return;
        }
        session.setItem("cartData", JSON.stringify(cart));
        wixLocation.to(`/view-cart/${ownerId}`);
    });

    /////////////////////////////////////////////////////////////////////////////////////////////////////view my orders////////////////////////////////////////
    $w("#viewOrdersButton").onClick(async () => {
        console.log("View My Orders button clicked");
        let email = $w("#emailInput").value;
        console.log("Entered email:", email);

        if (!email || !isValidEmail(email)) {
            $w("#check").text = "Please enter a valid email address.";
            $w("#check").show();
            console.log("Validation failed: Invalid or missing email");
            return;
        }

        const ownerId = wixLocation.path[wixLocation.path.length - 1]; // Get ownerId from URL
        console.log("Owner ID from URL:", ownerId);

        try {
            // Verify if the email matches the ownerId in the Orders collection (case-insensitive)
            const results = await wixData.query("Orders")
                .contains("customerEmail", email.toLowerCase().trim()) // Case-insensitive search
                .eq("ownerId", ownerId)
                .limit(1)
                .find();
            console.log("Verification query results:", results.items);

            if (results.items.length > 0) {
                // Redirect to dynamic page filtered by email (ownerId is implicit in the flow)
                wixLocation.to(`/orders/${encodeURIComponent(email)}`);
            } else {
                $w("#check").text = "No orders found for this email and owner. Please check your input.";
                $w("#check").show();
                console.log("Verification failed: No matching orders for email and ownerId");
            }
        } catch (err) {
            console.error("Error verifying email and ownerId:", err);
            $w("#check").text = "Error verifying your details. Try again.";
            $w("#check").show();
        }
    });
    // Add button to direct to email input box
    $w.onReady(() => {
        // Initially hide the email container
        $w("#emailContainer").hide();

        $w("#goToEmailButton").onClick(() => {
            console.log("Go to Email button clicked");

            // Show the email container
            $w("#emailContainer").show();

            // Focus the email input
            $w("#emailInput").focus();

            // Smooth scroll to the input field
            $w("#emailInput").scrollTo()
                .then(() => {
                    console.log("Scrolled to email input.");
                })
                .catch((err) => {
                    console.error("Scroll failed:", err);
                });
        });
    });
    //////////////////////////////////////////////////////////////////////////////////////////////////////////end of vew my orders////////////////////////////
    
});

////////////////////////////////////////////////////////////////////////////////////////////email related to view order/////////////////////////////////////////
// Function to validate email format (basic check)
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/////////////////////////////////////////////////////////////////////////////////////////////end of email validation for view orders/////////////////////////////


function addToCart(item, quantity, ownerId) {
    const cartItem = {
        name: item.name,
        price: item.price || 0,
        quantity,
        total: (item.price || 0) * quantity,
        ownerId
    };
    const existing = cart.find(i => i.name === item.name);

    if (existing) {
        existing.quantity += quantity;
        existing.total = existing.price * existing.quantity;
    } else {
        cart.push(cartItem);
    }
    console.log("Cart after addToCart:", cart);
}

function updateCartSummary() {
    console.log("Updating cart summary. Current cart:", cart);
    if (cart.length === 0) {
        $w("#cartSummary").text = "Your cart is empty.";
    } else {
        let summary = "Your Cart:\n";
        let total = 0;
        cart.forEach(item => {
            summary += `${item.quantity} x ${item.name} - ${item.total.toFixed(2)} LE\n`;
            total += item.total;
        });
        summary += `Total: ${total.toFixed(2)} LE`;
        $w("#cartSummary").text = summary;
    }
    $w("#cartSummary").show();
}
