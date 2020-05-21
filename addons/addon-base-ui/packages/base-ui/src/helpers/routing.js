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
