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

// adding an event listener after the DOM has fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form')
})