// frontend/pages/dashboard.js
import { api } from "/js/api/client.js";
import { renderEmptyState, escapeHtml } from "/js/components/ui.js";
import { initSidebar } from "/js/components/sidebar.js";

// Initialize the app shell (sidebar/topbar) first.
initSidebar();

// Stat card definitions
const STAT_CARDS = [
  { id: "total-sales", label: "Total Sales", icon: "bi-cash-coin" },
  { id: "total-expenses", label: "Total Expenses", icon: "bi-wallet" },
  { id: "estimated-profit", label: "Estimated Profit", icon: "bi-graph-up-arrow" },
  { id: "total-orders", label: "Total Orders", icon: "bi-cart" },
  { id: "pending-orders", label: "Pending Orders", icon: "bi-clock-history" },
  { id: "low-stock", label: "Low-Stock Items", icon: "bi-exclamation-triangle" },
];
const LATER_PHASE_HINT = "Data available in a later phase";

/**
 * Render the six stat cards into the #stat-cards container.
 */
function renderStatCards() {
  const container = document.getElementById("stat-cards");
  if (!container) return;
  container.innerHTML = STAT_CARDS.map((card) => `
    <div class="col-6 col-md-4 col-xl-2">
      <div class="card stat-card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <p class="stat-label mb-1">${escapeHtml(card.label)}</p>
              <p class="stat-value mb-1">—</p>
              <p class="stat-hint mb-0"><small>${escapeHtml(LATER_PHASE_HINT)}</small></p>
            </div>
            <i class="bi ${card.icon} stat-icon"></i>
          </div>
        </div>
      </div>
    </div>`).join("");
}

/**
 * Initialize the dashboard: render stat cards and placeholder panels,
 * then fetch the user profile for the greeting.
 */
async function init() {
  renderStatCards();
  renderEmptyState(document.getElementById("sales-chart-empty"), {
    icon: "bi-bar-chart-line",
    title: "Sales overview (chart)",
    text: "Charts will be available in a later phase.",
  });
  renderEmptyState(document.getElementById("low-stock-empty"), {
    icon: "bi-exclamation-triangle",
    title: "Low-stock alerts",
    text: "Low-stock alerts will be available in a later phase.",
  });

  // Fetch user data for the greeting.
  try {
    const data = await api.get("/api/auth/me");
    const user = data.user || {};
    const firstName = user.full_name.split(" ")[0] || "";
    document.getElementById("greeting").textContent =
      firstName ? `Hello, ${firstName}` : "Hello";
    document.getElementById("greeting-sub").textContent =
      `${user.business_name || ""} · ${user.currency_code || ""}`.trim()
        .replace(/^ ·$/, ""); // trim trailing " ·" if empty
  } catch {
    // Non-2xx responses are handled by the api client (redirects to /login on 401).
    // For other errors we just leave the greeting as "Loading…" or show a toast?
    // For simplicity, do nothing; the api client already redirected on 401.
  }
}

init();