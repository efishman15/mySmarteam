var generalUtils = require("../utils/general");
var Leaderboard = require("agoragames-leaderboard");
var logger = require("../utils/logger");

//Open connection to general leaderboards (not timebased)
var generalLeaderboard = new Leaderboard("general");

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

    var contestGeneralLeaderboard = new Leaderboard("contest_" + contestId);
    var contestTeamLeaderboard = new Leaderboard("contest_" + contestId + "_team" + teamId);
    var weeklyLeaderboard = new Leaderboard("weekly_" + generalUtils.getYearWeek());

    generalLeaderboard.changeScoreFor(facebookUserId, deltaScore, function(reply) {
        generalLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name);
    });

    contestGeneralLeaderboard.changeScoreFor(facebookUserId, deltaScore, function(reply) {
        contestGeneralLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name);
    });

    contestTeamLeaderboard.changeScoreFor(facebookUserId, deltaScore, function(reply) {
        contestTeamLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name);
    });

    weeklyLeaderboard.changeScoreFor(facebookUserId, deltaScore, function(reply) {
        contestTeamLeaderboard.updateMemberData(facebookUserId, avatar + "|" + name);
    });
};