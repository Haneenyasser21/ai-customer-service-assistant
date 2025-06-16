import wixLocation from 'wix-location';
import wixData from 'wix-data';
import { session } from 'wix-storage';

let cart = [];
let ownerId;

$w.onReady(async function () {
    // Extract ownerId from URL
    const path = wixLocation.path;
    ownerId = path[path.length - 1];
    console.log("Extracted Owner ID:", ownerId);

    // Load cart from session
    const cartData = session.getItem("cartData");
    if (cartData) {
        cart = JSON.parse(cartData);
    }
    updateCartSummary();

    // Set up event handlers for dropdowns
    $w("#pickupDeliveryDropdown").onChange(() => toggleLocationField());
    $w("#paymentMethodDropdown").onChange(() => toggleVisaFields());
    $w("#placeOrderButton").onClick(placeOrder);

    // Initial visibility check
    toggleLocationField();
    toggleVisaFields();
});

function updateCartSummary() {
    let total = 0;
    const cartItems = cart.map(item => `${item.name} x${item.quantity} - ${item.total.toFixed(2)} LE`).join("\n");
    total = cart.reduce((sum, item) => sum + item.total, 0);
    $w("#cartSummary").text = cartItems || "Cart is empty";
}

function toggleLocationField() {
    const deliveryMethod = $w("#pickupDeliveryDropdown").value;
    $w("#locationInput").show(); // Show by default, hide if pickup
    if (deliveryMethod === "pickup") {
        $w("#locationInput").hide();
        $w("#locationInput").value = ""; // Clear value if hidden
    }
}

function toggleVisaFields() {
    const paymentMethod = $w("#paymentMethodDropdown").value;
    $w("#visaNumberInput").show(); // Show by default, hide if not visa
    $w("#visaPasswordInput").show(); // Show by default, hide if not visa
    if (paymentMethod !== "visa") {
        $w("#visaNumberInput").hide();
        $w("#visaPasswordInput").hide();
        $w("#visaNumberInput").value = ""; // Clear value if hidden
        $w("#visaPasswordInput").value = ""; // Clear value if hidden
    }
}

async function placeOrder() {
    console.log("Placing order...");
    const name = $w("#nameInput").value;
    const phone = $w("#phoneInput").value;
    const email = $w("#emailInput").value;
    const deliveryMethod = $w("#pickupDeliveryDropdown").value;
    const location = $w("#locationInput").value;
    const paymentMethod = $w("#paymentMethodDropdown").value;
    const visaNumber = $w("#visaNumberInput").value;
    const visaPassword = $w("#visaPasswordInput").value;
    const extraNotes = $w("#extraNotesInput").value;

    // Clean the phone number to extract digits
    const cleanedPhone = phone.replace(/\D/g, '');
    const phoneNumber = parseInt(cleanedPhone);

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate inputs
    if (!name || !phone || !email || !deliveryMethod || !paymentMethod || cart.length === 0) {
        $w("#orderMessage").text = "Please fill all required fields and add items to your cart.";
        $w("#orderMessage").show();
        return;
    }
    if (isNaN(phoneNumber) || cleanedPhone.length < 10) {
        $w("#orderMessage").text = "Please enter a valid phone number (at least 10 digits).";
        $w("#orderMessage").show();
        return;
    }
    if (!emailRegex.test(email)) {
        $w("#orderMessage").text = "Please enter a valid email address.";
        $w("#orderMessage").show();
        return;
    }
    if (deliveryMethod === "delivery" && !location) {
        $w("#orderMessage").text = "Please enter your delivery location.";
        $w("#orderMessage").show();
        return;
    }
    if (paymentMethod === "visa") {
        const cleanedVisaNumber = visaNumber.replace(/\D/g, '');
        if (!cleanedVisaNumber || cleanedVisaNumber.length !== 16) {
            $w("#orderMessage").text = "Please enter a valid 16-digit Visa card number.";
            $w("#orderMessage").show();
            return;
        }
        const cleanedVisaPassword = visaPassword.replace(/\D/g, '');
        if (!cleanedVisaPassword || cleanedVisaPassword.length < 3 || cleanedVisaPassword.length > 4) {
            $w("#orderMessage").text = "Please enter a valid CVV (3-4 digits).";
            $w("#orderMessage").show();
            return;
        }
    }

    // Calculate total price
    const totalPrice = cart.reduce((sum, item) => sum + item.total, 0);
    console.log("Cart before order placement:", cart);

    // Generate a custom orderId
    const orderId = `ord${Date.now()}${Math.floor(Math.random() * 1000)}`.toLowerCase();
    console.log("Generated orderId:", orderId);

    // Prepare order data
    const order = {
        orderId: orderId,
        customerName: name,
        customerPhone: phoneNumber,
        customerEmail: email,
        deliveryMethod: deliveryMethod,
        location: deliveryMethod === "delivery" ? location : "",
        paymentMethod: paymentMethod,
        extraNotes: extraNotes || "",
        items: cart,
        totalPrice: totalPrice,
        ownerId: ownerId,
        orderDateTime: new Date()
    };

    // Handle ownerId as both number and string
    const ownerIdStr = String(ownerId); // For text-based ownerId
    const ownerIdNumVal = Number(ownerId); // For number-based ownerId
    console.log("Processing ownerId (string):", ownerIdStr, "and (number):", ownerIdNumVal);

    // Update quantities in MenuItems with dual-type ownerId match
    Promise.all(cart.map(cartItem => {
        console.log("Checking menu item:", cartItem.name, "for ownerId:", ownerId);
        return wixData.query("MenuItems")
            .eq('ownerId', ownerIdStr) // Match as string
            .or(wixData.query('MenuItems').eq('ownerId', ownerIdNumVal)) // Match as number
            .contains('name', cartItem.name.toLowerCase())
            .find()
            .then((results) => {
                if (results.items.length > 0) {
                    const menuItem = results.items[0];
                    console.log("Found menu item:", menuItem);
                    if (menuItem.quantity >= cartItem.quantity) {
                        menuItem.quantity -= cartItem.quantity;
                        return wixData.update("MenuItems", menuItem);
                    } else {
                        throw new Error(`Not enough stock for ${cartItem.name}`);
                    }
                } else {
                    throw new Error(`Menu item ${cartItem.name} not found for owner ${ownerId}`);
                }
            });
    }))
    .then(() => {
        // Save the order to the Orders collection
        return wixData.insert("Orders", order);
    })
    .then(() => {
        // Send order confirmation email
        return fetch('/_functions/sendOrderEmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toEmail: email,
                customerName: name,
                orderId: orderId,
                items: cart,
                totalPrice: totalPrice,
                deliveryMethod: deliveryMethod,
                location: location
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.body === "Email sent successfully") {
                console.log("Email sent successfully:", data.body);
                return Promise.resolve();
            } else {
                console.error("Failed to send email:", data.body);
                $w("#orderMessage").text = `Order placed, but failed to send confirmation email: ${data.body}`;
                $w("#orderMessage").show();
                return Promise.resolve();
            }
        })
        .catch(err => {
            console.error("Error sending email:", err);
            $w("#orderMessage").text = "Order placed, but failed to send confirmation email due to a network error.";
            $w("#orderMessage").show();
            return Promise.resolve();
        });
    })
    .then(() => {
        console.log("Order placed successfully with orderId:", orderId);
        $w("#orderMessage").text = `Order placed successfully for ${name}! Total: ${totalPrice.toFixed(2)} LE`;
        $w("#orderMessage").show();
        cart = [];
        session.removeItem("cartData");
        updateCartSummary();
        $w("#nameInput").value = "";
        $w("#phoneInput").value = "";
        $w("#emailInput").value = "";
        $w("#locationInput").value = "";
        $w("#pickupDeliveryDropdown").value = "pickup";
        $w("#paymentMethodDropdown").value = "cash";
        $w("#visaNumberInput").value = "";
        $w("#visaPasswordInput").value = "";
        $w("#extraNotesInput").value = "";
        $w("#locationInput").hide(); // Reset visibility
        $w("#visaNumberInput").hide(); // Reset visibility
        $w("#visaPasswordInput").hide(); // Reset visibility
        wixLocation.to(`/dynamictracking/${orderId}`);
    })
    .catch((err) => {
        console.error("Error placing order:", err);
        $w("#orderMessage").text = "Error placing order: " + err.message;
        $w("#orderMessage").show();
    });
}
