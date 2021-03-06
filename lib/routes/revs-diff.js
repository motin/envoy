'use strict';

var express = require('express'),
  router = express.Router(),
  app = require('../../app'),
  access = require('../access'),
  utils = require('../utils'),
  auth = require('../auth');

// Authenticated request to _revs_diff.
//
// Possible states per {docid, revid} tuple:
//
// 1. New document id that server has never seen:
//
//  Return {docid:{missing: [revid]}}
//
// 2. Existing docid where user has access to current leaf:
//
//  Return either {docid:{missing: [revid]}} or nothing depending on
//  whether it's present
//
// 3. Existing docid where user does not have access to current leaf:
//
//  Return {docid:{missing: [revid]}} (even though it is actuall NOT missing)
//
// The last state whilst not representing a leak at this point will
// result in a 401 for a subsequent POST, but this is true for a POST
// anyway (a.k.a 'winning the lottery').
//
// The Cloudant/Nano library does not support the revsDiff API end point
// directly, so we use the cloudant.request() call to roll our own.

router.post('/' + app.dbName + '/_revs_diff', auth.isAuthenticated, function(req, res) {
  
  // replace add ownerids to incoming ids
  var newBody = { };
  Object.keys(req.body).forEach(function(k) {
    var newkey = access.addOwnerId(k, req.session.user.name);
    newBody[newkey] = req.body[k];
  });
  
  // Now we can revs_diff
  app.cloudant.request({
    db: app.dbName,
    path: '_revs_diff',
    method: 'POST',
    body: newBody
  },
  function (err, body) {
    if (err) {
      return utils.sendError(err, res);
    }
    
    // remove ownerid from ids
    var newBody = { };
    Object.keys(body).forEach(function(k) {
      var newkey = access.removeOwnerId(k);
      newBody[newkey] = body[k];
    });

    res.send(newBody);
  });

});

module.exports = router;
