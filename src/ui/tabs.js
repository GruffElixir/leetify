export function selectTab(list, selected) {
  list.querySelectorAll('[role=tab]').forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', active);
    tab.tabIndex = active ? 0 : -1;
  });
}
export function bindTabs(root) {
  const update = (list) =>
    list.querySelectorAll('[role=tab]').forEach((tab) => {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    });
  root.querySelectorAll('[role=tablist]').forEach(update);
  const key = (event) => {
    const current = event.target.closest('[role=tab]');
    if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const list = current.closest('[role=tablist]');
    const tabs = Array.from(list.querySelectorAll('[role=tab]'));
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (tabs.indexOf(current) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
            tabs.length;
    event.preventDefault();
    tabs[index].click();
    tabs[index].focus();
    update(list);
  };
  root.addEventListener('keydown', key);
  return () => root.removeEventListener('keydown', key);
}
