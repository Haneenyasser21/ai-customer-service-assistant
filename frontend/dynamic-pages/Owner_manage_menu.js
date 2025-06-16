import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(function () {
    console.log("Owner Manage Menu page loaded at:", new Date().toLocaleString("en-US", { timeZone: "Europe/Athens" }));

    // Extract ownerId from URL path
    const path = wixLocation.path;
    const ownerId = decodeURIComponent(path[path.length - 1]);
    console.log("Owner ID from URL path:", ownerId);

    if (!ownerId) {
        console.error("No ownerId provided in URL. Path:", path);
        $w("#statusText").text = "Error: No owner specified.";
        $w("#statusText").show();
        return;
    }

    // Query the MenuItems collection with all fields, handling both number and text ownerId
    const ownerIdStr = String(ownerId); // Ensure string format
    const ownerIdNum = Number(ownerId); // Convert to number for numeric match
    console.log("Querying with ownerId (string):", ownerIdStr, "and (number):", ownerIdNum);

    wixData.query("MenuItems")
        .eq("ownerId", ownerIdStr) // Match as string
        .or(wixData.query("MenuItems").eq("ownerId", ownerIdNum)) // Match as number
        .limit(1000)
        .find()
        .then((results) => {
            console.log("Menu items query results with all fields:", results.items);
            if (results.items.length > 0) {
                const repeaterData = results.items.map(item => {
                    const mappedItem = {
                        _id: item._id, // Menu item ID
                        name: item.name || "Unnamed Item",
                        description: item.description || "No description",
                        quantity: item.quantity || 0,
                        price: item.price || 0,
                        image: item.image || '',
                        ownerId: item.ownerId || ownerId, // Ensure ownerId is included
                        itemid: item.itemid || '' // Explicitly map itemid
                    };
                    console.log("Mapped item for Repeater with _id and itemid:", mappedItem);
                    return mappedItem;
                });
                $w("#menuRepeater").data = repeaterData;
                console.log("Repeater data set:", repeaterData);
                $w("#statusText").text = "Menu items loaded successfully.";
                $w("#statusText").show();
            } else {
                $w("#menuRepeater").data = [];
                $w("#statusText").text = "No menu items found for this owner.";
                $w("#statusText").show();
                console.log("No menu items found for ownerId:", ownerId);
            }
        })
        .catch((err) => {
            console.error("Error fetching menu items:", err);
            $w("#statusText").text = "Error loading menu items.";
            $w("#statusText").show();
        });

    // Set up the save button and upload image button event handler for each Repeater item
    $w("#menuRepeater").onItemReady(($item, itemData, index) => {
        console.log("Repeater item data with _id and itemid:", itemData);
        $item("#foodImage").src = itemData.image || '';
        $item("#textName").text = itemData.name || "Unnamed Item";
        $item("#descriptionInput").value = itemData.description || "No description";
        $item("#quantityInput").value = itemData.quantity || 0;
        $item("#priceInput").value = itemData.price || 0;

        // Upload image button handler (using Upload Button)
        $item("#uploadImage").onChange((event) => {
            console.log("Upload image triggered for item:", itemData._id);
            const uploadedFile = event.target.value[0]; // Get the first uploaded file
            if (uploadedFile) {
                $item("#uploadImage").startUpload()
                    .then((result) => {
                        console.log("Upload result:", result); // Debug the full result object
                        if (!result.url) {
                            throw new Error("No URL found in upload result");
                        }
                        return { url: result.url, itemId: itemData._id }; // Return URL and itemId
                    })
                    .then(({ url, itemId }) => {
                        const updatedImageUrl = url; // Assign the URL
                        return wixData.get("MenuItems", itemId).then((originalItem) => ({
                            originalItem,
                            updatedImageUrl
                        }));
                    })
                    .then(({ originalItem, updatedImageUrl }) => {
                        const updatedItem = {
                            ...originalItem,
                            image: updatedImageUrl // Update the image field
                        };
                        console.log("Updated item with new image URL:", updatedItem);
                        return wixData.update("MenuItems", updatedItem).then(() => updatedImageUrl); // Return updatedImageUrl
                    })
                    .then((updatedImageUrl) => {
                        console.log("Image updated successfully in database");
                        $item("#statusText").text = "Image uploaded and saved!";
                        $item("#statusText").show();
                        setTimeout(() => $item("#statusText").hide(), 2000);
                        $item("#foodImage").src = updatedImageUrl; // Update the displayed image
                    })
                    .catch((error) => {
                        console.error("Error uploading or updating image:", error);
                        $item("#statusText").text = "Error uploading image: " + error.message;
                        $item("#statusText").show();
                    });
            }
        });

        // Save button handler
        $item("#saveButton").onClick(() => {
            console.log("Save button clicked for menu item:", itemData);
            console.log("Menu item _id and itemid before update:", itemData._id, itemData.itemid);
            if (!itemData._id) {
                $item("#statusText").text = "No menu item ID specified for update.";
                $item("#statusText").show();
                console.error("No _id found in itemData for update");
                return;
            }

            // Fetch the original item to ensure all fields are included
            wixData.get("MenuItems", itemData._id)
                .then((originalItem) => {
                    const updatedItem = {
                        ...originalItem,
                        quantity: parseInt($item("#quantityInput").value) || 0,
                        price: parseFloat($item("#priceInput").value) || 0,
                        description: $item("#descriptionInput").value || "No description"
                    };
                    console.log("Updated item with all fields:", updatedItem);
                    wixData.update("MenuItems", updatedItem)
                        .then(() => {
                            console.log('Item updated successfully');
                            $item("#statusText").text = 'Saved';
                            $item("#statusText").show();
                            setTimeout(() => $item("#statusText").hide(), 2000);
                        })
                        .catch((error) => {
                            console.error('Error updating item:', error);
                            $item("#statusText").text = 'Error saving';
                            $item("#statusText").show();
                        });
                })
                .catch((err) => {
                    console.error("Error fetching original item:", err);
                    $item("#statusText").text = "Error loading item for update.";
                    $item("#statusText").show();
                });
        });
    });
});
