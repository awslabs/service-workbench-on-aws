import React from 'react';
// from https://github.com/Semantic-Org/Semantic-UI-React/blob/master/docs/src/layouts/FixedMenuLayout.js
// from https://react.semantic-ui.com/layouts/fixed-menu
const Footer = () => (
  <>
    {/* <div style={{ height: '100px' }}></div> */}
    <div className="ui inverted vertical footer segment">
      <div className="ui container">
        <div className="ui stackable inverted divided equal height stackable grid">
          <div className="three wide column">
            <h4 className="ui inverted header">About</h4>
            <div className="ui inverted link list">Contact Us</div>
          </div>
          <div className="three wide column">
            <h4 className="ui inverted header">Services</h4>
            <div className="ui inverted link list">How To</div>
          </div>
          <div className="seven wide column">
            <h4 className="ui inverted header">Footer Header</h4>
            <p>Extra space for a call to action inside the footer that could help re-engage users.</p>
          </div>
        </div>
      </div>
    </div>
  </>
);

export default Footer;
