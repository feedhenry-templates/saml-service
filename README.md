
# SAML Service
[![Dependency Status](https://img.shields.io/david/feedhenry-templates/saml-service.svg?style=flat-square)](https://david-dm.org/feedhenry-templates/saml-service)

Use this as a starting point to do SSO with your SAML IdP - this example has been configured to talk to AD FS out of the box, but `passport-saml` supports most SAML providers.

# Group SAML API

# host [/session/login_host]

'Login Host' endpoint.

## host [POST] 

'Login Host' endpoint.

+ Request (application/json)
    + Body
            {
            }

+ Response 200 (application/json)
    + Body
            {
              "host": "https://example.com/login?token=deviceId"
            }

# valid [/session/valid]

Session is valid endpoint.

## valid [POST] 

Session is valid endpoint.

+ Request (application/json)
    + Body
            {
                "token": "c55a8b1b52a63f17",
                "service": "saml"
            }

+ Response 200 (application/json)
    + Body
            {
              "status": "ok"
            }

+ Response 401 (application/json)
    + Body
            {
              "status": "expired"
            }
