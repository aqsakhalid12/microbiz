// frontend/js/components/ui.js
// Reusable UI helpers for alerts, forms, loading states, formatting, and escaping.
import { api } from "/js/api/client.js";

/**
 * Show a Bootstrap toast in the toast container.
 * @param {"success"|"danger"|"warning"|"info"} type - visual style
 * @param {string} message - message to display
 */
export function showToast(type, message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  // Create toast element
  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${escapeHtml(String(message ?? ""))}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto"
              data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;

  // Add to container
  container.appendChild(toastEl);

  // Initialize and show toast (Bootstrap 5)
  let toast = null;
  if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
    toast = bootstrap.Toast.getOrCreateInstance(toastEl, {
      autohide: true,
      delay: 4000,
    });
    toast.show();
  } else {
    toastEl.classList.add("show");
    setTimeout(() => {
      toastEl.remove();
    }, 4000);
  }

  // Remove from DOM when hidden to avoid buildup
  toastEl.addEventListener("hidden.bs.toast", () => {
    if (toast && typeof toast.dispose === "function") {
      try { toast.dispose(); } catch (e) { /* ignore */ }
    }
    toastEl.remove();
  });
}

/**
 * Set a button to loading state (show spinner, disable).
 * @param {HTMLButtonElement} button - the button element
 * @param {boolean} isLoading - true to show loading, false to restore
 */
export function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    // Store original content so we can restore it
    button.dataset.originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Please wait…
    `;
  } else {
    button.disabled = false;
    if (button.dataset.originalContent) {
      button.innerHTML = button.dataset.originalContent;
      delete button.dataset.originalContent;
    }
  }
}

/**
 * Render an empty state illustration into a container.
 * @param {HTMLElement} container - element to fill
 * @param {{icon: string, title: string, text: string}} opts
 *   icon: Bootstrap Icons class (e.g. "bi-bar-chart")
 *   title: heading text
 *   text: body text
 */
export function renderEmptyState(container, {icon, title, text, actionLabel, onAction}) {
  if (!container) return;
  const actionHtml = actionLabel
    ? `<button type="button" class="btn btn-sm btn-outline-secondary mt-2 empty-state-action">${escapeHtml(actionLabel)}</button>`
    : "";
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon"><i class="bi ${icon}"></i></div>
      <p class="empty-state-title">${escapeHtml(title)}</p>
      <p class="empty-state-text mb-0">${escapeHtml(text)}</p>
      ${actionHtml}
    </div>`;
  if (actionLabel && typeof onAction === "function") {
    const btn = container.querySelector(".empty-state-action");
    if (btn) btn.addEventListener("click", onAction);
  }
}

/**
 * Render skeleton placeholders into a container.
 * @param {HTMLElement} container - element to fill
 * @param {number} count - number of skeleton lines to show (default 3)
 */
export function renderSkeleton(container, count = 3) {
  if (!container) return;
  const lines = [];
  for (let i = 0; i < count; i++) {
    // Vary width for a more natural look
    const width = i === count - 1 ? "60%" : "100%";
    lines.push(`<div class="skeleton-line mb-2" style="width: ${width};"></div>`);
  }
  container.innerHTML = lines.join("");
}

/**
 * Show field-level validation errors from an API response.
 * Expects `details.fields` to be an object mapping field names to messages.
 * Adds Bootstrap's `is-invalid` class and populates `.invalid-feedback`.
 * @param {HTMLFormElement} form - the form element
 * @param {{fields: { [fieldName]: string }}} details - error details from API
 */
export function showFormErrors(form, details) {
  clearFormErrors(form); // clear any existing errors first
  const fields = (details && details.fields) || {};
  for (const [key, message] of Object.entries(fields)) {
    // Convert snake_case (from API) to camelCase (form input names)
    const camelKey = key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
    // Try camelCase first, then fall back to snake_case in case the form uses it
    const input =
      form.querySelector(`[name="${camelKey}"]`) ||
      form.querySelector(`[name="${key}"]`);
    if (!input) continue;

    input.classList.add("is-invalid");
    const feedback = input.closest(".mb-3")?.querySelector(".invalid-feedback");
    if (feedback) {
      feedback.textContent = message;
    }
  }
}

/**
 * Clear all field-level validation errors from a form.
 * Removes `is-invalid` class and empties `.invalid-feedback` elements.
 * @param {HTMLFormElement} form - the form element
 */
export function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  form.querySelectorAll(".invalid-feedback").forEach((el) => (el.textContent = ""));
}

/**
 * Escape HTML special characters to prevent XSS when inserting user-provided
 * text into the DOM via innerHTML.
 * @param {string} text - the string to escape
 * @returns {string} escaped string safe for HTML context
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format a number as currency using Intl.NumberFormat.
 * @param {number|string} amount - the numeric amount
 * @param {string} currencyCode - ISO 4217 code (e.g., "USD", "EUR")
 * @returns {string} formatted currency string
 */
export function formatCurrency(amount, currencyCode) {
  try {
    const num = Number(amount);
    if (isNaN(num)) return "";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "USD",
    }).format(num);
  } catch {
    // Fallback: simple concatenation
    return `${amount} ${currencyCode || ""}`.trim();
  }
}

/* ==== Modal focus management ==== */

/* Element that opened each modal, so focus can be handed back to it. */
const modalOpeners = new WeakMap();
let modalFocusManagerInstalled = false;

/**
 * Move focus out of a modal that is being closed.
 * Falls back to the control that opened the modal; if that control is gone
 * the focused element is blurred so nothing stays focused inside a modal
 * that is hidden from assistive technology.
 * @param {HTMLElement} modalEl - the modal element
 * @param {HTMLElement|null} opener - element that opened the modal
 */
function restoreModalFocus(modalEl, opener) {
  if (opener && document.contains(opener) && typeof opener.focus === "function") {
    opener.focus({ preventScroll: true });
  }
  if (modalEl.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

/**
 * Install focus management for Bootstrap modals (once per page).
 *
 * Bootstrap hides a modal by setting `aria-hidden="true"` on the modal
 * element once the fade-out transition finished. When a descendant of the
 * modal still holds focus at that moment the browser refuses the change and
 * logs "Blocked aria-hidden on an element because its descendant retained
 * focus"; focus is also left on a hidden element instead of returning to the
 * control that opened the modal.
 *
 * This helper remembers the control that opened each modal and gives focus
 * back to it while the modal is closing, so focus is never left inside a
 * hidden modal.
 */
export function initModalFocus() {
  if (modalFocusManagerInstalled) return;
  modalFocusManagerInstalled = true;

  // Remember the control that had focus before the modal opened.
  document.addEventListener("show.bs.modal", (event) => {
    const modalEl = event.target;
    const active = document.activeElement;
    if (active && active !== document.body && !modalEl.contains(active)) {
      modalOpeners.set(modalEl, active);
    }
  });

  // Give focus back while the modal is still visible. The update is deferred
  // by one tick because Bootstrap releases its focus trap right after this
  // event, and the trap would otherwise pull focus back into the modal.
  document.addEventListener("hide.bs.modal", (event) => {
    const modalEl = event.target;
    const opener = modalOpeners.get(modalEl);
    queueMicrotask(() => restoreModalFocus(modalEl, opener));
  });

  // Safety net: never leave focus inside a modal that is hidden.
  document.addEventListener("hidden.bs.modal", (event) => {
    const modalEl = event.target;
    if (modalEl.contains(document.activeElement)) {
      restoreModalFocus(modalEl, modalOpeners.get(modalEl));
    }
  });
}

/**
 * Format a date using Intl.DateTimeFormat (date style only).
 * @param {string|Date} date - date string or Date object
 * @returns {string} formatted date (e.g., "Oct 12, 2026")
 */
export function formatDate(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return "—";
  }
}