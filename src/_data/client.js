module.exports = {
    name: "SideQuest Events",
    email: "hello@sidequesteventsco.com",
    phoneForTel: "",
    phoneFormatted: "",
    address: {
        lineOne: "9200 E Mineral Ave, Suite 100",
        lineTwo: "",
        city: "Centennial",
        state: "CO",
        zip: "80112",
        country: "USA",
        mapLink: "",
    },
    socials: {
        facebook: "https://www.facebook.com/profile.php?id=61574314058847",
        instagram: "https://www.instagram.com/sidequest_events_co/",
    },
    //! Make sure you include the file protocol (e.g. https://) and that NO TRAILING SLASH is included
    domain: "https://sidequesteventsco.com",
    // Passing the isProduction variable for use in HTML templates
    isProduction: process.env.ELEVENTY_ENV === "PROD",
};