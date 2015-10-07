var exceptions = require("../utils/exceptions");
var generalUtils = require("../utils/general");
var Leaderboard = require("agoragames-leaderboard");

//Open connection to general leaderboards (not timebased)
var generalLeaderboard = new Leaderboard("general");

//---------------------------------------------------------------------------------------------------------------------------
// private functions
//---------------------------------------------------------------------------------------------------------------------------

//---------------------------------------------------------------------------------------------------------------------------
// Get the general contest leaderboard
//---------------------------------------------------------------------------------------------------------------------------
module.exports.getContestLeaderboard = getContestLeaderboard;
function getContestLeaderboard(contestId) {
    return new Leaderboard("contest_" + contestId);
}

//---------------------------------------------------------------------------------------------------------------------------
// Get the contest leaderboard of a specific team
//---------------------------------------------------------------------------------------------------------------------------
module.exports.getTeamLeaderboard = getTeamLeaderboard;
function getTeamLeaderboard(contestId, teamId) {
    return new Leaderboard("contest_" + contestId + "_team" + teamId);
}

//---------------------------------------------------------------------------------------------------------------------------
// Get the weekly leaderboard
//---------------------------------------------------------------------------------------------------------------------------
module.exports.getWeeklyLeaderboard = getWeeklyLeaderboard;
function getWeeklyLeaderboard() {
    return new Leaderboard("weekly_" + generalUtils.getYearWeek());
}

//---------------------------------------------------------------------------------------------------------------------------
// prepareLeaderObject - parse member_data
//---------------------------------------------------------------------------------------------------------------------------
function prepareLeaderObject(id, leader, outsideLeaderboard) {
    var memberDataParts = leader.member_data.split("|");
    var leaderObject = {
        "id": id,
        "rank": leader.rank,
        "score": leader.score,
        "avatar": memberDataParts[0],
        "name": memberDataParts[1]
    };

    if (outsideLeaderboard) {
        leaderObject.outside = true;
    }

    return leaderObject;
}

//---------------------------------------------------------------------------------------------------------------------------
// addScore
//
// The following leaderboards are updated:
// =======================================
// 1. Contest general leaderboard - "contest_<contestId>"
// 2. Contest team leaderboard - "contest_<contestId>_team_<teamId>"
// 3. General Leaderboard (ever) - "general" (will be used to display my friends' scores)
// 4. Weekly leaderboard - weekly_<YearWeek>
//
// @deltaScore - the score currently achieved which should be increased in all leaderboards
// @facebookUserId - used as the primary member key in all leaderboards (to be able to retrieve friends leaderboard)
//---------------------------------------------------------------------------------------------------------------------------
module.exports.addScore = addScore;
function addScore(contestId, teamId, deltaScore, facebookUserId, name, avatar) {

    var contestGeneralLeaderboard = getContestLeaderboard(contestId);
    var contestTeamLeaderboard = getTeamLeaderboard(contestId, teamId);
    var weeklyLeaderboard = getWeeklyLeaderboard();

    generalLeaderboard.changeScoreFor(facebookUserId, deltaScore, function (reply) {
        generalLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name);
    });

    contestGeneralLeaderboard.changeScoreFor(facebookUserId, deltaScore, function (reply) {
        contestGeneralLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name, function (reply) {
            contestGeneralLeaderboard.disconnect();
        });
    });

    contestTeamLeaderboard.changeScoreFor(facebookUserId, deltaScore, function (reply) {
        contestTeamLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name, function (reply) {
            contestTeamLeaderboard.disconnect();
        });
    });

    weeklyLeaderboard.changeScoreFor(facebookUserId, deltaScore, function (reply) {
        weeklyLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name, function (reply) {
            weeklyLeaderboard.disconnect();
        });
    });
};

//---------------------------------------------------------------------------------------------------------------------------
// getLeaders
//
// Retrieve the first page of the input leaderboard. If my user is not included in this page, add myself to the bottom
// with flagging outside=true.
//
// data: leaderboard
// output: data.clientResponse
//---------------------------------------------------------------------------------------------------------------------------
module.exports.getLeaders = getLeaders;
function getLeaders(data, callback) {

    var options = {
        "withMemberData": true,
        "sortBy": "rank",
        "pageSize": generalUtils.settings.server.leaderboard.pageSize
    };

    data.clientResponse = [];

    data.leaderboard.leaders(0, options, function (leaders) {
        for (var i = 0; i < leaders.length; i++) {

            if (leaders[i].member === data.session.facebookUserId) {
                data.inLeaderboard = true;
            }

            data.clientResponse.push(prepareLeaderObject(i, leaders[i]));

        }

        if (!data.inLeaderboard && data.clientResponse.length > 0) {

            //I am not in the first page of the leaderboard
            var options = {"withMemberData": true, "sortBy": "rank", "pageSize": 1};
            data.leaderboard.aroundMe(data.session.facebookUserId, options, function (leaders) {
                if (leaders && leaders.length > 0) {
                    //I am in the leaderboard (not at the first page)
                    data.clientResponse.push(prepareLeaderObject(data.clientResponse.length, leaders[0], true));
                    callback(null, data);
                }
                else {
                    //I am not in the leaderboard at all (never played for that leaderboard)
                    callback(null, data);
                }
            });
        }
        else {
            //I am in the first page of the leaderboard
            callback(null, data);
        }
    });
}

//---------------------------------------------------------------------------------------------------------------------------
// getFriends
//
// Retrieve me and my friends from the general leaderboard
//
// data: session, friends (array of id,name objects)
// output: data.clientResponse
//---------------------------------------------------------------------------------------------------------------------------
module.exports.getFriends = getFriends;
function getFriends(data, callback) {

    var options = {
        "withMemberData": true,
        "sortBy": "rank",
        "pageSize": generalUtils.settings.server.leaderboard.pageSize
    };

    data.clientResponse = [];

    var members = [];
    for (var i = 0; i < data.friends.length; i++) {
        members.push(data.friends[i].id);
    }
    //Push myself as well
    members.push(data.session.facebookUserId);

    generalLeaderboard.rankedInList(members, options, function (leaders) {
        for (var i = 0; i < leaders.length; i++) {

            //Check that rank exist - otherwise this friends did not play yet and he/she is not in the leaderboard
            if (leaders[i].rank) {
                data.clientResponse.push(prepareLeaderObject(i, leaders[i]));
            }
        }

        callback(null, data);
    });
}