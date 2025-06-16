import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(function () {
    // Extract ownerId from URL and convert to string for consistent comparison
    const path = wixLocation.path;
    const ownerId = decodeURIComponent(path[path.length - 1]).toString();
    console.log("Owner ID from URL (as string):", ownerId);

    if (!ownerId) {
        $w("#statusMessage").text = "Error: No owner specified.";
        $w("#statusMessage").show();
        return;
    }

    // Query PDFs for the specific owner, handling both string and numeric ownerId
    wixData.query("PDFs")
        .find()
        .then((results) => {
            // Filter items where ownerId (as string) matches the ownerId from URL
            const matchingPdfs = results.items.filter(item => {
                const dbOwnerIdStr = item.ownerId.toString(); // Convert database ownerId to string
                return dbOwnerIdStr === ownerId;
            });

            if (matchingPdfs.length > 0) {
                const repeaterData = matchingPdfs.map(item => ({
                    _id: item._id,
                    fileUrl: item.fileUrl
                }));
                $w("#pdfsRepeater").data = repeaterData;
                $w("#statusMessage").text = "PDFs loaded successfully.";
                $w("#statusMessage").show();
            } else {
                $w("#pdfsRepeater").data = [];
                $w("#statusMessage").text = "No PDFs uploaded for this owner.";
                $w("#statusMessage").show();
            }
        })
        .catch((err) => {
            console.error("Error fetching PDFs:", err);
            $w("#statusMessage").text = "Error loading PDFs: " + err.message;
            $w("#statusMessage").show();
        });

    // Set up download and delete button event handlers
    $w("#pdfsRepeater").onItemReady(($item, itemData, index) => {
        // Extract the filename from fileUrl and set it as the title
        const fileUrlParts = itemData.fileUrl.split('/');
        const filenameWithExtension = fileUrlParts[fileUrlParts.length - 1]; // Get the last part (e.g., menudescrip.pdf or Seafood%20%20%20%20%20%2012%20%20%20%20%20%202012%20EGP.pdf)
        const decodedFilename = decodeURIComponent(filenameWithExtension); // Decode %20 to spaces, etc.
        const filename = decodedFilename.replace('.pdf', ''); // Remove .pdf

        // Check if the decoded filename contains % (indicating encoding issues) and set title accordingly
        const title = filename.includes('%') ? 'Unnamed Document' : filename.trim();

        $item("#title").text = title;

        $item("#downloadPdfButton").label = "Download PDF";
        $item("#downloadPdfButton").onClick(() => {
            wixLocation.to(itemData.fileUrl); // Trigger download by navigating to fileUrl
        });

        $item("#deletePdfButton").onClick(() => {
            if (!itemData._id) {
                $item("#statusMessage").text = "Error: No PDF ID specified for deletion.";
                $item("#statusMessage").show();
                return;
            }

            const normalizedFileUrl = decodeURIComponent(itemData.fileUrl.trim().toLowerCase()); // Aggressive normalization
            console.log("Attempting to delete PDF with _id:", itemData._id, "and normalized fileUrl:", normalizedFileUrl);

            wixData.remove("PDFs", itemData._id)
                .then(() => {
                    console.log("PDF deleted, now querying MenuItems with sourcePdfUrl:", normalizedFileUrl);
                    return wixData.query("MenuItems")
                        .eq("sourcePdfUrl", normalizedFileUrl) // Focus on sourcePdfUrl only
                        .find()
                        .then((menuItemsResults) => {
                            console.log("Query results for MenuItems:", menuItemsResults.items.length, "items found");
                            console.log("Matching items sourcePdfUrl values:", menuItemsResults.items.map(item => item.sourcePdfUrl));
                            const menuItemsToDelete = menuItemsResults.items;
                            if (menuItemsToDelete.length > 0) {
                                console.log("Items to delete from MenuItems:", menuItemsToDelete);
                                const deletePromises = menuItemsToDelete.map(item =>
                                    wixData.remove("MenuItems", item._id)
                                );
                                return Promise.all(deletePromises)
                                    .then(() => console.log("All MenuItems deleted successfully"))
                                    .catch((err) => console.error("Error in bulk delete:", err));
                            } else {
                                console.log("No MenuItems found to delete with sourcePdfUrl:", normalizedFileUrl);
                            }
                        });
                })
                // .then(() => {
                //     $item("#statusMessage").text = "PDF and associated menu items deleted successfully.";
                //     $item("#statusMessage").show();
                //     setTimeout(() => {
                //         $w("#pdfsRepeater").data = $w("#pdfsRepeater").data.filter(item => item._id !== itemData._id);
                //     }, 1000);
                // })
                .then(() => {
    $item("#statusMessage").text = "PDF and associated menu items deleted successfully.";
    $item("#statusMessage").show();

    setTimeout(async () => {
        const newRepeaterData = $w("#pdfsRepeater").data.filter(item => item._id !== itemData._id);
        $w("#pdfsRepeater").data = newRepeaterData;

        if (newRepeaterData.length === 0) {
            console.log("No PDFs remaining — clearing QR code from Owners");

            try {
                // Find owner item by ID
                const ownerResult = await wixData.query("Owners")
                    .eq("id", parseInt(ownerId)) // assuming id is numeric
                    .find();

                if (ownerResult.items.length > 0) {
                    const ownerItem = ownerResult.items[0];
                    const updatedOwner = {
                        ...ownerItem,
                        qRcodeUrl: null,
                        customerUrl: null
                    };

                    await wixData.update("Owners", updatedOwner);
                    console.log("Owner record updated: QR code and customer URL cleared.");
                } else {
                    console.warn("Owner not found while trying to clear QR.");
                }
            } catch (err) {
                console.error("Error clearing QR code from Owners:", err);
            }
        }
    }, 1000);
})

                .catch((err) => {
                    console.error("Error deleting PDF or menu items:", err);
                    $item("#statusMessage").text = "Error deleting PDF or menu items: " + err.message;
                    $item("#statusMessage").show();
                });
        });
    });
});
