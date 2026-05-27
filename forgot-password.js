document.addEventListener("DOMContentLoaded", function () {
  // Role from URL (student or admin) - set when coming from login page
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get("role") || "student";
  const isAdmin = role === "admin";

  const titleEl = document.getElementById("forgotPageTitle");
  const subtitleEl = document.getElementById("forgotPageSubtitle");
  const backLink = document.getElementById("backToLoginLink");
  if (titleEl) titleEl.textContent = isAdmin ? "Admin – Forgot Password" : "Student – Forgot Password";
  if (subtitleEl) subtitleEl.textContent = isAdmin ? "Enter your admin email to receive an OTP." : "Enter your email to receive an OTP.";
  if (backLink) backLink.href = "index.html?role=" + role;
  document.title = (isAdmin ? "Admin – " : "Student – ") + "Forgot Password - ExamEase";

  document.getElementById("sendOtpForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = document.getElementById("email").value;
      localStorage.setItem("resetEmail", email); // Store email for password reset

      try {
          const response = await fetch("http://localhost:5000/send-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email })
          });
          const data = await response.json();
          if (typeof showAlert === "function") showAlert(data.message, response.ok ? "success" : "error");
          if (response.ok) {
              document.getElementById("otpSection").classList.remove("hidden");
          }
      } catch (error) {
          if (typeof showAlert === "function") showAlert("Error sending OTP!", "error");
      }
  });

  document.getElementById("verifyOtpForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const email = localStorage.getItem("resetEmail");
      const otpInput = document.getElementById("otpInput").value;

      try {
          const response = await fetch("http://localhost:5000/verify-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, otp: otpInput })
          });
          const data = await response.json();
          if (typeof showAlert === "function") showAlert(data.message, response.ok ? "success" : "error");
          if (response.ok) {
              setTimeout(() => {
                  window.location.href = "reset-password.html?role=" + role;
              }, 2000); // Small delay so user can see the success message
          }
      } catch (error) {
          if (typeof showAlert === "function") showAlert("Error verifying OTP!", "error");
      }
  });
});
