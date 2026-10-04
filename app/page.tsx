"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";

type NavKey = "Dashboard" | "Create Invoice" | "All Invoices" | "Customers" | "Products" | "Transporters" | "Inventory" | "Payments" | "Reports" | "Audit trail" | "Company settings" | "Manage users";
type Customer = { id: string; name: string; billingAddress: string; deliveryAddress?: string | null; city: string; district?: string | null; state: string; stateCode: string; pinCode?: string | null; gstin?: string | null; pan?: string | null; phone?: string | null; alternatePhone?: string | null; email?: string | null; creditLimit?: string; creditPeriod?: number; openingBalance?: string; notes?: string | null; active?: boolean };
type Product = { id: string; name: string; description?: string | null; sku?: string | null; hsnSac: string; unit: string; defaultRate: string; purchaseRate?: string; gstRate: string; currentStock?: string; openingStock?: string; minimumStock?: string; active?: boolean };
type InvoiceSummary = { id: string; invoiceNumber?: string | null; invoiceDate: string; buyerName: string; buyerGstin?: string | null; type: string; status: string; grandTotal: string; amountPaid: string; vehicleNumber?: string | null; billOfLadingNumber?: string | null; lrRrNumber?: string | null; ewayBillNumber?: string | null; ewayBillStatus?: string };
type PaymentSummary = { id: string; invoiceId: string; amount: string; paymentDate: string; method: string; referenceNumber?: string | null; reversedAt?: string | null; invoice?: { invoiceNumber?: string | null; buyerName: string; grandTotal: string } };
type NotificationItem = { id: string; type: "INFO" | "SUCCESS" | "WARNING"; title: string; message: string; href?: string | null; readAt?: string | null; createdAt: string };
type Session = { user: { id: string; name: string; email: string }; permissions: string[] };
type UserRole = { id: string; name: string };
type Permission = { id: string; key: string; description?: string | null };
type AccessRole = { id: string; name: string; description?: string | null; permissions: Permission[] };
type Transporter = { id: string; name: string; contactPerson?: string | null; phone?: string | null; gstin?: string | null; address?: string | null; active?: boolean };
type BankAccount = { id: string; bankName: string; accountHolder: string; accountNumber: string; ifsc: string; branch?: string | null; accountType?: string | null; active?: boolean };
type UserAccount = { id: string; name: string; email: string; status: string; createdAt: string; lastLoginAt?: string | null; roles: UserRole[] };
type Dashboard = { metrics: { todaySales: string; monthSales: string; quarterSales: string; yearSales: string; totalInvoices: number; outstanding: string; paid: string; overdue: string; customers: number; products: number; lowStock: number }; recentInvoices: InvoiceSummary[]; lowStockProducts: Array<{ id: string; name: string; stock: number; minimumStock: string }> };
type InvoiceLine = { key: string; productId: string; quantity: string; rate: string; gstPercent: string };
type InvoiceTaxMode = "INTRA_STATE" | "INTER_STATE" | "NO_GST";
type Toast = { message: string; tone: "success" | "error" | "info" };
type ReportMeta = { page: number; pageSize: number; total: number };
type CompanyProfile = { id: string; name: string; addressLine1: string; addressLine2?: string | null; city: string; district?: string | null; state: string; stateCode: string; pinCode: string; gstin?: string | null; pan?: string | null; phone?: string | null; email?: string | null; website?: string | null; logoUrl?: string | null; defaultJurisdiction?: string | null; invoicePrefix: string; defaultTerms?: string | null; declaration?: string | null; authorizedSignatory?: string | null; bankAccount?: BankAccount | null; bankAccounts?: BankAccount[] };
type DropdownOption = [value: string, label: string];
const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const navItems: Array<{ label: NavKey; icon: string; section?: string }> = [
  { label: "Dashboard", icon: "⌂" },
  { label: "Create Invoice", icon: "+" , section: "OPERATIONS" },
  { label: "All Invoices", icon: "▤" },
  { label: "Customers", icon: "♧" },
  { label: "Products", icon: "◈" },
  { label: "Transporters", icon: "⇄" },
  { label: "Inventory", icon: "⌁" },
  { label: "Payments", icon: "◌" },
  { label: "Reports", icon: "▥", section: "INSIGHTS" },
  { label: "Audit trail", icon: "◷" , section: "ADMINISTRATION" },
  { label: "Company settings", icon: "⚙" }
];
const navKeySet = new Set<NavKey>([...navItems.map((item) => item.label), "Manage users"]);

function zonedDateInputValue(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const today = () => zonedDateInputValue();
const money = (value: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const shortDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: BUSINESS_TIME_ZONE }).format(date);
};
const liveClockTime = (value: Date) => new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: BUSINESS_TIME_ZONE }).format(value);
const liveClockDate = (value: Date) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: BUSINESS_TIME_ZONE }).format(value);
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "VV";
const newKey = () => (globalThis.crypto?.randomUUID?.() ?? "local-" + Date.now() + "-" + Math.random().toString(36).slice(2)).replaceAll("-", "");
const monthOptions: DropdownOption[] = [["ALL", "All months"], ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"], ["05", "May"], ["06", "June"], ["07", "July"], ["08", "August"], ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"]];

function inputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function dateInputValue(value: Date) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

function periodRange(month: string, year: string) {
  const fiscalYearStart = Number(year.slice(0, 4));
  if (!Number.isInteger(fiscalYearStart)) return { from: today(), to: today() };
  if (month === "ALL") return { from: `${fiscalYearStart}-04-01`, to: `${fiscalYearStart + 1}-03-31` };
  const numericMonth = Number(month);
  const calendarYear = numericMonth >= 4 ? fiscalYearStart : fiscalYearStart + 1;
  const lastDay = new Date(calendarYear, numericMonth, 0).getDate();
  return { from: `${calendarYear}-${month}-01`, to: `${calendarYear}-${month}-${String(lastDay).padStart(2, "0")}` };
}

function parseReportSelection(selection: string) {
  const [path, query = ""] = selection.split("?");
  const [reportName, customerId] = path.split(":");
  return { reportName, customerId, params: new URLSearchParams(query) };
}

function reportSelection(reportName: string, customerId?: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const path = customerId ? reportName + ":" + customerId : reportName;
  return params.toString() ? path + "?" + params.toString() : path;
}

function reportExportUrl(selection: string) {
  const { reportName, customerId, params } = parseReportSelection(selection);
  params.set("format", "csv");
  const endpoint = reportName === "inventory" ? "/api/reports/inventory" : reportName === "outstanding" ? "/api/reports/outstanding" : reportName === "gst" ? "/api/reports/gst" : reportName === "product-sales" ? "/api/reports/product-sales" : reportName === "customer-statement" && customerId ? "/api/reports/customer-statement?customerId=" + encodeURIComponent(customerId) : "/api/reports/sales";
  return endpoint + (endpoint.includes("?") ? "&" : "?") + params.toString();
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { error: text }; }
  if (!response.ok) throw new Error((body as { error?: string }).error || "The request could not be completed.");
  return body as T;
}

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [activeNav, setActiveNav] = useState<NavKey>("Dashboard");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [invoiceDirty, setInvoiceDirty] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [report, setReport] = useState<unknown[]>([]);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [reportKind, setReportKind] = useState("sales");
  const reportKindRef = useRef(reportKind);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<"customer" | "product" | "transporter" | "payment" | "cancel" | "inventory" | "reverse-payment" | "user" | "eway-bill" | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceSummary | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<Transporter | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentSummary | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const result = await api<{ data: NotificationItem[]; unreadCount: number }>("/api/notifications?limit=30");
      setNotifications(result.data);
      setUnreadNotifications(result.unreadCount);
    } catch { /* notification loading must not block billing workflows */ }
  }, []);

  const loadMasters = useCallback(async () => {
    setLoading(true);
    try {
      const [customerResult, productResult] = await Promise.all([
        api<{ data: Customer[] }>("/api/customers?pageSize=100"),
        api<{ data: Product[] }>("/api/products?pageSize=100")
      ]);
      setCustomers(customerResult.data);
      setProducts(productResult.data);
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load master data.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  const loadTransporters = useCallback(async () => {
    setLoading(true);
    try { setTransporters((await api<{ data: Transporter[] }>("/api/transporters?pageSize=100")).data); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to load transporters.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try { setInvoices((await api<{ data: InvoiceSummary[] }>("/api/invoices?pageSize=25")).data); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to load invoices.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try { setDashboard(await api<Dashboard>("/api/dashboard")); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to load dashboard.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    try { setCompany((await api<{ data: CompanyProfile }>("/api/company")).data); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to load company settings.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ data: UserAccount[]; roles: AccessRole[]; permissions: Permission[] }>("/api/users");
      setUsers(result.data);
      setRoles(result.roles);
      setPermissions(result.permissions);
    }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to load users.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  const loadReport = useCallback(async (kind: string, requestedPage = 1) => {
    const selection = parseReportSelection(kind);
    if (selection.reportName === "customer-statement" && !selection.customerId) {
      setReport([]);
      setReportMeta(null);
      setReportKind(kind);
      reportKindRef.current = kind;
      return;
    }
    setLoading(true);
    try {
      const { reportName, customerId, params } = selection;
      const endpoint = reportName === "inventory" ? "/api/reports/inventory" : reportName === "outstanding" ? "/api/reports/outstanding" : reportName === "gst" ? "/api/reports/gst" : reportName === "product-sales" ? "/api/reports/product-sales" : reportName === "customer-statement" && customerId ? "/api/reports/customer-statement?customerId=" + encodeURIComponent(customerId) : reportName === "audit" ? "/api/audit-logs" : "/api/reports/sales";
      if (reportName !== "customer-statement") { params.set("page", String(requestedPage)); params.set("pageSize", "25"); }
      const filteredEndpoint = params.toString() ? endpoint + (endpoint.includes("?") ? "&" : "?") + params.toString() : endpoint;
      const result = await api<{ data: unknown[]; page?: number; pageSize?: number; total?: number }>(filteredEndpoint);
      setReport(result.data);
      setReportMeta(reportName === "customer-statement" ? null : { page: result.page ?? requestedPage, pageSize: result.pageSize ?? 25, total: result.total ?? result.data.length });
      setReportKind(kind);
      reportKindRef.current = kind;
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to load report.", "error"); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => {
    api<Session>("/api/auth/me").then(setSession).catch(() => setSession(null)).finally(() => setSessionLoaded(true));
  }, []);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view") as NavKey | null;
    if (requestedView && navKeySet.has(requestedView)) queueMicrotask(() => setActiveNav(requestedView));
    const requestedDraft = new URLSearchParams(window.location.search).get("draftId");
    if (requestedDraft) queueMicrotask(() => setDraftId(requestedDraft));
  }, []);

  useEffect(() => {
    if (!session) return;
    if (activeNav === "Dashboard") void Promise.resolve().then(loadDashboard);
    if (activeNav === "Create Invoice" || activeNav === "Customers" || activeNav === "Products" || activeNav === "Inventory" || activeNav === "Reports") void Promise.resolve().then(loadMasters);
    if (activeNav === "Transporters" || activeNav === "Create Invoice") void Promise.resolve().then(loadTransporters);
    if (activeNav === "All Invoices") void Promise.resolve().then(loadInvoices);
    if (activeNav === "Inventory") void Promise.resolve().then(() => loadReport("inventory"));
    if (activeNav === "Payments") void Promise.resolve().then(() => loadReport("outstanding"));
    if (activeNav === "Reports") void Promise.resolve().then(() => loadReport(reportKindRef.current));
    if (activeNav === "Audit trail") void Promise.resolve().then(() => loadReport("audit"));
    if (activeNav === "Company settings") void Promise.resolve().then(loadCompany);
    if (activeNav === "Manage users") void Promise.resolve().then(loadUsers);
  }, [activeNav, loadCompany, loadDashboard, loadInvoices, loadMasters, loadReport, loadTransporters, loadUsers, session]);

  useEffect(() => {
    if (!session) return;
    const initialLoad = window.setTimeout(() => { void loadNotifications(); }, 0);
    const interval = window.setInterval(() => { void loadNotifications(); }, 30000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); };
  }, [loadNotifications, session]);

  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const openNotification = async (notification: NotificationItem) => {
    if (!notification.readAt) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadNotifications((current) => Math.max(0, current - 1));
      await api("/api/notifications/" + notification.id, { method: "PATCH", headers: { Origin: window.location.origin } }).catch(() => undefined);
    }
    setNotificationsOpen(false);
    if (notification.href) window.location.assign(notification.href);
  };

  const markAllNotificationsRead = async () => {
    await api("/api/notifications/read-all", { method: "POST", headers: { Origin: window.location.origin } }).catch(() => undefined);
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadNotifications(0);
  };

  const changeNav = (nav: NavKey) => {
    if (nav === activeNav) { setMobileNavOpen(false); return; }
    if (activeNav === "Create Invoice" && invoiceDirty && !window.confirm("Leave this invoice? Unsaved changes will be lost.")) return;
    setInvoiceDirty(false);
    if (nav !== "Create Invoice") setDraftId(null);
    setMobileNavOpen(false);
    setActiveNav(nav);
    window.history.replaceState({}, "", "?view=" + encodeURIComponent(nav));
  };
  const logout = async () => { setUserMenuOpen(false); await fetch("/api/auth/logout", { method: "POST", headers: { Origin: window.location.origin } }); router.replace("/login"); };
  const refreshAfterMutation = async () => {
    await loadNotifications();
    if (activeNav === "Dashboard") await loadDashboard();
    else if (activeNav === "All Invoices") await loadInvoices();
    else if (activeNav === "Payments" || activeNav === "Inventory") await loadReport(activeNav === "Payments" ? "outstanding" : "inventory");
  };

  if (!sessionLoaded) return <div className="loading-screen">Loading Velmayil Ventures…</div>;
  if (!session) return <AuthRequired />;

  const userInitials = initials(session.user.name);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-logo-frame"><Image className="brand-logo" src="/velmayil-ventures-logo-pdf.png" width={264} height={108} alt="Velmayil Ventures logo" priority /></div>
        </div>
        <div className="workspace-switcher">
          <span className="eyebrow">WORKSPACE</span>
          <strong>Velmayil Ventures</strong>
          <span>FY 2026-27 <span className="switcher-dot">•</span> Local</span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => <div key={item.label}>{item.section && <div className="nav-section-label">{item.section}</div>}<NavItem label={item.label} icon={item.icon} active={activeNav === item.label} onClick={() => changeNav(item.label)} count={item.label === "All Invoices" ? dashboard?.metrics.totalInvoices : undefined} /></div>)}
        </nav>
        <div className="sidebar-footer">
          <div className="user-menu-wrap"><button className="user-chip" aria-expanded={userMenuOpen} aria-haspopup="menu" onClick={() => setUserMenuOpen((open) => !open)}>
            <div className="avatar">{userInitials}</div><div><strong>{session.user.name}</strong><span>Administrator</span></div><span className="more">•••</span>
          </button>{userMenuOpen && <div className="user-menu" role="menu"><button role="menuitem" onClick={() => { setUserMenuOpen(false); changeNav("Manage users"); }}>Manage users</button><button role="menuitem" className="user-menu-danger" onClick={() => void logout()}>Log out</button></div>}</div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>☰</button>
          <div className="breadcrumbs"><strong className="app-title">Velmayil Ventures Billing</strong><span>/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions"><div className="live-clock" title="Current India Standard Time"><span className="live-clock-label">INDIA STANDARD TIME</span><time dateTime={currentTime?.toISOString()}>{currentTime ? liveClockDate(currentTime) + " · " + liveClockTime(currentTime) : "Loading time…"}</time></div><button className="icon-button" aria-label="Search" onClick={() => changeNav("All Invoices")}>⌕</button><button className={"icon-button " + (unreadNotifications ? "has-dot" : "")} aria-label={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : "Notifications"} aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); void loadNotifications(); }}><svg className="notification-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></button></div>
        </header>

        {notificationsOpen && <NotificationPanel notifications={notifications} unreadCount={unreadNotifications} onOpen={openNotification} onMarkAllRead={() => void markAllNotificationsRead()} />}

        {mobileNavOpen && <div className="mobile-nav-backdrop" role="presentation" onMouseDown={() => setMobileNavOpen(false)}><aside className="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Mobile navigation" onMouseDown={(event) => event.stopPropagation()}><div className="mobile-nav-heading"><strong>Velmayil Ventures</strong><button className="mobile-nav-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}>×</button></div><nav aria-label="Mobile navigation">{navItems.map((item) => <div key={item.label}>{item.section && <div className="nav-section-label">{item.section}</div>}<NavItem label={item.label} icon={item.icon} active={activeNav === item.label} onClick={() => changeNav(item.label)} count={item.label === "All Invoices" ? dashboard?.metrics.totalInvoices : undefined} /></div>)}<NavItem label="Manage users" icon="⚙" active={activeNav === "Manage users"} onClick={() => changeNav("Manage users")} /></nav><div className="sidebar-footer mobile-nav-footer"><div className="user-chip"><div className="avatar">{userInitials}</div><div><strong>{session.user.name}</strong><span>Administrator</span></div></div><button className="text-button danger-text mobile-logout-button" onClick={() => void logout()}>Log out</button></div></aside></div>}

        <div className="content-wrap">
          {activeNav === "Dashboard" && <DashboardView dashboard={dashboard} onNavigate={changeNav} onRefresh={loadDashboard} />}
          {activeNav === "Create Invoice" && <InvoiceEditor draftId={draftId} customers={customers} products={products} bankAccounts={company?.bankAccounts ?? []} transporters={transporters} companyStateCode={company?.stateCode ?? "29"} onNotify={notify} onSaved={async () => { await refreshAfterMutation(); }} onIssued={() => changeNav("All Invoices")} onDirtyChange={setInvoiceDirty} onCreateCustomer={() => setModal("customer")} onCreateProduct={() => setModal("product")} />}
          {activeNav === "All Invoices" && <InvoicesView invoices={invoices} loading={loading} onRefresh={loadInvoices} onCreate={() => { setDraftId(null); changeNav("Create Invoice"); }} onEditDraft={(invoice) => { setDraftId(invoice.id); setActiveNav("Create Invoice"); window.history.replaceState({}, "", "?view=Create%20Invoice&draftId=" + invoice.id); }} onDeleteDraft={async (invoice) => { if (!window.confirm("Delete this draft? It has no financial effect and cannot be recovered.")) return; await api("/api/invoices/" + invoice.id, { method: "DELETE", headers: { Origin: window.location.origin } }); notify("Draft deleted."); await loadInvoices(); await loadNotifications(); }} onPay={(invoice) => { setSelectedInvoice(invoice); setModal("payment"); }} onCancel={(invoice) => { setSelectedInvoice(invoice); setModal("cancel"); }} onEwayBill={(invoice) => { setSelectedInvoice(invoice); setModal("eway-bill"); }} />}
          {activeNav === "Customers" && <CustomersView customers={customers} loading={loading} onAdd={() => { setSelectedCustomer(null); setModal("customer"); }} onEdit={(customer) => { setSelectedCustomer(customer); setModal("customer"); }} onDisable={async (customer) => { if (!window.confirm("Disable " + customer.name + "? It will remain on historical invoices but cannot be selected for new invoices.")) return; await api("/api/customers/" + customer.id, { method: "DELETE", headers: { Origin: window.location.origin } }); notify("Customer disabled."); await loadMasters(); }} onRefresh={loadMasters} />}
          {activeNav === "Products" && <ProductsView products={products} loading={loading} onAdd={() => { setSelectedProduct(null); setModal("product"); }} onEdit={(product) => { setSelectedProduct(product); setModal("product"); }} onDisable={async (product) => { if (!window.confirm("Disable " + product.name + "? It will remain on historical invoices but cannot be selected for new invoices.")) return; await api("/api/products/" + product.id, { method: "DELETE", headers: { Origin: window.location.origin } }); notify("Product disabled."); await loadMasters(); }} onRefresh={loadMasters} />}
          {activeNav === "Transporters" && <TransportersView transporters={transporters} loading={loading} onAdd={() => { setSelectedTransporter(null); setModal("transporter"); }} onEdit={(transporter) => { setSelectedTransporter(transporter); setModal("transporter"); }} onDisable={async (transporter) => { if (!window.confirm("Disable " + transporter.name + "?")) return; await api("/api/transporters/" + transporter.id, { method: "DELETE", headers: { Origin: window.location.origin } }); notify("Transporter disabled."); await loadTransporters(); }} onRefresh={loadTransporters} />}
          {activeNav === "Inventory" && <InventoryView rows={report} products={products} loading={loading} onAdjust={() => setModal("inventory")} onRefresh={() => loadReport("inventory")} />}
          {activeNav === "Payments" && <PaymentsView rows={report} loading={loading} onPay={(invoice) => { setSelectedInvoice(invoice); setModal("payment"); }} onReverse={(payment) => { setSelectedPayment(payment); setModal("reverse-payment"); }} onRefresh={() => loadReport("outstanding")} />}
          {activeNav === "Reports" && <ReportsView kind={reportKind} customers={customers} rows={report} meta={reportMeta} loading={loading} onSelect={loadReport} onPageChange={(page) => void loadReport(reportKind, page)} onExport={(selection) => window.open(reportExportUrl(selection), "_blank")} />}
          {activeNav === "Audit trail" && <AuditView rows={report} loading={loading} onRefresh={() => loadReport("audit")} />}
          {activeNav === "Company settings" && company && <CompanySettings company={company} loading={loading} onSaved={async () => { await loadCompany(); notify("Company settings saved."); }} onError={(message) => notify(message, "error")} />}
          {activeNav === "Manage users" && <UsersView users={users} roles={roles} permissions={permissions} loading={loading} onRefresh={loadUsers} onAdd={() => { setSelectedUser(null); setModal("user"); }} onEdit={(user) => { setSelectedUser(user); setModal("user"); }} />}
        </div>
      </section>
      {modal === "customer" && <CustomerModal customer={selectedCustomer} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify(selectedCustomer ? "Customer updated." : "Customer created."); await loadMasters(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "product" && <ProductModal product={selectedProduct} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify(selectedProduct ? "Product updated." : "Product created."); await loadMasters(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "transporter" && <TransporterModal transporter={selectedTransporter} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify(selectedTransporter ? "Transporter updated." : "Transporter created."); await loadTransporters(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "payment" && selectedInvoice && <PaymentModal invoice={selectedInvoice} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify("Payment recorded."); await loadReport("outstanding"); await loadInvoices(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "cancel" && selectedInvoice && <CancelModal invoice={selectedInvoice} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify("Invoice cancelled."); await loadInvoices(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "eway-bill" && selectedInvoice && <EwayBillModal invoice={selectedInvoice} onClose={() => setModal(null)} onSaved={async (ewbNumber) => { setModal(null); notify("E-way bill " + ewbNumber + " generated."); await loadInvoices(); await loadNotifications(); window.open("https://ewaybillgst.gov.in/", "_blank"); }} onError={(message) => notify(message, "error")} />}
      {modal === "inventory" && <InventoryAdjustmentModal products={products} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify("Inventory adjusted."); await loadReport("inventory"); await loadMasters(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "reverse-payment" && selectedPayment && <PaymentReversalModal payment={selectedPayment} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify("Payment reversed."); await loadReport("outstanding"); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {modal === "user" && <UserModal user={selectedUser} roles={roles} onClose={() => setModal(null)} onSaved={async () => { setModal(null); notify(selectedUser ? "User access updated." : "User added."); await loadUsers(); await loadNotifications(); }} onError={(message) => notify(message, "error")} />}
      {toast && <div className={"toast " + toast.tone} role={toast.tone === "error" ? "alert" : "status"} aria-live="polite">{toast.message}</div>}
    </main>
  );
}

function AuthRequired() {
  return <main className="auth-required"><div className="auth-required-card"><Image src="/velmayil-ventures-logo-pdf.png" width={264} height={108} alt="Velmayil Ventures" priority /><span className="eyebrow">VELMAYIL VENTURES</span><h1>Sign in to your billing workspace</h1><p>Your local session has expired or you have not signed in yet.</p><a className="button primary" href="/login">Go to sign in →</a></div></main>;
}

function NotificationPanel({ notifications, unreadCount, onOpen, onMarkAllRead }: { notifications: NotificationItem[]; unreadCount: number; onOpen: (notification: NotificationItem) => Promise<void>; onMarkAllRead: () => void }) {
  return <section className="notification-panel" aria-label="Notifications"><div className="notification-panel-header"><div><span className="eyebrow">WORKSPACE ACTIVITY</span><h2>Notifications</h2></div><button className="text-button" disabled={!unreadCount} onClick={onMarkAllRead}>Mark all read</button></div>{notifications.length ? <div className="notification-list">{notifications.map((notification) => <button className={"notification-item " + (notification.readAt ? "read" : "unread")} key={notification.id} onClick={() => void onOpen(notification)}><span className={"notification-marker " + notification.type.toLowerCase()} aria-hidden="true" /><span className="notification-copy"><strong>{notification.title}</strong><span>{notification.message}</span><small>{shortDate(notification.createdAt)}</small></span>{!notification.readAt && <span className="notification-unread" aria-label="Unread" />}</button>)}</div> : <div className="notification-empty"><strong>All caught up</strong><span>New invoice, payment, and inventory activity will appear here.</span></div>}</section>;
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function DashboardView({ dashboard, onNavigate, onRefresh }: { dashboard: Dashboard | null; onNavigate: (nav: NavKey) => void; onRefresh: () => void }) {
  const metrics = dashboard?.metrics;
  return <><PageHeading eyebrow="VELMAYIL VENTURES / OVERVIEW" title="Good morning" description="Your billing, collections, and inventory at a glance." actions={<button className="button primary" onClick={() => onNavigate("Create Invoice")}>+ New invoice</button>} />
    <div className="metric-grid">
      <Metric label="Today’s sales" value={money(metrics?.todaySales ?? 0)} detail="Issued invoices today" tone="green" />
      <Metric label="This month" value={money(metrics?.monthSales ?? 0)} detail="Gross billed this month" tone="amber" />
      <Metric label="This quarter" value={money(metrics?.quarterSales ?? 0)} detail="Gross billed this quarter" tone="blue" />
      <Metric label="This year" value={money(metrics?.yearSales ?? 0)} detail="Gross billed this year" tone="green" />
      <Metric label="Outstanding" value={money(metrics?.outstanding ?? 0)} detail="Receivables to collect" tone="red" />
      <Metric label="Paid" value={money(metrics?.paid ?? 0)} detail="Fully settled invoices" tone="green" />
      <Metric label="Overdue" value={money(metrics?.overdue ?? 0)} detail="Past-due receivables" tone="red" />
      <Metric label="Invoices" value={String(metrics?.totalInvoices ?? 0)} detail="All invoice records" tone="amber" />
    </div>
    <div className="dashboard-grid">
      <section className="card table-card"><div className="card-toolbar"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Recent invoices</h2></div><button className="text-button" onClick={() => onNavigate("All Invoices")}>View all →</button></div>{dashboard?.recentInvoices.length ? <InvoiceTable invoices={dashboard.recentInvoices} compact /> : <EmptyState title="No invoices yet" description="Create your first invoice to see live activity here." action={<button className="button secondary" onClick={() => onNavigate("Create Invoice")}>Create invoice</button>} />}</section>
      <section className="card table-card"><div className="card-toolbar"><div><span className="eyebrow">STOCK WATCH</span><h2>Low stock</h2></div><button className="text-button" onClick={() => onNavigate("Inventory")}>Open inventory →</button></div>{dashboard?.lowStockProducts.length ? <div className="stock-list">{dashboard.lowStockProducts.map((item) => <div className="stock-row" key={item.id}><div><strong>{item.name}</strong><span>Minimum {item.minimumStock}</span></div><strong className="stock-alert">{item.stock}</strong></div>)}</div> : <EmptyState title="Inventory looks healthy" description="Products at or below minimum stock will appear here." />}</section>
    </div>
    <section className="quick-actions"><button onClick={() => onNavigate("Customers")}><span>♧</span><strong>Add customer</strong><small>Set up a buyer account</small></button><button onClick={() => onNavigate("Products")}><span>◈</span><strong>Add product</strong><small>Keep your catalogue current</small></button><button onClick={() => onNavigate("Reports")}><span>▥</span><strong>View reports</strong><small>Sales and GST summaries</small></button><button onClick={onRefresh}><span>↻</span><strong>Refresh data</strong><small>Sync the workspace</small></button></section>
  </>;
}

function InvoiceEditor({ draftId, customers, products, bankAccounts, transporters, companyStateCode, onNotify, onSaved, onIssued, onDirtyChange, onCreateCustomer, onCreateProduct }: { draftId?: string | null; customers: Customer[]; products: Product[]; bankAccounts: BankAccount[]; transporters: Transporter[]; companyStateCode: string; onNotify: (message: string, tone?: Toast["tone"]) => void; onSaved: () => Promise<void>; onIssued: () => void; onDirtyChange: (dirty: boolean) => void; onCreateCustomer: () => void; onCreateProduct: () => void }) {
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [type, setType] = useState<"TAX_INVOICE" | "BILL_OF_SUPPLY">("TAX_INVOICE");
  const [taxMode, setTaxMode] = useState<InvoiceTaxMode>("INTRA_STATE");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 days");
  const [bankAccountId, setBankAccountId] = useState("");
  const [buyerOrderNumber, setBuyerOrderNumber] = useState("");
  const [buyerOrderDate, setBuyerOrderDate] = useState("");
  const [dispatchDocumentNumber, setDispatchDocumentNumber] = useState("");
  const [deliveryNoteDate, setDeliveryNoteDate] = useState("");
  const [dispatchedThrough, setDispatchedThrough] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [destination, setDestination] = useState("");
  const [billOfLadingNumber, setBillOfLadingNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lrRrNumber, setLrRrNumber] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("FOR destination");
  const [items, setItems] = useState<InvoiceLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; setDirty(true); onDirtyChange(true); };
  const clearDirty = useCallback(() => { dirtyRef.current = false; setDirty(false); onDirtyChange(false); }, [onDirtyChange]);
  const updateText = (setter: (value: string) => void, value: string) => { setter(value); markDirty(); };
  const customer = customers.find((item) => item.id === customerId);
  const defaultTaxMode: InvoiceTaxMode = customer && customer.stateCode === companyStateCode ? "INTRA_STATE" : "INTER_STATE";
  const activeTaxMode: InvoiceTaxMode = type === "BILL_OF_SUPPLY" ? "NO_GST" : taxMode;
  const totals = useMemo(() => items.reduce((acc, item) => {
    const taxable = Math.max(0, Number(item.quantity || 0) * Number(item.rate || 0));
    const tax = activeTaxMode === "NO_GST" ? 0 : taxable * Number(item.gstPercent || 0) / 100;
    return { taxable: acc.taxable + taxable, tax: acc.tax + tax, total: acc.total + taxable + tax };
  }, { taxable: 0, tax: 0, total: 0 }), [activeTaxMode, items]);

  useEffect(() => { if (!customerId && customers[0]) queueMicrotask(() => { setCustomerId(customers[0].id); if (type === "TAX_INVOICE") setTaxMode((current) => current === "NO_GST" ? current : (customers[0].stateCode === companyStateCode ? "INTRA_STATE" : "INTER_STATE")); }); }, [companyStateCode, customers, customerId, type]);
  useEffect(() => { if (!bankAccountId && bankAccounts[0]) queueMicrotask(() => setBankAccountId(bankAccounts[0].id)); }, [bankAccountId, bankAccounts]);
  useEffect(() => { if (!items.length && products[0]) queueMicrotask(() => setItems([{ key: newKey(), productId: products[0].id, quantity: "1", rate: String(products[0].defaultRate), gstPercent: String(products[0].gstRate) }])); }, [products, items.length]);
  useEffect(() => {
    if (!draftId || !customers.length || !products.length) return;
    void api<{ data: { customerId: string; invoiceDate: string; type: "TAX_INVOICE" | "BILL_OF_SUPPLY"; taxMode: InvoiceTaxMode; paymentTerms: string | null; referenceNumber: string | null; referenceDate: string | null; buyerOrderNumber: string | null; buyerOrderDate: string | null; dispatchDocumentNumber: string | null; deliveryNoteDate: string | null; dispatchedThrough: string | null; transporterName: string | null; destination: string | null; billOfLadingNumber: string | null; lrRrNumber: string | null; vehicleNumber: string | null; termsOfDelivery: string | null; companySnapshot?: { bankAccount?: { id?: string } | null } | null; items: Array<{ productId: string; quantity: string; rate: string; gstPercent: string }> } }>("/api/invoices/" + draftId).then(({ data }) => {
      setCustomerId(data.customerId); setInvoiceDate(data.invoiceDate.slice(0, 10)); setType(data.type); setTaxMode(data.taxMode); setBankAccountId(data.companySnapshot?.bankAccount?.id ?? bankAccounts[0]?.id ?? ""); setPaymentTerms(data.paymentTerms ?? "30 days"); setReferenceNumber(data.referenceNumber ?? ""); setReferenceDate(data.referenceDate?.slice(0, 10) ?? ""); setBuyerOrderNumber(data.buyerOrderNumber ?? ""); setBuyerOrderDate(data.buyerOrderDate?.slice(0, 10) ?? ""); setDispatchDocumentNumber(data.dispatchDocumentNumber ?? ""); setDeliveryNoteDate(data.deliveryNoteDate?.slice(0, 10) ?? ""); setDispatchedThrough(data.dispatchedThrough ?? ""); setTransporterName(data.transporterName ?? ""); setDestination(data.destination ?? ""); setBillOfLadingNumber(data.billOfLadingNumber ?? ""); setLrRrNumber(data.lrRrNumber ?? ""); setVehicleNumber(data.vehicleNumber ?? ""); setTermsOfDelivery(data.termsOfDelivery ?? "FOR destination"); setItems(data.items.map((item) => ({ key: newKey(), productId: item.productId, quantity: item.quantity, rate: item.rate, gstPercent: item.gstPercent }))); clearDirty();
    }).catch((error) => onNotify(error instanceof Error ? error.message : "Unable to load draft.", "error"));
  }, [bankAccounts, clearDirty, customers.length, draftId, onNotify, products.length]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!dirtyRef.current) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const addItem = () => {
    const product = products[0];
    setItems((current) => [...current, { key: newKey(), productId: product?.id ?? "", quantity: "1", rate: product?.defaultRate ?? "0", gstPercent: product?.gstRate ?? "0" }]);
    markDirty();
  };
  const updateItem = (key: string, patch: Partial<InvoiceLine>) => { setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item)); markDirty(); };
  const selectProduct = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId);
    updateItem(key, { productId, rate: product?.defaultRate ?? "0", gstPercent: product?.gstRate ?? "0" });
  };
  const payload = () => ({ customerId, invoiceDate, type, taxMode: activeTaxMode, bankAccountId: bankAccountId || undefined, referenceNumber: referenceNumber || undefined, referenceDate: referenceDate || undefined, paymentTerms, buyerOrderNumber: buyerOrderNumber || undefined, buyerOrderDate: buyerOrderDate || undefined, dispatchDocumentNumber: dispatchDocumentNumber || undefined, deliveryNoteDate: deliveryNoteDate || undefined, dispatchedThrough: dispatchedThrough || undefined, transporterName: transporterName || undefined, destination: destination || undefined, billOfLadingNumber: billOfLadingNumber || undefined, vehicleNumber: vehicleNumber || undefined, lrRrNumber: lrRrNumber || undefined, termsOfDelivery: termsOfDelivery || undefined, items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, rate: item.rate, discountPercent: "0", gstPercent: activeTaxMode === "NO_GST" ? "0" : item.gstPercent })), idempotencyKey: newKey() + newKey() });
  const save = async (issue: boolean, preview: boolean) => {
    const errors: string[] = [];
    if (!customerId) errors.push("Select or create a customer.");
    if (!invoiceDate || Number.isNaN(new Date(invoiceDate).getTime())) errors.push("Enter a valid invoice date.");
    if (!paymentTerms.trim()) errors.push("Enter payment terms.");
    if (!items.length || items.some((item) => !item.productId || Number(item.quantity) <= 0 || Number(item.rate) < 0)) errors.push("Add at least one valid product line with quantity and rate.");
    if (errors.length) { onNotify(errors[0], "error"); return; }
    if (issue && !window.confirm("Issue this invoice now? Issuing locks financial details, stock, and the audit trail.")) return;
    const previewWindow = preview ? window.open("about:blank", "_blank") : null;
    if (previewWindow) previewWindow.document.title = "Preparing invoice preview…";
    setBusy(true);
    try {
      const endpoint = issue ? (draftId ? "/api/invoices/" + draftId + "/issue" : "/api/invoices/issue") : (draftId ? "/api/invoices/" + draftId : "/api/invoices/draft");
      const result = await api<{ data: { invoiceId: string; invoiceNumber?: string; grandTotal: string } }>(endpoint, { method: issue || !draftId ? "POST" : "PATCH", headers: { Origin: window.location.origin }, body: JSON.stringify(payload()) });
      onNotify(issue ? "Invoice " + (result.data.invoiceNumber ?? "") + " issued successfully." : "Draft saved successfully.");
      if (preview) {
        const previewUrl = "/api/invoices/" + result.data.invoiceId + "/pdf";
        if (previewWindow) previewWindow.location.href = previewUrl;
        else onNotify("Draft saved. Allow pop-ups to open the invoice preview.", "info");
      }
      clearDirty();
      await onSaved();
      if (issue) { onIssued(); return; }
    } catch (error) { previewWindow?.close(); onNotify(error instanceof Error ? error.message : "Unable to save invoice.", "error"); }
    finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="BILLING / NEW" title="Create invoice" description="Prepare, save, preview, and issue a bill of supply or tax invoice." actions={<><button className="button secondary" disabled={busy} onClick={() => void save(false, false)}>Save draft</button><button className="button primary" disabled={busy} onClick={() => void save(false, true)}>Preview invoice ↗</button></>} />
    <div className="progress-strip"><div className="progress-step active"><span>01</span><strong>Invoice details</strong></div><div className="progress-line" /><div className="progress-step active"><span>02</span><strong>Items</strong></div><div className="progress-line" /><div className="progress-step"><span>03</span><strong>Issue & collect</strong></div></div>
    <div className="invoice-layout">
      <div className="invoice-form-column">
    <section className="card form-card"><SectionHeading number="01" title="Invoice details" hint="Choose the tax treatment for this invoice" /><div className="form-grid three"><Field label="Invoice number" value="Assigned on issue" readOnly /><Field label="Invoice date" value={invoiceDate} type="date" onChange={(value) => updateText(setInvoiceDate, value)} /><SelectField label="Invoice type" value={type} onChange={(value) => { const nextType = value as "TAX_INVOICE" | "BILL_OF_SUPPLY"; setType(nextType); setTaxMode(nextType === "BILL_OF_SUPPLY" ? "NO_GST" : defaultTaxMode); markDirty(); }} options={[["TAX_INVOICE", "Tax Invoice"], ["BILL_OF_SUPPLY", "Bill of Supply"]]} /><SelectField label="Tax treatment" value={activeTaxMode} onChange={(value) => { setTaxMode(value as InvoiceTaxMode); markDirty(); }} options={type === "BILL_OF_SUPPLY" ? [["NO_GST", "No GST · Bill of Supply"]] : [["INTRA_STATE", "CGST + SGST · Intra-state"], ["INTER_STATE", "IGST · Inter-state"], ["NO_GST", "No GST"]]} /><Field label="Payment terms" value={paymentTerms} onChange={(value) => updateText(setPaymentTerms, value)} />{bankAccounts.length > 1 && <SelectField label="Invoice bank account" value={bankAccountId} onChange={(value) => { setBankAccountId(value); markDirty(); }} options={bankAccounts.map((account): DropdownOption => [account.id, `${account.bankName} · •••• ${account.accountNumber.slice(-4)}`])} />}</div></section>
        <section className="card form-card"><SectionHeading number="02" title="Customer" hint="Select a saved customer or add a new one" action={<button className="button mini secondary" onClick={onCreateCustomer}>+ Add customer</button>} />{customers.length ? <><label className="field"><span>Customer account</span><Dropdown searchable searchPlaceholder="Search customer name or GSTIN…" value={customerId} onChange={(value) => { const selectedCustomer = customers.find((item) => item.id === value); setCustomerId(value); if (type === "TAX_INVOICE" && selectedCustomer) setTaxMode((current) => current === "NO_GST" ? current : (selectedCustomer.stateCode === companyStateCode ? "INTRA_STATE" : "INTER_STATE")); markDirty(); }} ariaLabel="Customer account" options={[["", "Select customer"] as DropdownOption, ...customers.map((item): DropdownOption => [item.id, item.name + (item.gstin ? " · " + item.gstin : "")])]} /></label>{customer && <div className="customer-picker"><div className="customer-avatar">{initials(customer.name)}</div><div className="customer-summary"><strong>{customer.name}</strong><span>{customer.gstin ? "GSTIN: " + customer.gstin + " · " : ""}{customer.state}</span></div><button className="change-button" onClick={() => { setCustomerId(""); markDirty(); }}>Change customer</button></div>}</> : <EmptyState title="No customers yet" description="Create a customer before preparing an invoice." action={<button className="button secondary" onClick={onCreateCustomer}>Create customer</button>} />}</section>
        <section className="card form-card"><SectionHeading number="03" title="Other details" hint="Reference, order, dispatch, and delivery information" /><div className="form-grid three"><Field label="Reference number" value={referenceNumber} placeholder="Optional" onChange={(value) => updateText(setReferenceNumber, value)} /><Field label="Reference date" value={referenceDate} type="date" placeholder="Optional" onChange={(value) => updateText(setReferenceDate, value)} /><Field label="Buyer's order no." value={buyerOrderNumber} placeholder="Optional" onChange={(value) => updateText(setBuyerOrderNumber, value)} /><Field label="Order date" value={buyerOrderDate} type="date" onChange={(value) => updateText(setBuyerOrderDate, value)} /><Field label="Dispatch document no." value={dispatchDocumentNumber} placeholder="Optional" onChange={(value) => updateText(setDispatchDocumentNumber, value)} /><Field label="Delivery note date" value={deliveryNoteDate} type="date" onChange={(value) => updateText(setDeliveryNoteDate, value)} /><Field label="Dispatched through" value={dispatchedThrough} placeholder="Optional" onChange={(value) => updateText(setDispatchedThrough, value)} />{transporters.length ? <label className="field"><span>Transporter</span><Dropdown searchable searchPlaceholder="Search transporter…" value={transporters.some((transporter) => transporter.name === transporterName) ? transporterName : ""} onChange={(value) => updateText(setTransporterName, value)} ariaLabel="Transporter" options={[["", "Select transporter"] as DropdownOption, ...transporters.map((transporter): DropdownOption => [transporter.name, transporter.name])]} /></label> : <Field label="Transporter" value={transporterName} placeholder="Optional" onChange={(value) => updateText(setTransporterName, value)} />}<Field label="Destination" value={destination} placeholder="Optional" onChange={(value) => updateText(setDestination, value)} /><Field label="Bill of lading" value={billOfLadingNumber} placeholder="Optional" onChange={(value) => updateText(setBillOfLadingNumber, value)} /><Field label="LR / RR number" value={lrRrNumber} placeholder="Optional" onChange={(value) => updateText(setLrRrNumber, value)} /><Field label="Motor vehicle no." value={vehicleNumber} placeholder="Optional" onChange={(value) => updateText(setVehicleNumber, value)} /><Field label="Delivery terms" value={termsOfDelivery} onChange={(value) => updateText(setTermsOfDelivery, value)} /></div></section>
        <section className="card form-card items-card"><SectionHeading number="04" title="Items" hint="Products are checked against current inventory" action={<button className="button mini secondary" onClick={addItem} disabled={!products.length}>+ Add item</button>} />{products.length ? <div className="items-table-wrap"><table className="items-table"><thead><tr><th>#</th><th>Product / HSN</th><th>Qty</th><th>Unit</th><th>Rate</th><th>GST</th><th>Amount</th><th /></tr></thead><tbody>{items.map((item, index) => { const product = products.find((candidate) => candidate.id === item.productId); const amount = Number(item.quantity || 0) * Number(item.rate || 0) * (1 + (activeTaxMode === "NO_GST" ? 0 : Number(item.gstPercent || 0)) / 100); return <tr key={item.key}><td className="muted-cell">{String(index + 1).padStart(2, "0")}</td><td><Dropdown searchable searchPlaceholder="Search product…" className="dropdown-table product-input" value={item.productId} onChange={(value) => selectProduct(item.key, value)} ariaLabel={"Product for item " + (index + 1)} options={[["", "Select product"] as DropdownOption, ...products.map((candidate): DropdownOption => [candidate.id, candidate.name])]} /><span className="table-subinput">{product?.hsnSac ?? "HSN/SAC"} · stock {product?.currentStock ?? "0"} {product?.unit ?? ""}</span></td><td><input className="table-input compact" type="number" min="0.01" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value })} /></td><td><span className="unit-cell">{product?.unit ?? "—"}</span></td><td><input className="table-input compact" type="number" min="0" value={item.rate} onChange={(event) => updateItem(item.key, { rate: event.target.value })} /></td><td><input className="table-input compact" type="number" min="0" value={item.gstPercent} disabled={activeTaxMode === "NO_GST"} onChange={(event) => updateItem(item.key, { gstPercent: event.target.value })} /></td><td className="amount-cell">{money(amount)}</td><td><button className="remove-button" aria-label={"Remove item " + (index + 1)} onClick={() => { setItems((current) => current.filter((candidate) => candidate.key !== item.key)); markDirty(); }}>×</button></td></tr>; })}</tbody></table></div> : <EmptyState title="No products yet" description="Create a product with opening stock before issuing an invoice." action={<button className="button secondary" onClick={onCreateProduct}>Create product</button>} />}</section>
      </div>
      <aside className="invoice-summary-column"><section className="card summary-card"><div className="summary-top"><div><span className="eyebrow">LIVE SUMMARY</span><h2>Invoice total</h2></div><span className="status-pill draft">Draft</span></div><div className="summary-total">{money(totals.total)}</div><div className="summary-detail"><div><span>Taxable value</span><strong>{money(totals.taxable)}</strong></div><div><span>CGST / SGST</span><strong>{activeTaxMode === "INTRA_STATE" ? money(totals.tax / 2) + " / " + money(totals.tax / 2) : "—"}</strong></div><div><span>IGST</span><strong>{activeTaxMode === "INTER_STATE" ? money(totals.tax) : "—"}</strong></div></div><div className="summary-grand"><span>Grand total</span><strong>{money(totals.total)}</strong></div><div className="amount-words"><span>AMOUNT IN WORDS</span><p>Calculated precisely by the server when saved or issued.</p></div><button className="button issue-button" disabled={busy || !customers.length || !products.length} onClick={() => void save(true, false)}>{busy ? "Processing…" : "Issue invoice →"}</button><p className="secure-note">Issuing locks financial details, inventory, and audit trail.</p></section><section className="card checklist-card"><div className="checklist-heading"><h3>Ready to issue?</h3><span>{(customerId ? 1 : 0) + (items.length ? 1 : 0) + (products.length ? 1 : 0)} / 3</span></div><Checklist label="Customer selected" done={Boolean(customerId)} /><Checklist label="Products available" done={Boolean(products.length && items.length)} /><Checklist label="Stock checked on issue" done={Boolean(products.length && items.length)} /></section></aside>
    </div>
  </>;
}

function InvoicesView({ invoices, loading, onRefresh, onCreate, onEditDraft, onDeleteDraft, onPay, onCancel, onEwayBill }: { invoices: InvoiceSummary[]; loading: boolean; onRefresh: () => void; onCreate: () => void; onEditDraft: (invoice: InvoiceSummary) => void; onDeleteDraft: (invoice: InvoiceSummary) => Promise<void>; onPay: (invoice: InvoiceSummary) => void; onCancel: (invoice: InvoiceSummary) => void; onEwayBill: (invoice: InvoiceSummary) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [month, setMonth] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [page, setPage] = useState(1);
  const [remoteRows, setRemoteRows] = useState<InvoiceSummary[]>(invoices);
  const [total, setTotal] = useState(invoices.length);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const pageSize = 25;
  const currentFiscalYearStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const yearOptions = useMemo<DropdownOption[]>(() => [["ALL", "All years"], ...Array.from({ length: 8 }, (_, index): DropdownOption => { const startYear = currentFiscalYearStart - index; const value = `${startYear}-${startYear + 1}`; return [value, value]; })], [currentFiscalYearStart]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      if (status !== "ALL") params.set("status", status);
      if (year !== "ALL") {
        const range = periodRange(month, year);
        params.set("from", range.from);
        params.set("to", range.to);
      } else if (month !== "ALL") {
        params.set("month", month);
      }
      setRemoteLoading(true);
      void api<{ data: InvoiceSummary[]; total: number }>(`/api/invoices?${params.toString()}`).then((result) => { if (active) { setRemoteRows(result.data); setTotal(result.total); } }).catch(() => { if (active) { setRemoteRows(page === 1 ? invoices : []); setTotal(page === 1 ? invoices.length : 0); } }).finally(() => { if (active) setRemoteLoading(false); });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [invoices, month, page, query, status, year]);
  const filtered = remoteRows;
  const filteredValue = filtered.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(query.trim() || status !== "ALL" || month !== "ALL" || year !== "ALL");
  const clearFilters = () => { setQuery(""); setStatus("ALL"); setMonth("ALL"); setYear("ALL"); setPage(1); };
  return <><PageHeading eyebrow="OPERATIONS / DOCUMENTS" title="All invoices" description="Search, filter, preview, collect, and manage issued billing documents." actions={<><button className="button secondary" onClick={onRefresh}>Refresh</button><button className="button primary" onClick={onCreate}>+ Create invoice</button></>} />
    <section className="card invoice-register">
      <div className="invoice-register-heading"><div><span className="eyebrow">DOCUMENT REGISTER</span><h2>Invoice archive</h2><p>Search and filter the full server-side invoice archive.</p></div><div className="invoice-register-count"><strong>{total}</strong><span>matching records</span></div></div>
      <div className="report-tabs invoice-status-tabs" role="tablist" aria-label="Filter by status">{([["ALL", "All"], ["DRAFT", "Draft"], ["ISSUED", "Issued"], ["PARTIALLY_PAID", "Partially paid"], ["PAID", "Paid"], ["OVERDUE", "Overdue"], ["CANCELLED", "Cancelled"]] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={status === value} className={status === value ? "active" : ""} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div>
      <div className="invoice-filters"><label className="invoice-search"><span aria-hidden="true">⌕</span><input aria-label="Search invoices" placeholder="Search invoice, customer, vehicle, GSTIN, or LR/RR" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><Dropdown className="invoice-filter-dropdown" value={month} onChange={(value) => { setMonth(value); setPage(1); }} ariaLabel="Filter by month" options={monthOptions} /><Dropdown className="invoice-filter-dropdown year-filter" value={year} onChange={(value) => { setYear(value); setPage(1); }} ariaLabel="Filter by year" options={yearOptions} />{hasFilters && <button className="clear-filter-button" type="button" onClick={clearFilters}>Clear filters</button>}</div>
      <div className="invoice-register-meta"><span>{hasFilters ? "Showing filtered results" : "Showing every invoice"}</span><strong>{money(filteredValue)} total value</strong></div>
      {loading || remoteLoading ? <LoadingState /> : filtered.length ? <><InvoiceTable className="invoice-register-table" invoices={filtered} onEditDraft={onEditDraft} onDeleteDraft={onDeleteDraft} onPay={onPay} onCancel={onCancel} onEwayBill={onEwayBill} /><div className="pagination-bar"><span>Page {page} of {totalPages}</span><div><button className="button mini secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className="button mini secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></div></> : <EmptyState title="No matching invoices" description="Try a different search term or clear the filters to see the full archive." action={hasFilters ? <button className="button secondary" onClick={clearFilters}>Clear filters</button> : <button className="button secondary" onClick={onCreate}>Create invoice</button>} />}
    </section></>;
}

function CustomersView({ customers, loading, onAdd, onEdit, onDisable, onRefresh }: { customers: Customer[]; loading: boolean; onAdd: () => void; onEdit: (customer: Customer) => void; onDisable: (customer: Customer) => Promise<void>; onRefresh: () => void }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(1); const [rows, setRows] = useState<Customer[]>(customers); const [total, setTotal] = useState(customers.length); const [busy, setBusy] = useState(false); const pageSize = 25;
  useEffect(() => { let active = true; const timer = window.setTimeout(() => { setBusy(true); const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }); if (query.trim()) params.set("q", query.trim()); void api<{ data: Customer[]; total: number }>(`/api/customers?${params}`).then((result) => { if (active) { setRows(result.data); setTotal(result.total); } }).catch(() => { if (active) { setRows(page === 1 ? customers : []); setTotal(page === 1 ? customers.length : 0); } }).finally(() => { if (active) setBusy(false); }); }, 200); return () => { active = false; window.clearTimeout(timer); }; }, [customers, page, query]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <><PageHeading eyebrow="MASTER DATA / BUYERS" title="Customers" description="Manage customer accounts used by invoices and receivables." actions={<><button className="button secondary" onClick={onRefresh}>Refresh</button><button className="button primary" onClick={onAdd}>+ Add customer</button></>} /><section className="card table-card"><label className="master-search"><span>Search customers</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, GSTIN, or phone" /></label>{loading || busy ? <LoadingState /> : rows.length ? <><table className="data-table"><thead><tr><th>Customer</th><th>GSTIN</th><th>Location</th><th>Phone</th><th>Credit terms</th><th /></tr></thead><tbody>{rows.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><span>{customer.billingAddress}</span></td><td>{customer.gstin || "Unregistered"}</td><td>{customer.city}, {customer.state}</td><td>{customer.phone || "—"}</td><td>{customer.creditPeriod || 0} days</td><td className="row-actions"><button className="text-button" onClick={() => onEdit(customer)}>Edit</button><button className="text-button danger-text" onClick={() => void onDisable(customer)}>Disable</button></td></tr>)}</tbody></table><div className="pagination-bar"><span>{total} customers · page {page} of {totalPages}</span><div><button className="button mini secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button mini secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></> : <EmptyState title="No customers yet" description="Add your first customer account to start billing." action={<button className="button primary" onClick={onAdd}>Add customer</button>} />}</section></>;
}

function ProductsView({ products, loading, onAdd, onEdit, onDisable, onRefresh }: { products: Product[]; loading: boolean; onAdd: () => void; onEdit: (product: Product) => void; onDisable: (product: Product) => Promise<void>; onRefresh: () => void }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(1); const [rows, setRows] = useState<Product[]>(products); const [total, setTotal] = useState(products.length); const [busy, setBusy] = useState(false); const pageSize = 25;
  useEffect(() => { let active = true; const timer = window.setTimeout(() => { setBusy(true); const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }); if (query.trim()) params.set("q", query.trim()); void api<{ data: Product[]; total: number }>(`/api/products?${params}`).then((result) => { if (active) { setRows(result.data); setTotal(result.total); } }).catch(() => { if (active) { setRows(page === 1 ? products : []); setTotal(page === 1 ? products.length : 0); } }).finally(() => { if (active) setBusy(false); }); }, 200); return () => { active = false; window.clearTimeout(timer); }; }, [page, products, query]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <><PageHeading eyebrow="MASTER DATA / CATALOGUE" title="Products" description="Maintain rates, GST, HSN/SAC, and live stock availability." actions={<><button className="button secondary" onClick={onRefresh}>Refresh</button><button className="button primary" onClick={onAdd}>+ Add product</button></>} /><section className="card table-card"><label className="master-search"><span>Search products</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, SKU, or HSN/SAC" /></label>{loading || busy ? <LoadingState /> : rows.length ? <><table className="data-table"><thead><tr><th>Product</th><th>SKU / HSN</th><th>Unit</th><th>Default rate</th><th>GST</th><th>Available stock</th><th /></tr></thead><tbody>{rows.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><span>{product.sku || "No SKU"}</span></td><td>{product.hsnSac}</td><td>{product.unit}</td><td>{money(product.defaultRate)}</td><td>{product.gstRate}%</td><td><strong className={Number(product.currentStock || 0) <= Number(product.minimumStock || 0) ? "stock-alert" : ""}>{product.currentStock || "0"} {product.unit}</strong></td><td className="row-actions"><button className="text-button" onClick={() => onEdit(product)}>Edit</button><button className="text-button danger-text" onClick={() => void onDisable(product)}>Disable</button></td></tr>)}</tbody></table><div className="pagination-bar"><span>{total} products · page {page} of {totalPages}</span><div><button className="button mini secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button mini secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></> : <EmptyState title="No products yet" description="Add a product with opening stock to make it invoiceable." action={<button className="button primary" onClick={onAdd}>Add product</button>} />}</section></>;
}

function InventoryView({ rows, products, loading, onAdjust, onRefresh }: { rows: unknown[]; products: Product[]; loading: boolean; onAdjust: () => void; onRefresh: () => void }) {
  return <><PageHeading eyebrow="OPERATIONS / STOCK" title="Inventory" description="Ledger-derived stock position across your active catalogue." actions={<><button className="button secondary" onClick={onRefresh}>Refresh inventory</button><button className="button primary" disabled={!products.length} onClick={onAdjust}>Adjust stock</button></>} /><section className="card table-card">{loading ? <LoadingState /> : rows.length ? <table className="data-table"><thead><tr><th>Product</th><th>Opening</th><th>Stock in</th><th>Stock out</th><th>Closing</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={item.id || index}><td><strong>{item.name}</strong><span>{item.sku || "No SKU"} · {item.unit}</span></td><td>{item.openingStock}</td><td>{item.stockIn}</td><td>{item.stockOut}</td><td><strong className={Number(item.closingStock) <= Number(item.minimumStock) ? "stock-alert" : ""}>{item.closingStock}</strong></td></tr>; })}</tbody></table> : <EmptyState title="No inventory records" description="Add products with opening stock to see the ledger." />}</section></>;
}

function PaymentsView({ rows, loading, onPay, onReverse, onRefresh }: { rows: unknown[]; loading: boolean; onPay: (invoice: InvoiceSummary) => void; onReverse: (payment: PaymentSummary) => void; onRefresh: () => void }) {
  const invoices = rows as Array<InvoiceSummary & { outstanding: string; age: number }>;
  const [tab, setTab] = useState<"outstanding" | "recorded">("outstanding");
  const [outstandingQuery, setOutstandingQuery] = useState("");
  const filteredInvoices = useMemo(() => {
    const q = outstandingQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((invoice) => (invoice.invoiceNumber ?? "").toLowerCase().includes(q) || invoice.buyerName.toLowerCase().includes(q));
  }, [invoices, outstandingQuery]);
  const [payments, setPayments] = useState<PaymentSummary[]>([]);
  const [paymentQuery, setPaymentQuery] = useState("");
  const [paymentFrom, setPaymentFrom] = useState("");
  const [paymentTo, setPaymentTo] = useState("");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(paymentPage), pageSize: "25" });
    if (paymentQuery.trim()) params.set("q", paymentQuery.trim());
    if (paymentFrom) params.set("from", paymentFrom);
    if (paymentTo) params.set("to", paymentTo);
    void api<{ data: PaymentSummary[]; total: number }>("/api/payments?" + params.toString()).then(({ data, total }) => { if (active) { setPayments(data); setPaymentTotal(total); } }).catch(() => { /* outstanding balances remain usable if history is unavailable */ });
    return () => { active = false; };
  }, [paymentFrom, paymentPage, paymentQuery, paymentRefresh, paymentTo]);
  const paymentPages = Math.max(1, Math.ceil(paymentTotal / 25));
  return <><PageHeading eyebrow="RECEIVABLES / COLLECTIONS" title="Payments" description="Track outstanding balances and keep a reversible payment ledger." actions={<button className="button secondary" onClick={() => { onRefresh(); setPaymentRefresh((value) => value + 1); }}>Refresh balances</button>} />
    <div className="report-tabs" role="tablist" aria-label="Payments view"><button role="tab" aria-selected={tab === "outstanding"} className={tab === "outstanding" ? "active" : ""} onClick={() => setTab("outstanding")}>Outstanding invoices</button><button role="tab" aria-selected={tab === "recorded"} className={tab === "recorded" ? "active" : ""} onClick={() => setTab("recorded")}>Recorded payments</button></div>
    {tab === "outstanding" && <section className="card table-card"><div className="card-toolbar"><div><span className="eyebrow">COLLECTION QUEUE</span><h2>Outstanding invoices</h2></div></div><label className="master-search"><span>Search outstanding</span><input value={outstandingQuery} onChange={(event) => setOutstandingQuery(event.target.value)} placeholder="Invoice number or customer name" /></label>{loading ? <LoadingState /> : filteredInvoices.length ? <table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Age</th><th>Grand total</th><th>Outstanding</th><th /></tr></thead><tbody>{filteredInvoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber || "Draft"}</strong><span>{shortDate(invoice.invoiceDate)}</span></td><td>{invoice.buyerName}</td><td>{invoice.age} days</td><td>{money(invoice.grandTotal)}</td><td><strong className="stock-alert">{money(invoice.outstanding)}</strong></td><td><button className="button mini primary" onClick={() => onPay(invoice)}>Record payment</button></td></tr>)}</tbody></table> : <EmptyState title={invoices.length ? "No matching invoices" : "Nothing outstanding"} description={invoices.length ? "Try a different search term." : "All issued invoices are fully collected."} />}</section>}
    {tab === "recorded" && <section className="card table-card"><div className="card-toolbar"><div><span className="eyebrow">PAYMENT LEDGER</span><h2>Recorded payments</h2></div></div><div className="report-filters"><label className="report-filter-field payment-search-field"><span>Search ledger</span><input value={paymentQuery} onChange={(event) => { setPaymentQuery(event.target.value); setPaymentPage(1); }} placeholder="Invoice, customer, or reference" /></label><CalendarField label="From" value={paymentFrom} onChange={(value) => { setPaymentFrom(value); setPaymentPage(1); }} /><CalendarField label="To" value={paymentTo} onChange={(value) => { setPaymentTo(value); setPaymentPage(1); }} /></div>{payments.length ? <><table className="data-table"><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Method</th><th /></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{shortDate(payment.paymentDate)}</td><td>{payment.invoice?.invoiceNumber || "—"}</td><td>{payment.invoice?.buyerName || "—"}</td><td>{money(payment.amount)}</td><td>{payment.method.replaceAll("_", " ")}</td><td>{payment.reversedAt ? <span className="status-pill cancelled">Reversed</span> : <button className="text-button danger-text" onClick={() => onReverse(payment)}>Reverse</button>}</td></tr>)}</tbody></table><div className="pagination-bar"><span>{paymentTotal} payments · page {paymentPage} of {paymentPages}</span><div><button className="button mini secondary" disabled={paymentPage <= 1} onClick={() => setPaymentPage((value) => value - 1)}>Previous</button><button className="button mini secondary" disabled={paymentPage >= paymentPages} onClick={() => setPaymentPage((value) => value + 1)}>Next</button></div></div></> : <EmptyState title="No payments found" description="Try a different search or date range, or record a payment against an outstanding invoice." />}</section>}</>;
}

function TransportersView({ transporters, loading, onRefresh, onAdd, onEdit, onDisable }: { transporters: Transporter[]; loading: boolean; onRefresh: () => void; onAdd: () => void; onEdit: (transporter: Transporter) => void; onDisable: (transporter: Transporter) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const rows = transporters.filter((transporter) => [transporter.name, transporter.contactPerson, transporter.phone, transporter.gstin].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <><PageHeading eyebrow="MASTER DATA / LOGISTICS" title="Transporters" description="Maintain approved carriers for dispatch and invoice delivery details." actions={<><button className="button secondary" onClick={onRefresh}>Refresh</button><button className="button primary" onClick={onAdd}>+ Add transporter</button></>} /><section className="card table-card"><label className="master-search"><span>Search transporters</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, or GSTIN" /></label>{loading ? <LoadingState /> : rows.length ? <table className="data-table"><thead><tr><th>Transporter</th><th>Contact person</th><th>Phone</th><th>GSTIN</th><th /></tr></thead><tbody>{rows.map((transporter) => <tr key={transporter.id}><td><strong>{transporter.name}</strong><span>{transporter.address || "No address"}</span></td><td>{transporter.contactPerson || "—"}</td><td>{transporter.phone || "—"}</td><td>{transporter.gstin || "Unregistered"}</td><td className="row-actions"><button className="text-button" onClick={() => onEdit(transporter)}>Edit</button><button className="text-button danger-text" onClick={() => void onDisable(transporter)}>Disable</button></td></tr>)}</tbody></table> : <EmptyState title="No transporters found" description="Add a transporter to reuse logistics details across invoices." action={<button className="button primary" onClick={onAdd}>Add transporter</button>} />}</section></>;
}

function TransporterModal({ transporter, onClose, onSaved, onError }: { transporter?: Transporter | null; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [form, setForm] = useState(() => ({ name: transporter?.name ?? "", contactPerson: transporter?.contactPerson ?? "", phone: transporter?.phone ?? "", gstin: transporter?.gstin ?? "", address: transporter?.address ?? "" }));
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api(transporter ? "/api/transporters/" + transporter.id : "/api/transporters", { method: transporter ? "PUT" : "POST", headers: { Origin: window.location.origin }, body: JSON.stringify({ ...form, contactPerson: form.contactPerson || undefined, phone: form.phone || undefined, gstin: form.gstin || undefined, address: form.address || undefined }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to save transporter."); } finally { setBusy(false); } };
  return <Modal title={transporter ? "Edit transporter" : "Add transporter"} description="Save approved carrier details for future dispatches." onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Transporter name" value={form.name} onChange={(value) => update("name", value)} /><Field label="Contact person" value={form.contactPerson} placeholder="Optional" onChange={(value) => update("contactPerson", value)} /><Field label="Phone" value={form.phone} placeholder="Optional" onChange={(value) => update("phone", value)} /><Field label="GSTIN" value={form.gstin} placeholder="Optional" onChange={(value) => update("gstin", value)} /><Field label="Address" value={form.address} placeholder="Optional" onChange={(value) => update("address", value)} /></div><ModalActions busy={busy} onClose={onClose} submitLabel={transporter ? "Save transporter" : "Add transporter"} /></form></Modal>;
}

function ReportsView({ kind, customers, rows, meta, loading, onSelect, onPageChange, onExport }: { kind: string; customers: Customer[]; rows: unknown[]; meta: ReportMeta | null; loading: boolean; onSelect: (kind: string) => void; onPageChange: (page: number) => void; onExport: (kind: string) => void }) {
  const labels: Record<string, string> = { sales: "Sales", outstanding: "Outstanding", gst: "GST summary", inventory: "Inventory", "product-sales": "Product sales", "customer-statement": "Customer statement" };
  const { reportName, customerId } = parseReportSelection(kind);
  const activeKind = reportName;
  const selectedCustomerId = customerId ?? customers[0]?.id ?? "";
  const currentFiscalYearStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const currentYear = `${currentFiscalYearStart}-${currentFiscalYearStart + 1}`;
  const initialPeriod = periodRange("ALL", currentYear);
  const [periodMonth, setPeriodMonth] = useState("ALL");
  const [periodYear, setPeriodYear] = useState(currentYear);
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const dateFilterable = ["sales", "gst", "product-sales", "customer-statement"].includes(activeKind);
  const yearOptions = useMemo<DropdownOption[]>(() => Array.from({ length: 6 }, (_, index): DropdownOption => { const startYear = currentFiscalYearStart - index; const year = `${startYear}-${startYear + 1}`; return [year, year]; }), [currentFiscalYearStart]);
  const applyPeriodPreset = (nextMonth: string, nextYear: string) => { const range = periodRange(nextMonth, nextYear); setPeriodMonth(nextMonth); setPeriodYear(nextYear); setFrom(range.from); setTo(range.to); };
  const applyDateRange = () => onSelect(reportSelection(activeKind, activeKind === "customer-statement" ? selectedCustomerId : undefined, from, to));
  const switchReport = (nextKind: string) => { const nextDateFilterable = ["sales", "gst", "product-sales", "customer-statement"].includes(nextKind); onSelect(reportSelection(nextKind, nextKind === "customer-statement" ? selectedCustomerId : undefined, nextDateFilterable ? from : undefined, nextDateFilterable ? to : undefined)); };
  return <><PageHeading eyebrow="INSIGHTS / REPORTING" title="Reports" description="Review decision-ready financial, tax, inventory, product, and customer summaries." actions={<button className="button secondary" onClick={() => onExport(kind)}>Export CSV</button>} />
    <div className="report-tabs">{Object.entries(labels).map(([value, label]) => <button className={activeKind === value ? "active" : ""} key={value} onClick={() => switchReport(value)}>{label}</button>)}</div>
    <section className="card report-control-panel"><div className="report-control-heading"><div><span className="eyebrow">REPORT FILTERS</span><h2>{labels[activeKind] ?? "Report"}</h2><p>{dateFilterable ? "Choose a month, year, or exact date range before loading the report." : "This report shows the current operational snapshot."}</p></div><span className="report-period-badge">{dateFilterable ? `${shortDate(from)} – ${shortDate(to)}` : "Current state"}</span></div>
      <div className="report-filters">{activeKind === "customer-statement" && <label className="report-filter-field"><span>Customer</span><Dropdown value={selectedCustomerId} onChange={(value) => onSelect(reportSelection(activeKind, value, from, to))} ariaLabel="Customer report filter" options={customers.map((customer): DropdownOption => [customer.id, customer.name])} /></label>}{dateFilterable && <><label className="report-filter-field"><span>Month</span><Dropdown value={periodMonth} onChange={(value) => applyPeriodPreset(value, periodYear)} ariaLabel="Report month" options={monthOptions} /></label><label className="report-filter-field"><span>Year</span><Dropdown value={periodYear} onChange={(value) => applyPeriodPreset(periodMonth, value)} ariaLabel="Report year" options={yearOptions} /></label><CalendarField label="From" value={from} onChange={setFrom} /><CalendarField label="To" value={to} onChange={setTo} /><button className="button primary report-apply-button" type="button" onClick={applyDateRange}>Apply period</button></>}{!dateFilterable && <div className="report-current-note"><span className="report-current-dot" />Live current-state data</div>}</div>
    </section>
    <section className="card table-card report-results-card">{loading ? <LoadingState /> : rows.length ? <><ReportTable kind={activeKind} rows={rows} />{meta && <div className="pagination-bar"><span>{meta.total} records · page {meta.page} of {Math.max(1, Math.ceil(meta.total / meta.pageSize))}</span><div><button className="button mini secondary" disabled={meta.page <= 1} onClick={() => onPageChange(Math.max(1, meta.page - 1))}>Previous</button><button className="button mini secondary" disabled={meta.page >= Math.max(1, Math.ceil(meta.total / meta.pageSize))} onClick={() => onPageChange(meta.page + 1)}>Next</button></div></div>}</> : <EmptyState title="No report data yet" description={dateFilterable ? "Try another month, year, or date range." : "Issue invoices or add inventory to populate this report."} />}</section></>;
}

function AuditView({ rows, loading, onRefresh }: { rows: unknown[]; loading: boolean; onRefresh: () => void }) {
  return <><PageHeading eyebrow="GOVERNANCE / HISTORY" title="Audit trail" description="Immutable records of important operational and financial changes." actions={<button className="button secondary" onClick={onRefresh}>Refresh log</button>} /><section className="card table-card">{loading ? <LoadingState /> : rows.length ? <table className="data-table"><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>User</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string> & { user?: { name?: string } | null }; return <tr key={item.id || index}><td>{item.createdAt ? shortDate(item.createdAt) : "—"}</td><td><strong>{item.action}</strong></td><td>{item.entityType} · {item.entityId}</td><td>{item.user?.name ?? "System"}</td></tr>; })}</tbody></table> : <EmptyState title="No audit events yet" description="Actions such as creating customers and issuing invoices will appear here." />}</section></>;
}

function InvoiceTable({ invoices, compact = false, className = "", onEditDraft, onDeleteDraft, onPay, onCancel, onEwayBill }: { invoices: InvoiceSummary[]; compact?: boolean; className?: string; onEditDraft?: (invoice: InvoiceSummary) => void; onDeleteDraft?: (invoice: InvoiceSummary) => Promise<void>; onPay?: (invoice: InvoiceSummary) => void; onCancel?: (invoice: InvoiceSummary) => void; onEwayBill?: (invoice: InvoiceSummary) => void }) {
  return <table className={"data-table " + className}><thead><tr><th>Invoice</th><th>Customer</th><th>Status</th><th>Total</th><th>Paid</th>{!compact && <th />}</tr></thead><tbody>{invoices.map((invoice) => { const financiallyActive = invoice.status !== "DRAFT" && invoice.status !== "CANCELLED"; return <tr key={invoice.id}><td><strong>{invoice.invoiceNumber || "Draft"}</strong><span>{shortDate(invoice.invoiceDate)}</span></td><td><strong>{invoice.buyerName}</strong><span>{invoice.vehicleNumber || invoice.lrRrNumber || "No delivery reference"}</span>{invoice.ewayBillStatus === "GENERATED" && <span className="eway-badge">EWB {invoice.ewayBillNumber}</span>}</td><td><span className={"status-pill " + invoice.status.toLowerCase()}>{invoice.status.replaceAll("_", " ")}</span></td><td><strong>{money(invoice.grandTotal)}</strong></td><td>{money(invoice.amountPaid)}</td>{!compact && <td className="row-actions"><button className="text-button" onClick={() => window.open("/api/invoices/" + invoice.id + "/pdf", "_blank")}>PDF</button>{invoice.status === "DRAFT" && onEditDraft && <button className="text-button" onClick={() => onEditDraft(invoice)}>Edit</button>}{invoice.status === "DRAFT" && onDeleteDraft && <button className="text-button danger-text" onClick={() => void onDeleteDraft(invoice)}>Delete</button>}{onEwayBill && financiallyActive && invoice.ewayBillStatus !== "GENERATED" && <button className="text-button" onClick={() => onEwayBill(invoice)}>E-way Bill</button>}{onPay && financiallyActive && Number(invoice.grandTotal) > Number(invoice.amountPaid) && <button className="text-button" onClick={() => onPay(invoice)}>Pay</button>}{onCancel && financiallyActive && invoice.status !== "PAID" && <button className="text-button danger-text" onClick={() => onCancel(invoice)}>Cancel</button>}</td>}</tr>; })}</tbody></table>;
}

function ReportTable({ kind, rows }: { kind: string; rows: unknown[] }) {
  if (kind === "sales") return <table className="data-table"><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Taxable</th><th>Tax</th><th>Total</th><th>Status</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={index}><td>{shortDate(item.invoiceDate)}</td><td>{item.invoiceNumber}</td><td>{item.buyerName}</td><td>{money(item.taxableAmount)}</td><td>{money(item.totalTax)}</td><td><strong>{money(item.grandTotal)}</strong></td><td>{item.status}</td></tr>; })}</tbody></table>;
  if (kind === "gst") return <table className="data-table"><thead><tr><th>HSN / SAC</th><th>GST %</th><th>Quantity</th><th>Taxable value</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={index}><td>{item.hsnSac}</td><td>{item.gstPercent}%</td><td>{item.quantity}</td><td>{money(item.taxableValue)}</td><td>{money(item.cgst)}</td><td>{money(item.sgst)}</td><td>{money(item.igst)}</td></tr>; })}</tbody></table>;
  if (kind === "outstanding") return <table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Age</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={index}><td>{item.invoiceNumber}</td><td>{item.buyerName}</td><td>{item.age} days</td><td><strong className="stock-alert">{money(item.outstanding)}</strong></td><td>{item.status}</td></tr>; })}</tbody></table>;
  if (kind === "product-sales") return <table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Quantity</th><th>Taxable value</th><th>Total</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={index}><td>{item.name}</td><td>{item.sku || "—"}</td><td>{item.unit}</td><td>{item.quantity}</td><td>{money(item.taxableValue)}</td><td><strong>{money(item.total)}</strong></td></tr>; })}</tbody></table>;
  if (kind === "customer-statement") return <table className="data-table"><thead><tr><th>Date</th><th>Invoice</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={index}><td>{shortDate(item.date)}</td><td>{item.invoiceNumber || "—"}</td><td>{item.description}</td><td>{money(item.debit)}</td><td>{money(item.credit)}</td><td><strong>{money(item.balance)}</strong></td></tr>; })}</tbody></table>;
  return <table className="data-table"><thead><tr><th>Product</th><th>Opening</th><th>In</th><th>Out</th><th>Closing</th></tr></thead><tbody>{rows.map((row, index) => { const item = row as Record<string, string>; return <tr key={index}><td>{item.name}</td><td>{item.openingStock}</td><td>{item.stockIn}</td><td>{item.stockOut}</td><td><strong>{item.closingStock}</strong></td></tr>; })}</tbody></table>;
}

function UsersView({ users, roles, permissions, loading, onRefresh, onAdd, onEdit }: { users: UserAccount[]; roles: AccessRole[]; permissions: Permission[]; loading: boolean; onRefresh: () => void; onAdd: () => void; onEdit: (user: UserAccount) => void }) {
  const [tab, setTab] = useState<"users" | "permissions">("users");
  return <><PageHeading eyebrow="ADMINISTRATION / ACCESS" title="Manage users" description="Add workspace users, assign roles, and review permission coverage." actions={<><button className="button secondary" onClick={onRefresh}>Refresh</button><button className="button primary" onClick={onAdd}>Add user <span>+</span></button></>} /><div className="report-tabs access-tabs" role="tablist" aria-label="Access management"><button className={tab === "users" ? "active" : ""} role="tab" aria-selected={tab === "users"} onClick={() => setTab("users")}>Users</button><button className={tab === "permissions" ? "active" : ""} role="tab" aria-selected={tab === "permissions"} onClick={() => setTab("permissions")}>Roles &amp; permissions</button></div>{tab === "users" && <section className="card table-card">{loading ? <LoadingState /> : users.length ? <table className="data-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><span>{user.email}</span></td><td>{user.roles.map((role) => role.name).join(", ") || "No role"}</td><td><span className={"status-pill " + user.status.toLowerCase()}>{user.status}</span></td><td>{shortDate(user.lastLoginAt)}</td><td>{shortDate(user.createdAt)}</td><td><button className="text-button" onClick={() => onEdit(user)}>Edit access</button></td></tr>)}</tbody></table> : <EmptyState title="No users found" description="There are no additional users in this billing workspace." />}</section>}{tab === "permissions" && <section className="card table-card"><div className="access-intro"><strong>Permission matrix</strong><span>These permissions are applied through each user&apos;s assigned role.</span></div>{roles.length ? <table className="data-table permission-table"><thead><tr><th>Role</th>{permissions.map((permission) => <th key={permission.id} title={permission.description ?? undefined}>{permission.key}</th>)}</tr></thead><tbody>{roles.map((role) => <tr key={role.id}><td><strong>{role.name}</strong><span>{role.description || "Workspace role"}</span></td>{permissions.map((permission) => <td key={permission.id}><span className={"permission-mark " + (role.permissions.some((item) => item.id === permission.id) ? "granted" : "")}>{role.permissions.some((item) => item.id === permission.id) ? "✓" : "—"}</span></td>)}</tr>)}</tbody></table> : <EmptyState title="No roles configured" description="Run the database seed to create the standard access roles." />}</section>}</>;
}

function UserModal({ user, roles, onClose, onSaved, onError }: { user?: UserAccount | null; roles: AccessRole[]; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const defaultRole = roles.find((role) => role.name === "BILLING_STAFF") ?? roles.find((role) => role.name === "ADMIN") ?? roles[0];
  const [form, setForm] = useState(() => ({ name: user?.name ?? "", email: user?.email ?? "", password: "", status: user?.status ?? "ACTIVE", roleIds: user?.roles.map((role) => role.id) ?? (defaultRole ? [defaultRole.id] : []) }));
  const [busy, setBusy] = useState(false);
  const update = (key: "name" | "email" | "password" | "status", value: string) => setForm((current) => ({ ...current, [key]: value }));
  const toggleRole = (roleId: string) => setForm((current) => ({ ...current, roleIds: current.roleIds.includes(roleId) ? current.roleIds.filter((id) => id !== roleId) : [...current.roleIds, roleId] }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.roleIds.length) { onError("Select at least one role."); return; }
    if (!user && form.password.length < 12) { onError("A new user password must be at least 12 characters."); return; }
    setBusy(true);
    try {
      await api(user ? "/api/users/" + user.id : "/api/users", { method: user ? "PATCH" : "POST", headers: { Origin: window.location.origin }, body: JSON.stringify({ name: form.name, email: form.email, status: form.status, roleIds: form.roleIds, ...(form.password ? { password: form.password } : {}) }) });
      await onSaved();
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to save user access."); }
    finally { setBusy(false); }
  };
  return <Modal title={user ? "Edit user access" : "Add user"} description="Create a secure workspace account and assign one or more roles." onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Full name" value={form.name} onChange={(value) => update("name", value)} /><Field label="Email address" value={form.email} type="email" onChange={(value) => update("email", value)} /><Field label={user ? "New password (optional)" : "Password"} value={form.password} type="password" placeholder={user ? "Leave blank to keep current password" : "Minimum 12 characters"} onChange={(value) => update("password", value)} /><SelectField label="Account status" value={form.status} onChange={(value) => update("status", value)} options={[["ACTIVE", "Active"], ["INACTIVE", "Inactive"]]} /></div><fieldset className="role-fieldset"><legend>Assign roles</legend><div className="role-check-grid">{roles.map((role) => <label className="role-check" key={role.id}><input type="checkbox" checked={form.roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} /><span><strong>{role.name}</strong><small>{role.description || "Workspace access role"}</small></span></label>)}</div></fieldset><ModalActions busy={busy} onClose={onClose} submitLabel={user ? "Save access" : "Add user"} /></form></Modal>;
}

function CompanySettings({ company, loading, onSaved, onError }: { company: CompanyProfile; loading: boolean; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [form, setForm] = useState(() => ({ name: company.name, addressLine1: company.addressLine1, addressLine2: company.addressLine2 ?? "", city: company.city, district: company.district ?? "", state: company.state, stateCode: company.stateCode, pinCode: company.pinCode, gstin: company.gstin ?? "", pan: company.pan ?? "", phone: company.phone ?? "", email: company.email ?? "", website: company.website ?? "", logoUrl: company.logoUrl ?? "/velmayil-ventures-logo-pdf.png", defaultJurisdiction: company.defaultJurisdiction ?? "Coimbatore jurisdiction", invoicePrefix: company.invoicePrefix, defaultTerms: company.defaultTerms ?? "30 Days", declaration: company.declaration ?? "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.", authorizedSignatory: company.authorizedSignatory ?? "Authorised Signatory" }));
  const [bank, setBank] = useState(() => ({ bankName: company.bankAccount?.bankName ?? "", accountHolder: company.bankAccount?.accountHolder ?? "", accountNumber: company.bankAccount?.accountNumber ?? "", ifsc: company.bankAccount?.ifsc ?? "", branch: company.bankAccount?.branch ?? "", accountType: company.bankAccount?.accountType ?? "" }));
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => company.bankAccounts ?? (company.bankAccount ? [company.bankAccount] : []));
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updateBank = (key: keyof typeof bank, value: string) => setBank((current) => ({ ...current, [key]: value }));
  const refreshBankAccounts = async () => { try { setBankAccounts((await api<{ data: BankAccount[] }>("/api/company/bank-accounts")).data); } catch (error) { onError(error instanceof Error ? error.message : "Unable to load bank accounts."); } };
  const disableBankAccount = async (account: BankAccount) => { if (!window.confirm("Remove " + account.bankName + " from active invoice settings?")) return; try { await api("/api/company/bank-accounts/" + account.id, { method: "DELETE", headers: { Origin: window.location.origin } }); await refreshBankAccounts(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to remove bank account."); } };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await api("/api/company", { method: "PUT", headers: { Origin: window.location.origin }, body: JSON.stringify({ ...form, gstin: form.gstin || undefined, pan: form.pan || undefined, phone: form.phone || undefined, email: form.email || undefined, website: form.website || undefined, addressLine2: form.addressLine2 || undefined, district: form.district || undefined, logoUrl: form.logoUrl || undefined, defaultJurisdiction: form.defaultJurisdiction || undefined, defaultTerms: form.defaultTerms || undefined, declaration: form.declaration || undefined, authorizedSignatory: form.authorizedSignatory || undefined, bankAccount: bank.bankName && bank.accountHolder && bank.accountNumber && bank.ifsc ? { ...bank, branch: bank.branch || undefined, accountType: bank.accountType || undefined } : undefined }) });
      await onSaved();
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to save company settings."); }
    finally { setBusy(false); }
  };
  return <><PageHeading eyebrow="ADMINISTRATION / COMPANY" title="Company settings" description="These details appear on every invoice, PDF, and customer-facing document." actions={<button className="button primary" disabled={busy || loading} onClick={() => (document.getElementById("company-settings-form") as HTMLFormElement | null)?.requestSubmit()}>{busy ? "Saving…" : "Save settings"}</button>} /><form id="company-settings-form" className="settings-layout" onSubmit={submit}><section className="card form-card"><SectionHeading number="01" title="Company identity" hint="Legal identity and invoice numbering" /><div className="settings-brand-preview"><img src={form.logoUrl} alt="Velmayil Ventures logo" /><div><strong>{form.name}</strong><span>Logo asset: {form.logoUrl}</span></div></div><div className="form-grid two"><Field label="Company name" value={form.name} onChange={(value) => update("name", value)} /><Field label="Invoice prefix" value={form.invoicePrefix} onChange={(value) => update("invoicePrefix", value)} /><Field label="Logo URL" value={form.logoUrl} readOnly /><Field label="Jurisdiction" value={form.defaultJurisdiction} placeholder="Optional" onChange={(value) => update("defaultJurisdiction", value)} /></div></section><section className="card form-card"><SectionHeading number="02" title="Registered address" hint="Printed in the invoice header" /><div className="form-grid two"><Field label="Address line 1" value={form.addressLine1} onChange={(value) => update("addressLine1", value)} /><Field label="Address line 2" value={form.addressLine2} placeholder="Optional" onChange={(value) => update("addressLine2", value)} /><Field label="City" value={form.city} onChange={(value) => update("city", value)} /><Field label="District" value={form.district} placeholder="Optional" onChange={(value) => update("district", value)} /><Field label="State" value={form.state} onChange={(value) => update("state", value)} /><Field label="State code" value={form.stateCode} onChange={(value) => update("stateCode", value)} /><Field label="PIN code" value={form.pinCode} onChange={(value) => update("pinCode", value)} /><Field label="Phone" value={form.phone} placeholder="Optional" onChange={(value) => update("phone", value)} /><Field label="Email" value={form.email} placeholder="Optional" onChange={(value) => update("email", value)} /><Field label="Website" value={form.website} placeholder="Optional" onChange={(value) => update("website", value)} /></div></section><section className="card form-card"><SectionHeading number="03" title="Tax and bank details" hint="Printed in the tax header and bank section" /><div className="form-grid two"><Field label="GSTIN" value={form.gstin} placeholder="Optional" onChange={(value) => update("gstin", value)} /><Field label="PAN" value={form.pan} placeholder="Optional" onChange={(value) => update("pan", value)} /><Field label="Bank name" value={bank.bankName} onChange={(value) => updateBank("bankName", value)} /><Field label="Account holder" value={bank.accountHolder} onChange={(value) => updateBank("accountHolder", value)} /><Field label="Account number" value={bank.accountNumber} onChange={(value) => updateBank("accountNumber", value)} /><Field label="IFSC code" value={bank.ifsc} onChange={(value) => updateBank("ifsc", value)} /><Field label="Branch" value={bank.branch} placeholder="Optional" onChange={(value) => updateBank("branch", value)} /><Field label="Account type" value={bank.accountType} placeholder="Optional" onChange={(value) => updateBank("accountType", value)} /></div></section><section className="card form-card"><SectionHeading number="04" title="Additional bank accounts" hint="Keep more than one active account available for invoices" action={<button type="button" className="button mini secondary" onClick={() => setBankModalOpen(true)}>+ Add bank account</button>} />{bankAccounts.length ? <div className="settings-bank-list">{bankAccounts.map((account) => <div className="settings-bank-row" key={account.id}><div><strong>{account.bankName}</strong><span>{account.accountHolder} · •••• {account.accountNumber.slice(-4)} · {account.ifsc}</span></div><button type="button" className="text-button danger-text" onClick={() => void disableBankAccount(account)}>Remove</button></div>)}</div> : <EmptyState title="No additional accounts" description="The primary account above is optional; add active accounts as your banking setup grows." />}</section><section className="card form-card"><SectionHeading number="05" title="Invoice footer" hint="Declaration and signatory text" /><div className="form-grid two"><label className="field"><span>Default payment terms</span><textarea className="modal-textarea" value={form.defaultTerms} onChange={(event) => update("defaultTerms", event.target.value)} /></label><label className="field"><span>Declaration</span><textarea className="modal-textarea" value={form.declaration} onChange={(event) => update("declaration", event.target.value)} /></label><Field label="Authorised signatory" value={form.authorizedSignatory} onChange={(value) => update("authorizedSignatory", value)} /></div></section></form>{bankModalOpen && <BankAccountModal onClose={() => setBankModalOpen(false)} onSaved={async () => { setBankModalOpen(false); await refreshBankAccounts(); }} onError={onError} />}</>;
}

function BankAccountModal({ onClose, onSaved, onError }: { onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [form, setForm] = useState({ bankName: "", accountHolder: "", accountNumber: "", ifsc: "", branch: "", accountType: "" });
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api("/api/company/bank-accounts", { method: "POST", headers: { Origin: window.location.origin }, body: JSON.stringify({ ...form, branch: form.branch || undefined, accountType: form.accountType || undefined }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to add bank account."); } finally { setBusy(false); } };
  return <Modal title="Add bank account" description="This account can be selected for future invoice printing." onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Bank name" value={form.bankName} onChange={(value) => update("bankName", value)} /><Field label="Account holder" value={form.accountHolder} onChange={(value) => update("accountHolder", value)} /><Field label="Account number" value={form.accountNumber} onChange={(value) => update("accountNumber", value)} /><Field label="IFSC code" value={form.ifsc} onChange={(value) => update("ifsc", value)} /><Field label="Branch" value={form.branch} placeholder="Optional" onChange={(value) => update("branch", value)} /><Field label="Account type" value={form.accountType} placeholder="Optional" onChange={(value) => update("accountType", value)} /></div><ModalActions busy={busy} onClose={onClose} submitLabel="Add bank account" /></form></Modal>;
}

function CustomerModal({ customer, onClose, onSaved, onError }: { customer?: Customer | null; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [form, setForm] = useState(() => ({ name: customer?.name ?? "", billingAddress: customer?.billingAddress ?? "", deliveryAddress: customer?.deliveryAddress ?? "", city: customer?.city ?? "", district: customer?.district ?? "", state: customer?.state ?? "Tamil Nadu", stateCode: customer?.stateCode ?? "33", pinCode: customer?.pinCode ?? "", gstin: customer?.gstin ?? "", pan: customer?.pan ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "", creditLimit: customer?.creditLimit ?? "0", creditPeriod: String(customer?.creditPeriod ?? 0), openingBalance: customer?.openingBalance ?? "0", notes: customer?.notes ?? "" }));
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api(customer ? "/api/customers/" + customer.id : "/api/customers", { method: customer ? "PUT" : "POST", headers: { Origin: window.location.origin }, body: JSON.stringify({ ...form, creditPeriod: Number(form.creditPeriod || 0), gstin: form.gstin || undefined, pan: form.pan || undefined, phone: form.phone || undefined, email: form.email || undefined, pinCode: form.pinCode || undefined, deliveryAddress: form.deliveryAddress || undefined, district: form.district || undefined, notes: form.notes || undefined }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to save customer."); } finally { setBusy(false); } };
  return <Modal title={customer ? "Edit customer" : "Add customer"} description="Maintain the buyer account used for invoices and receivables." onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Customer name" value={form.name} onChange={(value) => update("name", value)} /><Field label="GSTIN" value={form.gstin} placeholder="Optional" onChange={(value) => update("gstin", value)} /><Field label="Billing address" value={form.billingAddress} onChange={(value) => update("billingAddress", value)} /><Field label="Delivery address" value={form.deliveryAddress} placeholder="Optional" onChange={(value) => update("deliveryAddress", value)} /><Field label="City" value={form.city} onChange={(value) => update("city", value)} /><Field label="District" value={form.district} placeholder="Optional" onChange={(value) => update("district", value)} /><Field label="State" value={form.state} onChange={(value) => update("state", value)} /><Field label="State code" value={form.stateCode} onChange={(value) => update("stateCode", value)} /><Field label="PIN code" value={form.pinCode} placeholder="Optional" onChange={(value) => update("pinCode", value)} /><Field label="Phone" value={form.phone} placeholder="Optional" onChange={(value) => update("phone", value)} /><Field label="Email" value={form.email} placeholder="Optional" onChange={(value) => update("email", value)} /><Field label="Credit limit" value={form.creditLimit} type="number" onChange={(value) => update("creditLimit", value)} /><Field label="Credit period (days)" value={form.creditPeriod} type="number" onChange={(value) => update("creditPeriod", value)} /><Field label="Opening balance" value={form.openingBalance} type="number" onChange={(value) => update("openingBalance", value)} /><Field label="Notes" value={form.notes} placeholder="Optional" onChange={(value) => update("notes", value)} /></div><ModalActions busy={busy} onClose={onClose} submitLabel={customer ? "Save customer" : "Create customer"} /></form></Modal>;
}

function ProductModal({ product, onClose, onSaved, onError }: { product?: Product | null; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [form, setForm] = useState(() => ({ name: product?.name ?? "", description: product?.description ?? "", sku: product?.sku ?? "", hsnSac: product?.hsnSac ?? "", unit: product?.unit ?? "QTY", defaultRate: product?.defaultRate ?? "", purchaseRate: product?.purchaseRate ?? "0", gstRate: product?.gstRate ?? "0", openingStock: product?.openingStock ?? "0", minimumStock: product?.minimumStock ?? "0" }));
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api(product ? "/api/products/" + product.id : "/api/products", { method: product ? "PUT" : "POST", headers: { Origin: window.location.origin }, body: JSON.stringify({ ...form, description: form.description || undefined, sku: form.sku || undefined }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to save product."); } finally { setBusy(false); } };
  return <Modal title={product ? "Edit product" : "Add product"} description="Maintain a catalogue item and its stock policy." onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Product name" value={form.name} onChange={(value) => update("name", value)} /><Field label="SKU" value={form.sku} placeholder="Optional" onChange={(value) => update("sku", value)} /><Field label="Description" value={form.description} placeholder="Optional" onChange={(value) => update("description", value)} /><Field label="HSN / SAC" value={form.hsnSac} onChange={(value) => update("hsnSac", value)} /><Field label="Unit" value={form.unit} onChange={(value) => update("unit", value)} /><Field label="Default rate" value={form.defaultRate} type="number" onChange={(value) => update("defaultRate", value)} /><Field label="Purchase rate" value={form.purchaseRate} type="number" onChange={(value) => update("purchaseRate", value)} /><Field label="GST %" value={form.gstRate} type="number" onChange={(value) => update("gstRate", value)} /><Field label="Minimum stock" value={form.minimumStock} type="number" onChange={(value) => update("minimumStock", value)} /></div>{!product && <p className="secure-note">New products start at zero stock. Use Adjust Stock on the Inventory page afterward to record what you already have on hand.</p>}<ModalActions busy={busy} onClose={onClose} submitLabel={product ? "Save product" : "Create product"} /></form></Modal>;
}

function PaymentModal({ invoice, onClose, onSaved, onError }: { invoice: InvoiceSummary & { outstanding?: string }; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [amount, setAmount] = useState(invoice.outstanding ?? String(Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid))));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api("/api/invoices/" + invoice.id + "/payments", { method: "POST", headers: { Origin: window.location.origin, "idempotency-key": newKey() + newKey() }, body: JSON.stringify({ invoiceId: invoice.id, amount, paymentDate: today(), method, referenceNumber: referenceNumber || undefined, idempotencyKey: newKey() + newKey() }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to record payment."); } finally { setBusy(false); } };
  return <Modal title="Record payment" description={invoice.invoiceNumber + " · " + invoice.buyerName} onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Amount" value={amount} type="number" onChange={setAmount} /><SelectField label="Method" value={method} onChange={setMethod} options={[["BANK_TRANSFER", "Bank transfer"], ["UPI", "UPI"], ["CASH", "Cash"], ["CHEQUE", "Cheque"], ["CREDIT", "Credit"], ["OTHER", "Other"]]} /><Field label="Reference number" value={referenceNumber} placeholder="Optional" onChange={setReferenceNumber} /></div><ModalActions busy={busy} onClose={onClose} submitLabel="Record payment" /></form></Modal>;
}

function CancelModal({ invoice, onClose, onSaved, onError }: { invoice: InvoiceSummary; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api("/api/invoices/" + invoice.id + "/cancel", { method: "POST", headers: { Origin: window.location.origin, "idempotency-key": newKey() + newKey() }, body: JSON.stringify({ invoiceId: invoice.id, reason, idempotencyKey: newKey() + newKey() }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to cancel invoice."); } finally { setBusy(false); } };
  return <Modal title="Cancel invoice" description={invoice.invoiceNumber + " · This reverses the inventory movement."} onClose={onClose}><form onSubmit={submit}><label className="field"><span>Reason</span><textarea className="modal-textarea" minLength={10} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter a clear cancellation reason…" /></label><ModalActions busy={busy} onClose={onClose} submitLabel="Cancel invoice" danger /></form></Modal>;
}

function EwayBillModal({ invoice, onClose, onSaved, onError }: { invoice: InvoiceSummary; onClose: () => void; onSaved: (ewayBillNumber: string) => Promise<void>; onError: (message: string) => void }) {
  const [transportDistanceKm, setTransportDistanceKm] = useState("");
  const [transportMode, setTransportMode] = useState("ROAD");
  const [vehicleType, setVehicleType] = useState("REGULAR");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ data: { ewayBillNumber: string } }>("/api/invoices/" + invoice.id + "/eway-bill", { method: "POST", headers: { Origin: window.location.origin, "idempotency-key": newKey() + newKey() }, body: JSON.stringify({ transportDistanceKm: Number(transportDistanceKm), transportMode, vehicleType, idempotencyKey: newKey() + newKey() }) });
      await onSaved(result.data.ewayBillNumber);
    } catch (error) { onError(error instanceof Error ? error.message : "Unable to generate e-way bill."); }
    finally { setBusy(false); }
  };
  return <Modal title="Generate e-way bill" description={(invoice.invoiceNumber ?? "Invoice") + " · Submits to the configured GST Suvidha Provider, then opens the e-way bill portal."} onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><Field label="Transport distance (km)" value={transportDistanceKm} type="number" onChange={setTransportDistanceKm} /><SelectField label="Transport mode" value={transportMode} onChange={setTransportMode} options={[["ROAD", "Road"], ["RAIL", "Rail"], ["AIR", "Air"], ["SHIP", "Ship"]]} /><SelectField label="Vehicle type" value={vehicleType} onChange={setVehicleType} options={[["REGULAR", "Regular"], ["OVER_DIMENSIONAL_CARGO", "Over dimensional cargo"]]} /></div><p className="secure-note">Vehicle no., transporter, and dispatch details already on this invoice are reused automatically.</p><ModalActions busy={busy} onClose={onClose} submitLabel="Generate e-way bill" /></form></Modal>;
}

function InventoryAdjustmentModal({ products, onClose, onSaved, onError }: { products: Product[]; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [direction, setDirection] = useState("IN");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api("/api/inventory/adjustments", { method: "POST", headers: { Origin: window.location.origin, "idempotency-key": newKey() + newKey() }, body: JSON.stringify({ productId, direction, quantity, notes, idempotencyKey: newKey() + newKey() }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to adjust inventory."); } finally { setBusy(false); } };
  return <Modal title="Adjust inventory" description="Create an auditable stock movement. Outgoing adjustments cannot reduce stock below zero." onClose={onClose}><form onSubmit={submit}><div className="modal-grid"><SelectField label="Product" value={productId} onChange={setProductId} options={products.map((product) => [product.id, product.name])} /><SelectField label="Movement" value={direction} onChange={setDirection} options={[["IN", "Stock in"], ["OUT", "Stock out"]]} /><Field label="Quantity" value={quantity} type="number" onChange={setQuantity} /><Field label="Reason / notes" value={notes} onChange={setNotes} /></div><ModalActions busy={busy} onClose={onClose} submitLabel="Adjust stock" /></form></Modal>;
}

function PaymentReversalModal({ payment, onClose, onSaved, onError }: { payment: PaymentSummary; onClose: () => void; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api("/api/payments/" + payment.id + "/reverse", { method: "POST", headers: { Origin: window.location.origin, "idempotency-key": newKey() + newKey() }, body: JSON.stringify({ invoiceId: payment.invoiceId, reason, idempotencyKey: newKey() + newKey() }) }); await onSaved(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to reverse payment."); } finally { setBusy(false); } };
  return <Modal title="Reverse payment" description={(payment.invoice?.invoiceNumber || "Invoice") + " · " + money(payment.amount) + " · This preserves the original payment and recalculates the invoice balance."} onClose={onClose}><form onSubmit={submit}><label className="field"><span>Reversal reason</span><textarea className="modal-textarea" minLength={10} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the reason for reversing this payment…" /></label><ModalActions busy={busy} onClose={onClose} submitLabel="Reverse payment" danger /></form></Modal>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">VELMAYIL VENTURES</span><h2>{title}</h2><p>{description}</p>{children}</section></div>;
}

function ModalActions({ busy, onClose, submitLabel = "Save", danger = false }: { busy: boolean; onClose: () => void; submitLabel?: string; danger?: boolean }) {
  return <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className={"button " + (danger ? "danger-button" : "primary")} disabled={busy}>{busy ? "Saving…" : submitLabel}</button></div>;
}

function NavItem({ label, icon, active, onClick, count }: { label: NavKey; icon: string; active: boolean; onClick: () => void; count?: number }) { return <button className={"nav-item " + (active ? "active" : "")} onClick={onClick}><span className="nav-icon">{icon}</span><span>{label}</span>{typeof count === "number" && count > 0 && <span className="nav-count">{count}</span>}</button>; }
function SectionHeading({ number, title, hint, action }: { number: string; title: string; hint: string; action?: React.ReactNode }) { return <div className="section-heading"><div className="section-title"><span className="section-number">{number}</span><div><h2>{title}</h2><p>{hint}</p></div></div>{action}</div>; }
function Field({ label, value, onChange, readOnly = false, placeholder, type = "text" }: { label: string; value: string; onChange?: (value: string) => void; readOnly?: boolean; placeholder?: string; type?: string }) {
  if (type === "date") return <CalendarField label={label} value={value} onChange={onChange ?? (() => undefined)} placeholder={placeholder} />;
  return <label className={"field " + (placeholder && !value ? "placeholder-field" : "")}><span>{label}</span><input type={type} value={value} readOnly={readOnly} placeholder={placeholder} required={!placeholder && !readOnly} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

function CalendarField({ label, value, onChange, placeholder = "Select date" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => inputDate(value) ?? new Date(2026, 0, 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedDate = inputDate(value);
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const firstWeekday = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayValue = dateInputValue(new Date());
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const openCalendar = () => {
    setViewDate(selectedDate ?? new Date());
    setOpen(true);
  };
  const chooseDate = (day: number) => {
    onChange(dateInputValue(new Date(currentYear, currentMonth, day)));
    setOpen(false);
  };
  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") { event.preventDefault(); openCalendar(); }
    if (event.key === "Escape") setOpen(false);
  };

  return <label className={"field calendar-field-wrapper " + (!value && placeholder ? "placeholder-field" : "")}><span>{label}</span><div className="calendar-field" ref={rootRef}>
    <button type="button" className="calendar-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => open ? setOpen(false) : openCalendar()} onKeyDown={handleTriggerKeyDown}>
      <span>{value ? shortDate(value) : placeholder}</span><span className="calendar-icon" aria-hidden="true" />
    </button>
    {open && <div className="calendar-popover" role="dialog" aria-label={label + " calendar"}>
      <div className="calendar-header"><button type="button" className="calendar-nav" aria-label="Previous month" onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))}>‹</button><strong>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(viewDate)}</strong><button type="button" className="calendar-nav" aria-label="Next month" onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))}>›</button></div>
      <div className="calendar-weekdays">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={day + index}>{day}</span>)}</div>
      <div className="calendar-grid">{calendarDays.map((day, index) => day ? <button type="button" className={(value === dateInputValue(new Date(currentYear, currentMonth, day)) ? "selected " : "") + (todayValue === dateInputValue(new Date(currentYear, currentMonth, day)) ? "today" : "")} key={day} onClick={() => chooseDate(day)}>{day}</button> : <span className="calendar-empty" key={"empty-" + index} />)}</div>
      <div className="calendar-footer"><button type="button" className="calendar-link" onClick={() => { onChange(""); setOpen(false); }}>Clear</button><button type="button" className="calendar-link" onClick={() => { const now = new Date(); onChange(dateInputValue(now)); setViewDate(now); setOpen(false); }}>Today</button></div>
    </div>}
  </div></label>;
}

function Dropdown({ value, onChange, options, ariaLabel, className = "", searchable = false, searchPlaceholder = "Search options…" }: { value: string; onChange: (value: string) => void; options: DropdownOption[]; ariaLabel: string; className?: string; searchable?: boolean; searchPlaceholder?: string }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState<{ left: number; width: number; top?: number; bottom?: number }>({ left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex(([optionValue]) => optionValue === value));
  const selectedOption = options[selectedIndex];
  const visibleOptions = searchable && search.trim() ? options.filter(([, label]) => label.toLowerCase().includes(search.trim().toLowerCase())) : options;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const estimatedMenuHeight = 270;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedMenuHeight && rect.top > spaceBelow;
      setMenuPosition(openUpward ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 } : { left: rect.left, width: rect.width, top: rect.bottom + 6 });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open]);

  const choose = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setSearch("");
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((current) => event.key === "ArrowDown" ? Math.min(visibleOptions.length - 1, current + 1) : Math.max(0, current - 1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex(event.key === "Home" ? 0 : Math.max(0, visibleOptions.length - 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(visibleOptions[highlightedIndex]?.[0] ?? value);
      else { setOpen(true); setHighlightedIndex(Math.max(0, visibleOptions.findIndex(([optionValue]) => optionValue === value))); }
    }
  };

  return <div className={"dropdown " + className} ref={rootRef}>
    <button ref={triggerRef} type="button" className="dropdown-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => { setOpen((current) => !current); setHighlightedIndex(selectedIndex); }} onKeyDown={onTriggerKeyDown}>
      <span className={!selectedOption ? "dropdown-placeholder" : ""}>{selectedOption?.[1] ?? "Select an option"}</span>
      <span className="dropdown-chevron" aria-hidden="true" />
    </button>
    {open && createPortal(<div className="dropdown-menu dropdown-menu-portal" role="listbox" aria-label={ariaLabel} ref={menuRef} style={{ position: "fixed", left: menuPosition.left, width: menuPosition.width, top: menuPosition.top, bottom: menuPosition.bottom }}>
      {searchable && <input className="dropdown-search" autoFocus value={search} onChange={(event) => { setSearch(event.target.value); setHighlightedIndex(0); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter") { event.preventDefault(); choose(visibleOptions[highlightedIndex]?.[0] ?? value); } }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />}
      {visibleOptions.map(([optionValue, optionLabel], index) => <button type="button" role="option" aria-selected={optionValue === value} className={"dropdown-option " + (optionValue === value ? "selected " : "") + (index === highlightedIndex ? "highlighted" : "")} key={optionValue} onMouseEnter={() => setHighlightedIndex(index)} onClick={() => choose(optionValue)}>
        <span>{optionLabel}</span>
        {optionValue === value && <span className="dropdown-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>, document.body)}
  </div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: DropdownOption[] }) { return <label className="field"><span>{label}</span><Dropdown value={value} onChange={onChange} options={options} ariaLabel={label} /></label>; }
function Checklist({ label, done = false }: { label: string; done?: boolean }) { return <div className="check-item"><span className={"check-box " + (done ? "done" : "")}>{done ? "✓" : ""}</span><span>{label}</span>{done && <span className="check-status">Ready</span>}</div>; }
function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={"metric-card " + tone}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="empty-state"><strong>{title}</strong><p>{description}</p>{action}</div>; }
function LoadingState() { return <div className="empty-state"><strong>Loading workspace…</strong><p>Fetching the latest records from the local database.</p></div>; }
