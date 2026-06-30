import { useState } from 'react';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import { addRep, deleteRep } from '../services/reps';

export default function RepsManagement({ reps, visits }) {
  const [newRepName, setNewRepName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Count visits per rep
  const visitCounts = visits.reduce((acc, v) => {
    const name = v.savedBy?.name;
    if (name) acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  async function handleAdd() {
    if (!newRepName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await addRep(newRepName);
      setNewRepName('');
    } catch (e) {
      setError('فشل الإضافة: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(rep) {
    const count = visitCounts[rep.name] || 0;
    const msg = count > 0
      ? `${rep.name} عنده ${count} زيارة محفوظة. الزيارات هتفضل في النظام لكن المنسق هيتشال من القائمة. متأكد؟`
      : `هل أنت متأكد من حذف ${rep.name}؟`;
    if (!confirm(msg)) return;
    try {
      await deleteRep(rep.id);
    } catch (e) {
      setError('فشل الحذف: ' + e.message);
    }
  }

  return (
    <main className="reps-page">
      <div className="page-head">
        <div>
          <h2><Users size={20} /> إدارة المنسقين</h2>
          <p>إضافة وحذف المنسقين الذين يستخدمون التطبيق</p>
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="add-rep-row" style={{ marginBottom: 14 }}>
        <input
          type="text"
          value={newRepName}
          onChange={(e) => setNewRepName(e.target.value)}
          placeholder="اسم المنسق الجديد"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="primary" onClick={handleAdd} disabled={busy || !newRepName.trim()}>
          <UserPlus size={14} /> إضافة
        </button>
      </div>

      {reps.length === 0 ? (
        <div className="welcome">
          <h3>لا يوجد منسقين بعد</h3>
          <p>أضف أول منسق من المربع أعلاه</p>
        </div>
      ) : (
        <div className="reps-list">
          {reps.map((rep) => (
            <div key={rep.id} className="rep-row">
              <div>
                <strong>{rep.name}</strong>
                <div style={{ fontSize: 12, color: '#8290aa', marginTop: 2 }}>
                  {visitCounts[rep.name] || 0} زيارة محفوظة
                </div>
              </div>
              <button className="danger" onClick={() => handleDelete(rep)}>
                <Trash2 size={14} /> حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
