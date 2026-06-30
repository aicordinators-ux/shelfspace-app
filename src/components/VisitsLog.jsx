import { useState, useMemo } from 'react';
import { FileText, MapPin, Download, Trash2, AlertTriangle, Search, X, Filter } from 'lucide-react';
import { TARGET_THRESHOLD, contractLabel, colorFor } from '../services/contracts';
import { canEditVisit } from '../services/auth';
import { getReasonLabel } from '../services/incompleteReasons';

// Safe date formatter — handles ISO strings, Date objects, and invalid input
function formatDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('ar-EG', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function VisitsLog({ visits, onExport, onEdit, onDelete, session }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterChain, setFilterChain] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'achieved' | 'not_achieved' | 'incomplete'
  const [filterDate, setFilterDate] = useState(''); // YYYY-MM-DD format

  // Filter visits based on role
  const visibleVisits =
    session?.role === 'rep'
      ? visits.filter((v) => v.savedBy?.name === session.name)
      : visits;

  // Build filter options dynamically from existing visits
  const regionOptions = useMemo(() => {
    const set = new Set();
    visibleVisits.forEach((v) => v.region && set.add(v.region));
    return [...set].sort();
  }, [visibleVisits]);

  const chainOptions = useMemo(() => {
    const set = new Set();
    visibleVisits.forEach((v) => v.chain && set.add(v.chain));
    return [...set].sort();
  }, [visibleVisits]);

  const repOptions = useMemo(() => {
    const set = new Set();
    visibleVisits.forEach((v) => v.savedBy?.name && set.add(v.savedBy.name));
    return [...set].sort();
  }, [visibleVisits]);

  // Apply all filters + search
  const searchedVisits = useMemo(() => {
    let list = visibleVisits;

    // Region filter
    if (filterRegion) list = list.filter((v) => v.region === filterRegion);

    // Chain filter
    if (filterChain) list = list.filter((v) => v.chain === filterChain);

    // Rep filter (manager only)
    if (filterRep) list = list.filter((v) => v.savedBy?.name === filterRep);

    // Status filter
    if (filterStatus === 'achieved') {
      list = list.filter((v) => !v.incomplete && Number(v.weightedAvg || 0) >= TARGET_THRESHOLD);
    } else if (filterStatus === 'not_achieved') {
      list = list.filter((v) => !v.incomplete && Number(v.weightedAvg || 0) < TARGET_THRESHOLD);
    } else if (filterStatus === 'incomplete') {
      list = list.filter((v) => v.incomplete);
    }

    // Date filter (compares YYYY-MM-DD parts only, ignoring time)
    if (filterDate) {
      list = list.filter((v) => {
        if (!v.timestamp) return false;
        try {
          const d = new Date(v.timestamp);
          if (isNaN(d.getTime())) return false;
          // Use local date string in YYYY-MM-DD format
          const visitDateStr = d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
          return visitDateStr === filterDate;
        } catch {
          return false;
        }
      });
    }

    // Text search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => {
        const haystack = [
          v.customer_code,
          v.customer_name,
          v.customer_address,
          v.region,
          v.chain,
          v.acc_code,
          v.savedBy?.name,
        ].map((s) => String(s || '').toLowerCase()).join(' ');
        return haystack.includes(q);
      });
    }
    return list;
  }, [searchQuery, filterRegion, filterChain, filterRep, filterStatus, filterDate, visibleVisits]);

  // Counts
  const incompleteCount = searchedVisits.filter((v) => v.incomplete).length;
  const completeCount = searchedVisits.length - incompleteCount;
  const totalCompleteCount = visibleVisits.filter((v) => !v.incomplete).length;

  // Active filters count (for "clear all" button)
  const activeFilters = [filterRegion, filterChain, filterRep, filterStatus, filterDate, searchQuery].filter(Boolean).length;

  function clearAllFilters() {
    setSearchQuery('');
    setFilterRegion('');
    setFilterChain('');
    setFilterRep('');
    setFilterStatus('');
    setFilterDate('');
  }

  return (
    <main className="visits">
      <div className="page-head">
        <div>
          <h2><FileText size={20} /> سجل الزيارات</h2>
          <p>
            {session?.role === 'rep' ? 'زياراتك أنت' : 'كل الزيارات'}
            {' · '}
            <span style={{ color: '#4ade80' }}>{completeCount} مكتملة</span>
            {incompleteCount > 0 && (
              <>
                {' · '}
                <span style={{ color: '#fbbf77' }}>{incompleteCount} غير مكتملة</span>
              </>
            )}
            {activeFilters > 0 && visibleVisits.length !== searchedVisits.length && (
              <>
                {' '}<span style={{ color: '#8290aa' }}>(من {visibleVisits.length})</span>
              </>
            )}
          </p>
        </div>
        <button className="primary" onClick={onExport} disabled={!totalCompleteCount}>
          <Download size={16} /> تصدير التقرير
        </button>
      </div>

      {/* Search + Filters */}
      {visibleVisits.length > 0 && (
        <>
          <div className="search-wrap" style={{ marginBottom: 10 }}>
            <Search size={16} />
            <input
              placeholder="ابحث بكود العميل، الاسم، العنوان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}><X size={14} /></button>
            )}
          </div>

          <div className="visits-filters">
            <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
              <option value="">كل المناطق</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={filterChain} onChange={(e) => setFilterChain(e.target.value)}>
              <option value="">كل الوكلاء</option>
              {chainOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Rep filter (manager only) */}
            {session?.role === 'manager' && repOptions.length > 0 && (
              <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)}>
                <option value="">كل المنسقين</option>
                {repOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            )}

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="achieved">محقق</option>
              <option value="not_achieved">غير محقق</option>
              <option value="incomplete">غير مكتملة</option>
            </select>

            <div className="date-filter-wrap">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                title="فلتر بالتاريخ"
              />
              {filterDate && (
                <button
                  type="button"
                  className="date-clear"
                  onClick={() => setFilterDate('')}
                  title="مسح التاريخ"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {activeFilters > 0 && (
              <button className="ghost clear-filters-btn" onClick={clearAllFilters}>
                <X size={14} /> مسح الفلاتر ({activeFilters})
              </button>
            )}
          </div>
        </>
      )}

      {!visibleVisits.length ? (
        <div className="welcome">
          <h3>لا توجد زيارات محفوظة بعد</h3>
        </div>
      ) : !searchedVisits.length ? (
        <div className="welcome">
          <h3>لم يتم العثور على نتائج</h3>
          <p>جرب تغيير الفلاتر أو كلمات البحث</p>
          {activeFilters > 0 && (
            <button className="primary" onClick={clearAllFilters} style={{ marginTop: 10 }}>
              مسح كل الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="visit-list">
          {searchedVisits.map((v) => {
            const canEdit = canEditVisit(session, v);
            const isIncomplete = !!v.incomplete;
            const cardClass = isIncomplete
              ? 'visit incomplete'
              : 'visit ' + colorFor(v.weightedAvg);

            return (
              <article className={cardClass} key={v.id}>
                <header>
                  <div>
                    <span className="pill">#{v.customer_code}</span>
                    {isIncomplete && (
                      <span className="incomplete-badge">
                        <AlertTriangle size={12} /> غير مكتملة
                      </span>
                    )}
                    <b>{v.customer_name}</b>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canEdit && !isIncomplete && (
                      <button className="ghost" onClick={() => onEdit(v)}>
                        تعديل
                      </button>
                    )}
                    {(session?.role === 'manager' || (canEdit && isIncomplete)) && (
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذه الزيارة؟')) {
                            onDelete(v.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </header>

                {v.customer_address && (
                  <p className="address"><MapPin size={12} /> {v.customer_address}</p>
                )}

                {isIncomplete ? (
                  <>
                    <p>{v.region} · {v.chain}</p>
                    <div className="incomplete-reason">
                      <b>السبب: {getReasonLabel(v.incompleteReason)}</b>
                      {v.incompleteNote && (
                        <p>{v.incompleteNote}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      {v.region} · {v.chain} ·{' '}
                      {v.weightedAvg >= TARGET_THRESHOLD ? 'محقق' : 'غير محقق'}{' '}
                      {Number(v.weightedAvg || 0).toFixed(0)}%
                    </p>
                    <div className="visit-cats">
                      {(v.rows || []).map((r) => {
                        const achievementPct = Number(r.achievement || 0);
                        const isAchieved = achievementPct >= TARGET_THRESHOLD;
                        const achievementColor = isAchieved
                          ? '#4ade80'
                          : achievementPct >= 50 ? '#fb923c' : '#f87171';

                        return (
                          <span key={r.key || r.name} className="cat-card">
                            <div className="cat-card-head">
                              <b>{r.name}</b>
                              <span className="cat-section">
                                {r.source || 'DRY'}
                              </span>
                            </div>

                            {r.type === 'check' ? (
                              <div className="cat-line">
                                <em>الحالة:</em>
                                <b style={{ color: r.applied ? '#4ade80' : '#f87171' }}>
                                  {r.applied ? 'مطبق ✓' : 'غير مطبق ✗'}
                                </b>
                              </div>
                            ) : (
                              <>
                                <div className="cat-line">
                                  <em>المطلوب:</em>
                                  <b>{Number(r.targetPct || 0).toFixed(0)}%</b>
                                </div>
                                <div className="cat-line">
                                  <em>المحقق:</em>
                                  <b style={{ color: achievementColor }}>
                                    {Number(r.actualPct || 0).toFixed(0)}%
                                  </b>
                                </div>
                              </>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}

                {v.savedBy && (
                  <p className="visit-meta">
                    <span>المنسق: <b>{v.savedBy.name}</b></span>
                    {v.timestamp && (
                      <span>التاريخ: {formatDate(v.timestamp)}</span>
                    )}
                    {v.lastEditedBy?.name && (
                      <span className="edited-tag">
                        تم التعديل بواسطة: <b>{v.lastEditedBy.name}</b>
                        {v.lastEditedAt && (
                          <> · {formatDate(v.lastEditedAt)}</>
                        )}
                      </span>
                    )}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
