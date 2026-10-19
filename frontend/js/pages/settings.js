// frontend/js/pages/settings.js
// Entry point for the Settings page.
import { api } from "/js/api/client.js";
import {
  showToast,
  setButtonLoading,
  showFormErrors,
  clearFormErrors,
  escapeHtml,
} from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

const $ = (id) => document.getElementById(id);

function validateSettings(form) {
  const business_name = form.business_name.value;
  const email = form.email.value.trim();
  const threshold = form.default_low_stock_threshold.value;

  const fields = {};

  if (!business_name || business_name.trim().length === 0) {
    fields.business_name = "Business name is required.";
  } else if (business_name.trim().length > 150) {
    fields.business_name = "Business name must be at most 150 characters.";
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      fields.email = "Email must be a valid email address.";
    } else if (email.length > 255) {
      fields.email = "Email must be at most 255 characters.";
    }
  }

  if (threshold === "" || threshold === null || threshold === undefined) {
    fields.default_low_stock_threshold = "Default low stock threshold is required.";
  } else {
    const num = Number(threshold);
    if (!Number.isInteger(num) || isNaN(num)) {
      fields.default_low_stock_threshold = "Default low stock threshold must be an integer.";
    } else if (num < 0 || num > 100000) {
      fields.default_low_stock_threshold = "Default low stock threshold must be between 0 and 100000.";
    }
  }

  if (Object.keys(fields).length > 0) {
    return { valid: false, fields };
  }
  return { valid: true };
}

async function loadSettings() {
  const loading = $("settings-loading");
  const form = $("settings-form");
  const status = $("settings-status");
  status.textContent = "";

  try {
    const response = await api.get("/api/settings");
    const data = response && response.data ? response.data : response;

    $("business_name").value = data.business_name || "";
    $("email").value = data.email || "";
    $("phone").value = data.phone || "";
    $("address").value = data.address || "";
    $("currency_code").value = data.currency_code || "USD";
    const thr = data.default_low_stock_threshold;
    $("default_low_stock_threshold").value = (thr === null || thr === undefined) ? "" : thr;

    if (loading) loading.style.display = "none";
    if (form) form.style.display = "";
  } catch (err) {
    if (loading) loading.style.display = "none";
    const container = loading || document.querySelector(".card-body");
    if (container) {
      const div = document.createElement("div");
      div.className = "alert alert-danger d-flex align-items-center justify-content-between";
      div.innerHTML = `
        <span>${escapeHtml(err.message || "Failed to load settings")}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" id="settings-retry">Retry</button>
      `;
      container.appendChild(div);
      div.querySelector("#settings-retry").addEventListener("click", () => {
        div.remove();
        if (loading) loading.style.display = "block";
        loadSettings();
      });
    } else {
      showToast("danger", err.message || "Failed to load settings");
    }
  }
}

function wireForm() {
  const form = $("settings-form");
  const saveBtn = $("settings-save");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormErrors(form);
    $("settings-status").textContent = "";

    const clientValidation = validateSettings(form);
    if (!clientValidation.valid) {
      showFormErrors(form, { fields: clientValidation.fields });
      return;
    }

    setButtonLoading(saveBtn, true);
    const body = {
      business_name: form.business_name.value.trim(),
      email: form.email.value.trim() || null,
      phone: form.phone.value.trim() || null,
      address: form.address.value.trim() || null,
      currency_code: form.currency_code.value,
      default_low_stock_threshold: Number(form.default_low_stock_threshold.value),
    };

    try {
      await api.put("/api/settings", body);
      showToast("success", "Settings saved");
      $("settings-status").textContent = "Saved just now";
    } catch (err) {
      if (err.details && err.details.fields) {
        showFormErrors(form, err.details);
      } else {
        showToast("danger", err.message || "Failed to save settings");
      }
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });
}

function init() {
  initSidebar();
  loadSettings();
  wireForm();
}

init();