'use strict';

/**
 * Uitls functions
 * 
 */
module.exports = {
  /**
  * Shuffling array.
  * 
  * @param {Array} array 
  * @returns {Array} shuffled array
  */
  shuffle: function (array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
  }
}