// frontend/js/pages/register.js
import { api } from "/js/api/client.js";
import { clearFormErrors, setButtonLoading, showFormErrors } from "/js/components/ui.js";

const form = document.getElementById("register-form");
const fullNameInput = document.getElementById("fullName");
const businessNameInput = document.getElementById("businessName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const togglePasswordBtn = document.getElementById("toggle-password");
const toggleConfirmPasswordBtn = document.getElementById("toggle-confirm-password");
const submitBtn = document.getElementById("submit-btn");

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,72}$/;

// Toggle password visibility
togglePasswordBtn.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password");
  passwordInput.type = isPassword ? "text" : "password";
  togglePasswordBtn.querySelector("i").className = isPassword
    ? "bi bi-eye-slash"
    : "bi bi-eye";
  togglePasswordBtn.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password"
  );
});
toggleConfirmPasswordBtn.addEventListener("click", () => {
  const isPassword = confirmPasswordInput.type === "password");
  confirmPasswordInput.type = isPassword ? "text" : "password";
  toggleConfirmPasswordBtn.querySelector("i").className = isPassword
    ? "bi bi-eye-slash"
    : "bi bi-eye";
  toggleConfirmPasswordBtn.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password"
  );
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormErrors(form);

  // Gather values
  const fullName = fullNameInput.value.trim();
  const businessName = businessNameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Client-side validation (server validates too)
  const fields = {};
  if (fullName.length < 2 || fullName.length > 100) {
    fields.fullName = "Full name must be 2-100 characters.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = "Enter a valid email address.";
  } else if (email.length > 255) {
    fields.email = "Email must be 255 characters or less.";
  }
  if (!PASSWORD_REGEX.test(password)) {
    fields.password =
      "Password must be 8-72 characters and contain at least one letter and one number.";
  }
  if (password !== confirmPassword) {
    fields.confirmPassword = "Passwords do not match.";
  }
  if (Object.keys(fields).length > 0) {
    showFormErrors(form, { fields });
    return;
  }

  // Default business name if empty
  const finalBusinessName = businessName || `${fullName}'s Business`;

  setButtonLoading(submitBtn, true);
  try {
    await api.post("/api/auth/register", {
      fullName,
      businessName: finalBusinessName,
      email,
      password,
    });
    // Success: session cookie set via httpOnly
    window.location.href = "/dashboard";
  } catch (err) {
    // If the error contains field-level details, show them
    if (err.details && err.details.fields) {
      showFormErrors(form, err.details);
    } else {
      // Otherwise show a generic message (should be rare)
      alert(err.message || "Registration failed. Please try again.");
    }
  } finally {
    setButtonLoading(submitBtn, false);
  }
});