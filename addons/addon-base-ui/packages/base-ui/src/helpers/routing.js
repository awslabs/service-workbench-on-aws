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

function createLinkWithSearch({ location, pathname, search }) {
  return {
    pathname,
    search: search || location.search,
    hash: location.hash,
    state: location.state,
  };
}

function createLink({ location, pathname }) {
  return {
    pathname,
    hash: location.hash,
    state: location.state,
  };
}

function reload() {
  setTimeout(() => {
    window.location.reload();
  }, 150);
}

/**
 * A generic goto function creator function that returns a go to function bound to the given react component.
 *
 * See below snippet as an example for using this function from within some react component
 * containing "location" and "history" props.
 *
 * const goto = gotoFn(this);
 * goto('/some-path');
 *
 * @param reactComponent A react component that has "location" and "history" props as injected via the "withRouter" function.
 * @returns {{new(...args: any[]): any} | ((...args: any[]) => any) | OmitThisParameter<goto> | goto | any | {new(...args: any[]): any} | ((...args: any[]) => any)}
 */
function gotoFn(reactComponent) {
  function goto(pathname) {
    const location = reactComponent.props.location;
    const link = createLink({ location, pathname });

    reactComponent.props.history.push(link);
  }
  return goto.bind(reactComponent);
}

export { createLink, createLinkWithSearch, reload, gotoFn };
