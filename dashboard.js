// API base URL (must be defined before any function that uses it)
// Use absolute backend URL when the page is not served from the same origin as the API (file://, Live Server, Vite, etc.)
var API_BASE = (function () {
    if (window.location.protocol === "file:") return "http://localhost:5000";
    var port = window.location.port;
    var devPorts = { "5500": 1, "3000": 1, "8080": 1, "5173": 1, "4173": 1, "4321": 1 };
    if (devPorts[port]) return "http://localhost:5000";
    return "";
})();

function apiUrl(path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    var base = (API_BASE || "").replace(/\/+$/, "");
    if (!base) return p;
    return base + p;
}

function parseJsonArrayResponse(res) {
    return res.text().then(function (text) {
        if (!res.ok) {
            console.warn("API request failed:", res.status, res.url || "");
            return [];
        }
        try {
            var data = text ? JSON.parse(text) : [];
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.warn("Invalid JSON from announcements API:", e);
            return [];
        }
    });
}

var STORAGE_THEME = "examease_theme";
/** After save we reload; read on load to reopen the same dashboard section (e.g. notes). */
var STORAGE_DASHBOARD_SECTION = "examease_restore_section";

// Define functions on window object IMMEDIATELY to ensure they're accessible from inline handlers
// These must be defined before DOMContentLoaded fires
window.toggleSidebar = function() {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.toggle("active");
};

window.toggleTheme = function() {
    var body = document.body;
    var isLight = body.classList.toggle("theme-light");
    var icon = document.getElementById("themeToggleIcon") || document.getElementById("adminThemeToggleIcon");
    if (icon) {
        icon.classList.remove("bx-moon", "bx-sun");
        icon.classList.add(isLight ? "bx-sun" : "bx-moon");
    }
    try {
        localStorage.setItem(STORAGE_THEME, isLight ? "light" : "dark");
    } catch (_) {
        // ignore
    }
};

// Simple in-memory language dictionaries (English / Hindi) for key UI labels
var I18N = {
    en: {
        "nav.dashboard": "Dashboard",
        "nav.practice": "Practice",
        "nav.gamified": "Gamified Learning",
        "nav.notes": "My Notes",
        "nav.discussion": "Doubts & Discussion",
        "nav.materials": "Study Materials",
        "nav.career": "Career & Internships",
        "nav.feedback": "Feedback & Assessment",
        "nav.results": "Results",
        "nav.profile": "Profile",
        "section.doubts": "Doubts & Discussion",
        "section.materials": "Study Materials",
        "section.career": "Career & Internship Guidance",
        "section.notes": "My Notes"
    },
    hi: {
        "nav.dashboard": "डैशबोर्ड",
        "nav.practice": "प्रैक्टिस",
        "nav.gamified": "गेमिफ़ाइड लर्निंग",
        "nav.notes": "मेरे नोट्स",
        "nav.discussion": "संदेह और चर्चा",
        "nav.materials": "स्टडी मटेरियल",
        "nav.career": "कैरियर और इंटर्नशिप",
        "nav.feedback": "फीडबैक और मूल्यांकन",
        "nav.results": "परिणाम",
        "nav.profile": "प्रोफ़ाइल",
        "section.doubts": "संदेह और चर्चा",
        "section.materials": "स्टडी मटेरियल",
        "section.career": "कैरियर और इंटर्नशिप मार्गदर्शन",
        "section.notes": "मेरे नोट्स"
    }
};

function applyLanguage(lang) {
    var dict = I18N[lang] || I18N.en;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        var key = el.getAttribute("data-i18n");
        if (dict[key]) el.textContent = dict[key];
    });
    var btn = document.getElementById("langToggleLabel");
    if (btn) btn.textContent = lang === "hi" ? "हिं" : "EN";
    try {
        localStorage.setItem(STORAGE_LANG, lang);
    } catch (_) {}
}

/** Restore My Notes (or another section) after reload, or from URL hash. */
function applyPendingDashboardSection() {
    var sectionId = null;
    try {
        sectionId = localStorage.getItem(STORAGE_DASHBOARD_SECTION);
        if (sectionId) localStorage.removeItem(STORAGE_DASHBOARD_SECTION);
    } catch (_) {}
    if (!sectionId) {
        var h = (window.location.hash || "").replace(/^#/, "").toLowerCase();
        if (h === "notes" || h === "mynotes") sectionId = "notes";
    }
    if (sectionId && document.getElementById(sectionId) && typeof window.showSection === "function") {
        window.showSection(sectionId);
        try {
            if (window.history && window.history.replaceState) {
                var u = window.location.pathname + (window.location.search || "");
                window.history.replaceState(null, "", u);
            }
        } catch (_) {}
    }
}

function scheduleReloadAfterNoteSave() {
    try {
        localStorage.setItem(STORAGE_DASHBOARD_SECTION, "notes");
    } catch (_) {}
    location.reload();
}

window.toggleLanguage = function() {
    var current = "en";
    try {
        current = localStorage.getItem(STORAGE_LANG) || "en";
    } catch (_) {}
    var next = current === "en" ? "hi" : "en";
    applyLanguage(next);
};

window.showSection = function(sectionId) {
    // Hide all sections
    document.querySelectorAll(".dashboard-section").forEach(section => {
        section.classList.remove("active");
    });

    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add("active");
    }

    // Update nav items
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });
    
    const activeNav = document.querySelector(`.nav-item[onclick="showSection('${sectionId}')"]`);
    if (activeNav) {
        activeNav.classList.add("active");
    }

    // Refresh dashboard data when dashboard section is shown
    if (sectionId === "dashboard") {
        if (typeof loadExams === "function") loadExams();
        if (typeof loadResults === "function") loadResults();
        if (typeof loadIntegrityStatus === "function") loadIntegrityStatus();
        if (typeof renderProfileAchievements === "function") renderProfileAchievements();
        if (typeof loadDashboardNotesPreview === "function") loadDashboardNotesPreview();
        if (typeof loadAnnouncements === "function") loadAnnouncements();
        if (typeof loadUpcomingExamAnnouncements === "function") loadUpcomingExamAnnouncements();
    }
    if (sectionId === "notes") {
        if (typeof loadNotesList === "function") loadNotesList();
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        window.toggleSidebar();
    }
};

window.toggleNotifications = function() {
    const panel = document.getElementById("notificationsPanel");
    if (!panel) return;
    const isOpening = !panel.classList.contains("active");
    panel.classList.toggle("active");
    if (isOpening) {
        var email = localStorage.getItem("currentUserEmail") || "";
        if (email) {
            var base = API_BASE || "";
            fetch(base + "/api/notifications/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, role: "student" })
            })
                .then(function () { if (typeof loadNotifications === "function") loadNotifications(); })
                .catch(function (err) { console.error("Mark read error:", err); });
        }
    }
};

window.logout = function() {
    const email = localStorage.getItem("currentUserEmail");
    if (email) {
        const metaKey = `studentMeta:${email}`;
        const existingMetaRaw = localStorage.getItem(metaKey);
        if (existingMetaRaw) {
            try {
                const meta = JSON.parse(existingMetaRaw);
                meta.online = false;
                meta.recentActivity = "Logged out";
                meta.lastLogout = new Date().toISOString();
                localStorage.setItem(metaKey, JSON.stringify(meta));
            } catch {
                // ignore
            }
        }
    }

    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    localStorage.removeItem("currentUserEmail");
    window.location.href = "index.html";
};

// Toast for notifications (title, message, duration ms) – no popup alerts
function showNotificationToast(title, message, durationMs, onDismiss) {
    durationMs = durationMs || 2500;
    var existing = document.getElementById("studentNotificationToast");
    if (existing) existing.remove();
    var toast = document.createElement("div");
    toast.id = "studentNotificationToast";
    toast.innerHTML = "<strong>" + (title || "Notification") + "</strong><br><span style='font-size:13px;'>" + (message || "").substring(0, 120) + (message && message.length > 120 ? "..." : "") + "</span>";
    Object.assign(toast.style, {
        position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
        padding: "14px 24px", borderRadius: "12px", zIndex: "99999",
        background: "linear-gradient(135deg, #174bbd 0%, #1e5cd4 50%, #4ed442 100%)",
        color: "#fff", fontSize: "14px", fontWeight: "500", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        maxWidth: "90vw", transition: "opacity 0.4s ease"
    });
    document.body.appendChild(toast);
    setTimeout(function () {
        toast.style.opacity = "0";
        setTimeout(function () {
            toast.remove();
            if (typeof onDismiss === "function") onDismiss();
        }, 400);
    }, durationMs);
}

// Check if user is logged in
document.addEventListener("DOMContentLoaded", function() {
    // Apply saved theme early
    try {
        var savedTheme = localStorage.getItem(STORAGE_THEME);
        if (savedTheme === "light") {
            document.body.classList.add("theme-light");
        }
    } catch (_) {}
    var icon = document.getElementById("themeToggleIcon");
    if (icon) {
        var isLight = document.body.classList.contains("theme-light");
        icon.classList.remove("bx-moon", "bx-sun");
        icon.classList.add(isLight ? "bx-sun" : "bx-moon");
    }

    // Apply saved language (defaults to English)
    var savedLang = "en";
    try {
        savedLang = localStorage.getItem(STORAGE_LANG) || "en";
    } catch (_) {}
    applyLanguage(savedLang);

    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const username = localStorage.getItem("username");
    
    if (!isLoggedIn || isLoggedIn !== "true") {
        window.location.href = "index.html?role=student";
        return;
    }

    // Initialize dashboard
    initializeDashboard(username);
    loadUserData();
    // Load exams and results - exams will fetch summary and update dashboard stats
    loadExams();
    loadResults();
    // Also ensure we refresh when dashboard section becomes visible
    console.log("Dashboard initialized. Email:", localStorage.getItem("currentUserEmail") || (typeof getStoredEmail === "function" ? getStoredEmail() : "N/A"));
    loadNotifications();
    loadDiscussion();
    loadMaterials();
    loadCareer();
    loadAnnouncements();
    loadUpcomingExamAnnouncements();
    initFeedback();
    initFeedbackCategoryDropdown();
    loadFeedbackHistory();
    initGamifiedLearning();
    renderProfileAchievements();
    loadDashboardNotesPreview();
    initNotesUI();
    loadIntegrityStatus();
    loadStudentProfilePhotos();

    const studentPhotoUploadInput = document.getElementById("studentPhotoUpload");
    if (studentPhotoUploadInput) studentPhotoUploadInput.addEventListener("change", uploadStudentProfilePhoto);
    applyPendingDashboardSection();

    function refreshAnnouncementViewsIfDashboard() {
        var dash = document.getElementById("dashboard");
        if (!dash || !dash.classList.contains("active")) return;
        if (typeof loadUpcomingExamAnnouncements === "function") loadUpcomingExamAnnouncements();
        if (typeof loadAnnouncements === "function") loadAnnouncements();
    }
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") refreshAnnouncementViewsIfDashboard();
    });
    window.addEventListener("focus", refreshAnnouncementViewsIfDashboard);
});

// Initialize dashboard with user info
function initializeDashboard(username) {
    // Set username in welcome message
    const studentNameEl = document.getElementById("studentName");
    const profileNameFull = document.getElementById("profileNameFull");
    
    if (studentNameEl) studentNameEl.textContent = username || "Student";
    if (profileNameFull) profileNameFull.textContent = username || "Student";
    
    // Set initials
    const initials = getInitials(username || "Student");
    document.getElementById("userInitials").textContent = initials;
    document.getElementById("profileInitials").textContent = initials;
    document.getElementById("profileInitialsLarge").textContent = initials;
    
    // Set email (get from localStorage if available)
    const userEmail = getStoredEmail();
    if (userEmail) {
        document.getElementById("profileEmail").textContent = userEmail;
        document.getElementById("profileEmailFull").textContent = userEmail;
    }
}

// Get user email from localStorage
function getStoredEmail() {
    // Try to find email from localStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes("@")) {
            try {
                const userData = JSON.parse(localStorage.getItem(key));
                if (userData && userData.email) {
                    return key; // The key itself is the email
                }
            } catch (e) {
                // Not a user data entry
            }
        }
    }
    return "student@examease.com";
}

// Get initials from name
function getInitials(name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function setAvatarPhoto(imgEl, initialsEl, email) {
    if (!imgEl || !initialsEl) return;
    if (!email) return;

    // Bust cache so users see updates immediately.
    const src = apiUrl("/api/profile/photo?email=" + encodeURIComponent(email) + "&t=" + Date.now());
    imgEl.src = src;
    imgEl.style.display = "block";
    imgEl.onerror = function() {
        imgEl.style.display = "none";
        initialsEl.style.display = "";
    };
    imgEl.onload = function() {
        imgEl.style.display = "block";
        initialsEl.style.display = "none";
    };
}

function loadStudentProfilePhotos() {
    const email = (localStorage.getItem("currentUserEmail") || getStoredEmail() || "").trim();
    if (!email) return;

    setAvatarPhoto(
        document.getElementById("userPhotoMini"),
        document.getElementById("userInitials"),
        email
    );
    setAvatarPhoto(
        document.getElementById("profilePhotoMini"),
        document.getElementById("profileInitials"),
        email
    );
    setAvatarPhoto(
        document.getElementById("profilePhotoLarge"),
        document.getElementById("profileInitialsLarge"),
        email
    );
}

function uploadStudentProfilePhoto() {
    const input = document.getElementById("studentPhotoUpload");
    if (!input || !input.files || !input.files[0]) {
        if (typeof showAlert === "function") showAlert("Please select a photo first.", null, "error");
        return;
    }
    const email = (localStorage.getItem("currentUserEmail") || getStoredEmail() || "").trim();
    if (!email) {
        if (typeof showAlert === "function") showAlert("Could not determine your email.", null, "error");
        return;
    }

    const file = input.files[0];
    const form = new FormData();
    form.append("email", email);
    form.append("photo", file);

    const uploadUrl = apiUrl("/api/profile/photo");
    fetch(uploadUrl, {
        method: "POST",
        body: form
    })
        .then(function(res) {
            return res.text().then(function(text) {
                try { return { ok: res.ok, data: text ? JSON.parse(text) : null }; }
                catch (_) { return { ok: res.ok, data: null }; }
            });
        })
        .then(function(result) {
            if (!result.ok) throw new Error((result.data && result.data.message) || "Upload failed.");
            if (typeof showNotificationToast === "function") showNotificationToast("Profile photo updated", "Your photo was updated successfully.");
            input.value = "";
            loadStudentProfilePhotos();
        })
        .catch(function(err) {
            console.error("Upload profile photo error:", err);
            if (typeof showAlert === "function") showAlert("Failed to upload photo. " + (err.message || ""), null, "error");
        });
}

function loadIntegrityStatus() {
    const card = document.getElementById("integrityCard");
    const icon = document.getElementById("integrityIcon");
    const title = document.getElementById("integrityTitle");
    const message = document.getElementById("integrityMessage");
    const scoreEl = document.getElementById("integrityScore");
    if (!card || !icon || !title || !message || !scoreEl) return;

    const email = (localStorage.getItem("currentUserEmail") || getStoredEmail() || "").trim();
    if (!email) {
        scoreEl.textContent = "--";
        return;
    }

    fetch(apiUrl("/api/integrity/student?email=" + encodeURIComponent(email)))
        .then(function(res) { return res.ok ? res.json() : null; })
        .then(function(data) {
            if (!data || !data.hasActivity) {
                card.classList.remove("good", "warn", "bad");
                card.classList.add("good");
                icon.className = "bx bx-check-circle";
                title.textContent = "Getting Started";
                message.textContent = "No exam activity yet. Complete a few exams to see your integrity score.";
                scoreEl.textContent = "--";
                return;
            }

            var status = data.status || "good";
            card.classList.remove("good", "warn", "bad");
            card.classList.add(status);

            if (status === "good") icon.className = "bx bx-check-circle";
            else if (status === "warn") icon.className = "bx bx-error-circle";
            else icon.className = "bx bx-x-circle";

            title.textContent = status === "good" ? "Integrity Looks Good" : status === "warn" ? "Integrity Needs Attention" : "Integrity Issues Detected";
            message.textContent = data.message || "";
            scoreEl.textContent = String(data.integrityScore != null ? data.integrityScore : "--") + "%";
        })
        .catch(function(err) {
            console.error("Load integrity status error:", err);
        });
}

// Load user statistics (from localStorage; overwritten by API when summary loads)
function loadUserData() {
    const stats = JSON.parse(localStorage.getItem("userStats")) || {
        totalExams: 0,
        averageScore: 0,
        studyHours: 0,
        rank: null
    };
    updateDashboardStats(stats);
}

// Apply stats to dashboard DOM (total exams, average score, study hours, rank)
function updateDashboardStats(stats) {
    if (!stats) return;
    var totalEl = document.getElementById("totalExams");
    var avgEl = document.getElementById("averageScore");
    var hoursEl = document.getElementById("studyHours");
    var rankEl = document.getElementById("rank");
    if (totalEl) totalEl.textContent = stats.totalExams != null ? stats.totalExams : 0;
    if (avgEl) avgEl.textContent = (stats.averageScore != null && stats.averageScore > 0) ? stats.averageScore + "%" : "0%";
    if (hoursEl) hoursEl.textContent = (stats.studyHours != null && stats.studyHours > 0) ? stats.studyHours + "h" : "0h";
    if (rankEl) rankEl.textContent = (stats.rank != null && stats.rank !== "") ? "#" + stats.rank : "--";
    var profileTotal = document.getElementById("profileTotalExams");
    var profileAvg = document.getElementById("profileAvgScore");
    var profileRank = document.getElementById("profileRank");
    if (profileTotal) profileTotal.textContent = stats.totalExams != null ? stats.totalExams : 0;
    if (profileAvg) profileAvg.textContent = (stats.averageScore != null && stats.averageScore > 0) ? stats.averageScore + "%" : "0%";
    if (profileRank) profileRank.textContent = (stats.rank != null && stats.rank !== "") ? "#" + stats.rank : "--";
}

var lastStudentSummary = null;

function getStudyHoursFromGamifiedState() {
    try {
        var state = loadGamifiedState();
        var subjects = (state && state.subjects) || {};
        var completedSubjects = 0;
        Object.keys(subjects).forEach(function (key) {
            var cfg = GAMIFIED_CONFIG && GAMIFIED_CONFIG[key];
            if (!cfg || !Array.isArray(cfg.levels) || !cfg.levels.length) return;
            var totalLevels = cfg.levels.length;
            var completedLevels = Object.keys((subjects[key] && subjects[key].completed) || {}).length;
            if (completedLevels >= totalLevels) completedSubjects += 1;
        });
        return completedSubjects; // 1 completed subject = 1 hour
    } catch (_) {
        return 0;
    }
}

// Update dashboard stats from API student summary (total exam, avg score, study hours, rank)
function updateDashboardStatsFromSummary(summary) {
    if (!summary) {
        console.warn("updateDashboardStatsFromSummary called with no summary");
        return;
    }
    lastStudentSummary = summary;
    console.log("updateDashboardStatsFromSummary called with:", summary);
    var byExam = summary.byExam || [];
    var overall = summary.overall || {};
    var totalExams = overall.totalExamsAttempted != null ? overall.totalExamsAttempted : byExam.length;
    var averageScore = overall.averagePercentAcrossExams != null ? overall.averagePercentAcrossExams : 0;
    if (averageScore === 0 && byExam.length > 0) {
        var sum = byExam.reduce(function (a, e) { return a + (e.averageScore || 0); }, 0);
        averageScore = byExam.length ? Math.round(sum / byExam.length) : 0;
    }
    var studyHours = getStudyHoursFromGamifiedState();
    var rank = null;
    if (byExam.length > 0) {
        var ranks = byExam.map(function (e) { return e.rank; }).filter(function (r) { return r != null && Number.isFinite(r); });
        if (ranks.length) rank = Math.min.apply(null, ranks);
    }
    var stats = { totalExams: totalExams, averageScore: averageScore, studyHours: studyHours, rank: rank };
    console.log("Updating dashboard with stats:", stats);
    updateDashboardStats(stats);
    try { localStorage.setItem("userStats", JSON.stringify(stats)); } catch (_) {}
    updateWeakAreas(summary);
}

// Weak Areas: from exams (avg < 70%) and practice quizzes (topic avg < 70% or in weak list)
var WEAK_THRESHOLD_PCT = 70;

function updateWeakAreas(summary) {
    var container = document.getElementById("weakAreasContainer");
    if (!container) return;
    var weakSet = {};
    summary = summary || lastStudentSummary;

    if (summary && summary.byExam && summary.byExam.length) {
        summary.byExam.forEach(function (e) {
            var avg = e.averageScore != null ? e.averageScore : e.latestPercent;
            if (avg != null && avg < WEAK_THRESHOLD_PCT && e.examTitle) {
                weakSet[String(e.examTitle).trim()] = true;
            }
        });
    }

    var quizResults = [];
    try { quizResults = JSON.parse(localStorage.getItem(STORAGE_QUIZ_RESULTS)) || {}; } catch (_) {}
    var topicKeys = ["topic_os", "topic_dbms", "topic_cn"];
    var topicLabels = { topic_os: "OS", topic_dbms: "DBMS", topic_cn: "CN" };
    topicKeys.forEach(function (key) {
        var arr = quizResults[key];
        if (arr && arr.length) {
            var sum = arr.reduce(function (s, x) { return s + (x.pct || 0); }, 0);
            var avg = sum / arr.length;
            if (avg < WEAK_THRESHOLD_PCT) weakSet[topicLabels[key] || key] = true;
        }
    });
    function isSubjectOrTopic(name) {
        var t = String(name).trim();
        if (!t) return false;
        if (/^Q\d+$/i.test(t)) return false;
        if (/^\d+$/.test(t)) return false;
        return true;
    }
    Object.keys(quizResults).forEach(function (key) {
        var arr = quizResults[key];
        if (arr && arr.length) {
            arr.slice(-5).forEach(function (r) {
                (r.weak || []).forEach(function (w) {
                    var t = String(w).trim();
                    if (t && isSubjectOrTopic(t)) weakSet[t] = true;
                });
            });
        }
    });

    var weakList = Object.keys(weakSet).filter(Boolean).slice(0, 12);
    if (weakList.length) {
        container.innerHTML = weakList.map(function (name) {
            return "<span class=\"weak-tag\">" + escapeHtml(name) + "</span>";
        }).join("");
    } else {
        container.innerHTML = "<span class=\"weak-tag weak-tag-placeholder\">No weak areas detected yet</span>";
    }
}

// Render exam cards into a container (stats = optional map examId -> { locked, latestScore, averageScore, rank, totalParticipants })
function renderExamCards(container, list, emptyMsg, stats) {
    if (!container) return;
    var statMap = stats || {};
    if (!list || !list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-clipboard' style="font-size: 48px; color: rgba(255, 255, 255, 0.65); margin-bottom: 16px;"></i>
                <h3 style="color: rgba(255, 255, 255, 0.9); margin-bottom: 8px;">No Exams Available</h3>
                <p style="color: rgba(255, 255, 255, 0.88);">${emptyMsg || "Check back later for new practice tests and mock tests."}</p>
            </div>
        `;
        return;
    }
    container.innerHTML = list.map(function (exam) {
        var subs = (exam.subjects && exam.subjects.length) ? exam.subjects.join(", ") : "General";
        var type = exam.exam_type === "mock" ? "Mock Test" : "Practice Test";
        var diff = exam.difficulty ? String(exam.difficulty).toUpperCase() : "MIXED";
        var s = statMap[String(exam.id)] || {};
        var locked = s.locked === true;
        var attemptCount = s.attemptCount != null ? s.attemptCount : 0;
        var isPractice = exam.exam_type === "practice";
        var showReattempt = isPractice && !locked && attemptCount >= 1;
        var statsHtml = "";
        if (s.latestScore != null || s.rank != null) {
            var parts = [];
            if (s.latestScore != null) parts.push("Latest: " + s.latestScore + "%");
            if (s.averageScore != null) parts.push("Avg: " + s.averageScore + "%");
            if (s.rank != null && s.totalParticipants) parts.push("Rank: #" + s.rank + " of " + s.totalParticipants);
            if (parts.length) statsHtml = "<p class=\"exam-card-stats\">" + escapeHtml(parts.join(" · ")) + "</p>";
        }
        var btnText = locked ? null : (showReattempt ? "Reattempt" : "Start Exam");
        var btnHtml = locked
            ? "<p class=\"exam-locked-label\"><i class='bx bx-lock-alt'></i> Attempted — no more attempts</p>"
            : "<button class=\"start-exam-btn\" onclick=\"window.startExamPaper && window.startExamPaper('" + exam.id + "')\">" + escapeHtml(btnText) + "</button>";
        return `
            <div class="exam-card">
                <h3>${escapeHtml(exam.title || "Exam")}</h3>
                <p class="exam-subjects"><strong>Subjects:</strong> ${escapeHtml(subs)}</p>
                <div class="exam-meta">
                    <span><i class='bx bx-time'></i> ${escapeHtml(String(exam.duration_minutes || 0))} min</span>
                    <span><i class='bx bx-trophy'></i> ${escapeHtml(String(exam.total_marks || 0))} marks</span>
                </div>
                <div class="exam-badges">
                    <span class="exam-badge ${exam.exam_type === "mock" ? "mock" : "practice"}">${type}</span>
                    <span class="exam-badge difficulty">${diff}</span>
                </div>
                ${statsHtml}
                ${btnHtml}
            </div>
        `;
    }).join("");
}

var practiceExamsFullList = [];
var practiceExamsStatsMap = {};

function examMatchesPracticeSearch(exam, q) {
    if (!q) return true;
    var subs = (exam.subjects && exam.subjects.length) ? exam.subjects.join(" ") : "";
    var hay = [
        exam.title || "",
        subs,
        exam.exam_type || "",
        exam.difficulty || "",
        String(exam.duration_minutes != null ? exam.duration_minutes : ""),
        String(exam.total_marks != null ? exam.total_marks : "")
    ].join(" ").toLowerCase();
    return q.split(/\s+/).filter(Boolean).every(function (tok) {
        return hay.indexOf(tok) !== -1;
    });
}

function initPracticeExamSearch() {
    var input = document.getElementById("practiceExamSearch");
    if (!input || input.dataset.bound === "1") return;
    input.dataset.bound = "1";
    input.addEventListener("input", function () {
        var grid = document.getElementById("practiceExamsGrid");
        if (!grid) return;
        var q = (input.value || "").trim().toLowerCase();
        var filtered = practiceExamsFullList.filter(function (exam) {
            return examMatchesPracticeSearch(exam, q);
        });
        var emptyMsg = q ? "No exams match your search. Try another keyword." : null;
        renderExamCards(grid, filtered, emptyMsg, practiceExamsStatsMap);
    });
}

// Load exams data (with student attempt summary for locked state and stats)
function loadExams() {
    var base = API_BASE || "";
    var email = (localStorage.getItem("currentUserEmail") || (typeof getStoredEmail === "function" ? getStoredEmail() : "") || "").trim();

    function applyExams(list, statsMap) {
        list = list || [];
        statsMap = statsMap || {};
        practiceExamsFullList = list.slice();
        practiceExamsStatsMap = statsMap;

        var completedGrid = document.getElementById("examsGridCompleted");
        var ongoingGrid = document.getElementById("examsGridOngoing");
        var practiceGrid = document.getElementById("practiceExamsGrid");

        if (completedGrid || ongoingGrid) {
            var completed = list.filter(function (e) {
                var s = statsMap[String(e.id)] || {};
                return (s.attemptCount || 0) >= 1;
            });
            var ongoing = list.filter(function (e) {
                var s = statsMap[String(e.id)] || {};
                return !s.locked;
            });
            if (completedGrid) {
                renderExamCards(
                    completedGrid,
                    completed,
                    "You haven't completed any exams yet. Start one from Ongoing or Practice.",
                    statsMap
                );
            }
            if (ongoingGrid) renderExamCards(ongoingGrid, ongoing, null, statsMap);
        }

        if (practiceGrid) {
            var searchInput = document.getElementById("practiceExamSearch");
            var q = searchInput ? (searchInput.value || "").trim().toLowerCase() : "";
            var practiceList = list.filter(function (exam) {
                return examMatchesPracticeSearch(exam, q);
            });
            var emptyMsg = q ? "No exams match your search. Try another keyword." : null;
            renderExamCards(practiceGrid, practiceList, emptyMsg, statsMap);
        }

        initPracticeExamSearch();
    }

    function buildStatsMap(summary) {
        var statsMap = {};
        (summary.byExam || []).forEach(function (e) {
            var key = String(e.examId);
            statsMap[key] = {
                locked: e.locked === true,
                attemptCount: e.attemptCount != null ? e.attemptCount : 0,
                latestScore: e.latestPercent,
                averageScore: e.averageScore,
                rank: e.rank,
                totalParticipants: e.totalParticipants,
            };
        });
        return statsMap;
    }

    function dedupeExamsByTitleAndType(list) {
        if (!list || !list.length) return list;
        var seen = {};
        return list.filter(function (exam) {
            var title = (exam.title || "").trim().toLowerCase();
            var type = exam.exam_type || "practice";
            var key = title + "|" + type;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    // Fetch exams and student summary in parallel when we have email (works with base "" for same-origin or base for cross-origin)
    if (email) {
        var summaryUrl = base + "/api/attempts/student/summary?email=" + encodeURIComponent(email);
        console.log("Loading exams and summary for email:", email, "URL:", summaryUrl);
        Promise.all([
            fetch(base + "/api/exams").then(function (res) { return res.ok ? res.json() : []; }).catch(function (e) { console.error("Exams fetch error:", e); return []; }),
            fetch(summaryUrl).then(function (r) {
                if (!r.ok) { console.warn("Summary fetch not ok:", r.status, r.statusText); return {}; }
                return r.json();
            }).catch(function (e) { console.error("Summary fetch error:", e); return {}; })
        ]).then(function (results) {
            var list = Array.isArray(results[0]) ? results[0] : [];
            list = dedupeExamsByTitleAndType(list);
            var summary = results[1] || {};
            console.log("Summary received:", summary);
            var statsMap = buildStatsMap(summary);
            console.log("Stats map built:", statsMap);
            applyExams(list, statsMap);
            if (typeof updateDashboardStatsFromSummary === "function") {
                console.log("Updating dashboard stats from summary");
                updateDashboardStatsFromSummary(summary);
            }
        }).catch(function (err) {
            console.error("Load exams/summary error:", err);
            fetch(base + "/api/exams").then(function (res) { return res.ok ? res.json() : []; }).then(function (list) {
                applyExams(Array.isArray(list) ? list : [], {});
            }).catch(function () { applyExams([], {}); });
        });
        return;
    } else {
        console.warn("No email found for loading exams summary. Email:", email, "currentUserEmail:", localStorage.getItem("currentUserEmail"), "getStoredEmail:", typeof getStoredEmail === "function" ? getStoredEmail() : "N/A");
    }

    fetch(base + "/api/exams")
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (exams) {
            var list = dedupeExamsByTitleAndType(Array.isArray(exams) ? exams : []);
            if (base && email) {
                fetch(base + "/api/attempts/student/summary?email=" + encodeURIComponent(email))
                    .then(function (r) { return r.ok ? r.json() : {}; })
                    .then(function (summary) {
                        applyExams(list, buildStatsMap(summary));
                        if (typeof updateDashboardStatsFromSummary === "function") updateDashboardStatsFromSummary(summary);
                    })
                    .catch(function () { applyExams(list, {}); });
            } else {
                applyExams(list, {});
            }
        })
        .catch(function (err) {
            console.error("Load exams error:", err);
            var storedExams = localStorage.getItem("userExams");
            var exams = storedExams ? JSON.parse(storedExams) : [];
            if (!exams.length) {
                applyExams([], {});
                return;
            }
            var legacyList = exams.map(function (e) {
                return { id: e.id, title: e.name || e.title, duration_minutes: e.duration, total_marks: e.marks || 0, subjects: [], exam_type: "practice" };
            });
            applyExams(legacyList, {});
        });
}

// Load results data
function loadResults() {
    function renderResultsUI(results) {
        const arr = Array.isArray(results) ? results : [];
        const resultsList = document.getElementById("resultsList");
        if (resultsList) {
            if (arr.length === 0) {
                resultsList.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px 20px;">
                        <i class='bx bx-bar-chart-alt-2' style="font-size: 48px; color: rgba(255, 255, 255, 0.3); margin-bottom: 16px;"></i>
                        <h3 style="color: rgba(255, 255, 255, 0.7); margin-bottom: 8px;">No Results Yet</h3>
                        <p style="color: rgba(255, 255, 255, 0.5);">Complete your first exam to see results here.</p>
                    </div>
                `;
            } else {
                const recentResults = arr.slice(0, 3);
                resultsList.innerHTML = recentResults.map(function (result) {
                    return `
                        <div class="result-item">
                            <div class="result-info">
                                <h4>${result.name}</h4>
                                <p>${result.date || "--"}</p>
                            </div>
                            <div class="result-score">
                                <div class="score">${result.score}%</div>
                                <div class="rank">Rank #${result.rank != null ? result.rank : "--"}</div>
                            </div>
                        </div>
                    `;
                }).join("");
            }
        }

        const resultsTableBody = document.getElementById("resultsTableBody");
        if (resultsTableBody) {
            if (arr.length === 0) {
                resultsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                            <i class='bx bx-bar-chart-alt-2' style="font-size: 32px; display: block; margin-bottom: 12px; opacity: 0.3;"></i>
                            No results available yet. Complete exams to see your results here.
                        </td>
                    </tr>
                `;
            } else {
                resultsTableBody.innerHTML = arr.map(function (result) {
                    var status = result.status || "attempted";
                    return `
                        <tr>
                            <td>${result.name}</td>
                            <td>${result.date || "--"}</td>
                            <td>${result.score}%</td>
                            <td>#${result.rank != null ? result.rank : "--"}</td>
                            <td><span class="status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        </tr>
                    `;
                }).join("");
            }
        }
    }

    function mapSummaryToResults(summary) {
        var byExam = summary && Array.isArray(summary.byExam) ? summary.byExam : [];
        function formatDate(dt) {
            if (!dt) return "--";
            try {
                return new Date(dt).toLocaleString();
            } catch (_) {
                return "--";
            }
        }
        return byExam.map(function (e) {
            var latestAt = e.latestSubmittedAt || null;
            return {
                name: e.examTitle || ("Exam " + e.examId),
                date: formatDate(latestAt),
                _dateTs: latestAt ? new Date(latestAt).getTime() : 0,
                score: e.latestPercent != null ? e.latestPercent : 0,
                rank: e.rank != null ? e.rank : "--",
                status: "attempted",
            };
        }).sort(function (a, b) {
            return (Number(b._dateTs) || 0) - (Number(a._dateTs) || 0);
        });
    }

    // Start with local cache for immediate render
    const storedResults = localStorage.getItem("userResults");
    const localResults = storedResults ? JSON.parse(storedResults) : [];
    renderResultsUI(localResults);

    // Performance insight + canonical results from API summary
    var email = localStorage.getItem("currentUserEmail") || (typeof getStoredEmail === "function" ? getStoredEmail() : "") || "";
    var insightEl = document.getElementById("examStatsInsight");
    if (insightEl && email && (API_BASE || "")) {
        fetch((API_BASE || "") + "/api/attempts/student/summary?email=" + encodeURIComponent(email))
            .then(function (r) { return r.ok ? r.json() : {}; })
            .then(function (summary) {
                var overall = summary.overall;
                var summaryResults = mapSummaryToResults(summary);
                if (summaryResults.length) {
                    renderResultsUI(summaryResults);
                    try { localStorage.setItem("userResults", JSON.stringify(summaryResults)); } catch (_) {}
                }
                if (overall && (overall.totalExamsAttempted > 0 || overall.averagePercentAcrossExams != null)) {
                    insightEl.textContent = "Performance: You've attempted " + (overall.totalExamsAttempted || 0) + " exam(s) with an average score of " + (overall.averagePercentAcrossExams != null ? overall.averagePercentAcrossExams + "%" : "—") + ".";
                    insightEl.style.display = "block";
                } else {
                    insightEl.style.display = "none";
                }
                if (typeof updateDashboardStatsFromSummary === "function") updateDashboardStatsFromSummary(summary);
            })
            .catch(function () {
                insightEl.style.display = "none";
                updateDashboardStatsFromLocalResults(localResults);
            });
    } else if (insightEl) {
        insightEl.style.display = "none";
    }
    updateDashboardStatsFromLocalResults(localResults);
}

function updateDashboardStatsFromLocalResults(results) {
    if (!results || !results.length || typeof updateDashboardStats !== "function") return;
    var totalExams = results.length;
    var sum = results.reduce(function (a, r) { return a + (Number(r.score) || 0); }, 0);
    var averageScore = totalExams ? Math.round(sum / totalExams) : 0;
    var rank = results.length && results[0].rank != null ? results[0].rank : null;
    updateDashboardStats({ totalExams: totalExams, averageScore: averageScore, studyHours: getStudyHoursFromGamifiedState(), rank: rank });
}

// Load notifications (from backend, with DB-backed entries)
function loadNotifications() {
    const email = localStorage.getItem("currentUserEmail") || "";
    if (!email) return;
    const role = "student";
    const base = API_BASE || "";
    const url = `${base}/api/notifications?email=${encodeURIComponent(email)}&role=${role}`;
    fetch(url)
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then(function (list) {
            var notifications = Array.isArray(list) ? list : [];
            var notificationsList = document.getElementById("notificationsList");
            if (notificationsList) {
                if (notifications.length === 0) {
                    notificationsList.innerHTML = "<p class='no-notifications-msg'>No notifications yet.</p>";
                } else {
                    notificationsList.innerHTML = notifications
                    .map(
                        notif => `
            <div class="notification-item ${notif.is_read ? "" : "unread"}">
                <h4>${escapeHtml(notif.title || "Notification")}</h4>
                <p>${escapeHtml(notif.message || "")}</p>
                <span class="time">${notif.created_at ? escapeHtml(new Date(notif.created_at).toLocaleString()) : ""}</span>
            </div>`
                    )
                    .join("");
                }
            }
            var unreadCount = notifications.filter(function (n) { return !n.is_read; }).length;
            const badge = document.getElementById("notificationBadge");
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = unreadCount > 0 ? "block" : "none";
            }

            // Optional: show one toast for newest unread (e.g. "Your doubt has been answered")
            var lastSeen = parseInt(localStorage.getItem("examease_student_last_notif_time") || "0", 10);
            var fresh = notifications.filter(function (n) {
                if (!n.created_at || n.is_read) return false;
                var t = new Date(n.created_at).getTime();
                return lastSeen > 0 && t > lastSeen;
            });
            if (fresh.length > 0) {
                var first = fresh[0];
                showNotificationToast(first.title || "New notification", first.message || "", 2500);
            }
            localStorage.setItem("examease_student_last_notif_time", String(Date.now()));
        })
        .catch(err => {
            console.error("Load notifications (API) error:", err);
        });
}

// Toggle sidebar
// Start exam function
function startExam(examName) {
    // Show alert
    if (typeof showAlert === "function") {
        showAlert(`Starting ${examName}...`, null, "success");
    }
    
    // In a real app, this would navigate to the exam page
    setTimeout(() => {
        alert(`Exam "${examName}" would start here. This is a demo.`);
    }, 500);
}

// Close sidebar when clicking outside (mobile)
document.addEventListener("click", function(event) {
    const sidebar = document.getElementById("sidebar");
    const menuToggle = document.querySelector(".menu-toggle");
    
    if (window.innerWidth <= 1024 && 
        sidebar.classList.contains("active") && 
        !sidebar.contains(event.target) && 
        event.target !== menuToggle &&
        !menuToggle.contains(event.target)) {
        sidebar.classList.remove("active");
    }
});

// Handle window resize
window.addEventListener("resize", function() {
    const sidebar = document.getElementById("sidebar");
    if (window.innerWidth > 1024) {
        sidebar.classList.remove("active");
    }
});

// ——— Doubts & Discussion (stored in DB, shared with admin) ———
const KEY_DOUBTS = "examease_doubts"; // kept for legacy/local fallback only

function loadDiscussion() {
    const list = document.getElementById("discussionList");
    if (!list) return;
    const email = localStorage.getItem("currentUserEmail") || "";
    const url = (API_BASE ? `${API_BASE}/api/doubts?email=${encodeURIComponent(email)}` : `/api/doubts?email=${encodeURIComponent(email)}`);
    fetch(url)
        .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
        .then(doubts => {
            const arr = doubts || [];
            if (arr.length === 0) {
                list.innerHTML = "<p style='color: rgba(255,255,255,0.5);'>No questions yet. Ask one above!</p>";
                return;
            }
            list.innerHTML = arr.slice(0, 20).map(d => {
                const hasAnswer = d.answer && String(d.answer).trim();
                const created = d.created_at ? new Date(d.created_at).toLocaleString() : "";
                const answeredMeta = hasAnswer && d.answered_at
                    ? `<div class="doubt-meta">Answered by ${escapeHtml(d.answered_by_name || "Admin")} · ${new Date(d.answered_at).toLocaleString()}</div>`
                    : "";
                return `
        <div class="discussion-item">
            <div class="doubt-q">${escapeHtml(d.q || d.question || "")}</div>
            <div class="doubt-meta">${escapeHtml(d.subject || d.category || "")} · ${escapeHtml(d.student_name || d.author || "Student")} · ${created}</div>
            ${hasAnswer
                ? `<div class="doubt-answer"><strong>Answer:</strong> ${escapeHtml(d.answer)}</div>${answeredMeta}`
                : "<div class='doubt-answer' style='color: rgba(255,255,255,0.5);'>Waiting for teacher/peer response.</div>"}
        </div>`;
            }).join("");
        })
        .catch(err => {
            console.error("Load doubts from API failed, falling back to local:", err);
            // Fallback to legacy localStorage if API is unreachable
            try {
                const doubts = JSON.parse(localStorage.getItem(KEY_DOUBTS) || "[]");
                if (!doubts.length) {
                    list.innerHTML = "<p style='color: rgba(255,255,255,0.5);'>No questions yet. Ask one above!</p>";
                    return;
                }
                list.innerHTML = doubts.slice(0, 20).map(d => `
        <div class="discussion-item">
            <div class="doubt-q">${escapeHtml(d.q || d.question)}</div>
            <div class="doubt-meta">${escapeHtml(d.category)} · ${escapeHtml(d.author || "Student")} · ${d.time || ""}</div>
            ${(d.answer && d.answer.trim()) ? `<div class="doubt-answer"><strong>Answer:</strong> ${escapeHtml(d.answer)}</div>` : "<div class='doubt-answer' style='color: rgba(255,255,255,0.5);'>Waiting for teacher/peer response.</div>"}
        </div>
    `).join("");
            } catch {
                list.innerHTML = "<p style='color: rgba(255,255,255,0.5);'>No questions yet. Ask one above!</p>";
            }
        });
}

function submitDoubt(e) {
    e.preventDefault();
    const question = document.getElementById("doubtQuestion").value.trim();
    const category = document.getElementById("doubtCategory").value;
    if (!question) return;
    const email = localStorage.getItem("currentUserEmail") || "";
    const name = localStorage.getItem("username") || "Student";
    const url = API_BASE ? `${API_BASE}/api/doubts` : "/api/doubts";
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email,
            name,
            question,
            subject: category
        })
    })
        .then(res => res.json())
        .then(data => {
            if (!data || (data.message && data.message.toLowerCase().includes("failed"))) {
                throw new Error(data && data.message ? data.message : "Failed to submit doubt.");
            }
            document.getElementById("doubtForm").reset();
            loadDiscussion();
            if (typeof showAlert === "function") showAlert("Question posted! Teachers or peers may respond soon.", null, "success");
        })
        .catch(err => {
            console.error("Submit doubt API error:", err);
            // Fallback to localStorage so user is not blocked
            try {
                const doubts = JSON.parse(localStorage.getItem(KEY_DOUBTS) || "[]");
                doubts.unshift({
                    id: Date.now(),
                    q: question,
                    question,
                    category,
                    author: name,
                    authorEmail: email,
                    time: "Just now",
                    answer: null
                });
                localStorage.setItem(KEY_DOUBTS, JSON.stringify(doubts));
            } catch (_) {}
            document.getElementById("doubtForm").reset();
            loadDiscussion();
            if (typeof showAlert === "function") showAlert("Question posted! (saved locally, backend unreachable)", null, "success");
        });
}

// ——— Study Materials (from API: server + DB) ———
var KEY_LAST_VISIT_TIME = "examease_student_last_visit_time";

function getDownloadUrl(id, preview) {
    const base = API_BASE || "";
    return `${base}/api/study-materials/${id}/download${preview ? "?preview=1" : ""}`;
}

function showNewMaterialNotification(count) {
    const msg = count === 1 ? "New study material uploaded!" : count + " new study materials uploaded!";
    const existing = document.getElementById("studentNewMaterialToast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "studentNewMaterialToast";
    toast.innerHTML = "<span><i class='bx bx-book'></i> " + msg + " Check the <strong>Study Materials</strong> section.</span>";
    Object.assign(toast.style, {
        position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
        padding: "14px 24px", borderRadius: "12px", zIndex: "99999",
        background: "linear-gradient(135deg, #174bbd 0%, #1e5cd4 50%, #4ed442 100%)",
        color: "#fff", fontSize: "14px", fontWeight: "500", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        maxWidth: "90vw", pointerEvents: "auto"
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.4s ease";
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

function loadMaterials() {
    const url = API_BASE ? `${API_BASE}/api/study-materials` : "/api/study-materials";
    var lastVisitTime = parseInt(localStorage.getItem(KEY_LAST_VISIT_TIME) || "0", 10);
    fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then((list) => {
            const arr = list || [];
            const notes = arr.filter((m) => m.category === "notes");
            const lectures = arr.filter((m) => m.category === "lectures");
            const resources = arr.filter((m) => m.category === "resources");
            renderMaterialGrid("notesGrid", notes);
            renderMaterialGrid("lecturesGrid", lectures);
            renderMaterialGrid("resourcesGrid", resources);
            var newMaterials = [];
            if (lastVisitTime > 0 && arr.length > 0) {
                newMaterials = arr.filter(function (m) {
                    var created = m.created_at ? new Date(m.created_at).getTime() : 0;
                    return created > lastVisitTime;
                });
            }
            if (newMaterials.length > 0) {
                showNewMaterialNotification(newMaterials.length);
                addNewMaterialNotificationToList(newMaterials.length);
                loadNotifications();
            }
            localStorage.setItem(KEY_LAST_VISIT_TIME, String(Date.now()));
        })
        .catch((err) => {
            console.error("Load study materials:", err);
            renderMaterialGrid("notesGrid", []);
            renderMaterialGrid("lecturesGrid", []);
            renderMaterialGrid("resourcesGrid", []);
            if (lastVisitTime === 0) localStorage.setItem(KEY_LAST_VISIT_TIME, String(Date.now()));
        });
}

function addNewMaterialNotificationToList(newCount) {
    var key = "examease_new_material_notifications";
    var list = [];
    try {
        list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (_) {}
    var msg = newCount === 1 ? "New study material uploaded. Check Study Materials section." : newCount + " new study materials uploaded. Check Study Materials section.";
    list.unshift({
        title: "New Study Material",
        message: msg,
        time: "Just now",
        unread: true,
        id: "mat-" + Date.now()
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
}

// True when an announcement should appear under "Upcoming Exams" (not the general megaphone strip).
// Primary: admin category "exam" (Exam / Schedule). Secondary: obvious exam/schedule wording in title or body.
function isExamOrScheduleAnnouncement(a) {
    if (!a) return false;
    var cat = String(a.category == null ? "" : a.category)
        .toLowerCase()
        .trim();
    if (cat === "exam") return true;
    if (cat === "career") return false;
    var hay = ((a.title || "") + " " + (a.description || "")).toLowerCase();
    if (!hay.trim()) return false;
    return /\b(mock\s*test|mock|midterm|final\s*exam|proctored|assessment|quiz|examination|exam|exams|test|tests|paper|attempt|attempts|schedule|scheduled|scheduling|timetable|rescheduled|postponed|slot|slots|deadline|registration|venue|hall|syllabus|semester)\b/i.test(
        hay
    );
}

// Announcements (from admin content module, DB-backed)
// Exam / schedule posts appear under Upcoming Exams instead of here (see isExamOrScheduleAnnouncement).
function loadAnnouncements() {
    const el = document.getElementById("dashboardAnnouncements");
    if (!el) return;
    fetch(apiUrl("/api/announcements?limit=24"))
        .then(parseJsonArrayResponse)
        .then((list) => {
            const arr = Array.isArray(list) ? list : [];
            const general = arr.filter((a) => !isExamOrScheduleAnnouncement(a)).slice(0, 6);
            if (!general.length) {
                el.innerHTML = "";
                el.style.display = "none";
                return;
            }
            el.style.display = "block";
            el.innerHTML = `<h2><i class='bx bx-megaphone'></i> Announcements</h2><div class="announcements-list">${general
                .map(
                    (a) => `
            <div class="announcement-card">
                <h4>${escapeHtml(a.title)}</h4>
                <p>${escapeHtml(a.description)}</p>
                ${a.link_url ? `<a href="${escapeHtml(a.link_url)}" target="_blank" rel="noopener" class="announcement-link">View details</a>` : ""}
                <span class="announce-time">${a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</span>
            </div>
        `
                )
                .join("")}</div>`;
        })
        .catch(() => {
            el.innerHTML = "";
            el.style.display = "none";
        });
}

function renderUpcomingExamScheduleCards(container, list) {
    if (!container) return;
    if (!list || !list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class='bx bx-calendar-event' style="font-size: 48px; color: rgba(255, 255, 255, 0.65); margin-bottom: 16px;"></i>
                <h3 style="color: rgba(255, 255, 255, 0.9); margin-bottom: 8px;">No schedule updates yet</h3>
                <p style="color: rgba(255, 255, 255, 0.88);">When your instructor posts an <strong>Exam / Schedule</strong> announcement, it appears here. Other posts that clearly mention exams, mocks, or schedules may also show here.</p>
            </div>
        `;
        return;
    }
    container.innerHTML = list.map(function (a) {
        var raw = (a.description || "").trim();
        var desc = raw.length > 240 ? raw.slice(0, 237) + "…" : raw;
        var when = a.created_at ? new Date(a.created_at).toLocaleString() : "";
        var linkBtn = a.link_url
            ? `<a class="start-exam-btn exam-schedule-link-btn" href="${escapeHtml(a.link_url)}" target="_blank" rel="noopener">View details</a>`
            : "";
        return `
            <div class="exam-card exam-card--schedule">
                <h3>${escapeHtml(a.title || "Exam update")}</h3>
                <p class="exam-subjects exam-schedule-desc">${escapeHtml(desc)}</p>
                <div class="exam-meta">
                    <span><i class='bx bx-time-five'></i> ${escapeHtml(when)}</span>
                </div>
                <div class="exam-badges">
                    <span class="exam-badge schedule-announcement">${String(a.category == null ? "" : a.category).toLowerCase().trim() === "exam" ? "Exam / Schedule" : "Exam update"}</span>
                </div>
                ${linkBtn}
            </div>
        `;
    }).join("");
}

function loadUpcomingExamAnnouncements() {
    var grid = document.getElementById("examsGridUpcoming");
    if (!grid) return;
    // Server-side filter (category=exam) is the source of truth for Exam / Schedule posts.
    // Full list + client filter merges keyword matches and catches edge cases.
    var urlExam = apiUrl("/api/announcements?limit=100&category=exam");
    var urlAll = apiUrl("/api/announcements?limit=100");
    Promise.all([
        fetch(urlExam).then(parseJsonArrayResponse).catch(function () {
            return [];
        }),
        fetch(urlAll).then(parseJsonArrayResponse).catch(function () {
            return [];
        }),
    ])
        .then(function (results) {
            var examFromServer = results[0] || [];
            var all = results[1] || [];
            var byId = new Map();
            examFromServer.forEach(function (a) {
                if (a && a.id != null) byId.set(Number(a.id), a);
            });
            all.filter(isExamOrScheduleAnnouncement).forEach(function (a) {
                if (a && a.id != null && !byId.has(Number(a.id))) byId.set(Number(a.id), a);
            });
            var upcoming = Array.from(byId.values());
            upcoming.sort(function (a, b) {
                var ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                var tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                return tb - ta;
            });
            renderUpcomingExamScheduleCards(grid, upcoming.slice(0, 30));
        })
        .catch(function (err) {
            console.error("Load exam schedule announcements:", err);
            renderUpcomingExamScheduleCards(grid, []);
        });
}

function renderMaterialGrid(id, items) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!items || items.length === 0) {
        el.innerHTML = "<p class='no-materials-msg'>No materials yet. Check back later.</p>";
        return;
    }
    el.innerHTML = items
        .map(
            (m) => `
        <div class="material-card">
            <h4>${escapeHtml(m.subject_name || m.title || "Material")}</h4>
            <p>${escapeHtml(m.description || m.desc || "")}</p>
            <span class="material-date">${m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}</span>
            <div class="material-actions">
                <a href="${getDownloadUrl(m.id, true)}" target="_blank" rel="noopener"><i class='bx bx-show'></i> Preview</a>
                <a href="${getDownloadUrl(m.id, false)}" download><i class='bx bx-download'></i> Download PDF</a>
            </div>
        </div>
    `
        )
        .join("");
}

function switchMaterialTab(tab) {
    document.querySelectorAll(".material-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".materials-panel").forEach(p => p.classList.remove("active"));
    const tabEl = document.querySelector(`.material-tab[data-tab="${tab}"]`);
    const panelId = tab === "notes" ? "materialsNotes" : tab === "lectures" ? "materialsLectures" : "materialsResources";
    if (tabEl) tabEl.classList.add("active");
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add("active");
}

// ——— Career & Internships: tips, live opportunities, useful links ———
var CAREER_TIPS = [
    "Build a strong resume: one page, clear sections, action verbs, and no errors.",
    "Improve technical skills with projects and certifications relevant to your target role.",
    "Work on communication: practice explaining projects and answering common interview questions.",
    "Prepare for interviews: behavioral (STAR method) and technical (concepts + coding).",
    "Network with alumni and professionals on LinkedIn; attend webinars and campus events.",
    "Maintain a professional portfolio (GitHub, LinkedIn, personal site) and keep it updated.",
    "Apply to internships 2–3 months before your preferred start date; tailor each application."
];
// Fallback opportunities linking to official job search pages
var INTERNSHIPS_SAMPLE = [
    { role_title: "Internships on LinkedIn", company: "LinkedIn", location: "", deadline: null, apply_url: "https://www.linkedin.com/jobs/search/?keywords=internship" },
    { role_title: "Internships on Internshala", company: "Internshala", location: "", deadline: null, apply_url: "https://internshala.com/internships" },
    { role_title: "Jobs on Naukri.com", company: "Naukri.com", location: "", deadline: null, apply_url: "https://www.naukri.com/internship-jobs" },
    { role_title: "Internships on Indeed", company: "Indeed", location: "", deadline: null, apply_url: "https://www.indeed.com/q-internship-jobs.html" }
];
// Direct redirect buttons to official platforms
var CAREER_PLATFORM_LINKS = [
    { name: "LinkedIn", url: "https://www.linkedin.com/jobs/", icon: "bx bxl-linkedin-square" },
    { name: "Internshala", url: "https://internshala.com", icon: "bx bx-briefcase" },
    { name: "Naukri.com", url: "https://www.naukri.com", icon: "bx bx-search-alt" },
    { name: "Indeed", url: "https://www.indeed.com", icon: "bx bx-world" }
];
var CAREER_LINKS = [
    { text: "Resume and cover letter tips", url: "https://www.linkedin.com/help/linkedin/answer/664/resume-best-practices" },
    { text: "Interview preparation guide", url: "https://www.indeed.com/career-advice/interviewing" }
];

function loadCareer() {
    var base = API_BASE || "";
    // 1) Career guidance tips (from API or static)
    fetch(base + "/api/career/resources")
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (rows) {
            var tipsList = document.getElementById("careerTipsList");
            if (!tipsList) return;
            if (rows && rows.length) {
                var tips = rows.filter(function (r) { return r.category === "tips"; }).map(function (r) { return r.content || r.title; });
                if (tips.length) tipsList.innerHTML = tips.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("");
                else tipsList.innerHTML = CAREER_TIPS.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("");
            } else {
                tipsList.innerHTML = CAREER_TIPS.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("");
            }
        })
        .catch(function () {
            var tipsList = document.getElementById("careerTipsList");
            if (tipsList) tipsList.innerHTML = CAREER_TIPS.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("");
        });

    // 2) Live internship opportunities — cards with "Apply Now" (open in new tab)
    fetch(base + "/api/career/opportunities")
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (rows) {
            var internList = document.getElementById("internshipsList");
            if (!internList) return;
            var list = (rows && rows.length) ? rows : INTERNSHIPS_SAMPLE;
            internList.innerHTML = list.map(function (i) {
                var company = i.company || "";
                var role = i.role_title || i.title || "Opportunity";
                var loc = i.location ? " · " + escapeHtml(i.location) : "";
                var deadline = i.deadline ? "Deadline: " + new Date(i.deadline).toLocaleDateString() : "";
                var url = i.apply_url || "#";
                return (
                    '<div class="internship-item career-opportunity-card">' +
                    "<h4>" + escapeHtml(role) + "</h4>" +
                    "<p>" + escapeHtml(company) + loc + "</p>" +
                    (deadline ? "<span class='career-deadline'>" + deadline + "</span>" : "") +
                    '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="career-apply-btn"><i class=\'bx bx-link-external\'></i> Apply Now</a>' +
                    "</div>"
                );
            }).join("");
        })
        .catch(function () {
            var internList = document.getElementById("internshipsList");
            if (internList) {
                internList.innerHTML = INTERNSHIPS_SAMPLE.map(function (i) {
                    var url = i.apply_url || "#";
                    return '<div class="internship-item career-opportunity-card"><h4>' + escapeHtml(i.role_title || i.title) + "</h4><p>" + escapeHtml(i.company) + (i.location ? " · " + escapeHtml(i.location) : "") + "</p><a href=\"" + url + "\" target=\"_blank\" rel=\"noopener\" class=\"career-apply-btn\"><i class=\'bx bx-link-external\'></i> Apply Now</a></div>";
                }).join("");
            }
        });

    // 3) Useful Links — platform redirect buttons (LinkedIn, Internshala, Naukri, Indeed)
    var platformEl = document.getElementById("careerPlatformButtons");
    if (platformEl) {
        platformEl.innerHTML = CAREER_PLATFORM_LINKS.map(function (p) {
            return '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener" class="career-platform-btn"><i class="' + escapeHtml(p.icon) + '"></i><span>' + escapeHtml(p.name) + '</span></a>';
        }).join("");
    }
    var linksEl = document.getElementById("careerLinks");
    if (linksEl) linksEl.innerHTML = CAREER_LINKS.map(function (l) { return "<a href=\"" + escapeHtml(l.url || "#") + "\" target=\"_blank\" rel=\"noopener\" class=\"career-extra-link\">" + escapeHtml(l.text) + "</a>"; }).join("");
}

// ——— Feedback & Self-Assessment ———
const STORAGE_FEEDBACK = "studentFeedback";
const STORAGE_SELF_ASSESSMENT = "studentSelfAssessment";
const STORAGE_QUIZ_RESULTS = "examease_quiz_results";
const STORAGE_GAMIFIED = "examease_gamified_progress";
const STORAGE_ACHIEVEMENTS = "examease_achievements";
const STORAGE_LANG = "examease_lang";

function initFeedbackCategoryDropdown() {
    var wrap = document.getElementById("feedbackCategoryWrap");
    var trigger = document.getElementById("feedbackCategoryTrigger");
    var valueEl = wrap && wrap.querySelector(".custom-select-value");
    var dropdown = document.getElementById("feedbackCategoryDropdown");
    var select = document.getElementById("feedbackCategory");
    if (!wrap || !trigger || !dropdown || !select) return;
    trigger.addEventListener("click", function (e) {
        e.preventDefault();
        wrap.classList.toggle("open");
    });
    wrap.querySelectorAll(".custom-select-option").forEach(function (opt) {
        opt.addEventListener("click", function (e) {
            e.stopPropagation();
            var val = this.getAttribute("data-value");
            select.value = val;
            if (valueEl) valueEl.textContent = val;
            wrap.querySelectorAll(".custom-select-option").forEach(function (o) { o.classList.remove("selected"); });
            this.classList.add("selected");
            wrap.classList.remove("open");
        });
    });
    document.addEventListener("click", function (e) {
        if (wrap && !wrap.contains(e.target)) wrap.classList.remove("open");
    });
}

function initFeedback() {
    var form = document.getElementById("feedbackForm");
    if (form) form.dataset.rating = "3";
    var rating = document.getElementById("feedbackRating");
    if (rating) {
        rating.querySelectorAll("span").forEach(function(s) {
            s.addEventListener("click", function() {
                var v = this.getAttribute("data-rating");
                rating.querySelectorAll("span").forEach(function(sp, i) {
                    sp.classList.toggle("active", i < v);
                });
                var f = document.getElementById("feedbackForm");
                if (f) f.dataset.rating = v;
            });
        });
    }
    ["assessSubject", "assessReadiness", "assessTimeMgmt"].forEach(function(id) {
        var input = document.getElementById(id);
        var valEl = document.getElementById(id + "Val");
        if (input && valEl) input.addEventListener("input", function() { valEl.textContent = input.value; });
    });
    var saved = JSON.parse(localStorage.getItem(STORAGE_SELF_ASSESSMENT)) || {};
    if (saved.subject) { var el = document.getElementById("assessSubject"); if (el) { el.value = saved.subject; document.getElementById("assessSubjectVal").textContent = saved.subject; } }
    if (saved.readiness) { el = document.getElementById("assessReadiness"); if (el) { el.value = saved.readiness; document.getElementById("assessReadinessVal").textContent = saved.readiness; } }
    if (saved.timeMgmt) { el = document.getElementById("assessTimeMgmt"); if (el) { el.value = saved.timeMgmt; document.getElementById("assessTimeMgmtVal").textContent = saved.timeMgmt; } }
}

function loadFeedbackHistory() {
    var listEl = document.getElementById("feedbackHistoryList");
    if (!listEl) return;
    var email = getStoredEmail();
    var base = API_BASE || "";
    fetch(base + "/api/feedback?email=" + encodeURIComponent(email || ""))
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(rows) {
            if (rows && rows.length) {
                listEl.innerHTML = rows.map(function(f) {
                    var status = (f.status || "pending").toLowerCase();
                    var statusClass = status === "resolved" ? "resolved" : status === "reviewed" ? "reviewed" : "pending";
                    var date = f.created_at ? new Date(f.created_at).toLocaleDateString() : "";
                    var adminReplyHtml = (f.admin_reply && String(f.admin_reply).trim()) ? "<div class=\"fb-admin-reply\"><strong>Admin response:</strong> " + escapeHtml(f.admin_reply) + "</div>" : "";
                    return "<div class=\"feedback-history-item " + statusClass + "\"><div class=\"fb-meta\"><span class=\"fb-cat\">" + escapeHtml(f.category || "") + "</span><span class=\"fb-rating\">" + (f.rating || 0) + " ★</span><span class=\"fb-date\">" + escapeHtml(date) + "</span></div><div class=\"fb-msg\">" + escapeHtml((f.message || "").substring(0, 120)) + ((f.message || "").length > 120 ? "…" : "") + "</div>" + adminReplyHtml + "<span class=\"fb-status\">" + escapeHtml(f.status || "Pending") + "</span></div>";
                }).join("");
                return;
            }
            var local = JSON.parse(localStorage.getItem(STORAGE_FEEDBACK)) || [];
            if (local.length) {
                listEl.innerHTML = local.slice(0, 10).map(function(f) {
                    var date = f.date ? new Date(f.date).toLocaleDateString() : "";
                    return "<div class=\"feedback-history-item pending\"><div class=\"fb-meta\"><span class=\"fb-cat\">" + escapeHtml(f.type || "General") + "</span><span class=\"fb-rating\">" + (f.rating || 0) + " ★</span><span class=\"fb-date\">" + escapeHtml(date) + "</span></div><div class=\"fb-msg\">" + escapeHtml((f.message || "").substring(0, 120)) + "…</div><span class=\"fb-status\">Pending</span></div>";
                }).join("");
            } else {
                listEl.innerHTML = "<p class=\"no-feedback-msg\">No feedback submitted yet. Your submissions will appear here with status <em>Reviewed</em> or <em>Resolved</em>.</p>";
            }
        })
        .catch(function() {
            var local = JSON.parse(localStorage.getItem(STORAGE_FEEDBACK)) || [];
            if (local.length) {
                listEl.innerHTML = local.slice(0, 10).map(function(f) {
                    var date = f.date ? new Date(f.date).toLocaleDateString() : "";
                    return "<div class=\"feedback-history-item pending\"><div class=\"fb-meta\"><span class=\"fb-cat\">" + escapeHtml(f.type || "General") + "</span><span class=\"fb-rating\">" + (f.rating || 0) + " ★</span><span class=\"fb-date\">" + escapeHtml(date) + "</span></div><div class=\"fb-msg\">" + escapeHtml((f.message || "").substring(0, 120)) + "…</div><span class=\"fb-status\">Pending</span></div>";
                }).join("");
            } else {
                listEl.innerHTML = "<p class=\"no-feedback-msg\">No feedback submitted yet.</p>";
            }
        });
}

function submitFeedback(e) {
    e.preventDefault();
    var category = document.getElementById("feedbackCategory") && document.getElementById("feedbackCategory").value;
    var message = document.getElementById("feedbackMessage").value.trim();
    var rating = (document.getElementById("feedbackForm") && document.getElementById("feedbackForm").dataset.rating) || "3";
    var email = getStoredEmail();
    var name = localStorage.getItem("username") || "";
    var base = API_BASE || "";
    fetch(base + "/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, name: name, category: category || "Technical Issues", rating: parseInt(rating, 10) || 3, message: message })
    })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(res) {
            if (res.ok) {
                document.getElementById("feedbackForm").reset();
                var ratingEl = document.getElementById("feedbackRating");
                if (ratingEl) ratingEl.querySelectorAll("span").forEach(function(sp) { sp.classList.remove("active"); });
                loadFeedbackHistory();
                if (typeof showNotificationToast === "function") showNotificationToast("Feedback submitted", res.data.message || "Thank you! Your feedback has been submitted.");
                else if (typeof showAlert === "function") showAlert("Thank you! Your feedback has been submitted.", null, "success");
                return;
            }
            throw new Error(res.data && res.data.message ? res.data.message : "Failed to submit.");
        })
        .catch(function(err) {
            var list = JSON.parse(localStorage.getItem(STORAGE_FEEDBACK)) || [];
            list.push({ type: category || "General", message: message, rating: rating, date: new Date().toISOString() });
            localStorage.setItem(STORAGE_FEEDBACK, JSON.stringify(list));
            document.getElementById("feedbackForm").reset();
            var ratingEl = document.getElementById("feedbackRating");
            if (ratingEl) ratingEl.querySelectorAll("span").forEach(function(sp) { sp.classList.remove("active"); });
            loadFeedbackHistory();
            if (typeof showNotificationToast === "function") showNotificationToast("Feedback submitted", "Thank you! Your feedback has been saved.");
            else if (typeof showAlert === "function") showAlert("Thank you! Your feedback has been submitted.", null, "success");
        });
}

function submitSelfAssessment(e) {
    e.preventDefault();
    var data = {
        subject: document.getElementById("assessSubject").value,
        readiness: document.getElementById("assessReadiness").value,
        timeMgmt: document.getElementById("assessTimeMgmt").value
    };
    localStorage.setItem(STORAGE_SELF_ASSESSMENT, JSON.stringify(data));
    if (typeof showNotificationToast === "function") showNotificationToast("Saved", "Self-assessment saved. We'll use this to suggest focus areas.");
    else if (typeof showAlert === "function") showAlert("Self-assessment saved.", null, "success");
}

// ——— Assessment tabs ———
function initAssessmentTabs() {
    document.querySelectorAll(".assessment-tab").forEach(function(tab) {
        tab.addEventListener("click", function() {
            var t = this.getAttribute("data-tab");
            document.querySelectorAll(".assessment-tab").forEach(function(x) { x.classList.remove("active"); });
            document.querySelectorAll(".assessment-panel").forEach(function(p) { p.classList.remove("active"); });
            this.classList.add("active");
            var panel = document.getElementById("panel-" + t);
            if (panel) panel.classList.add("active");
            if (t === "my-performance") refreshPerformancePanel();
            if (t === "daily-challenge") renderDailyChallenge();
        });
    });
}

// ——— Quiz data (topic-wise, mini mock, daily) ———
var QUIZ_TOPICS = {
    os: [
        { q: "What is a deadlock?", opts: ["Two processes waiting for each other", "A type of CPU", "Memory leak", "Network error"], correct: 0, topic: "OS" },
        { q: "Which scheduling is non-preemptive?", opts: ["FCFS", "Round Robin", "SRTF", "Priority"], correct: 0, topic: "OS" },
        { q: "In paging, logical address is divided into?", opts: ["Page number & offset", "Segment & offset", "Frame & offset", "Block & offset"], correct: 0, topic: "OS" }
    ],
    dbms: [
        { q: "What does ACID stand for?", opts: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Insert, Delete", "Aggregate, Count, Index, Data", "None of these"], correct: 0, topic: "DBMS" },
        { q: "Third normal form removes?", opts: ["Transitive dependency", "Partial dependency", "Both", "Neither"], correct: 0, topic: "DBMS" },
        { q: "SELECT * FROM t WHERE a=1 AND b=2; is an example of?", opts: ["Selection", "Projection", "Join", "Union"], correct: 0, topic: "DBMS" }
    ],
    cn: [
        { q: "Which layer handles routing?", opts: ["Network", "Transport", "Data Link", "Physical"], correct: 0, topic: "CN" },
        { q: "TCP provides?", opts: ["Reliable, connection-oriented", "Unreliable, connectionless", "Only reliability", "Only ordering"], correct: 0, topic: "CN" },
        { q: "HTTP typically runs on port?", opts: ["80", "443", "22", "25"], correct: 0, topic: "CN" }
    ]
};
var MINI_MOCK_QUESTIONS = [
    { q: "Deadlock involves:", opts: ["Mutual exclusion", "Hold and wait", "No preemption", "All of these"], correct: 3, topic: "OS" },
    { q: "Primary key allows:", opts: ["NULL", "Duplicate", "Neither NULL nor duplicate", "Both"], correct: 2, topic: "DBMS" },
    { q: "OSI model has how many layers?", opts: ["5", "6", "7", "8"], correct: 2, topic: "CN" },
    { q: "Page fault occurs when:", opts: ["Page is in memory", "Page is not in memory", "Page is locked", "Page is dirty"], correct: 1, topic: "OS" },
    { q: "SQL JOIN that returns all rows from left table:", opts: ["INNER", "LEFT OUTER", "RIGHT OUTER", "FULL"], correct: 1, topic: "DBMS" }
];

// Gamified learning: subjects, levels, and quizzes
var GAMIFIED_CONFIG = {
    os: {
        key: "os",
        name: "Operating Systems",
        levels: [
            {
                id: 1,
                title: "Level 1 – Basics",
                topics: ["What is OS", "Process vs Program", "Types of OS"],
                quiz: [
                    { q: "An operating system is:", opts: ["Application software", "System software", "Compiler", "Assembler"], correct: 1, explanation: "OS is system software that manages hardware and resources for applications." },
                    { q: "Which of the following is NOT an OS?", opts: ["Linux", "Windows", "Oracle", "macOS"], correct: 2, explanation: "Oracle is a database; Linux, Windows and macOS are operating systems." },
                    { q: "Which is responsible for managing CPU, memory and I/O?", opts: ["Process", "Kernel", "Compiler", "Cache"], correct: 1, explanation: "The kernel is the core part of the OS that manages resources like CPU, memory and I/O." }
                ]
            },
            {
                id: 2,
                title: "Level 2 – Processes & Scheduling",
                topics: ["PCB", "Scheduling", "Context Switch"],
                quiz: [
                    { q: "PCB stands for:", opts: ["Program Control Block", "Process Control Block", "Process Communication Block", "Program Communication Block"], correct: 1, explanation: "A Process Control Block stores information about a process like state, registers and resources." },
                    { q: "Which scheduling can cause starvation?", opts: ["FCFS", "Round Robin", "Priority", "FIFO"], correct: 2, explanation: "In priority scheduling, low-priority processes may never get CPU time if higher-priority ones keep arriving." },
                    { q: "Context switch occurs when:", opts: ["CPU is idle", "Process changes state", "Memory overflows", "Disk is full"], correct: 1, explanation: "A context switch happens when the CPU switches from one process to another, saving and restoring PCB." }
                ]
            },
            {
                id: 3,
                title: "Level 3 – Memory & Deadlocks",
                topics: ["Paging", "Segmentation", "Deadlock"],
                quiz: [
                    { q: "Paging suffers from:", opts: ["Internal fragmentation", "External fragmentation", "Both", "None"], correct: 0, explanation: "Paging breaks memory into fixed-size frames, which can waste space inside a frame (internal fragmentation)." },
                    { q: "Deadlock requires which condition?", opts: ["Mutual exclusion", "Spooling", "Compilation", "Segmentation"], correct: 0, explanation: "Mutual exclusion is one of the four necessary deadlock conditions (along with hold & wait, no preemption, circular wait)." },
                    { q: "Optimal page replacement uses:", opts: ["Past references", "Future references", "Random choice", "Round Robin"], correct: 1, explanation: "The optimal algorithm replaces the page that will not be used for the longest time in the future." }
                ]
            }
        ]
    },
    dbms: {
        key: "dbms",
        name: "DBMS",
        levels: [
            {
                id: 1,
                title: "Level 1 – Basics",
                topics: ["DBMS vs File System", "Keys", "Schemas"],
                quiz: [
                    { q: "DBMS stands for:", opts: ["Database Management System", "Data Backup Main System", "Direct Basic Memory System", "None"], correct: 0, explanation: "DBMS stands for Database Management System, which manages data storage and access." },
                    { q: "Which key uniquely identifies a row?", opts: ["Foreign key", "Primary key", "Alternate key", "Composite key"], correct: 1, explanation: "A primary key uniquely identifies each row in a table." },
                    { q: "Which language is used to define schema?", opts: ["DML", "DDL", "DCL", "TCL"], correct: 1, explanation: "DDL (Data Definition Language) is used to define or alter the schema (CREATE, ALTER, DROP)." }
                ]
            },
            {
                id: 2,
                title: "Level 2 – Normalization & SQL",
                topics: ["Normal forms", "Joins", "Aggregates"],
                quiz: [
                    { q: "3NF removes:", opts: ["Partial dependency", "Transitive dependency", "Both", "None"], correct: 1, explanation: "Third normal form removes transitive dependencies to reduce redundancy." },
                    { q: "Which join returns matching rows only?", opts: ["LEFT", "RIGHT", "INNER", "FULL"], correct: 2, explanation: "INNER JOIN returns only rows that match in both tables." },
                    { q: "COUNT(*) returns:", opts: ["Only NULLs", "Only non-NULLs", "All rows", "Only distinct rows"], correct: 2, explanation: "COUNT(*) counts all rows, including those with NULL values in columns." }
                ]
            },
            {
                id: 3,
                title: "Level 3 – Transactions & Indexing",
                topics: ["ACID", "Schedules", "Indexes"],
                quiz: [
                    { q: "Durability ensures:", opts: ["Rollback", "Permanent changes", "Isolation", "Consistency"], correct: 1, explanation: "Durability means once a transaction commits, its changes survive failures." },
                    { q: "Which structure is common for indexes?", opts: ["Queue", "Stack", "B+ Tree", "Graph"], correct: 2, explanation: "B+ trees are widely used for implementing indexes in databases." },
                    { q: "Dirty read is related to:", opts: ["Locking", "Deadlock", "Incomplete transaction", "Indexing"], correct: 2, explanation: "A dirty read occurs when a transaction reads uncommitted data from another transaction." }
                ]
            }
        ]
    },
    cn: {
        key: "cn",
        name: "Computer Networks",
        levels: [
            {
                id: 1,
                title: "Level 1 – Basics & Models",
                topics: ["OSI model", "TCP/IP", "Topologies"],
                quiz: [
                    { q: "OSI model has:", opts: ["4 layers", "5 layers", "7 layers", "8 layers"], correct: 2, explanation: "The OSI reference model has 7 layers from Physical to Application." },
                    { q: "Star topology uses:", opts: ["Central hub", "Ring cable", "Bus cable", "Mesh links"], correct: 0, explanation: "In star topology, all nodes connect to a central hub or switch." },
                    { q: "IP belongs to which layer?", opts: ["Application", "Transport", "Network", "Physical"], correct: 2, explanation: "IP (Internet Protocol) works at the Network layer." }
                ]
            },
            {
                id: 2,
                title: "Level 2 – Routing & Transport",
                topics: ["Routing", "TCP/UDP", "Congestion"],
                quiz: [
                    { q: "Which is connection-oriented?", opts: ["UDP", "IP", "TCP", "ICMP"], correct: 2, explanation: "TCP is a connection-oriented, reliable transport protocol." },
                    { q: "Routing is primarily at:", opts: ["Data-link layer", "Network layer", "Transport layer", "Session layer"], correct: 1, explanation: "Routers operate at the Network layer to forward packets." },
                    { q: "Which protocol adjusts window size?", opts: ["ARP", "DNS", "TCP", "UDP"], correct: 2, explanation: "TCP uses sliding window and congestion control to adjust sending rate." }
                ]
            },
            {
                id: 3,
                title: "Level 3 – Application & Security",
                topics: ["HTTP/HTTPS", "DNS", "Security"],
                quiz: [
                    { q: "HTTPS typically uses port:", opts: ["21", "80", "110", "443"], correct: 3, explanation: "HTTPS commonly runs on TCP port 443." },
                    { q: "DNS maps:", opts: ["IP to MAC", "URL to IP", "Port to process", "None"], correct: 1, explanation: "DNS resolves human-readable names (like example.com) to IP addresses." },
                    { q: "Which is NOT a security goal?", opts: ["Confidentiality", "Integrity", "Availability", "Compilation"], correct: 3, explanation: "CIA triad is Confidentiality, Integrity, Availability; compilation is unrelated." }
                ]
            }
        ]
    }
};

function renderQuizQuestions(containerId, questions, resultId, submitBtnId, onComplete) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    questions.forEach(function(q, i) {
        var div = document.createElement("div");
        div.className = "quiz-q";
        div.innerHTML = "<span class=\"quiz-q-num\">" + (i + 1) + ".</span><p class=\"quiz-q-text\">" + escapeHtml(q.q) + "</p><div class=\"quiz-opts\">" + (q.opts || []).map(function(opt, j) {
            return "<label class=\"quiz-opt\"><input type=\"radio\" name=\"q" + i + "\" value=\"" + j + "\"><span>" + escapeHtml(opt) + "</span></label>";
        }).join("") + "</div>";
        container.appendChild(div);
    });
    var resultEl = document.getElementById(resultId);
    if (resultEl) resultEl.style.display = "none";
    var btn = document.getElementById(submitBtnId);
    if (btn) {
        btn.style.display = "inline-flex";
        btn.innerHTML = "<i class='bx bx-send'></i> Submit answers";
        btn.onclick = function() {
            var correct = 0;
            var weak = [];
            questions.forEach(function(q, i) {
                var name = "q" + i;
                var selected = container.querySelector("input[name=" + name + "]:checked");
                var val = selected ? parseInt(selected.value, 10) : -1;
                if (val === q.correct) correct++; else weak.push(q.topic || "Q" + (i + 1));
            });
            var pct = questions.length ? Math.round((correct / questions.length) * 100) : 0;
            resultEl.innerHTML = "<h4>Result</h4><p class=\"quiz-score\">Score: " + correct + "/" + questions.length + " (" + pct + "%)</p><p class=\"quiz-correct\">Correct: " + correct + " &nbsp;|&nbsp; Incorrect: " + (questions.length - correct) + "</p>" + (weak.length ? "<p class=\"quiz-weak\">Review: " + escapeHtml(weak.join(", ")) + "</p>" : "<p class=\"quiz-weak\">No weak areas in this set.</p>");
            resultEl.style.display = "block";
            if (onComplete) onComplete({ correct: correct, total: questions.length, pct: pct, weak: weak });
        };
    }
}

function initTopicQuiz() {
    var btn = document.getElementById("startTopicQuizBtn");
    var topicSelect = document.getElementById("quizTopic");
    if (!btn || !topicSelect) return;
    btn.addEventListener("click", function() {
        var topic = topicSelect.value;
        var questions = QUIZ_TOPICS[topic] || QUIZ_TOPICS.os;
        renderQuizQuestions("topicQuizContainer", questions, "topicQuizResult", "startTopicQuizBtn", function(res) {
            saveQuizResult("topic_" + topic, res);
            refreshPerformancePanel();
        });
    });
}

function initMiniMock() {
    var btn = document.getElementById("startMiniMockBtn");
    if (!btn) return;
    btn.addEventListener("click", function() {
        renderQuizQuestions("miniMockContainer", MINI_MOCK_QUESTIONS, "miniMockResult", "startMiniMockBtn", function(res) {
            saveQuizResult("mini_mock", res);
            refreshPerformancePanel();
        });
    });
}

function saveQuizResult(key, res) {
    var store = JSON.parse(localStorage.getItem(STORAGE_QUIZ_RESULTS)) || {};
    if (!store[key]) store[key] = [];
    store[key].push({ correct: res.correct, total: res.total, pct: res.pct, weak: res.weak || [], at: new Date().toISOString() });
    while (store[key].length > 20) store[key].shift();
    localStorage.setItem(STORAGE_QUIZ_RESULTS, JSON.stringify(store));
}

function getDaySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

var DAILY_QUESTIONS = [
    { q: "In OS, context switching saves the state of:", opts: ["Current process", "Next process", "Kernel only", "CPU cache"], correct: 0 },
    { q: "A primary key in DBMS:", opts: ["Can be NULL", "Must be unique", "Can repeat", "Is optional"], correct: 1 },
    { q: "IP address is used at which layer?", opts: ["Network", "Transport", "Application", "Physical"], correct: 0 }
];

function renderDailyChallenge() {
    var container = document.getElementById("dailyChallengeContainer");
    var resultEl = document.getElementById("dailyChallengeResult");
    if (!container) return;
    var seed = getDaySeed();
    var idx = seed % DAILY_QUESTIONS.length;
    var q = DAILY_QUESTIONS[idx];
    container.innerHTML = "<div class=\"quiz-q\"><span class=\"quiz-q-num\">Today's challenge</span><p class=\"quiz-q-text\">" + escapeHtml(q.q) + "</p><div class=\"quiz-opts\">" + q.opts.map(function(opt, j) {
        return "<label class=\"quiz-opt\"><input type=\"radio\" name=\"dailyQ\" value=\"" + j + "\"><span>" + escapeHtml(opt) + "</span></label>";
    }).join("") + "</div><button type=\"button\" class=\"btn-primary\" id=\"submitDailyChallenge\">Submit</button>";
    if (resultEl) resultEl.style.display = "none";
    var submitBtn = document.getElementById("submitDailyChallenge");
    if (submitBtn) {
        submitBtn.onclick = function() {
            var selected = container.querySelector("input[name=dailyQ]:checked");
            var val = selected ? parseInt(selected.value, 10) : -1;
            var correct = val === q.correct;
            if (resultEl) {
                resultEl.innerHTML = "<h4>Result</h4><p class=\"quiz-score\">" + (correct ? "Correct! Well done." : "Not quite. Correct answer: " + escapeHtml(q.opts[q.correct])) + "</p>";
                resultEl.style.display = "block";
            }
            saveQuizResult("daily", { correct: correct ? 1 : 0, total: 1, pct: correct ? 100 : 0, weak: correct ? [] : ["Daily"] });
            refreshPerformancePanel();
        };
    }
}

function initDailyChallenge() {
    renderDailyChallenge();
}

function refreshPerformancePanel() {
    var levelsEl = document.getElementById("strengthLevels");
    var tipsEl = document.getElementById("improvementTips");
    if (!levelsEl) return;
    var results = JSON.parse(localStorage.getItem(STORAGE_QUIZ_RESULTS)) || {};
    var self = JSON.parse(localStorage.getItem(STORAGE_SELF_ASSESSMENT)) || {};
    var topicScores = {};
    ["os", "dbms", "cn"].forEach(function(t) {
        var arr = results["topic_" + t];
        if (arr && arr.length) {
            var avg = arr.reduce(function(s, x) { return s + (x.pct || 0); }, 0) / arr.length;
            topicScores[t] = avg;
        }
    });
    function level(pct) {
        if (pct >= 70) return { label: "Advanced", class: "advanced" };
        if (pct >= 40) return { label: "Intermediate", class: "intermediate" };
        return { label: "Beginner", class: "beginner" };
    }
    var topicLabels = { os: "Operating Systems", dbms: "DBMS", cn: "Computer Networks" };
    levelsEl.innerHTML = (["os", "dbms", "cn"].map(function(t) {
        var pct = topicScores[t] != null ? topicScores[t] : (self.subject ? (parseInt(self.subject, 10) / 5) * 100 : null);
        var l = level(pct != null ? pct : 0);
        return "<div class=\"strength-row\"><span class=\"strength-subject\">" + (topicLabels[t] || t) + "</span><span class=\"strength-level " + l.class + "\">" + l.label + "</span>" + (pct != null ? "<span class=\"strength-pct\">" + Math.round(pct) + "%</span>" : "") + "</div>";
    })).join("");
    var tips = [];
    var avgPct = 0;
    var count = 0;
    Object.keys(topicScores).forEach(function(t) { avgPct += topicScores[t]; count++; });
    if (count) avgPct /= count;
    if (avgPct < 40) tips.push("Focus on one topic at a time. Use Study Materials and topic quiz to build basics.");
    else if (avgPct < 70) tips.push("You're making progress. Try mini mock tests and revise weak areas from quiz results.");
    else tips.push("Strong performance. Keep practicing with daily challenge and help peers in Doubts section.");
    if (self.readiness && parseInt(self.readiness, 10) <= 2) tips.push("Exam readiness is low—schedule more mock tests and revise key concepts.");
    if (self.timeMgmt && parseInt(self.timeMgmt, 10) <= 2) tips.push("Improve time management by taking timed mini mocks and setting study slots.");
    if (tipsEl) tipsEl.innerHTML = "<ul>" + tips.map(function(t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("") + "</ul>";
    if (typeof updateWeakAreas === "function") updateWeakAreas();
}

// —— Gamified Learning state helpers ——
function getGamifiedStorageKey() {
    var email = localStorage.getItem("currentUserEmail") || "";
    return STORAGE_GAMIFIED + (email ? (":" + email) : "");
}

function loadGamifiedState() {
    try {
        var raw = localStorage.getItem(getGamifiedStorageKey());
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveGamifiedState(state) {
    try {
        localStorage.setItem(getGamifiedStorageKey(), JSON.stringify(state || {}));
    } catch (_) {
        // ignore
    }
}

function getAchievementsStorageKey() {
    var email = localStorage.getItem("currentUserEmail") || "";
    return STORAGE_ACHIEVEMENTS + (email ? (":" + email) : "");
}

function loadAchievementsState() {
    try {
        var raw = localStorage.getItem(getAchievementsStorageKey());
        return raw ? JSON.parse(raw) : { items: [] };
    } catch {
        return { items: [] };
    }
}

function saveAchievementsState(state) {
    try {
        localStorage.setItem(getAchievementsStorageKey(), JSON.stringify(state || { items: [] }));
    } catch (_) {
        // ignore
    }
}

function renderProfileAchievements() {
    var wrap = document.getElementById("dashboardAchievements") || document.getElementById("profileAchievements");
    if (!wrap) return;
    var state = loadAchievementsState();
    var items = Array.isArray(state.items) ? state.items : [];
    if (!items.length) {
        wrap.innerHTML = "<span style='color: rgba(255,255,255,0.7); font-size: 13px;'>No achievements unlocked yet. Complete gamified levels to earn badges.</span>";
        return;
    }
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    var base = API_BASE || "";
    wrap.innerHTML = items
        .slice(0, 20)
        .map(function(a) {
            var label = a && a.label ? String(a.label) : "Achievement";
            var certUrl = email ? (base + "/api/certificates?email=" + encodeURIComponent(email) + "&achievement=" + encodeURIComponent(label)) : "#";
            return (
                "<div class='achievement-item'>" +
                "<span class=\"achievement-badge\"><i class='bx bx-medal'></i>" + escapeHtml(label) + "</span>" +
                (email
                    ? "<a class='achievement-cert' href='" + certUrl + "' target='_blank' rel='noopener'><i class='bx bx-download'></i> Certificate</a>"
                    : "") +
                "</div>"
            );
        })
        .join("");
}

function initGamifiedLearning() {
    var tabsWrap = document.getElementById("gamifiedSubjectTabs");
    if (!tabsWrap) return;
    // Attach subject tab listeners
    tabsWrap.querySelectorAll(".subject-pill").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var subject = this.getAttribute("data-subject");
            tabsWrap.querySelectorAll(".subject-pill").forEach(function(b) { b.classList.remove("active"); });
            this.classList.add("active");
            renderGamifiedSubject(subject);
        });
    });
    // Initial render for default subject
    renderGamifiedSubject("os");
}
function renderGamifiedSubject(subjectKey) {
    var cfg = GAMIFIED_CONFIG[subjectKey];
    if (!cfg) return;
    var state = loadGamifiedState();
    if (!state.subjects) state.subjects = {};
    if (!state.subjects[subjectKey]) {
        state.subjects[subjectKey] = {
            unlockedLevel: 1,
            completed: {},
            points: 0,
            badges: [],
            lastActivity: null,
            streakDays: 0
        };
        saveGamifiedState(state);
    }
    var sState = state.subjects[subjectKey];
    var totalLevels = cfg.levels.length;
    var levelProgressFill = document.getElementById("gamifiedLevelProgressFill");
    var levelProgressLabel = document.getElementById("gamifiedLevelProgressLabel");
    var subjectTitleEl = document.getElementById("gamifiedSubjectTitle");
    if (subjectTitleEl) subjectTitleEl.textContent = cfg.name + " – Progress";
    var completedCount = Object.keys(sState.completed || {}).length;
    var pct = Math.round((completedCount / totalLevels) * 100);
    if (levelProgressFill) levelProgressFill.style.width = pct + "%";
    if (levelProgressLabel) levelProgressLabel.textContent = "Completed " + completedCount + " of " + totalLevels + " levels";
    var pointsEl = document.getElementById("gamifiedPoints");
    var streakEl = document.getElementById("gamifiedStreak");
    if (pointsEl) pointsEl.textContent = sState.points || 0;
    if (streakEl) streakEl.textContent = (sState.streakDays || 0) + " days";
    var badgesWrap = document.getElementById("gamifiedBadges");
    if (badgesWrap) {
        var badges = sState.badges || [];
        if (!badges.length) {
            badgesWrap.innerHTML = "<span class=\"badge-pill\">Complete levels to earn badges</span>";
        } else {
            badgesWrap.innerHTML = badges.map(function(b) {
                return "<span class=\"badge-pill\">" + escapeHtml(b) + "</span>";
            }).join("");
        }
    }
    // Also update overall practice progress bar
    updatePracticeProgressFromGamified();
    var levelsContainer = document.getElementById("gamifiedLevelsContainer");
    if (!levelsContainer) return;
    levelsContainer.innerHTML = cfg.levels.map(function(level) {
        var status;
        if (sState.completed && sState.completed[level.id]) status = "completed";
        else if (sState.unlockedLevel >= level.id) status = "unlocked";
        else status = "locked";
        var statusLabel = status === "completed" ? "Completed" : status === "unlocked" ? "Unlocked" : "Locked";
        var statusClass = "gamified-level-status " + status;
        var topicsStr = (level.topics || []).map(function(t) { return "<span>• " + escapeHtml(t) + "</span>"; }).join(" ");
        var buttonHtml = "";
        if (status === "unlocked") {
            buttonHtml = "<button type=\"button\" class=\"btn-primary gamified-level-action\" data-subject=\"" + cfg.key + "\" data-level=\"" + level.id + "\"><i class='bx bx-play-circle'></i> Start Level Quiz</button>";
        } else if (status === "completed") {
            buttonHtml = "<button type=\"button\" class=\"btn-primary gamified-level-action\" data-subject=\"" + cfg.key + "\" data-level=\"" + level.id + "\"><i class='bx bx-refresh'></i> Retry Level Quiz</button>";
        } else {
            buttonHtml = "<button type=\"button\" class=\"btn-primary\" disabled><i class='bx bx-lock-alt'></i> Locked</button>";
        }
        return "<div class=\"gamified-level-card\">" +
            "<div class=\"gamified-level-header\"><span class=\"gamified-level-title\">" + escapeHtml(level.title) + "</span><span class=\"" + statusClass + "\">" + statusLabel + "</span></div>" +
            "<div class=\"gamified-level-topics\">" + topicsStr + "</div>" +
            buttonHtml +
            "</div>";
    }).join("");
    // Attach actions
    levelsContainer.querySelectorAll(".gamified-level-action").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var sub = this.getAttribute("data-subject");
            var lvl = parseInt(this.getAttribute("data-level"), 10);
            startGamifiedLevel(sub, lvl);
        });
    });
}

function startGamifiedLevel(subjectKey, levelId) {
    var cfg = GAMIFIED_CONFIG[subjectKey];
    if (!cfg) return;
    var level = (cfg.levels || []).find(function(l) { return l.id === levelId; });
    if (!level) return;
    var quizTitleEl = document.getElementById("gamifiedQuizTitle");
    if (quizTitleEl) quizTitleEl.textContent = cfg.name + " – " + level.title + " Quiz";
    var resultEl = document.getElementById("gamifiedQuizResult");
    if (resultEl) {
        resultEl.style.display = "none";
        resultEl.innerHTML = "";
    }
    renderGamifiedLevelQuiz(subjectKey, levelId, level.quiz);
}

function handleGamifiedLevelComplete(subjectKey, levelId, res) {
    var state = loadGamifiedState();
    if (!state.subjects) state.subjects = {};
    if (!state.subjects[subjectKey]) {
        state.subjects[subjectKey] = {
            unlockedLevel: 1,
            completed: {},
            points: 0,
            badges: [],
            lastActivity: null,
            streakDays: 0
        };
    }
    var sState = state.subjects[subjectKey];
    var pct = res && typeof res.pct === "number" ? res.pct : 0;
    // Update streak
    var today = new Date();
    var todayKey = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    if (!sState.lastActivity) {
        sState.streakDays = 1;
    } else {
        var last = new Date(sState.lastActivity);
        var diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) sState.streakDays = (sState.streakDays || 0) + 1;
        else if (diffDays > 1) sState.streakDays = 1;
    }
    sState.lastActivity = todayKey;
    // Points: base + performance bonus
    var basePoints = pct >= 70 ? 50 : 20;
    var bonus = Math.round(pct / 10);
    sState.points = (sState.points || 0) + basePoints + bonus;
    // Mark completion and unlock next level if passed threshold
    if (!sState.completed) sState.completed = {};
    if (!sState.completed[levelId]) sState.completed[levelId] = {};
    sState.completed[levelId].bestPct = Math.max(sState.completed[levelId].bestPct || 0, pct);
    sState.completed[levelId].lastPct = pct;
    sState.completed[levelId].attempts = (sState.completed[levelId].attempts || 0) + 1;
    if (pct >= 70 && sState.unlockedLevel < levelId + 1) {
        sState.unlockedLevel = levelId + 1;
    }
    // Badges
    sState.badges = sState.badges || [];
    var subjectName = (GAMIFIED_CONFIG[subjectKey] && GAMIFIED_CONFIG[subjectKey].name) || subjectKey.toUpperCase();
    if (pct >= 90 && sState.badges.indexOf(subjectName + " Sharpshooter") === -1) {
        sState.badges.push(subjectName + " Sharpshooter");
    }
    var totalLevels = (GAMIFIED_CONFIG[subjectKey] && GAMIFIED_CONFIG[subjectKey].levels.length) || 0;
    if (Object.keys(sState.completed).length >= totalLevels && sState.badges.indexOf(subjectName + " Master") === -1) {
        sState.badges.push(subjectName + " Master");
    }
    if (sState.streakDays >= 3 && sState.badges.indexOf("3-Day Streak") === -1) {
        sState.badges.push("3-Day Streak");
    }
    saveGamifiedState(state);
    renderGamifiedSubject(subjectKey);
    try {
        var stats = JSON.parse(localStorage.getItem("userStats") || "{}") || {};
        stats.studyHours = getStudyHoursFromGamifiedState();
        localStorage.setItem("userStats", JSON.stringify(stats));
        if (typeof updateDashboardStats === "function") updateDashboardStats(stats);
    } catch (_) {}
    if (typeof showNotificationToast === "function") {
        showNotificationToast("Level completed", "You scored " + pct + "% and earned new points in " + subjectName + ".");
    }
    // If all levels for this subject completed, award subject completion achievement
    if (totalLevels > 0 && Object.keys(sState.completed || {}).length >= totalLevels) {
        var achState = loadAchievementsState();
        achState.items = Array.isArray(achState.items) ? achState.items : [];
        var label = "Completed " + subjectName;
        if (!achState.items.some(function(a) { return a && a.label === label; })) {
            achState.items.unshift({ label: label, type: "subject_complete", subject: subjectName, at: new Date().toISOString() });
            saveAchievementsState(achState);
            renderProfileAchievements();
            if (typeof showNotificationToast === "function") {
                showNotificationToast("New badge unlocked", "Subject completed: " + subjectName);
            }
            // Auto-generate and download certificate PDF
            try {
                var email = (localStorage.getItem("currentUserEmail") || "").trim();
                if (email) {
                    var base = API_BASE || "";
                    var url = base + "/api/certificates?email=" + encodeURIComponent(email) + "&achievement=" + encodeURIComponent(label);
                    var a = document.createElement("a");
                    a.href = url;
                    a.target = "_blank";
                    a.rel = "noopener";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }
            } catch (_) {}
        }
    }
}

// Gamified quiz renderer – one question at a time with explanations
function renderGamifiedLevelQuiz(subjectKey, levelId, questions) {
    var container = document.getElementById("gamifiedQuizContainer");
    var resultEl = document.getElementById("gamifiedQuizResult");
    var submitBtn = document.getElementById("gamifiedQuizSubmitBtn");
    if (!container || !submitBtn) return;
    container.innerHTML = "";
    if (resultEl) { resultEl.style.display = "none"; resultEl.innerHTML = ""; }
    var idx = 0;
    var answers = new Array(questions.length).fill(-1);

    function renderCurrent() {
        if (!questions.length) {
            container.innerHTML = "<p style='color: rgba(255,255,255,0.8); font-size: 13px;'>No quiz questions configured for this level.</p>";
            submitBtn.style.display = "none";
            return;
        }
        var q = questions[idx];
        var paletteHtml = "<div class='gamified-quiz-palette'>" +
            "<h4>Question Palette</h4>" +
            "<div class='gamified-quiz-palette-grid'>" +
            questions.map(function(_, i) {
                var cls = "gamified-quiz-palette-btn";
                if (i === idx) cls += " current";
                else if (answers[i] !== -1) cls += " answered";
                return "<button type='button' class='" + cls + "' data-idx='" + i + "'>" + (i + 1) + "</button>";
            }).join("") +
            "</div>" +
            "<div class='palette-meta'>" +
            "Answered: " + answers.filter(function(a) { return a !== -1; }).length + " / " + questions.length +
            "</div>" +
            "</div>";
        var mainHtml = "<div class='gamified-quiz-main'><div class='quiz-q'>" +
            "<span class='quiz-q-num'>Question " + (idx + 1) + " of " + questions.length + "</span>" +
            "<p class='quiz-q-text'>" + escapeHtml(q.q) + "</p>" +
            "<div class='quiz-opts'>" +
            (q.opts || []).map(function(opt, j) {
                var checked = answers[idx] === j ? "checked" : "";
                return "<label class='quiz-opt'><input type='radio' name='gq' value='" + j + "' " + checked + "><span>" + escapeHtml(opt) + "</span></label>";
            }).join("") +
            "</div>" +
            "<div class='quiz-nav-row'>" +
            "<button type='button' class='btn-primary' id='gamifiedPrevBtn' " + (idx === 0 ? "disabled" : "") + "><i class='bx bx-left-arrow-alt'></i> Previous</button>" +
            "<button type='button' class='btn-primary' id='gamifiedNextBtn'>" + (idx === questions.length - 1 ? "Review & Submit" : "Next") + " <i class='bx bx-right-arrow-alt'></i></button>" +
            "</div>" +
            "</div></div>";
        var html = "<div class='gamified-quiz-layout'>" + paletteHtml + mainHtml + "</div>";
        container.innerHTML = html;
        submitBtn.style.display = "inline-flex";
        var prevBtn = document.getElementById("gamifiedPrevBtn");
        var nextBtn = document.getElementById("gamifiedNextBtn");
        if (prevBtn) {
            prevBtn.onclick = function() {
                saveCurrentAnswer();
                if (idx > 0) {
                    idx--;
                    renderCurrent();
                }
            };
        }
        if (nextBtn) {
            nextBtn.onclick = function() {
                saveCurrentAnswer();
                if (idx < questions.length - 1) {
                    idx++;
                    renderCurrent();
                } else {
                    // Jump to submit
                    submitBtn.click();
                }
            };
        }
        // Palette click handlers
        Array.prototype.forEach.call(container.querySelectorAll(".gamified-quiz-palette-btn"), function(btn) {
            btn.onclick = function() {
                saveCurrentAnswer();
                var target = parseInt(this.getAttribute("data-idx"), 10);
                if (!isNaN(target)) {
                    idx = target;
                    renderCurrent();
                }
            };
        });
    }

    function saveCurrentAnswer() {
        var selected = container.querySelector("input[name=gq]:checked");
        var val = selected ? parseInt(selected.value, 10) : -1;
        answers[idx] = isNaN(val) ? -1 : val;
    }

    submitBtn.onclick = function() {
        saveCurrentAnswer();
        var correct = 0;
        var wrongDetails = [];
        questions.forEach(function(q, i) {
            var val = answers[i];
            var isCorrect = val === q.correct;
            if (isCorrect) correct++;
            else {
                var yourAns = (val >= 0 && q.opts && q.opts[val]) ? q.opts[val] : "Not answered";
                var correctAns = (q.opts && q.opts[q.correct]) ? q.opts[q.correct] : "";
                wrongDetails.push({
                    q: q.q,
                    your: yourAns,
                    correct: correctAns,
                    explanation: q.explanation || ""
                });
            }
        });
        var pct = questions.length ? Math.round((correct / questions.length) * 100) : 0;
        if (resultEl) {
            var html = "<h4>Result</h4>" +
                "<p class='quiz-score'>Score: " + correct + "/" + questions.length + " (" + pct + "%)</p>" +
                "<p class='quiz-correct'>Correct: " + correct + " &nbsp;|&nbsp; Incorrect: " + (questions.length - correct) + "</p>";
            if (wrongDetails.length) {
                html += "<div class='quiz-review'><h5>Review incorrect answers</h5>" +
                    wrongDetails.map(function(w) {
                        return "<div class='quiz-review-item'>" +
                            "<p class='quiz-review-q'>" + escapeHtml(w.q) + "</p>" +
                            "<p class='quiz-review-your'>Your answer: " + escapeHtml(w.your) + "</p>" +
                            "<p class='quiz-review-correct'>Correct answer: " + escapeHtml(w.correct) + "</p>" +
                            (w.explanation ? "<p class='quiz-review-expl'>" + escapeHtml(w.explanation) + "</p>" : "") +
                            "</div>";
                    }).join("") +
                    "</div>";
            } else {
                html += "<p class='quiz-weak'>Excellent! All answers are correct.</p>";
            }
            resultEl.innerHTML = html;
            resultEl.style.display = "block";
        }
        handleGamifiedLevelComplete(subjectKey, levelId, { correct: correct, total: questions.length, pct: pct });
    };

    renderCurrent();
}

// Update main dashboard practice progress using gamified completion
function updatePracticeProgressFromGamified() {
    var bar = document.getElementById("practiceProgressBar");
    var label = document.getElementById("practiceProgressLabel");
    if (!bar || !label) return;
    var state = loadGamifiedState();
    var subjects = state && state.subjects ? state.subjects : {};
    var subjectKeys = Object.keys(subjects);
    if (!subjectKeys.length) {
        bar.style.width = "0%";
        label.textContent = "0%";
        return;
    }
    var totalPct = 0;
    var count = 0;
    subjectKeys.forEach(function(key) {
        if (!GAMIFIED_CONFIG[key]) return;
        var totalLevels = GAMIFIED_CONFIG[key].levels.length;
        if (!totalLevels) return;
        var completedCount = Object.keys(subjects[key].completed || {}).length;
        totalPct += (completedCount / totalLevels) * 100;
        count++;
    });
    var overall = count ? Math.round(totalPct / count) : 0;
    bar.style.width = overall + "%";
    label.textContent = overall + "%";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Dashboard notes preview (recent notes)
function loadDashboardNotesPreview() {
    var el = document.getElementById("dashboardNotesPreview");
    if (!el) return;
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    if (!email) {
        el.innerHTML = "<p style='color: rgba(255,255,255,0.78); font-size: 13px;'>Login to view notes.</p>";
        return;
    }
    var base = API_BASE || "";
    fetch(base + "/api/notes?email=" + encodeURIComponent(email))
        .then(function(res) { return res.ok ? res.json() : []; })
        .then(function(list) {
            var arr = Array.isArray(list) ? list : [];
            if (!arr.length) {
                el.innerHTML = "<p style='color: rgba(255,255,255,0.78); font-size: 13px;'>No notes yet. Add quick notes while studying.</p>";
                return;
            }
            var top = arr.slice(0, 3);
            el.innerHTML = top.map(function(n) {
                var title = n.title || (n.subject_name ? (n.subject_name + (n.topic_name ? " • " + n.topic_name : "")) : "Note");
                var snippet = (n.content || "").slice(0, 120) + ((n.content || "").length > 120 ? "…" : "");
                var meta = (n.subject_name || "General") + (n.topic_name ? (" · " + n.topic_name) : "");
                return "<div class='note-item' style='cursor: default;'>" +
                    "<div class='note-item-title'>" + escapeHtml(title) + "</div>" +
                    "<div class='note-item-meta'>" + escapeHtml(meta) + "</div>" +
                    "<div style='color: rgba(255,255,255,0.82); font-size: 12px; margin-top: 4px;'>" + escapeHtml(snippet) + "</div>" +
                    "</div>";
            }).join("");
        })
        .catch(function() {
            el.innerHTML = "<p style='color: rgba(255,255,255,0.78); font-size: 13px;'>Unable to load notes preview.</p>";
        });
}

// ===========================
// Notes (DB-backed + fallback)
// ===========================
var notesCache = [];
var notesActiveId = "";

function getNotesLocalKey() {
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    return "examease_notes:" + (email || "guest");
}

function loadNotesFromLocal() {
    try {
        var raw = localStorage.getItem(getNotesLocalKey());
        return raw ? JSON.parse(raw) : [];
    } catch (_) {
        return [];
    }
}

function saveNotesToLocal(list) {
    try {
        localStorage.setItem(getNotesLocalKey(), JSON.stringify(Array.isArray(list) ? list : []));
    } catch (_) {}
}

/** Same pattern as certificates: /api/notes/download?email=&id= (always includes /api/notes/). */
function getNotePdfDownloadUrl(noteId) {
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    var base = String(API_BASE || "").replace(/\/+$/, "");
    var path =
        "/api/notes/download?email=" +
        encodeURIComponent(email) +
        "&id=" +
        encodeURIComponent(noteId);
    return base ? base + path : path;
}

function renderNotesList(list) {
    var el = document.getElementById("notesList");
    if (!el) return;
    var arr = Array.isArray(list) ? list : [];
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    if (!arr.length) {
        el.innerHTML = "<div style='color: rgba(255,255,255,0.78); font-size: 13px;'>No notes found. Create your first note above.</div>";
        return;
    }
    el.innerHTML = arr.map(function (n) {
        var id = String(n.id != null ? n.id : n._localId || "");
        var title = n.title || "(Untitled)";
        var meta = (n.subject_name || "General") + (n.topic_name ? (" · " + n.topic_name) : "");
        var dt = n.updated_at || n.created_at || n.time;
        var time = dt ? new Date(dt).toLocaleString() : "";
        var active = notesActiveId && id === String(notesActiveId) ? " active" : "";
        var isLocal = id.indexOf("local_") === 0;
        var downloadEl;
        if (isLocal) {
            downloadEl =
                "<button type='button' class='secondary-btn note-item-pdf-btn' data-note-id='" +
                escapeHtml(id) +
                "' title='Download this note as PDF'><i class='bx bx-download'></i> Download PDF</button>";
        } else if (email) {
            var pdfUrl = getNotePdfDownloadUrl(id);
            downloadEl =
                "<a class='secondary-btn note-item-pdf-btn' href='" +
                pdfUrl +
                "' target='_blank' rel='noopener' title='Download this note as PDF'><i class='bx bx-download'></i> Download PDF</a>";
        } else {
            downloadEl =
                "<button type='button' class='secondary-btn note-item-pdf-btn' disabled title='Sign in to download'><i class='bx bx-download'></i> Download PDF</button>";
        }
        return (
            "<div class='note-item" + active + "' data-id='" + escapeHtml(id) + "'>" +
            "<div class='note-item-row'>" +
            "<div class='note-item-main'>" +
            "<div class='note-item-title'>" + escapeHtml(title) + (n.is_bookmarked ? " ★" : "") + "</div>" +
            "<div class='note-item-meta'>" + escapeHtml(meta + (time ? (" · " + time) : "")) + "</div>" +
            "</div>" +
            downloadEl +
            "</div>" +
            "</div>"
        );
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".note-item"), function (item) {
        item.onclick = function (e) {
            if (e.target.closest(".note-item-pdf-btn")) return;
            var id = this.getAttribute("data-id");
            selectNoteById(id);
        };
    });
    Array.prototype.forEach.call(el.querySelectorAll("button.note-item-pdf-btn:not([disabled])"), function (btn) {
        btn.onclick = function (e) {
            e.stopPropagation();
            if (typeof showNotificationToast === "function") {
                showNotificationToast("PDF", "This note is saved offline. Start the server and save again to download as PDF.");
            }
        };
    });
}

function fillNoteEditor(note) {
    document.getElementById("noteId").value = note && note.id != null ? String(note.id) : (note && note._localId ? String(note._localId) : "");
    document.getElementById("noteSubject").value = note && note.subject_name ? note.subject_name : "";
    document.getElementById("noteTopic").value = note && note.topic_name ? note.topic_name : "";
    document.getElementById("noteTitle").value = note && note.title ? note.title : "";
    document.getElementById("noteContent").value = note && note.content ? note.content : "";
    document.getElementById("noteBookmarked").checked = !!(note && note.is_bookmarked);
}

function clearNoteEditor() {
    notesActiveId = "";
    fillNoteEditor({ id: "", subject_name: "", topic_name: "", title: "", content: "", is_bookmarked: false });
    renderNotesList(notesCache);
}

function selectNoteById(id) {
    notesActiveId = String(id || "");
    var n = (notesCache || []).find(function (x) {
        return String(x.id != null ? x.id : x._localId || "") === String(notesActiveId);
    });
    if (n) fillNoteEditor(n);
    renderNotesList(notesCache);
}

function loadNotesList() {
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    if (!email) return;
    var base = API_BASE || "";
    var url = base + "/api/notes?email=" + encodeURIComponent(email);

    fetch(url)
        .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText)); })
        .then(function (list) {
            notesCache = Array.isArray(list) ? list : [];
            saveNotesToLocal(notesCache);
            renderNotesList(notesCache);
        })
        .catch(function () {
            // fallback local
            notesCache = loadNotesFromLocal();
            renderNotesList(notesCache);
        });
}

function saveNote() {
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    if (!email) return;
    var base = API_BASE || "";

    var id = (document.getElementById("noteId").value || "").trim();
    var subject = (document.getElementById("noteSubject").value || "").trim();
    var topic = (document.getElementById("noteTopic").value || "").trim();
    var title = (document.getElementById("noteTitle").value || "").trim();
    var content = (document.getElementById("noteContent").value || "").trim();
    var bookmarked = !!document.getElementById("noteBookmarked").checked;
    if (!content) {
        if (typeof showNotificationToast === "function") showNotificationToast("Note not saved", "Content is required.");
        return;
    }

    var payload = {
        email: email,
        subject_name: subject || null,
        topic_name: topic || null,
        title: title || null,
        content: content,
        is_bookmarked: bookmarked,
        context_type: "general",
        context_ref: null
    };

    var isLocal = id && String(id).indexOf("local_") === 0;
    var method = id && !isLocal ? "PUT" : "POST";
    var url = base + "/api/notes" + (method === "PUT" ? ("/" + encodeURIComponent(id)) : "");
    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (r) {
            if (!r.ok) throw new Error((r.data && r.data.message) || "Failed to save note.");
            if (typeof showNotificationToast === "function") {
                showNotificationToast("Saved", "Your note has been saved.", 2500, function () { scheduleReloadAfterNoteSave(); });
            } else {
                scheduleReloadAfterNoteSave();
            }
        })
        .catch(function () {
            // fallback local save
            var local = loadNotesFromLocal();
            var now = new Date().toISOString();
            if (method === "PUT") {
                local = local.map(function (n) {
                    if (String(n.id) === String(id) || String(n._localId || "") === String(id)) {
                        return Object.assign({}, n, payload, { updated_at: now, is_bookmarked: bookmarked ? 1 : 0 });
                    }
                    return n;
                });
            } else {
                var localId = "local_" + Date.now();
                local.unshift(Object.assign({}, payload, { _localId: localId, id: localId, created_at: now, updated_at: now, is_bookmarked: bookmarked ? 1 : 0 }));
                notesActiveId = localId;
                document.getElementById("noteId").value = localId;
            }
            saveNotesToLocal(local);
            notesCache = local;
            renderNotesList(notesCache);
            if (typeof showNotificationToast === "function") {
                showNotificationToast("Saved (offline)", "Saved locally. Start backend to sync.", 2500, function () { scheduleReloadAfterNoteSave(); });
            } else {
                scheduleReloadAfterNoteSave();
            }
        });
}

function deleteNote() {
    var email = (localStorage.getItem("currentUserEmail") || "").trim();
    if (!email) return;
    var base = API_BASE || "";
    var id = (document.getElementById("noteId").value || "").trim();
    if (!id) return;
    var isLocal = id && String(id).indexOf("local_") === 0;
    if (isLocal) {
        var local = loadNotesFromLocal().filter(function (n) { return String(n.id) !== String(id); });
        saveNotesToLocal(local);
        notesCache = local;
        clearNoteEditor();
        loadDashboardNotesPreview();
        return;
    }
    fetch(base + "/api/notes/" + encodeURIComponent(id) + "?email=" + encodeURIComponent(email), {
        method: "DELETE"
    })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.statusText)); })
        .then(function () {
            if (typeof showNotificationToast === "function") showNotificationToast("Deleted", "Note removed.");
            clearNoteEditor();
            loadNotesList();
            loadDashboardNotesPreview();
        })
        .catch(function () {
            // fallback local delete
            var local = loadNotesFromLocal().filter(function (n) { return String(n.id) !== String(id); });
            saveNotesToLocal(local);
            notesCache = local;
            clearNoteEditor();
            loadDashboardNotesPreview();
        });
}

function initNotesUI() {
    var saveBtn = document.getElementById("noteSaveBtn");
    var delBtn = document.getElementById("noteDeleteBtn");
    var newBtn = document.getElementById("noteNewBtn");

    if (saveBtn) saveBtn.onclick = saveNote;
    if (delBtn) delBtn.onclick = deleteNote;
    if (newBtn) newBtn.onclick = clearNoteEditor;

    // Load initial list if section exists
    if (document.getElementById("notesList")) {
        loadNotesList();
    }
}

// ============================================
// Practice & Exams: attempt player (MCQ/MSQ)
// ============================================
var currentAttempt = null;
var examTimerInterval = null;
var examMediaStream = null;
var examViolationCount = 0;
var EXAM_MAX_VIOLATIONS = 3;
var currentQuestionIndex = 0;
var questionStatuses = {}; // { questionId: { answered: bool, marked: bool, visited: bool } }
var selectedAnswers = {}; // { questionId: [optionId1, ...] } – persists selection until student changes it
var examCameraMonitorInterval = null;
var examCameraBadTicks = 0;
var examCameraLastIssue = "";

function isMockExamById(examId) {
    var idStr = String(examId);
    var exam = (practiceExamsFullList || []).find(function (e) { return String(e.id) === idStr; });
    return !!(exam && exam.exam_type === "mock");
}

function hasActiveVideoTrack(stream) {
    if (!stream || typeof stream.getVideoTracks !== "function") return false;
    var tracks = stream.getVideoTracks();
    if (!tracks || !tracks.length) return false;
    return tracks.some(function (t) {
        return t && t.readyState === "live" && t.enabled !== false;
    });
}

function analyzeFrameQuality(ctx, w, h) {
    var img = ctx.getImageData(0, 0, w, h).data;
    var pixelCount = Math.max(1, w * h);
    var gray = new Float32Array(pixelCount);
    var sum = 0;
    var sumSq = 0;
    var darkCount = 0;
    var brightCount = 0;
    for (var i = 0, p = 0; i < img.length; i += 4, p++) {
        var g = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
        gray[p] = g;
        sum += g;
        sumSq += g * g;
        if (g < 22) darkCount++;
        if (g > 240) brightCount++;
    }
    var mean = sum / pixelCount;
    var variance = Math.max(0, sumSq / pixelCount - mean * mean);
    var stdDev = Math.sqrt(variance);
    var darkRatio = darkCount / pixelCount;
    var brightRatio = brightCount / pixelCount;

    // Blur estimation via average absolute gradient.
    var gradSum = 0;
    var gradN = 0;
    for (var y = 0; y < h - 1; y++) {
        for (var x = 0; x < w - 1; x++) {
            var idx = y * w + x;
            var gx = Math.abs(gray[idx] - gray[idx + 1]);
            var gy = Math.abs(gray[idx] - gray[idx + w]);
            gradSum += (gx + gy);
            gradN += 2;
        }
    }
    var sharpness = gradN ? gradSum / gradN : 0;
    return { mean: mean, stdDev: stdDev, darkRatio: darkRatio, brightRatio: brightRatio, sharpness: sharpness };
}

function validateCameraFeedQuality(stream) {
    return new Promise(function (resolve, reject) {
        try {
            var video = document.createElement("video");
            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;
            video.srcObject = stream;

            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return reject(new Error("Unable to analyze camera feed."));

            var done = false;
            var timeout = setTimeout(function () {
                if (done) return;
                done = true;
                reject(new Error("Camera feed could not be verified. Open webcam and try again."));
            }, 5000);

            video.onloadedmetadata = function () {
                video.play().then(function () {
                    setTimeout(function () {
                        if (done) return;
                        var w = Math.max(64, Math.min(320, video.videoWidth || 320));
                        var h = Math.max(48, Math.min(240, video.videoHeight || 240));
                        canvas.width = w;
                        canvas.height = h;

                        var frames = [];
                        var sampleCount = 3;
                        var i = 0;
                        function sampleNext() {
                            if (done) return;
                            try {
                                ctx.drawImage(video, 0, 0, w, h);
                                frames.push(analyzeFrameQuality(ctx, w, h));
                            } catch (_) {}
                            i++;
                            if (i < sampleCount) {
                                setTimeout(sampleNext, 120);
                                return;
                            }
                            var avg = frames.reduce(function (acc, f) {
                                acc.mean += f.mean;
                                acc.stdDev += f.stdDev;
                                acc.darkRatio += f.darkRatio;
                                acc.brightRatio += f.brightRatio;
                                acc.sharpness += f.sharpness;
                                return acc;
                            }, { mean: 0, stdDev: 0, darkRatio: 0, brightRatio: 0, sharpness: 0 });
                            var n = Math.max(1, frames.length);
                            avg.mean /= n;
                            avg.stdDev /= n;
                            avg.darkRatio /= n;
                            avg.brightRatio /= n;
                            avg.sharpness /= n;

                            clearTimeout(timeout);
                            done = true;

                            var mostlyBlack = avg.darkRatio > 0.92 || avg.mean < 20;
                            var almostNoDetail = avg.stdDev < 14 || avg.sharpness < 2.2;
                            var heavilyBlurred = avg.sharpness < 1.6;

                            if (mostlyBlack) {
                                return reject(new Error("Camera view looks black/covered (shutter may be closed). Open webcam to start mock test."));
                            }
                            if (heavilyBlurred || (almostNoDetail && avg.brightRatio < 0.9)) {
                                return reject(new Error("Camera feed is too blurry/unclear. Clean lens or open shutter; exam will start only with clear webcam."));
                            }
                            resolve(true);
                        }
                        sampleNext();
                    }, 200);
                }).catch(function () {
                    clearTimeout(timeout);
                    if (!done) {
                        done = true;
                        reject(new Error("Camera could not start. Allow webcam permission and try again."));
                    }
                });
            };
        } catch (_) {
            reject(new Error("Unable to verify webcam feed."));
        }
    });
}

function captureCurrentCameraMetrics(videoEl) {
    try {
        if (!videoEl || videoEl.videoWidth < 2 || videoEl.videoHeight < 2) return null;
        var canvas = document.createElement("canvas");
        var w = Math.max(64, Math.min(200, videoEl.videoWidth || 160));
        var h = Math.max(48, Math.min(150, videoEl.videoHeight || 120));
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(videoEl, 0, 0, w, h);
        return analyzeFrameQuality(ctx, w, h);
    } catch (_) {
        return null;
    }
}

function stopExamCameraMonitor() {
    if (examCameraMonitorInterval) {
        clearInterval(examCameraMonitorInterval);
        examCameraMonitorInterval = null;
    }
    examCameraBadTicks = 0;
    examCameraLastIssue = "";
}

function checkExamCameraHealth() {
    if (!currentAttempt || !currentAttempt.exam || currentAttempt.exam.exam_type !== "mock") return;
    var video = document.getElementById("examCameraPreview");
    var status = document.getElementById("examCameraStatus");
    var badReason = "";
    var hasTrack = hasActiveVideoTrack(examMediaStream);
    if (!hasTrack) {
        badReason = "Camera stream stopped or disabled";
    } else {
        var track = (examMediaStream.getVideoTracks && examMediaStream.getVideoTracks()[0]) || null;
        if (track && (track.muted || track.readyState !== "live" || track.enabled === false)) {
            badReason = "Camera turned OFF or blocked";
        } else if (!video || video.readyState < 2) {
            badReason = "Camera preview unavailable";
        } else {
            var metrics = captureCurrentCameraMetrics(video);
            if (metrics) {
                var blackedOut = metrics.darkRatio > 0.94 || metrics.mean < 18;
                var heavilyBlurred = metrics.stdDev < 10 && metrics.sharpness < 1.3;
                if (blackedOut) badReason = "Camera blackout detected (shutter/cover?)";
                else if (heavilyBlurred) badReason = "Camera feed too blurry";
            }
        }
    }

    if (badReason) {
        examCameraBadTicks += 1;
        if (status) status.textContent = "Camera issue: " + badReason;
        setExamWarning("Warning: Camera issue detected. Keep webcam ON and clear, or exam may be terminated.");
        // Debounce: only raise violations after repeated bad checks.
        if (examCameraBadTicks >= 2 && examCameraLastIssue !== badReason) {
            examCameraLastIssue = badReason;
            logExamViolation("camera_off_mid_exam", badReason);
        } else if (examCameraBadTicks >= 4 && examCameraBadTicks % 2 === 0) {
            // Continued violation while issue persists.
            logExamViolation("camera_off_mid_exam", badReason + " (persistent)");
        }
        return;
    }

    examCameraBadTicks = 0;
    examCameraLastIssue = "";
    if (status) status.textContent = "Camera is ON.";
}

function startExamCameraMonitor() {
    stopExamCameraMonitor();
    if (!currentAttempt || !currentAttempt.exam || currentAttempt.exam.exam_type !== "mock") return;
    examCameraMonitorInterval = setInterval(checkExamCameraHealth, 3000);
}

function ensureMockCameraReady() {
    return new Promise(function (resolve, reject) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return reject(new Error("Webcam is unavailable in this browser. Turn on camera access and try again."));
        }
        // Reuse an already live stream if present, but still validate feed quality.
        if (hasActiveVideoTrack(examMediaStream)) {
            return validateCameraFeedQuality(examMediaStream).then(function () {
                resolve(true);
            }).catch(reject);
        }
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(function (stream) {
                if (!hasActiveVideoTrack(stream)) {
                    try {
                        stream.getTracks().forEach(function (t) { t.stop(); });
                    } catch (_) {}
                    return reject(new Error("Webcam appears blocked or inactive. Open the camera shutter/permissions and try again."));
                }
                // Keep this stream and reuse when exam security starts.
                examMediaStream = stream;
                validateCameraFeedQuality(stream).then(function () {
                    resolve(true);
                }).catch(function (err) {
                    try {
                        stream.getTracks().forEach(function (t) { t.stop(); });
                    } catch (_) {}
                    examMediaStream = null;
                    reject(err);
                });
            })
            .catch(function () {
                reject(new Error("Camera is OFF or blocked. Turn ON your webcam to start the mock test."));
            });
    });
}

function openExamModal() {
    var m = document.getElementById("examModal");
    if (m) m.style.display = "flex";
}

function closeExamModal() {
    cleanupExamSecurity();
    var m = document.getElementById("examModal");
    if (m) m.style.display = "none";
    var display = document.getElementById("questionDisplay");
    if (display) display.innerHTML = "";
    var palette = document.getElementById("questionPalette");
    if (palette) palette.innerHTML = "";
    var warn = document.getElementById("examWarning");
    if (warn) { warn.style.display = "none"; warn.textContent = ""; }
    var camRow = document.getElementById("examCameraRow");
    if (camRow) camRow.style.display = "none";
    var timer = document.getElementById("examTimer");
    if (timer) {
        timer.textContent = "00:00";
        timer.className = "exam-timer";
    }
    // Reset state
    currentAttempt = null;
    currentQuestionIndex = 0;
    questionStatuses = {};
    selectedAnswers = {};
    // Re-enable all inputs
    var allInputs = document.querySelectorAll("#examModal input, #examModal button");
    allInputs.forEach(function(el) { el.disabled = false; });
    // Restore footer
    var footer = document.querySelector(".exam-modal-footer");
    if (footer) {
        footer.innerHTML = `
            <button class="btn-danger" type="button" onclick="cancelExam()">
                <i class='bx bx-x-circle'></i> Cancel Exam
            </button>
            <button class="btn-primary" type="button" onclick="confirmSubmitExam()">
                <i class='bx bx-check'></i> Submit Exam
            </button>
        `;
    }
    // Restore navigation and mark review
    var nav = document.querySelector(".question-navigation");
    var markReview = document.querySelector(".mark-review-section");
    if (nav) nav.style.display = "flex";
    if (markReview) markReview.style.display = "block";
    if (palette) palette.style.display = "grid";
}

window.closeExamModal = closeExamModal;

function showExamConfirm(message, isCancel, title) {
    return new Promise(function(resolve) {
        var overlay = document.getElementById("examConfirmOverlay");
        var card = overlay ? overlay.querySelector(".exam-confirm-card") : null;
        var msgEl = document.getElementById("examConfirmMessage");
        var titleEl = document.getElementById("examConfirmTitle");
        var iconEl = document.getElementById("examConfirmIcon");
        var yesBtn = document.getElementById("examConfirmYes");
        var noBtn = document.getElementById("examConfirmNo");
        if (!overlay || !msgEl) return resolve(false);
        if (titleEl) titleEl.textContent = title || "Confirm";
        msgEl.textContent = message || "";
        if (card) {
            if (isCancel) card.classList.add("is-cancel"); else card.classList.remove("is-cancel");
        }
        if (iconEl) iconEl.innerHTML = isCancel ? "<i class='bx bx-error-circle'></i>" : "<i class='bx bx-info-circle'></i>";
        if (yesBtn) yesBtn.innerHTML = isCancel ? "<i class='bx bx-x'></i> Yes, cancel exam" : "<i class='bx bx-check'></i> Yes, submit";
        overlay.style.display = "flex";
        function onOverlayClick(e) {
            if (e.target === overlay) onNo();
        }
        function done(value) {
            overlay.style.display = "none";
            overlay.removeEventListener("click", onOverlayClick);
            if (yesBtn) yesBtn.removeEventListener("click", onYes);
            if (noBtn) noBtn.removeEventListener("click", onNo);
            resolve(value);
        }
        function onYes() { done(true); }
        function onNo() { done(false); }
        if (yesBtn) yesBtn.addEventListener("click", onYes);
        if (noBtn) noBtn.addEventListener("click", onNo);
        overlay.addEventListener("click", onOverlayClick);
    });
}

function confirmSubmitExam() {
    if (!currentAttempt) return;
    showExamConfirm(
        "Are you sure you want to submit the exam? You will not be able to change your answers after submission.",
        false,
        "Submit Exam"
    ).then(function(confirmed) {
        if (confirmed) submitCurrentAttempt(null);
    });
}

function cancelExam() {
    if (!currentAttempt) return;
    showExamConfirm(
        "Are you sure you want to cancel the exam? This will submit your exam with ZERO marks and you will not be able to retake it.",
        true,
        "Cancel Exam"
    ).then(function(confirmed) {
        if (confirmed) {
            var qs = currentAttempt.questions || [];
            qs.forEach(function(q) {
                var name = "q_" + q.id;
                var inputs = document.querySelectorAll("input[name=\"" + name + "\"]");
                inputs.forEach(function(inp) { inp.checked = false; });
            });
            submitCurrentAttempt("Cancelled by student (zero marks)");
        }
    });
}

window.cancelExam = cancelExam;
window.confirmSubmitExam = confirmSubmitExam;

window.startExamPaper = function(examId) {
    var email = localStorage.getItem("currentUserEmail") || getStoredEmail() || "";
    var name = localStorage.getItem("username") || "Student";
    var base = API_BASE || "";
    var precheck = isMockExamById(examId)
        ? ensureMockCameraReady()
        : Promise.resolve(true);
    precheck
        .then(function () {
            return fetch(base + "/api/attempts/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ examId: examId, email: email, name: name })
            });
        })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
            if (!res.ok) {
                var msg = (res.data && res.data.message) || "Failed to start exam.";
                if (res.data && res.data.code === "EXAM_LOCKED") msg = res.data.message;
                throw new Error(msg);
            }
            
            // Check if this attempt was already submitted
            if (res.data.attemptId && localStorage.getItem("exam_submitted_" + res.data.attemptId) === "true") {
                throw new Error("This exam attempt has already been submitted and cannot be accessed again.");
            }
            
            // Check if attempt status is already submitted/completed
            if (res.data.status && (res.data.status === "submitted" || res.data.status === "completed")) {
                localStorage.setItem("exam_submitted_" + res.data.attemptId, "true");
                throw new Error("This exam attempt has already been completed and cannot be accessed again.");
            }
            
            currentAttempt = res.data;
            // Hard guard: mock exam cannot proceed without active webcam.
            if (currentAttempt.exam && currentAttempt.exam.exam_type === "mock" && !hasActiveVideoTrack(examMediaStream)) {
                throw new Error("Turn ON your webcam. Mock exam will not start until camera is active.");
            }
            examViolationCount = 0;
            renderExamAttemptUI();
            openExamModal();
            startExamTimer();
            if (currentAttempt.exam && currentAttempt.exam.exam_type === "mock") {
                enableExamSecurity();
            } else {
                cleanupExamSecurity();
            }
        })
        .catch(function (err) {
            console.error("Start exam error:", err);
            setExamWarning("Camera check required: Turn ON your webcam. The mock exam will not start until camera is active.");
            if (typeof showNotificationToast === "function") showNotificationToast("Exam", err.message || "Failed to start exam.");
        });
};

function renderExamAttemptUI() {
    if (!currentAttempt) return;
    var titleEl = document.getElementById("examModalTitle");
    var subEl = document.getElementById("examModalSubtitle");
    if (titleEl) titleEl.textContent = currentAttempt.exam ? (currentAttempt.exam.title || "Exam") : "Exam";
    if (subEl) subEl.textContent = currentAttempt.exam && currentAttempt.exam.exam_type === "mock" ? "Mock Test (secure)" : "Practice Test";

    var camRow = document.getElementById("examCameraRow");
    if (camRow) camRow.style.display = (currentAttempt.exam && currentAttempt.exam.exam_type === "mock") ? "block" : "none";

    // Initialize question statuses and selected answers store
    var qs = currentAttempt.questions || [];
    questionStatuses = {};
    selectedAnswers = {};
    qs.forEach(function(q) {
        questionStatuses[q.id] = { answered: false, marked: false, visited: false };
        selectedAnswers[q.id] = [];
    });

    // Set first question as visited
    if (qs.length > 0) {
        questionStatuses[qs[0].id].visited = true;
    }

    currentQuestionIndex = 0;
    renderQuestionPalette();
    renderCurrentQuestion();
    updateQuestionCounter();
    updatePaletteStats();
}

function renderQuestionPalette() {
    var palette = document.getElementById("questionPalette");
    if (!palette || !currentAttempt) return;
    var qs = currentAttempt.questions || [];
    palette.innerHTML = qs.map(function(q, idx) {
        var status = questionStatuses[q.id] || { answered: false, marked: false, visited: false };
        var classes = ["palette-item"];
        if (idx === currentQuestionIndex) classes.push("current");
        if (status.answered) classes.push("answered");
        if (status.marked) classes.push("marked");
        return "<div class=\"" + classes.join(" ") + "\" onclick=\"jumpToQuestion(" + idx + ")\">" + (idx + 1) + "</div>";
    }).join("");
}

function renderCurrentQuestion() {
    var display = document.getElementById("questionDisplay");
    if (!display || !currentAttempt) return;
    var qs = currentAttempt.questions || [];
    if (currentQuestionIndex < 0 || currentQuestionIndex >= qs.length) return;
    
    var q = qs[currentQuestionIndex];
    var status = questionStatuses[q.id] || { answered: false, marked: false, visited: false };
    status.visited = true;

    var inputType = q.type === "MSQ" ? "checkbox" : "radio";
    var name = "q_" + q.id;
    
    // Use persisted selection (stays until student clicks another option)
    var selectedIds = selectedAnswers[q.id] || [];

    var opts = (q.options || []).map(function (o) {
        var checked = selectedIds.indexOf(o.id) >= 0 ? " checked" : "";
        return "<label class=\"exam-opt\"><input type=\"" + inputType + "\" name=\"" + name + "\" value=\"" + o.id + "\" onchange=\"updateQuestionStatus(" + q.id + ")\"" + checked + "><span>" + escapeHtml((o.key ? (o.key + ". ") : "") + (o.text || "")) + "</span></label>";
    }).join("");

    display.innerHTML = "<div class=\"exam-q\" data-qid=\"" + q.id + "\"><h4>Q" + (currentQuestionIndex + 1) + ". " + escapeHtml(q.text || "") + " <span style=\"color: rgba(255,255,255,0.88); font-weight: 500;\">(" + (q.marks || 1) + " marks, " + escapeHtml(q.type || "MCQ") + ")</span></h4>" + opts + "</div>";

    // Update mark for review checkbox
    var markCheckbox = document.getElementById("markForReview");
    if (markCheckbox) {
        markCheckbox.checked = status.marked || false;
    }

    // Update navigation buttons
    var prevBtn = document.getElementById("prevQuestionBtn");
    var nextBtn = document.getElementById("nextQuestionBtn");
    if (prevBtn) prevBtn.disabled = currentQuestionIndex === 0;
    if (nextBtn) nextBtn.disabled = currentQuestionIndex >= qs.length - 1;

    updateQuestionStatus(q.id);
    renderQuestionPalette();
}

function updateQuestionStatus(questionId) {
    if (!questionStatuses[questionId]) return;
    var name = "q_" + questionId;
    var checked = document.querySelectorAll("input[name=\"" + name + "\"]:checked");
    var selected = Array.from(checked).map(function(inp) { return parseInt(inp.value, 10); }).filter(function(n) { return Number.isFinite(n); });
    selectedAnswers[questionId] = selected;
    questionStatuses[questionId].answered = selected.length > 0;
    updatePaletteStats();
    renderQuestionPalette();
}

function toggleMarkForReview() {
    if (!currentAttempt) return;
    var qs = currentAttempt.questions || [];
    if (currentQuestionIndex < 0 || currentQuestionIndex >= qs.length) return;
    var q = qs[currentQuestionIndex];
    var status = questionStatuses[q.id] || { answered: false, marked: false, visited: true };
    var checkbox = document.getElementById("markForReview");
    status.marked = checkbox ? checkbox.checked : false;
    updatePaletteStats();
    renderQuestionPalette();
}

function navigateQuestion(direction) {
    if (!currentAttempt) return;
    var qs = currentAttempt.questions || [];
    var newIndex = currentQuestionIndex + direction;
    if (newIndex < 0 || newIndex >= qs.length) return;
    currentQuestionIndex = newIndex;
    renderCurrentQuestion();
    updateQuestionCounter();
}

function jumpToQuestion(index) {
    if (!currentAttempt) return;
    var qs = currentAttempt.questions || [];
    if (index < 0 || index >= qs.length) return;
    currentQuestionIndex = index;
    renderCurrentQuestion();
    updateQuestionCounter();
}

function updateQuestionCounter() {
    if (!currentAttempt) return;
    var qs = currentAttempt.questions || [];
    var currentEl = document.getElementById("currentQuestionNum");
    var totalEl = document.getElementById("totalQuestions");
    if (currentEl) currentEl.textContent = currentQuestionIndex + 1;
    if (totalEl) totalEl.textContent = qs.length;
}

function updatePaletteStats() {
    if (!currentAttempt) return;
    var qs = currentAttempt.questions || [];
    var answered = 0, notVisited = 0, marked = 0;
    qs.forEach(function(q) {
        var status = questionStatuses[q.id] || { answered: false, marked: false, visited: false };
        if (status.answered) answered++;
        if (!status.visited) notVisited++;
        if (status.marked) marked++;
    });
    var answeredEl = document.getElementById("paletteAnswered");
    var notVisitedEl = document.getElementById("paletteNotVisited");
    var markedEl = document.getElementById("paletteMarked");
    if (answeredEl) answeredEl.textContent = answered;
    if (notVisitedEl) notVisitedEl.textContent = notVisited;
    if (markedEl) markedEl.textContent = marked;
}

window.navigateQuestion = navigateQuestion;
window.jumpToQuestion = jumpToQuestion;
window.toggleMarkForReview = toggleMarkForReview;
window.updateQuestionStatus = updateQuestionStatus;

function startExamTimer() {
    if (!currentAttempt || !currentAttempt.exam) return;
    if (examTimerInterval) clearInterval(examTimerInterval);
    var durationMin = parseInt(currentAttempt.exam.duration_minutes, 10) || 1;
    var endAt = Date.now() + durationMin * 60 * 1000;
    examTimerInterval = setInterval(function () {
        var remain = Math.max(0, endAt - Date.now());
        var mm = Math.floor(remain / 60000);
        var ss = Math.floor((remain % 60000) / 1000);
        var timer = document.getElementById("examTimer");
        if (timer) {
            timer.textContent = String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
            // Add warning/danger classes based on remaining time
            timer.className = "exam-timer";
            var totalSeconds = mm * 60 + ss;
            if (totalSeconds <= 300) { // 5 minutes or less
                timer.classList.add("danger");
            } else if (totalSeconds <= 600) { // 10 minutes or less
                timer.classList.add("warning");
            }
        }
        if (remain <= 0) {
            clearInterval(examTimerInterval);
            examTimerInterval = null;
            submitCurrentAttempt("Time ended (auto-submit)");
        }
    }, 250);
}

function collectAttemptAnswers() {
    var answers = [];
    if (!currentAttempt || !currentAttempt.questions) return answers;
    currentAttempt.questions.forEach(function (q) {
        var selected = selectedAnswers[q.id] || [];
        answers.push({ question_id: q.id, selected_option_ids: selected });
    });
    return answers;
}

function submitCurrentAttempt(terminatedReason) {
    if (!currentAttempt || !currentAttempt.attemptId) return;
    if (examTimerInterval) { clearInterval(examTimerInterval); examTimerInterval = null; }
    
    // Disable all inputs and buttons to prevent further interaction
    var allInputs = document.querySelectorAll("#examModal input, #examModal button");
    allInputs.forEach(function(el) { el.disabled = true; });
    
    var base = API_BASE || "";
    var payload = {
        answers: collectAttemptAnswers(),
        terminated_reason: terminatedReason || null
    };
    fetch(base + "/api/attempts/" + currentAttempt.attemptId + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
            if (!res.ok) throw new Error((res.data && res.data.message) || "Failed to submit.");
            var resultData = res.data;
            showExamResult(resultData);
            if (typeof loadIntegrityStatus === "function") loadIntegrityStatus();
            cleanupExamSecurity();
            // Mark attempt as submitted - prevent re-access
            if (currentAttempt && currentAttempt.attemptId) {
                localStorage.setItem("exam_submitted_" + currentAttempt.attemptId, "true");
            }
            // Add to Results section so marks and "Attempted" show in dashboard
            var examTitle = (currentAttempt && currentAttempt.exam && currentAttempt.exam.title) ? currentAttempt.exam.title : "Exam";
            var stored = localStorage.getItem("userResults");
            var results = stored ? JSON.parse(stored) : [];
            results.unshift({
                name: examTitle,
                date: new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
                score: resultData.percent != null ? resultData.percent : 0,
                rank: 1,
                status: "attempted"
            });
            localStorage.setItem("userResults", JSON.stringify(results));
            // Force refresh dashboard and exam list after submission
            console.log("Exam submitted, refreshing dashboard...");
            setTimeout(function() {
                console.log("Refreshing loadResults and loadExams...");
                if (typeof loadResults === "function") loadResults();
                if (typeof loadExams === "function") loadExams();
            }, 1000);
        })
        .catch(function (err) {
            console.error("Submit exam error:", err);
            if (typeof showNotificationToast === "function") showNotificationToast("Exam", err.message || "Failed to submit exam.");
            // Re-enable inputs on error
            allInputs.forEach(function(el) { el.disabled = false; });
        });
}

function showExamResult(data) {
    // Hide palette and navigation, show full result
    var palette = document.getElementById("questionPalette");
    var nav = document.querySelector(".question-navigation");
    var markReview = document.querySelector(".mark-review-section");
    var footer = document.querySelector(".exam-modal-footer");
    
    if (palette) palette.style.display = "none";
    if (nav) nav.style.display = "none";
    if (markReview) markReview.style.display = "none";
    if (footer) {
        footer.innerHTML = "<button class=\"btn-primary\" onclick=\"closeExamModal()\"><i class='bx bx-check'></i> Close</button>";
    }
    
    var display = document.getElementById("questionDisplay");
    if (!display) return;
    var breakdown = data.breakdown || [];
    // Map option id -> text for showing correct answers
    var optionText = {};
    (currentAttempt.questions || []).forEach(function (q) {
        (q.options || []).forEach(function (o) { optionText[o.id] = (o.key ? (o.key + ". ") : "") + (o.text || ""); });
    });
    var scoreStr = escapeHtml(String(data.score != null ? data.score : 0));
    var totalStr = escapeHtml(String(data.totalMarks != null ? data.totalMarks : 0));
    var pctStr = escapeHtml(String(data.percent != null ? data.percent : 0));
    var correctCount = data.correctCount != null ? data.correctCount : (data.breakdown || []).filter(function(b) { return b.is_correct; }).length;
    var incorrectCount = data.incorrectCount != null ? data.incorrectCount : (data.breakdown || []).length - correctCount;
    var timeTaken = data.timeTakenSeconds != null ? data.timeTakenSeconds : 0;
    var timeMin = Math.floor(timeTaken / 60);
    var timeSec = timeTaken % 60;
    var timeStr = timeMin + " min " + timeSec + " sec";
    var negativeStr = (data.negativeMarksApplied != null && data.negativeMarksApplied !== 0) ? escapeHtml(String(data.negativeMarksApplied)) : "N/A";
    var violationsHtml = examViolationCount > 0 ? "<p class=\"exam-result-violations\">Violations: <strong>" + escapeHtml(String(examViolationCount)) + "</strong></p>" : "";
    display.innerHTML = `
        <div class="exam-result-summary">
            <h4>Exam completed</h4>
            <span class="exam-result-badge">Attempted</span>
            <p class="exam-result-marks">
                Total score: <strong>${scoreStr}/${totalStr}</strong>
                <span style="margin-left: 12px;">(${pctStr}%)</span>
            </p>
            <p class="exam-result-detail">Correct: <strong>${correctCount}</strong> &nbsp;|&nbsp; Incorrect: <strong>${incorrectCount}</strong></p>
            <p class="exam-result-detail">Time taken: <strong>${timeStr}</strong></p>
            <p class="exam-result-detail">Negative marking applied: <strong>${negativeStr}</strong></p>
            ${violationsHtml}
        </div>
        ${breakdown.map(function (b, idx) {
            var sel = (b.selected_option_ids || []).map(function (id) { return optionText[id] || ("Option " + id); });
            var corr = (b.correct_option_ids || []).map(function (id) { return optionText[id] || ("Option " + id); });
            var statusClass = b.is_correct ? "result-correct" : "result-incorrect";
            var statusText = b.is_correct ? "✓ Correct" : "✗ Incorrect";
            return `
                <div class="exam-result-breakdown-item">
                    <h4>Q${idx + 1}. ${escapeHtml(b.question_text || "")}</h4>
                    <p class="${statusClass}">${statusText} · Earned ${escapeHtml(String(b.earned || 0))}/${escapeHtml(String(b.marks || 0))} marks</p>
                    <p class="result-detail"><strong>Your answer:</strong> ${escapeHtml(sel.join(", ") || "Not answered")}</p>
                    <p class="result-detail"><strong>Correct answer:</strong> ${escapeHtml(corr.join(", ") || "--")}</p>
                </div>
            `;
        }).join("")}
    `;
}

function setExamWarning(text) {
    var w = document.getElementById("examWarning");
    if (!w) return;
    w.textContent = text;
    w.style.display = "block";
}

function logExamViolation(type, detail) {
    if (!currentAttempt || !currentAttempt.attemptId) return;
    examViolationCount += 1;
    setExamWarning("Warning: Suspicious activity detected (" + type + "). Violations: " + examViolationCount + "/" + EXAM_MAX_VIOLATIONS);
    var base = API_BASE || "";
    fetch(base + "/api/attempts/" + currentAttempt.attemptId + "/violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type, detail: detail || "" })
    }).catch(function () {});
    if (examViolationCount >= EXAM_MAX_VIOLATIONS) {
        submitCurrentAttempt("Terminated due to repeated violations");
    }
}

function enableExamSecurity() {
    // Camera
    startExamCamera();
    startExamCameraMonitor();
    // Visibility/tab switching
    document.addEventListener("visibilitychange", handleExamVisibility);
    // Disable right click + copy
    document.addEventListener("contextmenu", preventExamContextMenu, true);
    document.addEventListener("copy", preventExamCopy, true);
    document.addEventListener("cut", preventExamCopy, true);
    document.addEventListener("paste", preventExamCopy, true);
    document.addEventListener("keydown", preventExamKeyCombos, true);
}

function cleanupExamSecurity() {
    stopExamCameraMonitor();
    document.removeEventListener("visibilitychange", handleExamVisibility);
    document.removeEventListener("contextmenu", preventExamContextMenu, true);
    document.removeEventListener("copy", preventExamCopy, true);
    document.removeEventListener("cut", preventExamCopy, true);
    document.removeEventListener("paste", preventExamCopy, true);
    document.removeEventListener("keydown", preventExamKeyCombos, true);
    stopExamCamera();
}

function handleExamVisibility() {
    if (!currentAttempt || !currentAttempt.exam || currentAttempt.exam.exam_type !== "mock") return;
    if (document.visibilityState !== "visible") {
        logExamViolation("tab_switch", "User switched tabs or minimized window");
    }
}

function preventExamContextMenu(e) {
    if (!currentAttempt || !currentAttempt.exam || currentAttempt.exam.exam_type !== "mock") return;
    e.preventDefault();
    logExamViolation("right_click", "Right click disabled during mock test");
}

function preventExamCopy(e) {
    if (!currentAttempt || !currentAttempt.exam || currentAttempt.exam.exam_type !== "mock") return;
    e.preventDefault();
    logExamViolation("copy_attempt", "Copy/cut/paste disabled during mock test");
}

function preventExamKeyCombos(e) {
    if (!currentAttempt || !currentAttempt.exam || currentAttempt.exam.exam_type !== "mock") return;
    var key = String(e.key || "").toLowerCase();
    if (e.ctrlKey && ["c", "v", "x", "a", "p", "s"].includes(key)) {
        e.preventDefault();
        logExamViolation("key_combo", "Blocked Ctrl+" + key.toUpperCase());
    }
}

function startExamCamera() {
    var row = document.getElementById("examCameraRow");
    var video = document.getElementById("examCameraPreview");
    var status = document.getElementById("examCameraStatus");
    if (row) row.style.display = "block";
    // Reuse preflight stream so user is not prompted twice.
    if (hasActiveVideoTrack(examMediaStream)) {
        if (video) video.srcObject = examMediaStream;
        if (status) status.textContent = "Camera is ON.";
        setTimeout(checkExamCameraHealth, 250);
        return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (status) status.textContent = "Camera not supported in this browser.";
        logExamViolation("camera_unavailable", "getUserMedia unavailable");
        return;
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function (stream) {
            examMediaStream = stream;
            if (video) video.srcObject = stream;
            if (status) status.textContent = "Camera is ON.";
            setTimeout(checkExamCameraHealth, 350);
        })
        .catch(function () {
            if (status) status.textContent = "Camera permission denied. Mock tests require camera.";
            logExamViolation("camera_off", "Camera permission denied");
        });
}

function stopExamCamera() {
    if (examMediaStream) {
        try {
            examMediaStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_) {} });
        } catch (_) {}
        examMediaStream = null;
    }
    var video = document.getElementById("examCameraPreview");
    if (video) video.srcObject = null;
}

// --- AI Study Assistant ---
var aiStudyMessages = [];

window.toggleAIStudyChat = function () {
    var panel = document.getElementById("aiStudyPanel");
    var fab = document.getElementById("aiStudyFab");
    if (!panel || !fab) return;
    var isOpen = panel.classList.toggle("active");
    fab.style.opacity = isOpen ? "0" : "1";
    fab.style.pointerEvents = isOpen ? "none" : "auto";
    if (isOpen) {
        document.getElementById("aiStudyInput")?.focus();
    }
};

window.sendAIStudyQuestion = function () {
    var input = document.getElementById("aiStudyInput");
    var messagesEl = document.getElementById("aiStudyMessages");
    var welcomeEl = document.getElementById("aiStudyWelcome");
    var sendBtn = document.getElementById("aiStudySendBtn");
    if (!input || !messagesEl || !sendBtn) return;
    var q = (input.value || "").trim();
    if (!q) return;

    welcomeEl.style.display = "none";
    var userMsg = document.createElement("div");
    userMsg.className = "ai-study-msg user";
    userMsg.textContent = q;
    messagesEl.appendChild(userMsg);

    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;

    var typingEl = document.createElement("div");
    typingEl.className = "ai-study-typing";
    typingEl.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var messagesForApi = aiStudyMessages.slice(-20);
    messagesForApi.push({ role: "user", content: q });

    var url = apiUrl("/api/ai/study");
    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, messages: messagesForApi })
    })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            typingEl.remove();
            var assistantMsg = document.createElement("div");
            assistantMsg.className = "ai-study-msg assistant";
            if (data.answer) {
                aiStudyMessages.push({ role: "user", content: q });
                aiStudyMessages.push({ role: "assistant", content: data.answer });
                assistantMsg.textContent = data.answer;
            } else {
                assistantMsg.classList.add("error");
                assistantMsg.textContent = data.message || "Sorry, something went wrong. Please try again.";
            }
            messagesEl.appendChild(assistantMsg);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        })
        .catch(function (err) {
            typingEl.remove();
            var errMsg = document.createElement("div");
            errMsg.className = "ai-study-msg assistant error";
            errMsg.textContent = "Failed to get a response. Check your connection and try again.";
            messagesEl.appendChild(errMsg);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        })
        .finally(function () {
            sendBtn.disabled = false;
        });
};

(function initAIStudyChat() {
    var input = document.getElementById("aiStudyInput");
    var sendBtn = document.getElementById("aiStudySendBtn");
    if (!input || !sendBtn) return;
    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendAIStudyQuestion();
        }
    });
    input.addEventListener("input", function () {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });
})();
