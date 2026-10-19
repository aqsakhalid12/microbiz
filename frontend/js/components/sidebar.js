// frontend/js/components/sidebar.js
// Renders the app shell: sidebar (desktop) / offcanvas (mobile)
// and sticky top bar. Fetches current user data from /api/auth/me.
import { api } from "/js/api/client.js";
import { escapeHtml } from "/js/components/ui.js";

// Navigation links. Dashboard, Products, and Inventory are implemented; the rest are placeholders.
const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-speedometer2", enabled: true },
  { href: "/products", label: "Products", icon: "bi-box-seam", enabled: true },
  { href: "/inventory", label: "Inventory", icon: "bi-box-seam", enabled: true },
  { href: "/customers", label: "Customers", icon: "bi-people", enabled: true },
  { href: "/orders", label: "Orders", icon: "bi-cart", enabled: true },
  { href: "/expenses", label: "Expenses", icon: "bi-cash-coin", enabled: true },
  { label: "Reports", icon: "bi-bar-chart-line", enabled: false },
  { href: "/settings", label: "Settings", icon: "bi-gear", enabled: true },
];

/**
 * Generate HTML for the navigation links list.
 * @param {string} activePath - current window.location.pathname
 * @returns {string} HTML string of nav links
 */
function navLinksHtml(activePath) {
  return NAV_LINKS.map((link) => {
    const isActive = link.enabled && link.href === activePath;
    if (link.enabled) {
      return `
        <a class="sidebar-link ${isActive ? "active" : ""}" href="${link.href}">
          <i class="bi ${link.icon}"></i>
          <span>${escapeHtml(link.label)}</span>
        </a>`;
    }
    return `
      <span class="sidebar-link disabled" aria-disabled="true">
        <i class="bi ${link.icon}"></i>
        <span>${escapeHtml(link.label)}</span>
        <span class="badge bg-secondary ms-auto">Soon</span>
      </span>`;
  }).join("");
}

/**
 * Generate HTML for the desktop sidebar.
 * @param {{full_name: string, business_name: string}} profile - user data
 * @param {string} activePath - current window.location.pathname
 * @returns {string} HTML string
 */
function sidebarHtml(profile, activePath) {
  return `
    <nav class="app-sidebar-desktop d-none d-lg-flex flex-column" aria-label="Main navigation">
      <div class="sidebar-brand px-3 pb-3 mb-2">
        <i class="bi bi-shop me-2"></i>
        <span class="fw-semibold">MicroBiz</span>
      </div>
      ${navLinksHtml(activePath)}
    </nav>
    <div class="offcanvas offcanvas-start app-offcanvas" tabindex="-1" id="appSidebarOffcanvas" aria-labelledby="appSidebarOffcanvasLabel">
      <div class="offcanvas-header">
        <h5 class="offcanvas-title" id="appSidebarOffcanvasLabel">MicroBiz</h5>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body d-flex flex-column">
        ${navLinksHtml(activePath)}
      </div>
    </div>`;
}

/**
 * Generate HTML for the top bar.
 * @param {{full_name: string, business_name: string}} profile - user data
 * @returns {string} HTML string
 */
function topbarHtml(profile) {
  const name = escapeHtml(profile.full_name || "User");
  const business = escapeHtml(profile.business_name || "");
  return `
    <nav class="app-topbar navbar navbar-expand-lg sticky-top px-3" aria-label="Top bar">
      <div class="container-fluid p-0">
        <button class="btn btn-outline-secondary me-3 d-lg-none" type="button"
                data-bs-toggle="offcanvas" data-bs-target="#appSidebarOffcanvas"
                aria-controls="appSidebarOffcanvas" aria-label="Open menu">
          <i class="bi bi-list"></i>
        </button>
        <span class="navbar-brand mb-0 h1" id="topbar-business">${business}</span>
        <div class="dropdown ms-auto">
          <a class="d-flex align-items-center text-decoration-none dropdown-toggle" href="#" role="button"
             data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-person-circle fs-4 me-2"></i>
            <span class="d-none d-md-inline">${name}</span>
          </a>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><h6 class="dropdown-header">${business}</h6></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item" type="button" id="logout-btn">
              <i class="bi bi-box-arrow-right me-2"></i>Logout
            </button></li>
          </ul>
        </div>
      </div>
    </nav>`;
}

/**
 * Initialize the sidebar and top bar.
 * Renders a placeholder first, then fetches the user profile
 * and updates the DOM with real data.
 */
export function initSidebar() {
  const sidebarContainer = document.getElementById("app-sidebar");
  const topbarContainer = document.getElementById("app-topbar");
  // Only run on pages that have the app shell containers.
  if (!sidebarContainer || !topbarContainer) return;

  const activePath = window.location.pathname;

  // Render initial shell with placeholder data so layout appears quickly.
  const placeholderProfile = { full_name: "", business_name: "" };
  sidebarContainer.innerHTML = sidebarHtml(placeholderProfile, activePath);
  topbarContainer.innerHTML = topbarHtml(placeholderProfile);

  // Fetch the real user profile.
  api.get("/api/auth/me")
    .then((data) => {
      const profile = data.user || {};
      sidebarContainer.innerHTML = sidebarHtml(profile, activePath);
      topbarContainer.innerHTML = topbarHtml(profile);
      wireLogout(); // attach logout handler after re-render
    })
    .catch(() => {
      // Non-401 errors keep the placeholder UI; 401 is handled by api client
      // (which redirects to /login) so we don't need to do anything special here.
    });

  // Wire logout button (covers both placeholder and final render).
  wireLogout();
}

/**
 * Attach click handler to the logout button.
 * Prevents duplicate wiring via dataset flag.
 */
function wireLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn || logoutBtn.dataset.wired) return;
  logoutBtn.dataset.wired = "true";
  logoutBtn.addEventListener("click", async () => {
    try {
      await api.post("/api/auth/logout", undefined);
    } catch {
      // Ignore errors: even if request fails we clear local state by redirecting.
    }
    window.location.href = "/login";
  });
}
