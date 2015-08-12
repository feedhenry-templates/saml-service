var $fh = require('fh-mbaas-api');
var _ = require('lodash-contrib');
var SESSIONS_COLLECTION = 'sessions';

// Some constructors
function TokenCollection() {}

TokenCollection.prototype.findByToken = function(token, cb) {
  $fh.db({
    "act": "list",
    "type": SESSIONS_COLLECTION,
    "eq": {
      "token": token
    }
  }, function(err, data) {
    if (err) return cb(err);
    if (data.count === 0) return cb(null, null);

    console.log('findByToken()', token, JSON.stringify(data));

    return cb(null, _.last(data.list));
  });
}

TokenCollection.prototype.create = function(data, cb) {
  $fh.db({
    "act": "create",
    "type": SESSIONS_COLLECTION,
    "fields": data
  }, function(err, data) {
    if (err) {
      console.error("Error " + err);
      return cb(err);
    } else {
      console.log('Persisted', data);
      return cb();
    }
  });
}

TokenCollection.prototype.update = function(id, data, cb) {
  $fh.db({
    "act": "update",
    "type": SESSIONS_COLLECTION,
    "guid": id,
    "fields": data
  }, function(err, data) {
    if (err) {
      console.error("Error " + err);
      return cb(err);
    } else {
      console.log('Updated', data);
      return cb();
    }
  });
}

TokenCollection.prototype.createOrUpdate = function(token, fields, cb) {
  var self = this;

  self.findByToken(token, function(err, data) {
    if (err) {
      console.error(err);
      return cb(err);
    }

    if (!data) {
      // Create a new token
      console.log('no existing token');
      self.create(fields, function(err, data) {
        if (err) {
          console.error("Error " + err);
          return cb(err);
        } else {
          console.log('Persisted', data);
          return cb(null, data);
        }
      });
    } else {
      // Update an existing one
      console.log('existing token exists', data);
      self.update(data.guid, fields, function(err, new_data) {
        if (err) {
          console.error("Error (update)" + err);
          return cb(err);
        } else {
          console.log('Persisted (update)', new_data);
          return cb(null, new_data);
        }
      });
    }
  });
}

module.exports = TokenCollection;