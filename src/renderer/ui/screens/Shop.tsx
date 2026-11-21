import { useState } from 'react';
import { PROPS } from '../../art/sprites';
import { dataUrl } from '../../art/pixels';
import { characterBuf } from '../../art/character';
import { type Collection, ITEM, ITEMS, type Item, MAX_FREEZES, OPTIONAL_SLOTS, SET_PIECES, SLOT_LABEL } from '../../core/catalog';
import { equip, lockedReason, priceFor } from '../../core/game';
import type { Look, Player, Slot } from '../../core/types';
import { store, useStore } from '../../store';
import { sceneFor } from '../derived';
import { Btn, CharacterView, Coins, Icon, Panel, Pix, SceneView } from '../kit';

const SECTIONS: { id: Collection | 'hairstyles'; title: string; blurb: string }[] = [
  { id: 'gym', title: 'Gym', blurb: 'Tank top, hoodie, joggers and gear. 100 to 400 coins.' },
  { id: 'music', title: 'Music', blurb: 'Headphones, band tee, leather jacket and instruments. 100 to 500 coins.' },
  { id: 'cyber', title: 'Cybersecurity', blurb: 'Black hoodie, mask, hacker glasses and a glowing terminal. 150 to 600 coins.' },
  { id: 'hair', title: 'Hairstyles and hair shades', blurb: 'Five styles and five gray shades. 50 to 300 coins.' },
  { id: 'background', title: 'Backgrounds', blurb: 'New night scenes behind your character. 300 coins.' },
  { id: 'set', title: 'Full outfit sets', blurb: 'Every piece of a collection plus a bonus animation. Cheaper if you own pieces.' },
  { id: 'freeze', title: 'Streak freeze', blurb: 'Saves your streak for one missed day. Used automatically.' },
];

const EXCLUSIVE: { id: Collection; title: string; blurb: string }[] = [
  { id: 'rank', title: 'Rank rewards', blurb: 'One exclusive piece for each rank. Never sold.' },
  { id: 'season', title: 'Moon season items', blurb: 'Reach Adventurer during that month to earn its item.' },
  { id: 'boss', title: 'Boss trophies', blurb: 'Dropped by the weekly bosses.' },
  { id: 'prestige', title: 'Prestige outfits', blurb: 'One rarer outfit for each prestige star.' },
];

function previewLook(base: Look, it: Item): Look {
  if (it.slot === 'set') {
    const l = { ...base };
    for (const id of SET_PIECES[it.id] ?? []) {
      const piece = ITEM[id];
      if (piece.slot !== 'prop' && piece.slot !== 'set' && piece.slot !== 'consumable') (l as unknown as Record<string, string>)[piece.slot] = id;
    }
    return l;
  }
  if (it.slot === 'consumable' || it.slot === 'background' || it.slot === 'prop') return base;
  return { ...base, [it.slot]: it.id } as Look;
}

/** Small picture for an item card */
function ItemArt({ p, it }: { p: Player; it: Item }) {
  if (it.slot === 'background') return <BackgroundThumb id={it.id} />;
  if (it.slot === 'prop')
    return (
      <Pix
        src={dataUrl(`prop:${it.id}`, () => {
          const b = PROPS[it.id](0);
          return b;
        })}
        scale={3}
      />
    );
  if (it.id === 'freeze') return <Icon name="freeze" scale={5} />;
  const look = previewLook({ ...p.look, back: it.slot === 'back' ? it.id : p.look.back }, it);
  return <Pix src={dataUrl(`prev:${JSON.stringify(look)}`, () => characterBuf(look, 'stand', 0))} scale={3} />;
}

function BackgroundThumb({ id }: { id: string }) {
  return (
    <div style={{ width: 132, height: 76 }}>
      <SceneView state={sceneFor(undefined, { background: id, animations: false, targetHeight: 60, charX: 0.42, moonPhase: 0.9 })} style={{ width: 132, height: 76 }} />
    </div>
  );
}

export function Shop({ p }: { p: Player }) {
  const s = useStore();
  const r = s.route;
  const wardrobe = r.name === 'player' && r.wardrobe;
  const setWardrobe = (w: boolean) => store.go({ name: 'player', playerId: p.id, tab: 'shop', wardrobe: w });
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row">
        <div className="seg">
          <button className={!wardrobe ? 'on' : ''} onClick={() => setWardrobe(false)}>
            Shop
          </button>
          <button className={wardrobe ? 'on' : ''} onClick={() => setWardrobe(true)}>
            Wardrobe
          </button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>
          Coins are earned by ranking up, beating bosses, challenges and badges. In-game only, never real money.
        </span>
        <span className="spacer" />
        <Coins n={p.coins} bright />
      </div>
      {wardrobe ? <Wardrobe p={p} /> : <ShopList p={p} />}
    </div>
  );
}

function ItemCard({ p, it, exclusive }: { p: Player; it: Item; exclusive?: boolean }) {
  const owned = it.id === 'freeze' ? false : p.owned.includes(it.id);
  const price = priceFor(p, it.id);
  const reason = lockedReason(p, it.id);
  const equipped = Object.values(p.look).includes(it.id);
  const canEquip = owned && it.slot !== 'set' && it.slot !== 'consumable';
  return (
    <div className={`panel item-card ${owned ? 'owned' : ''} ${exclusive && !owned ? 'locked' : ''}`}>
      <div className="item-art">
        <ItemArt p={p} it={it} />
      </div>
      <div className="pixel" style={{ fontSize: 16 }}>
        {it.name}
      </div>
      <div className="dim" style={{ fontSize: 12, minHeight: 16 }}>
        {it.desc ?? (it.slot in SLOT_LABEL ? SLOT_LABEL[it.slot as Slot] : '')}
      </div>
      {it.id === 'freeze' ? (
        <div className="col" style={{ gap: 6, alignItems: 'center' }}>
          <span className="dim" style={{ fontSize: 12 }}>
            Held: {p.streakFreezes} / {MAX_FREEZES}
          </span>
          <Btn small kind="primary" disabled={p.streakFreezes >= MAX_FREEZES || p.coins < price} onClick={() => store.buy(p, it.id)}>
            <Icon name="coin" shift={-2} /> {price}
          </Btn>
        </div>
      ) : owned ? (
        canEquip ? (
          <Btn
            small
            kind={equipped ? 'default' : 'primary'}
            onClick={() => {
              const slot = it.slot as Slot;
              equip(p, slot, equipped && OPTIONAL_SLOTS.includes(slot) ? undefined : it.id);
              store.markDirty(p);
            }}
          >
            {equipped ? (OPTIONAL_SLOTS.includes(it.slot as Slot) ? 'Take off' : 'Wearing') : 'Wear'}
          </Btn>
        ) : (
          <span className="chip solid">Owned</span>
        )
      ) : it.unlock.kind === 'shop' ? (
        <Btn small kind="primary" disabled={p.coins < price} onClick={() => store.buy(p, it.id)} title={p.coins < price ? `You need ${price - p.coins} more coins` : 'Buy'}>
          <Icon name="coin" shift={-2} /> {price}
        </Btn>
      ) : (
        <span className="chip">
          <Icon name="lock" /> {reason}
        </span>
      )}
    </div>
  );
}

function ShopList({ p }: { p: Player }) {
  return (
    <>
      {SECTIONS.map((sec) => {
        const items = ITEMS.filter((i) => i.collection === sec.id && i.unlock.kind === 'shop');
        return (
          <Panel key={sec.id} title={sec.title} right={<span className="dim" style={{ textTransform: 'none', fontFamily: 'var(--text)', letterSpacing: 0, fontSize: 12 }}>{sec.blurb}</span>}>
            <div className="item-grid">
              {items.map((it) => (
                <ItemCard key={it.id} p={p} it={it} />
              ))}
            </div>
          </Panel>
        );
      })}
      {EXCLUSIVE.map((sec) => (
        <Panel key={sec.id} title={sec.title} right={<span className="dim" style={{ textTransform: 'none', fontFamily: 'var(--text)', letterSpacing: 0, fontSize: 12 }}>{sec.blurb}</span>}>
          <div className="item-grid">
            {ITEMS.filter((i) => i.collection === sec.id).map((it) => (
              <ItemCard key={it.id} p={p} it={it} exclusive />
            ))}
          </div>
        </Panel>
      ))}
    </>
  );
}

const WARDROBE_SLOTS: Slot[] = ['hair', 'hairShade', 'top', 'bottom', 'shoes', 'head', 'face', 'neck', 'wrist', 'held', 'back', 'prop', 'background'];

function Wardrobe({ p }: { p: Player }) {
  const [slot, setSlot] = useState<Slot>('top');
  const options = ITEMS.filter((i) => i.slot === slot);
  const cur = (p.look as unknown as Record<string, string | undefined>)[slot];
  return (
    <div className="wardrobe">
      <Panel title="Your character" className="center">
        <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0' }}>
          <CharacterView look={p.look} scale={7} />
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <span className="pixel muted">Body</span>
          <div className="seg">
            {(['boy', 'girl'] as const).map((b) => (
              <button
                key={b}
                className={p.look.body === b ? 'on' : ''}
                onClick={() => {
                  p.look.body = b;
                  store.markDirty(p);
                }}
              >
                {b === 'boy' ? 'Boy' : 'Girl'}
              </button>
            ))}
          </div>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          Body can be changed any time for free. Locked items show their price or what unlocks them.
        </div>
      </Panel>
      <Panel title="Wardrobe">
        <div className="slot-tabs">
          {WARDROBE_SLOTS.map((sl) => (
            <button key={sl} className={`chip ${slot === sl ? 'solid' : ''}`} onClick={() => setSlot(sl)}>
              {SLOT_LABEL[sl]}
            </button>
          ))}
        </div>
        <div className="item-grid" style={{ marginTop: 12 }}>
          {OPTIONAL_SLOTS.includes(slot) && (
            <button
              className={`panel item-card ${!cur ? 'owned' : ''}`}
              onClick={() => {
                equip(p, slot, undefined);
                store.markDirty(p);
              }}
            >
              <div className="item-art">
                <Icon name="close" scale={4} />
              </div>
              <div className="pixel">Nothing</div>
              <span className={`chip ${!cur ? 'solid' : ''}`}>{!cur ? 'Wearing' : 'Take off'}</span>
            </button>
          )}
          {options.map((it) => (
            <ItemCard key={it.id} p={p} it={it} exclusive={it.unlock.kind !== 'shop' && it.unlock.kind !== 'free'} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

