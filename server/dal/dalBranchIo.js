var BRANCH_END_POINT = "https://api.branch.io/v1/url";
var generalUtils = require('../utils/general');
var exceptions = require('../utils/exceptions');
var dalHttp = require("./dalHttp");

//---------------------------------------------------------------------------------------------------------------------------------
// createLink
//
// data: contest (only _id is required)
// output: data.contest.link
//
// create a new link in Branch IO
//---------------------------------------------------------------------------------------------------------------------------------
module.exports.createContestLink = function (data, callback) {

    var postData = {
        "branch_key": generalUtils.settings.server.branch.key,
        "alias": "c" + data.contest._id,
        "feature": "contest",
        "data": {
            "$og_redirect": generalUtils.settings.server.branch.contestLinkPrefix + data.contest._id,
            "contestId": data.contest._id,
        }
    };

    var options = {
        "url": BRANCH_END_POINT,
        "body": postData,
        "json": true
    };

    dalHttp.post(options, function (branchData) {
        data.contest.link = branchData.url;
        callback(null, data);
    });
}
