var app = require('./application');

var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';

var server = app.listen(port, host, function() {
  console.log("App started at: " + new Date() + " on port: " + port);
});
