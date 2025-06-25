mport { processOwnerPDF } from 'backend/openaiService.jsw';


$w.onReady(() => {
    $w("#uploadButton1").onChange(async () => {
        const files = $w("#uploadButton1").value;
        if (files.length === 0) return;

        try {
            // Upload the file to Wix
            const uploadResults = await $w("#uploadButton1").uploadFiles();
            if (uploadResults.length) {
                const fileUrl = uploadResults[0].fileUrl;
                const fileName = files[0].name;
                console.log("Internal File URL:", fileUrl);

                // Get the public URL
                const publicUrl = await getPublicUrl(fileUrl);
                console.log("Public File URL:", publicUrl);

                // Get the current item
                const dataset = $w("#dynamicDataset");
                const currentItem = await dataset.getCurrentItem();

                // Define assistant name
            const assistantName = currentItem.ownerName || "DefaultAssistant";

            // Process the PDF
            await processOwnerPDF(publicUrl, fileName, currentItem, assistantName);

            }
        } catch (error) {
            console.error("Error during upload:", error);
        }
    });
});
