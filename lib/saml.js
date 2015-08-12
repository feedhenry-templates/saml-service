var passport = require('passport');
var express = require('express');
var router = new express.Router();
var SamlStrategy = require('passport-saml').Strategy;
var xml2js = require('xml2js').parseString;
var _ = require('lodash-contrib');
var moment = require('moment');
var async = require('async');
var Model = require('./model.js');
var Tokens = new Model();


// TODO: Move into a new $fh.host() fh-mbaas-api call
var request = require('request');

function host(cb) {
  var url = 'https://' + process.env.FH_MILLICORE + '/box/srv/1.1/ide/apps/app/hosts';
  var data = {
    "guid": process.env.FH_INSTANCE,
    "env": process.env.FH_ENV
  }

  request.post({
    url: url,
    json: true,
    body: data
  }, function(err, res, body) {
    if (err) return cb(err);

    return cb(err, _.getPath(body, "hosts.url"));
  });
}

// Map to convert between user claims released from WS-Federation and SAML 2 / Shibboleth
var map = {
  email: {
    shibboleth: 'urn:oid:0.9.2342.19200300.100.1.3',
    ws_federation: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    custom: 'email'
  },
  first_name: {
    shibboleth: 'urn:oid:2.5.4.42',
    ws_federation: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    custom: 'firstname'
  },
  surname: {
    shibboleth: 'urn:oid:2.5.4.4',
    ws_federation: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    custom: 'lastname'
  },
  display_name: {
    shibboleth: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    ws_federation: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    custom: 'name'
  },
  groups: {
    shibboleth: 'http://schemas.xmlsoap.org/claims/Group',
    ws_federation: 'http://schemas.xmlsoap.org/claims/Group',
    custom: 'groups'
  }
};

// e.g. lookupFromProfile('email', project) => 'bob@example.com'
var lookupFromProfile = function(friendly, profile) {
  if (!profile) return;

  var keys = map[friendly];

  if (keys.custom in profile) return profile[keys.custom];
  if (keys.shibboleth in profile) return profile[keys.shibboleth];
  if (keys.ws_federation in profile) return profile[keys.ws_federation];
};

var samlConfig;

function setup() {
  // Fetch our own Host prior to setting up Passport strategy
  host(function(err, host) {
    if (err) {
      console.error('Failed to fetch MBaaS Service host - SAML may not work unless SAML_CALLBACK_URL & SAML_ISSUER set');
    }

    samlConfig = {
      issuer: process.env.SAML_ISSUER || host + '/login/callback', // Default to MBaaS host
      callbackUrl: process.env.SAML_CALLBACK_URL || host + '/login/callback',
      entryPoint: process.env.SAML_ENTRY_POINT,
      authnContext: process.env.SAML_AUTHN_CONTEXT || 'urn:federation:authentication:windows',
      identifierFormat: null
    };

    if (process.env.SAML_CERT && process.env.SAML_CERT !== "") {
      samlConfig.cert = process.env.SAML_CERT;
    }

    // Setup Passport.js
    passport.use(new SamlStrategy(samlConfig, function verifyCallback(user, done) {
      return done(null, user);
    }));

    console.log('Passport.js Configured.')

    passport.serializeUser(function(user, done) {
      done(null, user);
    });

    passport.deserializeUser(function(user, done) {
      done(null, user);
    });
  });
}

setup();

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Process SAML assertion received and persist
function processToken(req, cb) {
  var firstName = lookupFromProfile('first_name', req.user);
  var lastName = lookupFromProfile('surname', req.user);
  var email = lookupFromProfile('email', req.user);
  var groups = lookupFromProfile('groups', req.user);
  var notBefore;
  var notOnOrAfter;
  var token = req.session.token; // Device ID/proxy token

  // Token Base64 encoded, decode before persisting
  var samlb64 = req.body.SAMLResponse;
  var b64Buffer = new Buffer(samlb64, 'base64');
  var samlXML = b64Buffer.toString();

  // Set assertion for session
  req.session.saml = samlXML;

  async.waterfall([
    // Parse our SAML XML for NotBefore & NotOnOrAfter conditions
    function parseConditions(callback) {
      xml2js(samlXML, {
        explicitArray: false
      }, function(err, result) {
        if (err) return callback(err);

        notBefore = _.getPath(result, "samlp:Response.Assertion.Conditions.$.NotBefore");
        notOnOrAfter = _.getPath(result, "samlp:Response.Assertion.Conditions.$.NotOnOrAfter");
        return callback();
      });
    },

    function persist(callback) {
      var fields = {
        "token": token,
        "first_name": firstName,
        "last_name": lastName,
        "email": email,
        "updated": new Date().getTime(),
        "services": {
          "saml": {
            "assertion": samlXML,
            "groups": groups,
            "notBefore": notBefore,
            "notOnOrAfter": notOnOrAfter
          }
        }
      };

      // Create or update existing token
      Tokens.createOrUpdate(token, fields, function(err, data) {
        return callback(err, data);
      });
    }
  ], function done(err, data) {
    return cb(err, data);
  });
}

// Index route, shows our "Login" link
// 
// We could just redirect to the IdP here if we don't want to show 
// an interstitial (just call `passport.authenticate(...)` instead)
router.get('/', function(req, res) {
  var params = {
    page: req.path,
    user: req.user,
    config: samlConfig,
    host: "https://" + req.headers.host + "/login/callback"
  };

  res.render('index', params);
});


// GET /login?token=<token> - redirect to configured IdP
router.get('/login',
  function(req, res, next) {
    var token = req.query.token;

    // Save token in user session
    req.session.token = token;

    return next();
  },
  passport.authenticate('saml', {
    failureRedirect: '/',
    failureFlash: true
  })
);

// IdP callback after successful authentication
// We have access to a Base64 encoded copy of our SAML 
// response & assertion here via `req.body.SAMLResponse`
router.post('/login/callback',
  passport.authenticate('saml', {
    failureRedirect: '/',
    failureFlash: true
  }),
  function successCallback(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user's SAML Assertion claims, as parsed by passport-saml
    // `req.body.SAMLResponse` contains a Base64 encoded SAML Response

    // Persist our SAML assertion for this user via $fh.db
    processToken(req, function(err) {
      if (err) return res.status(400).json({
        msg: "Error: " + err
      });

      // Redirect to Login OK (signals successful auth to Mobile Client)
      return res.redirect('/login/ok');
    });
  }
);

router.get('/logout', function(req, res) {
  req.logout();
  req.session.destroy(function(err) {
    res.redirect('/');
  });
});

// Page shown/redirected to after successful authentication
// This could be altered to render nothing instead
// This is the page that the example SAML Client waits for to verify that an auth was successful
router.get('/login/ok', ensureAuthenticated, function(req, res) {
  var params = {
    page: req.path,
    user: req.user,
    // Different kinds of SAML providers handle logout differently - this example works with ADFS
    logout_link: process.env.SAML_ENTRY_POINT + "?wa=wsignoutcleanup1.0",
    first_name: lookupFromProfile('first_name', req.user),
    last_name: lookupFromProfile('surname', req.user),
    email: lookupFromProfile('email', req.user),
    groups: lookupFromProfile('groups', req.user),
    // Useful for debugging, but can be removed
    saml: req.session.saml
  };

  res.render('logged_in', params);
});

// Called by Cloud Apps who want to display 
// SAML IdP Login screen in an InAppBrowser
router.post('/session/login_host', function(req, res) {
  var token = req.body.token;

  // Return SSO URL (this will redirect to the IdP)
  res.json({
    host: "https://" + req.headers.host + "/login?token=" + token
  });
});

// Cloud apps can ask this service if a current device has a session
router.post('/session/valid', function(req, res) {
  var token = req.body.token;

  if (!token) {
    return res.status(400).json({
      "message": "token param not found"
    });
  }

  var service = req.body.service || "saml";

  Tokens.findByToken(token, function(err, data) {
    console.log('token found', data);
    if (err) {
      console.error(err);
      return res.status(400).json({
        error: err
      });
    }

    if (!data) {
      return res.status(404).json({
        "message": "Token not found"
      });
    }

    var authDataForService = data.fields.services[service];
    var expired = false;
    var expires;
    if (service === "saml") {
      // Check expiration
      expires = moment.utc(authDataForService.notOnOrAfter);
      expired = moment().isAfter(expires);
      console.log('expired?', expired);
    }

    if (expired) {
      return res.status(401).json({
        message: "Token expired, re-authenticate please"
      });
    }

    // All good!
    return res.status(200).json({
      expires: expires,
      expired: expired,
      token: token,
      first_name: data.fields.first_name,
      last_name: data.fields.last_name,
      email: data.fields.email
    });
  });
});

module.exports = router;