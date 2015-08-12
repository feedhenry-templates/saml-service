## Notes

### Overview

Below is a general outline of what this example SAML Service provides:

* It's an ExpressJS app which uses [Passport.js](http://passportjs.org/) and a [passport-saml](https://github.com/bergie/passport-saml) strategy for SAML authentication
* It has been tested with Active Directory Federation Services 2.0 IdP via SAML 2.0, although it should work with most SAML IdPs
* Cloud apps calling `/session/login_host` on this service (and passing on a device ID or some other kind of identifier via a `token` param) will 
receive a URL for them to open on a Client App via an in-app browser (see example SAML Project)
* After opening the login route on device, they'll get redirected to their IdP to perform a login
* After successfully authenticating, the IdP will POST a SAML assertion back to `/login/callback`
* Here we do a few things:
  - Correspond the received SAML assertion and the user's proxy token/device ID (which we'd persisted as `req.session.token`)
  - Persist data from the SAML assertion
  - Redirect to `/login/ok` - which the Client App will use to determine if authentication was successful or not (and close the in-app-browser)