
const inputManifestForCreate = {
  sections: [{
      title: 'General Information',
      children: [{
          name: 'id',
          type: 'stringInput',
          title: 'ID',
          rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
          desc: 'This is a required field. This is used for uniquely identifying the authentication provider. ' +
            'It must be between 2 to 64 characters long and must start with an alphabet and may contain alpha numeric ' +
            'characters, underscores, and dashes. No other special symbols are allowed.',
        },
        {
          name: 'title',
          type: 'stringInput',
          title: 'Title',
          rules: 'required|between:3,255',
          desc: 'This is a required field and must be between 3 and 255 characters long.',
        },
        {
          name: 'signInUri',
          type: 'stringInput',
          title: 'Sign In URI',
          rules: 'required|between:3,255',
          desc: 'The Sign In URI that accepts username/password for signing in.',
        },
      ],
    },
    {
      title: 'Existing Auth0 App Information',
      children: [{
          name: 'auth0Domain',
          type: 'stringInput',
          title: 'Auth0 Domain',
          rules: 'required|string',
          desc: 'Enter the domain of the Auth0 app you want to connect to.',
        },
        {
          name: 'auth0ClientId',
          type: 'stringInput',
          title: 'Auth0 Client Id',
          desc: 'Enter Client Id for the Auth0 app you want to connect to.',
        },
      ],
    },
  ],
};

module.exports = {
  inputManifestForCreate
};