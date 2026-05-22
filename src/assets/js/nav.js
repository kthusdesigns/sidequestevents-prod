// Select DOM elements
const bodyElement = document.querySelector("body");
const navbarMenu = document.querySelector("#navigation .nav-list");
const hamburgerMenus = document.querySelectorAll("#navigation .hamburger-menu");
const navLinks = document.querySelectorAll('#navigation .nav-link');
const dropdownLinks = document.querySelectorAll('#navigation .dropdown__li-link'); // for submenu links
const dropdownItems = document.querySelectorAll('#navigation li.dropdown');
const submenuButtons = document.querySelectorAll('.submenu-button');

// Function to toggle the aria-expanded attribute
function toggleAriaExpanded(elements) {
    elements.forEach(el => {
        const isExpanded = el.getAttribute("aria-expanded");
        el.setAttribute("aria-expanded", isExpanded === "false" ? "true" : "false");
    });
}

// Mobile: Close menu on nav link click (including submenu links)
function closeMenuOnLinkClick(link) {
    link.addEventListener("click", () => {
        // Only close menu if viewport is mobile and the menu is open
        if (window.innerWidth < 992 && navbarMenu.classList.contains("active")) {
            closeMobileMenu();
        }
    });
}

// Attach the event listeners to normal links and submenu links
navLinks.forEach(link => {
    closeMenuOnLinkClick(link);
});

dropdownLinks.forEach(link => {
    closeMenuOnLinkClick(link);
});

// Function to close the mobile menu
function closeMobileMenu() {
    hamburgerMenus.forEach(btn => btn.classList.remove("active"));
    navbarMenu.classList.remove("active");
    bodyElement.classList.remove("open");
    toggleAriaExpanded(hamburgerMenus); // reset aria-expanded to false
}

// Mobile: Close menu on dropdown button click
submenuButtons.forEach(button => {
    const dropdown = button.closest('.dropdown');

    button.addEventListener('click', e => {
        if (window.innerWidth < 992) {
            e.preventDefault();
            const isActive = dropdown.classList.toggle('active');
            button.setAttribute('aria-expanded', isActive);
        }
    });
});

// Function to toggle the menu open or closed
function toggleMenu() {
    hamburgerMenus.forEach(btn => btn.classList.toggle("active"));
    toggleAriaExpanded(hamburgerMenus);
    navbarMenu.classList.toggle("active");
    bodyElement.classList.toggle("open");
}

// Add click event listeners to both hamburger buttons
hamburgerMenus.forEach(button => {
    button.addEventListener("click", toggleMenu);
});

// Add click event listener to the navbar menu to close menu if background is clicked
navbarMenu.addEventListener("click", function (event) {
    // Close menu only if the click happens on the background, not the links themselves
    if (event.target === navbarMenu && navbarMenu.classList.contains("active")) {
        closeMobileMenu();
    }
});

// Escape key closes menu if open
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navbarMenu.classList.contains("active")) {
        closeMobileMenu();
    }
});

// Listen for window resize and reset menu
window.addEventListener("resize", () => {
    if (window.innerWidth >= 992 && bodyElement.classList.contains("open")) {
        closeMobileMenu();
    }

    if (window.innerWidth >= 992) {
        dropdownItems.forEach(dropdown => {
            dropdown.classList.remove('active');
            const button = dropdown.querySelector('.submenu-button');
            button?.setAttribute('aria-expanded', 'false');
        });
    }
});