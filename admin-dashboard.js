const API_BASE = (function () {
    if (window.location.protocol === "file:") return "http://localhost:5000";
    const port = window.location.port;
    const devPorts = { "5500": 1, "3000": 1, "8080": 1, "5173": 1, "4173": 1, "4321": 1 };
    if (devPorts[port]) return "http://localhost:5000";
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return "";
    return "";
})();
const KEY_DOUBTS = "examease_doubts";

function showMaterialSuccessPopup(message) {
    const existing = document.getElementById("adminMaterialToast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "adminMaterialToast";
    toast.textContent = message;
    Object.assign(toast.style, {
        position: "fixed", top: "24px", left: "50%", transform: "translateX(-50%)",
        padding: "14px 28px", borderRadius: "12px", zIndex: "10000",
        background: "linear-gradient(135deg, #174bbd 0%, #1e5cd4 50%, #4ed442 100%)",
        color: "#fff", fontSize: "15px", fontWeight: "600", boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        transition: "opacity 0.4s ease"
    });
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
    }, 2500); // at least 2 sec visible
}
const KEY_STUDENT_ACCOUNTS = "examease_student_accounts";
const KEY_LOGIN_HISTORY = "examease_login_history";
const KEY_AUDIT_LOG = "examease_audit_log";

// Shared theme storage key (same as student dashboard)
const STORAGE_THEME = "examease_theme";
const STORAGE_LANG = "examease_lang";

// Theme toggle for admin (and shared with student when loaded)
window.toggleTheme = function() {
    const body = document.body;
    const isLight = body.classList.toggle("theme-light");
    const icon = document.getElementById("adminThemeToggleIcon") || document.getElementById("themeToggleIcon");
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

window.toggleLanguage = function() {
    let current = "en";
    try {
        current = localStorage.getItem(STORAGE_LANG) || "en";
    } catch (_) {}
    const next = current === "en" ? "hi" : "en";
    try {
        localStorage.setItem(STORAGE_LANG, next);
    } catch (_) {}
    const label = document.getElementById("adminLangToggleLabel");
    if (label) label.textContent = next === "hi" ? "हिं" : "EN";
};

document.addEventListener("DOMContentLoaded", () => {
    // Apply saved theme (shared with student dashboard)
    try {
        const savedTheme = localStorage.getItem("examease_theme");
        if (savedTheme === "light") {
            document.body.classList.add("theme-light");
        }
    } catch (_) {}
    const icon = document.getElementById("adminThemeToggleIcon");
    if (icon) {
        const isLight = document.body.classList.contains("theme-light");
        icon.classList.remove("bx-moon", "bx-sun");
        icon.classList.add(isLight ? "bx-sun" : "bx-moon");
    }
    const isAdminLoggedIn = localStorage.getItem("isAdminLoggedIn");
    const adminName = localStorage.getItem("adminName") || "ExamEase Admin";

    if (!isAdminLoggedIn || isAdminLoggedIn !== "true") {
        window.location.href = "index.html?role=admin";
        return;
    }

    initializeAdmin(adminName);

    loadAdminProfilePhotos();
    const adminPhotoUploadInput = document.getElementById("adminPhotoUpload");
    if (adminPhotoUploadInput) adminPhotoUploadInput.addEventListener("change", uploadAdminProfilePhoto);

    fetchAdminExamPapers().then(() => {
        renderAdminExams();
        populateQuestionExamSelect();
        updateOverviewStats();
    });
    renderAdminStudents();
    fetchAdminMaterials().then(() => renderAdminMaterials());
    fetchAdminDoubts().then(() => renderAdminDoubts());
    fetchAdminFeedback("pending").then(() => renderAdminFeedback());
    initDoubtsFeedbackTabs();
    fetchAdminAttempts().then(() => renderAdminAttempts());
    renderReporting();
    renderAnnouncements();
    renderLoginHistory();
    renderAuditLog();
    loadAdminUnifiedActivityFeed();

    const materialForm = document.getElementById("materialForm");
    if (materialForm) materialForm.addEventListener("submit", saveMaterialSubmit);
    const announcementForm = document.getElementById("announcementForm");
    if (announcementForm) announcementForm.addEventListener("submit", postAnnouncementSubmit);

    const examForm = document.getElementById("examForm");
    if (examForm) examForm.addEventListener("submit", submitExamCreate);
    const examTypeSelect = document.getElementById("examType");
    if (examTypeSelect && !examTypeSelect.hasAttribute("data-listener-attached")) {
        examTypeSelect.setAttribute("data-listener-attached", "true");
        examTypeSelect.addEventListener("change", function() {
            const descEl = document.getElementById("examTypeDesc");
            if (descEl) {
                if (this.value === "mock") {
                    descEl.innerHTML = "<strong style='color: #ffc107;'>Mock:</strong> Camera ON, tab-switch detection, violations tracked, <strong>1 attempt only</strong>";
                } else {
                    descEl.innerHTML = "<strong style='color: #4ed442;'>Practice:</strong> No camera, no tab-switch detection, no violations, <strong>2 attempts allowed</strong>";
                }
            }
        });
        examTypeSelect.dispatchEvent(new Event("change"));
    }
    const addNewQBtn = document.getElementById("addNewQuestionBtn");
    if (addNewQBtn) addNewQBtn.addEventListener("click", addNewQuestionForm);
    const importBtn = document.getElementById("importQuestionsBtn");
    if (importBtn) importBtn.addEventListener("click", importQuestionsBulk);
    const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
    if (downloadTemplateBtn) downloadTemplateBtn.addEventListener("click", downloadQuestionTemplate);
});

function logAudit(action, detail) {
    const log = JSON.parse(localStorage.getItem(KEY_AUDIT_LOG) || "[]");
    log.unshift({
        time: new Date().toISOString(),
        action,
        detail: detail || "",
        who: localStorage.getItem("adminName") || "Admin"
    });
    localStorage.setItem(KEY_AUDIT_LOG, JSON.stringify(log.slice(0, 500)));
}

function initializeAdmin(name) {
    const initials = getInitials(name);
    const adminNameDisplay = document.getElementById("adminNameDisplay");
    const adminNameHeading = document.getElementById("adminNameHeading");
    const adminInitials = document.getElementById("adminInitials");
    const adminPhotoPreviewInitials = document.getElementById("adminPhotoPreviewInitials");

    if (adminNameDisplay) adminNameDisplay.textContent = name;
    if (adminNameHeading) adminNameHeading.textContent = name;
    if (adminInitials) adminInitials.textContent = initials;
    if (adminPhotoPreviewInitials) adminPhotoPreviewInitials.textContent = initials;

    updateOverviewStats();
}

function getInitials(name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function setAvatarPhoto(imgEl, initialsEl, email) {
    if (!imgEl || !initialsEl) return;
    if (!email) return;

    const base = API_BASE || "";
    const url = (base ? base : "") + "/api/profile/photo?email=" + encodeURIComponent(email) + "&t=" + Date.now();
    imgEl.src = url;
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

function loadAdminProfilePhotos() {
    const email = (localStorage.getItem("currentAdminEmail") || "").trim();
    if (!email) return;

    setAvatarPhoto(
        document.getElementById("adminPhotoMini"),
        document.getElementById("adminInitials"),
        email
    );
    setAvatarPhoto(
        document.getElementById("adminPhotoPreview"),
        document.getElementById("adminPhotoPreviewInitials"),
        email
    );
}

function uploadAdminProfilePhoto() {
    const input = document.getElementById("adminPhotoUpload");
    if (!input || !input.files || !input.files[0]) {
        alert("Please select a photo first.");
        return;
    }
    const email = (localStorage.getItem("currentAdminEmail") || "").trim();
    if (!email) {
        alert("Could not determine admin email.");
        return;
    }

    const file = input.files[0];
    const form = new FormData();
    form.append("email", email);
    form.append("photo", file);

    const base = API_BASE || "";
    const url = (base ? base : "") + "/api/profile/photo";

    const headers = {};
    const token = getAdminToken();
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }

    fetch(url, {
        method: "POST",
        headers,
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
            if (typeof showMaterialSuccessPopup === "function") showMaterialSuccessPopup("Admin photo updated successfully!");
            input.value = "";
            loadAdminProfilePhotos();
        })
        .catch(function(err) {
            console.error("Upload admin profile photo error:", err);
            alert("Failed to upload photo. " + (err.message || ""));
        });
}

// Overview stats
function updateOverviewStats() {
    const students = getStoredStudents();
    const totalExamsEl = document.getElementById("adminTotalExams");
    if (totalExamsEl) totalExamsEl.textContent = String((adminExamPapers || []).length);
    document.getElementById("adminTotalStudents").textContent = students.length;
    const activeEl = document.getElementById("adminActiveExams");
    if (activeEl) activeEl.textContent = String((adminExamPapers || []).filter(e => String(e.is_active) === "1" || e.is_active === 1).length);
}

// ——— Exams (DB-backed) ———
let adminExamPapers = [];

function getAdminToken() {
    return localStorage.getItem("examease_remember_token_admin") || "";
}

function fetchAdminExamPapers() {
    const url = API_BASE ? `${API_BASE}/api/exams/admin/all` : "/api/exams/admin/all";
    return fetch(url)
        .then(res => (res.ok ? res.json() : []))
        .then(rows => {
            const list = Array.isArray(rows) ? rows : [];
            const seenIds = new Set();
            const seenKey = new Set();
            adminExamPapers = list.filter(e => {
                const id = e.id != null ? String(e.id) : null;
                const key = (e.title || "").trim().toLowerCase() + "|" + (e.exam_type || "practice");
                if (!id || seenIds.has(id)) return false;
                if (seenKey.has(key)) return false;
                seenIds.add(id);
                seenKey.add(key);
                return true;
            });
            return adminExamPapers;
        })
        .catch(err => {
            console.error("Fetch admin exams error:", err);
            adminExamPapers = [];
            return adminExamPapers;
        });
}

function renderAdminExams() {
    const tbody = document.getElementById("adminExamsTableBody");
    if (!tbody) return;
    if (!adminExamPapers.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:24px; color:rgba(255,255,255,0.88);">
                    No exams created yet. Use the form on the left to add a new exam.
                </td>
            </tr>
        `;
        return;
    }
    tbody.innerHTML = adminExamPapers.map(e => {
        const subs = Array.isArray(e.subjects) ? e.subjects.join(", ") : (e.subjects || "");
        const active = (String(e.is_active) === "1" || e.is_active === 1) ? "Yes" : "No";
        return `
            <tr>
                <td>${escapeHtml(e.title || "")}</td>
                <td>${escapeHtml(subs || "--")}</td>
                <td>${escapeHtml(String(e.exam_type || "practice"))}</td>
                <td>${escapeHtml(String(e.duration_minutes || "--"))} min</td>
                <td>${escapeHtml(String(e.total_marks || "--"))}</td>
                <td>${escapeHtml(String(e.difficulty || "--"))}</td>
                <td>${escapeHtml(active)}</td>
                <td class="table-actions">
                    <button onclick="selectExamForQuestions('${e.id}')"><i class='bx bx-list-plus'></i></button>
                </td>
            </tr>
        `;
    }).join("");
}

function resetExamForm() {
    const f = document.getElementById("examForm");
    if (f) f.reset();
    const idField = document.getElementById("examId");
    if (idField) idField.value = "";
    const allowMCQ = document.getElementById("allowMCQ");
    const allowMSQ = document.getElementById("allowMSQ");
    if (allowMCQ) allowMCQ.checked = true;
    if (allowMSQ) allowMSQ.checked = true;
}

function submitExamCreate(e) {
    e.preventDefault();
    e.stopPropagation();
    const titleEl = document.getElementById("examTitle");
    const subjectsEl = document.getElementById("examSubjects");
    const examTypeEl = document.getElementById("examType");
    const difficultyEl = document.getElementById("examDifficulty");
    const questionCountEl = document.getElementById("examQuestionCount");
    const totalMarksEl = document.getElementById("examTotalMarks");
    const durationEl = document.getElementById("examDuration");
    const activeEl = document.getElementById("examActive");
    const allowMCQEl = document.getElementById("allowMCQ");
    const allowMSQEl = document.getElementById("allowMSQ");
    
    if (!titleEl || !examTypeEl || !questionCountEl || !totalMarksEl || !durationEl) {
        alert("Form fields not found. Please refresh the page.");
        return;
    }
    
    const title = titleEl.value.trim();
    const subjects = subjectsEl ? subjectsEl.value.trim() : "";
    const exam_type = examTypeEl.value;
    const difficulty = difficultyEl ? difficultyEl.value : "mixed";
    const question_count = parseInt(questionCountEl.value, 10) || 0;
    const total_marks = parseInt(totalMarksEl.value, 10) || 0;
    const duration_minutes = parseInt(durationEl.value, 10) || 30;
    const is_active = activeEl ? parseInt(activeEl.value, 10) : 1;
    const allowMCQ = !!(allowMCQEl && allowMCQEl.checked);
    const allowMSQ = !!(allowMSQEl && allowMSQEl.checked);
    
    const allowed_question_types = [];
    if (allowMCQ) allowed_question_types.push("MCQ");
    if (allowMSQ) allowed_question_types.push("MSQ");
    if (!allowed_question_types.length) {
        alert("Select at least one question type (MCQ/MSQ).");
        return;
    }
    if (!title) {
        alert("Exam title is required.");
        return;
    }
    
    const url = API_BASE ? `${API_BASE}/api/exams` : "/api/exams";
    const headers = { "Content-Type": "application/json" };
    const token = getAdminToken();
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
    
    const payload = { title, subjects, exam_type, question_count, total_marks, duration_minutes, difficulty, allowed_question_types, is_active };
    console.log("Creating exam with payload:", payload);
    
    fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    })
        .then(res => {
            console.log("Response status:", res.status);
            return res.json().then(d => ({ ok: res.ok, status: res.status, data: d }));
        })
        .then(r => {
            console.log("Response data:", r);
            if (!r.ok) {
                const msg = (r.data && r.data.message) || (r.data && r.data.error) || "Failed to create exam.";
                throw new Error(msg + " (Status: " + r.status + ")");
            }
            logAudit("exam_created", title);
            showMaterialSuccessPopup("Exam created successfully!");
            if (r.data && r.data.exam && r.data.exam.id) {
                setTimeout(() => selectExamForQuestions(r.data.exam.id), 500);
            }
            return fetchAdminExamPapers();
        })
        .then(() => {
            renderAdminExams();
            populateQuestionExamSelect();
            resetExamForm();
            updateOverviewStats();
        })
        .catch(err => {
            console.error("Create exam error:", err);
            alert("Failed to create exam.\n\nError: " + (err.message || String(err)) + "\n\nCheck browser console for details.");
        });
}

// ——— Dynamic Question Management ———
let questionDrafts = []; // Store draft questions locally
let currentExamId = null;
let currentExamInfo = null;

function populateQuestionExamSelect() {
    const sel = document.getElementById("questionExamSelect");
    if (!sel) return;
    const currentVal = sel.value;
    const placeholder = "<option value=\"\">Select exam</option>";
    if (!adminExamPapers.length) {
        sel.innerHTML = placeholder + "<option value=\"\" disabled>No exams yet</option>";
        sel.value = "";
        return;
    }
    const uniqueExams = [];
    const seen = new Set();
    adminExamPapers.forEach(e => {
        const id = e.id != null ? String(e.id) : null;
        const key = (e.title || "").trim().toLowerCase() + "|" + (e.exam_type || "practice");
        if (!id || seen.has(key)) return;
        seen.add(key);
        uniqueExams.push(e);
    });
    sel.innerHTML = placeholder + uniqueExams.map(e => `<option value="${e.id}">${escapeHtml(e.title || ("Exam " + e.id))} (${e.exam_type === "mock" ? "Mock" : "Practice"})</option>`).join("");
    if (currentVal) sel.value = currentVal; else sel.value = "";
    if (!sel.hasAttribute("data-listener-attached")) {
        sel.setAttribute("data-listener-attached", "true");
        sel.addEventListener("change", function() {
            const examId = this.value;
            if (examId) {
                const exam = adminExamPapers.find(e => String(e.id) === String(examId));
                if (exam) {
                    currentExamId = examId;
                    currentExamInfo = exam;
                    updateExamInfoDisplay(exam);
                    loadExistingQuestions(examId);
                }
            } else {
                currentExamId = null;
                currentExamInfo = null;
                const infoEl = document.getElementById("questionExamInfo");
                const listEl = document.getElementById("questionsList");
                if (infoEl) infoEl.style.display = "none";
                if (listEl) listEl.innerHTML = "";
                updateQuestionsCount();
            }
        });
    }
}

function updateExamInfoDisplay(exam) {
    const infoEl = document.getElementById("questionExamInfo");
    const typeEl = document.getElementById("examInfoType");
    const subjectsEl = document.getElementById("examInfoSubjects");
    const durationEl = document.getElementById("examInfoDuration");
    const questionCountEl = document.getElementById("examInfoQuestionCount");
    const marksEl = document.getElementById("examInfoMarks");
    const noteEl = document.getElementById("examInfoSecurityNote");
    const descEl = document.getElementById("examInfoSecurityDesc");
    if (!infoEl) return;
    if (typeEl) typeEl.textContent = exam.exam_type === "mock" ? "Mock Test" : "Practice Test";
    if (subjectsEl) subjectsEl.textContent = (exam.subjects && exam.subjects.length) ? exam.subjects.join(", ") : "General";
    if (durationEl) durationEl.textContent = exam.duration_minutes || 0;
    if (questionCountEl) questionCountEl.textContent = exam.question_count != null ? exam.question_count : 0;
    if (marksEl) marksEl.textContent = exam.total_marks || 0;
    if (exam.exam_type === "mock") {
        if (noteEl) noteEl.textContent = "Mock Test:";
        if (descEl) descEl.textContent = "Camera monitoring enabled, tab-switch detection active, violation tracking, 1 attempt only.";
        if (infoEl) infoEl.style.background = "rgba(255,193,7,0.1)";
        if (infoEl) infoEl.style.borderColor = "rgba(255,193,7,0.2)";
    } else {
        if (noteEl) noteEl.textContent = "Practice Test:";
        if (descEl) descEl.textContent = "No camera, no tab-switch detection, no violations, 2 attempts allowed.";
        if (infoEl) infoEl.style.background = "rgba(78,212,66,0.1)";
        if (infoEl) infoEl.style.borderColor = "rgba(78,212,66,0.2)";
    }
    infoEl.style.display = "block";
}

function selectExamForQuestions(examId) {
    const sel = document.getElementById("questionExamSelect");
    if (sel) {
        sel.value = String(examId);
        sel.dispatchEvent(new Event("change"));
    }
}

function addNewQuestionForm() {
    if (!currentExamId) {
        alert("Please select an exam first.");
        return;
    }
    const qId = "q_" + Date.now();
    const formHtml = createQuestionFormHtml(qId);
    const listEl = document.getElementById("questionsList");
    if (listEl) {
        listEl.insertAdjacentHTML("beforeend", formHtml);
        attachQuestionFormHandlers(qId);
    }
    updateQuestionsCount();
}

function createQuestionFormHtml(qId, data) {
    data = data || { question_text: "", question_type: "MCQ", marks: 1, negative_marks: 0, difficulty: "medium", options: ["", "", "", ""], correct: [] };
    const isMCQ = data.question_type === "MCQ";
    const inputType = isMCQ ? "radio" : "checkbox";
    const nameAttr = isMCQ ? `name="correct_${qId}"` : "";
    return `
        <div class="question-form-item" data-qid="${qId}" data-saved="${data.saved ? "true" : "false"}">
            <div class="question-form-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h5 style="color: rgba(255,255,255,0.95); font-size: 14px; margin: 0;">Question <span class="question-number"></span>${data.saved ? " <span style='color: #4ed442; font-size: 12px;'>(Saved)</span>" : " <span style='color: #ffc107; font-size: 12px;'>(Draft)</span>"}</h5>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="question-action-btn save-draft-btn" onclick="saveQuestionDraft('${qId}')" style="padding: 4px 10px; font-size: 12px;"><i class='bx bx-save'></i> Save Draft</button>
                    <button type="button" class="question-action-btn save-final-btn" onclick="saveQuestionFinal('${qId}')" style="padding: 4px 10px; font-size: 12px;"><i class='bx bx-check'></i> Save</button>
                    <button type="button" class="question-action-btn edit-btn" onclick="editQuestion('${qId}')" style="padding: 4px 10px; font-size: 12px; display: none;"><i class='bx bx-edit'></i> Edit</button>
                    <button type="button" class="question-action-btn delete-btn" onclick="deleteQuestion('${qId}')" style="padding: 4px 10px; font-size: 12px; background: rgba(244,67,54,0.2); color: #f44336;"><i class='bx bx-trash'></i></button>
                </div>
            </div>
            <div class="form-row">
                <label>Question Text</label>
                <textarea class="question-text-input" rows="3" placeholder="Type the question...">${escapeHtml(data.question_text || "")}</textarea>
            </div>
            <div class="form-row two-cols">
                <div>
                    <label>Type</label>
                    <select class="question-type-select">
                        <option value="MCQ" ${data.question_type === "MCQ" ? "selected" : ""}>MCQ</option>
                        <option value="MSQ" ${data.question_type === "MSQ" ? "selected" : ""}>MSQ</option>
                    </select>
                </div>
                <div>
                    <label>Marks</label>
                    <input type="number" class="question-marks-input" min="1" value="${data.marks || 1}">
                </div>
                <div>
                    <label>Negative Marks</label>
                    <input type="number" class="question-negative-input" min="0" step="0.25" value="${data.negative_marks || 0}">
                </div>
                <div>
                    <label>Difficulty</label>
                    <select class="question-difficulty-select">
                        <option value="easy" ${data.difficulty === "easy" ? "selected" : ""}>Easy</option>
                        <option value="medium" ${data.difficulty === "medium" ? "selected" : ""}>Medium</option>
                        <option value="hard" ${data.difficulty === "hard" ? "selected" : ""}>Hard</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <label>Options</label>
                <div class="option-grid">
                    <input type="text" class="option-input" data-opt="0" placeholder="Option A" value="${escapeHtml(data.options[0] || "")}">
                    <input type="text" class="option-input" data-opt="1" placeholder="Option B" value="${escapeHtml(data.options[1] || "")}">
                    <input type="text" class="option-input" data-opt="2" placeholder="Option C" value="${escapeHtml(data.options[2] || "")}">
                    <input type="text" class="option-input" data-opt="3" placeholder="Option D" value="${escapeHtml(data.options[3] || "")}">
                </div>
            </div>
            <div class="form-row">
                <label>Correct Answer(s)</label>
                <div class="inline-checks">
                    <label class="check-pill"><input type="${inputType}" class="correct-answer-input" data-idx="0" ${nameAttr} ${data.correct.indexOf(0) >= 0 ? "checked" : ""}> A</label>
                    <label class="check-pill"><input type="${inputType}" class="correct-answer-input" data-idx="1" ${nameAttr} ${data.correct.indexOf(1) >= 0 ? "checked" : ""}> B</label>
                    <label class="check-pill"><input type="${inputType}" class="correct-answer-input" data-idx="2" ${nameAttr} ${data.correct.indexOf(2) >= 0 ? "checked" : ""}> C</label>
                    <label class="check-pill"><input type="${inputType}" class="correct-answer-input" data-idx="3" ${nameAttr} ${data.correct.indexOf(3) >= 0 ? "checked" : ""}> D</label>
                </div>
                <p class="form-hint">For MCQ choose exactly one; for MSQ choose multiple.</p>
            </div>
        </div>
    `;
}

function attachQuestionFormHandlers(qId) {
    const formEl = document.querySelector(`[data-qid="${qId}"]`);
    if (!formEl) return;
    const typeSelect = formEl.querySelector(".question-type-select");
    if (typeSelect) {
        typeSelect.addEventListener("change", function() {
            const isMCQ = this.value === "MCQ";
            const correctInputs = formEl.querySelectorAll(".correct-answer-input");
            correctInputs.forEach(inp => {
                inp.type = isMCQ ? "radio" : "checkbox";
                if (isMCQ) inp.setAttribute("name", `correct_${qId}`);
                else inp.removeAttribute("name");
            });
            if (isMCQ) {
                const checked = Array.from(correctInputs).find(c => c.checked);
                if (!checked && correctInputs[0]) correctInputs[0].checked = true;
            }
        });
    }
    const correctInputs = formEl.querySelectorAll(".correct-answer-input");
    if (typeSelect && typeSelect.value === "MCQ") {
        correctInputs.forEach(inp => {
            inp.addEventListener("change", function() {
                if (!this.checked) return;
                correctInputs.forEach(o => { if (o !== this) o.checked = false; });
            });
        });
    }
    updateQuestionNumbers();
}

function updateQuestionNumbers() {
    const items = document.querySelectorAll(".question-form-item");
    items.forEach((item, idx) => {
        const numEl = item.querySelector(".question-number");
        if (numEl) numEl.textContent = "#" + (idx + 1);
    });
}

function updateQuestionsCount() {
    const countEl = document.getElementById("questionsCount");
    if (countEl) {
        const count = document.querySelectorAll(".question-form-item").length;
        countEl.textContent = count;
    }
}

function getQuestionData(qId) {
    const formEl = document.querySelector(`[data-qid="${qId}"]`);
    if (!formEl) return null;
    const question_text = (formEl.querySelector(".question-text-input") || {}).value.trim();
    const question_type = (formEl.querySelector(".question-type-select") || {}).value || "MCQ";
    const marks = parseInt((formEl.querySelector(".question-marks-input") || {}).value, 10) || 1;
    const negative_marks = parseFloat((formEl.querySelector(".question-negative-input") || {}).value) || 0;
    const difficulty = (formEl.querySelector(".question-difficulty-select") || {}).value || "medium";
    const options = Array.from(formEl.querySelectorAll(".option-input")).map(inp => inp.value.trim()).filter(Boolean);
    const correct = Array.from(formEl.querySelectorAll(".correct-answer-input"))
        .filter(c => c.checked)
        .map(c => parseInt(c.getAttribute("data-idx"), 10))
        .filter(n => Number.isFinite(n));
    return { question_text, question_type, marks, negative_marks, difficulty, options, correct };
}

function saveQuestionDraft(qId) {
    const data = getQuestionData(qId);
    if (!data) return;
    if (!data.question_text) {
        alert("Question text is required.");
        return;
    }
    const existing = questionDrafts.findIndex(d => d.id === qId);
    if (existing >= 0) {
        questionDrafts[existing] = { ...data, id: qId, saved: false };
    } else {
        questionDrafts.push({ ...data, id: qId, saved: false });
    }
    const formEl = document.querySelector(`[data-qid="${qId}"]`);
    if (formEl) {
        formEl.setAttribute("data-saved", "false");
        const header = formEl.querySelector(".question-form-header h5");
        if (header) {
            const num = header.querySelector(".question-number").textContent;
            header.innerHTML = num + " <span style='color: #ffc107; font-size: 12px;'>(Draft)</span>";
        }
    }
    showMaterialSuccessPopup("Question saved as draft.");
    saveDraftsToLocalStorage();
}

function saveQuestionFinal(qId) {
    if (!currentExamId) {
        alert("Select an exam first.");
        return;
    }
    const data = getQuestionData(qId);
    if (!data) return;
    if (!data.question_text) {
        alert("Question text is required.");
        return;
    }
    if (data.options.length < 2) {
        alert("Enter at least 2 options.");
        return;
    }
    if (!data.correct.length) {
        alert("Select correct answer(s).");
        return;
    }
    if (data.question_type === "MCQ" && data.correct.length !== 1) {
        alert("MCQ must have exactly one correct option.");
        return;
    }
    const url = API_BASE ? `${API_BASE}/api/exams/${currentExamId}/questions` : `/api/exams/${currentExamId}/questions`;
    const headers = { "Content-Type": "application/json" };
    const token = getAdminToken();
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
    fetch(url, {
        method: "POST",
        headers,
            body: JSON.stringify({ question_text: data.question_text, question_type: data.question_type, marks: data.marks, negative_marks: data.negative_marks || 0, difficulty: data.difficulty, options: data.options, correct: data.correct })
    })
        .then(res => res.json().then(d => ({ ok: res.ok, data: d })))
        .then(r => {
            if (!r.ok) throw new Error((r.data && r.data.message) || "Failed to save question.");
            logAudit("question_added", String(currentExamId));
            showMaterialSuccessPopup("Question saved successfully!");
            const formEl = document.querySelector(`[data-qid="${qId}"]`);
            if (formEl) {
                formEl.setAttribute("data-saved", "true");
                const header = formEl.querySelector(".question-form-header h5");
                if (header) {
                    const num = header.querySelector(".question-number").textContent;
                    header.innerHTML = num + " <span style='color: #4ed442; font-size: 12px;'>(Saved)</span>";
                }
                formEl.querySelector(".save-final-btn").style.display = "none";
                formEl.querySelector(".edit-btn").style.display = "inline-block";
            }
            const idx = questionDrafts.findIndex(d => d.id === qId);
            if (idx >= 0) questionDrafts.splice(idx, 1);
            saveDraftsToLocalStorage();
            setTimeout(function() {
                window.location.reload();
            }, 500);
        })
        .catch(err => {
            console.error("Save question error:", err);
            alert("Failed to save question. " + (err.message || ""));
        });
}

function editQuestion(qId) {
    const formEl = document.querySelector(`[data-qid="${qId}"]`);
    if (!formEl) return;
    formEl.setAttribute("data-saved", "false");
    const header = formEl.querySelector(".question-form-header h5");
    if (header) {
        const num = header.querySelector(".question-number").textContent;
        header.innerHTML = num + " <span style='color: #ffc107; font-size: 12px;'>(Editing)</span>";
    }
    formEl.querySelector(".save-final-btn").style.display = "inline-block";
    formEl.querySelector(".edit-btn").style.display = "none";
}

function deleteQuestion(qId) {
    if (!confirm("Delete this question?")) return;
    const formEl = document.querySelector(`[data-qid="${qId}"]`);
    if (formEl) formEl.remove();
    const idx = questionDrafts.findIndex(d => d.id === qId);
    if (idx >= 0) questionDrafts.splice(idx, 1);
    saveDraftsToLocalStorage();
    updateQuestionNumbers();
    updateQuestionsCount();
}

function saveDraftsToLocalStorage() {
    try {
        localStorage.setItem("questionDrafts_" + (currentExamId || "none"), JSON.stringify(questionDrafts));
    } catch (_) {}
}

function loadDraftsFromLocalStorage() {
    try {
        const stored = localStorage.getItem("questionDrafts_" + (currentExamId || "none"));
        if (stored) questionDrafts = JSON.parse(stored) || [];
    } catch (_) {
        questionDrafts = [];
    }
}

function loadExistingQuestions(examId) {
    const listEl = document.getElementById("questionsList");
    if (!listEl) return;
    listEl.innerHTML = "";
    questionDrafts = [];
    loadDraftsFromLocalStorage();
    questionDrafts.forEach(draft => {
        const formHtml = createQuestionFormHtml(draft.id, draft);
        listEl.insertAdjacentHTML("beforeend", formHtml);
        attachQuestionFormHandlers(draft.id);
    });
    updateQuestionsCount();
}

window.addNewQuestionForm = addNewQuestionForm;
window.saveQuestionDraft = saveQuestionDraft;
window.saveQuestionFinal = saveQuestionFinal;
window.editQuestion = editQuestion;
window.deleteQuestion = deleteQuestion;

function importQuestionsBulk() {
    const examId = currentExamId || document.getElementById("questionExamSelect").value;
    const fileInput = document.getElementById("questionJsonUpload");
    if (!examId) { alert("Select an exam first."); return; }
    if (!fileInput || !fileInput.files || !fileInput.files[0]) { alert("Choose a JSON or CSV file."); return; }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const text = String(reader.result || "");
            let questions = [];
            if (file.name.toLowerCase().endsWith(".csv")) {
                questions = parseCSVQuestions(text);
            } else {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    const first = parsed[0];
                    if (parsed.length === 1 && first && Array.isArray(first.questions) && first.questions.length) {
                        questions = first.questions;
                    } else {
                        questions = parsed;
                    }
                } else if (parsed && Array.isArray(parsed.questions)) {
                    questions = parsed.questions;
                } else {
                    throw new Error("JSON must be an array of questions or an object/array with a 'questions' array.");
                }
            }
            if (!questions.length) {
                alert("No questions found in file.");
                return;
            }
            const headers = { "Content-Type": "application/json" };
            const token = getAdminToken();
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
            const base = API_BASE || "";
            let successCount = 0;
            const seq = questions.reduce((p, q, idx) => {
                return p.then(() => {
                    let options = Array.isArray(q.options) ? q.options : [];
                    if (!options.length && q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
                        const keys = ["A", "B", "C", "D", "E", "F"];
                        options = keys.map((k) => q.options[k]).filter(Boolean);
                    }
                    let correct = Array.isArray(q.correct) ? q.correct : (q.correct != null ? [q.correct] : []);
                    // Normalize correct to 0-based indices (backend expects 0,1,2,...)
                    const optionLetters = ["A", "B", "C", "D", "E", "F"];
                    correct = correct.map((c) => {
                        if (Number.isFinite(Number(c)) && Number(c) >= 0) return Number(c);
                        const letter = String(c).trim().toUpperCase();
                        const idx = optionLetters.indexOf(letter);
                        if (idx >= 0) return idx;
                        return -1;
                    }).filter((i) => i >= 0 && i < options.length);
                    const payload = {
                        question_text: q.question_text || q.question,
                        question_type: q.question_type || q.type || "MCQ",
                        marks: q.marks || 1,
                        negative_marks: q.negative_marks || 0,
                        difficulty: q.difficulty || "medium",
                        options: options,
                        correct: correct
                    };
                    if (!payload.question_text || !payload.options.length || !payload.correct.length) {
                        console.warn("Skipping invalid question at index", idx);
                        return Promise.resolve();
                    }
                    return fetch(`${base}/api/exams/${examId}/questions`, { method: "POST", headers, body: JSON.stringify(payload) })
                        .then(r => {
                            if (r.ok) {
                                successCount++;
                                return r.json();
                            }
                            return r.json().then(d => {
                                const msg = d.error ? (d.message + " " + d.error) : (d.message || "Import failed");
                                return Promise.reject(new Error(msg));
                            });
                        });
                });
            }, Promise.resolve());
            seq.then(() => {
                showMaterialSuccessPopup(`Imported ${successCount} question(s) successfully!`);
                loadExistingQuestions(examId);
                setTimeout(function() {
                    window.location.reload();
                }, 600);
            })
               .catch(err => alert("Import error: " + (err.message || "")));
        } catch (e) {
            alert("Invalid file format: " + (e.message || ""));
        }
    };
    reader.readAsText(file);
}

function parseCSVQuestions(csvText) {
    const lines = csvText.split("\n").filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const questions = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const q = {};
        headers.forEach((h, idx) => {
            if (h === "question_text" || h === "question") q.question_text = values[idx] || "";
            else if (h === "question_type" || h === "type") q.question_type = values[idx] || "MCQ";
            else if (h === "marks") q.marks = parseInt(values[idx], 10) || 1;
            else if (h === "negative_marks" || h === "negative") q.negative_marks = parseFloat(values[idx]) || 0;
            else if (h === "difficulty") q.difficulty = values[idx] || "medium";
            else if (h === "option_a" || h === "a") q.option_a = values[idx] || "";
            else if (h === "option_b" || h === "b") q.option_b = values[idx] || "";
            else if (h === "option_c" || h === "c") q.option_c = values[idx] || "";
            else if (h === "option_d" || h === "d") q.option_d = values[idx] || "";
            else if (h === "correct_a" || h === "correcta") q.correct_a = values[idx] === "1" || values[idx] === "true";
            else if (h === "correct_b" || h === "correctb") q.correct_b = values[idx] === "1" || values[idx] === "true";
            else if (h === "correct_c" || h === "correctc") q.correct_c = values[idx] === "1" || values[idx] === "true";
            else if (h === "correct_d" || h === "correctd") q.correct_d = values[idx] === "1" || values[idx] === "true";
        });
        const options = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
        const correct = [];
        if (q.correct_a) correct.push(0);
        if (q.correct_b) correct.push(1);
        if (q.correct_c) correct.push(2);
        if (q.correct_d) correct.push(3);
        questions.push({
            question_text: q.question_text,
            question_type: q.question_type,
            marks: q.marks,
            negative_marks: q.negative_marks,
            difficulty: q.difficulty,
            options: options,
            correct: correct
        });
    }
    return questions;
}

function downloadQuestionTemplate() {
    const template = [
        {
            question_text: "What is the time complexity of binary search?",
            question_type: "MCQ",
            marks: 2,
            negative_marks: 0.5,
            difficulty: "medium",
            options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
            correct: [1]
        },
        {
            question_text: "Which of the following are sorting algorithms?",
            question_type: "MSQ",
            marks: 3,
            negative_marks: 0.75,
            difficulty: "easy",
            options: ["Quick Sort", "Bubble Sort", "Binary Search", "Merge Sort"],
            correct: [0, 1, 3]
        }
    ];
    const jsonStr = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_template.json";
    a.click();
    URL.revokeObjectURL(url);
}

// ——— Attempts & violations (admin) ———
let adminAttempts = [];

function fetchAdminAttempts(flaggedOnly = 0) {
    const base = API_BASE || "";
    const url = `${base}/api/attempts/admin/list${flaggedOnly ? "?flaggedOnly=1" : ""}`;
    return fetch(url)
        .then(res => res.ok ? res.json() : [])
        .then(rows => { adminAttempts = Array.isArray(rows) ? rows : []; return adminAttempts; })
        .catch(err => { console.error("Fetch attempts error:", err); adminAttempts = []; return adminAttempts; });
}

function renderAdminAttempts() {
    const el = document.getElementById("adminAttemptsList");
    if (!el) return;
    if (!adminAttempts.length) {
        el.innerHTML = "<p style='color: rgba(255,255,255,0.88);'>No attempts yet.</p>";
        return;
    }
    el.innerHTML = adminAttempts.slice(0, 50).map(a => {
        const who = escapeHtml(a.student_name || a.student_email || "Student");
        const when = a.submitted_at ? new Date(a.submitted_at).toLocaleString() : (a.started_at ? new Date(a.started_at).toLocaleString() : "");
        const status = escapeHtml(a.status || "");
        const v = a.violations_count || 0;
        return `<div class="audit-item" style="border-bottom:1px solid rgba(255,255,255,0.06);">
            <strong>${escapeHtml(a.exam_title || "Exam")}</strong> · ${who}<br>
            <span style="color: rgba(255,255,255,0.88); font-size:12px;">${when} · Status: ${status} · Score: ${a.score || 0}/${a.total_marks || 0} · Violations: ${v}</span>
        </div>`;
    }).join("");
}

// Student accounts (approve / block / reset)
function getStudentAccounts() {
    try {
        return JSON.parse(localStorage.getItem(KEY_STUDENT_ACCOUNTS) || "{}");
    } catch {
        return {};
    }
}

function setStudentAccountStatus(email, status) {
    const accounts = getStudentAccounts();
    accounts[email] = accounts[email] || {};
    accounts[email].status = status;
    accounts[email].updatedAt = new Date().toISOString();
    localStorage.setItem(KEY_STUDENT_ACCOUNTS, JSON.stringify(accounts));
    logAudit("student_status", `${email} -> ${status}`);
}

// Students
function getStoredStudents() {
    const accounts = getStudentAccounts();
    const students = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("studentMeta:")) continue;
        try {
            const meta = JSON.parse(localStorage.getItem(key));
            if (meta && meta.username && meta.email) {
                const email = meta.email;
                const acc = accounts[email];
                const status = acc && acc.status ? acc.status : "approved";
                students.push({
                    name: meta.username,
                    email: meta.email,
                    online: !!meta.online,
                    lastLogin: meta.lastLogin || null,
                    enrolledExams: meta.enrolledExams ?? 0,
                    recentActivity: meta.recentActivity || "No activity yet",
                    accountStatus: status
                });
            }
        } catch {
            // ignore invalid
        }
    }
    return students;
}

function formatDateTime(iso) {
    if (!iso) return "--";
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "--";
        return d.toLocaleString();
    } catch {
        return "--";
    }
}

function renderAdminStudents() {
    const students = getStoredStudents();
    const tbody = document.getElementById("adminStudentsTableBody");
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:24px; color:rgba(255,255,255,0.6);">
                    No students registered yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students
        .map(
            s => {
                const status = s.accountStatus || "approved";
                return `
        <tr>
            <td>${escapeHtml(s.name)}</td>
            <td>${escapeHtml(s.email)}</td>
            <td><span class="status-chip ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
            <td>${formatDateTime(s.lastLogin)}</td>
            <td class="student-actions">
                ${status !== "approved" ? `<button class="btn-approve" onclick="setStudentStatus('${escapeHtml(s.email)}','approved')">Approve</button>` : ""}
                ${status !== "blocked" ? `<button class="btn-block" onclick="setStudentStatus('${escapeHtml(s.email)}','blocked')">Block</button>` : ""}
                <button class="btn-reset" onclick="resetStudentAccount('${escapeHtml(s.email)}')">Reset</button>
            </td>
        </tr>
    `;
            }
        )
        .join("");
}

function setStudentStatus(email, status) {
    setStudentAccountStatus(email, status);
    renderAdminStudents();
}

function resetStudentAccount(email) {
    setStudentAccountStatus(email, "approved");
    const metaKey = "studentMeta:" + email;
    try {
        const meta = JSON.parse(localStorage.getItem(metaKey) || "{}");
        meta.recentActivity = "Account reset by admin";
        meta.lastLogin = null;
        localStorage.setItem(metaKey, JSON.stringify(meta));
    } catch (_) {}
    logAudit("student_reset", email);
    renderAdminStudents();
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Sidebar / sections
function toggleAdminSidebar() {
    const sidebar = document.getElementById("adminSidebar");
    if (sidebar) sidebar.classList.toggle("active");
}

function showAdminSection(id) {
    document.querySelectorAll(".admin-section").forEach(sec =>
        sec.classList.remove("active")
    );
    const target = document.getElementById(id);
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item =>
        item.classList.remove("active")
    );
    const nav = document.querySelector(`.nav-item[onclick="showAdminSection('${id}')"]`);
    if (nav) nav.classList.add("active");

    // Refresh data when opening specific sections
    if (id === "admin-doubts") {
        fetchAdminDoubts().then(() => renderAdminDoubts());
        // Show only pending feedback (like pending doubts)
        fetchAdminFeedback("pending").then(() => renderAdminFeedback());
    } else if (id === "admin-materials") {
        fetchAdminMaterials().then(() => renderAdminMaterials());
    } else if (id === "admin-notifications") {
        loadAdminUnifiedActivityFeed();
    }

    if (window.innerWidth <= 1024) toggleAdminSidebar();
}

function adminLogout() {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("adminName");
    localStorage.removeItem("currentAdminEmail");
    window.location.href = "index.html";
}

// ——— Study Materials (API: server + DB) ———
let adminMaterialsList = [];
let currentAdminMaterialTab = "notes";

function getAdminHeaders() {
    const h = { "Content-Type": "application/json" };
    const token = localStorage.getItem("examease_remember_token_admin");
    if (token) {
        h["X-Admin-Token"] = token;
        h["Authorization"] = "Bearer " + token;
    }
    return h;
}

async function fetchAdminMaterials() {
    try {
        const url = API_BASE ? `${API_BASE}/api/study-materials` : "/api/study-materials";
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        adminMaterialsList = await res.json();
        return adminMaterialsList;
    } catch (err) {
        console.error("Fetch study materials:", err);
        adminMaterialsList = [];
        return [];
    }
}

function getStudyMaterialsByCategory() {
    const notes = adminMaterialsList.filter((m) => m.category === "notes");
    const lectures = adminMaterialsList.filter((m) => m.category === "lectures");
    const resources = adminMaterialsList.filter((m) => m.category === "resources");
    return { notes, lectures, resources };
}

function saveMaterialSubmit(e) {
    e.preventDefault();
    const idEl = document.getElementById("materialId");
    const id = idEl && idEl.value ? idEl.value.trim() : "";
    const subject_name = document.getElementById("materialTitle").value.trim();
    const description = document.getElementById("materialDesc").value.trim();
    const category = document.getElementById("materialType").value;
    const pdfInput = document.getElementById("materialPdf");
    const links = document.getElementById("materialLinks").value.trim();
    if (!subject_name) return;

    const content = {
        notes: "",
        important_topics: [],
        examples: "",
        practice_questions: [],
        reference_links: links.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const hasContent = content.reference_links.length > 0;
    const file = pdfInput && pdfInput.files && pdfInput.files[0];

    if (id) {
        const url = API_BASE ? `${API_BASE}/api/study-materials/${id}` : `/api/study-materials/${id}`;
        const headers = getAdminHeaders();
        if (file) {
            const form = new FormData();
            form.append("subject_name", subject_name);
            form.append("description", description);
            form.append("category", category);
            form.append("pdf", file);
            if (hasContent) {
                form.append("notes", content.notes);
                form.append("important_topics", content.important_topics.join("\n"));
                form.append("examples", content.examples);
                form.append("practice_questions", content.practice_questions.join("\n"));
                form.append("reference_links", content.reference_links.join("\n"));
            }
            delete headers["Content-Type"];
            fetch(url, { method: "PUT", headers, body: form })
                .then(parseJsonResponse)
                .then((data) => {
                    if (data.message && data.message.toLowerCase().includes("fail")) throw new Error(data.message);
                    logAudit("materials_updated", "Study material updated: " + subject_name);
                    showMaterialSuccessPopup("Study material updated successfully!");
                    resetMaterialForm();
                    fetchAdminMaterials().then(() => renderAdminMaterials());
                })
                .catch((err) => {
                    console.error(err);
                    alert("Failed to update material. " + (err.message || ""));
                });
        } else {
            const body = { subject_name, description, category, content_json: hasContent ? content : null };
            fetch(url, { method: "PUT", headers, body: JSON.stringify(body) })
                .then(parseJsonResponse)
                .then((data) => {
                    if (data.message && data.message.toLowerCase().includes("fail")) throw new Error(data.message);
                    logAudit("materials_updated", "Study material updated: " + subject_name);
                    showMaterialSuccessPopup("Study material updated successfully!");
                    resetMaterialForm();
                    fetchAdminMaterials().then(() => renderAdminMaterials());
                })
                .catch((err) => {
                    console.error(err);
                    alert("Failed to update material. " + (err.message || ""));
                });
        }
        return;
    }

    const postUrl = API_BASE ? `${API_BASE}/api/study-materials` : "/api/study-materials";
    const headers = getAdminHeaders();
    if (file) {
        const form = new FormData();
        form.append("subject_name", subject_name);
        form.append("description", description);
        form.append("category", category);
        form.append("pdf", file);
        if (hasContent) {
            form.append("notes", content.notes);
            form.append("important_topics", content.important_topics.join("\n"));
            form.append("examples", content.examples);
            form.append("practice_questions", content.practice_questions.join("\n"));
            form.append("reference_links", content.reference_links.join("\n"));
        }
        delete headers["Content-Type"];
        fetch(postUrl, { method: "POST", headers, body: form })
            .then(parseJsonResponse)
            .then((data) => {
                if (data.message && data.message.toLowerCase().includes("fail")) throw new Error(data.message);
                logAudit("materials_updated", "Study material added: " + subject_name);
                showMaterialSuccessPopup("Study material uploaded successfully!");
                resetMaterialForm();
                fetchAdminMaterials().then(() => renderAdminMaterials());
            })
            .catch((err) => {
                console.error(err);
                alert("Failed to add material. " + (err.message || ""));
            });
    } else {
        const body = { subject_name, description, category, content_json: hasContent ? content : null };
        fetch(postUrl, { method: "POST", headers, body: JSON.stringify(body) })
            .then(parseJsonResponse)
            .then((data) => {
                if (data.message && data.message.toLowerCase().includes("fail")) throw new Error(data.message);
                logAudit("materials_updated", "Study material added: " + subject_name);
                showMaterialSuccessPopup("Study material uploaded successfully!");
                resetMaterialForm();
                fetchAdminMaterials().then(() => renderAdminMaterials());
            })
            .catch((err) => {
                console.error(err);
                alert("Failed to add material. " + (err.message || ""));
            });
    }
}

function parseJsonResponse(res) {
    const ct = res.headers.get("Content-Type") || "";
    return res.text().then((text) => {
        if (ct.includes("application/json")) {
            try {
                return text ? JSON.parse(text) : {};
            } catch (_) {
                throw new Error("Server returned invalid JSON.");
            }
        }
        if (!res.ok || text.trimStart().startsWith("<")) {
            const msg = !res.ok
                ? `Server error ${res.status}. ${res.status === 404 ? "Is the backend running at " + (API_BASE || window.location.origin) + "?" : ""} ${res.status === 500 ? "Check that the study_materials table exists in MySQL (run db/schema.sql)." : ""}`
                : "Server returned a page instead of JSON. Is the backend running?";
            throw new Error(msg);
        }
        try {
            return text ? JSON.parse(text) : {};
        } catch (_) {
            throw new Error("Server returned a page instead of JSON. Start the backend (npm start in otp-backend) and ensure MySQL study_materials table exists.");
        }
    });
}

function resetMaterialForm() {
    document.getElementById("materialId").value = "";
    document.getElementById("materialForm").reset();
}

function switchAdminMaterialTab(tab) {
    currentAdminMaterialTab = tab;
    document.querySelectorAll(".mat-tab").forEach((t) => t.classList.remove("active"));
    const el = document.querySelector(`.mat-tab[data-tab="${tab}"]`);
    if (el) el.classList.add("active");
    renderAdminMaterials();
}

async function editMaterial(id) {
    const url = API_BASE ? `${API_BASE}/api/study-materials/${id}` : `/api/study-materials/${id}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Not found");
        const item = await res.json();
        document.getElementById("materialId").value = item.id;
        document.getElementById("materialTitle").value = item.subject_name || "";
        document.getElementById("materialDesc").value = item.description || "";
        document.getElementById("materialType").value = item.category || "notes";
        document.getElementById("materialPdf").value = "";
        const c = item.content_json || {};
        document.getElementById("materialLinks").value = (c.reference_links || []).join("\n");
    } catch (err) {
        console.error(err);
        alert("Failed to load material.");
    }
}

function deleteMaterial(id) {
    if (!confirm("Delete this study material?")) return;
    const url = API_BASE ? `${API_BASE}/api/study-materials/${id}` : `/api/study-materials/${id}`;
    fetch(url, { method: "DELETE", headers: getAdminHeaders() })
        .then((r) => r.json())
        .then(() => {
            logAudit("materials_deleted", id);
            fetchAdminMaterials().then(() => renderAdminMaterials());
        })
        .catch((err) => {
            console.error(err);
            alert("Failed to delete.");
        });
}

function renderAdminMaterials() {
    const { notes, lectures, resources } = getStudyMaterialsByCategory();
    const arr = currentAdminMaterialTab === "notes" ? notes : currentAdminMaterialTab === "lectures" ? lectures : resources;
    const listEl = document.getElementById("adminMaterialsList");
    if (!listEl) return;
    if (!arr || arr.length === 0) {
        listEl.innerHTML = "<p style='color: rgba(255,255,255,0.5); font-size: 13px;'>No items. Add one from the form.</p>";
        return;
    }
    listEl.innerHTML = arr
        .map(
            (item) => `
        <div class="material-row-admin">
            <span>${escapeHtml(item.subject_name)}</span>
            <span class="mat-date">${item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</span>
            <div class="mat-actions">
                <button onclick="editMaterial(${item.id})" title="Edit"><i class='bx bx-edit'></i></button>
                <button onclick="deleteMaterial(${item.id})" class="delete" title="Delete"><i class='bx bx-trash'></i></button>
            </div>
        </div>
    `
        )
        .join("");
}

// ——— Doubts (from API: DB) ———
let adminDoubtsList = [];

function getDoubts() {
    return adminDoubtsList;
}

function fetchAdminDoubts() {
    const url = API_BASE ? `${API_BASE}/api/doubts?status=pending` : "/api/doubts?status=pending";
    return fetch(url)
        .then(res => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
        .then(list => {
            adminDoubtsList = Array.isArray(list) ? list : [];
            return adminDoubtsList;
        })
        .catch(err => {
            console.error("Fetch admin doubts error:", err);
            adminDoubtsList = [];
            return adminDoubtsList;
        });
}

function renderAdminDoubts() {
    const doubts = getDoubts();
    const listEl = document.getElementById("adminDoubtsList");
    if (!listEl) return;
    if (!doubts || doubts.length === 0) {
        listEl.innerHTML = "<p style='color: rgba(255,255,255,0.5);'>No doubts from students yet.</p>";
        return;
    }
    listEl.innerHTML = doubts.map(d => {
        const hasAnswer = d.answer && String(d.answer).trim();
        const created = d.created_at ? new Date(d.created_at).toLocaleString() : "";
        return `
        <div class="doubt-block-admin ${hasAnswer ? "" : "unanswered"}">
            <div class="doubt-q">${escapeHtml(d.q || d.question)}</div>
            <div class="doubt-meta">${escapeHtml(d.subject || d.category || "")} · ${escapeHtml(d.student_name || d.author || "Student")} · ${created}</div>
            ${hasAnswer ? `<p style="color: rgba(255,255,255,0.8); font-size: 13px; margin-bottom: 8px;"><strong>Your answer:</strong> ${escapeHtml(d.answer)}</p>` : ""}
            <textarea id="doubtAnswer_${d.id}" placeholder="Type your answer here...">${(d.answer || "").replace(/</g, "&lt;")}</textarea>
            <button type="button" class="answer-btn" onclick="submitDoubtAnswer('${d.id}')"><i class='bx bx-send'></i> ${hasAnswer ? "Update" : "Submit"} Answer</button>
        </div>
    `;
    }).join("");
}

function submitDoubtAnswer(id) {
    const ta = document.getElementById("doubtAnswer_" + id);
    if (!ta || !ta.value.trim()) return;
    const answerText = ta.value.trim();
    const url = API_BASE ? `${API_BASE}/api/doubts/${id}/answer` : `/api/doubts/${id}/answer`;
    const token = localStorage.getItem("examease_remember_token_admin");
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
    fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ answer: answerText, adminName: localStorage.getItem("adminName") || "Admin" })
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.doubt) {
                logAudit("doubt_answered", id);
            }
            fetchAdminDoubts().then(() => renderAdminDoubts());
        })
        .catch(err => {
            console.error("Submit doubt answer error:", err);
            alert("Failed to save answer. " + (err.message || ""));
        });
}

// ——— Doubts & Feedback Management tabs ———
function initDoubtsFeedbackTabs() {
    document.querySelectorAll(".df-tab").forEach(tab => {
        tab.addEventListener("click", function () {
            const t = this.getAttribute("data-tab");
            document.querySelectorAll(".df-tab").forEach(x => x.classList.remove("active"));
            document.querySelectorAll(".df-panel").forEach(p => p.classList.remove("active"));
            this.classList.add("active");
            const panel = document.getElementById(t === "pending-doubts" ? "panel-pending-doubts" : "panel-student-feedback");
            if (panel) panel.classList.add("active");
            // Always refresh when switching tabs to show latest data
            if (t === "pending-doubts") {
                fetchAdminDoubts().then(() => renderAdminDoubts());
            } else if (t === "student-feedback") {
                // Show only pending feedback by default (like doubts)
                fetchAdminFeedback("pending").then(() => renderAdminFeedback());
            }
        });
    });
}

// ——— Student Feedback (admin list + reply) ———
let adminFeedbackList = [];

function fetchAdminFeedback(statusFilter = "pending") {
    const statusParam = statusFilter && statusFilter !== "all" ? `&status=${statusFilter}` : "";
    const url = API_BASE ? `${API_BASE}/api/feedback?list=all${statusParam}` : `/api/feedback?list=all${statusParam}`;
    return fetch(url)
        .then(res => (res.ok ? res.json() : []))
        .then(list => {
            adminFeedbackList = Array.isArray(list) ? list : [];
            return adminFeedbackList;
        })
        .catch(err => {
            console.error("Fetch admin feedback error:", err);
            adminFeedbackList = [];
            return adminFeedbackList;
        });
}

function renderAdminFeedback() {
    const listEl = document.getElementById("adminFeedbackList");
    if (!listEl) return;
    if (!adminFeedbackList.length) {
        listEl.innerHTML = "<p style='color: rgba(255,255,255,0.88);'>No pending student feedback.</p>";
        return;
    }
    listEl.innerHTML = adminFeedbackList.map(f => {
        const created = f.created_at ? new Date(f.created_at).toLocaleString() : "";
        const stars = "★".repeat(f.rating || 0) + "☆".repeat(5 - (f.rating || 0));
        const hasReply = f.admin_reply && String(f.admin_reply).trim();
        const status = (f.status || "pending").toLowerCase();
        const isAnswered = status === "reviewed" || status === "resolved";
        return `
        <div class="feedback-block-admin ${isAnswered ? "" : "unanswered"}">
            <div class="fb-head">
                <span class="fb-student">${escapeHtml(f.student_name || f.student_email || "Student")}</span>
                <span class="fb-meta">${escapeHtml(f.category || "")} · ${stars} · ${escapeHtml(created)}</span>
            </div>
            <div class="fb-msg">${escapeHtml(f.message || "")}</div>
            ${hasReply ? `<div class="fb-admin-reply"><strong>Your response:</strong> ${escapeHtml(f.admin_reply)}</div>` : ""}
            ${!isAnswered ? `<textarea id="fbReply_${f.id}" placeholder="Acknowledgment, clarification, or resolution message...">${(f.admin_reply || "").replace(/</g, "&lt;")}</textarea>
            <div class="fb-actions">
                <select id="fbStatus_${f.id}">
                    <option value="reviewed" ${status === "reviewed" ? "selected" : ""}>Reviewed</option>
                    <option value="resolved" ${status === "resolved" ? "selected" : ""}>Resolved</option>
                </select>
                <button type="button" class="submit-fb-btn" onclick="submitFeedbackReply('${f.id}')"><i class='bx bx-send'></i> ${hasReply ? "Update" : "Send"} Response</button>
            </div>` : `<div class="fb-status-badge"><span class="fb-status">${status === "resolved" ? "Resolved" : "Reviewed"}</span></div>`}
        </div>
    `;
    }).join("");
}

function submitFeedbackReply(id) {
    const ta = document.getElementById("fbReply_" + id);
    const statusEl = document.getElementById("fbStatus_" + id);
    if (!ta) return;
    const adminReply = ta.value.trim();
    if (!adminReply) {
        alert("Please enter a response message.");
        return;
    }
    // Default to "reviewed" if status not selected, or use selected status
    const status = statusEl ? statusEl.value : "reviewed";
    const url = API_BASE ? `${API_BASE}/api/feedback/${id}` : `/api/feedback/${id}`;
    const token = localStorage.getItem("examease_remember_token_admin");
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
    fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status, adminReply })
    })
        .then(res => res.json())
        .then(data => {
            logAudit("feedback_responded", id);
            // Refresh pending feedback list - answered ones will disappear
            fetchAdminFeedback("pending").then(() => renderAdminFeedback());
        })
        .catch(err => {
            console.error("Submit feedback reply error:", err);
            alert("Failed to update feedback. " + (err.message || ""));
        });
}

// ——— Reporting ———
function renderReporting() {
    const students = getStoredStudents();
    const results = JSON.parse(localStorage.getItem("userResults") || "[]");
    const loginHistory = JSON.parse(localStorage.getItem(KEY_LOGIN_HISTORY) || "[]");
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeEmails = new Set(loginHistory.filter(h => new Date(h.time).getTime() > weekAgo).map(h => h.email || h.user));
    const reportActiveThisWeek = document.getElementById("reportActiveThisWeek");
    const reportTotalStudents = document.getElementById("reportTotalStudents");
    if (reportTotalStudents) reportTotalStudents.textContent = students.length;
    if (reportActiveThisWeek) reportActiveThisWeek.textContent = activeEmails.size;

    const passed = results.filter(r => (r.score || 0) >= 40).length;
    const passPct = results.length ? Math.round((passed / results.length) * 100) : 0;
    const reportPassPct = document.getElementById("reportPassPct");
    if (reportPassPct) reportPassPct.textContent = passPct + "%";

    const reportTrendsHint = document.getElementById("reportTrendsHint");
    if (reportTrendsHint) reportTrendsHint.textContent = results.length >= 2 ? "Score trend: compare recent vs older results in Results section." : "Complete more exams to see score trends over time.";

    const examPerf = document.getElementById("reportExamPerformance");
    if (examPerf) {
        const exams = adminExamPapers || [];
        examPerf.innerHTML = exams.length ? exams.map(e => `${escapeHtml(e.title || e.name || "Untitled")}: ${e.is_active === 1 ? "Active" : "Inactive"}`).join("<br>") : "No exams yet.";
    }
}

function postAnnouncementSubmit(e) {
    e.preventDefault();
    const title = document.getElementById("announcementTitle").value.trim();
    const message = document.getElementById("announcementMessage").value.trim();
    const categoryEl = document.getElementById("announcementCategory");
    const linkEl = document.getElementById("announcementLink");
    const category = categoryEl ? categoryEl.value : "general";
    const link = linkEl ? linkEl.value.trim() : "";
    if (!title || !message) return;

    const base = API_BASE || "";
    const url = `${base}/api/announcements`;
    const headers = { "Content-Type": "application/json" };
    const token = getAdminToken();
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
    const payload = {
        title,
        description: message,
        category,
        link_url: link || null
    };

    fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
    })
        .then(res => res.json().then(d => ({ ok: res.ok, status: res.status, data: d })))
        .then(r => {
            if (!r.ok) {
                const msg = (r.data && r.data.message) || (r.data && r.data.error) || "Failed to create announcement.";
                throw new Error(msg + " (Status: " + r.status + ")");
            }
            document.getElementById("announcementForm").reset();
            logAudit("announcement_posted", title);
            showMaterialSuccessPopup("Announcement posted and sent to students.");
            renderAnnouncements(); // refresh list from API
        })
        .catch(err => {
            console.error("Create announcement error:", err);
            alert("Failed to create announcement.\n\nError: " + (err.message || String(err)));
        });
}

function renderAnnouncements() {
    const el = document.getElementById("announcementsList");
    if (!el) return;
    const base = API_BASE || "";
    fetch(`${base}/api/announcements/admin`)
        .then(res => (res.ok ? res.json() : []))
        .then(list => {
            const arr = Array.isArray(list) ? list : [];
            if (!arr.length) {
                el.innerHTML = "<p style='color: rgba(255,255,255,0.5); font-size: 13px;'>No announcements yet.</p>";
                return;
            }
            el.innerHTML = arr.slice(0, 20).map(a => `
        <div class="announcement-item announcement-item-admin">
            <div class="announcement-item-head">
                <h4>${escapeHtml(a.title)}</h4>
                <button type="button" class="announcement-delete-btn" onclick="deleteAnnouncement(${a.id})" title="Delete announcement"><i class='bx bx-trash'></i></button>
            </div>
            <p>${escapeHtml(a.description)}${a.link_url ? " · <a href='" + escapeHtml(a.link_url) + "' target='_blank' rel='noopener'>View</a>" : ""}</p>
            <p style="font-size:11px; color: rgba(255,255,255,0.5);">${a.category ? ("Category: " + escapeHtml(String(a.category))) : ""} · ${a.created_at ? new Date(a.created_at).toLocaleString() : ""}</p>
        </div>
    `).join("");
        })
        .catch(err => {
            console.error("Load announcements error:", err);
            el.innerHTML = "<p style='color: rgba(255,255,255,0.5); font-size: 13px;'>Failed to load announcements.</p>";
        });
}

function deleteAnnouncement(id) {
    if (id == null || id === "") return;
    if (!confirm("Delete this announcement? It will disappear from the student dashboard (including Upcoming Exams) for everyone.")) return;
    const base = API_BASE || "";
    const url = `${base}/api/announcements/${encodeURIComponent(id)}`;
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("examease_remember_token_admin");
    if (token) {
        headers["X-Admin-Token"] = token;
        headers["Authorization"] = "Bearer " + token;
    }
    fetch(url, { method: "DELETE", headers })
        .then(async (res) => {
            const text = await res.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (_) {
                data = { message: text || res.statusText || "Delete failed" };
            }
            return { ok: res.ok, data };
        })
        .then(({ ok, data }) => {
            if (!ok) throw new Error((data && data.message) || "Delete failed");
            logAudit("announcement_deleted", String(id));
            showMaterialSuccessPopup("Announcement deleted.");
            renderAnnouncements();
            if (typeof loadAdminUnifiedActivityFeed === "function") loadAdminUnifiedActivityFeed();
        })
        .catch(err => {
            console.error("Delete announcement error:", err);
            alert(err.message || "Failed to delete announcement.");
        });
}

window.deleteAnnouncement = deleteAnnouncement;

// ——— Login history & Audit ———
function renderLoginHistory() {
    const history = JSON.parse(localStorage.getItem(KEY_LOGIN_HISTORY) || "[]");
    const el = document.getElementById("loginHistoryList");
    if (!el) return;
    if (history.length === 0) {
        el.innerHTML = "<p class='audit-item'>No login history yet.</p>";
        return;
    }
    el.innerHTML = history.slice(0, 50).map(h => `
        <div class="audit-item">
            ${escapeHtml(h.email || h.user || "—")} · ${h.role || "user"} <span class="audit-time">${h.time ? new Date(h.time).toLocaleString() : ""}</span>
        </div>
    `).join("");
}

function renderAuditLog() {
    const log = JSON.parse(localStorage.getItem(KEY_AUDIT_LOG) || "[]");
    const el = document.getElementById("auditLogList");
    if (!el) return;
    if (log.length === 0) {
        el.innerHTML = "<p class='audit-item'>No audit entries yet.</p>";
        return;
    }
    el.innerHTML = log.slice(0, 80).map(a => `
        <div class="audit-item">
            ${escapeHtml(a.action)} ${escapeHtml(a.detail)} <span class="audit-time">${a.time ? new Date(a.time).toLocaleString() : ""} · ${escapeHtml(a.who || "")}</span>
        </div>
    `).join("");
}

function loadAdminUnifiedActivityFeed() {
    const el = document.getElementById("adminUnifiedActivityFeed");
    if (!el) return;
    el.innerHTML = "<p class=\"activity-feed-empty\">Loading activity…</p>";
    const base = API_BASE || "";
    const doubtUrl = `${base}/api/doubts?status=all`;
    const fbUrl = `${base}/api/feedback?list=all`;
    const annUrl = `${base}/api/announcements/admin`;

    Promise.all([
        fetch(doubtUrl).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(fbUrl).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(annUrl).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([doubts, feedback, announcements]) => {
        const items = [];
        (Array.isArray(doubts) ? doubts : []).forEach(d => {
            const q = d.question || d.q || "";
            if (!String(q).trim()) return;
            const st = (d.status || "pending").toLowerCase();
            const statusClass = st === "answered" ? "done" : "open";
            items.push({
                ts: d.created_at ? new Date(d.created_at).getTime() : 0,
                block: `
                <div class="activity-feed-item activity-feed-doubt">
                    <span class="activity-feed-badge">Doubt</span>
                    <span class="activity-feed-status ${statusClass}">${escapeHtml(d.status || "pending")}</span>
                    <div class="activity-feed-title">${escapeHtml(String(q).length > 220 ? String(q).slice(0, 220) + "…" : String(q))}</div>
                    <div class="activity-feed-meta">${escapeHtml(d.subject || "")} · ${escapeHtml(d.student_name || d.student_email || "Student")} · ${d.created_at ? new Date(d.created_at).toLocaleString() : ""}</div>
                    ${d.answer && String(d.answer).trim() ? `<div class="activity-feed-body"><strong>Answer:</strong> ${escapeHtml(String(d.answer).length > 400 ? String(d.answer).slice(0, 400) + "…" : String(d.answer))}</div>` : ""}
                </div>`,
            });
        });
        (Array.isArray(feedback) ? feedback : []).forEach(f => {
            const msg = f.message || "";
            if (!String(msg).trim()) return;
            const st = (f.status || "pending").toLowerCase();
            const statusClass = st === "pending" ? "open" : "done";
            const stars = "★".repeat(f.rating || 0) + "☆".repeat(5 - (f.rating || 0));
            items.push({
                ts: f.created_at ? new Date(f.created_at).getTime() : 0,
                block: `
                <div class="activity-feed-item activity-feed-feedback">
                    <span class="activity-feed-badge">Feedback</span>
                    <span class="activity-feed-status ${statusClass}">${escapeHtml(f.status || "pending")}</span>
                    <div class="activity-feed-title">${escapeHtml(String(msg).length > 220 ? String(msg).slice(0, 220) + "…" : String(msg))}</div>
                    <div class="activity-feed-meta">${escapeHtml(f.student_name || f.student_email || "Student")} · ${escapeHtml(f.category || "")} · ${stars} · ${f.created_at ? new Date(f.created_at).toLocaleString() : ""}</div>
                    ${f.admin_reply && String(f.admin_reply).trim() ? `<div class="activity-feed-body"><strong>Admin:</strong> ${escapeHtml(String(f.admin_reply).length > 400 ? String(f.admin_reply).slice(0, 400) + "…" : String(f.admin_reply))}</div>` : ""}
                </div>`,
            });
        });
        (Array.isArray(announcements) ? announcements : []).forEach(a => {
            const title = a.title || "Announcement";
            items.push({
                ts: a.created_at ? new Date(a.created_at).getTime() : 0,
                block: `
                <div class="activity-feed-item activity-feed-announcement">
                    <span class="activity-feed-badge">Announcement</span>
                    <div class="activity-feed-title">${escapeHtml(title)}</div>
                    <div class="activity-feed-meta">${escapeHtml(a.category || "general")} · ${a.created_at ? new Date(a.created_at).toLocaleString() : ""}${a.created_by_name ? " · " + escapeHtml(a.created_by_name) : ""}</div>
                    ${a.description ? `<div class="activity-feed-body">${escapeHtml(String(a.description).length > 500 ? String(a.description).slice(0, 500) + "…" : String(a.description))}</div>` : ""}
                    ${a.link_url ? `<div class="activity-feed-meta"><a href="${escapeHtml(a.link_url)}" target="_blank" rel="noopener" style="color:#5bc0de;">Open link</a></div>` : ""}
                </div>`,
            });
        });
        items.sort((a, b) => b.ts - a.ts);
        const slice = items.slice(0, 100);
        el.innerHTML = slice.length
            ? slice.map(i => i.block).join("")
            : "<p class=\"activity-feed-empty\">No activity yet. Student doubts, feedback, and announcements will appear here.</p>";
    });
}

