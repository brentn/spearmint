/** jsdom doesn't implement <dialog>'s showModal()/close() (plain no-op HTMLElement methods,
 * undefined on the prototype) — call this from a spec's beforeAll so opening/closing a dialog
 * in a component test behaves like a real browser instead of throwing. */
export function stubDialogMethods(): void {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
