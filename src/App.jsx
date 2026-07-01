import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import {
  Search, MapPin, Store, BarChart3, FileText, Sparkles, X,
  CheckCircle2, LogOut, Users, Database,
} from 'lucide-react';

import { CUSTOMERS_DATA } from './data/customers';
import {
  TARGET_THRESHOLD,
  getContracts,
  rowsFromContracts,
  summarize,
  initialActuals,
  actualKey,
  contractLabel,
} from './services/contracts';
import {
  subscribeToVisits,
  saveVisit as fbSaveVisit,
  deleteVisit as fbDeleteVisit,
} from './services/visits';
import { subscribeToReps } from './services/reps';
import { getSession, logout } from './services/auth';

import LoginScreen from './components/LoginScreen';
import CustomerPanel from './components/CustomerPanel';
import Dashboard from './components/Dashboard';
import VisitsLog from './components/VisitsLog';
import RepsManagement from './components/RepsManagement';
import IncompleteVisitModal from './components/IncompleteVisitModal';

const OLD_LOCAL_KEY = 'shelfspace_visits_v1';

export default function App() {
  // ===== Session / Auth =====
  const [session, setSession] = useState(() => getSession());

  // ===== Data from Firestore =====
  const [visits, setVisits] = useState([]);
  const [reps, setReps] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  // ===== UI State =====
  const [tab, setTab] = useState('rep');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [actuals, setActuals] = useState({});
  const [filterRegion, setFilterRegion] = useState('');
  const [filterChain, setFilterChain] = useState('');
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [toast, setToast] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);

  // ===== Migration banner =====
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  // ===== Online/offline detection =====
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ===== Subscribe to Firestore data when logged in =====
  useEffect(() => {
    if (!session) return;
    const unsubVisits = subscribeToVisits((list) => {
      setVisits(list);
      setLoadingVisits(false);
    });
    const unsubReps = subscribeToReps((list) => setReps(list));

    // Check if there's old localStorage data that hasn't been migrated
    try {
      const old = JSON.parse(localStorage.getItem(OLD_LOCAL_KEY) || '[]');
      if (Array.isArray(old) && old.length > 0) {
        setShowMigrationBanner(true);
      }
    } catch {}

    return () => {
      unsubVisits();
      unsubReps();
    };
  }, [session]);

  // ===== Region/Chain options for filters =====
  const regions = useMemo(
    () => [...new Set(CUSTOMERS_DATA.map((c) => c.region).filter(Boolean))].sort(),
    []
  );
  const chains = useMemo(
    () => [...new Set(CUSTOMERS_DATA.map((c) => c.chain).filter(Boolean))].sort(),
    []
  );

  // Agents (chains) limited to the region selected in the rep sidebar.
  // When no region is selected, show every agent.
  const sidebarChains = useMemo(() => {
    const source = filterRegion
      ? CUSTOMERS_DATA.filter((c) => c.region === filterRegion)
      : CUSTOMERS_DATA;
    return [...new Set(source.map((c) => c.chain).filter(Boolean))].sort();
  }, [filterRegion]);

  // ===== Reset actuals when customer changes =====
  useEffect(() => {
    // Skip resetting actuals when we're in edit mode — editVisit() has
    // already loaded the saved values and we don't want to overwrite them.
    if (editingVisitId) return;
    setActuals(selectedCustomer ? initialActuals(selectedCustomer) : {});
    setValidationErrors([]);
  }, [selectedCustomer, editingVisitId]);

  // ===== Customer search/filter =====
  const filtered = useMemo(() => {
    if (!searchQuery && !filterRegion && !filterChain) return [];
    const q = searchQuery.trim().toLowerCase();
    const seen = new Set();
    return CUSTOMERS_DATA.filter((c) => {
      if (filterRegion && c.region !== filterRegion) return false;
      if (filterChain && c.chain !== filterChain) return false;
      if (q && !(
        String(c.code).toLowerCase().includes(q) ||
        String(c.name).toLowerCase().includes(q) ||
        String(c.acc_code).toLowerCase().includes(q) ||
        String(c.address).toLowerCase().includes(q)
      )) return false;
      const key = [c.code, c.acc_code, c.name, c.address].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80);
  }, [searchQuery, filterRegion, filterChain]);

  // ===== Computed visit data =====
  const computed = useMemo(
    () => selectedCustomer
      ? summarize(rowsFromContracts(getContracts(selectedCustomer), actuals))
      : null,
    [selectedCustomer, actuals]
  );

  function getInputErrors(rows) {
    const errors = [];
    rows.forEach((r) => {
      if (r.type === 'percent' && Number(r.actualSpace) > Number(r.totalShelf)) {
        errors.push({ ...r, errorMsg: `الفعلي ${r.actualSpace} أكبر من الإجمالي ${r.totalShelf}` });
      } else if (r.type === 'check' && !r.applied && !(Number(r.notAppliedSpace) > 0)) {
        // "Not applied" requires the rep to record the actual measured space.
        errors.push({ ...r, errorMsg: 'برجاء إدخال المساحة الفعلية' });
      }
    });
    return errors;
  }

  // ===== Save visit to Firestore =====
  async function saveVisit() {
    if (!selectedCustomer || !computed || saving) return;

    const errors = getInputErrors(computed.rows);
    if (errors.length) {
      setValidationErrors(errors);
      const message = errors
        .map((r) => `- ${r.section} / ${r.name}: ${r.errorMsg}`)
        .join('\n');
      alert(`لا يمكن الحفظ قبل تصحيح الإدخال:\n${message}`);
      return;
    }

    setValidationErrors([]);
    setSaving(true);

    // Generate a deterministic visit ID based on customer + rep + day
    // This prevents duplicate visits if the rep saves the same customer
    // multiple times on the same day (re-saves will UPDATE instead of CREATE).
    // Different reps or different days produce different IDs.
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const safeName = (session.name || 'unknown').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    const safeCode = String(selectedCustomer.code || 'nocode').replace(/[^a-zA-Z0-9]/g, '_');
    const safeAccCode = String(selectedCustomer.acc_code || '').replace(/[^a-zA-Z0-9]/g, '_');
    const dailyId = `${todayStr}__${safeName}__${safeCode}__${safeAccCode}`;
    const visitId = String(editingVisitId || dailyId);

    const visit = {
      id: visitId,
      customer_code: selectedCustomer.code,
      customer_name: selectedCustomer.name,
      customer_address: selectedCustomer.address || '',
      region: selectedCustomer.region || '',
      chain: selectedCustomer.chain || '',
      merch_region: selectedCustomer.merch_region || '',
      acc_code: selectedCustomer.acc_code || '',
      rows: computed.rows,
      weightedAvg: computed.weightedAvg,
      simpleAvg: computed.simpleAvg,
      achieved: computed.weightedAvg >= TARGET_THRESHOLD,
      incomplete: false,
      savedBy: { name: session.name, role: session.role },
    };

    try {
      await fbSaveVisit(visit);
      setEditingVisitId(null);
      setToast({ type: 'success', message: 'تم الحفظ على Firebase ✓' });
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      console.error('Save failed:', e);
      setToast({ type: 'error', message: 'فشل الحفظ: ' + e.message });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  // ===== Save incomplete visit (with reason) =====
  async function saveIncompleteVisit({ reason, note }) {
    if (!selectedCustomer || saving) return;
    setSaving(true);

    // Deterministic ID: same customer + rep + day = update existing
    // Add "incomplete" suffix so a complete visit and an incomplete visit
    // for the same customer/day don't overwrite each other.
    const todayStr = new Date().toISOString().split('T')[0];
    const safeName = (session.name || 'unknown').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
    const safeCode = String(selectedCustomer.code || 'nocode').replace(/[^a-zA-Z0-9]/g, '_');
    const safeAccCode = String(selectedCustomer.acc_code || '').replace(/[^a-zA-Z0-9]/g, '_');
    const visitId = `${todayStr}__${safeName}__${safeCode}__${safeAccCode}__incomplete`;

    const visit = {
      id: visitId,
      customer_code: selectedCustomer.code,
      customer_name: selectedCustomer.name,
      customer_address: selectedCustomer.address || '',
      region: selectedCustomer.region || '',
      chain: selectedCustomer.chain || '',
      merch_region: selectedCustomer.merch_region || '',
      acc_code: selectedCustomer.acc_code || '',
      incomplete: true,
      incompleteReason: reason,
      incompleteNote: note || '',
      savedBy: { name: session.name, role: session.role },
    };

    try {
      await fbSaveVisit(visit);
      setShowIncompleteModal(false);
      setSelectedCustomer(null);
      setToast({ type: 'success', message: 'تم تسجيل الزيارة كملاحظة ✓' });
      setTimeout(() => setToast(null), 2000);
    } catch (e) {
      console.error('Save incomplete failed:', e);
      setToast({ type: 'error', message: 'فشل الحفظ: ' + e.message });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  function editVisit(v) {
    const customer =
      CUSTOMERS_DATA.find((c) => c.code === v.customer_code && c.name === v.customer_name) ||
      CUSTOMERS_DATA.find((c) => c.code === v.customer_code);
    if (!customer) {
      alert('لم يتم العثور على العميل في القائمة الحالية');
      return;
    }
    const loaded = {};
    v.rows.forEach((r) => {
      loaded[r.key || actualKey(r.source, r.name)] =
        r.type === 'check'
          ? { applied: !!r.applied, actualSpace: r.actualSpace ?? (r.applied ? 1 : (r.notAppliedSpace || 0)) }
          : { actual: r.actualSpace, total: r.totalShelf };
    });
    setSelectedCustomer(customer);
    setActuals(loaded);
    setEditingVisitId(v.id);
    setTab('rep');
  }

  function cancelEdit() {
    setEditingVisitId(null);
    if (selectedCustomer) setActuals(initialActuals(selectedCustomer));
  }

  async function handleDeleteVisit(visitId) {
    try {
      await fbDeleteVisit(visitId);
      setToast({ type: 'success', message: 'تم الحذف' });
      setTimeout(() => setToast(null), 1500);
    } catch (e) {
      setToast({ type: 'error', message: 'فشل الحذف: ' + e.message });
      setTimeout(() => setToast(null), 3000);
    }
  }

  // ===== Migrate localStorage visits to Firestore =====
  async function migrateLocalData() {
    try {
      const old = JSON.parse(localStorage.getItem(OLD_LOCAL_KEY) || '[]');
      if (!Array.isArray(old) || old.length === 0) {
        setShowMigrationBanner(false);
        return;
      }
      if (!confirm(`هل تريد رفع ${old.length} زيارة محفوظة محلياً إلى Firebase؟`)) {
        return;
      }
      let success = 0;
      for (const v of old) {
        try {
          await fbSaveVisit({
            ...v,
            savedBy: v.savedBy || { name: session.name, role: session.role },
          });
          success++;
        } catch (e) {
          console.error('Failed to migrate visit', v.id, e);
        }
      }
      alert(`تم رفع ${success} من ${old.length} زيارة بنجاح`);
      if (success === old.length) {
        localStorage.removeItem(OLD_LOCAL_KEY);
      }
      setShowMigrationBanner(false);
    } catch (e) {
      alert('فشلت عملية النقل: ' + e.message);
    }
  }

  function dismissMigration() {
    if (confirm('سيتم تجاهل البيانات المحلية. هل أنت متأكد؟')) {
      localStorage.removeItem(OLD_LOCAL_KEY);
      setShowMigrationBanner(false);
    }
  }

  // ===== Excel Export =====
  function exportXLSX() {
    // Exclude incomplete visits from Excel export entirely
    const baseVisits = visits.filter((v) => !v.incomplete);
    const visibleVisits = session?.role === 'rep'
      ? baseVisits.filter((v) => v.savedBy?.name === session.name)
      : baseVisits;

    if (visibleVisits.length === 0) {
      alert('لا توجد زيارات مكتملة للتصدير');
      return;
    }

    // Safe date formatter - handles ISO strings, Date objects, Firestore Timestamps, and unknowns
    const safeDate = (ts) => {
      if (!ts) return '';
      try {
        // Firestore Timestamp object (has toDate method)
        if (ts && typeof ts.toDate === 'function') {
          const d = ts.toDate();
          return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        }
        // String, number, or Date
        if (typeof ts === 'string' || typeof ts === 'number' || ts instanceof Date) {
          const d = new Date(ts);
          return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        }
        // Firestore raw timestamp object { seconds, nanoseconds }
        if (ts && typeof ts === 'object' && typeof ts.seconds === 'number') {
          const d = new Date(ts.seconds * 1000);
          return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        }
        return '';
      } catch {
        return '';
      }
    };

    const normalizeCategory = (name) => String(name || '').replace(/\s+/g, ' ').trim();
    const formatPct = (value) =>
      Number.isFinite(Number(value)) ? Number(value).toFixed(0) + '%' : '';
    const formatTarget = (r) =>
      r.type === 'check' ? (r.targetLabel || 'Required') : formatPct(r.targetPct);
    // Applied is decided by measured space: >= 1 shelf = applied. This also corrects
    // older saved visits that were stored as "not applied" while the space was >= 1.
    const checkApplied = (r) =>
      !!r.applied || (Number(r.notAppliedSpace) || 0) >= 1;
    const formatActual = (r) =>
      r.type === 'check'
        ? (checkApplied(r) ? '1 Shelf' : String(r.notAppliedSpace ?? 0))
        : formatPct(r.actualPct);
    const formatCheck = (r) =>
      r.type === 'check'
        ? (checkApplied(r) ? 'Achieved' : 'Not Achieved')
        : (r.achievement >= TARGET_THRESHOLD ? 'Achieved' : 'Not Achieved');

    // Collect all unique categories (preserving first-seen order)
    const categories = [];
    const seen = new Set();
    visibleVisits.forEach((v) => {
      (v.rows || []).forEach((r) => {
        const baseName = normalizeCategory(r.name);
        const key = baseName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          categories.push(baseName);
        }
      });
    });

    // Headers: base columns + 3 columns per category + edit tracking columns at the end
    const baseHeaders = [
      'Date', 'Code', 'Region', 'Desc_L5', 'ACC-Code',
      'Customer Name', 'Customer Address', 'Saved By',
    ];
    const categoryHeaders = categories.flatMap((cat) => [
      `Contract ${cat}`,
      `Actual ${cat}`,
      `${cat} Check`,
    ]);
    const editHeaders = ['Edited By', 'Edited At'];
    const headers = [...baseHeaders, ...categoryHeaders, ...editHeaders];

    // Data rows
    const rows = visibleVisits.map((v) => {
      const rowMap = {};
      (v.rows || []).forEach((r) => {
        rowMap[normalizeCategory(r.name).toLowerCase()] = r;
      });
      // Use clientTimestamp as fallback if server timestamp isn't available yet
      const visitDate = safeDate(v.timestamp) || safeDate(v.clientTimestamp);
      const line = [
        visitDate,
        String(v.customer_code || ''),
        v.region || '',
        v.chain || '',
        String(v.acc_code || ''),
        v.customer_name || '',
        v.customer_address || '',
        v.savedBy?.name || '',
      ];
      categories.forEach((cat) => {
        const r = rowMap[cat.toLowerCase()];
        if (!r) {
          line.push('', '', '');
          return;
        }
        line.push(
          formatTarget(r),
          formatActual(r),
          formatCheck(r)
        );
      });
      // Edit tracking columns at the end
      const editedBy = v.lastEditedBy?.name || '';
      const editedAt = safeDate(v.lastEditedAt) || safeDate(v.lastEditedAtClient) || '';
      line.push(editedBy, editedAt);
      return line;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Force code columns to be text (preserves leading zeros)
    const codeCol = 1, accCodeCol = 4;
    for (let r = 1; r <= rows.length; r++) {
      [codeCol, accCodeCol].forEach((c) => {
        const cell = XLSX.utils.encode_cell({ r, c });
        if (worksheet[cell]) {
          worksheet[cell].t = 's';
          worksheet[cell].z = '@';
          worksheet[cell].v = String(worksheet[cell].v || '');
        }
      });
    }

    // Apply colors to "Check" columns (every 3rd column after base columns)
    // Light green for Achieved, light red for Not Achieved
    const baseColCount = baseHeaders.length;
    for (let r = 1; r <= rows.length; r++) {
      categories.forEach((_, catIdx) => {
        const checkColIdx = baseColCount + catIdx * 3 + 2; // 3rd col of each category group
        const cellRef = XLSX.utils.encode_cell({ r, c: checkColIdx });
        const cell = worksheet[cellRef];
        if (!cell || !cell.v) return;
        const value = String(cell.v);
        if (value === 'Achieved') {
          cell.s = {
            fill: { fgColor: { rgb: 'C6EFCE' } },
            font: { color: { rgb: '006100' }, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        } else if (value === 'Not Achieved') {
          cell.s = {
            fill: { fgColor: { rgb: 'FFC7CE' } },
            font: { color: { rgb: '9C0006' }, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      });
    }

    // Style header row (bold + centered)
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = {
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'F2F2F2' } },
        };
      }
    }

    // Column widths
    worksheet['!cols'] = headers.map((h) => {
      if (h === 'Customer Address' || h === 'Customer Name') return { wch: 32 };
      if (['Code', 'ACC-Code', 'Date', 'Region', 'Desc_L5', 'Saved By'].includes(h)) return { wch: 16 };
      return { wch: Math.max(15, String(h).length + 3) };
    });

    // Freeze header row + first 2 columns (Date, Code)
    worksheet['!freeze'] = { xSplit: 2, ySplit: 1 };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ShelfSpace Report');
    XLSX.writeFile(workbook, `ShelfSpace_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // ===== Logout =====
  function handleLogout() {
    if (confirm('تأكيد تسجيل الخروج؟')) {
      logout();
      setSession(null);
      setSelectedCustomer(null);
      setEditingVisitId(null);
    }
  }

  // ===== Render =====
  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  // Role-based: rep sees only their own visits
  const visitsCountForBadge = session.role === 'rep'
    ? visits.filter((v) => v.savedBy?.name === session.name).length
    : visits.length;

  return (
    <div dir="rtl" className="app-root">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={16} /></div>
          <div>
            <h1>Shelf<span>Space</span></h1>
            <p>قياس تنفيذ عقود مساحات الأرفف</p>
          </div>
        </div>

        <nav className="tabs">
          <button
            className={tab === 'rep' ? 'tab active' : 'tab'}
            onClick={() => setTab('rep')}
          >
            <Store size={15} /> الزيارة
          </button>
          <button
            className={tab === 'dashboard' ? 'tab active' : 'tab'}
            onClick={() => setTab('dashboard')}
          >
            <BarChart3 size={15} /> اللوحة
          </button>
          <button
            className={tab === 'visits' ? 'tab active' : 'tab'}
            onClick={() => setTab('visits')}
          >
            <FileText size={15} /> سجل الزيارات
            {visitsCountForBadge > 0 && <b>{visitsCountForBadge}</b>}
          </button>
          {session.role === 'manager' && (
            <button
              className={tab === 'reps' ? 'tab active' : 'tab'}
              onClick={() => setTab('reps')}
            >
              <Users size={15} /> المنسقين
            </button>
          )}
        </nav>

        <div className={'user-badge ' + session.role}>
          <span className="role-tag">
            {session.role === 'manager' ? 'مشرف' : 'منسق'}
          </span>
          <span>{session.name}</span>
          <button onClick={handleLogout} title="خروج"><LogOut size={14} /></button>
        </div>
      </header>

      {/* Migration banner */}
      {showMigrationBanner && (
        <div className="migration-banner">
          <Database size={20} />
          <div>
            <b>بيانات محلية موجودة</b>
            <div style={{ fontSize: 12, color: '#fbbf77' }}>
              لديك زيارات محفوظة محلياً قبل تفعيل Firebase. هل تريد رفعها للسحابة؟
            </div>
          </div>
          <div className="actions">
            <button className="primary" onClick={migrateLocalData}>رفع للسحابة</button>
            <button className="ghost" onClick={dismissMigration}>تجاهل</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={'toast' + (toast.type === 'error' ? ' error' : '')}>
          <CheckCircle2 size={18} />
          {toast.message}
        </div>
      )}

      {/* Connection status */}
      <div className={'conn-status' + (online ? '' : ' offline')}>
        <span className="dot" />
        {online ? 'متصل بـ Firebase' : 'غير متصل'}
      </div>

      {/* Loading state */}
      {loadingVisits && (
        <div className="loading-screen">
          <div className="spinner" />
          <p>جاري تحميل البيانات من Firebase...</p>
        </div>
      )}

      {!loadingVisits && (
        <>
          {tab === 'rep' && (
            <main className="layout">
              <aside className="sidebar">
                <div className="search-wrap">
                  <Search size={16} />
                  <input
                    placeholder="ابحث بكود العميل أو الاسم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}><X size={14} /></button>
                  )}
                </div>
                <div className="filters">
                  <select
                    value={filterRegion}
                    onChange={(e) => {
                      setFilterRegion(e.target.value);
                      setFilterChain(''); // reset agent when region changes
                    }}
                  >
                    <option value="">كل المناطق</option>
                    {regions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <select value={filterChain} onChange={(e) => setFilterChain(e.target.value)}>
                    <option value="">كل الوكلاء</option>
                    {sidebarChains.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="results">
                  {filtered.length === 0 && (
                    <div className="empty">
                      <Search size={22} />
                      <p>ابدأ بالبحث عن عميل</p>
                      <small>{CUSTOMERS_DATA.length} عميل في القاعدة</small>
                    </div>
                  )}
                  {filtered.map((c) => (
                    <button
                      key={c.code + c.name + c.address}
                      className={
                        selectedCustomer?.code === c.code &&
                        selectedCustomer?.name === c.name
                          ? 'result selected' : 'result'
                      }
                      onClick={() => {
                        setSelectedCustomer(c);
                        setEditingVisitId(null);
                      }}
                    >
                      <span className="pill">#{c.code}</span>
                      <strong>{c.name}</strong>
                      {c.address && (
                        <em><MapPin size={11} /> {c.address}</em>
                      )}
                      <small>{c.region} · {c.chain}</small>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="main-panel">
                {!selectedCustomer ? (
                  <div className="welcome">
                    <h2>اختر عميلاً للبدء</h2>
                    <p>ابحث عن العميل ثم أدخل المساحة الفعلية وإجمالي مساحة الرف.</p>
                  </div>
                ) : (
                  <CustomerPanel
                    customer={selectedCustomer}
                    computed={computed}
                    actuals={actuals}
                    setActuals={setActuals}
                    onSave={saveVisit}
                    onIncomplete={() => setShowIncompleteModal(true)}
                    saving={saving}
                    validationErrors={validationErrors}
                    editingVisitId={editingVisitId}
                    onCancelEdit={cancelEdit}
                    onClose={() => {
                      setSelectedCustomer(null);
                      setEditingVisitId(null);
                    }}
                  />
                )}
              </section>
            </main>
          )}

          {tab === 'dashboard' && (
            <Dashboard
              regions={regions}
              chains={chains}
              visits={visits}
              session={session}
            />
          )}

          {tab === 'visits' && (
            <VisitsLog
              visits={visits}
              onExport={exportXLSX}
              onEdit={editVisit}
              onDelete={handleDeleteVisit}
              session={session}
            />
          )}

          {tab === 'reps' && session.role === 'manager' && (
            <RepsManagement reps={reps} visits={visits} />
          )}
        </>
      )}

      {/* Incomplete Visit Modal */}
      {showIncompleteModal && (
        <IncompleteVisitModal
          customer={selectedCustomer}
          saving={saving}
          onConfirm={saveIncompleteVisit}
          onCancel={() => setShowIncompleteModal(false)}
        />
      )}

      <footer>
        <span>SM Visibility · DG &amp; Impulse Home Shelf</span>
        <span>قاعدة البيانات: {CUSTOMERS_DATA.length} عميل</span>
      </footer>
    </div>
  );
}
