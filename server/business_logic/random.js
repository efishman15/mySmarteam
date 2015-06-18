var seedrandom = require('seedrandom');
var rng = seedrandom("very secret key...");

module.exports.rnd = function (minInclussive, maxInclussive) {
    return minInclussive + Math.floor(rng() * (maxInclussive - minInclussive + 1));
}
