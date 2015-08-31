var FACEBOOK_GRAPH_URL = "https://graph.facebook.com";
var https = require("https");
var exceptions = require('../utils/exceptions');

//-------------------------------------------------------------------------------------
// getUserInfo
//
// Validates facebook access token and makes sure it matches the input user id
//
// data:
// -----
// input: user (contains thirdParty.accessToken, thirdParty.id)
// output: avatar
//-------------------------------------------------------------------------------------
module.exports.getUserInfo = function(data, callback) {

    https.get(FACEBOOK_GRAPH_URL + "/me?fields=id,name,email,age_range&access_token=" + data.user.thirdParty.accessToken, function (res) {

        res.setEncoding('utf8');

        res.on('data', function (responseData) {

            var facebookData = JSON.parse(responseData);
            if (facebookData && facebookData.id) {
                if (facebookData.id == data.user.thirdParty.id) {
                    data.user.avatar = getUserAvatar(data.user.thirdParty.id);
                    data.user.name = facebookData.name;
                    data.user.email = facebookData.email; //might be null if user removed
                    data.user.ageRange = facebookData.age_range;
                    callback(null, data);
                }
                else {
                    callback(new exceptions.ServerException("Error validating facebook access token, token belongs to someone else", {"facebookResponse" : responseData, "facebookAccessToken" : data.user.thirdParty.accessToken, "actualFacebookId" : facebookData.id}));
                    return;
                }
            }
            else {
                callback(new exceptions.ServerMessageException("SERVER_ERROR_INVALID_FACEBOOK_ACCESS_TOKEN", {"facebookResponse" : responseData, "facebookAccessToken" : data.user.thirdParty.accessToken}, 424));
                return;
            }

        });


    }).on('error', function (error) {
        console.error(error);
        callback(new exceptions.ServerException("Error recevied from facebook while validating access token", {"facebookAccessToken" : data.user.thirdParty.accessToken, "error" :  error}));
    });
};

//-------------------------------------------------------------------------------------
// getUserAvatar
//
// Returns the facebook avatar
//-------------------------------------------------------------------------------------
module.exports.getUserAvatar = getUserAvatar;
function getUserAvatar(facebookUserId) {
    return "http://graph.facebook.com/" + facebookUserId + "/picture?type=square";
}
