// frontend/js/pages/login.js
import { api } from "/js/api/client.js";
import { clearFormErrors, setButtonLoading, showFormErrors } from "/js/components/ui.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("toggle-password");
const submitBtn = document.getElementById("submit-btn");
const serverAlert = document.getElementById("server-error");

// Toggle password visibility
togglePasswordBtn.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePasswordBtn.querySelector("i").className = isPassword
    ? "bi bi-eye-slash"
    : "bi bi-eye";
  togglePasswordBtn.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password"
  );
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormErrors(form);
  serverAlert.classList.add("d-none");

  // Basic client-side validation (server validates too)
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const fields = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = "Enter a valid email address.";
  }
  if (password.length === 0) {
    fields.password = "Enter your password.";
  }
  if (Object.keys(fields).length > 0) {
    showFormErrors(form, { fields });
    return;
  }

  setButtonLoading(submitBtn, true);
  try {
    await api.post("/api/auth/login", { email, password });
    // Success: session cookie set via httpOnly
    window.location.href = "/dashboard";
  } catch (err) {
    // API returns a generic message for bad credentials
    serverAlert.textContent = err.message || "Login failed. Please try again.";
    serverAlert.classList.remove("d-none");
  } finally {
    setButtonLoading(submitBtn, false);
  }
});