/*
                        --- Content Script ---
The purpose of this script is to handle the main business logic of the extension.
That being downloading the images from the DOM with specified filetypes. The script
queries all anchor tags filters them and then proceeds to download each.

*/

console.log("Zemi is injected and running...");

let downloaded = false; // check if downloaded before updating
let checkboxValues = []; // filetypes to filter when downloading
let downLocation = null;

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

async function downloadImage(link, filename) {
    try {
        const downloadId = await browser.downloads.download({
            url: link, 
            filename: `${downloadLocation}/${filename}`, // browsers implicitly handle download paths so we can use '/' safely
            saveAs: false // automatically save without prompting
        });

        console.log(`Download started with downloadID: ${downloadId}`);
    } catch(error) {
        console.error("The download failed because of: ", error);
    }
}

// async function downloadImage(link, filename) {
//     try {
//         const response = await fetch(link);
//     const blob = await response.blob();
//     const blobURL = URL.createObjectURL(blob);
//     const downloadLink = document.createElement('a');
//     downloadLink.href = blobURL;
//     downloadLink.download = filename;

//     document.body.appendChild(downloadLink);
//     downloadLink.click();

//     // Cleanup
//     document.body.removeChild(downloadLink);
//     URL.revokeObjectURL(blobURL);
//     } catch (error) {
//         console.error("The download has failed because of: ", error);
//     }
// }

// function downloadAllImages(){
//     const aTags = getAndFilterImages();
//     console.log("The download location is: ", downLocation);

//     for(const tag of aTags) {
//         const filename = tag.href.split('/').pop();

//         downloadImage(tag.href, filename);
//     }

//     download = true;
// }

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

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === 'setCheckboxValues') {
        downLocation = message.checkboxValues.pop(); // this retrieves the download location and removes it from the array so checkbox values can be used 
        checkboxValues = message.checkboxValues;
        
        console.log("Recieved checkbox values from background successfully: ", checkboxValues);

        sendAllImagesToDownload();

        sendResponse({ status: "recieved", values: checkboxValues });
    }
});

// function downloadImages(){
//     const aTags = getAndFilterImages();
//     console.log(aTags);

//     // create a temporary anchor tag in dom download it and cleen up
//     aTags.forEach(tag => {
//         //fetch image as blob to circumvent server restrictions and download the image
//         // appending a temporary a tag to the DOM and clicking it doesn't work
//         fetch(tag.href)
//             .then(response => {
//                 if(!response.ok){
//                     throw new Error(`HTTP error! status: ${response.status}`);
//                 }
//                 return response.blob(); // converts response to blob i.e. the image
//             })
//             .then(blob => {
//                 const blobURL = URL.createObjectURL(blob);

//                 const link = document.createElement('a');
//                 link.href = blobURL;
//                 link.download = tag.href.split('/').pop(); // set download name to filename

//                 // simulate click to download images
//                 document.body.appendChild(link);
//                 link.click;

//                 // cleanup of DOM clutter and also frees memory
//                 document.body.removeChild(link);
//                 URL.revokeObjectURL(blobURL);
//             })
//             .catch( error => {
//                 console.error("Error downloading file: ", error);
//                 throw error;
//             });
//     });

//     downloaded = true;
// }

