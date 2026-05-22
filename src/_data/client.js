module.exports = {
    name: "United Community Action Network",
    email: "ucanhomeown@gmail.com",
    phoneForTel: "",
    phoneFormatted: "",
    address: {
        lineOne: "4707 Pearl St",
        lineTwo: "",
        city: "Denver",
        state: "CO",
        zip: "80216",
        country: "USA",
        mapLink: "",
    },
    socials: {
        facebook: "https://www.facebook.com/people/UCAN-Metro-Denver/61560144546869/#",
        instragram: "https://www.instagram.com/ucanhomeown/",
    },
    //! Make sure you include the file protocol (e.g. https://) and that NO TRAILING SLASH is included
    domain: "https://ucanmetrodenver.org",
    // Passing the isProduction variable for use in HTML templates
    isProduction: process.env.ELEVENTY_ENV === "PROD",
};