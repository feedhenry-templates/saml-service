var mbaasApi = require('fh-mbaas-api');
var express = require('express');
var mbaasExpress = mbaasApi.mbaasExpress();
var cors = require('cors');
var passport = require('passport');
var ejs = require('ejs');

// list the endpoints which you want to make securable here
var securableEndpoints;
// fhlint-begin: securable-endpoints
securableEndpoints = [];
// fhlint-end

var app = express();

// Enable CORS for all requests
app.use(cors());

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys(securableEndpoints));
app.use('/mbaas', mbaasExpress.mbaas);

// allow serving of static files from the public directory
app.use(express.static(__dirname + '/public'));
// fhlint-begin: custom-routes

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('ejs', require('ejs-locals'));
app.use(require('cookie-parser')());
app.use(require('body-parser')());
app.use(require('method-override')());
app.use(require('express-session')({
  secret: 'wYAEJhxEDTkDqmHFr7EDY2GLybLuCQ'
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', require('./lib/saml.js'));

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());
// fhlint-end

// Important that this is last!
app.use(mbaasExpress.errorHandler());

var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8010;
var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
var server = app.listen(port, host, function() {
  console.log("App started at: " + new Date() + " on port: " + port);
});