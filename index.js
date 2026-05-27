document.addEventListener("DOMContentLoaded", function () {
    // Decide which backend URL to use:
    // - When using VS Code Live Server (127.0.0.1:5500), call the Node server on localhost:5000
    // - When deployed (same origin), use relative paths
    const API_BASE =
        window.location.port === "5500"
            ? "http://localhost:5000"
            : "";
    const loginSection = document.querySelector(".login-section");
    const loginLink = document.querySelector(".login-link");
    const registerLink = document.querySelector(".register-link");
    const signupForm = document.getElementById("signupForm");
    const loginForm = document.getElementById("loginForm");
    const passwordInput = document.getElementById("signupPassword");
    const togglePassword = document.getElementById("togglePassword");
    const strengthBar = document.getElementById("strength-bar");
    const strengthText = document.getElementById("strength-text");
    const signupError = document.getElementById("signupError");
    const signupEmail = document.getElementById("signupEmail");
    const otpPlaceholder = document.getElementById("otpPlaceholder");
    const studentModeBtn = document.getElementById("studentModeBtn");
    const adminModeBtn = document.getElementById("adminModeBtn");
    const loginTitle = document.getElementById("loginTitle");
    const loginSubtitle = document.getElementById("loginSubtitle");
    const signupTitle = document.getElementById("signupTitle");

    // Simple role-based login (student / admin)
    let currentRole = "student";
    const urlParams = new URLSearchParams(window.location.search);
    const roleFromUrl = urlParams.get("role");
    if (roleFromUrl === "admin" || roleFromUrl === "student") {
        currentRole = roleFromUrl;
        if (currentRole === "admin") {
            adminModeBtn?.classList.add("active");
            studentModeBtn?.classList.remove("active");
            if (loginTitle) loginTitle.textContent = "Admin Sign In";
            if (loginSubtitle) loginSubtitle.textContent = "Login as administrator to manage exams, students and results.";
            if (signupTitle) signupTitle.textContent = "Admin Sign Up";
        } else {
            studentModeBtn?.classList.add("active");
            adminModeBtn?.classList.remove("active");
            if (loginTitle) loginTitle.textContent = "Student Sign In";
            if (loginSubtitle) loginSubtitle.textContent = "Login to access your student dashboard.";
            if (signupTitle) signupTitle.textContent = "Student Sign Up";
        }
    }
    const forgotPasswordLink = document.getElementById("forgotPassword");
    function updateForgotPasswordHref() {
        if (forgotPasswordLink) forgotPasswordLink.href = "forgot-password.html?role=" + currentRole;
    }
    updateForgotPasswordHref();

    const ADMIN_EMAIL = "admin@examease.com";
    const ADMIN_PASSWORD = "Admin@123";
    const ADMIN_NAME = "ExamEase Admin";
    const KEY_LOGIN_HISTORY = "examease_login_history";
    const KEY_STUDENT_ACCOUNTS = "examease_student_accounts";
    const KEY_SAVED_PASSWORDS = "examease_saved_passwords";
    const KEY_SAVED_PASSWORD_PROMPT_OPTOUT = "examease_saved_password_prompt_optout";

    function getSavedPasswords() {
        try {
            return JSON.parse(localStorage.getItem(KEY_SAVED_PASSWORDS) || "{}");
        } catch { return {}; }
    }
    function setSavedPassword(email, password) {
        const obj = getSavedPasswords();
        obj[email.trim().toLowerCase()] = password;
        localStorage.setItem(KEY_SAVED_PASSWORDS, JSON.stringify(obj));
    }
    function getPromptOptOutMap() {
        try {
            return JSON.parse(localStorage.getItem(KEY_SAVED_PASSWORD_PROMPT_OPTOUT) || "{}");
        } catch {
            return {};
        }
    }
    function setPromptOptOut(email, disabled) {
        const key = (email || "").trim().toLowerCase();
        if (!key) return;
        const map = getPromptOptOutMap();
        map[key] = !!disabled;
        localStorage.setItem(KEY_SAVED_PASSWORD_PROMPT_OPTOUT, JSON.stringify(map));
    }
    function isPromptOptedOut(email) {
        const key = (email || "").trim().toLowerCase();
        if (!key) return false;
        const map = getPromptOptOutMap();
        return !!map[key];
    }
    function reEnableSavedPasswordPrompt(email) {
        setPromptOptOut(email, false);
    }

    function pushLoginHistory(email, role) {
        try {
            const list = JSON.parse(localStorage.getItem(KEY_LOGIN_HISTORY) || "[]");
            list.unshift({ email: email || "admin", user: email || "admin", role: role || "admin", time: new Date().toISOString() });
            localStorage.setItem(KEY_LOGIN_HISTORY, JSON.stringify(list.slice(0, 200)));
        } catch (_) {}
    }

    function isStudentBlocked(email) {
        try {
            const accounts = JSON.parse(localStorage.getItem(KEY_STUDENT_ACCOUNTS) || "{}");
            return (accounts[email] && accounts[email].status === "blocked");
        } catch {
            return false;
        }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    // Role toggle handlers
    studentModeBtn?.addEventListener("click", () => {
        currentRole = "student";
        studentModeBtn.classList.add("active");
        adminModeBtn?.classList.remove("active");
        if (loginTitle) loginTitle.textContent = "Student Sign In";
        if (loginSubtitle) loginSubtitle.textContent = "Login to access your student dashboard.";
        if (signupTitle) signupTitle.textContent = "Student Sign Up";
        updateForgotPasswordHref();
    });

    adminModeBtn?.addEventListener("click", () => {
        currentRole = "admin";
        adminModeBtn.classList.add("active");
        studentModeBtn?.classList.remove("active");
        if (loginTitle) loginTitle.textContent = "Admin Sign In";
        if (loginSubtitle) loginSubtitle.textContent = "Login as administrator to manage exams, students and results.";
        if (signupTitle) signupTitle.textContent = "Admin Sign Up";
        updateForgotPasswordHref();
    });

    // Toggle login/signup view
    registerLink?.addEventListener("click", () => loginSection.classList.add("active"));
    loginLink?.addEventListener("click", () => loginSection.classList.remove("active"));

    // Toggle password visibility
    togglePassword?.addEventListener("click", () => {
        passwordInput.type = passwordInput.type === "password" ? "text" : "password";
        togglePassword.classList.toggle("active");
        togglePassword.textContent = passwordInput.type === "password" ? "👁️" : "🙈";
    });

    const loginPasswordInput = document.getElementById("password");
    const toggleLoginPassword = document.getElementById("toggleLoginPassword");
    toggleLoginPassword?.addEventListener("click", () => {
        const type = loginPasswordInput.type === "password" ? "text" : "password";
        loginPasswordInput.type = type;
        toggleLoginPassword.textContent = type === "password" ? "👁️" : "🙈";
    });

    // Password strength bar
    passwordInput?.addEventListener("input", () => {
        const val = passwordInput.value;
        let strength = 0;
        if (val.length >= 8) strength++;
        if (/[A-Z]/.test(val)) strength++;
        if (/\d/.test(val)) strength++;
        if (/[@$!%*?&]/.test(val)) strength++;

        strengthBar.value = strength;
        const texts = ["Too Weak", "Weak", "Medium", "Strong", "Very Strong"];
        const colors = ["red", "orange", "#db9d00", "green", "darkgreen"];
        strengthText.innerText = texts[strength];
        strengthText.style.color = colors[strength];
    });

    // Alert system
    const alertContainer = document.createElement("div");
    alertContainer.id = "alert-container";
    Object.assign(alertContainer.style, {
        position: "fixed",
        top: "18px",
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: "280px",
        maxWidth: "520px",
        padding: "14px 26px",
        borderRadius: "999px",
        color: "#fff",
        fontSize: "14px",
        display: "none",
        transition: "opacity 0.5s ease-in-out, transform 0.5s ease-in-out",
        opacity: "0",
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.5)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        backdropFilter: "blur(14px)",
        zIndex: "1000"
    });
    document.body.appendChild(alertContainer);

    // Saved-password modal: "Do you want to use your saved password?"
    const savedPasswordAskedThisSession = new Set();
    const savedPasswordOverlay = document.createElement("div");
    savedPasswordOverlay.id = "savedPasswordOverlay";
    Object.assign(savedPasswordOverlay.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
        display: "none", alignItems: "center", justifyContent: "center", zIndex: "1001"
    });
    savedPasswordOverlay.style.cssText += "display:none; align-items:center; justify-content:center;";
    const savedPasswordBox = document.createElement("div");
    Object.assign(savedPasswordBox.style, {
        background: "linear-gradient(135deg, #174bbd 0%, #1e5cd4 50%, #2a6bb5 100%)",
        padding: "24px 28px", borderRadius: "16px", minWidth: "320px", maxWidth: "90vw",
        boxShadow: "0 12px 40px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)"
    });
    savedPasswordBox.innerHTML = "<p style='color:#fff; margin:0 0 20px; font-size:15px;'>Do you want to use your saved password?</p><div style='display:flex; gap:12px; justify-content:center;'><button type='button' id='savedPasswordYes' style='padding:10px 24px; border-radius:8px; border:none; background:#4ed442; color:#fff; font-weight:600; cursor:pointer;'>Yes</button><button type='button' id='savedPasswordNo' style='padding:10px 24px; border-radius:8px; border:none; background:rgba(255,255,255,0.25); color:#fff; cursor:pointer;'>No</button></div>";
    savedPasswordOverlay.appendChild(savedPasswordBox);
    document.body.appendChild(savedPasswordOverlay);

    function showSavedPasswordModal(email, onYes, onNo) {
        savedPasswordOverlay.style.display = "flex";
        const yesBtn = document.getElementById("savedPasswordYes");
        const noBtn = document.getElementById("savedPasswordNo");
        if (!yesBtn || !noBtn) return;
        const close = () => { savedPasswordOverlay.style.display = "none"; };
        yesBtn.onclick = () => { close(); onYes(); yesBtn.onclick = null; noBtn.onclick = null; };
        noBtn.onclick = () => { close(); onNo(); yesBtn.onclick = null; noBtn.onclick = null; };
    }

    function maybeOfferSavedPassword() {
        const emailEl = document.getElementById("email");
        const passwordEl = document.getElementById("password");
        if (!emailEl || !passwordEl) return;
        const email = emailEl.value.trim().toLowerCase();
        if (!email) return;
        const saved = getSavedPasswords();
        const savedPass = saved[email];
        if (!savedPass) return;
        if (isPromptOptedOut(email)) return;
        if (savedPasswordAskedThisSession.has(email)) return;
        savedPasswordAskedThisSession.add(email);
        showSavedPasswordModal(email, () => {
            passwordEl.value = savedPass;
            passwordEl.dispatchEvent(new Event("input", { bubbles: true }));
        }, () => {
            // Persist: user chose "No", don't ask again unless they explicitly enable Remember Me later.
            setPromptOptOut(email, true);
        });
    }

    const loginEmailInput = document.getElementById("email");
    const loginPasswordInputRef = document.getElementById("password");
    if (loginEmailInput) loginEmailInput.addEventListener("blur", maybeOfferSavedPassword);
    if (loginPasswordInputRef) loginPasswordInputRef.addEventListener("focus", maybeOfferSavedPassword);

    function showAlert(message, redirectUrl = null, type = "success") {
        alertContainer.textContent = message;
        // Match ExamEase color tone (blue/green gradient for success, softer red gradient for errors)
        if (type === "success") {
            alertContainer.style.background = "linear-gradient(135deg, #174bbd 0%, #1e5cd4 50%, #4ed442 100%)";
        } else {
            alertContainer.style.background = "linear-gradient(135deg, #4e1b1b 0%, #b03030 40%, #ff5c5c 100%)";
        }
        alertContainer.style.display = "block";
        alertContainer.style.opacity = "1";
        alertContainer.style.transform = "translateX(-50%) translateY(0)";
        setTimeout(() => {
            alertContainer.style.opacity = "0";
            alertContainer.style.transform = "translateX(-50%) translateY(-10px)";
            setTimeout(() => {
                alertContainer.style.display = "none";
                if (redirectUrl) window.location.href = redirectUrl;
            }, 500);
        }, 3000);
    }

    // Automatically show OTP field on email input blur
    let otpFieldAdded = false;
    signupEmail.addEventListener("blur", () => {
        const email = signupEmail.value.trim();
        if (!emailRegex.test(email)) return;

        // Use same-origin API in production, localhost:5000 when using Live Server
        fetch(`${API_BASE}/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        })
        .then(res => res.json())
        .then(data => {
            if (data.message === "OTP sent successfully!") {
                showAlert("📨 OTP sent to your email!", null, "success");
                signupError.textContent = "Enter the OTP below to verify your email.";
                signupError.style.color = "lightgreen";

                
            } else {
                showAlert("❌ Failed to send OTP.", null, "error");
            }
        })
        .catch(err => {
            console.error("OTP error:", err);
            showAlert("❌ OTP request failed.", null, "error");
        });
    });

    // Sign-up handler with OTP verification
    signupForm?.addEventListener("submit", function (e) {
        e.preventDefault();

        const username = document.getElementById("signupUsername").value.trim();
        const email = signupEmail.value.trim();
        const password = passwordInput.value.trim();
        const otp = document.getElementById("signupOTP")?.value.trim();

        if (!emailRegex.test(email)) {
            signupError.textContent = "❌ Invalid email address.";
            signupError.style.color = "white";
            return;
        }

        if (!passwordRegex.test(password)) {
            signupError.textContent = "❌ Password must be 8+ chars with uppercase, number, and symbol.";
            signupError.style.color = "white";
            return;
        }

        if (!otp) {
            signupError.textContent = "❌ Please enter the OTP sent to your email.";
            signupError.style.color = "white";
            return;
        }

        // Use same-origin API in production, localhost:5000 when using Live Server
        fetch(`${API_BASE}/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        })
        .then(res => res.json())
        .then(data => {
            if (data.message === "OTP verified successfully!") {
                const roleValue = currentRole === "admin" ? "admin" : "student";
                // Register in database (MySQL) when API is available
                const registerUrl = API_BASE ? `${API_BASE}/api/auth/register` : "/api/auth/register";
                fetch(registerUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email,
                        password,
                        fullName: username,
                        username,
                        role: roleValue
                    })
                })
                .then(res => res.json().then(reg => ({ status: res.status, reg })))
                .then(({ status, reg }) => {
                    if (status >= 200 && status < 300 && (reg.user || reg.message === "Registration successful.")) {
                        // Also keep in localStorage for backward compatibility if needed
                        localStorage.setItem(email, JSON.stringify({ username, password, email, role: roleValue }));
                        signupError.textContent = "";
                        signupForm.reset();
                        showAlert("✅ Sign-up successful! Please login with your credentials.", null, "success");
                        setTimeout(() => {
                            loginSection.classList.remove("active");
                            const emailInput = document.getElementById("email");
                            if (emailInput) {
                                emailInput.value = email;
                                emailInput.dispatchEvent(new Event("input"));
                            }
                        }, 1500);
                    } else {
                        let msg = reg.message || "Registration failed.";
                        if (msg === "Registration failed." && reg.error) {
                            if (/connect|ECONNREFUSED|Access denied/i.test(reg.error)) {
                                msg = "Database not connected. Start MySQL in XAMPP, then restart the server (npm start).";
                            } else {
                                msg = msg + " (" + reg.error + ")";
                            }
                        }
                        if (msg.includes("already exists")) {
                            msg = "This email is already registered. Switch to Sign In and log in as Student.";
                        }
                        signupError.textContent = "❌ " + msg;
                        signupError.style.color = "white";
                    }
                })
                .catch(err => {
                    console.error("Register API error:", err);
                    signupError.textContent = "❌ Registration request failed. Check backend and database.";
                    signupError.style.color = "white";
                });
            } else {
                signupError.textContent = `❌ ${data.message}`;
                signupError.style.color = "white";
            }
        })
        .catch(err => {
            console.error("Verify OTP error:", err);
            signupError.textContent = "❌ OTP verification failed.";
            signupError.style.color = "white";
        });
    });

    // Login handler (student / admin)
    loginForm?.addEventListener("submit", function (e) {
        e.preventDefault();

        const email = document.getElementById("email")?.value.trim();
        const password = document.getElementById("password")?.value.trim();
        const loginError = document.getElementById("loginError");
        const rememberMe = document.getElementById("rememberMe");
        
        // Validation
        if (!email || !password) {
            if (loginError) {
                loginError.textContent = "❌ Please fill in all fields.";
                loginError.style.color = "white";
            }
            showAlert("❌ Please fill in all fields.", null, "error");
            return;
        }

        if (!emailRegex.test(email)) {
            if (loginError) {
                loginError.textContent = "❌ Invalid email address.";
                loginError.style.color = "white";
            }
            showAlert("❌ Invalid email address.", null, "error");
            return;
        }

        // 1) Hard-coded super admin (works without DB)
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            if (loginError) loginError.textContent = "";
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("username");
            localStorage.removeItem("currentUserEmail");
            localStorage.setItem("isAdminLoggedIn", "true");
            localStorage.setItem("adminName", ADMIN_NAME);
            localStorage.setItem("currentAdminEmail", ADMIN_EMAIL);
            if (rememberMe && rememberMe.checked) {
                setSavedPassword(email, password);
                reEnableSavedPasswordPrompt(email);
            }
            pushLoginHistory(email, "admin");
            showAlert("✅ Admin login successful! Redirecting to admin dashboard...", "admin-dashboard.html", "success");
            return;
        }

        // 2) Database login (MySQL via API)
        const loginUrl = API_BASE ? `${API_BASE}/api/auth/login` : "/api/auth/login";
        fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                password,
                rememberMe: !!(rememberMe && rememberMe.checked),
                role: currentRole
            })
        })
        .then(res => {
            return res.text().then(text => {
                let data;
                try { data = text ? JSON.parse(text) : {}; } catch { data = { message: "Server returned invalid response." }; }
                return { status: res.status, data };
            });
        })
        .then(({ status, data }) => {
            if (status === 200 && data.user) {
                if (loginError) loginError.textContent = "";
                const role = data.user.role;
                if (data.rememberToken) {
                    localStorage.setItem("examease_remember_token_" + role, data.rememberToken);
                    if (rememberMe && rememberMe.checked) {
                        setSavedPassword(email, password);
                        reEnableSavedPasswordPrompt(email);
                    }
                } else {
                    localStorage.removeItem("examease_remember_token_" + role);
                }
                if (role === "admin") {
                    localStorage.removeItem("isLoggedIn");
                    localStorage.removeItem("username");
                    localStorage.removeItem("currentUserEmail");
                    localStorage.setItem("isAdminLoggedIn", "true");
                    localStorage.setItem("adminName", data.user.full_name || data.user.email);
                    localStorage.setItem("currentAdminEmail", data.user.email || email);
                    pushLoginHistory(email, "admin");
                    showAlert("✅ Admin login successful! Redirecting to admin dashboard...", "admin-dashboard.html", "success");
                } else {
                    localStorage.removeItem("isAdminLoggedIn");
                    localStorage.removeItem("adminName");
                    localStorage.setItem("isLoggedIn", "true");
                    localStorage.setItem("username", data.user.full_name || data.user.email);
                    localStorage.setItem("currentUserEmail", data.user.email);
                    pushLoginHistory(email, "student");
                    showAlert("✅ Login successful! Redirecting to dashboard...", "dashboard.html", "success");
                }
            } else {
                let msg = data.message || "Login failed.";
                if (status === 401 && msg.toLowerCase().includes("not found") && localStorage.getItem(email)) {
                    msg = "This email is not in the database. Please sign up again (Sign Up) to create your account in the database.";
                }
                if (status === 403 && msg.includes("not registered as")) {
                    msg = "Wrong login type. Switch to " + (currentRole === "admin" ? "Student" : "Admin") + " and try again, or use the correct account.";
                }
                if (loginError) {
                    loginError.textContent = "❌ " + msg;
                    loginError.style.color = "white";
                }
                showAlert("❌ " + msg, null, "error");
            }
        })
        .catch(err => {
            console.error("Login API error:", err);
            // Fallback: try localStorage (legacy) when API is unreachable
            const storedUser = localStorage.getItem(email);
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    if (password === userData.password) {
                        if (loginError) loginError.textContent = "";
                        const role = userData.role === "admin" ? "admin" : "student";
                        if (rememberMe && rememberMe.checked) {
                            setSavedPassword(email, password);
                            reEnableSavedPasswordPrompt(email);
                        }
                        if (role === "admin") {
                            localStorage.removeItem("isLoggedIn");
                            localStorage.removeItem("username");
                            localStorage.removeItem("currentUserEmail");
                            localStorage.setItem("isAdminLoggedIn", "true");
                            localStorage.setItem("adminName", userData.username || email);
                            localStorage.setItem("currentAdminEmail", email);
                            pushLoginHistory(email, "admin");
                            showAlert("✅ Admin login successful! Redirecting to admin dashboard...", "admin-dashboard.html", "success");
                        } else {
                            if (isStudentBlocked(email)) {
                                if (loginError) loginError.textContent = "❌ Your account has been blocked. Contact admin.";
                                showAlert("❌ Your account has been blocked.", null, "error");
                                return;
                            }
                            localStorage.removeItem("isAdminLoggedIn");
                            localStorage.removeItem("adminName");
                            localStorage.setItem("isLoggedIn", "true");
                            localStorage.setItem("username", userData.username || email);
                            localStorage.setItem("currentUserEmail", email);
                            pushLoginHistory(email, "student");
                            showAlert("✅ Login successful! Redirecting to dashboard...", "dashboard.html", "success");
                        }
                        return;
                    }
                } catch (_) {}
            }
            if (loginError) {
                loginError.textContent = "❌ Login failed. Check backend and database or sign up first.";
                loginError.style.color = "white";
            }
            showAlert("❌ Login failed. Check backend and database.", null, "error");
        });
    });
});
