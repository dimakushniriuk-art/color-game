import { useState } from 'react';

const SLIDES = [
  { emoji: '🎨', title: 'Colora con i numeri', text: 'Ogni zona ha un numero: scegli il colore giusto e tocca la zona.' },
  { emoji: '🔍', title: 'Zoom e suggerimenti', text: 'Allarga con due dita per i dettagli. La lampadina ti mostra le zone mancanti.' },
  { emoji: '✨', title: 'Rilassati', text: 'Nessun timer, nessun errore. I progressi si salvano da soli.' },
];

export function Onboarding({ onDone }: { onDone(): void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="onboarding">
      <button className="skip" onClick={onDone}>Salta</button>
      <div className="ob-art" key={i}><span>{s.emoji}</span></div>
      <h1>{s.title}</h1>
      <p>{s.text}</p>
      <div className="dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
      <button className="btn btn-primary wide" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? 'Inizia' : 'Avanti'}</button>
    </div>
  );
}
