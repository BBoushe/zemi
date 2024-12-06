/*
                        --- Service Worker Script ---
The purpose of this script is to handle extension lifecycle as well as run in the
background listening for when the content_script.js should be injected into the
currently active tab.

- The script that will be injected will be the content_script.js which will be
refered to as zemi.js from here on, since it's the main business logic of the
extension

- Because of security restrictions, browsers are a closed sandbox so extensions,
cannot have access to the filesystem. Therefore we cannot check to see if a file
has or has not been downloaed in a simple way. There are generally two approaches:
1. check the download.downloads.search() api and see if the filename url combination
is present there if it is skip it. A problem with this approach is that download
location cannot be factored in, so an Image downloaded once cannot be downloaded again.
This approach is suitable for a singular download location, if the assumption is that
the user downloads all images in a single folder and then organizes them himself
2. Keeping a file containing the hash of the filename, url and down_location of
every file, if the file is present there don't download it. This while might be memory
inefficient the file size having downloaded 1000 images would be 4KB which is negligible.
I have opted for this solution, a potential drawback to this solution is that if the folder
or file is deleted at some point the file will still contain record of those files and will
not download them again. There are two solutions to this. 
    1. Ignore it, meaning that we assume that the user won't want to download those same images
    again. 
    2. Clear this file when the browser is closed, this approach is not perfect but balanced,
    assuming that scenarios when the user closes the browser, deletes or moves the files or folders and then
    reopenes the browser to download those same files is rare. I.e. the user is rarelly going to
    be in the scenario where he downloads images, closes the browser and then reopenes the browser,
    opens the exact same website or thread to download those images without having moved or deleted his files

*/

/*                 --- Main Logic ---                   */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

let checkboxValues = [];
let totalDownloads = 0;
let completedDownloads = 0;
let downloadedHashes = [];
let downloadsMetadata = {};

// Clear hashed downloads on browser startup
browser.runtime.onStartup.addListener(() => {
    clearDownloadHashes();
});

// initialize the downloaded hashes array
browser.storage.local.get(['downloadedHashes'], result => {
    downloadedHashes = result.downloadedHashes || [];
});

// Listen to download changes -- runs seperatelly from other listeners
browser.downloads.onChanged.addListener(delta => {
    if (delta.state && delta.state.current === "complete") {
        const downloadId = delta.id;

        if(downloadsMetadata[downloadId]){
            const { filename, downloadLocation, url } = downloadsMetadata[downloadId];
            // after downloading add hash to metadata
            addDownloadedFile(filename, downloadLocation, url);
            // clean up
            delete downloadsMetadata[downloadId];
        }
        
        completedDownloads++;
        updateProgressBar();
    }
});

// Specificly designed function for passing messages between extensions and browsers i.e. 
// addListener is used between scripts APIs and addEventListener between script and UI elems
// browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === 'passCheckboxValues') {
//         checkboxValues = message.checkboxValues;
//         console.log("Recieved checkbox values: ", checkboxValues);

//         sendResponse({ status: "success" });
//     } else if (message.action === 'injectScript') {
//         // Get the active tab via Tabs API
//         browser.tabs.query({ active: true, currentWindow: true }, tabs => {
//             const activeTabId = tabs[0].id;

//             // Inject zemi.js script
//             browser.scripting.executeScript(
//                 { // pass in object literal as arg
//                     target: { tabId: activeTabId },
//                     files: ['content_script.js']
//                 },
//                 () => {
//                     // send the actual values to the zemi.js script
//                     browser.tabs.sendMessage(tabs[0].id, { action: "setCheckboxValues", checkboxValues }, response => {
//                         if (browser.runtime.lastError) {
//                             console.error("Error sending message to zemi script:", browser.runtime.lastError.message);
//                         } else {
//                             console.log("Checkbox values sent to zemi.js", response);
//                         }
//                     });
//                 }
//             );
//         });
//         sendResponse({ status: 'injected' });
//     } else if (message.action === "downloadImages") {
//         const { images, downloadLocation } = message; // construct a object literal to be used from message object

//         if (!images || images.length === 0) {
//             console.error("No images to download.");
//             sendResponse({ status: "error", message: "No images provided" });
//             return;
//         }

//         Promise.all(images.map(async image => {
//             const { url, filename } = image;
//             const alreadyDownloaded = await isFileAlreadyDownloaded(filename , url);
//             return alreadyDownloaded ? null : image;
//         })).then(filteredImages => {
//             const imagesToDownload = filteredImages.filter(image => image !== null)
//         })

//         totalDownloads = images.length;
//         updateProgressBar();

//         images.forEach(image => {
//             const { url, filename } = image;

//             browser.downloads.download({
//                 url: url,
//                 filename: `${downloadLocation}/${filename}`,
//                 saveAs: false
//             }).catch(error => {
//                 console.log(`Failed to download ${filename}:`, error);
//             });
//         });

//         sendResponse({ status: "success", message: "Download initiated" });
//     } else {
//         console.warn("Unknown action recieved: ", message.action);
//         sendResponse({ status: "error", message: "Unknown action" });
//     }

//     return true; // this is required to use sendResponse asyncroniously
// });

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

// hashes filename and download location, this is enough consisdering filename is {down_loc/filename}
function generateHash(filename, downloadLocation, url) {
    return crc32(`${filename}|${downloadLocation}|${url}`); // returns 32-bit integer
}

// check if file is present in the hashed values json file, hence had been downloaded during this session
function isFileAlreadyDownloaded(filename, downloadLocation, url) {
    return new Promise(resolve => {
        const hash = generateHash(filename, downloadLocation, url);
        resolve(downloadedHashes.includes(hash));
    });
}


function addDownloadedFile(filename, downloadLocation, url) {
    const hash = generateHash(filename, downloadLocation, url);
    if (!downloadedHashes.includes(hash)) {
        downloadedHashes.push(hash);
        saveDownloadedHashes();
    }
}

function updateProgressBar() {
    const progressPercentage = Math.round((completedDownloads / totalDownloads) * 100);

    browser.runtime.sendMessage({
        action: "updateProgress",
        progress: progressPercentage
    });
}

function saveDownloadedHashes() {
    browser.storage.local.set({ downloadedHashes });
}

function clearDownloadHashes() {
    downloadedHashes = [];
    saveDownloadedHashes();
    console.log("Download history cleared.");
}

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
    })).then(filteredImages => {
        const imagesToDownload = filteredImages.filter(image => image !== null);

        if (imagesToDownload.length === 0) {
            console.log("No new images to download.");
            sendResponse({ status: "success", message: "No new images found" });
            return;
        } else {
            totalDownloads = imagesToDownload.length;
            updateProgressBar();

            imagesToDownload.forEach(image => {
                const { url, filename } = image;

                browser.downloads.download({
                    url: url,
                    filename: `${downloadLocation}/${filename}`,
                    saveAs: false
                }).then(downloadId => {
                    downloadsMetadata[downloadId] = { filename, downloadLocation, url};
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
