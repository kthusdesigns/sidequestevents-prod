const { DateTime } = require("luxon");

module.exports = function (dateObj) {
    return DateTime.fromJSDate(dateObj, { zone: "America/Denver" }).toISO();
};
