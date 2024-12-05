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

// This function retrieves the download location and checkbox values
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

// adding an event listener after the DOM has fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');

    form.addEventListener('submit', event => {
        event.preventDefault();

        const checkboxValues = getCheckboxValues();

        // Sending Messages to Background Script
        // pass checkbox values
        browser.runtime.sendMessage({ action: 'passCheckboxValues', checkboxValues }, response => {
            if(response && response.status === 'success'){
                console.log("Checkbox values have been passed to background: ", checkboxValues);

                // send action to inject script
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
});

    // TO-DO:
    // implement the update function of the script