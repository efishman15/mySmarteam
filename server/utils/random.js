var seedrandom = require('seedrandom');
var rng = seedrandom("very secret key...");

module.exports.rnd = function (minInclussive, maxInclussive) {
    return minInclussive + Math.floor(rng() * (maxInclussive - minInclussive + 1));
};

module.exports.pick = function(array) {
    return array[this.rnd(0,array.length-1)];
};

module.exports.shuffle = function(array) {

    //Fisher-Yates Shuffle
    var counter = array.length, temp, index;

    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        index = this.rnd(0, counter-1);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
};