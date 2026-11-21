export function Modal({ title, text, confirmLabel, cancelLabel = 'Annulla', danger, onConfirm, onCancel }: {
  title: string; text?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm(): void; onCancel(): void;
}) {
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {text && <p>{text}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
