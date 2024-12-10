/**
 * Zemi - Bulk Image Downloader Extension
 * 
 * Popup Script
 * ------------
 * Acts as a controller between the popup UI and the background script. Manages user input, 
 * triggers content script injection, and handles download progress updates.
 * 
 * Responsibilities:
 * - Collect user-selected file types and download location from the popup form.
 * - Send configuration to the background script and initiate content script (zemi.js) injection.
 * - Handle cancelation and update the UI dynamically (e.g. progress bar, cancel button).
 * 
 * Features:
 * - Bridges the popup UI and the background service worker.
 * - Updates download progress in real time within the popup.
 * - Allows users to stop downloads with immediate UI reset.
 * 
 * Notes:
 * - The zemi.js script processes the active tab DOM and is injected via the background script.
 * - Only this script interacts directly with the popup DOM.
 * 
 */


/*                 --- Main Logic ---                   */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const cancelButton = document.getElementById("cancelButton");
    const progressBar = document.getElementById("downloadProgressBar");

    form.addEventListener('submit', event => {
        event.preventDefault();

        const checkboxValues = getCheckboxValues();

        // start progress bar listener listener after we've submitted
        startProgressBarListener();

        // Sending Messages to Background Script
        // pass checkbox values
        browser.runtime.sendMessage({ action: 'passCheckboxValues', checkboxValues }, response => {
            if(response && response.status === 'success'){
                console.log("Checkbox values have been passed to background: ", checkboxValues);

                // inject script
                browser.runtime.sendMessage({ action: 'injectScript' }, response => {
                    if(response && response.status === 'injected') {
                        console.log("Zemi injection initiated.");
                    } else {
                        console.error("Failed to inject script.");
                    }
                });
            } else {
                console.error("Failed to pass checkbox values to background script.")
            }
        });
    });

    cancelButton.addEventListener('click', () => {
        browser.runtime.sendMessage({ action: 'cancelDownload' }, response => {
            if(response && response.status === "canceled"){
                console.log("Successfully canceled download");
            } else {
                console.error("Cancel failed because of: ", error);
            }
        });


        // Reset the UI
        cancelButton.style.display = "none"; // Hide cancel button
        progressBar.style.width = "0%"; // Reset progress bar
        progressBar.setAttribute("aria-valuenow", "0");
        progressBar.textContent = "0%";
    });
});


/*              --- Helper Functions ---                */
/*              ------------------------                */
/*              ------------------------                */
/*              ------------------------                */

// retrieves the download location and checkbox values
// this decision has been made to reduce cross-script calls and message handling
function getCheckboxValues() {
    // checkbox values
    const checkboxes = document.querySelectorAll('input[name="file_types"]:checked');
    const values = Array.from(checkboxes).map(checkbox => checkbox.value);

    // download location 
    const downLocation = document.querySelector('input[name="down_loc"]').value; // convert input value into single value
    values.push(downLocation); // append download_loc and then remove it

    return values;
}

function startProgressBarListener() {
    // update progress bar dynamically
    browser.runtime.onMessage.addListener(message => {
        if(message.action === "updateProgress") {
            const progressBar = document.getElementById("downloadProgressBar");
            progressBar.style.width = `${message.progress}%`;
            progressBar.setAttribute("aria-valuenow", message.progress);
            progressBar.textContent = `${message.progress}%`;
        } else if(message.action === 'startedDownload') {
            const cancelButton = document.getElementById("cancelButton");
            cancelButton.style.display = "block";
        }
    });
}
