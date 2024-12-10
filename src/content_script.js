/**
 * Zemi - Bulk Image Downloader Extension
 * 
 * Content Script
 * --------------
 * Core logic for interacting with the active tab's DOM, locating image links 
 * based on user-defined file types, and sending them to the background script 
 * for downloading.
 * 
 * Responsibilities:
 * - Scan the DOM for `<a>` tags, filter by file type, and exclude invalid links.
 * - Communicate with the background script for downloading due to API restrictions.
 * 
 * Features:
 * - Dynamic file type filtering based on user preferences.
 * - Context-aware link processing with customizable logic for specific websites.
 * 
 * Notes:
 * - Extending support for new websites requires modifying `getAndFilterImages`.
 * - Operates within content script restrictions (e.g., no direct access to `downloads` API).
 */


/*                 --- Main Logic ---                   */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

console.log("Zemi is injected and running...");

let checkboxValues = []; // filetypes to filter when downloading
let downLocation = null;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === 'setCheckboxValues') {
        downLocation = message.checkboxValues.pop(); // this retrieves the download location and removes it from the array so checkbox values can be used 
        checkboxValues = message.checkboxValues;
        
        console.log("Recieved checkbox values from background successfully: ", checkboxValues);

        sendAllImagesToDownload();

        sendResponse({ status: "recieved", values: checkboxValues });
    }
});


/*              --- Helper Functions ---                */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

// function to get, filter and prepare href links so they can be downloaded in downloadImgaes() ftion
function getAndFilterImages(){
    const aTags = document.querySelectorAll('a');
    const filteredATags = [];

    for(const tag of aTags) {
        // checks if for at least one item in the checkboxValues array the condition passes, i.e. that the tag includes .type
        // type is an element of the array some goes through all elems and when true is returned returns true itself
        const isValidFileType = checkboxValues.some( type => tag.href.includes("."+type)); 

        if(isValidFileType){
            const isValidClass = !tag.classList.contains("fileThumb"); // this is 4chan specific, potentially could have a list which is a "blacklist" of classes or properties on common websites
            if(isValidClass){
                filteredATags.push(tag);
            }
        }
    }

    return filteredATags;
}

// sends all images to background.js script in order to access downloads API
function sendAllImagesToDownload(){
    const aTags = getAndFilterImages();
    const imageLinks = aTags.map(tag => ({ // returns an object for each a tag that has only the link and the filename
        url: tag.href,
        filename: tag.href.split('/').pop()
    }));

    // Send images to background script to download --> reason: downloads API not available to content scripts
    browser.runtime.sendMessage({ action: "downloadImages", images: imageLinks, downloadLocation: downLocation }, response => {
        if(browser.runtime.lastError) {
            console.error("Error in communicating with background script: ", browser.runtime.lastError.message);
        } else {
            console.log("Background script message: ", response);
        }
    });
}

