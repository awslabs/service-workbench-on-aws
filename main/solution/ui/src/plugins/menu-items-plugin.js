/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

/**
 * Adds your navigation menu items to the given itemsMap.
 * This function is called last after adding navigation menu items to the itemsMap from all other installed addons.
 *
 * @param itemsMap A Map containing navigation menu items. This object is a Map that has route paths (urls) as
 * keys and menu item object with the following shape
 *
 *   {
 *    title: STRING, // Title for the navigation menu item
 *    icon: STRING, // semantic ui icon name fot the navigation menu item
 *    shouldShow: FUNCTION, // A function that returns a flag indicating whether to show the item or not (useful when showing menu items conditionally)
 *    render: OPTIONAL FUNCTION, // Optional function that returns rendered menu item component. Use this ONLY if you want to control full rendering of the menu item.
 *   }
 *
 * @param appContext An application context object containing all MobX store objects
 *
 * @returns Map<*> Returns A Map containing navigation menu items with the same shape as "itemsMap"
 */
// eslint-disable-next-line no-unused-vars
function registerMenuItems(itemsMap, { location, appContext }) {
  // This is where you can
  // 1. register your navigation menu items, to register your items
  //
  //       const items = new Map([
  //          ...itemsMap,
  //          // Add your navigation menu items here
  //          ['/your/menu/item1/url', {title:'my menu item1',icon:'some-icon-from-semantic-ui'}],
  //          ['/your/menu/item2/url', {title:'my menu item2',icon:'some-icon-from-semantic-ui',shouldShow:()=>true}],
  //          ['/your/menu/item3/url', {render:()=>{ // return rendered menu item here }] ]);
  //       return items;
  //
  // 2. modify any existing items
  //
  //       items.set('the/menu/item/url/you/want/to/replace',{title:'my menu item1',icon:'some-icon-from-semantic-ui'});
  //       return routesMap;
  //
  // 3. delete any existing route, to delete existing route
  //
  //      items.delete('the/menu/item/url/you/want/to/delete');
  //

  // TODO: Register additional custom navigation menu items here
  const items = new Map([...itemsMap]);
  // DO NOT forget to return items here. If you do not return any menu items here then the menu will not show any items
  return items;
}

const plugin = {
  registerMenuItems,
};

export default plugin;
