function showModal(title, message, isError = true, onConfirm = null) {
    const modalContainer = document.getElementById('modal-container');
    const modalId = `modal-${Date.now()}`;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = modalId;
    
    let buttonsHtml = `<button id="close-${modalId}">CHIUDI</button>`;
    if (onConfirm) {
        buttonsHtml = `<button id="confirm-${modalId}" class="confirm-btn">CONFERMA</button><button id="close-${modalId}">ANNULLA</button>`;
    }

    modal.innerHTML = `
        <div class="modal-content ${isError ? 'error-border' : ''}">
            <h2 class="${isError ? 'error-title' : ''}">${title}</h2>
            <div>${message}</div>
            <div class="modal-buttons">${buttonsHtml}</div>
        </div>
    `;
    
    modalContainer.appendChild(modal);
    document.getElementById(`close-${modalId}`).onclick = () => modal.remove();
    if (onConfirm) {
        document.getElementById(`confirm-${modalId}`).onclick = () => {
            modal.remove();
            onConfirm();
        };
    }
    return modal;
}

function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
}