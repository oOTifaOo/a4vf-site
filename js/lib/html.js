/* Tiny templating: every value is escaped unless it is itself an html`` result. */

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function toMarkup(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(toMarkup).join('');
  if (value instanceof SafeHtml) return value.value;
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

export function html(strings, ...values) {
  return new SafeHtml(strings.reduce((out, text, i) => out + text + toMarkup(values[i]), ''));
}

export function mount(element, template) {
  element.innerHTML = template.value;
}
