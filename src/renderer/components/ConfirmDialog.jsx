export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "O'chirish",
  cancelLabel = 'Bekor qilish',
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#2C2C2E] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        <p className="text-sm text-light-dim dark:text-dark-dim leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 font-medium text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white font-medium text-sm ${
              danger ? 'bg-red-500' : 'bg-light-accent dark:bg-dark-accent'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
