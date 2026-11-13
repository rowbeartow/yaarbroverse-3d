// The "Who's playing?" screen: pick a player, add one (a typed name and a
// colour, up to four), and, for a grown-up, reset a player's progress or take
// a player off this device, each behind a confirmation.
//
// Names are only ever put on the page as plain text, and never logged or sent
// anywhere. The saving itself is in src/save/players.ts.

import { COLOURS, MAX_NAME_LENGTH, cleanName, colourHex, type ColourId, type Player, type Players } from '../save/players';

type Panel = 'list' | 'form' | 'grown' | 'confirm';

const el = <T extends HTMLElement>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing page element ${selector}`);
  return found;
};

/** A round badge in the player's colour with the first letter of their name. */
export const badge = (player: Pick<Player, 'name' | 'colour'>): HTMLElement => {
  const dot = document.createElement('span');
  dot.className = 'badge';
  dot.style.background = colourHex(player.colour);
  dot.textContent = Array.from(player.name)[0]?.toUpperCase() ?? '';
  dot.setAttribute('aria-hidden', 'true');
  return dot;
};

export class Who {
  readonly screen = el('#who');
  private readonly panels: Record<Panel, HTMLElement> = {
    list: el('#who-list'),
    form: el('#who-form'),
    grown: el('#who-grown'),
    confirm: el('#who-confirm'),
  };
  private readonly title = el('#who-title');
  private readonly name = el<HTMLInputElement>('#who-name');
  private readonly swatches = el('#who-swatches');
  private readonly problem = el('#who-problem');
  private colour: ColourId = COLOURS[0].id;
  private confirmed: (() => void) | null = null;

  constructor(
    private readonly players: Players,
    /** Called with the player who was picked or just added. */
    private readonly onPick: (player: Player) => void,
    /** Called after a player's progress was reset or a player was removed. */
    private readonly onChange: () => void,
  ) {
    this.name.maxLength = MAX_NAME_LENGTH;
    for (const colour of COLOURS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'swatch';
      swatch.setAttribute('role', 'radio');
      swatch.dataset.colour = colour.id;
      swatch.setAttribute('aria-label', colour.label);
      swatch.style.background = colour.hex;
      swatch.addEventListener('click', () => this.pickColour(colour.id));
      this.swatches.append(swatch);
    }
    el<HTMLFormElement>('#who-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.name.addEventListener('input', () => (this.problem.textContent = ''));
    el('#who-back').addEventListener('click', () => this.show('list'));
    el('#who-manage').addEventListener('click', () => this.show('grown'));
    el('#who-grown-done').addEventListener('click', () => this.show('list'));
    el('#who-confirm-no').addEventListener('click', () => this.show('grown'));
    el('#who-confirm-yes').addEventListener('click', () => {
      this.confirmed?.();
      this.confirmed = null;
      this.onChange();
      this.show(this.players.list().length ? 'grown' : 'list');
    });
  }

  /** Brings the screen up on the list of players, or on the form when there are none yet. */
  open(): void {
    this.screen.hidden = false;
    this.show('list');
  }

  close(): void {
    this.screen.hidden = true;
    this.name.blur();
  }

  private show(panel: Panel): void {
    // With nobody on this device yet, the first thing to do is add someone.
    const wanted = panel === 'list' && this.players.list().length === 0 ? 'form' : panel;
    for (const [name, element] of Object.entries(this.panels)) element.hidden = name !== wanted;
    this.title.textContent = wanted === 'grown' || wanted === 'confirm' ? 'For grown-ups' : wanted === 'form' && this.players.list().length ? 'New player' : 'Who’s playing?';
    if (wanted === 'list') this.fillList();
    else if (wanted === 'grown') this.fillGrown();
    else if (wanted === 'form') this.openForm();
  }

  private fillList(): void {
    const list = el('#who-players');
    list.replaceChildren();
    const last = this.players.last;
    for (const player of this.players.list()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'player';
      button.dataset.player = player.id;
      const name = document.createElement('b');
      name.textContent = player.name;
      button.append(badge(player), name);
      button.addEventListener('click', () => this.onPick(player));
      list.append(button);
      if (player.id === last?.id) queueMicrotask(() => button.focus({ preventScroll: true }));
    }
    if (!this.players.full) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'player add';
      add.id = 'who-add';
      const plus = document.createElement('span');
      plus.className = 'badge';
      plus.textContent = '+';
      plus.setAttribute('aria-hidden', 'true');
      const label = document.createElement('b');
      label.textContent = 'Add a player';
      add.append(plus, label);
      add.addEventListener('click', () => this.show('form'));
      list.append(add);
    }
  }

  private openForm(): void {
    this.name.value = '';
    this.problem.textContent = '';
    // Start on a colour nobody has yet, if there is one.
    const taken = new Set(this.players.list().map((player) => player.colour));
    this.pickColour((COLOURS.find((colour) => !taken.has(colour.id)) ?? COLOURS[0]).id);
    el('#who-back').hidden = this.players.list().length === 0;
    // No keyboard is pulled up on a touch screen until the box is tapped.
    if (!window.matchMedia('(pointer: coarse)').matches) this.name.focus({ preventScroll: true });
  }

  private pickColour(id: ColourId): void {
    this.colour = id;
    for (const swatch of this.swatches.querySelectorAll<HTMLElement>('.swatch')) {
      const picked = swatch.dataset.colour === id;
      swatch.setAttribute('aria-checked', String(picked));
    }
  }

  private submit(): void {
    if (!cleanName(this.name.value)) {
      this.problem.textContent = 'Type a name first.';
      this.name.focus({ preventScroll: true });
      return;
    }
    const player = this.players.add(this.name.value, this.colour);
    if (!player) {
      this.problem.textContent = 'There is room for four players on this device.';
      return;
    }
    this.name.blur();
    this.onPick(player);
  }

  private fillGrown(): void {
    const rows = el('#who-rows');
    rows.replaceChildren();
    for (const player of this.players.list()) {
      const row = document.createElement('div');
      row.className = 'grown-row';
      row.dataset.player = player.id;
      const name = document.createElement('b');
      name.textContent = player.name;
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.textContent = 'Reset progress';
      reset.dataset.action = 'reset';
      reset.addEventListener('click', () =>
        this.ask(`Reset ${player.name}’s progress? Their finished areas and best times on this device are wiped. This cannot be undone.`, 'Yes, reset', () => this.players.resetProgress(player.id)),
      );
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove player';
      remove.dataset.action = 'remove';
      remove.addEventListener('click', () =>
        this.ask(`Remove ${player.name} from this device? Their name and all their progress are wiped. This cannot be undone.`, 'Yes, remove', () => this.players.remove(player.id)),
      );
      row.append(badge(player), name, reset, remove);
      rows.append(row);
    }
  }

  private ask(question: string, yes: string, then: () => void): void {
    this.confirmed = then;
    el('#who-confirm-text').textContent = question;
    el('#who-confirm-yes').textContent = yes;
    this.show('confirm');
    // The safe answer is the one under the finger and the Enter key.
    el('#who-confirm-no').focus({ preventScroll: true });
  }
}
