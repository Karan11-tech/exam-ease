function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.className = 'alert-box';

    if (type === 'success') {
        alertBox.classList.add('alert-success');
    } else if (type === 'error') {
        alertBox.classList.add('alert-error');
    }

    alertBox.style.display = 'block';
    alertBox.style.opacity = '0';
    alertBox.style.transform = 'translateX(-50%) translateY(-10px)';
    alertBox.offsetHeight; // reflow
    alertBox.style.opacity = '1';
    alertBox.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        alertBox.style.opacity = '0';
        alertBox.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 350);
    }, 3000);
}
