/* One delegated tooltip setup: any element with data-bs-title gets a tooltip,
   including elements rendered later. Tooltips also work with the keyboard and on touch. */

const SELECTOR = '[data-bs-title]';
const TOUCH_HIDE_MS = 2000;
const options = { container: 'body', trigger: 'hover focus' };

const { Tooltip } = window.bootstrap;
const isTouch = () => matchMedia('(hover: none)').matches;

export function initTooltips() {
  new Tooltip(document.body, { ...options, selector: SELECTOR });

  // These controls take keyboard focus on a different element from the one with the tooltip.
  const tooltipOwner = ({ target }) => {
    if (target.matches?.('.btn-check')) return document.querySelector(`label[for="${target.id}"]${SELECTOR}`);
    if (target.matches?.('[data-bs-toggle="dropdown"]')) return target.querySelector(SELECTOR);
    return null;
  };
  document.addEventListener('focusin', (event) => {
    const owner = tooltipOwner(event);
    if (owner && event.target.matches(':focus-visible')) Tooltip.getOrCreateInstance(owner, options).show();
  });
  document.addEventListener('focusout', (event) => {
    const owner = tooltipOwner(event);
    if (owner) Tooltip.getInstance(owner)?.hide();
  });

  // A tooltip must not sit on top of the menu or result a click just opened.
  document.addEventListener('click', (event) => {
    const owner = event.target.closest?.(SELECTOR);
    if (owner && !isTouch()) Tooltip.getInstance(owner)?.hide();
  });

  // Touch has no pointer leaving the element, so hide after a moment.
  document.addEventListener('shown.bs.tooltip', (event) => {
    if (isTouch()) setTimeout(() => Tooltip.getInstance(event.target)?.hide(), TOUCH_HIDE_MS);
  });
}

/** Removes open tooltips before their owners are replaced by a new view. */
export function clearTooltips() {
  document.querySelectorAll('.tooltip').forEach((element) => element.remove());
}
