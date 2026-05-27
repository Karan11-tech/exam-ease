document.addEventListener("DOMContentLoaded", () => {
    const progressList = document.getElementById("progress-list");
    const progressData = JSON.parse(localStorage.getItem("combinedProgress")) || [];

    const portals = {
        Beginner: [],
        Intermediate: [],
        Advanced: []
    };

    // Categorize entries by portal
    progressData.forEach(entry => {
        if (portals[entry.portal]) {
            portals[entry.portal].push({
                topic: entry.topic,
                completedAt: entry.completedAt || new Date().toISOString()
            });
        }
    });

    // Display grouped progress with date/time
    Object.entries(portals).forEach(([portalName, entries]) => {
        if (entries.length > 0) {
            const portalHeader = document.createElement("h2");
            portalHeader.innerText = `${portalName} Portal`;
            progressList.appendChild(portalHeader);

            const ul = document.createElement("ul");
            entries.forEach(({ topic, completedAt }) => {
                const li = document.createElement("li");

                const date = new Date(completedAt);
                const formattedDate = date.toLocaleDateString();
                const formattedTime = date.toLocaleTimeString();

                li.innerHTML = `<strong>${topic.toUpperCase()}</strong>
                                <br><span class="timestamp">Completed on ${formattedDate} at ${formattedTime}</span>`;
                ul.appendChild(li);
            });

            progressList.appendChild(ul);
        }
    });

    // Create single reusable alert box
    const alertBox = document.createElement("div");
    alertBox.id = "custom-alert";
    alertBox.style.position = "fixed";
    alertBox.style.bottom = "30px";
    alertBox.style.left = "50%";
    alertBox.style.transform = "translateX(-50%) translateY(30px)";
    alertBox.style.backgroundColor = "#28a745";
    alertBox.style.color = "#ffffff";
    alertBox.style.padding = "15px 30px";
    alertBox.style.borderRadius = "8px";
    alertBox.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    alertBox.style.fontSize = "16px";
    alertBox.style.zIndex = "1000";
    alertBox.style.opacity = "0";
    alertBox.style.transition = "opacity 0.4s ease, transform 0.4s ease";
    alertBox.style.display = "none";

    document.body.appendChild(alertBox);
});

// Reusable custom alert function
function showCustomAlert(message) {
    const alertBox = document.getElementById("custom-alert");
    alertBox.innerText = message;
    alertBox.style.display = "block";

    // Animate in
    requestAnimationFrame(() => {
        alertBox.style.opacity = "1";
        alertBox.style.transform = "translateX(-50%) translateY(0)";
    });

    // Animate out after 4 seconds
    setTimeout(() => {
        alertBox.style.opacity = "0";
        alertBox.style.transform = "translateX(-50%) translateY(30px)";
    }, 4000);

    // Fully hide after animation
    setTimeout(() => {
        alertBox.style.display = "none";
    }, 4500);
}

// Clear progress function
function clearProgress() {
    showCustomAlert("Progress will be cleared...");

    setTimeout(() => {
        localStorage.removeItem("combinedProgress");
        showCustomAlert("Progress Cleared Successfully!");
        // Optionally you can also reload the page to reflect changes
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }, 1000);
}

// Go back function
function goBack() {
    window.history.back();
}
