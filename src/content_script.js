/*
                        --- Content Script ---
The purpose of this script is to handle the main business logic of the extension.
That being downloading the images from the DOM with specified filetypes. The script
queries all anchor tags filters them and then proceeds to download each.

*/

console.log("Zemi is injected and running...");

let downloaded = false; // check if downloaded before updating
let checkboxValues = []; // filetypes to filter when downloading

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

function downloadImages(){
    const aTags = getAndFilterImages();

    // create a temporary anchor tag in dom download it and cleen up
    aTags.forEach(tag => {
        //fetch image as blob to circumvent server restrictions and download the image
        // appending a temporary a tag to the DOM and clicking it doesn't work
        fetch(tag.href)
            .then(response => {
                if(!response.ok){
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob(); // conerts response to blob i.e. the image
            })
            .then(blob => {
                const blobURL = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = blobURL;
                link.download = tag.href.split('/').pop(); // set download name to filename

                // simulate click to download images
                document.body.appendChild(link);
                link.click;

                // cleanup of DOM clutter and also frees memory
                document.body.removeChild(link);
                URL.revokeObjectURL(blobURL);
            })
            .catch( error => {
                console.error("Error downloading file: ", error);
                throw error;
            });
    });

    downloaded = true;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === 'setCheckboxValues') {
        checkboxValues = message.checkboxValues;
        console.log("Recieved checkbox values from background successfully: ", checkboxValues);

        downloadImages();

        sendResponse({ status: "recieved", values: checkboxValues });
    }
});