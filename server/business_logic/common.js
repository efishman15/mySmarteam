var path = require("path");
var generalUtils = require(path.resolve(__dirname,"../utils/general"));

//---------------------------------------------------------------------------------
// addXp
//
// data: session
// output: data.xpProgress object created/modified ready to be sent to the client
//---------------------------------------------------------------------------------
module.exports.addXp = function (data, action) {

    if (!data.xpProgress) {
        data.xpProgress = new generalUtils.XpProgress(data.session.xp, data.session.rank);
    }

    data.xpProgress.addXp(data.session, action);

}
