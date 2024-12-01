let downloaded = false; // check if downloaded before updating

function getCheckboxValues(event) {
    const checkboxes = document.querySelectorAll('input[name="file_types"]:checked');
    const values = Array.from(checkboxes).map(checkbox => checkbox.value);
    return values;
}


function downloadImages(){
    event.preventDefault();
    const extValues = getCheckboxValues();
    const aTags =   document.querySelectorAll('a[href=]');
    console.log(aTags);

    downloaded = true;
}

function updateImages(){

}

document.addEventListener('DOMContentLoaded', () => {
    const form = docuemnt.querySelector('from');
    const updateBtn = docuemnt.querySelector('button[type="button"]');

    form.addEventListener('sumbit', (event) => {
        event.preventDefault();
        downloadImages();
    });
    
    updateBtn.addEventListener('click', (event) => {
        event.preventDefault();
        updateImages();
    });
});