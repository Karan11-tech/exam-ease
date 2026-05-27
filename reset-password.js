document.addEventListener("DOMContentLoaded", function () {
    // Role from URL (student or admin) - passed from forgot-password page
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get("role") || "student";
    const isAdmin = role === "admin";

    const titleEl = document.getElementById("resetPageTitle");
    const subtitleEl = document.getElementById("resetPageSubtitle");
    const backLink = document.getElementById("backToLoginLink");
    if (titleEl) titleEl.textContent = isAdmin ? "Admin – Reset Password" : "Student – Reset Password";
    if (subtitleEl) subtitleEl.textContent = isAdmin ? "Enter your new admin password below." : "Enter your new password below.";
    if (backLink) backLink.href = "index.html?role=" + role;
    document.title = (isAdmin ? "Admin – " : "Student – ") + "Reset Password - ExamEase";

    // Handle password reset form submission
    document.getElementById("resetPasswordForm").addEventListener("submit", function (e) {
        e.preventDefault();

        const email = localStorage.getItem("resetEmail");
        const newPassword = document.getElementById("newPassword").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();

        if (!email) {
            if (typeof showAlert === "function") showAlert("No reset email found. Please request a new reset link.", "error");
            return;
        }

        if (newPassword.length < 8) {
            if (typeof showAlert === "function") showAlert("Password must be at least 8 characters long!", "error");
            return;
        }

        if (newPassword === confirmPassword) {
            const API_BASE = window.location.port === "5500" ? "http://localhost:5000" : "";
            const updateUrl = API_BASE ? `${API_BASE}/api/auth/update-password` : "/api/auth/update-password";
            fetch(updateUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, newPassword })
            })
            .then(res => res.json().then(data => ({ status: res.status, data })))
            .then(({ status, data }) => {
                if (status === 200 && data.message === "Password updated successfully.") {
                    const storedUser = localStorage.getItem(email);
                    if (storedUser) {
                        const userData = JSON.parse(storedUser);
                        userData.password = newPassword;
                        localStorage.setItem(email, JSON.stringify(userData));
                    }
                    sessionStorage.setItem("resetSuccess", "Password reset successful! Login with your new password.");
                    if (typeof showAlert === "function") showAlert("Password reset successful! Redirecting to login page...", "success");
                    setTimeout(() => { window.location.href = "index.html?role=" + role; }, 2000);
                } else if (status === 404) {
                    const storedUser = localStorage.getItem(email);
                    if (storedUser) {
                        const userData = JSON.parse(storedUser);
                        userData.password = newPassword;
                        localStorage.setItem(email, JSON.stringify(userData));
                        sessionStorage.setItem("resetSuccess", "Password reset successful! Login with your new password.");
                        if (typeof showAlert === "function") showAlert("Password reset successful! Redirecting to login page...", "success");
                        setTimeout(() => { window.location.href = "index.html?role=" + role; }, 2000);
                    } else {
                        if (typeof showAlert === "function") showAlert(data.message || "User not found.", "error");
                    }
                } else {
                    if (typeof showAlert === "function") showAlert(data.message || "Failed to update password.", "error");
                }
            })
            .catch(err => {
                console.error("Update password error:", err);
                if (typeof showAlert === "function") showAlert("Request failed. Check backend and database.", "error");
            });
        } else {
            if (typeof showAlert === "function") showAlert("Passwords do not match!", "error");
        }
    });

    // Show success message on login page if redirected after reset
    const resetSuccess = sessionStorage.getItem("resetSuccess");
    if (resetSuccess && typeof showAlert === "function") {
        showAlert(resetSuccess, "success");
        sessionStorage.removeItem("resetSuccess");
    }

    // Add Eye Toggle Functionality
    const toggleIcons = document.querySelectorAll(".toggle-password");
    toggleIcons.forEach(icon => {
        icon.addEventListener("click", function () {
            const targetInput = document.getElementById(this.dataset.target);
            if (targetInput.type === "password") {
                targetInput.type = "text";
                this.innerHTML = "🙈"; // Eye close
            } else {
                targetInput.type = "password";
                this.innerHTML = "👁️"; // Eye open
            }
        });
    });
});
