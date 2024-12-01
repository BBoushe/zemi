browser.tabs.query({active: true, currentWindow: true}).then((tabs) => { // promise
    const activeTabId = tabs[0].id;

    browser.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['zemi.js']
    }).then(() => {
        console.log("Script successfully injected.")
    }).catch(error => {
        console.error("Problem injecting script, because of:", error);
    });
});