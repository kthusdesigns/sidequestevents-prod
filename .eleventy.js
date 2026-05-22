// ─────────────────────────────────────────────────────────────────────────────
// ELEVENTY CONFIGURATION
// This file configures how Eleventy builds your static site
// Documentation: https://www.11ty.dev/docs/config/
// ─────────────────────────────────────────────────────────────────────────────

// 📦 Plugin Imports
const pluginImages = require("@codestitchofficial/eleventy-plugin-sharp-images");
const pluginMinifier = require("@codestitchofficial/eleventy-plugin-minify");
const pluginSitemap = require("@quasibit/eleventy-plugin-sitemap");
const eleventyNavigationPlugin = require('@11ty/eleventy-navigation');
const Image = require('@11ty/eleventy-img');
const path = require('path');

// ⚙️ Configuration Files
const configSitemap = require("./src/config/plugins/sitemap");
const configImages = require("./src/config/plugins/images");

// 🔧 Processing Functions
const sass = require("./src/config/processors/sass");
const javascript = require("./src/config/processors/javascript");

// 🛠️ Utilities
const filterPostDate = require("./src/config/filters/postDate");
const filterIsoDate = require("./src/config/filters/isoDate");
const isProduction = process.env.ELEVENTY_ENV === "PROD";

// allows the use of {% image... %} to create responsive, optimised images
// CHANGE DEFAULT MEDIA QUERIES AND WIDTHS
async function imageShortcode(
    src,
    alt,
    className,
    loading,
    sizes = '(max-width: 600px) 400px, 1680px',
    fetchPriority // <-- optional new argument
) {
    if (alt === undefined) {
        throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
    }

    let metadata = await Image(`${src}`, {
        widths: [400, 480, 720, 850, 1080, 1280, 1440, 1680, 1920],
        formats: ['webp', 'jpeg'],
        urlPath: '/assets/images/',
        outputDir: './public/assets/images',
        filenameFormat: function (id, src, width, format, options) {
            const extension = path.extname(src);
            const name = path.basename(src, extension);
            return `${name}-${width}w.${format}`;
        },
    });

    let lowsrc = metadata.jpeg[0];
    let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

    const fetchPriorityAttr = fetchPriority ? ` fetchpriority="${fetchPriority}"` : '';

    return `<picture class="${className}">
		${Object.values(metadata)
            .map((imageFormat) => {
                return `  <source type="${imageFormat[0].sourceType}" srcset="${imageFormat
                    .map((entry) => entry.srcset)
                    .join(', ')}" sizes="${sizes}">`;
            })
            .join('\n')}
			<img
				src="${lowsrc.url}"
				width="${highsrc.width}"
				height="${highsrc.height}"
				alt="${alt}"
				loading="${loading}"
				decoding="async"${fetchPriorityAttr}>
		</picture>`;
}

module.exports = function (eleventyConfig) {
    // adds the navigation plugin for easy navs
    eleventyConfig.addPlugin(eleventyNavigationPlugin);

    // Allows the {% image %} shortcode to be used for optimised images (in webp if possible)
    eleventyConfig.addNunjucksAsyncShortcode('image', imageShortcode);

    // ═════════════════════════════════════════════════════════════════════════
    // LANGUAGES
    // Using Eleventy's build events to process non-template languages
    // Learn more: https://www.11ty.dev/docs/events/
    // ═════════════════════════════════════════════════════════════════════════

    /*
     * JavaScript & CSS Processing
     * These processors handle bundling, transpiling, and minification
     * - JavaScript: Compiled with esbuild for modern bundling
     * - CSS/SASS: Processed and minified for production, including a PostCSS pipeline
     */
    eleventyConfig.on("eleventy.after", javascript);
    eleventyConfig.on("eleventy.after", sass);

    // ═════════════════════════════════════════════════════════════════════════
    // PLUGINS
    // Extend Eleventy with additional functionality
    // Learn more: https://www.11ty.dev/docs/plugins/
    // ═════════════════════════════════════════════════════════════════════════

    /*
     * 🖼️ Image Optimization
     * Resize and optimize images for better performance using {% getUrl %}
     * Documentation: https://github.com/CodeStitchOfficial/eleventy-plugin-sharp-images
     */
    eleventyConfig.addPlugin(pluginImages, {
        ...configImages,
        cache: false  // Disable caching in Sharp plugin
    });


    /*
     * 🗺️ Sitemap Generation
     * Creates sitemap.xml automatically using domain from _data/client.json
     * Documentation: https://github.com/quasibit/eleventy-plugin-sitemap
     */
    eleventyConfig.addPlugin(pluginSitemap, configSitemap);

    /*
     * 📦 Production Minification
     * Minifies HTML, CSS, JSON, XML, XSL, and webmanifest files
     * Only runs during production builds (npm run build)
     * Documentation: https://github.com/CodeStitchOfficial/eleventy-plugin-minify
     */
    if (isProduction) {
        eleventyConfig.addPlugin(pluginMinifier);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PASSTHROUGH COPIES
    // Copy files directly to output without processing
    // Learn more: https://www.11ty.dev/docs/copy/
    // ═════════════════════════════════════════════════════════════════════════

    eleventyConfig.addPassthroughCopy("./src/assets"); // Static assets
    eleventyConfig.addPassthroughCopy("./src/admin"); // CMS admin files
    eleventyConfig.addPassthroughCopy("./src/_redirects"); // Redirect rules

    // ═════════════════════════════════════════════════════════════════════════
    // FILTERS
    // Transform data in templates at build time
    // Learn more: https://www.11ty.dev/docs/filters/
    // ═════════════════════════════════════════════════════════════════════════

    /*
     * 📅 Human-Readable Date Formatting Filter
     * Converts JavaScript dates to human-readable format
     * Usage: {{ "2023-12-02" | postDate }}
     * Powered by Luxon: https://moment.github.io/luxon/api-docs/
     */
    eleventyConfig.addFilter("postDate", filterPostDate);

    /*
     * 📅 ISO Date Formatting Filter
     * Converts JavaScript dates to ISO 8601 format
     * Usage: {{ "2023-12-02" | isoDate }}
     * Powered by Luxon: https://moment.github.io/luxon/api-docs/
     */
    eleventyConfig.addFilter("isoDate", filterIsoDate);

    /*
     * 📅 Month Name Filter
     * Converts a date to lowercase month name (e.g., "january", "february")
     * Usage: {{ page.date | monthName }}
     * Useful for creating readable URL slugs like /blog/2026/january/post-title/
     */
    eleventyConfig.addFilter("monthName", function (date) {
        const monthNames = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ];
        const d = new Date(date);
        return monthNames[d.getMonth()];
    });

    /*
     * 📅 Slug Date Filter
     * Formats a date as "month-day-year" for use in post permalinks
     * Usage: {{ date | slugDate }} → "july-26-2025"
     */
    eleventyConfig.addFilter("slugDate", function (date) {
        const monthNames = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ];
        const d = new Date(date);
        return `${monthNames[d.getMonth()]}-${d.getDate()}-${d.getFullYear()}`;
    });

    /*
     * 📅 Upcoming Only Filter
     * Filters a collection to items whose date is today or in the future, sorted ascending.
     * Usage: {% set upcoming = collections.event | upcomingOnly %}
     */
    /*
     * 📅 Event Date Filter
     * Formats a date as "Day, Month D, YYYY" for event posts
     * Usage: {{ date | eventDate }} → "Saturday, May 16, 2026"
     */
    eleventyConfig.addFilter("eventDate", function (date) {
        const { DateTime } = require("luxon");
        return DateTime.fromJSDate(date, { zone: "utc" }).toFormat("cccc, MMMM d, yyyy");
    });

    /*
     * 🕐 Event Time Filter
     * Formats a datetime string as a readable time in Mountain Time
     * Usage: {{ startTime | eventTime }} → "6:00 PM"
     */
    eleventyConfig.addFilter("eventTime", function (value) {
        if (!value) return "";
        const { DateTime } = require("luxon");
        return DateTime.fromJSDate(new Date(value), { zone: "America/Denver" })
            .toFormat("h:mm a")
            .toUpperCase();
    });

    eleventyConfig.addFilter("upcomingOnly", function (collection) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return collection
            .filter(item => new Date(item.data.date) >= today)
            .sort((a, b) => new Date(a.data.date) - new Date(b.data.date));
    });

    /*
    * 📅 Is Future Date Filter
    * Checks if a date is in the future (not expired)
    * Usage: {{ specialDate | isFutureDate }}
    * Returns true/false
    */
    eleventyConfig.addFilter("isFutureDate", function (date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day
        const compareDate = new Date(date);
        return compareDate >= today;
    });

    // ═════════════════════════════════════════════════════════════════════════
    // SHORTCODES
    // Generate dynamic content with JavaScript
    // Learn more: https://www.11ty.dev/docs/shortcodes/
    // ═════════════════════════════════════════════════════════════════════════

    /*
     * 📆 Current Year Shortcode
     * Outputs the current year (useful for copyright notices)
     * Usage: {% year %}
     * Updates automatically with each build
     */
    eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

    // ═════════════════════════════════════════════════════════════════════════
    // BUILD CONFIGURATION
    // Define input/output directories and template engine
    // ═════════════════════════════════════════════════════════════════════════

    return {
        dir: {
            input: "src", // Source files directory
            output: "public", // Build output directory
            includes: "_includes", // Partial templates directory
            data: "_data", // Global data files directory
        },
        htmlTemplateEngine: "njk", // Nunjucks for HTML templates
    };
};