import { useEffect, useState } from 'react';

const AREA_COLORS = [
  '#007AFF',
  '#5856D6',
  '#FF9500',
  '#FF3B30',
  '#34C759',
  '#AF52DE',
  '#FF2D55',
  '#5AC8FA',
];

const AREA_EMOJIS = ['📁', '💼', '👤', '🏥', '🎬', '🎨', '⭐', '🔥', '🚀', '📦'];

export default function AreaFormModal({ open, area, onClose, onSave }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#007AFF');
  const [icon, setIcon] = useState('📁');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (area) {
      setName(area.name || '');
      setColor(area.color || '#007AFF');
      setIcon(area.icon || '📁');
    } else {
      setName('');
      setColor('#007AFF');
      setIcon('📁');
    }
  }, [open, area]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: area?.id,
        name: name.trim(),
        color,
        icon,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#2C2C2E] p-5 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold mb-4">
          {area ? 'Areani tahrirlash' : 'Yangi area'}
        </h3>

        <label className="block mb-4">
          <span className="text-xs text-light-dim dark:text-dark-dim">Nomi</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm outline-none focus:ring-2 focus:ring-light-accent"
            required
          />
        </label>

        <div className="mb-4">
          <span className="text-xs text-light-dim dark:text-dark-dim">Emoji</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AREA_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setIcon(em)}
                className={`w-9 h-9 rounded-lg text-lg ${
                  icon === em
                    ? 'bg-light-accent/20 ring-2 ring-light-accent dark:ring-dark-accent'
                    : 'bg-black/5 dark:bg-white/10'
                }`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <span className="text-xs text-light-dim dark:text-dark-dim">Rang</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {AREA_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === c ? 'border-black/40 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm font-medium"
          >
            Bekor qilish
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </form>
    </div>
  );
}
