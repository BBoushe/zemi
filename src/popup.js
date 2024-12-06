/*
                            --- Popup Script ---
The purpose of this script is to act as a controller between the bacground script
and and when the injection needs to happen. The popup listens for the submission
event and then sends a message (part of the args) to the background script, 
triggering the action.

- The script that will be injected will be the content_script.js which will be
refered to as zemi.js from here on, since it's the main business logic of the
extension

- This is the only script that we run in the popup DOM because the background
service worker runs independently of the extensions DOM, and the zemi.js script
is meant to work on the DOM of the active tab so it's run when necessary
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
