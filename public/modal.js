// share-modal-start
const openModalButtons = document.querySelectorAll('[data-modal-target]')
const closeModalButtons = document.querySelectorAll('[data-close-button]')
const overlay = document.getElementById('overlay')
const linkText = document.getElementById('link')
const copyButton = document.getElementById('copy')
const shareButton = document.getElementById('share')
linkText.innerHTML = "Room Id: " + ROOM_ID
const url = new URL(window.location.href);
url.searchParams.delete("admin"); // remove admin param
console.log(url.toString());
const shareData = {
    title: "Group Call",
    text: "Join The Group Call",
    url: url.toString(),
};


copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(url.toString())
})
shareButton.addEventListener('click', () => {
    navigator.share(shareData);
})

openModalButtons.forEach(button => {
    button.addEventListener('click', () => {
        const modal = document.querySelector(button.dataset.modalTarget)
        openModal(modal)
    })
})

overlay.addEventListener('click', () => {
    const modals = document.querySelectorAll('.modal.active')
    modals.forEach(modal => {
        closeModal(modal)
    })
})

closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal')
        closeModal(modal)
    })
})

function openModal(modal){
    if (modal == null) return
    modal.classList.add('active')
    overlay.classList.add('active')

}
function closeModal(modal){
    if (modal == null) return
    modal.classList.remove('active')
    overlay.classList.remove('active')

}
// share-modal-end