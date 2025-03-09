/**
 * Zemi - Bulk Image Downloader Extension
 * 
 * Service Worker Script
 * ---------------------
 * Handles the background logic for managing extension lifecycle, communication, and download tracking.
 * 
 * Responsibilities:
 * - Inject content scripts (zemi.js) into active tabs to process DOMs for image links.
 * - Track and manage downloads, prevent duplicates using CRC32 hash-based tracking.
 * - Maintain persistent or session-specific hash storage to control re-download behavior.
 * - Manage communication between the popup UI, content scripts, and browser APIs.
 * 
 * Features:
 * - Lightweight Hash Deduplication: Avoid redundant downloads by storing file hashes (from name, url and download_location) in persistent storage.
 * - Session Flexibility: Option to clear hashes at restart or retain them for ongoing deduplication.
 * - Download Progress: Tracks and updates the progress dynamically, enabling cancelation of ongoing downloads.
 * 
 * Notes:
 * - Hashes saved in `browser.storage.local` optimize memory usage while maintaining uniqueness.
 * - Restricted by browser sandbox rules; relies on browser APIs for storage and downloads.
 * 
 * Developer Notes:
 * ----------------
 * - Browser sandbox restrictions prevent direct filesystem access. Deduplication relies on hash-based comparisons 
 *   using stored metadata in `browser.storage.local`.
 */


/*                 --- Main Logic ---                   */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

let checkboxValues = [];
let totalDownloads = 0;
let completedDownloads = 0;
let downloadsMetadata = {};
let persistentHashes = new Set();


// Load hashed downloads on browser startup
browser.runtime.onStartup.addListener(() => {
    loadHashesFromStorage();
});

// Listen to download changes -- runs seperatelly from other listeners
browser.downloads.onChanged.addListener(delta => {
    if (delta.state && delta.state.current === "complete") {
        const downloadId = delta.id;

        if(downloadsMetadata[downloadId]){
            const { filename, downloadLocation, url, hash } = downloadsMetadata[downloadId];
            // after downloading add hash to persistent hashes, that will be saved
            persistentHashes.add(hash);
            // clean up
            delete downloadsMetadata[downloadId];
        }
        
        completedDownloads++;
        updateProgressBar();
    }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'passCheckboxValues') {
        checkboxValues = message.checkboxValues;
        console.log("Received checkbox values: ", checkboxValues);
        sendResponse({ status: "success" });

    } else if (message.action === 'injectScript') {
        injectContentScript(sendResponse);

    } else if (message.action === "downloadImages") {
        startDownloadingImages(message.images, message.downloadLocation, sendResponse);

    } else if (message.action === "cancelDownload") {
        cancelAllDownloads(sendResponse);

    } else {
        console.warn("Unknown action received: ", message.action);
        sendResponse({ status: "error", message: "Unknown action" });
    }

    return true; // this is required to use sendResponse asynchronously
});

// Save hashes when the session ends
browser.runtime.onSuspend.addListener(() => {
    saveHashesToStorage();
});


/*              --- Helper Functions ---                */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

// simple crc32 hashing function, this is copied off the internet and not my solution
function crc32(str) {
    const table = new Uint32Array(256).map((_, i) => {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        return c;
    });

    let crc = 0xffffffff;
    for (let i = 0; i < str.length; i++) {
        crc = table[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0; // Ensure unsigned 32-bit integer
}

function generateHash(filename, downloadLocation, url) {
    return crc32(`${filename}|${downloadLocation}|${url}`); // returns 32-bit integer
}

// check if file is present in the hashed values json file
function isFileAlreadyDownloaded(filename, downloadLocation, url) {
    const hash = generateHash(filename, downloadLocation, url);
    return persistentHashes.has(hash);
}

// save hashes to persistent storage
function saveHashesToDownload(){
    browser.storage.local.set({ downloadedHashes: Array.from(persistentHashes) });
}

// load hashes from storage -- used on startup
function loadHashesFromStorage(){
    browser.storage.local.get(['downloadedHashes'], result => {
        const hashes = result.downloadedHashes || [];
        persistentHashes = new Set(hashes);
        console.log("Loaded downloadedHashes from storage: ", persistentHashes);
    });
}

// optional clearing hashed values from file
function clearDownloadHashes() {
    persistentHashes.clear();
    saveHashesToDownload();
    console.log("Download history cleared.");
}

// sends updateProgress to popup.js to update progress bar dynamically
function updateProgressBar() {
    const progressPercentage = Math.round((completedDownloads / totalDownloads) * 100);

    browser.runtime.sendMessage({
        action: "updateProgress",
        progress: progressPercentage
    });
}

// sends startedDownload to popup.js to reveal cancel button
function revealCancelButton() {
    browser.runtime.sendMessage({
        action: "startedDownload"
    });
}

function injectContentScript(sendResponse) {
    // Get the active tab via Tabs API
    browser.tabs.query({ active: true, currentWindow: true }, tabs => {
        const activeTabId = tabs[0].id;

        // Inject zemi.js script
        browser.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content_script.js'] },
            () => {
                // Send the actual values to the zemi.js script
                browser.tabs.sendMessage(tabs[0].id, { action: "setCheckboxValues", checkboxValues }, response => {
                    if (browser.runtime.lastError) {
                        console.error("Error sending message to zemi script:", browser.runtime.lastError.message);
                    } else {
                        console.log("Checkbox values sent to zemi.js", response);
                        sendResponse({ status: 'injected' });
                    }
                });
            }
        );
    });
}

function startDownloadingImages(images, downloadLocation, sendResponse) {
    revealCancelButton();

    // clear the progress bar each time download is issued 
    totalDownloads = 0;
    completedDownloads = 0;
    updateProgressBar();

    if (!images || images.length === 0) {
        console.error("No images to download.");
        sendResponse({ status: "error", message: "No images provided" });
        return;
    }

    // Filter images asynchronously
    Promise.all(images.map(async image => {
        const { url, filename } = image;
        const alreadyDownloaded = await isFileAlreadyDownloaded(filename, downloadLocation, url);
        return alreadyDownloaded ? null : image;
    })).then(filteredImages => { // only filter images that have not been already downloaded
        const imagesToDownload = filteredImages.filter(image => image !== null);

        if (imagesToDownload.length === 0) {
            console.log("No new images to download.");
            sendResponse({ status: "success", message: "No new images found" });
            return;
        } else {
            // download images
            totalDownloads = imagesToDownload.length;
            updateProgressBar();

            imagesToDownload.forEach(image => {
                const { url, filename } = image;
                const hash = generateHash(filename, downloadLocation, url);

                browser.downloads.download({
                    url: url,
                    filename: `${downloadLocation}/${filename}`,
                    saveAs: false
                }).then(downloadId => { // save image metadata to downloadsMetadata
                    downloadsMetadata[downloadId] = { filename, downloadLocation, url, hash};
                }).catch(error => {
                    console.log(`Failed to download ${filename}:`, error);
                });
            });

            sendResponse({ status: "success", message: "Download initiated" });
        }
    }).catch(error => {
        console.error("Error filtering images:", error);
        sendResponse({ status: "error", message: "Error during download process" });
    });
}

function cancelAllDownloads(sendResponse) {
    console.log("Canceling all downloads");

    // Search for all in-progress downloads
    browser.downloads.search({ state: "in_progress" }).then(downloads => {
        downloads.forEach(download => {
            browser.downloads.cancel(download.id).catch(error => {
                console.error(`Failed to cancel download ID ${download.id}:`, error);
            });
        });

        // Reset download tracking
        totalDownloads = 0;
        completedDownloads = 0;
        updateProgressBar();

        sendResponse({ status: 'canceled' });
    }).catch(error => {
        console.error("Failed to retrieve active downloads:", error);
        sendResponse({ status: 'error', message: error.message });
    });
}