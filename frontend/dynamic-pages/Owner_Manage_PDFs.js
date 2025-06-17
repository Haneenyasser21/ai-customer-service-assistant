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
        const filenameWithExtension = fileUrlParts[fileUrlParts.length - 1]; // Get the last part
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
                $w("#statusMessage").show();
                return;
            }

            // Generate versions of fileUrl for comparison
            const rawFileUrl = itemData.fileUrl; // Original URL as stored
            const baseUrl = rawFileUrl.substring(0, rawFileUrl.lastIndexOf('/') + 1); // Extract base URL up to filename
            const filenamePart = decodeURIComponent(filenameWithExtension).toLowerCase(); // Filename with extension, decoded
            const encodedFilenamePart = encodeURIComponent(filenamePart); // Encoded filename
            console.log("Attempting to delete PDF with _id:", itemData._id,
                       "baseUrl:", baseUrl,
                       "filenamePart:", filenamePart,
                       "encodedFilenamePart:", encodedFilenamePart);

            wixData.remove("PDFs", itemData._id)
                .then(() => {
                    console.log("PDF deleted, now querying MenuItems with sourcePdfUrl:");
                    // Run queries based on filename and full URL
                    const queries = [
                        wixData.query("MenuItems").contains("sourcePdfUrl", filenamePart).find(), // Match filename
                        wixData.query("MenuItems").contains("sourcePdfUrl", encodedFilenamePart).find(), // Match encoded filename
                        wixData.query("MenuItems").contains("sourcePdfUrl", `${baseUrl}${filenamePart}`).find(), // Match full URL with decoded filename
                        wixData.query("MenuItems").contains("sourcePdfUrl", `${baseUrl}${encodedFilenamePart}`).find() // Match full URL with encoded filename
                    ];

                    return Promise.all(queries)
                        .then(([filenameResults, encodedFilenameResults, fullUrlResults, encodedFullUrlResults]) => {
                            // Combine all results and remove duplicates
                            const allMatches = [
                                ...filenameResults.items,
                                ...encodedFilenameResults.items,
                                ...fullUrlResults.items,
                                ...encodedFullUrlResults.items
                            ].filter((item, index, self) => 
                                index === self.findIndex((t) => t._id === item._id)
                            );

                            console.log("Combined query results for MenuItems:", allMatches.length, "items found");
                            console.log("Matching items sourcePdfUrl values (raw):", allMatches.map(item => item.sourcePdfUrl));

                            if (allMatches.length > 0) {
                                console.log("Items to delete from MenuItems:", allMatches);
                                const deletePromises = allMatches.map(item =>
                                    wixData.remove("MenuItems", item._id)
                                );
                                return Promise.all(deletePromises)
                                    .then(() => console.log("All MenuItems deleted successfully"))
                                    .catch((err) => console.error("Error in bulk delete:", err));
                            } else {
                                console.log("No MenuItems found with any match for sourcePdfUrl:", `${baseUrl}${filenamePart}`);
                                // Additional debug: Fetch all MenuItems to inspect sourcePdfUrl values
                                return wixData.query("MenuItems")
                                    .find()
                                    .then((allMenuItems) => {
                                        console.log("All MenuItems sourcePdfUrl values:", allMenuItems.items.map(item => ({
                                            id: item._id,
                                            sourcePdfUrl: item.sourcePdfUrl
                                        })));
                                    });
                            }
                        });
                })
                .then(() => {
                    $item("#statusMessage").text = "PDF and associated menu items deleted successfully.";
                    $w("#statusMessage").show();
                    setTimeout(() => {
                        $w("#pdfsRepeater").data = $w("#pdfsRepeater").data.filter(item => item._id !== itemData._id);
                    }, 1000);
                })
                .catch((err) => {
                    console.error("Error deleting PDF or menu items:", err);
                    $item("#statusMessage").text = "Error deleting PDF or menu items: " + err.message;
                    $w("#statusMessage").show();
                });
        });
    });
});
