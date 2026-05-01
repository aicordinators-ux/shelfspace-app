import { useState, useMemo } from 'react';
import { FileText, MapPin, Download, Trash2, AlertTriangle, Search, X } from 'lucide-react';
import { TARGET_THRESHOLD, contractLabel, colorFor } from '../services/contracts';
import { canEditVisit } from '../services/auth';
import { getReasonLabel } from '../services/incompleteReasons';

export default function VisitsLog({ visits, onExport, onEdit, onDelete, session }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter visits based on role
  const visibleVisits =
    session?.role === 'rep'
      ? visits.filter((v) => v.savedBy?.name === session.name)
      : visits;

  // Apply search filter (matches code, name, address, region, chain)
  const searchedVisits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleVisits;
    return visibleVisits.filter((v) => {
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
  }, [searchQuery, visibleVisits]);

  // Count incomplete vs complete (from search results)
  const incompleteCount = searchedVisits.filter((v) => v.incomplete).length;
  const completeCount = searchedVisits.length - incompleteCount;

  // For export, count complete visits in unfiltered list (export ignores search)
  const totalCompleteCount = visibleVisits.filter((v) => !v.incomplete).length;

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
            {searchQuery && visibleVisits.length !== searchedVisits.length && (
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

      {/* Search box */}
      {visibleVisits.length > 0 && (
        <div className="search-wrap" style={{ marginBottom: 14 }}>
          <Search size={16} />
          <input
            placeholder="ابحث بكود العميل، الاسم، العنوان، المنطقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}><X size={14} /></button>
          )}
        </div>
      )}

      {!visibleVisits.length ? (
        <div className="welcome">
          <h3>لا توجد زيارات محفوظة بعد</h3>
        </div>
      ) : !searchedVisits.length ? (
        <div className="welcome">
          <h3>لم يتم العثور على نتائج</h3>
          <p>جرب كلمة بحث مختلفة</p>
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
                      {(v.rows || []).map((r) => (
                        <span key={r.key || r.name}>
                          <b>{r.name}</b>
                          <small>
                            {r.section || contractLabel(r.source)} ·{' '}
                            {r.type === 'check'
                              ? (r.applied ? 'مطبق' : 'غير مطبق')
                              : 'فعلي ' + Number(r.actualPct || 0).toFixed(0) + '%'} ·
                            {' '}تحقيق {Number(r.achievement || 0).toFixed(0)}%
                          </small>
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {v.savedBy && (
                  <p className="visit-meta">
                    <span>المنسق: <b>{v.savedBy.name}</b></span>
                    {v.timestamp && (
                      <span>التاريخ: {new Date(v.timestamp).toLocaleString('ar-EG')}</span>
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
