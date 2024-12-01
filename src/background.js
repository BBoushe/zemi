/*
                        --- Service Worker Script ---
The purpose of this script is to handle extension lifecycle as well as run in the
background listening for when the content_script.js should be injected into the
currently active tab.

- The script that will be injected will be the content_script.js which will be
refered to as zemi.js from here on, since it's the main business logic of the
extension

*/

let checkboxValues = [];

// Specificly designed function for passing messages between extensions and browsers
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === 'passCheckboxValues') {
        checkboxValues = message.checkboxValues;
        console.log("Recieved checkbox values: ", checkboxValues);

        sendResponse({ status: "success"});
    } 
    else if (message.action === 'injectScript') {
        // Get the active tab via Tabs API
        browser.tabs.query({ active: true, currentWindow: true }, tabs => {
            const activeTabId = tabs[0].id;

            // Inject zemi.js script
            browser.scripting.executeScript(
                { // pass in object literal as arg
                    target: { tabId: activeTabId },
                    files: ['content_script.js']
                }, 
                () => {
                    console.log("Zemi script successfully injected.");

                    // send the actual values to the zemi.js script
                    browser.tabs.sendMessage(tabs[0].id, { action: "setCheckboxValues", checkboxValues }, response => {
                        if(browser.runtime.lastError){
                            console.error("Error sending message to zemi script:", chrome.runtime.lastError.message);
                        } else {
                            console.log("Checkbox values sent to zemi.js", response);
                        }
                    });
                }  
            );
        });

        sendResponse({ status: 'injected' });
    }

    return true; // this is required to use sendResponse asyncroniously, but it's not a complex
        // callback function so we don't really need it here, but will keep for future work
});