// Site-specific settings. No registration of individual forms required.
export const SITE = {
  "testMode": true, // true = testing (agency only); false = production emails
  "domain": "sidequesteventsco.com",
  "postPath": "/thank-you/",
  "successPath": "/thank-you/",
  "recipients": [
    "hello@sidequesteventsco.com"
  ],
  "turnstileAction": "sidequest_form",
  "agency": "hello@kthusdesigns.com",
  "from": "sidequesteventsco.com <forms@notifications.kthusdesigns.com>",
  "allowedHosts": [
    "sidequesteventsco.com",
    "www.sidequesteventsco.com",
    "sidequesteventsco-prod.netlify.app"
  ]
};
