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

import _ from 'lodash';
import showdown from 'showdown';

const classMap = {
  h1: 'ui large header clearfix',
  h2: 'ui medium header clearfix',
  ul: 'ui list undo-line-height',
  li: 'ui item undo-line-height',
  p: 'ui undo-line-height clearfix',
  // img: 'ui fluid image'
  img: 'ui left floated image clearfix mb2 mr2',
};

const bindings = Object.keys(classMap).map(key => ({
  type: 'output',
  regex: new RegExp(`<${key}(.*)>`, 'g'),
  replace: `<${key} class="${classMap[key]}" $1>`,
}));

// A wrapper around the showdown.js library https://github.com/showdownjs/showdown
class Showdown {
  constructor(appContext) {
    this.appContext = appContext;
    // see https://github.com/showdownjs/showdown/wiki/Add-default-classes-for-each-HTML-element
    this.converter = new showdown.Converter({
      extensions: [...bindings],
    });
    // this.converter.setFlavor('github');
    this.converter.setFlavor('vanilla');

    // options are available here https://github.com/showdownjs/showdown/wiki/Showdown-options
    this.converter.setOption('parseImgDimensions', true);
  }

  convert(markdown, assets = {}) {
    // example of markdown http://demo.showdownjs.com/
    // we will append all the assets as image references (this is not efficient at all), when we
    // have time we can the correct image src mapping in an extension
    let extended = `${markdown}\n\n`;
    _.forEach(assets, (url, name) => {
      extended = `${extended}[${name}]: ${url}\n`;
    });

    return this.converter.makeHtml(extended);
  }
}

function registerContextItems(appContext) {
  appContext.showdown = new Showdown(appContext);
}

export { Showdown, registerContextItems };
