/**
 * Adds workflow navigation menu items to the given itemsMap.
 *
 * @param itemsMap A Map containing navigation items. This object is a Map that has route paths (urls) as
 * keys and menu item object with the following shape
 *
 *   {
 *    title: STRING, // Title for the navigation menu item
 *    icon: STRING, // semantic ui icon name fot the navigation menu item
 *    shouldShow: BOOLEAN || FUNCTION, // A flag or a function that returns a flag indicating whether to show the item or not (useful when showing menu items conditionally)
 *    render: OPTIONAL FUNCTION, // Optional function that returns rendered menu item component. Use this ONLY if you want to control full rendering of the menu item.
 *   }
 *
 * @param context A context object containing all various stores
 *
 * @returns Map<*> Returns A Map containing navigation menu items with the same shape as "itemsMap"
 */
// eslint-disable-next-line no-unused-vars
function registerMenuItems(itemsMap, { location, appContext }) {
  const items = new Map([
    ...itemsMap,
    [
      '/key-pair-management',
      {
        title: 'SSH Keys',
        icon: 'terminal',
        shouldShow: true,
      },
    ],
  ]);

  return items;
}
const plugin = {
  registerMenuItems,
};
export default plugin;
