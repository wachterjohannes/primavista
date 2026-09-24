import type { BalloonApi } from './types';

/**
 * Floating panel inside the content wrapper. The wrapper is positioned, so
 * the balloon can be placed with plain offsets relative to it.
 */
export function createBalloon(wrapper: HTMLElement): BalloonApi & { destroy(): void } {
  const element = document.createElement('div');
  element.className = 'pv-balloon';
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  wrapper.appendChild(element);

  let anchor: HTMLElement | null = null;

  const reposition = (): void => {
    if (element.hidden || !anchor || !anchor.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const maxLeft = Math.max(0, wrapper.clientWidth - element.offsetWidth - 4);
    const left = Math.min(Math.max(0, rect.left - wrapperRect.left), maxLeft);
    element.style.left = `${left}px`;
    element.style.top = `${rect.bottom - wrapperRect.top + 4}px`;
  };

  const hide = (): void => {
    if (element.hidden) return;
    element.hidden = true;
    element.innerHTML = '';
    anchor = null;
  };

  const show: BalloonApi['show'] = (nextAnchor, render) => {
    element.innerHTML = '';
    anchor = nextAnchor;
    element.hidden = false;
    render(element, hide);
    reposition();
  };

  const onScroll = (): void => reposition();
  wrapper.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  return {
    show,
    hide,
    isOpen: () => !element.hidden,
    reposition,
    destroy() {
      hide();
      wrapper.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      element.remove();
    },
  };
}
