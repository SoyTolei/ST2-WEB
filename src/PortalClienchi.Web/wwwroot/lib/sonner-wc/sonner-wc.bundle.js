var E=3,y=4000,V=356,l=14,W=45,U=0.11,C=200,j=["altKey","KeyT"];var L='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';function H(a){switch(a){case"success":return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>';case"info":return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>';case"warning":return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" height="20" width="20"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/></svg>';case"error":return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>';case"loading":return null;default:return null}}var w=new Map,u=new Set,ia=1;function k(){return ia++}function M(a){w.set(a.toastId,a)}function R(a){if(w.get(a.toastId)===a)w.delete(a.toastId)}function v(a){return w.get(a)}function q(a){u.add(a)}function B(a){u.delete(a)}function P(){let a;for(let r of u)a=r;return a}function N(){for(let a of u)a.dismissAll()}var S=typeof HTMLElement!=="undefined"?HTMLElement:class{};var O=`:host {
  position: fixed;
  width: var(--width);
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    Segoe UI,
    Roboto,
    Helvetica Neue,
    Arial,
    Noto Sans,
    sans-serif,
    Apple Color Emoji,
    Segoe UI Emoji,
    Segoe UI Symbol,
    Noto Color Emoji;
  --gray1: hsl(0, 0%, 99%);
  --gray2: hsl(0, 0%, 97.3%);
  --gray3: hsl(0, 0%, 95.1%);
  --gray4: hsl(0, 0%, 93%);
  --gray5: hsl(0, 0%, 90.9%);
  --gray6: hsl(0, 0%, 88.7%);
  --gray7: hsl(0, 0%, 85.8%);
  --gray8: hsl(0, 0%, 78%);
  --gray9: hsl(0, 0%, 56.1%);
  --gray10: hsl(0, 0%, 52.3%);
  --gray11: hsl(0, 0%, 43.5%);
  --gray12: hsl(0, 0%, 9%);
  --border-radius: 8px;
  --width: 356px;
  --gap: 14px;
  --offset-top: 24px;
  --offset-right: 24px;
  --offset-bottom: 24px;
  --offset-left: 24px;
  --mobile-offset-top: 16px;
  --mobile-offset-right: 16px;
  --mobile-offset-bottom: 16px;
  --mobile-offset-left: 16px;
  --toast-icon-margin-start: -3px;
  --toast-icon-margin-end: 4px;
  --toast-svg-margin-start: -1px;
  --toast-svg-margin-end: 0px;
  --toast-button-margin-start: auto;
  --toast-button-margin-end: 0;
  --toast-close-button-start: 0;
  --toast-close-button-end: unset;
  --toast-close-button-transform: translate(-35%, -35%);
  inset: unset;
  border: none;
  overflow: visible;
  background: transparent;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  outline: none;
  contain: layout style;
  z-index: 999999999;
  transition: transform 400ms ease;
  display: block;
}

::backdrop {
  display: none;
}

:host(:focus-visible) {
  outline: 2px solid var(--gray9);
  outline-offset: 4px;
  border-radius: var(--border-radius);
}

[data-frame] {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

:host([dir='rtl']) {
  --toast-icon-margin-start: 4px;
  --toast-icon-margin-end: -3px;
  --toast-svg-margin-start: 0px;
  --toast-svg-margin-end: -1px;
  --toast-button-margin-start: 0;
  --toast-button-margin-end: auto;
  --toast-close-button-start: unset;
  --toast-close-button-end: 0;
  --toast-close-button-transform: translate(35%, -35%);
}

:host([data-x-position='right']) {
  right: var(--offset-right);
}
:host([data-x-position='left']) {
  left: var(--offset-left);
}
:host([data-x-position='center']) {
  left: 50%;
  transform: translateX(-50%);
}
:host([data-y-position='top']) {
  top: var(--offset-top);
}
:host([data-y-position='bottom']) {
  bottom: var(--offset-bottom);
}

@media (hover: none) and (pointer: coarse) {
  :host([data-lifted='true']) {
    transform: none;
  }
}

/* Theme palette via light-dark(). The \`theme\` attribute on <sonner-toaster>
 * (light / dark, or resolved from \`system\`) drives \`color-scheme\` on the host,
 * which determines which side of each light-dark() pair wins. */
:host([data-sonner-theme='light']) { color-scheme: light; }
:host([data-sonner-theme='dark']) { color-scheme: dark; }

:host {
  --normal-bg: light-dark(#fff, #000);
  --normal-bg-hover: light-dark(var(--gray2), hsl(0, 0%, 12%));
  --normal-border: light-dark(var(--gray4), hsl(0, 0%, 20%));
  --normal-border-hover: light-dark(var(--gray5), hsl(0, 0%, 25%));
  --normal-text: light-dark(var(--gray12), var(--gray1));
  --invert-bg: light-dark(#000, #fff);
  --invert-border: light-dark(hsl(0, 0%, 20%), var(--gray3));
  --invert-text: light-dark(var(--gray1), var(--gray12));
  --description-color: light-dark(#3f3f3f, hsl(0, 0%, 91%));
  --cancel-bg: light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.3));
  --success-bg: light-dark(hsl(143, 85%, 96%), hsl(150, 100%, 6%));
  --success-border: light-dark(hsl(145, 92%, 87%), hsl(147, 100%, 12%));
  --success-text: light-dark(hsl(140, 100%, 27%), hsl(150, 86%, 65%));
  --info-bg: light-dark(hsl(208, 100%, 97%), hsl(215, 100%, 6%));
  --info-border: light-dark(hsl(221, 91%, 93%), hsl(223, 43%, 17%));
  --info-text: light-dark(hsl(210, 92%, 45%), hsl(216, 87%, 65%));
  --warning-bg: light-dark(hsl(49, 100%, 97%), hsl(64, 100%, 6%));
  --warning-border: light-dark(hsl(49, 91%, 84%), hsl(60, 100%, 9%));
  --warning-text: light-dark(hsl(31, 92%, 45%), hsl(46, 87%, 65%));
  --error-bg: light-dark(hsl(359, 100%, 97%), hsl(358, 76%, 10%));
  --error-border: light-dark(hsl(359, 100%, 94%), hsl(357, 89%, 16%));
  --error-text: light-dark(hsl(360, 100%, 45%), hsl(358, 100%, 81%));
}

@media (max-width: 600px) {
  /* width is intentionally \`auto\` so that the toaster respects BOTH offsets
   * and fits between them. Sonner's reference CSS uses width: 100% here, but
   * that's over-constrained with both left and right set — the right offset
   * gets ignored and the element extends past the viewport's right edge by
   * --mobile-offset-right (visible unless body has overflow-x: hidden). */
  :host {
    position: fixed;
    right: var(--mobile-offset-right);
    left: var(--mobile-offset-left);
    width: auto;
  }
  :host([dir='rtl']) {
    left: calc(var(--mobile-offset-left) * -1);
  }
  :host([data-x-position='left']) {
    left: var(--mobile-offset-left);
  }
  :host([data-x-position='right']) {
    right: var(--mobile-offset-right);
  }
  :host([data-y-position='bottom']) {
    bottom: var(--mobile-offset-bottom);
  }
  :host([data-y-position='top']) {
    top: var(--mobile-offset-top);
  }
  :host([data-x-position='center']) {
    left: var(--mobile-offset-left);
    right: var(--mobile-offset-right);
    transform: none;
  }
}
`;var F=`:host {
  --y: translateY(100%);
  --lift-amount: calc(var(--lift) * var(--gap, 14px));
  z-index: var(--z-index);
  position: absolute;
  opacity: 0;
  transform: var(--y);
  contain: layout style;
  will-change: transform, opacity;
  touch-action: none;
  transition:
    transform 400ms,
    opacity 400ms,
    height 400ms,
    box-shadow 200ms;
  /* Enables the height transition to interpolate to/from auto (intrinsic size).
   * Supported in Chromium ≥129; in other engines the transition gracefully falls
   * back to snapping, same as the React Sonner reference. */
  interpolate-size: allow-keywords;
  box-sizing: border-box;
  width: var(--width);
}

[data-frame] {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  font-style: normal;
  line-height: normal;
  letter-spacing: normal;
  text-align: start;
  text-transform: none;
  color: var(--normal-text);
  outline: none;
  overflow-wrap: anywhere;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

:host([data-styled='true']) [data-frame] {
  padding: 16px;
  background: var(--normal-bg);
  border: 1px solid var(--normal-border);
  color: var(--normal-text);
  border-radius: var(--border-radius);
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
}

/* Unstyled (toast.custom): hide built-in chrome, let the slotted content fill the host. */
:host([data-styled='false']) [data-frame] {
  display: block;
}
:host([data-styled='false']) [data-icon],
:host([data-styled='false']) [data-content],
:host([data-styled='false']) [data-close-button] {
  display: none;
}

/* Hide the icon container when no icon has been slotted AND no built-in spinner is
 * showing (default-type toasts have no built-in icon, so otherwise its fixed 16x16 +
 * side margins reserve a phantom gap).
 * The element toggles data-has-icon / data-has-description on slotchange. */
:host(:not([data-has-icon]):not([data-type='loading'])) [data-icon] {
  display: none;
}
:host(:not([data-has-description])) [data-description] {
  display: none;
}

/* Spinner lives in the shadow DOM so its CSS can match its descendants (slotted
 * elements can't be styled past their host from a shadow stylesheet). It is hidden
 * by default and only revealed when type='loading' AND no user icon was slotted. */
:host([data-type='loading']:not([data-has-icon])) .sonner-loading-wrapper {
  display: block;
}
:host(:not([data-type='loading']):not([data-has-icon])) .sonner-loading-wrapper,
:host([data-has-icon]) .sonner-loading-wrapper {
  display: none;
}

:host(:focus-visible) [data-frame] {
  box-shadow:
    0px 4px 12px rgba(0, 0, 0, 0.1),
    0 0 0 2px rgba(0, 0, 0, 0.2);
}

:host([data-y-position='top']) {
  top: 0;
  --y: translateY(-100%);
  --lift: 1;
  --lift-amount: calc(1 * var(--gap, 14px));
}

:host([data-y-position='bottom']) {
  bottom: 0;
  --y: translateY(100%);
  --lift: -1;
  --lift-amount: calc(var(--lift) * var(--gap, 14px));
}

:host([data-x-position='right']) {
  right: 0;
}
:host([data-x-position='left']) {
  left: 0;
}

[data-content] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

[data-title],
::slotted([slot='title']) {
  font-weight: 500;
  line-height: 1.5;
  color: inherit;
}

[data-description] {
  font-weight: 400;
  line-height: 1.4;
  color: var(--description-color, #3f3f3f);
}
:host([data-rich-colors='true']) [data-description] {
  color: inherit;
}
::slotted([slot='description']) {
  color: inherit;
}

[data-icon] {
  display: flex;
  height: 16px;
  width: 16px;
  position: relative;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  margin-left: var(--toast-icon-margin-start);
  margin-right: var(--toast-icon-margin-end);
}
[data-icon] > * {
  flex-shrink: 0;
}
[data-icon] svg {
  margin-left: var(--toast-svg-margin-start);
  margin-right: var(--toast-svg-margin-end);
}
:host([data-promise='true']) [data-icon] > svg {
  opacity: 0;
  transform: scale(0.8);
  transform-origin: center;
  animation: sonner-fade-in 300ms ease forwards;
}

[data-button] {
  border-radius: 4px;
  padding-left: 8px;
  padding-right: 8px;
  height: 24px;
  font-size: 12px;
  background: var(--normal-text);
  color: var(--normal-bg);
  margin-left: var(--toast-button-margin-start);
  margin-right: var(--toast-button-margin-end);
  border: none;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition:
    opacity 400ms,
    box-shadow 200ms;
  font-family: inherit;
}
[data-button]:focus-visible {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4);
}
[data-cancel] {
  color: var(--normal-text);
  background: var(--cancel-bg, rgba(0, 0, 0, 0.08));
}

[data-close-button] {
  position: absolute;
  left: var(--toast-close-button-start);
  right: var(--toast-close-button-end);
  top: 0;
  height: 20px;
  width: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  color: var(--normal-text);
  background: var(--normal-bg);
  border: 1px solid var(--normal-border);
  transform: var(--toast-close-button-transform);
  border-radius: 50%;
  cursor: pointer;
  z-index: 1;
  transition:
    opacity 100ms,
    background 200ms,
    border-color 200ms;
  font: inherit;
}
[data-close-button][hidden] {
  display: none;
}
[data-close-button]:focus-visible {
  box-shadow:
    0px 4px 12px rgba(0, 0, 0, 0.1),
    0 0 0 2px rgba(0, 0, 0, 0.2);
}
:host(:hover) [data-close-button]:hover {
  background: var(--normal-bg-hover, var(--gray2));
  border-color: var(--normal-border-hover, var(--gray5));
}

:host([data-swiping='true'])::before {
  content: '';
  position: absolute;
  left: -100%;
  right: -100%;
  height: 100%;
  z-index: -1;
}
:host([data-y-position='top'][data-swiping='true'])::before {
  bottom: 50%;
  transform: scaleY(3) translateY(50%);
}
:host([data-y-position='bottom'][data-swiping='true'])::before {
  top: 50%;
  transform: scaleY(3) translateY(-50%);
}
:host([data-swiping='false'][data-removed='true'])::before {
  content: '';
  position: absolute;
  inset: 0;
  transform: scaleY(2);
}
:host([data-expanded='true'])::after {
  content: '';
  position: absolute;
  left: 0;
  height: calc(var(--gap, 14px) + 1px);
  bottom: 100%;
  width: 100%;
}

:host([data-mounted='true']) {
  --y: translateY(0);
  opacity: 1;
}

/* Heights, driven entirely by CSS. With interpolate-size:allow-keywords on :host,
 * transitions between auto (front collapsed) and the pixel var()s animate smoothly. */
:host([data-mounted='true'][data-front='true'][data-expanded='false']) {
  height: auto;
}

:host([data-expanded='false'][data-front='false']) {
  --scale: var(--toasts-before) * 0.05 + 1;
  --y: translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));
  height: var(--front-toast-height);
}

[data-frame] > * {
  transition: opacity 400ms;
}
:host([data-expanded='false'][data-front='false'][data-styled='true']) [data-frame] > * {
  opacity: 0;
}
:host([data-visible='false']) {
  opacity: 0;
  pointer-events: none;
}

:host([data-mounted='true'][data-expanded='true']) {
  --y: translateY(calc(var(--lift) * var(--offset)));
  height: var(--initial-height);
}

:host([data-removed='true'][data-front='true'][data-swipe-out='false']) {
  --y: translateY(calc(var(--lift) * -100%));
  opacity: 0;
}
:host([data-removed='true'][data-front='false'][data-swipe-out='false'][data-expanded='true']) {
  --y: translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));
  opacity: 0;
}
:host([data-removed='true'][data-front='false'][data-swipe-out='false'][data-expanded='false']) {
  --y: translateY(40%);
  opacity: 0;
  transition:
    transform 500ms,
    opacity 200ms;
}
:host([data-removed='true'][data-front='false'])::before {
  height: calc(var(--initial-height) + 20%);
}

:host([data-swiping='true']) {
  transform: var(--y) translateY(var(--swipe-amount-y, 0px)) translateX(var(--swipe-amount-x, 0px));
  transition: none;
}
:host([data-swiped='true']) {
  user-select: none;
  -webkit-user-select: none;
}
:host([data-swipe-out='true'][data-y-position='bottom']),
:host([data-swipe-out='true'][data-y-position='top']) {
  animation-duration: 200ms;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
:host([data-swipe-out='true'][data-swipe-direction='left']) {
  animation-name: swipe-out-left;
}
:host([data-swipe-out='true'][data-swipe-direction='right']) {
  animation-name: swipe-out-right;
}
:host([data-swipe-out='true'][data-swipe-direction='up']) {
  animation-name: swipe-out-up;
}
:host([data-swipe-out='true'][data-swipe-direction='down']) {
  animation-name: swipe-out-down;
}

:host([data-invert='true']) {
  --normal-bg: var(--invert-bg);
  --normal-border: var(--invert-border);
  --normal-text: var(--invert-text);
}

:host([data-rich-colors='true'][data-type='success']) [data-frame] {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}
:host([data-rich-colors='true'][data-type='success']) [data-close-button] {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success-text);
}
:host([data-rich-colors='true'][data-type='info']) [data-frame] {
  background: var(--info-bg);
  border-color: var(--info-border);
  color: var(--info-text);
}
:host([data-rich-colors='true'][data-type='info']) [data-close-button] {
  background: var(--info-bg);
  border-color: var(--info-border);
  color: var(--info-text);
}
:host([data-rich-colors='true'][data-type='warning']) [data-frame] {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}
:host([data-rich-colors='true'][data-type='warning']) [data-close-button] {
  background: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}
:host([data-rich-colors='true'][data-type='error']) [data-frame] {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}
:host([data-rich-colors='true'][data-type='error']) [data-close-button] {
  background: var(--error-bg);
  border-color: var(--error-border);
  color: var(--error-text);
}

@keyframes swipe-out-left {
  from {
    transform: var(--y) translateX(var(--swipe-amount-x));
    opacity: 1;
  }
  to {
    transform: var(--y) translateX(calc(var(--swipe-amount-x) - 100%));
    opacity: 0;
  }
}
@keyframes swipe-out-right {
  from {
    transform: var(--y) translateX(var(--swipe-amount-x));
    opacity: 1;
  }
  to {
    transform: var(--y) translateX(calc(var(--swipe-amount-x) + 100%));
    opacity: 0;
  }
}
@keyframes swipe-out-up {
  from {
    transform: var(--y) translateY(var(--swipe-amount-y));
    opacity: 1;
  }
  to {
    transform: var(--y) translateY(calc(var(--swipe-amount-y) - 100%));
    opacity: 0;
  }
}
@keyframes swipe-out-down {
  from {
    transform: var(--y) translateY(var(--swipe-amount-y));
    opacity: 1;
  }
  to {
    transform: var(--y) translateY(calc(var(--swipe-amount-y) + 100%));
    opacity: 0;
  }
}

.sonner-loading-wrapper {
  --size: 16px;
  height: var(--size);
  width: var(--size);
  position: absolute;
  inset: 0;
  z-index: 10;
}
/* The wrapper is shown/hidden by the :host([data-type='loading']…) rules above; no
 * data-visible attribute needed here. */
.sonner-spinner {
  position: relative;
  top: 50%;
  left: 50%;
  height: var(--size);
  width: var(--size);
}
.sonner-loading-bar {
  animation: sonner-spin 1.2s linear infinite;
  background: var(--gray11, hsl(0, 0%, 43.5%));
  border-radius: 6px;
  height: 8%;
  left: -10%;
  position: absolute;
  top: -3.9%;
  width: 24%;
}
.sonner-loading-bar:nth-child(1) {
  animation-delay: -1.2s;
  transform: rotate(0.0001deg) translate(146%);
}
.sonner-loading-bar:nth-child(2) {
  animation-delay: -1.1s;
  transform: rotate(30deg) translate(146%);
}
.sonner-loading-bar:nth-child(3) {
  animation-delay: -1s;
  transform: rotate(60deg) translate(146%);
}
.sonner-loading-bar:nth-child(4) {
  animation-delay: -0.9s;
  transform: rotate(90deg) translate(146%);
}
.sonner-loading-bar:nth-child(5) {
  animation-delay: -0.8s;
  transform: rotate(120deg) translate(146%);
}
.sonner-loading-bar:nth-child(6) {
  animation-delay: -0.7s;
  transform: rotate(150deg) translate(146%);
}
.sonner-loading-bar:nth-child(7) {
  animation-delay: -0.6s;
  transform: rotate(180deg) translate(146%);
}
.sonner-loading-bar:nth-child(8) {
  animation-delay: -0.5s;
  transform: rotate(210deg) translate(146%);
}
.sonner-loading-bar:nth-child(9) {
  animation-delay: -0.4s;
  transform: rotate(240deg) translate(146%);
}
.sonner-loading-bar:nth-child(10) {
  animation-delay: -0.3s;
  transform: rotate(270deg) translate(146%);
}
.sonner-loading-bar:nth-child(11) {
  animation-delay: -0.2s;
  transform: rotate(300deg) translate(146%);
}
.sonner-loading-bar:nth-child(12) {
  animation-delay: -0.1s;
  transform: rotate(330deg) translate(146%);
}

@keyframes sonner-fade-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes sonner-fade-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}
@keyframes sonner-spin {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.15;
  }
}

@media (prefers-reduced-motion) {
  :host,
  [data-frame],
  [data-frame] > *,
  .sonner-loading-bar {
    transition: none !important;
    animation: none !important;
  }
}

/* Mobile: toasts fill the toaster's full width instead of staying pinned to
 * --width (356px). Mirrors Sonner's mobile rule on [data-sonner-toast].
 * Breakpoint matches the toaster's own mobile threshold. */
@media (max-width: 600px) {
  :host([data-styled='true']),
  :host([data-styled='false']) {
    left: 0;
    right: 0;
    width: 100%;
  }
}
`;var Y=null,z=null;function A(){if(!Y)Y=new CSSStyleSheet,Y.replaceSync(O);return Y}function I(){if(!z)z=new CSSStyleSheet,z.replaceSync(F);return z}function $(a){return a==="error"||a==="warning"}function p(a,r){return a.hasAttribute(r)&&a.getAttribute(r)!=="false"}function X(a,r,t){if(t)a.setAttribute(r,"");else a.removeAttribute(r)}function K(a,r){for(let t of Array.from(a.children))if(t.getAttribute("slot")===r)a.removeChild(t)}function D(a,r){let t=document.createElement("template");t.innerHTML=a;let n=t.content.firstElementChild;if(n)n.setAttribute("slot",r);return n}function T(a,r,t){if(K(a,r),t==null||t==="")return;let n=typeof t==="function"?t():t;if(n instanceof Node){if(n instanceof Element)n.setAttribute("slot",r);a.appendChild(n)}else{let i=document.createElement("span");i.setAttribute("slot",r),i.textContent=String(n),a.appendChild(i)}}function aa(a,r,t,n,i){K(a,t);let o=r.querySelector(`[data-${t}-host]`);if(o){for(let d of Array.from(o.children))if(d.tagName==="BUTTON")o.removeChild(d)}if(!n)return;if(n instanceof HTMLElement){n.setAttribute("slot",t),a.appendChild(n);return}if(!o)return;let f=document.createElement("button");f.setAttribute("type","button"),f.setAttribute("data-button",""),f.setAttribute(t==="cancel"?"data-cancel":"data-action",""),f.textContent=n.label,f.addEventListener("click",(d)=>{if(n.onClick?.(d),d.defaultPrevented&&t==="action")return;i()}),o.appendChild(f)}var ea=Array.from({length:12},()=>'<div class="sonner-loading-bar"></div>').join(""),ca=(()=>{if(typeof document==="undefined")return null;let a=document.createElement("template");return a.innerHTML=`
    <div data-frame part="frame">
      <button type="button" data-close-button part="close-button" hidden aria-label="Close toast"></button>
      <div data-icon part="icon">
        <slot name="icon"></slot>
        <div class="sonner-loading-wrapper" aria-hidden="true">
          <div class="sonner-spinner">${ea}</div>
        </div>
      </div>
      <div data-content part="content">
        <div data-title part="title"><slot name="title"></slot></div>
        <div data-description part="description"><slot name="description"></slot></div>
      </div>
      <div data-cancel-host part="cancel"><slot name="cancel"></slot></div>
      <div data-action-host part="action"><slot name="action"></slot></div>
      <slot part="custom"></slot>
    </div>
  `,a})();class b extends S{static get observedAttributes(){return["type","duration","dismissible","position","close-button","rich-colors","invert"]}toastId=0;#n;#f;#u;#s;#t;#e=null;#d=y;#a=null;#c=0;#o=new Set;#i=null;#J=0;#h=null;#m=null;#x=!1;#b=!1;#k=!1;#v;#y;#S=null;#w=null;constructor(){super();this.#n=this.attachShadow({mode:"open"}),this.#n.adoptedStyleSheets=[I()],this.#n.appendChild(ca.content.cloneNode(!0)),this.#f=this.#n.querySelector("[data-close-button]"),this.#u=this.#n.querySelector("[data-icon]"),this.#s=this.#n.querySelector("[data-title]"),this.#t=this.#n.querySelector("[data-description]"),this.#f.innerHTML=L,this.#f.addEventListener("click",()=>this.dismiss());let a=this.#n.querySelector('slot[name="icon"]'),r=this.#n.querySelector('slot[name="description"]');a.addEventListener("slotchange",()=>this.#$("icon",a)),r.addEventListener("slotchange",()=>this.#$("description",r)),this.addEventListener("pointerdown",this.#L),this.addEventListener("pointermove",this.#H),this.addEventListener("pointerup",this.#C),this.addEventListener("pointercancel",this.#C),this.addEventListener("mouseenter",()=>this.#E("hover-self")),this.addEventListener("mouseleave",()=>this.#V("hover-self")),this.addEventListener("focusin",(t)=>{if(this.#E("focus-self"),this.#w)return;let n=t.relatedTarget;if(n&&!this.contains(n))this.#w=n}),this.addEventListener("focusout",()=>this.#V("focus-self")),this.addEventListener("keydown",(t)=>{if(t.key==="Escape"&&this.#W())t.stopPropagation(),this.dismiss()})}connectedCallback(){if(!this.toastId)this.toastId=this.getAttribute("id")||0;if(!this.hasAttribute("tabindex"))this.tabIndex=0;if(this.#p(),this.#K(),this.#G(),this.#z(),this.#X(),this.#Y(),this.setAttribute("data-sonner-toast",""),!this.hasAttribute("aria-atomic"))this.setAttribute("aria-atomic","true");if(this.setAttribute("data-mounted","false"),this.setAttribute("data-removed","false"),this.setAttribute("data-swiping","false"),this.setAttribute("data-swiped","false"),this.setAttribute("data-swipe-out","false"),!this.hasAttribute("data-styled"))this.setAttribute("data-styled","true");M(this),document.addEventListener("visibilitychange",this.#U),requestAnimationFrame(()=>{this.#x=!0,this.setAttribute("data-mounted","true"),this.dispatchEvent(new CustomEvent("sonner-toast-mounted",{bubbles:!0,composed:!0})),this.#g()})}disconnectedCallback(){if(this.#a)clearTimeout(this.#a);document.removeEventListener("visibilitychange",this.#U),R(this)}attributeChangedCallback(a,r,t){if(!this.isConnected)return;switch(a){case"type":this.#p();break;case"duration":this.#e=this.#_(),this.#d=this.#e??y;break;case"dismissible":this.#K();break;case"position":this.#G();break;case"close-button":this.#Y();break;case"rich-colors":this.#z();break;case"invert":this.#X();break}}get toastType(){return this.getAttribute("type")||"default"}dismiss(){if(this.#b||this.#k)return;if(this.#k=!0,this.#b=!0,this.setAttribute("data-removed","true"),this.#a)clearTimeout(this.#a);this.dispatchEvent(new CustomEvent("sonner-toast-dismissed",{bubbles:!0,composed:!0})),setTimeout(()=>{this.#Q(),this.#v?.(this),this.remove()},C)}#Q(){if(!this.#w)return;let a=document.activeElement;if(!a||!this.contains(a))return;let r=this.#w;if(!r.isConnected||typeof r.focus!=="function")return;r.focus()}update(a){let r=a.type!==void 0&&a.type!==this.toastType,t=$(this.toastType);if(a.type!==void 0)this.setAttribute("type",a.type);let n=!1;if(a.duration!==void 0)this.setAttribute("duration",String(a.duration)),this.#e=a.duration,this.#d=a.duration,n=!0;else if(r)this.#e=null,this.removeAttribute("duration"),this.#d=0,n=!0;if(a.dismissible!==void 0)X(this,"dismissible",a.dismissible);if(a.position!==void 0)this.setAttribute("position",a.position);if(a.closeButton!==void 0)X(this,"close-button",a.closeButton);if(a.richColors!==void 0)X(this,"rich-colors",a.richColors);if(a.invert!==void 0)X(this,"invert",a.invert);if(a.icon!==void 0)this.setIcon(a.icon);if(a.title!==void 0)this.setTitle(a.title);if(a.description!==void 0)this.setDescription(a.description);if(a.action!==void 0)aa(this,this.#n,"action",a.action,()=>this.dismiss());if(a.cancel!==void 0)aa(this,this.#n,"cancel",a.cancel,()=>this.dismiss());if(a.className)this.className=a.className;if(a.testId!==void 0)this.setAttribute("data-testid",a.testId);if(a.closeButtonAriaLabel!==void 0)this.#S=a.closeButtonAriaLabel||null,this.#Z();if(a.onDismiss)this.#v=a.onDismiss;if(a.onAutoClose)this.#y=a.onAutoClose;if(n)this.#j();if(this.#x&&r&&!t&&$(this.toastType)){let i=this.#r();if(i)this.closest("sonner-toaster")?.announceUrgent(i)}this.dispatchEvent(new CustomEvent("sonner-toast-updated",{bubbles:!0,composed:!0}))}setTitle(a){T(this,"title",a),this.#Z()}#r(){return Array.from(this.children).find((r)=>r.getAttribute("slot")==="title")?.textContent?.trim()??""}#Z(){if(this.#S){this.#f.setAttribute("aria-label",this.#S);return}let a=this.#r();this.#f.setAttribute("aria-label",a?`Close: ${a}`:"Close toast")}setDescription(a){T(this,"description",a)}setIcon(a){if(K(this,"icon"),a==null)return;if(a instanceof Node){if(a instanceof Element)a.setAttribute("slot","icon");this.appendChild(a)}else{let r=D(a,"icon");if(r)this.appendChild(r)}}setHandlers(a){this.#v=a.onDismiss,this.#y=a.onAutoClose}setPaused(a){if(a)this.#E("toaster");else this.#V("toaster")}#$(a,r){if(r.assignedNodes().length>0)this.setAttribute(`data-has-${a}`,"");else this.removeAttribute(`data-has-${a}`)}#p(){let a=this.toastType;this.setAttribute("data-type",a);let r=$(a);this.setAttribute("role",r?"alert":"status"),this.setAttribute("aria-live",r?"assertive":"polite");for(let o of Array.from(this.children))if(o.getAttribute("slot")==="icon"&&o.hasAttribute("data-sonner-default-icon"))this.removeChild(o);if(a==="loading"){this.setAttribute("data-promise","true");return}if(this.removeAttribute("data-promise"),Array.from(this.children).some((o)=>o.getAttribute("slot")==="icon"))return;let n=H(a);if(!n)return;let i=D(n,"icon");if(i)i.setAttribute("data-sonner-default-icon",""),this.appendChild(i)}#K(){let a=this.getAttribute("dismissible")!=="false";this.setAttribute("data-dismissible",String(a))}#G(){let a=this.getAttribute("position");if(!a)return;let[r,t]=a.split("-");if(r)this.setAttribute("data-y-position",r);if(t)this.setAttribute("data-x-position",t)}#Y(){this.#f.hidden=!p(this,"close-button")}#z(){this.setAttribute("data-rich-colors",String(p(this,"rich-colors")))}#X(){this.setAttribute("data-invert",String(p(this,"invert")))}#_(){let a=this.getAttribute("duration");if(a==null)return null;if(a==="Infinity")return 1/0;let r=Number(a);return Number.isFinite(r)?r:null}#l(){let a=this.#e??this.#_();if(a!==null)return a;if(this.toastType==="loading")return 1/0;return y}#g(){if(!this.#x||this.#b)return;if(this.#o.size>0)return;if(this.#a!==null)return;let a=this.#l();if(a===1/0)return;this.#d=this.#d>0?this.#d:a,this.#c=Date.now(),this.#a=setTimeout(()=>{this.#a=null,this.#y?.(this),this.dispatchEvent(new CustomEvent("sonner-toast-autoclosed",{bubbles:!0,composed:!0})),this.dismiss()},this.#d)}#E(a){let r=this.#o.size===0;if(this.#o.add(a),r&&this.#a!==null){clearTimeout(this.#a),this.#a=null;let t=Date.now()-this.#c;this.#d=Math.max(0,this.#d-t)}}#V(a){if(!this.#o.delete(a))return;if(this.#o.size===0&&!this.#b)this.#g()}#j(){if(this.#a)clearTimeout(this.#a),this.#a=null;this.#d=this.#l(),this.#g()}#U=()=>{if(document.visibilityState==="hidden")this.#E("doc-hidden");else this.#V("doc-hidden")};#W(){return this.getAttribute("dismissible")!=="false"}#L=(a)=>{if(a.button===2)return;if(this.toastType==="loading"||!this.#W())return;let r=a.composedPath()[0];if(r){if(r.tagName==="BUTTON"||typeof r.closest==="function"&&r.closest("button"))return}this.#J=Date.now();try{this.setPointerCapture(a.pointerId)}catch{}if(this.setAttribute("data-swiping","true"),this.#i={x:a.clientX,y:a.clientY},!this.#m){let t=this.getAttribute("data-y-position"),n=this.getAttribute("data-x-position"),i=[];if(t==="top"||t==="bottom")i.push(t);if(n==="left"||n==="right")i.push(n);this.#m=i.length>0?i:["bottom","right"]}};#H=(a)=>{if(!this.#i||!this.#W())return;if((window.getSelection()?.toString().length??0)>0)return;let r=a.clientY-this.#i.y,t=a.clientX-this.#i.x,n=this.#m;if(!this.#h&&(Math.abs(t)>1||Math.abs(r)>1))this.#h=Math.abs(t)>Math.abs(r)?"x":"y";let i=(d)=>1/(1.5+Math.abs(d)/20),o=0,f=0;if(this.#h==="y"){if(n.includes("top")||n.includes("bottom"))if(n.includes("top")&&r<0||n.includes("bottom")&&r>0)f=r;else{let d=r*i(r);f=Math.abs(d)<Math.abs(r)?d:r}}else if(this.#h==="x"){if(n.includes("left")||n.includes("right"))if(n.includes("left")&&t<0||n.includes("right")&&t>0)o=t;else{let d=t*i(t);o=Math.abs(d)<Math.abs(t)?d:t}}if(Math.abs(o)>0||Math.abs(f)>0)this.setAttribute("data-swiped","true");this.style.setProperty("--swipe-amount-x",`${o}px`),this.style.setProperty("--swipe-amount-y",`${f}px`)};#C=()=>{if(this.getAttribute("data-swipe-out")==="true"||!this.#W()){this.#i=null,this.#h=null,this.setAttribute("data-swiping","false");return}let a=parseFloat(this.style.getPropertyValue("--swipe-amount-x"))||0,r=parseFloat(this.style.getPropertyValue("--swipe-amount-y"))||0,t=Math.max(1,Date.now()-this.#J),n=this.#h==="x"?a:r,i=Math.abs(n)/t;if(Math.abs(n)>=W||i>U){if(this.#h==="x")this.setAttribute("data-swipe-direction",a>0?"right":"left");else this.setAttribute("data-swipe-direction",r>0?"down":"up");this.setAttribute("data-swipe-out","true"),this.dismiss()}else this.style.setProperty("--swipe-amount-x","0px"),this.style.setProperty("--swipe-amount-y","0px"),this.setAttribute("data-swiped","false");this.setAttribute("data-swiping","false"),this.#i=null,this.#h=null}}if(typeof customElements!=="undefined"&&!customElements.get("sonner-toast"))customElements.define("sonner-toast",b);function ra(a,r){if(a==null)return r;if(typeof a==="number")return`${a}px`;return a}function ta(a,r,t,n){let i=["top","right","bottom","left"];if(r==null||typeof r==="string"||typeof r==="number"){let o=ra(r,n);for(let f of i)a.style.setProperty(`${t}-${f}`,o)}else for(let o of i)a.style.setProperty(`${t}-${o}`,ra(r[o],n))}class m extends S{static get observedAttributes(){return["position","theme","rich-colors","expand","duration","gap","visible-toasts","close-button","invert","dir","offset","mobile-offset","hotkey","container-aria-label"]}#n;#f;#u;#s;#t=[];#e=new Map;#d=!1;#a=!1;#c=!1;#o=null;#i=null;constructor(){super();this.#n=this.attachShadow({mode:"open"}),this.#n.adoptedStyleSheets=[A()],this.#n.innerHTML='<div data-frame part="frame"><slot></slot></div><div data-alert-announcer role="alert" aria-live="assertive" aria-atomic="true" style="position:absolute;left:0;top:0;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;pointer-events:none"></div>',this.#f=this.#n.querySelector("[data-alert-announcer]"),this.#u=new MutationObserver((a)=>{let r=!1;for(let t of a){for(let n of Array.from(t.addedNodes))if(n instanceof b)this.#t.unshift(n),this.#s.observe(n),this.#Q(n),r=!0;for(let n of Array.from(t.removedNodes))if(n instanceof b)this.#t=this.#t.filter((i)=>i!==n),this.#e.delete(n),this.#s.unobserve(n),r=!0}if(r)this.#r({remeasure:!0})}),this.#s=new ResizeObserver(()=>this.#r({remeasure:!1})),this.addEventListener("mouseenter",this.#$),this.addEventListener("mouseleave",this.#p),this.addEventListener("focusin",this.#K),this.addEventListener("focusout",this.#G),this.addEventListener("sonner-toast-dismissed",()=>this.#r({remeasure:!1})),this.addEventListener("sonner-toast-updated",()=>this.#r({remeasure:!0})),this.addEventListener("sonner-toast-mounted",()=>this.#r({remeasure:!0}))}connectedCallback(){if(typeof this.showPopover==="function"){if(!this.hasAttribute("popover"))this.setAttribute("popover","manual");this.showPopover()}if(!this.hasAttribute("tabindex"))this.tabIndex=-1;if(!this.hasAttribute("role"))this.setAttribute("role","region");if(!this.hasAttribute("aria-label"))this.setAttribute("aria-label",this.getAttribute("container-aria-label")??"Notifications");this.#_(),this.setAttribute("data-sonner-toaster",""),this.#m(),this.#x(),this.#b(),this.#k(),this.#v(),this.#y(),this.#u.observe(this,{childList:!0});for(let a of Array.from(this.children))if(a instanceof b)this.#t.unshift(a),this.#s.observe(a),this.#Q(a);document.addEventListener("keydown",this.#z),window.addEventListener("resize",this.#Y),q(this),this.#r({remeasure:!0})}disconnectedCallback(){if(typeof this.hidePopover==="function")try{this.hidePopover()}catch{}if(this.#u.disconnect(),this.#s.disconnect(),document.removeEventListener("keydown",this.#z),window.removeEventListener("resize",this.#Y),this.#o&&this.#i)this.#o.removeEventListener("change",this.#i);B(this)}attributeChangedCallback(a,r,t){if(!this.isConnected)return;switch(a){case"position":this.#m(),this.#S(),this.#r();break;case"theme":this.#x();break;case"dir":this.#b();break;case"gap":this.#k(),this.#r();break;case"visible-toasts":this.#r();break;case"expand":this.#a=this.hasAttribute("expand");for(let n of this.#t)n.setPaused(this.#a||this.#c);this.#r();break;case"close-button":case"rich-colors":case"invert":this.#w(a);break;case"offset":case"mobile-offset":this.#y();break;case"container-aria-label":this.setAttribute("aria-label",this.getAttribute("container-aria-label")??"Notifications");break;case"hotkey":this.#_();break}}addToast(a){return this.appendChild(a),a}announceUrgent(a){this.#f.textContent="",requestAnimationFrame(()=>{this.#f.textContent=a})}dismissAll(){for(let a of Array.from(this.children))if(a instanceof b)a.dismiss()}#J(){return this.getAttribute("position")||"bottom-right"}#h(a){let[r,t]=this.#J().split("-");if(r)a.setAttribute("data-y-position",r);if(t)a.setAttribute("data-x-position",t)}#m(){this.#h(this)}#x(){if(this.#o&&this.#i)this.#o.removeEventListener("change",this.#i),this.#o=null,this.#i=null;let a=this.getAttribute("theme")||"light";if(a==="system"){this.#o=window.matchMedia("(prefers-color-scheme: dark)");let r=(t)=>{this.setAttribute("data-sonner-theme",t.matches?"dark":"light")};this.#i=r,this.#o.addEventListener("change",r),r(this.#o)}else this.setAttribute("data-sonner-theme",a)}#b(){let a=this.getAttribute("dir");if(a==="auto"||!a){let r=window.getComputedStyle(document.documentElement).direction||"ltr";this.setAttribute("dir",r)}}#k(){let a=this.getAttribute("gap"),r=a?Number(a):l;this.style.setProperty("--gap",`${Number.isFinite(r)?r:l}px`)}#v(){this.style.setProperty("--width",`${V}px`)}#y(){let a=this.getAttribute("offset"),r=this.getAttribute("mobile-offset");ta(this,a??void 0,"--offset","24px"),ta(this,r??void 0,"--mobile-offset","16px")}#S(){for(let a of this.#t)if(!a.hasAttribute("position"))this.#h(a)}#w(a){let r=this.hasAttribute(a);for(let t of this.#t){if(t.getAttribute(a)==="false")continue;if(r)t.setAttribute(a,"");else t.removeAttribute(a)}}#Q(a){if(!a.hasAttribute("position"))this.#h(a);if(!a.hasAttribute("duration")){let r=this.getAttribute("duration");if(r)a.setAttribute("duration",r)}if(!a.hasAttribute("close-button")&&this.hasAttribute("close-button"))a.setAttribute("close-button","");if(!a.hasAttribute("rich-colors")&&this.hasAttribute("rich-colors"))a.setAttribute("rich-colors","");if(!a.hasAttribute("invert")&&this.hasAttribute("invert"))a.setAttribute("invert","")}#r(a={remeasure:!1}){let r=Number(this.getAttribute("visible-toasts")??E);if(a.remeasure){this.#d=!0;for(let d of this.#t){if(d.getAttribute("data-removed")==="true")continue;let h=d.style.height;d.style.height="auto",this.#e.set(d,d.getBoundingClientRect().height),d.style.height=h}this.#d=!1}let t=this.#t.filter((d)=>d.getAttribute("data-removed")!=="true"),n=t.length>0?this.#e.get(t[0])??0:0,i=this.#Z(),o=this.#a||this.#c,f=0;this.style.setProperty("--front-toast-height",`${n}px`);for(let d=0;d<t.length;d++){let h=t[d],c=this.#e.get(h)??0,x=d===0,g=d===0?0:f+d*i;if(f+=c,h.style.setProperty("--index",String(d)),h.style.setProperty("--toasts-before",String(d)),h.style.setProperty("--z-index",String(t.length-d)),h.style.setProperty("--offset",`${g}px`),h.style.setProperty("--initial-height",`${c}px`),h.setAttribute("data-index",String(d)),h.setAttribute("data-front",String(x)),h.setAttribute("data-visible",String(d+1<=r)),h.setAttribute("data-expanded",String(o)),o||x)h.removeAttribute("aria-hidden");else h.setAttribute("aria-hidden","true")}}#Z(){let a=this.getAttribute("gap"),r=a?Number(a):l;return Number.isFinite(r)?r:l}#$=()=>{this.#c=!0;for(let a of this.#t)a.setPaused(!0);this.#r()};#p=()=>{this.#c=!1;for(let a of this.#t)a.setPaused(!1);this.#r()};#K=()=>{this.#c=!0;for(let a of this.#t)a.setPaused(!0);this.#r()};#G=(a)=>{let r=a.relatedTarget;if(r&&this.contains(r))return;this.#c=!1;for(let t of this.#t)t.setPaused(!1);this.#r()};#Y=()=>this.#r({remeasure:!0});#z=(a)=>{if(a.defaultPrevented)return;let r=a.target;if(r){let o=r.tagName;if(o==="INPUT"||o==="TEXTAREA"||o==="SELECT"||r.isContentEditable)return}let t=this.#X(),n=["altKey","ctrlKey","shiftKey","metaKey"];if(t.length>0&&t.every((o)=>{if(n.includes(o))return a[o];return a.code===o})&&n.every((o)=>t.includes(o)||!a[o])){this.#a=!0;for(let o of this.#t)o.setPaused(!0);this.focus(),this.#r();return}if(a.key==="Escape"&&this.#a&&this.contains(document.activeElement)){this.#a=!1;for(let o of this.#t)o.setPaused(!1);this.#r()}};#X(){let a=this.getAttribute("hotkey");if(a===null)return j;let r=a.trim();if(r===""||r.toLowerCase()==="none")return[];return r.split("+").map((t)=>t.trim())}#_(){let a=ga(this.#X());if(!a){if(this.#l)this.removeAttribute("aria-keyshortcuts"),this.#l=!1;if(this.#g)this.removeAttribute("title"),this.#g=!1;return}if(!this.hasAttribute("aria-keyshortcuts")||this.#l)this.setAttribute("aria-keyshortcuts",a),this.#l=!0;if(!this.hasAttribute("title")||this.#g)this.setAttribute("title",`Press ${a} to expand notifications`),this.#g=!0}#l=!1;#g=!1}function ga(a){if(a.length===0)return"";return a.map((r)=>{if(r==="altKey")return"Alt";if(r==="ctrlKey")return"Control";if(r==="shiftKey")return"Shift";if(r==="metaKey")return"Meta";if(/^Key[A-Z]$/.test(r))return r.slice(3);if(/^Digit[0-9]$/.test(r))return r.slice(5);return r}).join("+")}if(typeof customElements!=="undefined"&&!customElements.get("sonner-toaster"))customElements.define("sonner-toaster",m);function oa(a){if(a){let t=document.getElementById(a);if(t instanceof m)return t}let r=P();if(!r)r=document.createElement("sonner-toaster"),document.body.appendChild(r);return r}function Q(a){let r=a.id??k(),t=v(r);if(t)return t.update(a),t;let n=document.createElement("sonner-toast");return n.toastId=r,n.update(a),n.setHandlers({onDismiss:a.onDismiss,onAutoClose:a.onAutoClose}),oa(a.toasterId).addToast(n),n}function _(a){return(r,t)=>Q({...t,type:a,title:r})}function na(a,r){return Q({...r,type:"default",title:a})}function sa(a){if(a!==void 0){v(a)?.dismiss();return}N()}function ba(a,r){let t=r?.id??k(),n=document.createElement("sonner-toast");if(n.toastId=t,n.setAttribute("data-styled","false"),r?.duration!==void 0)n.setAttribute("duration",String(r.duration));if(r?.dismissible===!1)n.setAttribute("dismissible","false");if(r?.position)n.setAttribute("position",r.position);if(r?.testId!==void 0)n.setAttribute("data-testid",r.testId);let i=a(t);return n.appendChild(i),n.setHandlers({onDismiss:r?.onDismiss,onAutoClose:r?.onAutoClose}),oa(r?.toasterId).addToast(n),n}async function J(a,r){if(a===void 0)return;if(typeof a==="function")return a.length===0?a():a(r);return a}function la(a,r){let t=r.id??k(),{loading:n,success:i,error:o,description:f,finally:d,...h}=r,c=Q({...h,id:t,type:"loading",title:r.loading,duration:1/0,dismissible:r.dismissible??!1}),x=Promise.resolve(typeof a==="function"?a():a),g=null,da=x.then(async(e)=>{g=["resolve",e];let s=await J(r.success,e),Z=await J(r.description,e);if(s!==void 0)c.update({...h,id:t,type:"success",title:s,description:Z,duration:r.duration,dismissible:r.dismissible??!0});else c.dismiss()}).catch(async(e)=>{g=["reject",e];let s=await J(r.error,e),Z=await J(r.description,e);if(s!==void 0)c.update({...h,id:t,type:"error",title:s,description:Z,duration:r.duration,dismissible:r.dismissible??!0});else c.dismiss()}).finally(()=>r.finally?.());return Object.assign(c,{unwrap:()=>new Promise((e,s)=>{da.then(()=>{if(!g)return s(new Error("promise toast settled without a result"));if(g[0]==="resolve")e(g[1]);else s(g[1])})})})}var G=Object.assign(na,{success:_("success"),error:_("error"),info:_("info"),warning:_("warning"),loading:(a,r)=>Q({...r,type:"loading",title:a,duration:r?.duration??1/0}),message:na,promise:la,custom:ba,dismiss:sa,getToast:v});if(typeof window!=="undefined")window.toast=G;export{G as toast,m as SonnerToaster,b as SonnerToast};

//# debugId=BFFB210CB348299E64756E2164756E21
//# sourceMappingURL=sonner-wc.bundle.js.map
