import { useCallback, useEffect, useState } from 'react';
import type { CatalogItem } from './engine/types';
import { pickDaily, watchCatalog } from './data/catalog';
import { registerVisit } from './state/rewards';
import { Challenges } from './screens/Challenges';
import { Celebrations } from './components/Celebrations';
import { DailyReward } from './components/DailyReward';
import { getProgress, updateSettings, useSettings } from './state/store';
import { Gallery } from './screens/Gallery';
import { MyWorks } from './screens/MyWorks';
import { Settings } from './screens/Settings';
import { Play } from './screens/Play';
import { Complete } from './screens/Complete';
import { Onboarding } from './screens/Onboarding';
import { Privacy } from './screens/Privacy';
import { IconBrush, IconGallery, IconSettings, IconTrophy } from './components/Icons';

type Tab = 'gallery' | 'challenges' | 'mine' | 'settings';
type Route =
  | { name: 'home'; tab: Tab }
  | { name: 'play'; id: string }
  | { name: 'complete'; id: string }
  | { name: 'privacy' };

const HOME: Route = { name: 'home', tab: 'gallery' };

export default function App() {
  const settings = useSettings();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [route, setRoute] = useState<Route>(() => (history.state as Route) ?? HOME);

  const [dailyReward, setDailyReward] = useState(false);
  useEffect(() => watchCatalog(setItems), []);
  useEffect(() => { if (settings.onboardingDone && registerVisit()) setTimeout(() => setDailyReward(true), 600); }, [settings.onboardingDone]);

  // theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#17181f' : '#fff8f1');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  // history integration: browser/Android back button returns to the previous screen
  useEffect(() => {
    if (!history.state) history.replaceState(HOME, '');
    const onPop = (e: PopStateEvent) => setRoute((e.state as Route) ?? HOME);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = useCallback((r: Route, replace = false) => {
    if (replace) history.replaceState(r, ''); else history.pushState(r, '');
    setRoute(r);
  }, []);
  const back = useCallback(() => (history.length > 1 ? history.back() : go(HOME, true)), [go]);

  const open = (it: CatalogItem) => go(getProgress(it.id)?.completed ? { name: 'complete', id: it.id } : { name: 'play', id: it.id });
  const find = (id: string) => items.find((i) => i.id === id);

  if (!settings.onboardingDone) return <Onboarding onDone={() => updateSettings({ onboardingDone: true })} />;
  return (
    <>
      <div className="screen-enter" key={route.name === 'home' ? 'home' : route.name + ('id' in route ? route.id : '')}>{screen()}</div>
      <Celebrations />
      {dailyReward && route.name === 'home' && <DailyReward onClose={() => setDailyReward(false)} />}
    </>
  );

  function screen() {

  if (route.name === 'play' || route.name === 'complete') {
    const item = find(route.id);
    if (!item) return <div className="center-msg"><div className="spinner" /></div>;
    if (route.name === 'play') return <Play item={item} isDaily={pickDaily(items)?.id === item.id} onBack={back} onChallenges={() => go({ name: 'home', tab: 'challenges' }, true)} onComplete={() => go({ name: 'complete', id: item.id }, true)} />;
    const next = items.find((i) => i.id !== item.id && !getProgress(i.id)?.completed) ?? null;
    return (
      <Complete
        key={item.id}
        item={item}
        next={next}
        onGallery={() => go(HOME, true)}
        onNext={() => next && go({ name: 'play', id: next.id }, true)}
      />
    );
  }
  if (route.name === 'privacy') return <Privacy onBack={back} />;

  const tab = route.tab;
  const setTab = (t: Tab) => go({ name: 'home', tab: t }, true);
  return (
    <div className="home">
      <main className="home-main">
        {tab === 'gallery' && <Gallery items={items} onOpen={open} onWallet={() => setTab('challenges')} />}
        {tab === 'challenges' && <Challenges />}
        {tab === 'mine' && <MyWorks items={items} onOpen={open} onBrowse={() => setTab('gallery')} />}
        {tab === 'settings' && <Settings onPrivacy={() => go({ name: 'privacy' })} />}
      </main>
      <nav className="tabbar">
        <button className={tab === 'gallery' ? 'on' : ''} onClick={() => setTab('gallery')}><IconGallery /><span>Galleria</span></button>
        <button className={tab === 'challenges' ? 'on' : ''} onClick={() => setTab('challenges')}><IconTrophy /><span>Sfide</span></button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}><IconBrush /><span>I miei lavori</span></button>
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}><IconSettings /><span>Impostazioni</span></button>
      </nav>
    </div>
  );
  }
}
