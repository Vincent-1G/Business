
Vincent deleted a message
Vincent deleted a message
const serviceDetails = {
  "Driveway Sealing": "We clean your driveway, fill small cracks, and apply a protective sealant coat. It helps stop water damage and makes the surface look new again.",
  "Land Mowing": "We mow and tidy lawns, yards, and larger properties. Choose a one-time visit or a regular schedule.",
  "Plumbing": "We fix leaks, clogs, and other common plumbing problems. Tell us what is wrong and we will get it sorted.",
  "Basic Computer Services": "We help with setup, cleanup, updates, and simple fixes so your computer runs smoothly.",
  "Car Wash": "A full wash inside and out. We clean the body, wheels, windows, and interior.",
  "Roof Sealing": "We seal small leaks and cracks to protect your roof from rain and heat.",
  "Wall Repainting": "We prepare the walls and apply fresh paint for a clean new look, inside or outside.",
  "Window Cleaning": "We clean windows inside and out for a clear, streak-free finish.",
  "Furniture Assembly": "We assemble beds, desks, shelves, and other furniture so you can skip the instructions."
};


/* ----------------------------------------------------------
   2. FIND THE HTML ELEMENTS
   We save them in variables so we can use them below.
   ---------------------------------------------------------- */
const menuButton = document.querySelector("#menu-button");
const navMenu = document.querySelector("#nav-menu");
const navLinks = document.querySelectorAll(".nav-link");

const modal = document.querySelector("#modal");
const modalTitle = document.querySelector("#modal-title");
const modalText = document.querySelector("#modal-text");
const modalCloseButton = document.querySelector("#modal-close");
const modalContactButton = document.querySelector("#modal-contact-button");

const contactForm = document.querySelector("#contact-form");
const formMessage = document.querySelector("#form-message");
const messageBox = document.querySelector("#message");


/* ----------------------------------------------------------
   3. MOBILE HAMBURGER MENU
   Clicking the button adds or removes the class "open".
   The CSS shows the menu when it has the class "open".
   ---------------------------------------------------------- */
function closeMenu() {
  navMenu.classList.remove("open");
  menuButton.textContent = "☰";
  menuButton.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", function () {
  navMenu.classList.toggle("open");

  if (navMenu.classList.contains("open")) {
    menuButton.textContent = "✕";
    menuButton.setAttribute("aria-expanded", "true");
  } else {
    menuButton.textContent = "☰";
    menuButton.setAttribute("aria-expanded", "false");
  }
});

// Close the menu after the visitor picks a link
navLinks.forEach(function (link) {
  link.addEventListener("click", closeMenu);
});


/* ----------------------------------------------------------
   4. SMOOTH SCROLLING
   Every link that starts with "#" scrolls smoothly
   to the section with that id.
   ---------------------------------------------------------- */
const scrollLinks = document.querySelectorAll('a[href^="#"]');

scrollLinks.forEach(function (link) {
  link.addEventListener("click", function (event) {
    const targetId = link.getAttribute("href");
    const targetSection = document.querySelector(targetId);

    if (targetSection) {
      event.preventDefault();   // stop the sudden jump
      targetSection.scrollIntoView({ behavior: "smooth" });
    }
  });
});


/* ----------------------------------------------------------
   5. ACTIVE MENU LINK
   While scrolling, we check which section is at the top
   of the screen and highlight its menu link.
   ---------------------------------------------------------- */
function updateActiveLink() {
  const sectionIds = ["home", "services", "about", "contact"];
  let currentId = "home";

  // Go through each section. The last one that has reached the top wins.
  for (let i = 0; i < sectionIds.length; i++) {
    const section = document.getElementById(sectionIds[i]);
    const distanceFromTop = section.getBoundingClientRect().top;

    if (distanceFromTop <= 120) {
      currentId = sectionIds[i];
    }
  }

  // If we are at the very bottom of the page, the last link is active
  const atBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 5;
  if (atBottom) {
    currentId = "contact";
  }

  // Add the class "active" to the matching link, remove it from the others
  navLinks.forEach(function (link) {
    if (link.getAttribute("href") === "#" + currentId) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

window.addEventListener("scroll", updateActiveLink);
updateActiveLink();   // run once when the page loads


/* ----------------------------------------------------------
   6. POPUP (MODAL)
   ---------------------------------------------------------- */

// This remembers the message to put in the contact form
let contactMessage = "";

function openModal(title, text, message) {
  modalTitle.textContent = title;
  modalText.textContent = text;
  contactMessage = message;
  modal.classList.add("show");
}

function closeModal() {
  modal.classList.remove("show");
}

// Get the details text for a service (or a default text if not found)
function getServiceDetails(serviceName) {
  if (serviceDetails[serviceName]) {
    return serviceDetails[serviceName];
  } else {
    return "Contact us to learn more about " + serviceName + ".";
  }
}

// --- "Learn More" buttons ---
const learnMoreButtons = document.querySelectorAll(".learn-more-button");

learnMoreButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const serviceName = button.dataset.service;

    openModal(
      serviceName,
      getServiceDetails(serviceName),
      "Hi! I would like to know more about " + serviceName + "."
    );
  });
});

// --- "Get Discount" buttons ---
const discountButtons = document.querySelectorAll(".discount-button");

discountButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const serviceName = button.dataset.service;
    const discount = button.dataset.discount;

    openModal(
      discount + ": " + serviceName,
      "Good news! You can get " + discount + " on " + serviceName + ". Tap the button below and we will start your message for you.",
      "Hi! I would like to get the " + discount + " discount on " + serviceName + "."
    );
  });
});

// --- "Request a Quote" buttons ---
const quoteButtons = document.querySelectorAll(".quote-button");

quoteButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const serviceName = button.dataset.service;

    openModal(
      "Request a Quote: " + serviceName,
      "Tell us about your job and we will get back to you with a quote. Tap the button below and we will start your message for you.",
      "Hi! I would like a quote for " + serviceName + "."
    );
  });
});

// --- Ways to close the popup ---

// 1. Click the X button
modalCloseButton.addEventListener("click", closeModal);

// 2. Click the dark area outside the white box
modal.addEventListener("click", function (event) {
  if (event.target === modal) {
    closeModal();
  }
});

// 3. Press the Escape key
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeModal();
  }
});

// 4. Click "Contact Us" inside the popup:
//    fill in the message box, then close the popup.
//    (The smooth scrolling code above moves the page to the form.)
modalContactButton.addEventListener("click", function () {
  messageBox.value = contactMessage;
  closeModal();
});


/* ----------------------------------------------------------
   7. CONTACT FORM
   There is no backend, so we only show a thank-you message.
   ---------------------------------------------------------- */
contactForm.addEventListener("submit", function (event) {
  event.preventDefault();   // stop the page from reloading

  formMessage.textContent = "Thank you! Your message has been received.";
  formMessage.classList.add("show");

  contactForm.reset();      // clear the form fields
});