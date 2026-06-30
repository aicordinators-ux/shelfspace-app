import { useState, useEffect } from 'react';
import { Sparkles, Store, Award, UserPlus, Trash2 } from 'lucide-react';
import { loginAsManager, loginAsRep, MANAGER_PIN } from '../services/auth';
import { subscribeToReps, addRep, deleteRep } from '../services/reps';

export default function LoginScreen({ onLogin }) {
  const [role, setRole] = useState('rep'); // 'rep' | 'manager'
  const [reps, setReps] = useState([]);
  const [loadingReps, setLoadingReps] = useState(true);
  const [selectedRep, setSelectedRep] = useState('');
  const [managerName, setManagerName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // For first-time setup: manager can add the first rep
  const [newRepName, setNewRepName] = useState('');
  const [showAddRep, setShowAddRep] = useState(false);

  useEffect(() => {
    const unsub = subscribeToReps((list) => {
      setReps(list);
      setLoadingReps(false);
    });
    return unsub;
  }, []);

  async function handleSubmit() {
    setError('');
    setBusy(true);
    try {
      if (role === 'manager') {
        const result = loginAsManager(pin, managerName || 'مشرف');
        if (!result.success) {
          setError(result.error);
          return;
        }
        onLogin(result.session);
      } else {
        const result = loginAsRep(selectedRep);
        if (!result.success) {
          setError(result.error);
          return;
        }
        onLogin(result.session);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddRep() {
    if (!newRepName.trim()) return;
    try {
      await addRep(newRepName);
      setNewRepName('');
    } catch (e) {
      setError('فشل إضافة المنسق: ' + e.message);
    }
  }

  async function handleDeleteRep(repId) {
    if (!confirm('هل أنت متأكد من حذف هذا المنسق؟')) return;
    try {
      await deleteRep(repId);
    } catch (e) {
      setError('فشل الحذف: ' + e.message);
    }
  }

  // If user typed correct PIN, allow add/delete reps
  const pinCorrect = pin === MANAGER_PIN;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark"><Sparkles size={24} /></div>
        <h1>Shelf<span>Space</span></h1>
        <p className="login-sub">تنفيذ عقود مساحات الأرفف</p>

        <div className="role-pick">
          <button
            type="button"
            className={role === 'rep' ? 'role-btn active' : 'role-btn'}
            onClick={() => { setRole('rep'); setError(''); }}
          >
            <Store size={20} />
            <strong>منسق</strong>
            <small>إدخال زيارات</small>
          </button>
          <button
            type="button"
            className={role === 'manager' ? 'role-btn active' : 'role-btn'}
            onClick={() => { setRole('manager'); setError(''); }}
          >
            <Award size={20} />
            <strong>مشرف</strong>
            <small>متابعة وتعديل</small>
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {role === 'rep' ? (
          <>
            <div className="login-field">
              <label>اختر اسمك من القائمة</label>
              {loadingReps ? (
                <div className="help-text">جاري تحميل القائمة...</div>
              ) : reps.length === 0 ? (
                <div className="help-text" style={{ color: '#fb923c' }}>
                  لا يوجد منسقين مسجلين. يجب على المشرف إضافتهم أولاً.
                </div>
              ) : (
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                >
                  <option value="">-- اختر اسمك --</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="login-field">
              <label>اسمك (اختياري)</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="أدخل إسمك هنا"
              />
            </div>
            <div className="login-field">
              <label>PIN المشرف</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="أدخل PIN المشرف"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {/* If PIN is correct, show rep management */}
            {pinCorrect && (
              <div className="login-field">
                <label>إدارة المنسقين</label>
                <div className="reps-list" style={{ marginTop: 6 }}>
                  {reps.length === 0 && (
                    <div className="help-text">لا يوجد منسقين بعد</div>
                  )}
                  {reps.map((r) => (
                    <div key={r.id} className="rep-row">
                      <strong>{r.name}</strong>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteRep(r.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="add-rep-row">
                  <input
                    type="text"
                    value={newRepName}
                    onChange={(e) => setNewRepName(e.target.value)}
                    placeholder="اسم المنسق الجديد"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRep()}
                  />
                  <button type="button" className="primary" onClick={handleAddRep}>
                    <UserPlus size={14} /> إضافة
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          className="primary"
          onClick={handleSubmit}
          disabled={busy || (role === 'rep' && !selectedRep) || (role === 'manager' && !pin)}
        >
          {busy ? 'جاري الدخول...' : 'دخول'}
        </button>
      </div>
    </div>
  );
}
