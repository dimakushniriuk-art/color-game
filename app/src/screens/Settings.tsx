import { useState } from 'react';
import { resetPlayer } from '../state/rewards';
import { resetProgress, updateSettings, useSettings, type Settings as S } from '../state/store';
import { Modal } from '../components/Modal';
import { IconChevron } from '../components/Icons';

const Toggle = ({ label, hint, k }: { label: string; hint?: string; k: keyof S }) => {
  const s = useSettings();
  const on = !!s[k];
  return (
    <label className="row">
      <div className="row-text"><span>{label}</span>{hint && <small>{hint}</small>}</div>
      <button role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => updateSettings({ [k]: !on } as Partial<S>)} />
    </label>
  );
};

export function Settings({ onPrivacy }: { onPrivacy(): void }) {
  const s = useSettings();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen-scroll">
      <header className="page-head"><h1>Impostazioni</h1></header>

      <div className="group-title">Gioco</div>
      <div className="group">
        <Toggle k="highlight" label="Evidenzia le zone" hint="Mostra a scacchi le zone del colore scelto" />
        <Toggle k="autoNextColor" label="Colore successivo automatico" hint="Quando finisci un colore passa al prossimo" />
        <Toggle k="sound" label="Suoni" />
        <Toggle k="haptics" label="Vibrazione" />
      </div>

      <div className="group-title">Aspetto</div>
      <div className="group">
        <div className="row">
          <div className="row-text"><span>Tema</span></div>
          <div className="mini-seg">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} className={s.theme === t ? 'on' : ''} onClick={() => updateSettings({ theme: t })}>
                {t === 'system' ? 'Auto' : t === 'light' ? 'Chiaro' : 'Scuro'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="group-title">Altro</div>
      <div className="group">
        <button className="row row-link" onClick={() => updateSettings({ onboardingDone: false, coachDone: false })}>
          <div className="row-text"><span>Rivedi il tutorial</span></div><IconChevron size={18} />
        </button>
        <button className="row row-link" onClick={onPrivacy}>
          <div className="row-text"><span>Privacy</span></div><IconChevron size={18} />
        </button>
        <button className="row row-link danger" onClick={() => setConfirm(true)}>
          <div className="row-text"><span>Ricomincia da zero</span></div>
        </button>
      </div>
      <p className="version">Color Game · versione 0.1.0</p>

      {confirm && (
        <Modal
          title="Ricominciare da zero?"
          text="Disegni, monete, livelli, sfide e trofei verranno azzerati. L'operazione non si può annullare."
          confirmLabel="Cancella"
          danger
          onConfirm={() => { resetProgress(); resetPlayer(); setConfirm(false); }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
