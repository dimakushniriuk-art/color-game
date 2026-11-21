import { IconBack } from '../components/Icons';

// Placeholder: replace with the real privacy policy before store submission
// (Apple and Google both require a public privacy policy URL as well).
export function Privacy({ onBack }: { onBack(): void }) {
  return (
    <div className="screen-scroll">
      <div className="subpage-top"><button className="icon-btn" onClick={onBack} aria-label="Indietro"><IconBack /></button><h2>Privacy</h2></div>
      <div className="prose">
        <p><b>Bozza da completare prima della pubblicazione.</b></p>
        <p>Color Game salva i progressi dei disegni solo su questo dispositivo. L'app non richiede un account e non raccoglie dati personali.</p>
        <p>I disegni vengono scaricati dai nostri server; le richieste possono essere registrate nei log tecnici del fornitore di hosting.</p>
        <p>Contatti: [email da inserire]</p>
      </div>
    </div>
  );
}
